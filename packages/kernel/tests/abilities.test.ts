import { describe, it, expect } from 'vitest'
import { applyAbility, getImmuneToMoveType } from '../src/abilities.js'
import type { BattleMon, Move } from '../src/types.js'

function makeMon(overrides: Partial<BattleMon> = {}): BattleMon {
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
    moveset: [] as any, // abilities do not use moveset
    status: null,
    speed_boost_stacks: 0,
    ...overrides,
  }
}

const baseMove: Move = {
  move_id: 'test_move',
  name: 'Test Move',
  type: 'fire',
  category: 'damage',
  power: 80,
  accuracy: 100,
  priority: 0,
  crit_enabled: false,
  inflicted_status: null,
  status_application_mode: null,
  status_proc_numerator: null,
  status_proc_denominator: null,
}

describe('abilities', () => {
  // --- 6.1 Huge Power ---

  describe('huge_power', () => {
    it('doubles base atk at ON_BATTLE_START', () => {
      const mon = makeMon({ base_atk: 80 })
      const result = applyAbility('huge_power', 'ON_BATTLE_START', { self: mon })
      expect(result.modified_atk).toBe(160)
    })

    it('returns {} for wrong trigger', () => {
      const mon = makeMon({ base_atk: 80 })
      const result = applyAbility('huge_power', 'ON_TURN_END', { self: mon })
      expect(result).toEqual({})
    })
  })

  // --- 6.2 Intimidate ---

  describe('intimidate', () => {
    it('reduces opponent atk by 1/3 (floor)', () => {
      const opponent = makeMon({ base_atk: 100 })
      const result = applyAbility('intimidate', 'ON_BATTLE_START', { opponent })
      expect(result.modified_atk).toBe(67)
    })

    it('floor division: atk=101 → 68', () => {
      const opponent = makeMon({ base_atk: 101 })
      const result = applyAbility('intimidate', 'ON_BATTLE_START', { opponent })
      expect(result.modified_atk).toBe(68)
    })

    it('returns {} for wrong trigger', () => {
      const opponent = makeMon({ base_atk: 100 })
      const result = applyAbility('intimidate', 'ON_BEFORE_DAMAGE', { opponent })
      expect(result).toEqual({})
    })
  })

  // --- 6.3 Sturdy ---

  describe('sturdy', () => {
    it('survives lethal hit at full HP', () => {
      const mon = makeMon({ current_hp: 100, max_hp: 100 })
      const result = applyAbility('sturdy', 'ON_SURVIVE_LETHAL', { self: mon })
      expect(result.survive_lethal).toBe(true)
    })

    it('does not trigger when not at full HP', () => {
      const mon = makeMon({ current_hp: 99, max_hp: 100 })
      const result = applyAbility('sturdy', 'ON_SURVIVE_LETHAL', { self: mon })
      expect(result.survive_lethal).toBeFalsy()
    })

    it('returns {} for wrong trigger', () => {
      const mon = makeMon({ current_hp: 100, max_hp: 100 })
      const result = applyAbility('sturdy', 'ON_BATTLE_START', { self: mon })
      expect(result).toEqual({})
    })
  })

  // --- 6.4 Speed Boost ---

  describe('speed_boost', () => {
    it('increments stacks by 1 per ON_TURN_END', () => {
      const mon = makeMon({ speed_boost_stacks: 0 })
      const result = applyAbility('speed_boost', 'ON_TURN_END', { self: mon })
      expect(result.new_speed_boost_stacks).toBe(1)
    })

    it('caps at stacks that produce mul 1500', () => {
      const mon = makeMon({ speed_boost_stacks: 5 })
      const result = applyAbility('speed_boost', 'ON_TURN_END', { self: mon })
      expect(result.new_speed_boost_stacks).toBe(5)
    })

    it('increments from 4 to 5 (last valid increment)', () => {
      const mon = makeMon({ speed_boost_stacks: 4 })
      const result = applyAbility('speed_boost', 'ON_TURN_END', { self: mon })
      expect(result.new_speed_boost_stacks).toBe(5)
    })

    it('returns {} for wrong trigger', () => {
      const mon = makeMon({ speed_boost_stacks: 0 })
      const result = applyAbility('speed_boost', 'ON_BATTLE_START', { self: mon })
      expect(result).toEqual({})
    })
  })

  // --- Sniper ---

  describe('sniper', () => {
    it('applies damage multiplier on crit', () => {
      const mon = makeMon({})
      const move: Move = { ...baseMove }
      const result = applyAbility('sniper', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
        is_crit: true,
      })
      expect(result.damage_multiplier_fp).toBe(1500)
    })

    it('returns {} when not a crit', () => {
      const mon = makeMon({})
      const move: Move = { ...baseMove }
      const result = applyAbility('sniper', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
        is_crit: false,
      })
      expect(result).toEqual({})
    })

    it('returns {} for wrong trigger', () => {
      const result = applyAbility('sniper', 'ON_TURN_END', { is_crit: true })
      expect(result).toEqual({})
    })
  })

  // --- Low HP Boost ---

  describe('low_hp_boost', () => {
    it('applies multiplier when low HP and STAB', () => {
      const mon = makeMon({ current_hp: 25, max_hp: 100, type: 'fire' })
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('low_hp_boost', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
      })
      expect(result.damage_multiplier_fp).toBe(1500)
    })

    it('does not apply when not low HP', () => {
      const mon = makeMon({ current_hp: 26, max_hp: 100, type: 'fire' })
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('low_hp_boost', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
      })
      expect(result).toEqual({})
    })

    it('does not apply when not STAB', () => {
      const mon = makeMon({ current_hp: 25, max_hp: 100, type: 'grass' })
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('low_hp_boost', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
      })
      expect(result).toEqual({})
    })

    it('exactly 25% HP counts as low HP', () => {
      const mon = makeMon({ current_hp: 25, max_hp: 100, type: 'fire' })
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('low_hp_boost', 'ON_BEFORE_DAMAGE', {
        self: mon,
        move,
      })
      expect(result.damage_multiplier_fp).toBe(1500)
    })
  })

  // --- Fire Immunity ---

  describe('fire_immunity', () => {
    it('blocks damage from fire moves', () => {
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('fire_immunity', 'ON_BEFORE_DAMAGE', { move })
      expect(result.block_damage).toBe(true)
    })

    it('does not block non-fire moves', () => {
      const move: Move = { ...baseMove, type: 'grass' }
      const result = applyAbility('fire_immunity', 'ON_BEFORE_DAMAGE', { move })
      expect(result).toEqual({})
    })

    it('returns {} for wrong trigger', () => {
      const move: Move = { ...baseMove, type: 'fire' }
      const result = applyAbility('fire_immunity', 'ON_TURN_END', { move })
      expect(result).toEqual({})
    })
  })

  // --- 6.6 Status Immunities ---

  describe('status_immunity_burn', () => {
    it('blocks burn application', () => {
      const result = applyAbility('status_immunity_burn', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'burn',
      })
      expect(result.block_status).toBe(true)
    })

    it('does not block paralysis', () => {
      const result = applyAbility('status_immunity_burn', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'paralysis',
      })
      expect(result.block_status).toBeFalsy()
    })

    it('does not block freeze', () => {
      const result = applyAbility('status_immunity_burn', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'freeze',
      })
      expect(result.block_status).toBeFalsy()
    })
  })

  describe('status_immunity_para', () => {
    it('blocks paralysis application', () => {
      const result = applyAbility('status_immunity_para', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'paralysis',
      })
      expect(result.block_status).toBe(true)
    })

    it('does not block burn', () => {
      const result = applyAbility('status_immunity_para', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'burn',
      })
      expect(result.block_status).toBeFalsy()
    })
  })

  describe('status_immunity_freeze', () => {
    it('blocks freeze application', () => {
      const result = applyAbility('status_immunity_freeze', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'freeze',
      })
      expect(result.block_status).toBe(true)
    })

    it('does not block burn', () => {
      const result = applyAbility('status_immunity_freeze', 'ON_STATUS_APPLY_ATTEMPT', {
        pending_status: 'burn',
      })
      expect(result.block_status).toBeFalsy()
    })
  })

  // --- Dispatch edge cases ---

  describe('dispatch', () => {
    it('unknown ability returns {}', () => {
      const result = applyAbility('unknown_ability', 'ON_BATTLE_START', {})
      expect(result).toEqual({})
    })

    it('none ability returns {} for all triggers', () => {
      const mon = makeMon({})
      expect(applyAbility('none', 'ON_BATTLE_START', { self: mon })).toEqual({})
      expect(applyAbility('none', 'ON_TURN_END', { self: mon })).toEqual({})
      expect(applyAbility('none', 'ON_SURVIVE_LETHAL', { self: mon })).toEqual({})
      expect(applyAbility('none', 'ON_BEFORE_DAMAGE', { self: mon })).toEqual({})
      expect(applyAbility('none', 'ON_STATUS_APPLY_ATTEMPT', { pending_status: 'burn' })).toEqual({})
    })
  })

  // --- getImmuneToMoveType ---

  describe('getImmuneToMoveType', () => {
    it('returns fire for fire_immunity', () => {
      expect(getImmuneToMoveType('fire_immunity')).toBe('fire')
    })

    it('returns null for none', () => {
      expect(getImmuneToMoveType('none')).toBeNull()
    })

    it('returns null for huge_power', () => {
      expect(getImmuneToMoveType('huge_power')).toBeNull()
    })

    it('returns null for status_immunity_burn', () => {
      expect(getImmuneToMoveType('status_immunity_burn')).toBeNull()
    })
  })
})
