# BeastMon — Project Architecture Reference

This file is persistent context for Claude Code sessions working on BeastMon.
Each session is told which module to implement. Use this file to understand the full system, what is already built, and what is coming next, so your implementation is compatible with the whole.

---

## What BeastMon Is

A deterministic, provably fair, Pokémon-inspired 1v1 autobattler.

Two BeastMon enter a battle. A single seed determines all variable outcomes. The system produces one complete, reproducible battle artifact. Clients replay that artifact in sync with server-authored timing.

This is not a live player-input game. It is a deterministic battle engine that produces a canonical artifact, which is then revealed over time to viewers.

---

## Core Design Constraints

These are non-negotiable and must be respected by every module:

1. **Pure determinism** — same seed + same inputs = identical artifact, always
2. **No floating point** — all math uses integer arithmetic with fixed-point denominator 1000
3. **No speculative RNG draws** — draws are consumed only when their triggering condition is actually reached
4. **Strict RNG ordering** — draws happen in a pinned sequence; no reordering, no skipping, no extras
5. **Integer-only HP comparisons** — percentage comparisons use cross-multiplication, never division
6. **Kernel is pure** — the simulation kernel has zero network, persistence, or rendering logic
7. **Client is not authoritative** — the server owns battle truth; the client only replays

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode, exactOptionalPropertyTypes) |
| Package manager | npm workspaces |
| Test runner | Vitest |
| Server | Express (Node 20+) |
| Frontend | React 18 + Vite |
| Fixed-point denominator | 1000 (all multipliers are integers scaled by 1000) |

---

## Monorepo Structure

```
beastmon/
  package.json                  ← workspace root
  tsconfig.base.json            ← shared compiler options
  ARCHITECTURE.md               ← this file
  packages/
    kernel/                     ← pure simulation, no Node/browser APIs
      src/
        rng.ts                  ← seeded PRNG, all named draw methods
        constants.ts            ← all pinned numerical constants
        types.ts                ← all shared TypeScript interfaces
        typeChart.ts            ← type effectiveness lookup
        moves.ts                ← move content data
        species.ts              ← species content data
        damage.ts               ← pure damage calculation functions
        weighting.ts            ← pure move weighting functions
        abilities.ts            ← ability trigger handlers
        kernel.ts               ← top-level battle simulation entry point
        index.ts                ← public re-exports for the package
      tests/
        rng.test.ts
        damage.test.ts
        weighting.test.ts
        abilities.test.ts
        kernel.test.ts
    server/
      src/
        store.ts                ← in-memory battle artifact storage
        index.ts                ← Express server, POST /battle, GET /battle/:id
    client/
      src/
        playback.ts             ← timing engine, syncs display to server clock
        App.tsx                 ← root component
        main.tsx                ← React entry point
        components/
          BattleArena.tsx       ← outer layout, owns playback state
          MonCard.tsx           ← single BeastMon display (HP bar, status badge)
          BattleLog.tsx         ← scrolling event feed
          TurnIndicator.tsx     ← current turn display
```

---

## Session Map

| Session | Module | Status | Key outputs |
|---|---|---|---|
| 0 | Skeleton | ✅ Complete | Repo scaffold, all stubs, configs |
| 1 | RNG | ⬜ Todo | `rng.ts`, `rng.test.ts` |
| 2 | Types + Constants + TypeChart | ⬜ Todo | `types.ts`, `constants.ts`, `typeChart.ts` |
| 3 | Content | ⬜ Todo | `moves.ts`, `species.ts` |
| 4 | Damage | ⬜ Todo | `damage.ts`, `damage.test.ts` |
| 5 | Weighting | ⬜ Todo | `weighting.ts`, `weighting.test.ts` |
| 6 | Abilities | ⬜ Todo | `abilities.ts`, `abilities.test.ts` |
| 7 | Kernel | ⬜ Todo | `kernel.ts`, `kernel.test.ts` |
| 8 | Server | ⬜ Todo | `store.ts`, `server/index.ts` |
| 9 | Frontend | ⬜ Todo | All client files |

Sessions 4, 5, and 6 are independent of each other and can be completed in any order after Session 3.

---

## Package Dependency Graph

```
kernel     (no internal deps)
  ↑
server     (imports @beastmon/kernel)
  ↑
client     (imports @beastmon/kernel, fetches from server at runtime)
```

The kernel has zero dependencies on server or client. It is a pure library.

---

## Core Types Reference

These types are defined in `packages/kernel/src/types.ts` and used everywhere.
Do not redefine them locally in any module.

