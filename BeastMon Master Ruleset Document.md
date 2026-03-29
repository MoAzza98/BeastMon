# BeastMon MVP Final Battle Rules Lock

This document is the authoritative top-level battle rules lock for the BeastMon MVP.
It removes ambiguity at the battle-rules level. Two independent implementations using the same pinned versions, inputs, and seed must produce the exact same canonical battle artifact.

---

## 1. System Architecture Lock

### 1.1 Pure Simulation Kernel

The simulation kernel is a pure deterministic function.

**Inputs**

* `engine_version`
* `content_version`
* `ruleset_version`
* `seed`
* `side_a_species_id`
* `side_b_species_id`

**Output**

* canonical battle artifact

The kernel is solely responsible for:

* variable move rolls
* weighted move selection
* RNG consumption
* turn order
* damage
* statuses
* abilities
* event generation
* terminal result generation

The kernel contains no:

* network logic
* persistence
* playback timing
* client state
* rendering logic

### 1.2 Server-Authoritative Orchestration / Playback Layer

The server orchestration layer is separate from the simulation kernel.

The flow is locked as:

1. server receives the seed and battle request
2. server runs the full simulation immediately
3. server stores the canonical battle artifact
4. server sets canonical playback timing / round timing
5. clients load the artifact and replay locally from the correct server-timed offset

The server is authoritative for:

* battle truth
* canonical artifact
* canonical playback timing
* canonical round timing
* canonical playback position

The server is not where battle rules are defined.

### 1.3 Client Replay / Verification Consumer

The client:

* loads the server-authored artifact
* loads server-authored timing metadata
* replays locally from the correct server-timed offset
* may optionally re-simulate for verification

**Authority boundary**
The client may re-simulate for verification, but authoritative round state and canonical playback position come from the server-authored artifact and server-authored timing metadata.

The client is not authoritative for battle truth.

---

## 2. Battle Format Lock

* 1v1 only
* exactly one BeastMon per side
* no switching
* no reserve bench
* no PP
* all four moves are always legal unless action is prevented by battle state
* one non-volatile status maximum per BeastMon

---

## 3. Species Identity Lock

Each species has fixed:

* one type
* HP
* Atk
* Def
* Speed
* one ability
* two signature moves
* six variable pool moves

---

## 4. Battle-Specific Move Construction Lock

Each battle-specific final moveset contains exactly four moves in canonical slot order:

1. signature move 1
2. signature move 2
3. rolled variable move 1
4. rolled variable move 2

Rolled variable moves are selected exactly as follows:

1. take the species’ ordered six-move variable pool
2. draw one uniform index from `[0, 5]`
3. select that move as rolled variable move 1
4. remove it while preserving the order of the remaining five moves
5. draw one uniform index from `[0, 4]`
6. select that move as rolled variable move 2

This selection is:

* seed-decided
* uniform
* unbiased
* without replacement
* unweighted
* not heuristic
* not context-aware

---

## 5. Move Schema Lock

Every move must define:

* `move_id`
* `name`
* `type`
* `category`
* `power`
* `accuracy`
* `priority`
* `crit_enabled`

If the move can inflict a non-volatile status, it must also define:

* `inflicted_status`
* `status_application_mode`

  * allowed values:

    * `guaranteed`
    * `rolled`
* `status_proc_numerator`
* `status_proc_denominator`

Rules:

* `power` is required for every move
* for pure status moves, `power = 0`
* if `status_application_mode = guaranteed`, no status proc draw is consumed
* if `status_application_mode = rolled`, status proc success is resolved using `status_proc_numerator / status_proc_denominator`
* if a move cannot inflict a non-volatile status, `inflicted_status` is null and no status proc fields are used for battle resolution

---

## 6. Move Choice Lock

Move choice for the acting BeastMon each turn is resolved as:

1. inspect current battle state
2. compute an integer weight for each of the four available moves
3. if total weight is greater than zero, select the move using a seed-derived weighted draw
4. if all four weights are zero, select uniformly using the all-zero fallback draw

Move choice is **not** deterministic best-move selection.

---

## 7. Allowed Move-Weighting Inputs Lock

The move-weighting model may inspect only:

* move category
* move power
* move accuracy
* type effectiveness
* rough KO possibility
* whether target already has a non-volatile status
* speed comparison
* self HP state
* target HP state
* whether self is ahead
* whether self is behind
* whether self is low HP
* whether target is low HP

