# TEST_SPEC.md — BeastMon Test Specification

This file defines the required test suite for BeastMon. Tests are **pre-specified here with exact inputs and expected outputs**. Claude Code must implement these tests as written and make its code pass them. Tests must never be modified to match implementation output.

---

## Test Integrity Rules

These rules exist because a language model can trivially make tests pass by changing the test expectations rather than fixing the code. That defeats the purpose of tests entirely.

1. **Tests are fixed. Code is not.** If a test fails, fix the implementation. Never change the expected value in a test to match what the code currently produces.
2. **Do not skip, comment out, or mark tests as `.todo` when implementing a session.** A session is not complete until all its tests pass.
3. **Do not use `expect.anything()` or loose matchers** where an exact value is specified below. If the spec says `expect(result).toBe(22)`, the test must say `expect(result).toBe(22)`.
4. **Do not mock the RNG in kernel integration tests.** The kernel tests use real seeded RNG. Mocking it defeats determinism verification.
5. **Do not use snapshot tests** for game logic outputs. Snapshots are easy to update and hide regressions. Use explicit expected values.
6. **Each test must have one clear failure reason.** If a test can fail for two different reasons, split it into two tests.

---

## Session 1 — RNG Tests

File: `packages/kernel/tests/rng.test.ts`

### 1.1 Determinism

```typescript
it('same seed produces identical draw sequence', () => {
  const rng1 = new RNG(12345)
  const rng2 = new RNG(12345)
  for (let i = 0; i < 100; i++) {
    expect(rng1.drawInt(0, 99)).toBe(rng2.drawInt(0, 99))
  }
})

it('different seeds produce different sequences', () => {
  const rng1 = new RNG(1)
  const rng2 = new RNG(2)
  const draws1 = Array.from({ length: 20 }, () => rng1.drawInt(0, 999))
  const draws2 = Array.from({ length: 20 }, () => rng2.drawInt(0, 999))
  expect(draws1).not.toEqual(draws2)
})
```

### 1.2 Range Enforcement

Each named draw method must stay within its specified range across a large sample. These tests must use `Math.min` / `Math.max` across the sample — not just check one draw.

```typescript
it('drawVariableMove1 always returns [0, 5]', () => {
  const rng = new RNG(99)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawVariableMove1()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(5)
  }
})

it('drawVariableMove2 always returns [0, 4]', () => {
  const rng = new RNG(99)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawVariableMove2()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(4)
  }
})

it('drawAccuracy always returns [0, 99]', () => {
  const rng = new RNG(42)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawAccuracy()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(99)
  }
})

it('drawCrit always returns [0, 15]', () => {
  const rng = new RNG(42)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawCrit()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(15)
  }
})

it('drawVariance always returns [850, 1000]', () => {
  const rng = new RNG(42)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawVariance()
    expect(v).toBeGreaterThanOrEqual(850)
    expect(v).toBeLessThanOrEqual(1000)
  }
})

it('drawThaw always returns [0, 3]', () => {
  const rng = new RNG(7)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawThaw()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(3)
  }
})

it('drawParalysisFail always returns [0, 3]', () => {
  const rng = new RNG(7)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawParalysisFail()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(3)
  }
})

it('drawSpeedTie always returns [0, 1]', () => {
  const rng = new RNG(7)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawSpeedTie()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
})

it('drawStatusProc with denominator 10 always returns [0, 9]', () => {
  const rng = new RNG(7)
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawStatusProc(10)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(9)
  }
})

it('drawWeightedSelection(W) always returns [0, W-1]', () => {
  const rng = new RNG(7)
  const W = 350
  for (let i = 0; i < 10000; i++) {
    const v = rng.drawWeightedSelection(W)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(W - 1)
  }
})
```

### 1.3 Stream Integrity

