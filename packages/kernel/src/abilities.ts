import type { BattleMon, Move, StatusEffect, BeastMonType } from './types.js'
import { CONSTANTS } from './constants.js'

export type AbilityTrigger =
  | 'ON_BATTLE_START'
  | 'ON_BEFORE_DAMAGE'
  | 'ON_AFTER_DAMAGE'
  | 'ON_TURN_END'
  | 'ON_SURVIVE_LETHAL'
  | 'ON_STATUS_APPLY_ATTEMPT'
  | 'ON_MOVE_WEIGHT'

export interface AbilityContext {
  self?: BattleMon
  opponent?: BattleMon
  move?: Move
  is_crit?: boolean
  pending_status?: StatusEffect
}

export interface AbilityResult {
  modified_atk?: number
  new_speed_boost_stacks?: number
  survive_lethal?: boolean
  block_status?: boolean
  block_damage?: boolean
  damage_multiplier_fp?: number
}

// --- Internal ability handlers ---

function handleHugePower(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_BATTLE_START') return {}
  // kernel guarantees self is present when firing ON_BATTLE_START
  const self = context.self!
  return { modified_atk: self.base_atk * 2 }
}

function handleIntimidate(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_BATTLE_START') return {}
  // kernel guarantees opponent is present when firing ON_BATTLE_START
  const opponent = context.opponent!
  const reduction = Math.floor(opponent.base_atk / 3)
  return { modified_atk: opponent.base_atk - reduction }
}

function handleSpeedBoost(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_TURN_END') return {}
  // kernel guarantees self is present when firing ON_TURN_END
  const current = context.self!.speed_boost_stacks
  const nextStacks = current + 1
  const nextMul = CONSTANTS.SPEED_BOOST_BASE + CONSTANTS.SPEED_BOOST_PER_STACK * nextStacks
  const new_speed_boost_stacks = nextMul <= CONSTANTS.SPEED_BOOST_CAP ? nextStacks : current
  return { new_speed_boost_stacks }
}

function handleSturdy(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_SURVIVE_LETHAL') return {}
  // kernel guarantees self is present when firing ON_SURVIVE_LETHAL
  const self = context.self!
  return { survive_lethal: self.current_hp === self.max_hp }
}

function handleSniper(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_BEFORE_DAMAGE') return {}
  if (context.is_crit === true) {
    return { damage_multiplier_fp: CONSTANTS.CRIT_MUL }
  }
  return {}
}

function handleLowHpBoost(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_BEFORE_DAMAGE') return {}
  // kernel guarantees self and move are present when firing ON_BEFORE_DAMAGE
  const self = context.self!
  const move = context.move!
  const isLowHP = self.current_hp * 4 <= self.max_hp
  const isSTAB = move.type === self.type
  if (isLowHP && isSTAB) {
    return { damage_multiplier_fp: CONSTANTS.STAB_ON }
  }
  return {}
}

function handleFireImmunity(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_BEFORE_DAMAGE') return {}
  // kernel guarantees move is present when firing ON_BEFORE_DAMAGE
  if (context.move!.type === 'fire') {
    return { block_damage: true }
  }
  return {}
}

function handleStatusImmunityBurn(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_STATUS_APPLY_ATTEMPT') return {}
  return { block_status: context.pending_status === 'burn' }
}

function handleStatusImmunityPara(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_STATUS_APPLY_ATTEMPT') return {}
  return { block_status: context.pending_status === 'paralysis' }
}

function handleStatusImmunityFreeze(
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  if (trigger !== 'ON_STATUS_APPLY_ATTEMPT') return {}
  return { block_status: context.pending_status === 'freeze' }
}

// --- Dispatch ---

type AbilityHandler = (trigger: AbilityTrigger, context: AbilityContext) => AbilityResult

const ABILITY_HANDLERS: Record<string, AbilityHandler> = {
  huge_power: handleHugePower,
  intimidate: handleIntimidate,
  speed_boost: handleSpeedBoost,
  sturdy: handleSturdy,
  sniper: handleSniper,
  low_hp_boost: handleLowHpBoost,
  fire_immunity: handleFireImmunity,
  status_immunity_burn: handleStatusImmunityBurn,
  status_immunity_para: handleStatusImmunityPara,
  status_immunity_freeze: handleStatusImmunityFreeze,
}

export function applyAbility(
  abilityId: string,
  trigger: AbilityTrigger,
  context: AbilityContext
): AbilityResult {
  const handler = ABILITY_HANDLERS[abilityId]
  if (handler == null) return {}
  return handler(trigger, context)
}

export function getImmuneToMoveType(abilityId: string): BeastMonType | null {
  if (abilityId === 'fire_immunity') return 'fire'
  return null
}