The weighting model may not inspect:

* future trees
* future turns
* recursive simulation
* hidden information
* deep search
* combo search

---

## 8. Percentage-Relative HP State Lock

### 8.1 Ahead / Behind

Ahead / behind must use percentage-relative comparison with integer math only.

Let:

* `self_hp = self.current_hp`
* `self_max = self.max_hp`
* `target_hp = target.current_hp`
* `target_max = target.max_hp`

Compare cross-products:

* self is **ahead** if `self_hp * target_max > target_hp * self_max`
* self is **behind** if `self_hp * target_max < target_hp * self_max`
* neither if equal

No floating-point percentage conversion is allowed.

### 8.2 Low HP

A BeastMon is low HP if:

`current_hp * 4 <= max_hp`

That is:

* low HP means `<= 25% max HP`

---

## 9. Weighted Move-Selection Formula Lock

For each move:

`weight = max(0, base_weight + sum(applicable_additive_adjustments))`

All weights are integers.

All applicable additive adjustments stack with the base weight unless an explicit invalidation rule sets the weight to `0`.

### 9.1 Base Weights

* damage move: `100`
* damage_plus_status move: `110`
* pure status move: `40`

### 9.2 Power Adjustment

For moves with `power > 0`:

`power_adj = floor(power / 2)`

For `power = 0`:

`power_adj = 0`

### 9.3 Accuracy Adjustment

For all moves:

`accuracy_adj = floor((accuracy - 100) / 2)`

Examples:

* 100 accuracy -> `0`
* 90 accuracy -> `-5`
* 80 accuracy -> `-10`

### 9.4 Type-Effectiveness Adjustment

For damaging and damage_plus_status moves:

* super effective: `+35`
* neutral: `0`
* resisted: `-25`
* immune: `weight = 0`

For pure status moves:

* no type-effectiveness bonus is applied unless the move is invalid by immunity/rules, in which case `weight = 0`

### 9.5 Rough KO Adjustment

For damaging and damage_plus_status moves only:

If `rough_damage >= target_current_hp`:

* `+60`

Else:

* `0`

### 9.6 Rough KO Formula Lock

Rough KO logic is fully pinned and uses only immediate current-state estimation.

Let:

* `P = move.power`
* `A_weight = current effective Atk for weighting`
* `D_weight = current effective Def for weighting`
* `stab_mul_fp = 1500` if move type equals attacker type, else `1000`
* `type_mul_fp = current type effectiveness multiplier against the target`
* fixed-point denominator = `1000`

Then rough damage is computed exactly as:

1. `r1 = P`
2. `r2 = floor((r1 * A_weight) / max(1, D_weight))`
3. `r3 = floor(r2 / 2)`
4. `r4 = floor((r3 * stab_mul_fp) / 1000)`
5. `rough_damage = floor((r4 * type_mul_fp) / 1000)`

Where:

* `A_weight` uses the attacker’s current effective Atk at move-selection time, including burn and any always-active currently applicable attack modifiers
* `D_weight` uses the defender’s current effective Def at move-selection time, including any always-active currently applicable defense modifiers
* STAB is included
* type effectiveness is included

Rough KO logic explicitly excludes:

* crit
* variance
* future statuses
* future turns
* recursive simulation

### 9.7 Status Invalidation

If a move’s status effect is invalid because:

* target already has a non-volatile status
* target is immune by ability
* target is immune by rules/type interaction

then that status component contributes no valid status value.

For pure status moves whose only purpose is an invalid non-volatile status:

* `weight = 0`

### 9.8 Speed Comparison Adjustments

If the acting BeastMon is slower than the target:

* paralysis-inflicting pure status move: `+25`
* positive-priority damaging move: `+20`

Otherwise:

* `0`

### 9.9 HP-State Adjustments for Pure Status Moves

For pure status moves only:

* if self is behind: `+20`
* if self is low HP: `+20`
* if target already has a non-volatile status: `weight = 0`

Additional status-specific bonuses:

* paralysis-inflicting move and target is faster: `+25`
* burn-inflicting move and target is not low HP: `+15`
* freeze-inflicting move and self is behind: `+15`

### 9.10 HP-State Adjustments for Damage-Plus-Status Moves

If target already has a non-volatile status:

* no status bonus

Else:

* `+10`

If self is behind:

