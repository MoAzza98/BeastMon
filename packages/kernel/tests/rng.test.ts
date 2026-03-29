import { describe, it, expect } from 'vitest'
import { RNG } from '../src/rng.js'

describe('RNG', () => {
  describe('Determinism', () => {
    it('same seed produces identical draw sequence', () => {
      const rng1 = new RNG(12345)
      const rng2 = new RNG(12345)
      for (let i = 0; i < 100; i++) {
        expect(rng1.drawAccuracy()).toBe(rng2.drawAccuracy())
      }
    })

    it('different seeds produce different sequences', () => {
      const rng1 = new RNG(1)
      const rng2 = new RNG(2)
      const draws1 = Array.from({ length: 20 }, () => rng1.drawInt(0, 999))
      const draws2 = Array.from({ length: 20 }, () => rng2.drawInt(0, 999))
      expect(draws1).not.toEqual(draws2)
    })
  })

  describe('Range enforcement', () => {
    it('drawVariableMove1 always returns [0, 5]', () => {
      const rng = new RNG(99)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawVariableMove1()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(5)
      }
    })

    it('drawVariableMove2 always returns [0, 4]', () => {
      const rng = new RNG(99)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawVariableMove2()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(4)
      }
    })

    it('drawAccuracy always returns [0, 99]', () => {
      const rng = new RNG(42)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawAccuracy()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(99)
      }
    })

    it('drawCrit always returns [0, 15]', () => {
      const rng = new RNG(42)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawCrit()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(15)
      }
    })

    it('drawVariance always returns [850, 1000]', () => {
      const rng = new RNG(42)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawVariance()
        expect(v).toBeGreaterThanOrEqual(850)
        expect(v).toBeLessThanOrEqual(1000)
      }
    })

    it('drawThaw always returns [0, 3]', () => {
      const rng = new RNG(7)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawThaw()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(3)
      }
    })

    it('drawParalysisFail always returns [0, 3]', () => {
      const rng = new RNG(7)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawParalysisFail()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(3)
      }
    })

    it('drawSpeedTie always returns [0, 1]', () => {
      const rng = new RNG(7)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawSpeedTie()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })

    it('drawStatusProc with denominator 10 always returns [0, 9]', () => {
      const rng = new RNG(7)
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawStatusProc(10)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(9)
      }
    })

    it('drawWeightedSelection(W) always returns [0, W-1]', () => {
      const rng = new RNG(7)
      const W = 350
      for (let i = 0; i < 10000; i++) {
        const v = rng.drawWeightedSelection(W)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(W - 1)
      }
    })
  })

  describe('Stream integrity', () => {
    it('advancing N draws from seed S matches a fresh stream at draw N', () => {
      const seed = 55555
      const N = 37

      const rngA = new RNG(seed)
      for (let i = 0; i < N; i++) rngA.drawVariance()
      const drawN_plus_1_A = rngA.drawVariance()

      const rngB = new RNG(seed)
      for (let i = 0; i < N; i++) rngB.drawVariance()
      const drawN_plus_1_B = rngB.drawVariance()

      expect(drawN_plus_1_A).toBe(drawN_plus_1_B)
    })
  })
})
