import { describe, it, expect } from 'vitest'
import {
  isAhead, isBehind, isLowHP,
  computeEffectiveSpeed,
  computeRoughDamage,
  computeMoveWeight,
  selectMove
} from '../src/weighting.js'
import type { BattleMon, Move } from '../src/types.js'

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
    moveset: [] as unknown as [Move, Move, Move, Move], // cast required: moveset is not exercised by weighting functions
    status: null,
    speed_boost_stacks: 0,
    sturdy_used: false,
    ...overrides,
  }
}

const baseMove: Move = {
  move_id: 'test_move',
  name: 'Test Move',
  type: 'fire',
  category: 'damage',
  power: 60,
  accuracy: 100,
  priority: 0,
  crit_enabled: true,
  inflicted_status: null,
  status_application_mode: null,
  status_proc_numerator: null,
  status_proc_denominator: null,
}

// ─── 5.1 HP State ──────────────────────────────────────────────────────────

describe('HP State Predicates', () => {
  it('isAhead: equal HP percentages returns false for both ahead and behind', () => {
    const a = makeMon({ current_hp: 50, max_hp: 100 })
    const b = makeMon({ current_hp: 100, max_hp: 200 })
    expect(isAhead(a, b)).toBe(false)
    expect(isBehind(a, b)).toBe(false)
  })

  it('isAhead: uses integer cross-multiply not division', () => {
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
})

// ─── 5.2 Weight Invalidation ───────────────────────────────────────────────

describe('Weight Invalidation', () => {
  it('immune move type gets weight 0', () => {
    const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
    const defender = makeMon({ base_def: 100 })
    const move: Move = { ...baseMove, power: 80, category: 'damage' }
    const weight = computeMoveWeight(attacker, defender, move, 0)
    expect(weight).toBe(0)
  })

  it('pure status move targeting already-statused mon gets weight 0', () => {
    const target = makeMon({ status: 'burn' })
    const self = makeMon({ status: null })
    const paraMove: Move = {
      ...baseMove, category: 'pure_status', power: 0,
      inflicted_status: 'paralysis', status_application_mode: 'guaranteed',
    }
    const weight = computeMoveWeight(self, target, paraMove, 1000)
    expect(weight).toBe(0)
  })
})

// ─── 5.3 Rough KO Bonus ────────────────────────────────────────────────────

describe('Rough KO Bonus', () => {
  it('rough KO bonus applies when estimated damage >= target current HP', () => {
    const attacker = makeMon({ base_atk: 200, type: 'fire', status: null })
    const defender = makeMon({ base_def: 50, current_hp: 10, max_hp: 100, type: 'grass' })
    const move: Move = { ...baseMove, power: 100, type: 'fire', category: 'damage' }
    const roughDmg = computeRoughDamage(attacker, defender, move, 2000)
    expect(roughDmg).toBeGreaterThanOrEqual(10)
    const weight = computeMoveWeight(attacker, defender, move, 2000)
    // base 100 + power_adj(50) + accuracy_adj(0) + super_effective(35) + rough_KO(60) = 245
    expect(weight).toBeGreaterThanOrEqual(245)
  })
})

// ─── 5.4 All-Zero Fallback ─────────────────────────────────────────────────

describe('selectMove All-Zero Fallback', () => {
  it('selectMove with all-zero weights and draw 0 returns slot 0', () => {
    expect(selectMove([0, 0, 0, 0], 0)).toBe(0)
  })

  it('selectMove with all-zero weights and draw 3 returns slot 3', () => {
    expect(selectMove([0, 0, 0, 0], 3)).toBe(3)
  })
})

// ─── 5.5 Weighted Selection ────────────────────────────────────────────────

describe('selectMove Weighted Selection', () => {
  it('selectMove selects first slot when draw is 0', () => {
    expect(selectMove([100, 100, 100, 100], 0)).toBe(0)
  })

  it('selectMove selects last slot when draw equals total minus 1', () => {
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
})

// ─── Effective Speed ────────────────────────────────────────────────────────

describe('computeEffectiveSpeed', () => {
  it('base case: no paralysis, no speed boost', () => {
    const mon = makeMon({ base_speed: 100, status: null, speed_boost_stacks: 0 })
    expect(computeEffectiveSpeed(mon)).toBe(100)
  })

  it('paralysis halves speed', () => {
    const mon = makeMon({ base_speed: 100, status: 'paralysis', speed_boost_stacks: 0 })
    expect(computeEffectiveSpeed(mon)).toBe(50)
  })

  it('speed boost stacks apply after paralysis', () => {
    // base 100, paralyzed → 50, 2 stacks → mul 1200, floor(50*1200/1000)=60
    const mon = makeMon({ base_speed: 100, status: 'paralysis', speed_boost_stacks: 2 })
    expect(computeEffectiveSpeed(mon)).toBe(60)
  })

  it('speed boost stacks without paralysis', () => {
    // base 100, 3 stacks → mul 1300, floor(100*1300/1000)=130
    const mon = makeMon({ base_speed: 100, status: null, speed_boost_stacks: 3 })
    expect(computeEffectiveSpeed(mon)).toBe(130)
  })

  it('speed boost caps at 1500 multiplier', () => {
    // 10 stacks would be 2000 but capped at 1500
    // base 100 → floor(100*1500/1000)=150
    const mon = makeMon({ base_speed: 100, status: null, speed_boost_stacks: 10 })
    expect(computeEffectiveSpeed(mon)).toBe(150)
  })

  it('minimum effective speed is 1', () => {
    const mon = makeMon({ base_speed: 0, status: null, speed_boost_stacks: 0 })
    expect(computeEffectiveSpeed(mon)).toBe(1)
  })
})

// ─── Rough Damage ───────────────────────────────────────────────────────────

describe('computeRoughDamage', () => {
  it('matches worked example values', () => {
    // From session doc: atk=100, def=80, fire move power=100, fire attacker, type 2000
    // A=100 (not burned), D=80
    // r1=100, r2=floor(100*100/80)=125, r3=floor(125/2)=62
    // r4=floor(62*1500/1000)=93, rough=floor(93*2000/1000)=186
    const attacker = makeMon({ base_atk: 100, type: 'fire', status: null })
    const defender = makeMon({ base_def: 80 })
    const move: Move = { ...baseMove, power: 100, type: 'fire' }
    expect(computeRoughDamage(attacker, defender, move, 2000)).toBe(186)
  })

  it('no STAB when move type differs from attacker type', () => {
    const attacker = makeMon({ base_atk: 100, type: 'grass', status: null })
    const defender = makeMon({ base_def: 100 })
    const move: Move = { ...baseMove, power: 100, type: 'fire' }
    // r1=100, r2=floor(100*100/100)=100, r3=floor(100/2)=50
    // stabMul=1000 (no STAB), r4=floor(50*1000/1000)=50
    // rough=floor(50*1000/1000)=50
    expect(computeRoughDamage(attacker, defender, move, 1000)).toBe(50)
  })
})

// ─── computeMoveWeight ──────────────────────────────────────────────────────

describe('computeMoveWeight', () => {
  it('worked example: fire vs grass super effective = 245', () => {
    const self = makeMon({
      type: 'fire', base_atk: 100, base_speed: 80,
      status: null, speed_boost_stacks: 0,
      current_hp: 30, max_hp: 100,
    })
    const target = makeMon({
      type: 'grass', base_def: 80, base_speed: 120,
      status: null, current_hp: 10, max_hp: 100,
    })
    const move: Move = {
      ...baseMove, category: 'damage', power: 100, accuracy: 100,
      type: 'fire', priority: 0,
    }
    expect(computeMoveWeight(self, target, move, 2000)).toBe(245)
  })

  it('pure_status base weight with burn vs not low target', () => {
    const self = makeMon({ base_speed: 120, current_hp: 100, max_hp: 100 })
    const target = makeMon({ base_speed: 80, status: null, current_hp: 100, max_hp: 100 })
    const move: Move = {
      ...baseMove, category: 'pure_status', power: 0, accuracy: 100,
      inflicted_status: 'burn', status_application_mode: 'guaranteed',
    }
    // base=40 + power_adj=0 + accuracy_adj=0 + burn_vs_not_low(target not low)=15 = 55
    expect(computeMoveWeight(self, target, move, 1000)).toBe(55)
  })

  it('damage_plus_status with valid status and behind', () => {
    const self = makeMon({
      type: 'fire', base_atk: 50, base_speed: 100,
      current_hp: 20, max_hp: 100,
    })
    const target = makeMon({
      type: 'fire', base_def: 100, base_speed: 80,
      status: null, current_hp: 80, max_hp: 100,
    })
    const move: Move = {
      ...baseMove, category: 'damage_plus_status', power: 60, accuracy: 100,
      type: 'fire', inflicted_status: 'burn', status_application_mode: 'rolled',
      status_proc_numerator: 3, status_proc_denominator: 10,
    }
    // base=110 + power_adj=30 + accuracy_adj=0
    // type neutral(1000) → 0
    // rough KO: A=50, D=100, r1=60, r2=floor(60*50/100)=30, r3=floor(30/2)=15
    //   stab=1500 (fire/fire), r4=floor(15*1500/1000)=22, rough=floor(22*1000/1000)=22
    //   22 < 80 → no rough KO
    // speed: 100 vs 80, not slower → no speed adj
    // DPS step 8: target.status===null → +10, isBehind(20/100 < 80/100) → +10
    // total: 110 + 30 + 0 + 0 + 10 + 10 = 160
    expect(computeMoveWeight(self, target, move, 1000)).toBe(160)
  })

  it('accuracy penalty reduces weight', () => {
    const self = makeMon({ type: 'fire', base_atk: 100 })
    const target = makeMon({ base_def: 100, current_hp: 100, max_hp: 100 })
    const move80: Move = { ...baseMove, power: 60, accuracy: 80, category: 'damage' }
    const move100: Move = { ...baseMove, power: 60, accuracy: 100, category: 'damage' }
    const w80 = computeMoveWeight(self, target, move80, 1000)
    const w100 = computeMoveWeight(self, target, move100, 1000)
    expect(w80).toBeLessThan(w100)
  })

  it('slower mon with priority damage move gets bonus', () => {
    const self = makeMon({ type: 'fire', base_atk: 100, base_speed: 50 })
    const target = makeMon({ base_def: 100, base_speed: 100, current_hp: 100, max_hp: 100 })
    const prioMove: Move = { ...baseMove, power: 40, accuracy: 100, category: 'damage', priority: 1 }
    const noprioMove: Move = { ...baseMove, power: 40, accuracy: 100, category: 'damage', priority: 0 }
    const wPrio = computeMoveWeight(self, target, prioMove, 1000)
    const wNoPrio = computeMoveWeight(self, target, noprioMove, 1000)
    expect(wPrio - wNoPrio).toBe(20)
  })

  it('slower mon with pure_status paralysis gets speed bonus', () => {
    const self = makeMon({ base_speed: 50, current_hp: 100, max_hp: 100 })
    const target = makeMon({ base_speed: 100, status: null, current_hp: 100, max_hp: 100 })
    const paraMove: Move = {
      ...baseMove, category: 'pure_status', power: 0, accuracy: 100,
      inflicted_status: 'paralysis', status_application_mode: 'guaranteed',
    }
    const burnMove: Move = {
      ...baseMove, category: 'pure_status', power: 0, accuracy: 100,
      inflicted_status: 'burn', status_application_mode: 'guaranteed',
    }
    const wPara = computeMoveWeight(self, target, paraMove, 1000)
    const wBurn = computeMoveWeight(self, target, burnMove, 1000)
    // para gets +25 slower bonus but no burn_vs_not_low
    // burn gets +15 burn_vs_not_low but no slower bonus
    // diff = 25 - 15 = 10
    expect(wPara - wBurn).toBe(10)
  })

  it('damage_plus_status immune type returns 0', () => {
    const self = makeMon({ type: 'fire' })
    const target = makeMon({ status: null })
    const move: Move = {
      ...baseMove, category: 'damage_plus_status', power: 60,
      inflicted_status: 'burn', status_application_mode: 'rolled',
      status_proc_numerator: 3, status_proc_denominator: 10,
    }
    expect(computeMoveWeight(self, target, move, 0)).toBe(0)
  })

  it('resisted type applies negative adjustment', () => {
    const self = makeMon({ type: 'fire', base_atk: 50 })
    const target = makeMon({ base_def: 200, current_hp: 100, max_hp: 100 })
    const move: Move = { ...baseMove, power: 60, accuracy: 100, category: 'damage' }
    const wNeutral = computeMoveWeight(self, target, move, 1000)
    const wResisted = computeMoveWeight(self, target, move, 500)
    expect(wResisted).toBeLessThan(wNeutral)
  })
})
