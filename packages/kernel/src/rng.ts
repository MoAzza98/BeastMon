export class RNG {
  private next: () => number

  constructor(seed: number) {
    let s = seed
    this.next = function (): number {
      s |= 0
      s = s + 0x6D2B79F5 | 0
      let t = Math.imul(s ^ s >>> 15, 1 | s)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  drawInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  drawVariableMove1(): number {
    return this.drawInt(0, 5)
  }

  drawVariableMove2(): number {
    return this.drawInt(0, 4)
  }

  drawWeightedSelection(W: number): number {
    return this.drawInt(0, W - 1)
  }

  drawAllZeroFallback(): number {
    return this.drawInt(0, 3)
  }

  drawSpeedTie(): number {
    return this.drawInt(0, 1)
  }

  drawThaw(): number {
    return this.drawInt(0, 3)
  }

  drawParalysisFail(): number {
    return this.drawInt(0, 3)
  }

  drawAccuracy(): number {
    return this.drawInt(0, 99)
  }

  drawCrit(): number {
    return this.drawInt(0, 15)
  }

  drawVariance(): number {
    return this.drawInt(850, 1000)
  }

  drawStatusProc(denominator: number): number {
    return this.drawInt(0, denominator - 1)
  }
}
