# BeastMon — Session 0: Repository Skeleton

## What This Session Does

Scaffolds the complete monorepo. Creates all directories, package configs, tsconfigs, and stub files with correct exports but no implementation. Every subsequent session will write into this structure without modifying configuration.

This session produces no logic. It produces only:
- Package and build configuration
- TypeScript project references
- Empty stub files with correct export signatures so imports resolve across packages

---

## What This Session Does NOT Do

- No business logic of any kind
- No test implementation
- No game rules
- No content data

---

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **Package manager:** npm workspaces
- **Test runner:** Vitest
- **Server:** Express
- **Frontend:** React 18 + Vite
- **Build:** tsc project references, each package builds independently

---

## Directory Structure to Create

```
beastmon/
  package.json                   ← workspace root
  tsconfig.base.json             ← shared compiler options
  packages/
    kernel/
      package.json
      tsconfig.json
      src/
        rng.ts
        constants.ts
        types.ts
        typeChart.ts
        moves.ts
        species.ts
        damage.ts
        weighting.ts
        abilities.ts
        kernel.ts
        index.ts                 ← re-exports everything public
      tests/
        rng.test.ts
        damage.test.ts
        weighting.test.ts
        abilities.test.ts
        kernel.test.ts
    server/
      package.json
      tsconfig.json
      src/
        store.ts
        index.ts
    client/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        main.tsx
        App.tsx
        playback.ts
        components/
          BattleArena.tsx
          MonCard.tsx
          BattleLog.tsx
          TurnIndicator.tsx
```

---

## Root package.json

```json
{
  "name": "beastmon",
  "private": true,
  "workspaces": [
    "packages/kernel",
    "packages/server",
    "packages/client"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "dev:server": "npm run dev --workspace=packages/server",
    "dev:client": "npm run dev --workspace=packages/client"
  }
}
```

---

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## packages/kernel/package.json

