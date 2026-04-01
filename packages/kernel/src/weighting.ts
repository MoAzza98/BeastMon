import type { BattleMon, Move } from './types.js'
import { CONSTANTS } from './constants.js'
import { computeEffectiveAtk, computeEffectiveDef } from './damage.js'

export function computeEffectiveSpeed(mon: BattleMon): number {
  const s1 = mon.base_speed
  const paraMulFp = mon.status === 'paralysis' ? CONSTANTS.PARA_SPEED_MUL : CONSTANTS.FIXED_POINT_DENOM
  const s2 = Math.floor((s1 * paraMulFp) / CONSTANTS.FIXED_POINT_DENOM)
  const speedBoostMulFp = Math.min(
    CONSTANTS.SPEED_BOOST_BASE + CONSTANTS.SPEED_BOOST_PER_STACK * mon.speed_boost_stacks,
    CONSTANTS.SPEED_BOOST_CAP
  )
  const s3 = Math.floor((s2 * speedBoostMulFp) / CONSTANTS.FIXED_POINT_DENOM)
  return Math.max(1, s3)
}

export function isAhead(self: BattleMon, target: BattleMon): boolean {
  return self.current_hp * target.max_hp > target.current_hp * self.max_hp
}

export function isBehind(self: BattleMon, target: BattleMon): boolean {
  return self.current_hp * target.max_hp < target.current_hp * self.max_hp
}

export function isLowHP(mon: BattleMon): boolean {
  return mon.current_hp * 4 <= mon.max_hp
}

export function computeRoughDamage(
  attacker: BattleMon,
  defender: BattleMon,
  move: Move,
  typeEffectiveness: number
): number {
  const A = computeEffectiveAtk(attacker)
  const D = computeEffectiveDef(defender)

  const r1 = move.power
  const r2 = Math.floor((r1 * A) / Math.max(1, D))
  const r3 = Math.floor(r2 / 2)
  const stabMulFp = move.type === attacker.type ? CONSTANTS.STAB_ON : CONSTANTS.STAB_OFF
  const r4 = Math.floor((r3 * stabMulFp) / CONSTANTS.FIXED_POINT_DENOM)
  return Math.floor((r4 * typeEffectiveness) / CONSTANTS.FIXED_POINT_DENOM)
}

export function computeMoveWeight(
  self: BattleMon,
  target: BattleMon,
  move: Move,
  typeEffectiveness: number
): number {
  const isDamaging = move.category === 'damage' || move.category === 'damage_plus_status'
  const isPureStatus = move.category === 'pure_status'

  // Step 1 — Invalidation
  if (isDamaging && typeEffectiveness === CONSTANTS.TYPE_IMMUNE) {
    return 0
  }
  if (isPureStatus && target.status !== null) {
    return 0
  }

  // Step 2 — Base weight
  let weight: number
  if (move.category === 'damage') {
    weight = CONSTANTS.WEIGHT_DAMAGE_BASE
  } else if (move.category === 'damage_plus_status') {
    weight = CONSTANTS.WEIGHT_DAMAGE_PLUS_STATUS_BASE
  } else {
    weight = CONSTANTS.WEIGHT_PURE_STATUS_BASE
  }

  // Step 3 — Universal adjustments
  weight += Math.floor(move.power / 2)
  weight += Math.floor((move.accuracy - 100) / 2)

  // Step 4 — Type effectiveness adjustment (damage and damage_plus_status only)
  if (isDamaging) {
    if (typeEffectiveness === CONSTANTS.TYPE_SUPER_EFFECTIVE) {
      weight += CONSTANTS.WEIGHT_ADJ_SUPER_EFFECTIVE
    } else if (typeEffectiveness === CONSTANTS.TYPE_RESISTED) {
      weight += CONSTANTS.WEIGHT_ADJ_RESISTED
    }
  }

  // Step 5 — Rough KO bonus (damage and damage_plus_status only, power > 0)
  if (isDamaging && move.power > 0) {
    const roughDmg = computeRoughDamage(self, target, move, typeEffectiveness)
    if (roughDmg >= target.current_hp) {
      weight += CONSTANTS.WEIGHT_ADJ_ROUGH_KO
    }
  }

  // Step 6 — Speed comparison adjustments
  const isSlower = computeEffectiveSpeed(self) < computeEffectiveSpeed(target)
  if (isSlower) {
    if (isPureStatus && move.inflicted_status === 'paralysis') {
      weight += CONSTANTS.WEIGHT_ADJ_SLOWER_PARA_STATUS
    }
    if (isDamaging && move.priority > 0) {
      weight += CONSTANTS.WEIGHT_ADJ_SLOWER_PRIO_DAMAGE
    }
  }

  // Step 7 — HP-state and status adjustments (pure_status only)
  if (isPureStatus) {
    if (isBehind(self, target)) {
      weight += CONSTANTS.WEIGHT_ADJ_STATUS_SELF_BEHIND
    }
    if (isLowHP(self)) {
      weight += CONSTANTS.WEIGHT_ADJ_STATUS_SELF_LOW_HP
    }
    if (move.inflicted_status === 'burn' && !isLowHP(target)) {
      weight += CONSTANTS.WEIGHT_ADJ_BURN_VS_NOT_LOW
    }
    if (move.inflicted_status === 'freeze' && isBehind(self, target)) {
      weight += CONSTANTS.WEIGHT_ADJ_FREEZE_WHILE_BEHIND
    }
  }

  // Step 8 — HP-state and status adjustments (damage_plus_status only)
  if (move.category === 'damage_plus_status') {
    if (target.status === null) {
      weight += CONSTANTS.WEIGHT_ADJ_DPS_VALID_STATUS
    }
    if (isBehind(self, target)) {
      weight += CONSTANTS.WEIGHT_ADJ_DPS_SELF_BEHIND
    }
  }

  // Step 9 — Floor at zero
  return Math.max(0, weight)
}

export function selectMove(
  weights: [number, number, number, number],
  draw: number
): number {
  const total = weights[0] + weights[1] + weights[2] + weights[3]

  if (total === 0) {
    return draw
  }

  let cumulative = 0
  for (let slot = 0; slot < 4; slot++) {
    cumulative += weights[slot]!
    if (draw < cumulative) {
      return slot
    }
  }

  return 3
}
