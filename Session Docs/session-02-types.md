# BeastMon — Session 2: Types, Constants, TypeChart

## Context

You are implementing one module of a deterministic battle simulation engine. The repository skeleton exists and Session 1 (RNG) is complete and merged. Your job is to replace the stubs in exactly four files with complete, correct implementations.

Read `ARCHITECTURE.md` for the full system picture. This document contains everything specific to your session.

---

## What This Session Delivers

- `packages/kernel/src/types.ts` — all shared TypeScript interfaces and type aliases used across the kernel
- `packages/kernel/src/constants.ts` — all pinned numerical constants used in battle simulation
- `packages/kernel/src/typeChart.ts` — type effectiveness lookup table and accessor function
- `packages/kernel/tests/typeChart.test.ts` — complete test suite as specified in `TEST_SPEC.md`

## What This Session Does NOT Touch

Every other file in the repository. In particular:

- `rng.ts` — already implemented; do not import from it or modify it
- `index.ts` — do not modify this file; Session 0 already wired up the barrel re-exports (`export * from './types.js'` etc.) and your implementations will flow through automatically once the stubs are replaced
- `moves.ts`, `species.ts` — Session 3 content; do not create or pre-populate these
- `damage.ts`, `weighting.ts`, `abilities.ts`, `kernel.ts` — later sessions
- Any test file other than `typeChart.test.ts`

The three files you produce have no runtime dependencies on each other beyond what TypeScript requires. `typeChart.ts` imports type aliases from `types.ts` and constants from `constants.ts`. `constants.ts` imports nothing. `types.ts` imports nothing.

---

## Background: Why This Module Matters

Every subsequent kernel module depends on the types and constants defined here. If a type is defined incorrectly, every downstream module inherits the error. If a constant is wrong or missing, downstream modules either use magic numbers (violating `CLAUDE.md`) or fail to compile.

The type chart is a pure lookup table. Its correctness is verifiable by inspection against the ruleset, and its tests are the first hard regression anchors in the system.

---

## File 1: `packages/kernel/src/types.ts`

This file defines all shared interfaces and type aliases. It exports only types — no values, no functions, no constants.

### Type Aliases

```typescript
export type BeastMonType = 'fire' | 'grass' | 'water' | 'ice' | 'dragon'
export type MoveCategory = 'damage' | 'damage_plus_status' | 'pure_status'
export type StatusEffect = 'burn' | 'paralysis' | 'freeze'
export type StatusApplicationMode = 'guaranteed' | 'rolled'
export type Side = 'a' | 'b'
```

### Interfaces

Define every interface exactly as specified below. Field names, types, and nullability are all pinned. Do not add fields. Do not rename fields. Do not change field types.

```typescript
export interface Move {
  move_id: string
  name: string
  type: BeastMonType
  category: MoveCategory
  power: number                              // 0 for pure status moves
  accuracy: number                           // integer 0–100
  priority: number
  crit_enabled: boolean
  inflicted_status: StatusEffect | null
  status_application_mode: StatusApplicationMode | null
  status_proc_numerator: number | null
  status_proc_denominator: number | null
}

export interface Species {
  species_id: string
  name: string
  type: BeastMonType
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  signature_move_1: string                   // move_id ref
  signature_move_2: string                   // move_id ref
  variable_pool: [string, string, string, string, string, string]  // exactly 6 move_id refs
}

export interface BattleMon {
  species_id: string
  name: string
  type: BeastMonType
  max_hp: number
  current_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  ability_id: string
  moveset: [Move, Move, Move, Move]          // canonical slot order
  status: StatusEffect | null                // one non-volatile status or null
  speed_boost_stacks: number                 // 0 at battle start
}

export interface BattleArtifact {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
  winner: Side | 'draw'
  total_turns: number
  events: BattleEvent[]
  side_a_final_moveset: [Move, Move, Move, Move]
  side_b_final_moveset: [Move, Move, Move, Move]
}

export interface KernelInputs {
  engine_version: string
  content_version: string
  ruleset_version: string
  seed: number
  side_a_species_id: string
  side_b_species_id: string
}

export interface BattleTimingMetadata {
  battle_id: string
  started_at_ms: number
  turn_duration_ms: number                   // fixed at 2500ms
  playback_start_ms: number                  // started_at_ms + 3000ms buffer
}

export interface StoredBattle {
  artifact: BattleArtifact
  timing: BattleTimingMetadata
}
```

