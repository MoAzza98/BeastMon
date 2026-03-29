// STUB — implemented in Session 3
import type { Species } from './types.js'

export const SPECIES: Record<string, Species> = {}

export function getSpeciesById(id: string): Species {
  const species = SPECIES[id]
  if (!species) throw new Error(`Unknown species: ${id}`)
  return species
}
