// STUB — implemented in Session 5
import type { BattleMon, Move } from './types.js'

export function isAhead(_self: BattleMon, _target: BattleMon): boolean {
  throw new Error('TODO')
}

export function isBehind(_self: BattleMon, _target: BattleMon): boolean {
  throw new Error('TODO')
}

export function isLowHP(_mon: BattleMon): boolean {
  throw new Error('TODO')
}

export function computeRoughDamage(
  _attacker: BattleMon,
  _defender: BattleMon,
  _move: Move,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeMoveWeight(
  _self: BattleMon,
  _target: BattleMon,
  _move: Move,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeAllWeights(
  _self: BattleMon,
  _target: BattleMon,
  _getTypeEffectiveness: (moveType: string, defType: string) => number
): [number, number, number, number] {
  throw new Error('TODO')
}

export function selectMove(
  _weights: [number, number, number, number],
  _draw: number
): number {
  throw new Error('TODO')
}