* `+10`

### 9.11 All-Zero Fallback

If all four move weights are zero:

* consume one fallback draw
* choose uniformly from the four move slots

### 9.12 Weighted Selection Procedure

If total weight `W > 0`:

1. draw `r` uniformly from `[0, W - 1]`
2. iterate moves in canonical slot order:

   1. signature move 1
   2. signature move 2
   3. rolled variable move 1
   4. rolled variable move 2
3. accumulate weights in slot order
4. choose the first move where `r < cumulative_weight`

---

## 10. Turn Order Lock

Action order is resolved by:

1. higher move priority
2. higher effective Speed
3. speed tie draw if still tied

---

## 11. Status Rules Lock

### 11.1 Burn

Burn is locked exactly as:

* burned BeastMon has Atk reduced to `0.5x` for damage calculation
* burned BeastMon takes end-of-turn burn damage equal to `1/8 max HP`, minimum `1`

### 11.2 Paralysis

Paralysis is locked exactly as:

* Speed multiplier = `0.5x`
* action-fail chance = `1/4`

At action attempt:

* if actor is paralyzed, consume one paralysis fail draw
* action fails if and only if the draw succeeds under the pinned 1/4 failure rule
* on failure, the action is lost

### 11.3 Freeze

Freeze is locked exactly as:

* thaw chance = `1/4`

At action attempt:

* if actor is frozen, consume one thaw draw
* if thaw succeeds:

  * remove frozen
  * continue action normally
* if thaw fails:

  * action is lost

No extra thaw exceptions exist in MVP.

---

## 12. Crit Lock

Crit is locked exactly as:

* crit chance = `1/16`
* crit multiplier = `1.5x`
* crit is only a damage multiplier
* crit does not bypass burn
* crit does not bypass defense
* crit does not bypass abilities
* crit does not bypass any other modifiers

---

## 13. Variance Lock

Variance is locked exactly as:

* uniform integer variance multiplier from `850` to `1000` inclusive
* fixed-point denominator = `1000`

---

## 14. Fixed-Point Math Lock

All multiplier math uses fixed-point integer arithmetic with denominator `1000`.

Examples:

* `0.5x = 500`
* `1.0x = 1000`
* `1.5x = 1500`
* `2.0x = 2000`

Rules:

* all division is floor division
* floor after every multiply/divide stage
* no floating point is allowed

---

## 15. Type Multiplier Lock

For damage calculation, type effectiveness resolves to one of:

* immune = `0`
* resisted = `500`
* neutral = `1000`
* super effective = `2000`

MVP uses single-type species only.

---

## 16. STAB Lock

If move type equals attacker type:

* `stab_mul_fp = 1500`

Otherwise:

* `stab_mul_fp = 1000`

---

## 17. Damage Formula Lock

### 17.1 Inputs

* `L = 50`
* `P = move.power`
* `A_base = attacker.base_atk`
* `D_base = defender.base_def`

### 17.2 Effective Attack

1. apply burn:

   * `A1 = floor((A_base * 500) / 1000)` if burned
   * otherwise `A1 = A_base`
2. apply attacker attack ability modifiers in pinned order
3. `A = max(1, resulting_value)`

### 17.3 Effective Defense

1. `D1 = D_base`
2. apply defender defense ability modifiers in pinned order
3. `D = max(1, resulting_value)`

### 17.4 Base Damage Core

1. `x1 = floor((2 * L) / 5) + 2`
2. `x2 = x1 * P`
3. `x3 = floor((x2 * A) / D)`
4. `x4 = floor(x3 / 50) + 2`

With `L = 50`, `x1 = 22`, but implementations must still use the formula.

### 17.5 Modifier Order

Modifiers are applied in this exact order:

1. crit
2. STAB
3. type effectiveness
4. ability damage modifiers
5. variance

### 17.6 Modifier Application

5. `x5 = floor((x4 * crit_mul_applied_fp) / 1000)`
6. `x6 = floor((x5 * stab_mul_fp) / 1000)`
7. `x7 = floor((x6 * type_mul_fp) / 1000)`
8. `x8 = apply_damage_ability_modifiers(x7)`
9. `x9 = floor((x8 * variance_mul_fp) / 1000)`

Where:

* crit multiplier is `1500` on crit, else `1000`
* variance multiplier is the drawn integer in `[850, 1000]`

### 17.7 Final Damage

