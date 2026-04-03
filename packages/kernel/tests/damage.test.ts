import { describe, it, expect } from 'vitest'
import {
  computeEffectiveAtk,
  computeEffectiveDef,
  computeDamage,
  computeBurnDamage,
} from '../src/damage.js'
import type { BattleMon, Move } from '../src/types.js'

const baseMove: Move = {
  move_id: 'test_move',
  name: 'Test Move',
  type: 'fire',
  category: 'damage',
  power: 50,
  accuracy: 100,
  priority: 0,
  crit_enabled: true,
  damage_stat: 'atk',
  inflicted_status: null,
  status_application_mode: null,
  status_proc_numerator: null,
  status_proc_denominator: null,
}

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
    moveset: [baseMove, baseMove, baseMove, baseMove] as BattleMon['moveset'],
    status: null,
    speed_boost_stacks: 0,
    sturdy_used: false,
    ...overrides,
  }
}

// 4.1 Formula Baseline
describe('formula baseline', () => {
  it('x1 step always equals 22 at L=50', () => {
    const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
    const defender = makeMon({ base_def: 100, type: 'fire' })
    const move: Move = { ...baseMove, power: 50, type: 'fire', category: 'damage' }
    const result = computeDamage(attacker, defender, move, 1, 1000, 1000)
    expect(result).toBe(36)
  })
})