```typescript
type BeastMonType = 'fire' | 'grass' | 'water' | 'ice' | 'dragon'
type MoveCategory = 'damage' | 'damage_plus_status' | 'pure_status'
type StatusEffect = 'burn' | 'paralysis' | 'freeze'
type StatusApplicationMode = 'guaranteed' | 'rolled'
type Side = 'a' | 'b'

interface Move {
  move_id: string
  name: string
  type: BeastMonType
  category: MoveCategory
  power: number                              // 0 for pure status moves
  accuracy: number                           // integer 0–100
  priority: number
  crit_enabled: boolean
  inflicted_status: StatusEffect | null
  status_application_mode: StatusApplicationMode | null
  status_proc_numerator: number | null
  status_proc_denominator: number | null
}

interface Species {
  species_id: string
  name: string
  type: BeastMonType
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  signature_move_1: string                   // move_id ref
  signature_move_2: string                   // move_id ref
  variable_pool: [string, string, string, string, string, string]  // exactly 6 move_id refs
}

interface BattleMon {
  species_id: string
  name: string
  type: BeastMonType
  max_hp: number
  current_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  moveset: [Move, Move, Move, Move]          // canonical slot order
  status: StatusEffect | null                // one non-volatile status or null
  speed_boost_stacks: number                 // 0 at battle start
}

interface BattleArtifact {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
  winner: Side | 'draw'
  total_turns: number
  events: BattleEvent[]
  side_a_final_moveset: [Move, Move, Move, Move]
  side_b_final_moveset: [Move, Move, Move, Move]
}

interface KernelInputs {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
}

interface BattleTimingMetadata {
  battle_id: string
  started_at_ms: number
  turn_duration_ms: number                   // fixed at 2500ms
  playback_start_ms: number                  // started_at_ms + 3000ms buffer
}

interface StoredBattle {
  artifact: BattleArtifact
  timing: BattleTimingMetadata
}
```

---

## RNG Contract

**Algorithm:** Mulberry32 (32-bit, no external dependencies)
**Seed type:** `number` (u32)
**Class:** `RNG` — instantiated with a seed, stateful stream

Every draw type has a named method. No caller ever uses a raw `drawInt` outside of the RNG class itself. Named methods are:

| Method | Range | Used for |
|---|---|---|
| `drawVariableMove1()` | [0, 5] | Pre-battle move roll slot 1 |
| `drawVariableMove2()` | [0, 4] | Pre-battle move roll slot 2 |
| `drawWeightedSelection(W)` | [0, W-1] | Move selection when total weight > 0 |
| `drawAllZeroFallback()` | [0, 3] | Move selection when all weights = 0 |
| `drawSpeedTie()` | [0, 1] | Resolve speed ties (action order and end-of-turn order) |
| `drawThaw()` | [0, 3] | Thaw attempt for frozen mon (succeeds if draw == 0) |
| `drawParalysisFail()` | [0, 3] | Paralysis action fail (fails if draw == 0) |
| `drawAccuracy()` | [0, 99] | Hit check (hits if draw < effective_accuracy_percent) |
| `drawCrit()` | [0, 15] | Crit check (crits if draw == 0) |
| `drawVariance()` | [850, 1000] | Damage variance multiplier (this value is variance_mul_fp directly) |
| `drawStatusProc(denom)` | [0, denom-1] | Status proc check (succeeds if draw < numerator) |

---

## Pinned Numerical Constants

All of these live in `packages/kernel/src/constants.ts`.