If `type_mul_fp = 0`:

* `final_damage = 0`

Else if move is damaging and hit succeeded:

* `final_damage = max(1, x9)`

Pure status moves with `power = 0` deal no damage.

---

## 18. Ability Scope Lock

MVP launch-content abilities must stay basic and auditable.

Allowed launch-content classes include:

* Huge Power
* low-HP same-type boost
* Speed Boost
* Intimidate
* Sturdy
* Sniper
* simple status immunity abilities
* simple type immunity abilities

Architectural support for `ON_MOVE_WEIGHT` may exist, but launch-content abilities must not use `ON_MOVE_WEIGHT`.

Launch abilities are limited to simpler trigger windows:

* `ON_BATTLE_START`
* `ON_BEFORE_DAMAGE`
* `ON_AFTER_DAMAGE`
* `ON_TURN_END`
* `ON_SURVIVE_LETHAL`
* `ON_STATUS_APPLY_ATTEMPT`

---

## 19. Accuracy-Step Lock

Every move that reaches the accuracy step and has an accuracy field consumes exactly one accuracy draw.

If effective accuracy is `100`, the move still consumes the draw and always hits.

The move hits if and only if:

`accuracy_draw < effective_accuracy_percent`

Where:

* `accuracy_draw` is uniform in `[0, 99]`
* `effective_accuracy_percent` is an integer in `[0, 100]`

This rule is locked.

---

## 20. Exact RNG Consumption Order Lock

No RNG draw may be added, removed, reordered, or speculatively consumed.

The battle uses one deterministic RNG stream derived from the single battle seed.

### 20.1 Pre-Battle Draws

For side A:

1. variable move 1 draw from `[0, 5]`
2. variable move 2 draw from `[0, 4]`

For side B:
3. variable move 1 draw from `[0, 5]`
4. variable move 2 draw from `[0, 4]`

### 20.2 Per-Turn Draws

#### Phase A — Move Selection

1. side A weighted move-selection draw, or all-zero fallback draw
2. side B weighted move-selection draw, or all-zero fallback draw

These occur before action ordering.

#### Phase B — Action Ordering

3. if selected move priority and effective Speed are tied, consume one speed tie draw

#### Phase C — First Action Resolution

For the first acting BeastMon, in exact reached-step order:
4. thaw draw, if frozen at action attempt
5. paralysis fail draw, if paralyzed and still proceeding after thaw logic
6. accuracy draw, if action still proceeds and move has an accuracy field
7. crit draw, if move hit, move is damaging, and crit is enabled
8. variance draw, if move hit and move is damaging
9. status proc draw, if move hit and move has a rolled status proc

#### Phase D — Terminal Check

If battle ends after first action:

* no second-action draws are consumed

#### Phase E — Second Action Resolution

For the second acting BeastMon, in exact reached-step order:
10. thaw draw, if frozen at action attempt
11. paralysis fail draw, if paralyzed and still proceeding after thaw logic
12. accuracy draw, if action still proceeds and move has an accuracy field
13. crit draw, if move hit, move is damaging, and crit is enabled
14. variance draw, if move hit and move is damaging
15. status proc draw, if move hit and move has a rolled status proc

#### Phase F — End of Turn

No RNG draws occur at end of turn in MVP unless introduced by a future pinned ruleset version.

---

## 21. Draw Definitions Lock

### 21.1 Weighted Move-Selection Draw

Consumed if total move weight `W > 0`.

Produces:

* uniform integer in `[0, W - 1]`

### 21.2 All-Zero Fallback Draw

Consumed if and only if all four move weights are zero.

Produces:

* uniform integer in `[0, 3]`

### 21.3 Speed Tie Draw

Consumed if and only if:

* selected move priorities are equal
* effective Speeds are equal

Produces:

* uniform integer in `[0, 1]`

### 21.4 Thaw Draw

Consumed if and only if actor is frozen at action attempt.

Produces:

* uniform integer in `[0, 3]`

Thaw succeeds if and only if:

* `draw == 0`

Equivalent chance:

* `1/4`

### 21.5 Paralysis Fail Draw

Consumed if and only if actor is paralyzed and action is still proceeding after thaw logic.

Produces:

* uniform integer in `[0, 3]`

Paralysis action failure occurs if and only if:

* `draw == 0`

Equivalent chance:

* `1/4`

### 21.6 Accuracy Draw