```typescript
it('advancing N draws from seed S matches a fresh stream at draw N', () => {
  const seed = 55555
  const N = 37

  const rngA = new RNG(seed)
  for (let i = 0; i < N; i++) rngA.drawInt(0, 999)
  const drawN_plus_1_A = rngA.drawInt(0, 999)

  const rngB = new RNG(seed)
  for (let i = 0; i < N; i++) rngB.drawInt(0, 999)
  const drawN_plus_1_B = rngB.drawInt(0, 999)

  expect(drawN_plus_1_A).toBe(drawN_plus_1_B)
})
```

---

## Session 2 — Type Chart Tests

File: `packages/kernel/tests/typeChart.test.ts`

These are exact expected values. Do not approximate.

```typescript
it('fire vs grass is super effective (2000)', () => {
  expect(getTypeEffectiveness('fire', 'grass')).toBe(2000)
})

it('fire vs water is resisted (500)', () => {
  expect(getTypeEffectiveness('fire', 'water')).toBe(500)
})

it('fire vs fire is neutral (1000)', () => {
  expect(getTypeEffectiveness('fire', 'fire')).toBe(1000)
})

it('ice vs dragon is super effective (2000)', () => {
  expect(getTypeEffectiveness('ice', 'dragon')).toBe(2000)
})

it('dragon vs ice is resisted (500)', () => {
  expect(getTypeEffectiveness('dragon', 'ice')).toBe(500)
})

it('water vs grass is resisted (500)', () => {
  expect(getTypeEffectiveness('water', 'grass')).toBe(500)
})

it('grass vs water is super effective (2000)', () => {
  expect(getTypeEffectiveness('grass', 'water')).toBe(2000)
})

it('water vs dragon is resisted (500)', () => {
  expect(getTypeEffectiveness('water', 'dragon')).toBe(500)
})

it('dragon vs dragon is super effective (2000)', () => {
  expect(getTypeEffectiveness('dragon', 'dragon')).toBe(2000)
})

it('all matchups return only valid multiplier values', () => {
  const types: BeastMonType[] = ['fire', 'grass', 'water', 'ice', 'dragon']
  const valid = new Set([0, 500, 1000, 2000])
  for (const a of types) {
    for (const b of types) {
      expect(valid.has(getTypeEffectiveness(a, b))).toBe(true)
    }
  }
})
```

---

## Session 4 — Damage Tests

File: `packages/kernel/tests/damage.test.ts`

Use a helper to build minimal `BattleMon` objects for testing. Do not reuse species from content data — tests must control exact stat values.

```typescript
// Helper — build a test mon with explicit stats
function makeMon(overrides: Partial<BattleMon>): BattleMon {
  return {
    species_id: 'test',
    name: 'Test',
    type: 'fire',
    max_hp: 100,
    current_hp: 100,
    base_atk: 100,
    base_def: 100,
    base_speed: 100,
    ability_id: 'none',
    moveset: [...] as any,  // not used by damage functions directly
    status: null,
    speed_boost_stacks: 0,
    ...overrides
  }
}
```

### 4.1 Formula Baseline

```typescript
it('x1 step always equals 22 at L=50', () => {
  // x1 = floor((2 * 50) / 5) + 2 = floor(100/5) + 2 = 20 + 2 = 22
  // Verify by checking damage at known inputs and tracing the math
  const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 100, type: 'fire' })
  const move: Move = { ...baseMove, power: 50, type: 'fire', category: 'damage' }
  // x1=22, x2=22*50=1100, x3=floor(1100*100/100)=1100, x4=floor(1100/50)+2=24
  // no crit (draw=1), STAB (fire/fire) = 1500, neutral = 1000
  // x5=24, x6=floor(24*1500/1000)=36, x7=floor(36*1000/1000)=36
  // variance=1000: x9=floor(36*1000/1000)=36, final=max(1,36)=36
  const result = computeDamage(attacker, defender, move, 1, 1000, 1000)
  expect(result).toBe(36)
})
```

### 4.2 Burn