```
FIXED_POINT_DENOM     = 1000
LEVEL                 = 50

// Type multipliers (fixed-point)
TYPE_IMMUNE           = 0
TYPE_RESISTED         = 500
TYPE_NEUTRAL          = 1000
TYPE_SUPER_EFFECTIVE  = 2000

// STAB
STAB_ON               = 1500
STAB_OFF              = 1000

// Burn
BURN_ATK_MUL          = 500       // 0.5x Atk
BURN_RESIDUAL_DENOM   = 8         // 1/8 max HP per turn
BURN_RESIDUAL_MIN     = 1

// Paralysis
PARA_SPEED_MUL        = 500       // 0.5x Speed
PARA_FAIL_DRAW_MAX    = 3         // draw range [0,3]
PARA_FAILS_ON         = 0         // fails if draw == 0

// Freeze
THAW_DRAW_MAX         = 3         // draw range [0,3]
THAWS_ON              = 0         // thaws if draw == 0

// Crit
CRIT_DRAW_MAX         = 15        // draw range [0,15]
CRIT_ON               = 0         // crits if draw == 0
CRIT_MUL              = 1500      // 1.5x damage

// Variance
VARIANCE_MIN          = 850
VARIANCE_MAX          = 1000

// Move weighting base weights
WEIGHT_DAMAGE_BASE            = 100
WEIGHT_DAMAGE_PLUS_STATUS_BASE = 110
WEIGHT_PURE_STATUS_BASE       = 40

// Move weighting adjustments
WEIGHT_ADJ_SUPER_EFFECTIVE    = +35
WEIGHT_ADJ_RESISTED           = -25
WEIGHT_ADJ_ROUGH_KO           = +60
WEIGHT_ADJ_SLOWER_PARA_STATUS = +25
WEIGHT_ADJ_SLOWER_PRIO_DAMAGE = +20
WEIGHT_ADJ_STATUS_SELF_BEHIND = +20
WEIGHT_ADJ_STATUS_SELF_LOW_HP = +20
WEIGHT_ADJ_PARA_VS_FASTER     = +25
WEIGHT_ADJ_BURN_VS_NOT_LOW    = +15
WEIGHT_ADJ_FREEZE_WHILE_BEHIND= +15
WEIGHT_ADJ_DPS_VALID_STATUS   = +10
WEIGHT_ADJ_DPS_SELF_BEHIND    = +10

// Speed Boost ability
SPEED_BOOST_PER_STACK         = 100   // +0.1x per stack in fixed-point
SPEED_BOOST_BASE              = 1000  // 1.0x starting multiplier
SPEED_BOOST_CAP               = 1500  // 1.5x maximum

// Server timing
TURN_DURATION_MS              = 2500
PLAYBACK_BUFFER_MS            = 3000
```

---

## Type Chart (5×5)

Rows = move type, Columns = defender type.
Values are fixed-point multipliers (1000 = neutral).

|  | fire | grass | water | ice | dragon |
|---|---|---|---|---|---|
| **fire** | 1000 | 2000 | 500 | 1000 | 500 |
| **grass** | 500 | 1000 | 2000 | 1000 | 500 |
| **water** | 2000 | 500 | 1000 | 1000 | 500 |
| **ice** | 1000 | 1000 | 1000 | 1000 | 2000 |
| **dragon** | 1000 | 1000 | 1000 | 500 | 2000 |

No immunities (0) in the MVP type chart.

---

## Damage Formula (Exact)

Inputs: `L=50`, `P` (move power), `A` (effective Atk), `D` (effective Def), pre-drawn `critDraw` and `varianceDraw`.

```
x1 = floor((2 * 50) / 5) + 2   →  always 22, but must use formula
x2 = x1 * P
x3 = floor((x2 * A) / D)
x4 = floor(x3 / 50) + 2

// Modifier chain (each step floors):
x5 = floor((x4 * crit_mul_fp)      / 1000)   // crit_mul_fp = 1500 if crit, else 1000
x6 = floor((x5 * stab_mul_fp)      / 1000)   // 1500 if STAB, else 1000
x7 = floor((x6 * type_mul_fp)      / 1000)   // from type chart
x8 = apply_ability_damage_modifiers(x7)       // ability hooks (Session 6)
x9 = floor((x8 * variance_mul_fp)  / 1000)   // variance draw [850, 1000]

if type_mul_fp == 0: final_damage = 0
else: final_damage = max(1, x9)
```

Effective Atk:
```
A1 = floor((base_atk * 500) / 1000) if burned, else base_atk
A  = max(1, apply_ability_atk_modifiers(A1))
```

Effective Def:
```
D1 = base_def
D  = max(1, apply_ability_def_modifiers(D1))
```

Burn residual:
```
burn_damage = max(1, floor(max_hp / 8))
```

---

## Effective Speed Formula (Exact)

```
s1 = base_speed
s2 = floor((s1 * para_mul_fp) / 1000)         // para_mul_fp = 500 if paralyzed, else 1000
s3 = floor((s2 * speed_boost_mul_fp) / 1000)  // speed_boost_mul_fp = min(1000 + 100 * stacks, 1500)
effective_speed = max(1, s3)
```

Recomputed fresh each turn. Never cached.

---

## Move Weighting Formula (Exact)

```
weight = max(0, base_weight + sum(all applicable additive adjustments))
```

Invalidation rules (set weight to 0, ignoring all other adjustments):
- Move type is immune to defender type (damage or damage_plus_status)
- Pure status move whose only purpose is a status that is invalid (target already statused, immune by ability, immune by type)
- Target already has a non-volatile status + pure status move

Adjustments that stack additively on top of base weight:
```
power_adj    = floor(power / 2)
accuracy_adj = floor((accuracy - 100) / 2)
```
Plus all conditional bonuses from the constants table above.

