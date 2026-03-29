// STUB — implemented in Session 4
import type { BattleMon, Move } from './types.js'

export function computeEffectiveAtk(_mon: BattleMon): number {
  throw new Error('TODO')
}

export function computeEffectiveDef(_mon: BattleMon): number {
  throw new Error('TODO')
}

export function computeDamage(
  _attacker: BattleMon,
  _defender: BattleMon,
  _move: Move,
  _critDraw: number,
  _varianceDraw: number,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeBurnDamage(_mon: BattleMon): number {
  throw new Error('TODO')
}
