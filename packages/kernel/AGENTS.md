# Kernel-Specific Instructions

The kernel is a pure deterministic simulation engine. It has **zero** network, persistence, or rendering logic.

## Determinism Requirements (violations are CRITICAL)

- All math uses integer arithmetic. Multipliers are scaled by 1000 (fixed-point denominator).
- Every division uses `Math.floor()`. Never use `/` without `Math.floor()` wrapping it.
- No `Math.random()` or non-seeded randomness. All randomness comes from the Mulberry32 PRNG via `rng.ts`.
- RNG draws are consumed only when their triggering condition is actually reached (no speculative draws).
- RNG draws happen in a pinned sequence defined in `ARCHITECTURE.md` — no reordering, no skipping, no extras.
- Integer-only HP comparisons — use cross-multiplication, never division for percentage checks.

## Constants

Every numerical constant comes from `packages/kernel/src/constants.ts`. If the constant doesn't exist, ask before adding it. Never hardcode values like `500`, `1500`, `2000` inline.

## Types

All shared types live in `packages/kernel/src/types.ts`. Never redeclare an interface that already exists there. Import it.

## Tests

Test expected values are pinned in `TEST_SPEC.md`. Never modify expected values in tests. A failing test means the implementation is wrong, not the test.

## Build & Test

```bash
npm test --workspace=packages/kernel
npm run build --workspace=packages/kernel
```