HP state (integer math only, no floats):
```
isAhead  = self_hp * target_max > target_hp * self_max
isBehind = self_hp * target_max < target_hp * self_max
isLowHP  = current_hp * 4 <= max_hp
```

Rough KO estimator (used only for +60 bonus check):
```
r1 = P
r2 = floor((r1 * A_weight) / max(1, D_weight))
r3 = floor(r2 / 2)
r4 = floor((r3 * stab_mul_fp) / 1000)
rough_damage = floor((r4 * type_mul_fp) / 1000)
```

---

## RNG Consumption Order (Exact, Per Turn)

**Pre-battle (once):**
1. Side A variable move 1: `drawVariableMove1()` → [0,5]
2. Side A variable move 2: `drawVariableMove2()` → [0,4]
3. Side B variable move 1: `drawVariableMove1()` → [0,5]
4. Side B variable move 2: `drawVariableMove2()` → [0,4]

**Each turn:**

Phase A — Move Selection (before ordering):
1. Side A move selection: `drawWeightedSelection(W)` or `drawAllZeroFallback()`
2. Side B move selection: `drawWeightedSelection(W)` or `drawAllZeroFallback()`

Phase B — Action Ordering:
3. If move priorities equal AND effective speeds equal: `drawSpeedTie()`

Phase C — First actor resolution (only draws that are actually reached):
4. `drawThaw()` — only if actor is frozen
5. `drawParalysisFail()` — only if paralyzed AND still proceeding (thaw did not fail)
6. `drawAccuracy()` — only if action still proceeding AND move has accuracy field
7. `drawCrit()` — only if move hit AND damaging AND crit_enabled
8. `drawVariance()` — only if move hit AND damaging
9. `drawStatusProc(denom)` — only if move hit AND status_application_mode == 'rolled'

Phase D — Terminal check: if battle ends, stop. No further draws.

Phase E — Second actor resolution: same draw sequence as Phase C.

Phase F — End of turn:
- No RNG draws unless end-of-turn order is tied
- If end-of-turn speed tie: `drawSpeedTie()`
- No other draws at end of turn in MVP

---

## End-of-Turn Sequence (Exact)

1. Determine end-of-turn order by effective speed (higher goes first)
2. If tied: consume `drawSpeedTie()` (same draw type as action ordering)
3. For each mon in that order:
   a. Apply burn damage if burned
   b. Terminal check — if `current_hp <= 0`: emit `MON_FAINTED` + `BATTLE_END`, halt
   c. Fire `ON_TURN_END` ability triggers for this mon (e.g. Speed Boost stack increment)

Speed Boost `ON_TURN_END` rule: increment `speed_boost_stacks` if alive. Fires regardless of whether the mon's action succeeded or failed that turn.

---

## Battle Event Types

All events emitted to `BattleArtifact.events`. The client drives all UI state from this stream.

| EventType | When emitted | Key payload fields |
|---|---|---|
| `BATTLE_START` | Once at battle start | species_ids, movesets |
| `MOVE_SELECTED` | Each selection phase | actor_side, move_id, slot |
| `ACTION_FROZEN_FAILED` | Thaw draw fails | actor_side |
| `ACTION_PARALYSIS_FAILED` | Para draw fails | actor_side |
| `MOVE_MISSED` | Accuracy draw fails | actor_side, move_id |
| `DAMAGE_DEALT` | Damage applied | actor_side, target_side, move_id, damage, remaining_hp |
| `CRIT` | Crit draw succeeds | actor_side |
| `TYPE_SUPER_EFFECTIVE` | type_mul = 2000 | actor_side |
| `TYPE_RESISTED` | type_mul = 500 | actor_side |
| `TYPE_IMMUNE` | type_mul = 0 | actor_side |
| `STATUS_APPLIED` | Status successfully applied | actor_side, target_side, status |
| `STATUS_FAILED` | Status application failed | actor_side, target_side, reason |
| `BURN_DAMAGE` | End-of-turn burn | actor_side, damage, remaining_hp |
| `MON_FAINTED` | current_hp reaches 0 | side |
| `BATTLE_END` | Battle concludes | winner |

Events must be emitted in the exact order things happen. The client must be able to reconstruct complete visual state by replaying events in sequence.

---

## Ability System

Abilities are event-driven hooks. Trigger windows in MVP:

