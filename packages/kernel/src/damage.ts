import type { BattleMon, Move } from './types.js'
import { CONSTANTS } from './constants.js'

export function computeEffectiveAtk(mon: BattleMon): number {
  const A1 =
    mon.status === 'burn'
      ? Math.floor((mon.base_atk * CONSTANTS.BURN_ATK_MUL) / CONSTANTS.FIXED_POINT_DENOM)
      : mon.base_atk
  return Math.max(1, A1)
}

export function computeEffectiveDef(mon: BattleMon): number {
  return Math.max(1, mon.base_def)
}

export function computeEffectiveSpeed(mon: BattleMon): number {
  const s1 = mon.base_speed

  const paraMulFp =
    mon.status === 'paralysis'
      ? CONSTANTS.PARA_SPEED_MUL
      : CONSTANTS.FIXED_POINT_DENOM
  const s2 = Math.floor((s1 * paraMulFp) / CONSTANTS.FIXED_POINT_DENOM)

  const speedBoostMulFp = Math.min(
    CONSTANTS.SPEED_BOOST_BASE + CONSTANTS.SPEED_BOOST_PER_STACK * mon.speed_boost_stacks,
    CONSTANTS.SPEED_BOOST_CAP
  )
  const s3 = Math.floor((s2 * speedBoostMulFp) / CONSTANTS.FIXED_POINT_DENOM)

  return Math.max(1, s3)
}

export function computeDamage(
  attacker: BattleMon,
  defender: BattleMon,
  move: Move,
  critDraw: number,
  varianceDraw: number,
  typeEffectiveness: number
): number {
  const A = computeEffectiveAtk(attacker)
  const D = computeEffectiveDef(defender)

  const x1 = Math.floor((2 * CONSTANTS.LEVEL) / 5) + 2
  const x2 = x1 * move.power
  const x3 = Math.floor((x2 * A) / D)
  const x4 = Math.floor(x3 / 50) + 2

  const critMul = critDraw === 0 ? CONSTANTS.CRIT_MUL : CONSTANTS.FIXED_POINT_DENOM
  const stabMul = move.type === attacker.type ? CONSTANTS.STAB_ON : CONSTANTS.STAB_OFF

  const x5 = Math.floor((x4 * critMul) / CONSTANTS.FIXED_POINT_DENOM)
  const x6 = Math.floor((x5 * stabMul) / CONSTANTS.FIXED_POINT_DENOM)
  const x7 = Math.floor((x6 * typeEffectiveness) / CONSTANTS.FIXED_POINT_DENOM)
  const x9 = Math.floor((x7 * varianceDraw) / CONSTANTS.FIXED_POINT_DENOM)

  if (typeEffectiveness === 0) return 0
  return Math.max(1, x9)
}

export function computeBurnDamage(mon: BattleMon): number {
  return Math.max(
    CONSTANTS.BURN_RESIDUAL_MIN,
    Math.floor(mon.max_hp / CONSTANTS.BURN_RESIDUAL_DENOM)
  )
}
