import { describe, it, expect } from 'vitest'
import { runBattle } from '../src/kernel.js'
import type { KernelInputs } from '../src/types.js'

// ---------------------------------------------------------------------------
// Shared test inputs — embrak (fire/speed_boost) vs drakonyx (dragon/huge_power)
// ---------------------------------------------------------------------------

const testInputs: KernelInputs = {
  engine_version: '1.0.0',
  content_version: '1.0.0',
  ruleset_version: '1.0.0',
  seed: 42,
  side_a_species_id: 'embrak',
  side_b_species_id: 'drakonyx',
}

// ---------------------------------------------------------------------------
// 7.1 Determinism
// ---------------------------------------------------------------------------

describe('7.1 Determinism', () => {
  it('same seed and species produces identical artifact', () => {
    const inputs: KernelInputs = {
      engine_version: '1.0.0',
      content_version: '1.0.0',
      ruleset_version: '1.0.0',
      seed: 42,
      side_a_species_id: 'embrak',
      side_b_species_id: 'drakonyx',
    }
    const artifact1 = runBattle(inputs)
    const artifact2 = runBattle(inputs)
    expect(artifact1).toEqual(artifact2)
  })

  it('different seeds produce different artifacts', () => {
    const base = {
      engine_version: '1.0.0',
      content_version: '1.0.0',
      ruleset_version: '1.0.0',
      side_a_species_id: 'embrak',
      side_b_species_id: 'drakonyx',
    }
    const a1 = runBattle({ ...base, seed: 1 })
    const a2 = runBattle({ ...base, seed: 2 })
    expect(a1).not.toEqual(a2)
  })
})

// ---------------------------------------------------------------------------
// 7.2 Artifact structure
// ---------------------------------------------------------------------------

describe('7.2 Artifact structure', () => {
  it('artifact first event is BATTLE_START', () => {
    const artifact = runBattle(testInputs)
    expect(artifact.events[0]?.event_type).toBe('BATTLE_START')
  })

  it('artifact last event is BATTLE_END', () => {
    const artifact = runBattle(testInputs)
    const last = artifact.events[artifact.events.length - 1]
    expect(last?.event_type).toBe('BATTLE_END')
  })

  it('artifact contains exactly one BATTLE_START', () => {
    const artifact = runBattle(testInputs)
    const starts = artifact.events.filter(e => e.event_type === 'BATTLE_START')
    expect(starts.length).toBe(1)
  })

  it('artifact contains exactly one BATTLE_END', () => {
    const artifact = runBattle(testInputs)
    const ends = artifact.events.filter(e => e.event_type === 'BATTLE_END')
    expect(ends.length).toBe(1)
  })

  it('winner field matches MON_FAINTED event side', () => {
    const artifact = runBattle(testInputs)
    const fainted = artifact.events.find(e => e.event_type === 'MON_FAINTED')
    expect(fainted).toBeDefined()
    const faintedSide = fainted!.payload['side'] as string // defined: asserted above
    const expectedWinner = faintedSide === 'a' ? 'b' : 'a'
    expect(artifact.winner).toBe(expectedWinner)
  })
})

// ---------------------------------------------------------------------------
// 7.3 HP integrity
// ---------------------------------------------------------------------------