```typescript
it('burn halves effective atk', () => {
  const burned = makeMon({ base_atk: 100, status: 'burn' })
  const unburned = makeMon({ base_atk: 100, status: null })
  expect(computeEffectiveAtk(burned)).toBe(50)
  expect(computeEffectiveAtk(unburned)).toBe(100)
})

it('burn atk reduction uses floor division', () => {
  // base_atk=101, burned: floor(101*500/1000) = floor(50.5) = 50
  const burned = makeMon({ base_atk: 101, status: 'burn' })
  expect(computeEffectiveAtk(burned)).toBe(50)
})

it('burned attacker deals less damage than unburned on same move', () => {
  const move: Move = { ...baseMove, power: 80, type: 'fire', category: 'damage' }
  const defender = makeMon({ base_def: 80 })
  const burned = makeMon({ base_atk: 100, type: 'fire', status: 'burn' })
  const unburned = makeMon({ base_atk: 100, type: 'fire', status: null })
  const dmgBurned = computeDamage(burned, defender, move, 1, 1000, 1000)
  const dmgUnburned = computeDamage(unburned, defender, move, 1, 1000, 1000)
  expect(dmgBurned).toBeLessThan(dmgUnburned)
})
```

### 4.3 STAB

```typescript
it('STAB applies 1.5x multiplier', () => {
  const move: Move = { ...baseMove, power: 40, type: 'fire', category: 'damage' }
  const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 100 })
  const withStab = computeDamage(attacker, defender, move, 1, 1000, 1000)
  const noStabAttacker = makeMon({ base_atk: 100, type: 'grass', status: null })
  const withoutStab = computeDamage(noStabAttacker, defender, move, 1, 1000, 1000)
  // withStab should be floor(withoutStab * 1.5) roughly
  expect(withStab).toBeGreaterThan(withoutStab)
})
```

### 4.4 Type Effectiveness

```typescript
it('immune move (type_mul=0) always deals 0 damage', () => {
  const move: Move = { ...baseMove, power: 200, type: 'fire', category: 'damage' }
  const attacker = makeMon({ base_atk: 999, type: 'fire', status: null })
  const defender = makeMon({ base_def: 1 })
  const result = computeDamage(attacker, defender, move, 1, 1000, 0) // 0 = immune
  expect(result).toBe(0)
})

it('super effective move deals more than neutral', () => {
  const move: Move = { ...baseMove, power: 60, type: 'fire', category: 'damage' }
  const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 100 })
  const neutral = computeDamage(attacker, defender, move, 1, 1000, 1000)
  const superEffective = computeDamage(attacker, defender, move, 1, 1000, 2000)
  expect(superEffective).toBeGreaterThan(neutral)
})
```

### 4.5 Crit

```typescript
it('crit draw=0 applies 1.5x multiplier', () => {
  const move: Move = { ...baseMove, power: 60, type: 'grass', category: 'damage', crit_enabled: true }
  const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 100 })
  const crit = computeDamage(attacker, defender, move, 0, 1000, 1000)
  const noCrit = computeDamage(attacker, defender, move, 1, 1000, 1000)
  expect(crit).toBeGreaterThan(noCrit)
})

it('crit does not bypass burn (both apply independently)', () => {
  const move: Move = { ...baseMove, power: 80, type: 'grass', category: 'damage', crit_enabled: true }
  const burnedCrit = makeMon({ base_atk: 100, type: 'fire', status: 'burn' })
  const unburnedNoCrit = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 50 })
  const dmgBurnedCrit = computeDamage(burnedCrit, defender, move, 0, 1000, 1000)
  const dmgUnburnedNoCrit = computeDamage(unburnedNoCrit, defender, move, 1, 1000, 1000)
  // burned+crit can be more or less than unburned+no-crit depending on values
  // the key assertion: burned crit != unburned no-crit (both modifiers active)
  // also verify burned+crit < unburned+crit (burn is still penalising)
  const dmgUnburnedCrit = computeDamage(unburnedNoCrit, defender, move, 0, 1000, 1000)
  expect(dmgBurnedCrit).toBeLessThan(dmgUnburnedCrit)
})
```

### 4.6 Variance

