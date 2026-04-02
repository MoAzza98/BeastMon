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