Consumed if and only if:

* action is still proceeding
* move has an accuracy field
* move reaches the accuracy step

Produces:

* uniform integer in `[0, 99]`

Move hits if and only if:

* `accuracy_draw < effective_accuracy_percent`

If `effective_accuracy_percent = 100`:

* draw is still consumed
* move always hits

### 21.7 Crit Draw

Consumed if and only if:

* move hit
* move is damaging
* move has crit enabled

Produces:

* uniform integer in `[0, 15]`

Crit occurs if and only if:

* `draw == 0`

### 21.8 Variance Draw

Consumed if and only if:

* move hit
* move is damaging

Produces:

* uniform integer in `[850, 1000]`

This integer is the exact `variance_mul_fp`.

### 21.9 Status Proc Draw

Consumed if and only if:

* move hit
* move has a rolled status proc

Produces:

* uniform integer in `[0, status_proc_denominator - 1]`

Status proc succeeds if and only if:

* `status_proc_draw < status_proc_numerator`

If status is guaranteed on hit:

* no status proc draw is consumed

If status is invalid at application time:

* application fails
* no extra recovery draw occurs

---

## 22. No-Speculative-Draw Rule Lock

The simulator must not consume future hypothetical draws for steps that are not reached.

Examples:

* if thaw fails, no paralysis fail draw is consumed
* if paralysis fails, no accuracy draw is consumed
* if move misses, no crit draw is consumed
* if move misses, no variance draw is consumed
* if battle ends after first action, no second-action draws are consumed

This rule is locked.

---

## 23. Pinned Numerical Constants

### 23.1 Core Fixed-Point Constants

* fixed-point denominator = `1000`

### 23.2 Type Multipliers

* immune = `0`
* resisted = `500`
* neutral = `1000`
* super effective = `2000`

### 23.3 STAB

* STAB on = `1500`
* STAB off = `1000`

### 23.4 Burn

* burn Atk multiplier = `500`
* burn residual damage fraction = `1/8 max HP`
* burn residual minimum damage = `1`

### 23.5 Paralysis

* paralysis Speed multiplier = `500`
* paralysis fail chance = `1/4`
* paralysis fail draw range = `[0, 3]`
* paralysis fails on draw `== 0`

### 23.6 Freeze

* thaw chance = `1/4`
* thaw draw range = `[0, 3]`
* thaw succeeds on draw `== 0`

### 23.7 Crit

* crit chance = `1/16`
* crit draw range = `[0, 15]`
* crit occurs on draw `== 0`
* crit multiplier = `1500`

### 23.8 Variance

* variance minimum = `850`
* variance maximum = `1000`

### 23.9 Damage Formula

* fixed level constant `L = 50`

### 23.10 HP-State Thresholds

* low HP threshold = `<= 25% max HP`
* integer form: `current_hp * 4 <= max_hp`

### 23.11 Weighted Move-Selection Base Weights

* damage move base weight = `100`
* damage_plus_status move base weight = `110`
* pure status move base weight = `40`

### 23.12 Weighting Adjustments

* type super effective bonus = `+35`
* type resisted penalty = `-25`
* rough KO bonus = `+60`
* slower + paralysis pure status bonus = `+25`
* slower + positive-priority damaging move bonus = `+20`
* pure status self-behind bonus = `+20`
* pure status self-low-HP bonus = `+20`
* pure status paralysis vs faster target bonus = `+25`
* pure status burn vs target not low HP bonus = `+15`
* pure status freeze while behind bonus = `+15`
* damage_plus_status valid-status bonus = `+10`
* damage_plus_status self-behind bonus = `+10`

### 23.13 Accuracy Adjustment Formula

* `accuracy_adj = floor((accuracy - 100) / 2)`

### 23.14 Power Adjustment Formula

* `power_adj = floor(power / 2)`

### 23.15 Accuracy Draw Range

* `[0, 99]`

### 23.16 All-Zero Fallback Draw Range

* `[0, 3]`

### 23.17 Speed Tie Draw Range

* `[0, 1]`

---

## 24. Unresolved Items

Unresolved items = none.

---

## 25. Authority of This Document

This document is now the authoritative top-level battle rules lock for the BeastMon MVP.

All lower-level chunk specs, implementation specs, schemas, and conformance tests must conform to this document. Any lower-level specification that conflicts with this document is non-compliant.
