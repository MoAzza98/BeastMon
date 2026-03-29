// STUB — implemented in Session 3
import type { Move } from './types.js'

export const MOVES: Record<string, Move> = {}

export function getMoveById(id: string): Move {
  const move = MOVES[id]
  if (!move) throw new Error(`Unknown move: ${id}`)
  return move
}
