import { describe, it, expect } from 'vitest'
import { getTypeEffectiveness } from '../src/typeChart.js'
import type { BeastMonType } from '../src/types.js'

describe('typeChart', () => {
  it('fire vs grass is super effective (2000)', () => {
    expect(getTypeEffectiveness('fire', 'grass')).toBe(2000)
  })

  it('fire vs water is resisted (500)', () => {
    expect(getTypeEffectiveness('fire', 'water')).toBe(500)
  })

  it('fire vs fire is neutral (1000)', () => {
    expect(getTypeEffectiveness('fire', 'fire')).toBe(1000)
  })

  it('ice vs dragon is super effective (2000)', () => {
    expect(getTypeEffectiveness('ice', 'dragon')).toBe(2000)
  })

  it('dragon vs ice is resisted (500)', () => {
    expect(getTypeEffectiveness('dragon', 'ice')).toBe(500)
  })

  it('water vs grass is resisted (500)', () => {
    expect(getTypeEffectiveness('water', 'grass')).toBe(500)
  })

  it('grass vs water is super effective (2000)', () => {
    expect(getTypeEffectiveness('grass', 'water')).toBe(2000)
  })

  it('water vs dragon is resisted (500)', () => {
    expect(getTypeEffectiveness('water', 'dragon')).toBe(500)
  })

  it('dragon vs dragon is super effective (2000)', () => {
    expect(getTypeEffectiveness('dragon', 'dragon')).toBe(2000)
  })

  it('all matchups return only valid multiplier values', () => {
    const types: BeastMonType[] = ['fire', 'grass', 'water', 'ice', 'dragon']
    const valid = new Set([0, 500, 1000, 2000])
    for (const a of types) {
      for (const b of types) {
        expect(valid.has(getTypeEffectiveness(a, b))).toBe(true)
      }
    }
  })
})