```typescript
it('variance 850 produces less damage than variance 1000', () => {
  const move: Move = { ...baseMove, power: 80, type: 'grass', category: 'damage' }
  const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
  const defender = makeMon({ base_def: 100 })
  const low = computeDamage(attacker, defender, move, 1, 850, 1000)
  const high = computeDamage(attacker, defender, move, 1, 1000, 1000)
  expect(low).toBeLessThan(high)
})
```

### 4.7 Minimum Damage

```typescript
it('non-immune hit always deals at least 1 damage', () => {
  // Use extremely weak attacker and strong defender
  const move: Move = { ...baseMove, power: 1, type: 'grass', category: 'damage' }
  const attacker = makeMon({ base_atk: 1, type: 'fire', status: null })
  const defender = makeMon({ base_def: 999 })
  const result = computeDamage(attacker, defender, move, 1, 850, 1000)
  expect(result).toBeGreaterThanOrEqual(1)
})
```

### 4.8 Burn Residual

```typescript
it('burn residual: max_hp=80 deals 10', () => {
  const mon = makeMon({ max_hp: 80, current_hp: 80 })
  expect(computeBurnDamage(mon)).toBe(10)
})

it('burn residual: max_hp=7 deals 1 (minimum)', () => {
  const mon = makeMon({ max_hp: 7, current_hp: 7 })
  expect(computeBurnDamage(mon)).toBe(1)
})

it('burn residual: max_hp=8 deals 1', () => {
  const mon = makeMon({ max_hp: 8, current_hp: 8 })
  expect(computeBurnDamage(mon)).toBe(1)
})

it('burn residual: max_hp=160 deals 20', () => {
  const mon = makeMon({ max_hp: 160, current_hp: 160 })
  expect(computeBurnDamage(mon)).toBe(20)
})
```

---

## Session 5 — Weighting Tests

File: `packages/kernel/tests/weighting.test.ts`

### 5.1 HP State

```typescript
it('isAhead: equal HP percentages returns false for both ahead and behind', () => {
  const a = makeMon({ current_hp: 50, max_hp: 100 })
  const b = makeMon({ current_hp: 100, max_hp: 200 })
  expect(isAhead(a, b)).toBe(false)
  expect(isBehind(a, b)).toBe(false)
})

it('isAhead: uses integer cross-multiply not division', () => {
  // 75/100 vs 74/100 — a is ahead
  const a = makeMon({ current_hp: 75, max_hp: 100 })
  const b = makeMon({ current_hp: 74, max_hp: 100 })
  expect(isAhead(a, b)).toBe(true)
  expect(isBehind(a, b)).toBe(false)
})

it('isBehind: a behind b', () => {
  const a = makeMon({ current_hp: 30, max_hp: 100 })
  const b = makeMon({ current_hp: 80, max_hp: 100 })
  expect(isBehind(a, b)).toBe(true)
  expect(isAhead(a, b)).toBe(false)
})

it('isLowHP: exactly 25% is low HP', () => {
  const mon = makeMon({ current_hp: 25, max_hp: 100 })
  expect(isLowHP(mon)).toBe(true)
})

it('isLowHP: 26% is not low HP', () => {
  const mon = makeMon({ current_hp: 26, max_hp: 100 })
  expect(isLowHP(mon)).toBe(false)
})

it('isLowHP: 1HP is low HP', () => {
  const mon = makeMon({ current_hp: 1, max_hp: 100 })
  expect(isLowHP(mon)).toBe(true)
})
```

### 5.2 Weight Invalidation

```typescript
it('immune move type gets weight 0', () => {
  // Need a matchup where type chart returns 0
  // There are no immunities in the MVP type chart, so test this with a mock
  // or by verifying the zero-weight path is correct by inspection
  // If no MVP immunities exist, this test verifies the code path handles 0 correctly:
  const weight = computeMoveWeight(attacker, defender, move, 0) // typeEffectiveness = 0
  expect(weight).toBe(0)
})

it('pure status move targeting already-statused mon gets weight 0', () => {
  const target = makeMon({ status: 'burn' })
  const self = makeMon({ status: null })
  const paraMove: Move = { ...baseMove, category: 'pure_status', power: 0,
    inflicted_status: 'paralysis', status_application_mode: 'guaranteed' }
  const weight = computeMoveWeight(self, target, paraMove, 1000)
  expect(weight).toBe(0)
})
```