// 4.2 Burn
describe('burn', () => {
  it('burn halves effective atk', () => {
    const burned = makeMon({ base_atk: 100, status: 'burn' })
    const unburned = makeMon({ base_atk: 100, status: null })
    expect(computeEffectiveAtk(burned)).toBe(50)
    expect(computeEffectiveAtk(unburned)).toBe(100)
  })

  it('burn atk reduction uses floor division', () => {
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
})

// 4.3 STAB
describe('STAB', () => {
  it('STAB applies 1.5x multiplier', () => {
    const move: Move = { ...baseMove, power: 40, type: 'fire', category: 'damage' }
    const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
    const defender = makeMon({ base_def: 100 })
    const withStab = computeDamage(attacker, defender, move, 1, 1000, 1000)
    const noStabAttacker = makeMon({ base_atk: 100, type: 'grass', status: null })
    const withoutStab = computeDamage(noStabAttacker, defender, move, 1, 1000, 1000)
    expect(withStab).toBeGreaterThan(withoutStab)
  })
})

// 4.4 Type Effectiveness
describe('type effectiveness', () => {
  it('immune move (type_mul=0) always deals 0 damage', () => {
    const move: Move = { ...baseMove, power: 200, type: 'fire', category: 'damage' }
    const attacker = makeMon({ base_atk: 999, type: 'fire', status: null })
    const defender = makeMon({ base_def: 1 })
    const result = computeDamage(attacker, defender, move, 1, 1000, 0)
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
})

// 4.5 Crit
describe('crit', () => {
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
    const dmgUnburnedCrit = computeDamage(unburnedNoCrit, defender, move, 0, 1000, 1000)
    expect(dmgBurnedCrit).toBeLessThan(dmgUnburnedCrit)
  })
})

// 4.6 Variance
describe('variance', () => {
  it('variance 850 produces less damage than variance 1000', () => {
    const move: Move = { ...baseMove, power: 80, type: 'grass', category: 'damage' }
    const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
    const defender = makeMon({ base_def: 100 })
    const low = computeDamage(attacker, defender, move, 1, 850, 1000)
    const high = computeDamage(attacker, defender, move, 1, 1000, 1000)
    expect(low).toBeLessThan(high)
  })
})

// 4.7 Minimum Damage
describe('minimum damage', () => {
  it('non-immune hit always deals at least 1 damage', () => {
    const move: Move = { ...baseMove, power: 1, type: 'grass', category: 'damage' }
    const attacker = makeMon({ base_atk: 1, type: 'fire', status: null })
    const defender = makeMon({ base_def: 999 })
    const result = computeDamage(attacker, defender, move, 1, 850, 1000)
    expect(result).toBeGreaterThanOrEqual(1)
  })
})

// 4.8 Burn Residual
describe('burn residual', () => {
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
})

// Additional: Effective Defense
describe('effective defense', () => {
  it('returns base_def unchanged', () => {
    const mon = makeMon({ base_def: 80 })
    expect(computeEffectiveDef(mon)).toBe(80)
  })

  it('min guard returns 1 for zero def', () => {
    const mon = makeMon({ base_def: 0 })
    expect(computeEffectiveDef(mon)).toBe(1)
  })
})

// 4.9 Speed-Scaling Moves
describe('4.9 Speed-Scaling Moves (damage_stat: speed)', () => {
  it('speed-scaling move uses Speed as A: higher Speed produces higher damage than lower Speed (atk held constant)', () => {
    const move: Move = { ...baseMove, power: 60, damage_stat: 'speed', type: 'fire', category: 'damage' }
    const defender = makeMon({ base_def: 100 })
    const fast = makeMon({ base_atk: 50, base_speed: 150, type: 'fire', status: null, speed_boost_stacks: 0 })
    const slow = makeMon({ base_atk: 150, base_speed: 50, type: 'fire', status: null, speed_boost_stacks: 0 })
    const dmgFast = computeDamage(fast, defender, move, 1, 1000, 1000)
    const dmgSlow = computeDamage(slow, defender, move, 1, 1000, 1000)
    expect(dmgFast).toBeGreaterThan(dmgSlow)
  })

  it('burn does not reduce damage on speed-scaling move', () => {
    const move: Move = { ...baseMove, power: 60, damage_stat: 'speed', type: 'fire', category: 'damage' }
    const defender = makeMon({ base_def: 100 })
    const burned = makeMon({ base_speed: 100, type: 'fire', status: 'burn', speed_boost_stacks: 0 })
    const unburned = makeMon({ base_speed: 100, type: 'fire', status: null, speed_boost_stacks: 0 })
    const dmgBurned = computeDamage(burned, defender, move, 1, 1000, 1000)
    const dmgUnburned = computeDamage(unburned, defender, move, 1, 1000, 1000)
    expect(dmgBurned).toBe(dmgUnburned)
  })

  it('paralysis reduces damage on speed-scaling move via halved Speed', () => {
    const move: Move = { ...baseMove, power: 60, damage_stat: 'speed', type: 'fire', category: 'damage' }
    const defender = makeMon({ base_def: 100 })
    const paralyzed = makeMon({ base_speed: 100, type: 'fire', status: 'paralysis', speed_boost_stacks: 0 })
    const healthy = makeMon({ base_speed: 100, type: 'fire', status: null, speed_boost_stacks: 0 })
    const dmgParalyzed = computeDamage(paralyzed, defender, move, 1, 1000, 1000)
    const dmgHealthy = computeDamage(healthy, defender, move, 1, 1000, 1000)
    expect(dmgParalyzed).toBeLessThan(dmgHealthy)
  })

  it('burn reduces damage on standard move (damage_stat=atk) but not on speed-scaling move', () => {
    const atkMove: Move = { ...baseMove, power: 60, damage_stat: 'atk', type: 'fire', category: 'damage' }
    const speedMove: Move = { ...baseMove, power: 60, damage_stat: 'speed', type: 'fire', category: 'damage' }
    const defender = makeMon({ base_def: 100 })
    const burned = makeMon({ base_atk: 100, base_speed: 100, type: 'fire', status: 'burn', speed_boost_stacks: 0 })
    const unburned = makeMon({ base_atk: 100, base_speed: 100, type: 'fire', status: null, speed_boost_stacks: 0 })
    expect(computeDamage(burned, defender, atkMove, 1, 1000, 1000))
      .toBeLessThan(computeDamage(unburned, defender, atkMove, 1, 1000, 1000))
    expect(computeDamage(burned, defender, speedMove, 1, 1000, 1000))
      .toBe(computeDamage(unburned, defender, speedMove, 1, 1000, 1000))
  })
})