### The BattleEvent Interface

`BattleArtifact.events` is typed as `BattleEvent[]`. Define `BattleEventType` as a string union, then define `BattleEvent` with a top-level `actor_side` field and a `payload` record for event-specific data.

```typescript
export type BattleEventType =
  | 'BATTLE_START'
  | 'MOVE_SELECTED'
  | 'ACTION_FROZEN_FAILED'
  | 'ACTION_PARALYSIS_FAILED'
  | 'MOVE_MISSED'
  | 'DAMAGE_DEALT'
  | 'CRIT'
  | 'TYPE_SUPER_EFFECTIVE'
  | 'TYPE_RESISTED'
  | 'TYPE_IMMUNE'
  | 'STATUS_APPLIED'
  | 'STATUS_FAILED'
  | 'BURN_DAMAGE'
  | 'MON_FAINTED'
  | 'BATTLE_END'

export interface BattleEvent {
  event_type: BattleEventType
  actor_side: Side | null          // null for events not tied to a specific actor
  payload: Record<string, unknown> // event-specific data; typed by kernel when emitting
}
```

**Important — `actor_side` field placement:** `actor_side` is a top-level field on `BattleEvent`, not inside `payload`. ARCHITECTURE.md's event table uses the column header "Key payload fields" loosely to mean "fields on the event," but `TEST_SPEC.md` test 7.5 accesses it as `e.actor_side` directly — not as `e.payload['actor_side']`. The test is authoritative. Do not move it into `payload`.

**`payload` contract:** Using `Record<string, unknown>` keeps `types.ts` decoupled from the specifics of what each event carries. The kernel (Session 7) emits events with typed payload values. The client reads from them. Neither layer needs to enumerate every payload field in this shared type. Event-specific fields such as `remaining_hp`, `damage`, `move_id`, `side`, and `status` all live in `payload`.

---

## File 2: `packages/kernel/src/constants.ts`

This file exports a single `CONSTANTS` object containing every pinned numerical value used in the battle simulation. No magic numbers appear anywhere else in the kernel. If a downstream module needs a numerical value, it imports from here.

The file imports nothing. It exports exactly one thing: the `CONSTANTS` object.