### 5.3 Rough KO Bonus

```typescript
it('rough KO bonus applies when estimated damage >= target current HP', () => {
  // Set up a scenario where rough damage clearly >= target HP
  const attacker = makeMon({ base_atk: 200, type: 'fire', status: null })
  const defender = makeMon({ base_def: 50, current_hp: 10, max_hp: 100, type: 'grass' })
  const move: Move = { ...baseMove, power: 100, type: 'fire', category: 'damage' }
  // fire vs grass = 2000 (super effective), huge atk, tiny def, tiny HP
  // rough damage will far exceed 10 HP
  const roughDmg = computeRoughDamage(attacker, defender, move, 2000)
  expect(roughDmg).toBeGreaterThanOrEqual(10)
  const weight = computeMoveWeight(attacker, defender, move, 2000)
  // base 100 + power_adj(50) + accuracy_adj(0) + super_effective(35) + rough_KO(60) = 245
  expect(weight).toBeGreaterThanOrEqual(245)
})
```

### 5.4 All-Zero Fallback

```typescript
it('selectMove with all-zero weights and draw 0 returns slot 0', () => {
  expect(selectMove([0, 0, 0, 0], 0)).toBe(0)
})

it('selectMove with all-zero weights and draw 3 returns slot 3', () => {
  expect(selectMove([0, 0, 0, 0], 3)).toBe(3)
})
```

### 5.5 Weighted Selection

```typescript
it('selectMove selects first slot when draw is 0', () => {
  // weights [100, 100, 100, 100], draw 0 → slot 0
  expect(selectMove([100, 100, 100, 100], 0)).toBe(0)
})

it('selectMove selects last slot when draw equals total minus 1', () => {
  // weights [100, 100, 100, 100], total=400, draw=399 → slot 3
  expect(selectMove([100, 100, 100, 100], 399)).toBe(3)
})

it('selectMove respects slot boundaries correctly', () => {
  // weights [100, 200, 50, 50], total=400
  // draw 0-99 → slot 0, 100-299 → slot 1, 300-349 → slot 2, 350-399 → slot 3
  expect(selectMove([100, 200, 50, 50], 99)).toBe(0)
  expect(selectMove([100, 200, 50, 50], 100)).toBe(1)
  expect(selectMove([100, 200, 50, 50], 299)).toBe(1)
  expect(selectMove([100, 200, 50, 50], 300)).toBe(2)
  expect(selectMove([100, 200, 50, 50], 349)).toBe(2)
  expect(selectMove([100, 200, 50, 50], 350)).toBe(3)
})
```

---

## Session 6 — Ability Tests

File: `packages/kernel/tests/abilities.test.ts`

### 6.1 Huge Power

```typescript
it('huge_power doubles base atk at ON_BATTLE_START', () => {
  const mon = makeMon({ base_atk: 80 })
  const result = applyAbility('huge_power', 'ON_BATTLE_START', { self: mon })
  expect(result.modified_atk).toBe(160)
})
```

### 6.2 Intimidate

```typescript
it('intimidate reduces opponent atk by 1/3 (floor)', () => {
  const opponent = makeMon({ base_atk: 100 })
  const result = applyAbility('intimidate', 'ON_BATTLE_START', { opponent })
  // floor(100 / 3) = 33 reduction → 100 - 33 = 67
  expect(result.modified_atk).toBe(67)
})

it('intimidate floor division: atk=101 → 67', () => {
  const opponent = makeMon({ base_atk: 101 })
  const result = applyAbility('intimidate', 'ON_BATTLE_START', { opponent })
  // floor(101 / 3) = 33 → 101 - 33 = 68
  expect(result.modified_atk).toBe(68)
})
```

### 6.3 Sturdy