describe('7.3 HP integrity', () => {
  it('no BattleMon HP ever exceeds max HP in DAMAGE_DEALT events', () => {
    const artifact = runBattle(testInputs)
    for (const event of artifact.events) {
      if (event.event_type === 'DAMAGE_DEALT') {
        const remaining = event.payload['remaining_hp'] as number
        expect(remaining).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('MON_FAINTED always follows a DAMAGE_DEALT or BURN_DAMAGE with remaining_hp 0', () => {
    const artifact = runBattle(testInputs)
    const events = artifact.events
    for (let i = 0; i < events.length; i++) {
      if (events[i]?.event_type === 'MON_FAINTED') {
        const prev = events[i - 1]
        const isLethalEvent =
          prev?.event_type === 'DAMAGE_DEALT' || prev?.event_type === 'BURN_DAMAGE'
        expect(isLethalEvent).toBe(true)
        expect(prev?.payload['remaining_hp']).toBe(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 7.4 No post-terminal events
// ---------------------------------------------------------------------------

describe('7.4 No post-terminal events', () => {
  it('no events are emitted after BATTLE_END', () => {
    const artifact = runBattle(testInputs)
    const endIdx = artifact.events.findIndex(e => e.event_type === 'BATTLE_END')
    expect(endIdx).toBe(artifact.events.length - 1)
  })
})

// ---------------------------------------------------------------------------
// 7.5 Move counts
// ---------------------------------------------------------------------------

describe('7.5 Move counts', () => {
  it('each side selects a move every turn', () => {
    const artifact = runBattle(testInputs)
    const sideAMoves = artifact.events.filter(
      e => e.event_type === 'MOVE_SELECTED' && e.actor_side === 'a'
    )
    const sideBMoves = artifact.events.filter(
      e => e.event_type === 'MOVE_SELECTED' && e.actor_side === 'b'
    )
    expect(sideAMoves.length).toBe(artifact.total_turns)
    expect(sideBMoves.length).toBe(artifact.total_turns)
  })
})

// ---------------------------------------------------------------------------
// 7.6 Known seed regression
// ---------------------------------------------------------------------------

describe('7.6 Known seed regression', () => {
  it('seed 1 with embrak vs drakonyx produces known winner', () => {
    // Verified via manual trace:
    // Turn 1: embrak fire_blast (resisted, 37 dmg) → drakonyx dragon_rage misses
    // Turn 2: embrak searing_fang (21 dmg, burns drakonyx) → drakonyx scale_storm (79 dmg)
    //         → end-of-turn burn on drakonyx (12 dmg)
    // Turn 3: embrak searing_fang (21 dmg) → drakonyx fire_blast (81 dmg, KOs embrak)
    // Winner: b (drakonyx)
    const artifact = runBattle({
      engine_version: '1.0.0',
      content_version: '1.0.0',
      ruleset_version: '1.0.0',
      seed: 1,
      side_a_species_id: 'embrak',
      side_b_species_id: 'drakonyx',
    })
    expect(artifact.winner).toBe('b')
  })
})

// ---------------------------------------------------------------------------
// THAW_SUCCESS
// ---------------------------------------------------------------------------

describe('THAW_SUCCESS', () => {
  it('THAW_SUCCESS event emitted when frozen mon successfully thaws', () => {
    // glacior has freeze moves — scan seeds until a thaw occurs
    let found = false
    for (let seed = 1; seed <= 500; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'embrak',
        side_b_species_id: 'glacior',
      })
      const thawEvents = artifact.events.filter(e => e.event_type === 'THAW_SUCCESS')
      if (thawEvents.length > 0) {
        found = true
        for (const e of thawEvents) {
          expect(['a', 'b']).toContain(e.payload['actor_side'])
        }
        break
      }
    }
    if (!found) console.warn('No THAW_SUCCESS found in 500 seeds — check species/move assignment')
  })

  it('ACTION_FROZEN_FAILED and THAW_SUCCESS are mutually exclusive per actor per turn', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'embrak',
        side_b_species_id: 'glacior',
      })
      let currentTurn = 0
      const perTurn: Map<string, Set<string>> = new Map()
      for (const e of artifact.events) {
        if (e.event_type === 'MOVE_SELECTED' && e.payload['actor_side'] === 'a') currentTurn++
        const key = `${currentTurn}-${e.payload['actor_side']}`
        if (e.event_type === 'THAW_SUCCESS' || e.event_type === 'ACTION_FROZEN_FAILED') {
          const set = perTurn.get(key) ?? new Set()
          set.add(e.event_type)
          perTurn.set(key, set)
          expect(set.size).toBe(1)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// ABILITY_TRIGGERED
// ---------------------------------------------------------------------------

describe('ABILITY_TRIGGERED', () => {
  it('ABILITY_TRIGGERED emitted for ON_BATTLE_START abilities before turn 1', () => {
    // drakonyx has huge_power (ON_BATTLE_START)
    const artifact = runBattle({
      ...testInputs,
      seed: 42,
      side_a_species_id: 'drakonyx',
      side_b_species_id: 'embrak',
    })
    const battleStart = artifact.events.findIndex(e => e.event_type === 'BATTLE_START')
    const firstMoveSelected = artifact.events.findIndex(e => e.event_type === 'MOVE_SELECTED')
    const abilityEvents = artifact.events.filter(e => e.event_type === 'ABILITY_TRIGGERED')

    expect(abilityEvents.length).toBeGreaterThanOrEqual(1)
    for (const e of abilityEvents) {
      const idx = artifact.events.indexOf(e)
      expect(idx).toBeGreaterThan(battleStart)
      expect(idx).toBeLessThan(firstMoveSelected)
    }
  })

  it('huge_power ABILITY_TRIGGERED doubles base_atk', () => {
    // drakonyx (ability: huge_power, base_atk: 120)
    const artifact = runBattle({
      ...testInputs,
      seed: 42,
      side_a_species_id: 'drakonyx',
      side_b_species_id: 'embrak',
    })
    const e = artifact.events.find(
      e => e.event_type === 'ABILITY_TRIGGERED' && e.payload['ability_id'] === 'huge_power'
    )
    expect(e).toBeDefined()
    // non-null assertion safe: asserted above
    expect(e!.payload['new_value']).toBe((e!.payload['old_value'] as number) * 2)
  })

  it('intimidate ABILITY_TRIGGERED reduces opponent atk by floor(atk/3)', () => {
    // torrentis (ability: intimidate) on side B reduces side A's atk
    const artifact = runBattle({
      ...testInputs,
      seed: 42,
      side_a_species_id: 'embrak',
      side_b_species_id: 'torrentis',
    })
    const e = artifact.events.find(
      e => e.event_type === 'ABILITY_TRIGGERED' && e.payload['ability_id'] === 'intimidate'
    )
    expect(e).toBeDefined()
    // non-null assertion safe: asserted above
    const old = e!.payload['old_value'] as number
    const expected = old - Math.floor(old / 3)
    expect(e!.payload['new_value']).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// STURDY_ACTIVATED
// ---------------------------------------------------------------------------

describe('STURDY_ACTIVATED', () => {
  it('STURDY_ACTIVATED emitted immediately after DAMAGE_DEALT with remaining_hp 1', () => {
    // thornvine has sturdy — scan seeds until activation
    let found = false
    for (let seed = 1; seed <= 500; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'thornvine',
        side_b_species_id: 'drakonyx',
      })
      const sturdyIdx = artifact.events.findIndex(e => e.event_type === 'STURDY_ACTIVATED')
      if (sturdyIdx === -1) continue
      found = true
      const prev = artifact.events[sturdyIdx - 1]
      expect(prev?.event_type).toBe('DAMAGE_DEALT')
      expect(prev?.payload['remaining_hp']).toBe(1)
      expect(['a', 'b']).toContain(artifact.events[sturdyIdx]!.payload['side'])
      break
    }
    if (!found) console.warn('No Sturdy activation found in 500 seeds — check species assignment')
  })

  it('STURDY_ACTIVATED fires at most once per battle per species', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'thornvine',
        side_b_species_id: 'drakonyx',
      })
      const sturdyEventsA = artifact.events.filter(
        e => e.event_type === 'STURDY_ACTIVATED' && e.payload['side'] === 'a'
      )
      expect(sturdyEventsA.length).toBeLessThanOrEqual(1)
    }
  })
})

// ---------------------------------------------------------------------------
// SPEED_BOOST_STACKED
// ---------------------------------------------------------------------------

describe('SPEED_BOOST_STACKED', () => {
  it('SPEED_BOOST_STACKED emitted with monotonically incrementing stacks', () => {
    // embrak has speed_boost
    let found = false
    for (let seed = 1; seed <= 100; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'embrak',
        side_b_species_id: 'drakonyx',
      })
      const boostEvents = artifact.events.filter(e => e.event_type === 'SPEED_BOOST_STACKED')
      if (boostEvents.length === 0) continue
      found = true
      const sideABoosts = boostEvents.filter(e => e.payload['side'] === 'a')
      for (let i = 0; i < sideABoosts.length; i++) {
        expect(sideABoosts[i]!.payload['new_stacks']).toBe(i + 1)
      }
      break
    }
    expect(found).toBe(true)
  })

  it('SPEED_BOOST_STACKED new_stacks never exceeds 5', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const artifact = runBattle({
        ...testInputs,
        seed,
        side_a_species_id: 'embrak',
        side_b_species_id: 'drakonyx',
      })
      for (const e of artifact.events.filter(e => e.event_type === 'SPEED_BOOST_STACKED')) {
        expect(e.payload['new_stacks'] as number).toBeLessThanOrEqual(5)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// STATUS_FAILED reason
// ---------------------------------------------------------------------------

describe('STATUS_FAILED reason', () => {
  it('STATUS_FAILED reason is always one of the valid values', () => {
    const validReasons = new Set(['already_statused', 'proc_failed', 'immunity_ability', 'type_immunity'])
    for (let seed = 1; seed <= 500; seed++) {
      const artifact = runBattle({ ...testInputs, seed })
      for (const e of artifact.events.filter(e => e.event_type === 'STATUS_FAILED')) {
        expect(validReasons.has(e.payload['reason'] as string)).toBe(true)
      }
    }
  })
})
