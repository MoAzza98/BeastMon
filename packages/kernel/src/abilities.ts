// STUB — implemented in Session 6

export type AbilityTrigger =
  | 'ON_BATTLE_START'
  | 'ON_BEFORE_DAMAGE'
  | 'ON_AFTER_DAMAGE'
  | 'ON_TURN_END'
  | 'ON_SURVIVE_LETHAL'
  | 'ON_STATUS_APPLY_ATTEMPT'

export interface AbilityResult {
  modified_atk?: number
  modified_def?: number
  new_speed_boost_stacks?: number  // used by speed_boost ON_TURN_END
  block_status?: boolean
  block_damage?: boolean
  survive_lethal?: boolean
  damage_multiplier?: number
}

export function applyAbility(
  _ability_id: string,
  _trigger: AbilityTrigger,
  _context: Record<string, unknown>
): AbilityResult {
  throw new Error('TODO')
}