```typescript
it('sturdy survives lethal hit at full HP', () => {
  const mon = makeMon({ current_hp: 100, max_hp: 100 })
  const result = applyAbility('sturdy', 'ON_SURVIVE_LETHAL', { self: mon })
  expect(result.survive_lethal).toBe(true)
})

it('sturdy does not trigger when not at full HP', () => {
  const mon = makeMon({ current_hp: 99, max_hp: 100 })
  const result = applyAbility('sturdy', 'ON_SURVIVE_LETHAL', { self: mon })
  expect(result.survive_lethal).toBeFalsy()
})
```

### 6.4 Speed Boost

```typescript
it('speed_boost increments stacks by 1 per ON_TURN_END', () => {
  const mon = makeMon({ speed_boost_stacks: 0 })
  const result = applyAbility('speed_boost', 'ON_TURN_END', { self: mon })
  expect(result.new_speed_boost_stacks).toBe(1)
})

it('speed_boost caps at stacks that produce mul 1500', () => {
  // mul = min(1000 + 100 * stacks, 1500) → cap at 5 stacks
  const mon = makeMon({ speed_boost_stacks: 5 })
  const result = applyAbility('speed_boost', 'ON_TURN_END', { self: mon })
  expect(result.new_speed_boost_stacks).toBe(5) // already capped, no increment
})
```

### 6.5 Effective Speed

```typescript
it('effective speed applies paralysis before speed boost', () => {
  // base 100, paralyzed (×0.5 = 50), speed_boost_stacks=2 (mul=1200)
  // s1=100, s2=floor(100*500/1000)=50, s3=floor(50*1200/1000)=60
  // This test lives in a speed utility test if extracted, or kernel integration test
})
```

### 6.6 Status Immunity

```typescript
it('status_immunity_burn blocks burn application', () => {
  const result = applyAbility('status_immunity_burn', 'ON_STATUS_APPLY_ATTEMPT', {
    pending_status: 'burn'
  })
  expect(result.block_status).toBe(true)
})

it('status_immunity_burn does not block paralysis', () => {
  const result = applyAbility('status_immunity_burn', 'ON_STATUS_APPLY_ATTEMPT', {
    pending_status: 'paralysis'
  })
  expect(result.block_status).toBeFalsy()
})
```

---

## Session 7 — Kernel Integration Tests

File: `packages/kernel/tests/kernel.test.ts`

These are the most critical tests. They verify the whole system end-to-end.

### 7.1 Determinism (Core Correctness)

```typescript
it('same seed and species produces identical artifact', () => {
  const inputs: KernelInputs = {
    engine_version: '1.0.0',
    content_version: '1.0.0',
    ruleset_version: '1.0.0',
    seed: 42,
    side_a_species_id: 'species_a',   // replace with real IDs from content
    side_b_species_id: 'species_b'
  }
  const artifact1 = runBattle(inputs)
  const artifact2 = runBattle(inputs)
  expect(artifact1).toEqual(artifact2)
})

it('different seeds produce different artifacts', () => {
  const base = {
    engine_version: '1.0.0', content_version: '1.0.0', ruleset_version: '1.0.0',
    side_a_species_id: 'species_a', side_b_species_id: 'species_b'
  }
  const a1 = runBattle({ ...base, seed: 1 })
  const a2 = runBattle({ ...base, seed: 2 })
  expect(a1).not.toEqual(a2)
})
```

### 7.2 Artifact Structure

