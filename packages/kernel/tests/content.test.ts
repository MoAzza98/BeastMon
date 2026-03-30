import { describe, it, expect } from 'vitest'
import { MOVES, getMoveById } from '../src/moves.js'
import { SPECIES, getSpeciesById } from '../src/species.js'
import type { BeastMonType } from '../src/types.js'

describe('Moves', () => {
  it('MOVES contains exactly 27 entries', () => {
    expect(Object.keys(MOVES).length).toBe(27)
  })

  it('every move_id matches its object key in MOVES', () => {
    for (const [key, move] of Object.entries(MOVES)) {
      expect(move.move_id).toBe(key)
    }
  })

  it('all move_ids are unique', () => {
    const ids = Object.values(MOVES).map(m => m.move_id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('all pure_status moves have power === 0', () => {
    for (const move of Object.values(MOVES)) {
      if (move.category === 'pure_status') {
        expect(move.power).toBe(0)
      }
    }
  })

  it('all damage and damage_plus_status moves have power > 0', () => {
    for (const move of Object.values(MOVES)) {
      if (move.category === 'damage' || move.category === 'damage_plus_status') {
        expect(move.power).toBeGreaterThan(0)
      }
    }
  })

  it('no pure_status move has crit_enabled true', () => {
    for (const move of Object.values(MOVES)) {
      if (move.category === 'pure_status') {
        expect(move.crit_enabled).toBe(false)
      }
    }
  })

  it('moves with inflicted_status null have null proc fields and null mode', () => {
    for (const move of Object.values(MOVES)) {
      if (move.inflicted_status === null) {
        expect(move.status_application_mode).toBeNull()
        expect(move.status_proc_numerator).toBeNull()
        expect(move.status_proc_denominator).toBeNull()
      }
    }
  })

  it('guaranteed status moves have null proc numerator and denominator', () => {
    for (const move of Object.values(MOVES)) {
      if (move.status_application_mode === 'guaranteed') {
        expect(move.status_proc_numerator).toBeNull()
        expect(move.status_proc_denominator).toBeNull()
      }
    }
  })

  it('rolled status moves have non-null positive numerator and denominator', () => {
    for (const move of Object.values(MOVES)) {
      if (move.status_application_mode === 'rolled') {
        expect(move.status_proc_numerator).not.toBeNull()
        expect(move.status_proc_denominator).not.toBeNull()
        // Non-null safe: status_application_mode === 'rolled' guarantees these fields are non-null per Move schema
        expect(move.status_proc_numerator!).toBeGreaterThan(0)
        expect(move.status_proc_denominator!).toBeGreaterThan(0)
        expect(move.status_proc_numerator!).toBeLessThan(move.status_proc_denominator!)
      }
    }
  })

  it('all moves have a valid BeastMonType', () => {
    const validTypes = new Set<BeastMonType>(['fire', 'grass', 'water', 'ice', 'dragon'])
    for (const move of Object.values(MOVES)) {
      expect(validTypes.has(move.type)).toBe(true)
    }
  })

  it('all move accuracy values are in [0, 100]', () => {
    for (const move of Object.values(MOVES)) {
      expect(move.accuracy).toBeGreaterThanOrEqual(0)
      expect(move.accuracy).toBeLessThanOrEqual(100)
    }
  })

  it('getMoveById returns the correct move for a valid id', () => {
    const move = getMoveById('inferno_rush')
    expect(move.move_id).toBe('inferno_rush')
    expect(move.type).toBe('fire')
    expect(move.power).toBe(90)
  })

  it('getMoveById throws on unknown id', () => {
    expect(() => getMoveById('does_not_exist')).toThrow()
  })

  it('MOVES contains at least one move of each category', () => {
    const categories = new Set(Object.values(MOVES).map(m => m.category))
    expect(categories.has('damage')).toBe(true)
    expect(categories.has('damage_plus_status')).toBe(true)
    expect(categories.has('pure_status')).toBe(true)
  })

  it('MOVES contains at least one move for each status effect', () => {
    const statuses = new Set(
      Object.values(MOVES)
        .map(m => m.inflicted_status)
        .filter((s): s is NonNullable<typeof s> => s !== null)
    )
    expect(statuses.has('burn')).toBe(true)
    expect(statuses.has('paralysis')).toBe(true)
    expect(statuses.has('freeze')).toBe(true)
  })
})

describe('Species', () => {
  it('SPECIES contains exactly 5 entries', () => {
    expect(Object.keys(SPECIES).length).toBe(5)
  })

  it('every species_id matches its object key in SPECIES', () => {
    for (const [key, species] of Object.entries(SPECIES)) {
      expect(species.species_id).toBe(key)
    }
  })

  it('all species_ids are unique', () => {
    const ids = Object.values(SPECIES).map(s => s.species_id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every species has exactly 6 variable pool entries', () => {
    for (const species of Object.values(SPECIES)) {
      expect(species.variable_pool.length).toBe(6)
    }
  })

  it('all species signature moves reference valid move_ids', () => {
    for (const species of Object.values(SPECIES)) {
      expect((MOVES as Record<string, unknown>)[species.signature_move_1]).toBeDefined()
      expect((MOVES as Record<string, unknown>)[species.signature_move_2]).toBeDefined()
    }
  })

  it('all species variable pool entries reference valid move_ids', () => {
    for (const species of Object.values(SPECIES)) {
      for (const moveId of species.variable_pool) {
        expect((MOVES as Record<string, unknown>)[moveId]).toBeDefined()
      }
    }
  })

  it('each species variable pool contains no duplicate move_ids', () => {
    for (const species of Object.values(SPECIES)) {
      const unique = new Set(species.variable_pool)
      expect(unique.size).toBe(species.variable_pool.length)
    }
  })

  it('species signature moves do not appear in their own variable pool', () => {
    for (const species of Object.values(SPECIES)) {
      expect(species.variable_pool).not.toContain(species.signature_move_1)
      expect(species.variable_pool).not.toContain(species.signature_move_2)
    }
  })

  it('all species base stats are positive integers', () => {
    for (const species of Object.values(SPECIES)) {
      expect(species.base_hp).toBeGreaterThan(0)
      expect(species.base_atk).toBeGreaterThan(0)
      expect(species.base_def).toBeGreaterThan(0)
      expect(species.base_speed).toBeGreaterThan(0)
      expect(Number.isInteger(species.base_hp)).toBe(true)
      expect(Number.isInteger(species.base_atk)).toBe(true)
      expect(Number.isInteger(species.base_def)).toBe(true)
      expect(Number.isInteger(species.base_speed)).toBe(true)
    }
  })

  it('getSpeciesById returns the correct species for a valid id', () => {
    const species = getSpeciesById('embrak')
    expect(species.species_id).toBe('embrak')
    expect(species.type).toBe('fire')
    expect(species.base_speed).toBe(105)
  })

  it('getSpeciesById throws on unknown id', () => {
    expect(() => getSpeciesById('does_not_exist')).toThrow()
  })

  it('each of the five types is represented by at least one species', () => {
    const types = new Set(Object.values(SPECIES).map(s => s.type))
    expect(types.has('fire')).toBe(true)
    expect(types.has('grass')).toBe(true)
    expect(types.has('water')).toBe(true)
    expect(types.has('ice')).toBe(true)
    expect(types.has('dragon')).toBe(true)
  })
})
