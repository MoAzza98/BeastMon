# BeastMon — Session 1: RNG

## Context

You are implementing one module of a deterministic battle simulation engine. The repository skeleton already exists — all directories, package configs, and stub files are in place from Session 0. Your job is to replace the stubs in exactly two files with a complete, correct implementation.

Read `ARCHITECTURE.md` for the full system picture. This document contains everything specific to your session.

---

## What This Session Delivers

- `packages/kernel/src/rng.ts` — fully implemented seeded PRNG with all named draw methods
- `packages/kernel/tests/rng.test.ts` — complete test suite as specified in `TEST_SPEC.md`

## What This Session Does NOT Touch

Every other file in the repository. The RNG module has no dependencies on any other kernel module. Do not import from `types.ts`, `constants.ts`, or any other file in the project. This module is entirely self-contained.

---

## Background: Why This Module Matters

The entire battle system is deterministic because every random outcome flows through a single seeded RNG stream. The same seed must produce the same sequence of draws every time, across any environment. This module is the foundation everything else is built on. Correctness here is non-negotiable.

The RNG is consumed in a strict pinned order throughout a battle. Any deviation — an extra draw, a missing draw, a draw in the wrong order — produces a completely different battle outcome. Named draw methods exist precisely so that every call site is explicit about what it is drawing and why.

---

## Algorithm: Mulberry32

Implement Mulberry32. This is a simple, fast, well-understood 32-bit PRNG with no external dependencies and fully reproducible output across all JavaScript environments.

```
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

This returns a float in `[0, 1)`. All named draw methods are built on top of this.

---

## Class Design

```typescript
export class RNG {
  private next: () => number

  constructor(seed: number) {
    // initialise the Mulberry32 generator with the given seed
  }

  // internal — used only by named draw methods below
  // returns a uniform integer in [min, max] inclusive
  drawInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  // --- named draw methods ---
  // each method maps directly to a specific purpose in the battle system
  // no caller outside this class ever calls drawInt directly
}
```

The `drawInt` method must be the only place that calls `this.next()`. All named draw methods must call `drawInt` and nothing else.

---

## Named Draw Methods — Complete Specification

Implement every method exactly as specified. Name, range, and purpose are all pinned.

| Method | drawInt call | Range | Purpose |
|---|---|---|---|
| `drawVariableMove1()` | `drawInt(0, 5)` | [0, 5] | Pre-battle: roll first variable move slot |
| `drawVariableMove2()` | `drawInt(0, 4)` | [0, 4] | Pre-battle: roll second variable move slot |
| `drawWeightedSelection(W: number)` | `drawInt(0, W - 1)` | [0, W-1] | Move selection when total weight > 0 |
| `drawAllZeroFallback()` | `drawInt(0, 3)` | [0, 3] | Move selection when all four weights are zero |
| `drawSpeedTie()` | `drawInt(0, 1)` | [0, 1] | Resolve speed ties in action order and end-of-turn order |
| `drawThaw()` | `drawInt(0, 3)` | [0, 3] | Thaw attempt for frozen mon — thaws if draw === 0 |
| `drawParalysisFail()` | `drawInt(0, 3)` | [0, 3] | Paralysis action fail — fails if draw === 0 |
| `drawAccuracy()` | `drawInt(0, 99)` | [0, 99] | Hit check — hits if draw < effective_accuracy_percent |
| `drawCrit()` | `drawInt(0, 15)` | [0, 15] | Crit check — crits if draw === 0 |
| `drawVariance()` | `drawInt(850, 1000)` | [850, 1000] | Damage variance multiplier — this value IS variance_mul_fp |
| `drawStatusProc(denominator: number)` | `drawInt(0, denominator - 1)` | [0, denom-1] | Status proc — succeeds if draw < numerator |

---

## Correctness Requirements

**Determinism:** Two `RNG` instances created with the same seed must produce the exact same sequence of values from the same sequence of method calls. This must hold across Node.js versions and environments.

**No state sharing:** Each `RNG` instance is fully independent. Creating a second instance with the same seed resets to the beginning of the sequence — it does not share or affect the first instance's state.

**Stream integrity:** The internal state advances exactly once per `drawInt` call. No method may call `next()` more than once, and no method may call `drawInt` more than once per invocation.

**Integer output only:** All named draw methods return integers. `drawInt` returns an integer. The internal `next()` returns a float but it is private and never exposed.

---

## What to Implement

### `packages/kernel/src/rng.ts`

Replace the stub completely. The final file exports exactly one thing: the `RNG` class.

No other exports. No helper functions exported. No constants exported from this file.

### `packages/kernel/tests/rng.test.ts`

Implement the full test suite from `TEST_SPEC.md` Session 1 section. All tests listed there are required. You may add additional tests if you identify gaps, but you may not remove or weaken any specified test.

Import the `RNG` class from `'../src/rng.js'` (note the `.js` extension — required for ESM in this project).

```typescript
import { describe, it, expect } from 'vitest'
import { RNG } from '../src/rng.js'
```

---

## Things That Would Be Wrong

- Using `Math.random()` anywhere — this is not seeded and breaks determinism
- Exposing `next()` as a public method
- Having any named draw method call `next()` directly instead of going through `drawInt`
- Returning floats from any named draw method
- Importing from any other file in the project
- Adding any game logic, constants, or types to this file

---

## Verification

Before committing, run from the repo root:

```bash
npm run build
npm test --workspace=packages/kernel
```

All tests must pass. Build must compile with zero TypeScript errors.

Manually verify determinism by adding a temporary script if needed:

```typescript
const rng1 = new RNG(99999)
const rng2 = new RNG(99999)
console.log(rng1.drawAccuracy(), rng2.drawAccuracy()) // must be identical
console.log(rng1.drawVariance(), rng2.drawVariance()) // must be identical
```

Remove any such scripts before committing.

---

## Git Instructions

Run before writing any code:

```bash
git checkout main
git pull origin main
git checkout -b session/01-rng
```

When tests pass and build is clean:

```bash
git add packages/kernel/src/rng.ts packages/kernel/tests/rng.test.ts
git commit -m "feat(rng): implement Mulberry32 with named draw methods"
git push origin session/01-rng
```

Then stop. Do not open a pull request. Report that the branch is pushed and ready for review.