```typescript
it('artifact first event is BATTLE_START', () => {
  const artifact = runBattle(testInputs)
  expect(artifact.events[0]?.event_type).toBe('BATTLE_START')
})

it('artifact last event is BATTLE_END', () => {
  const artifact = runBattle(testInputs)
  const last = artifact.events[artifact.events.length - 1]
  expect(last?.event_type).toBe('BATTLE_END')
})

it('artifact contains exactly one BATTLE_START', () => {
  const artifact = runBattle(testInputs)
  const starts = artifact.events.filter(e => e.event_type === 'BATTLE_START')
  expect(starts.length).toBe(1)
})

it('artifact contains exactly one BATTLE_END', () => {
  const artifact = runBattle(testInputs)
  const ends = artifact.events.filter(e => e.event_type === 'BATTLE_END')
  expect(ends.length).toBe(1)
})

it('winner field matches MON_FAINTED event side', () => {
  const artifact = runBattle(testInputs)
  const fainted = artifact.events.find(e => e.event_type === 'MON_FAINTED')
  expect(fainted).toBeDefined()
  const faintedSide = fainted!.payload['side'] as string
  const expectedWinner = faintedSide === 'a' ? 'b' : 'a'
  expect(artifact.winner).toBe(expectedWinner)
})
```

### 7.3 HP Integrity

```typescript
it('no BattleMon HP ever exceeds max HP in DAMAGE_DEALT events', () => {
  const artifact = runBattle(testInputs)
  for (const event of artifact.events) {
    if (event.event_type === 'DAMAGE_DEALT') {
      const remaining = event.payload['remaining_hp'] as number
      expect(remaining).toBeGreaterThanOrEqual(0)
    }
  }
})

it('MON_FAINTED always follows a DAMAGE_DEALT or BURN_DAMAGE with remaining_hp 0', () => {
  const artifact = runBattle(testInputs)
  const events = artifact.events
  for (let i = 0; i < events.length; i++) {
    if (events[i]?.event_type === 'MON_FAINTED') {
      const prev = events[i - 1]
      const isLethalEvent =
        prev?.event_type === 'DAMAGE_DEALT' || prev?.event_type === 'BURN_DAMAGE'
      expect(isLethalEvent).toBe(true)
      expect(prev?.payload['remaining_hp']).toBe(0)
    }
  }
})
```

### 7.4 No Post-Terminal Events

```typescript
it('no events are emitted after BATTLE_END', () => {
  const artifact = runBattle(testInputs)
  const endIdx = artifact.events.findIndex(e => e.event_type === 'BATTLE_END')
  expect(endIdx).toBe(artifact.events.length - 1)
})
```

### 7.5 Move Counts

```typescript
it('each side selects a move every turn', () => {
  const artifact = runBattle(testInputs)
  const sideAMoves = artifact.events.filter(
    e => e.event_type === 'MOVE_SELECTED' && e.actor_side === 'a'
  )
  const sideBMoves = artifact.events.filter(
    e => e.event_type === 'MOVE_SELECTED' && e.actor_side === 'b'
  )
  expect(sideAMoves.length).toBe(artifact.total_turns)
  expect(sideBMoves.length).toBe(artifact.total_turns)
})
```

### 7.6 Known Seed Regression

```typescript
it('seed 1 with species_a vs species_b produces known winner', () => {
  // INSTRUCTION TO IMPLEMENTER:
  // After implementing the kernel, run it once with seed=1 and the two species below.
  // Record the winner. Hard-code it as the expected value here.
  // This test then becomes a regression guard — any future change that alters
  // the outcome of this specific battle is a breaking change.
  // DO NOT set the expected winner to whatever the code currently produces
  // without verifying the full battle trace is correct first.
  const artifact = runBattle({
    engine_version: '1.0.0',
    content_version: '1.0.0',
    ruleset_version: '1.0.0',
    seed: 1,
    side_a_species_id: 'species_a',  // replace with real IDs
    side_b_species_id: 'species_b'
  })
  // Replace 'a' below with the verified correct winner after manual trace
  expect(artifact.winner).toBe('FILL_IN_AFTER_VERIFIED_TRACE')
})
```

---

## General Test Rules

- Every test file imports only from `@beastmon/kernel` or relative paths within the kernel package.
- Helpers like `makeMon` and `baseMove` are defined once at the top of each test file.
- No test may import from server or client packages.
- Tests run with `vitest run` — no watch mode, no UI mode in CI.
- All tests must pass before a session is considered complete.
- Test coverage does not substitute for these specified cases. You must include all cases listed here, plus any additional cases you identify.