```typescript
export const CONSTANTS = {
  // Fixed-point arithmetic
  FIXED_POINT_DENOM: 1000,

  // Battle level (fixed at 50 for all battles)
  LEVEL: 50,

  // Type effectiveness multipliers (fixed-point)
  TYPE_IMMUNE:          0,
  TYPE_RESISTED:        500,
  TYPE_NEUTRAL:         1000,
  TYPE_SUPER_EFFECTIVE: 2000,

  // STAB
  STAB_ON:  1500,
  STAB_OFF: 1000,

  // Burn
  BURN_ATK_MUL:        500,    // 0.5x Atk
  BURN_RESIDUAL_DENOM: 8,      // 1/8 max HP per turn
  BURN_RESIDUAL_MIN:   1,

  // Paralysis
  PARA_SPEED_MUL:     500,     // 0.5x Speed
  PARA_FAIL_DRAW_MAX: 3,       // draw range [0, 3]
  PARA_FAILS_ON:      0,       // fails if draw === 0

  // Freeze
  THAW_DRAW_MAX: 3,            // draw range [0, 3]
  THAWS_ON:      0,            // thaws if draw === 0

  // Crit
  CRIT_DRAW_MAX: 15,           // draw range [0, 15]
  CRIT_ON:       0,            // crits if draw === 0
  CRIT_MUL:      1500,         // 1.5x damage

  // Variance
  VARIANCE_MIN: 850,
  VARIANCE_MAX: 1000,

  // Move weighting — base weights
  WEIGHT_DAMAGE_BASE:              100,
  WEIGHT_DAMAGE_PLUS_STATUS_BASE:  110,
  WEIGHT_PURE_STATUS_BASE:         40,

  // Move weighting — conditional adjustments (negative values subtract when applied additively)
  WEIGHT_ADJ_SUPER_EFFECTIVE:      35,
  WEIGHT_ADJ_RESISTED:            -25,
  WEIGHT_ADJ_ROUGH_KO:             60,
  WEIGHT_ADJ_SLOWER_PARA_STATUS:   25,
  WEIGHT_ADJ_SLOWER_PRIO_DAMAGE:   20,
  WEIGHT_ADJ_STATUS_SELF_BEHIND:   20,
  WEIGHT_ADJ_STATUS_SELF_LOW_HP:   20,
  WEIGHT_ADJ_PARA_VS_FASTER:       25,
  WEIGHT_ADJ_BURN_VS_NOT_LOW:      15,
  WEIGHT_ADJ_FREEZE_WHILE_BEHIND:  15,
  WEIGHT_ADJ_DPS_VALID_STATUS:     10,
  WEIGHT_ADJ_DPS_SELF_BEHIND:      10,

  // Speed Boost ability
  SPEED_BOOST_PER_STACK: 100,  // +0.1x per stack in fixed-point
  SPEED_BOOST_BASE:      1000, // 1.0x starting multiplier
  SPEED_BOOST_CAP:       1500, // 1.5x maximum

  // Server timing
  TURN_DURATION_MS:   2500,
  PLAYBACK_BUFFER_MS: 3000,
} as const
```

### Constraint: No Computed Values

Every value in `CONSTANTS` is a literal. Do not derive one constant from another inside this object (e.g. do not write `SPEED_BOOST_CAP: SPEED_BOOST_BASE + 5 * SPEED_BOOST_PER_STACK`). Each value is independently pinned. The ruleset document is the source of truth, not arithmetic on other constants.

### Note on Signed Constants

`WEIGHT_ADJ_RESISTED` is `-25`. This is intentional — the sign is encoded in the constant. Downstream code applies it additively: `weight += CONSTANTS.WEIGHT_ADJ_RESISTED`, which correctly subtracts 25. Do not store it as positive and negate at the call site.

---

## File 3: `packages/kernel/src/typeChart.ts`

This file implements the type effectiveness lookup table and exports a single accessor function. It imports `BeastMonType` from `types.ts` and `CONSTANTS` from `constants.ts`.

### The Type Chart

The chart is a 5×5 matrix. Rows are move type, columns are defender type. All values are fixed-point multipliers (denominator 1000).

|              | fire | grass | water |  ice | dragon |
|--------------|------|-------|-------|------|--------|
| **fire**     | 1000 |  2000 |   500 | 1000 |    500 |
| **grass**    |  500 |  1000 |  2000 | 1000 |    500 |
| **water**    | 2000 |   500 |  1000 | 1000 |    500 |
| **ice**      | 1000 |  1000 |  1000 | 1000 |   2000 |
| **dragon**   | 1000 |  1000 |  1000 |  500 |   2000 |

**There are no immune (0) matchups in the MVP type chart.** The minimum effectiveness value across all 25 matchups is `500`.

### Implementation

Implement the chart as a nested constant object keyed by `BeastMonType`. The accessor function is a pure lookup with no branching logic beyond key access.