```json
{
  "name": "@beastmon/kernel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

---

## packages/kernel/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

---

## packages/server/package.json

```json
{
  "name": "@beastmon/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@beastmon/kernel": "*",
    "express": "^4.18.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/uuid": "^9.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

---

## packages/server/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "node16",
    "module": "node16"
  },
  "include": ["src/**/*"]
}
```

---

## packages/client/package.json

```json
{
  "name": "@beastmon/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@beastmon/kernel": "*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

---

## packages/client/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## packages/client/vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

---

## packages/client/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeastMon</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Stub Files

Each stub must:
- Have correct TypeScript syntax
- Export the names that other packages will import
- Contain only `TODO` placeholder implementations
- Not contain any real logic

### packages/kernel/src/rng.ts

```typescript
// STUB — implemented in Session 1

export class RNG {
  constructor(_seed: number) {
    throw new Error('TODO')
  }

  drawInt(_min: number, _max: number): number {
    throw new Error('TODO')
  }

  drawVariableMove1(): number { throw new Error('TODO') }
  drawVariableMove2(): number { throw new Error('TODO') }
  drawWeightedSelection(_W: number): number { throw new Error('TODO') }
  drawAllZeroFallback(): number { throw new Error('TODO') }
  drawSpeedTie(): number { throw new Error('TODO') }
  drawThaw(): number { throw new Error('TODO') }
  drawParalysisFail(): number { throw new Error('TODO') }
  drawAccuracy(): number { throw new Error('TODO') }
  drawCrit(): number { throw new Error('TODO') }
  drawVariance(): number { throw new Error('TODO') }
  drawStatusProc(_denominator: number): number { throw new Error('TODO') }
}
```

---

### packages/kernel/src/constants.ts

```typescript
// STUB — implemented in Session 2

export const CONSTANTS = {
  FIXED_POINT_DENOM: 1000,
  LEVEL: 50,
} as const
```

---

### packages/kernel/src/types.ts

```typescript
// STUB — implemented in Session 2

export type BeastMonType = 'fire' | 'grass' | 'water' | 'ice' | 'dragon'
export type MoveCategory = 'damage' | 'damage_plus_status' | 'pure_status'
export type StatusEffect = 'burn' | 'paralysis' | 'freeze'
export type StatusApplicationMode = 'guaranteed' | 'rolled'
export type Side = 'a' | 'b'

export interface Move {
  move_id: string
  name: string
  type: BeastMonType
  category: MoveCategory
  power: number
  accuracy: number
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
  signature_move_1: string
  signature_move_2: string
  variable_pool: [string, string, string, string, string, string]
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
  moveset: [Move, Move, Move, Move]
  status: StatusEffect | null
  speed_boost_stacks: number
}

export type EventType =
  | 'BATTLE_START'
  | 'MOVE_SELECTED'
  | 'ACTION_FROZEN_FAILED'
  | 'ACTION_PARALYSIS_FAILED'
  | 'MOVE_MISSED'
  | 'DAMAGE_DEALT'
  | 'STATUS_APPLIED'
  | 'STATUS_FAILED'
  | 'CRIT'
  | 'TYPE_SUPER_EFFECTIVE'
  | 'TYPE_RESISTED'
  | 'TYPE_IMMUNE'
  | 'BURN_DAMAGE'
  | 'MON_FAINTED'
  | 'BATTLE_END'

export interface BattleEvent {
  turn: number
  event_type: EventType
  actor_side: Side | null
  payload: Record<string, unknown>
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
  turn_duration_ms: number
  playback_start_ms: number
}

export interface StoredBattle {
  artifact: BattleArtifact
  timing: BattleTimingMetadata
}
```

---

### packages/kernel/src/typeChart.ts

```typescript
// STUB — implemented in Session 2
import type { BeastMonType } from './types.js'

export function getTypeEffectiveness(
  _moveType: BeastMonType,
  _defenderType: BeastMonType
): number {
  throw new Error('TODO')
}
```

---

### packages/kernel/src/moves.ts

```typescript
// STUB — implemented in Session 3
import type { Move } from './types.js'

export const MOVES: Record<string, Move> = {}

export function getMoveById(id: string): Move {
  const move = MOVES[id]
  if (!move) throw new Error(`Unknown move: ${id}`)
  return move
}
```

---

### packages/kernel/src/species.ts

```typescript
// STUB — implemented in Session 3
import type { Species } from './types.js'

export const SPECIES: Record<string, Species> = {}

export function getSpeciesById(id: string): Species {
  const species = SPECIES[id]
  if (!species) throw new Error(`Unknown species: ${id}`)
  return species
}
```

---

### packages/kernel/src/damage.ts

```typescript
// STUB — implemented in Session 4
import type { BattleMon, Move } from './types.js'

export function computeEffectiveAtk(_mon: BattleMon): number {
  throw new Error('TODO')
}

export function computeEffectiveDef(_mon: BattleMon): number {
  throw new Error('TODO')
}

export function computeDamage(
  _attacker: BattleMon,
  _defender: BattleMon,
  _move: Move,
  _critDraw: number,
  _varianceDraw: number,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeBurnDamage(_mon: BattleMon): number {
  throw new Error('TODO')
}
```

---

### packages/kernel/src/weighting.ts

```typescript
// STUB — implemented in Session 5
import type { BattleMon, Move } from './types.js'

export function isAhead(_self: BattleMon, _target: BattleMon): boolean {
  throw new Error('TODO')
}

export function isBehind(_self: BattleMon, _target: BattleMon): boolean {
  throw new Error('TODO')
}

export function isLowHP(_mon: BattleMon): boolean {
  throw new Error('TODO')
}

export function computeRoughDamage(
  _attacker: BattleMon,
  _defender: BattleMon,
  _move: Move,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeMoveWeight(
  _self: BattleMon,
  _target: BattleMon,
  _move: Move,
  _typeEffectiveness: number
): number {
  throw new Error('TODO')
}

export function computeAllWeights(
  _self: BattleMon,
  _target: BattleMon,
  _getTypeEffectiveness: (moveType: string, defType: string) => number
): [number, number, number, number] {
  throw new Error('TODO')
}

export function selectMove(
  _weights: [number, number, number, number],
  _draw: number
): number {
  throw new Error('TODO')
}
```

---

### packages/kernel/src/abilities.ts

```typescript
// STUB — implemented in Session 6

export type AbilityTrigger =
  | 'ON_BATTLE_START'
  | 'ON_BEFORE_DAMAGE'
  | 'ON_AFTER_DAMAGE'
  | 'ON_TURN_END'
  | 'ON_SURVIVE_LETHAL'
  | 'ON_STATUS_APPLY_ATTEMPT'

export interface AbilityResult {
  modified_atk?: number
  modified_def?: number
  block_status?: boolean
  block_damage?: boolean
  survive_lethal?: boolean
  damage_multiplier?: number
}

export function applyAbility(
  _ability_id: string,
  _trigger: AbilityTrigger,
  _context: Record<string, unknown>
): AbilityResult {
  throw new Error('TODO')
}
```

---

### packages/kernel/src/kernel.ts

```typescript
// STUB — implemented in Session 7
import type { KernelInputs, BattleArtifact } from './types.js'

export function runBattle(_inputs: KernelInputs): BattleArtifact {
  throw new Error('TODO')
}
```

---

### packages/kernel/src/index.ts

```typescript
// Public API of the kernel package
export * from './types.js'
export * from './constants.js'
export * from './typeChart.js'
export * from './moves.js'
export * from './species.js'
export * from './damage.js'
export * from './weighting.js'
export * from './abilities.js'
export * from './kernel.js'
export { RNG } from './rng.js'
```

---

### packages/kernel/tests/rng.test.ts

```typescript
// STUB — implemented in Session 1
import { describe, it } from 'vitest'

describe('RNG', () => {
  it.todo('same seed produces same sequence')
  it.todo('named draw wrappers stay within correct ranges')
})
```

---

### packages/kernel/tests/damage.test.ts

```typescript
// STUB — implemented in Session 4
import { describe, it } from 'vitest'

describe('damage', () => {
  it.todo('damage formula baseline')
  it.todo('burn halves atk')
  it.todo('immune move deals 0 damage')
})
```

---

### packages/kernel/tests/weighting.test.ts

```typescript
// STUB — implemented in Session 5
import { describe, it } from 'vitest'

describe('weighting', () => {
  it.todo('immune move gets weight 0')
  it.todo('rough KO bonus applied correctly')
  it.todo('integer-only HP comparison')
})
```

---

### packages/kernel/tests/abilities.test.ts

```typescript
// STUB — implemented in Session 6
import { describe, it } from 'vitest'

describe('abilities', () => {
  it.todo('huge power doubles atk at battle start')
  it.todo('sturdy survives lethal at full HP')
  it.todo('speed boost increments stacks on turn end')
})
```

---

### packages/kernel/tests/kernel.test.ts

```typescript
// STUB — implemented in Session 7
import { describe, it } from 'vitest'

describe('kernel', () => {
  it.todo('same seed produces identical artifact')
  it.todo('artifact starts with BATTLE_START event')
  it.todo('artifact ends with BATTLE_END event')
})
```

---

### packages/server/src/store.ts

```typescript
// STUB — implemented in Session 8
import type { StoredBattle } from '@beastmon/kernel'

export function storeBattle(_id: string, _battle: StoredBattle): void {
  throw new Error('TODO')
}

export function getBattle(_id: string): StoredBattle | undefined {
  throw new Error('TODO')
}
```

---

### packages/server/src/index.ts

```typescript
// STUB — implemented in Session 8
import express from 'express'

const app = express()
app.use(express.json())

const PORT = 3000

app.listen(PORT, () => {
  console.log(`BeastMon server running on port ${PORT}`)
})
```

---

### packages/client/src/main.tsx

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

### packages/client/src/App.tsx

```typescript
// STUB — implemented in Session 9
export default function App() {
  return <div>BeastMon</div>
}
```

---

### packages/client/src/playback.ts

```typescript
// STUB — implemented in Session 9
export {}
```

---

### packages/client/src/components/BattleArena.tsx

```typescript
// STUB — implemented in Session 9
export function BattleArena() {
  return null
}
```

---

### packages/client/src/components/MonCard.tsx

```typescript
// STUB — implemented in Session 9
export function MonCard() {
  return null
}
```

---

### packages/client/src/components/BattleLog.tsx

```typescript
// STUB — implemented in Session 9
export function BattleLog() {
  return null
}
```

---

### packages/client/src/components/TurnIndicator.tsx

```typescript
// STUB — implemented in Session 9
export function TurnIndicator() {
  return null
}
```

---

## Verification Checklist

After creating all files, verify:

1. `npm install` from root completes without errors
2. `npm run build` from root completes (stubs throw at runtime but must compile)
3. `npm run test` from root runs without crashing (all tests are `.todo` — zero failures expected)
4. TypeScript finds no import errors across packages — `@beastmon/kernel` resolves correctly in server and client
5. No file contains any game logic — only `throw new Error('TODO')` placeholders

## What NOT to do

- Do not implement any logic
- Do not invent types or exports beyond what is listed here
- Do not add dependencies not listed in the package.json specs above
- Do not modify any file once created — subsequent sessions own their respective files