| Trigger | When fired |
|---|---|
| `ON_BATTLE_START` | Once, before turn 1. Both sides fire. Used for stat modifiers (Huge Power, Intimidate) |
| `ON_BEFORE_DAMAGE` | Before damage is calculated for a hit. Used for damage multipliers |
| `ON_AFTER_DAMAGE` | After damage is applied. Used for reactive effects |
| `ON_TURN_END` | After burn damage + terminal check, if mon is alive |
| `ON_SURVIVE_LETHAL` | When damage would reduce HP to 0 or below. Used for Sturdy |
| `ON_STATUS_APPLY_ATTEMPT` | When a status is about to be applied. Used for immunity abilities |

MVP ability roster:

| ability_id | Trigger | Effect |
|---|---|---|
| `huge_power` | `ON_BATTLE_START` | Double this mon's base Atk |
| `low_hp_boost` | `ON_BEFORE_DAMAGE` | If self is low HP and move is STAB: ×1.5 damage |
| `speed_boost` | `ON_TURN_END` | Increment `speed_boost_stacks` (capped so mul ≤ 1500) |
| `intimidate` | `ON_BATTLE_START` | Reduce opponent's base Atk by 1/3 (floor) |
| `sturdy` | `ON_SURVIVE_LETHAL` | Survive at 1 HP if at full HP — fires once per battle |
| `sniper` | `ON_BEFORE_DAMAGE` | On crit: additional ×1.5 multiplier |
| `fire_immunity` | `ON_BEFORE_DAMAGE` + weighting | Block all fire-type damage; weight = 0 for fire moves targeting this mon |
| `status_immunity_burn` | `ON_STATUS_APPLY_ATTEMPT` | Block burn application |
| `status_immunity_para` | `ON_STATUS_APPLY_ATTEMPT` | Block paralysis application |
| `status_immunity_freeze` | `ON_STATUS_APPLY_ATTEMPT` | Block freeze application |

Architectural support for `ON_MOVE_WEIGHT` exists but no MVP ability uses it.

---

## Server API

**POST /battle**
```
Request:  { seed: number, side_a: string, side_b: string }
Response: { battle_id: string, artifact: BattleArtifact, timing: BattleTimingMetadata }
```

**GET /battle/:id**
```
Response: { artifact: BattleArtifact, timing: BattleTimingMetadata }
```

Storage is in-memory (Map). No database in MVP. `battle_id` is a UUID v4.

---

## Client Playback Model

The client does not run the simulation. It:
1. Fetches artifact + timing metadata
2. Computes `current_offset = Date.now() - timing.playback_start_ms`
3. Determines the current turn index from offset / `turn_duration_ms`
4. Advances on a timer, applying event payloads to React state as turns tick forward
5. All UI state is derived from the event stream — no battle logic in the client

HP bar values, status badges, and log entries are all driven by event payloads. The client trusts the artifact completely.

---

## What Each Session Must Not Do

| Session | Must not touch |
|---|---|
| 1 (RNG) | Any game logic, types, or content |
| 2 (Types/Constants) | Any implementation logic, no content data |
| 3 (Content) | Any simulation logic |
| 4 (Damage) | RNG consumption, move selection, kernel loop |
| 5 (Weighting) | Actual RNG draws, damage calculation, kernel loop |
| 6 (Abilities) | Kernel loop, RNG consumption, content data |
| 7 (Kernel) | Server, client, persistence |
| 8 (Server) | Battle logic, damage math, RNG |
| 9 (Frontend) | Any simulation logic — read artifact only |

---

## Version Strings (MVP)

```
engine_version:   "1.0.0"
content_version:  "1.0.0"
ruleset_version:  "1.0.0"
```

These are passed through the artifact unchanged. No version resolution logic in MVP.

---

## Known Decisions and Their Rationale

**Why Mulberry32?**
Simple, dependency-free, fully reproducible 32-bit PRNG. Output is deterministic across all JS environments. No seed-expansion needed for MVP.

**Why fixed-point 1000?**
Avoids all floating-point divergence between client verification and server simulation. Every multiplier is an integer. Every division floors. Two independent implementations must produce identical results.

**Why no PP / move limits?**
Simplicity and battle length control. Battles end by KO only. This also removes any state tracking that could cause divergence.

**Why is move choice weighted but not deterministic best-move?**
Pure best-move selection creates predictable, unexciting battles. Weighted probabilistic selection creates dramatic variation while still being biased toward sensible play. The weights are public and auditable.

**Why does Speed Boost fire regardless of action success?**
Speed Boost is a passive end-of-turn trait, not a reward for acting. Simpler rule, less surprising edge cases.

**Why does Speed Boost not fire on a fainted mon?**
The battle is over. No gameplay reason to continue modifying state on a fainted mon.

**Why does end-of-turn order use the same speed tie draw type?**
Consistency. One tiebreak mechanism in the whole system. Fewer special cases.