```typescript
import { BeastMonType } from './types.js'
import { CONSTANTS } from './constants.js'

type TypeChartRow = Record<BeastMonType, number>
type TypeChart = Record<BeastMonType, TypeChartRow>

const TYPE_CHART: TypeChart = {
  fire: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_SUPER_EFFECTIVE,
    water:  CONSTANTS.TYPE_RESISTED,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  grass: {
    fire:   CONSTANTS.TYPE_RESISTED,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_SUPER_EFFECTIVE,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  water: {
    fire:   CONSTANTS.TYPE_SUPER_EFFECTIVE,
    grass:  CONSTANTS.TYPE_RESISTED,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_RESISTED,
  },
  ice: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_NEUTRAL,
    dragon: CONSTANTS.TYPE_SUPER_EFFECTIVE,
  },
  dragon: {
    fire:   CONSTANTS.TYPE_NEUTRAL,
    grass:  CONSTANTS.TYPE_NEUTRAL,
    water:  CONSTANTS.TYPE_NEUTRAL,
    ice:    CONSTANTS.TYPE_RESISTED,
    dragon: CONSTANTS.TYPE_SUPER_EFFECTIVE,
  },
} as const

export function getTypeEffectiveness(
  moveType: BeastMonType,
  defenderType: BeastMonType
): number {
  return TYPE_CHART[moveType][defenderType]
}
```

`TYPE_CHART` is not exported — it is an implementation detail. `getTypeEffectiveness` is the only export from this file.

### Correctness Notes

- Every value in the chart must reference a `CONSTANTS` key, not a raw literal. This makes incorrect values immediately visible as a mismatch against the constants file.
- The chart is `as const` — TypeScript enforces that no row or column is missing at compile time via the `Record<BeastMonType, ...>` type annotation.
- Do not add a fallback branch to `getTypeEffectiveness`. If TypeScript is satisfied (all types covered, no missing keys), no runtime fallback is needed. If TypeScript flags a gap, fix the chart.

---

## File 4: `packages/kernel/tests/typeChart.test.ts`

Implement the full test suite from `TEST_SPEC.md` Session 2 section. All tests listed there are required. You may add additional tests if you identify further coverage gaps, but you may not remove or weaken any specified test.

Import using `.js` extensions (required for ESM):

```typescript
import { describe, it, expect } from 'vitest'
import { getTypeEffectiveness } from '../src/typeChart.js'
import type { BeastMonType } from '../src/types.js'
```

Required test cases:

```typescript
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
```

---

## Things That Would Be Wrong

**In `types.ts`:**
- Exporting any value (function, constant, object) — this file is types only
- Making any field optional that is specified as required
- Adding extra fields not in the specification above
- Using `number` instead of `number | null` where null is specified
- Placing `actor_side` inside `BattleEvent.payload` — it is a top-level field

**In `constants.ts`:**
- Using raw numeric literals anywhere else in the kernel — they must come from `CONSTANTS`
- Computing one constant from another inside the object
- Exporting multiple objects or individual named exports — one `CONSTANTS` export only
- Storing `WEIGHT_ADJ_RESISTED` as a positive value — it must be `-25`

**In `typeChart.ts`:**
- Exporting `TYPE_CHART` directly
- Using raw numeric literals instead of `CONSTANTS` keys
- Adding a fallback/default return path — it masks a missing type and hides bugs
- Any arithmetic in the accessor — it is a pure lookup

**In all files:**
- Importing from `rng.ts` — this session has no dependency on RNG
- Modifying `index.ts`
- Using floating point

---

## Verification

Before committing, run from the repo root:

```bash
npm run build
npm test --workspace=packages/kernel
```

All tests must pass. Build must compile with zero TypeScript errors.

**Manual spot-check — verify the five self-matchups against the table:**

```
fire   vs fire   → 1000  (neutral)       ✓
grass  vs grass  → 1000  (neutral)       ✓
water  vs water  → 1000  (neutral)       ✓
ice    vs ice    → 1000  (neutral) ← NOT super effective; ice does not resist itself
dragon vs dragon → 2000  (super effective)  ✓
```

The `ice vs ice` case is a common mistake — verify it is `1000`, not `2000`.

---

## Git Instructions

Run before writing any code:

```bash
git checkout main
git pull origin main
git checkout -b session/02-types
```

When tests pass and build is clean:

```bash
git add packages/kernel/src/types.ts packages/kernel/src/constants.ts packages/kernel/src/typeChart.ts packages/kernel/tests/typeChart.test.ts
git commit -m "feat(kernel): implement types, constants, and type chart"
git push origin session/02-types
```

Then stop. Do not open a pull request. Report that the branch is pushed and ready for review.
