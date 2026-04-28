# AGENTS.md — BeastMon Project Instructions

> This file is read automatically by Codex. Follow every rule here on every file you touch.
> For full system architecture, read `ARCHITECTURE.md`. For battle rules, read `BeastMon Master Ruleset Document.md`.

## Project Overview

BeastMon is a deterministic, provably fair, Pokémon-inspired 1v1 autobattler. A single seed determines all variable outcomes, producing one complete, reproducible battle artifact that clients replay in sync with server-authored timing. This is not a live player-input game — it is a deterministic battle engine whose canonical artifact is revealed over time to viewers.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode, exactOptionalPropertyTypes) |
| Package manager | npm workspaces |
| Test runner | Vitest |
| Server | Express (Node 20+) |
| Frontend | React 18 + Vite |
| Fixed-point denominator | 1000 (all multipliers are integers scaled by 1000) |

## Key Reference Documents

Read these before starting any task:

- `ARCHITECTURE.md` — Full system architecture, type definitions, formula specs, RNG ordering
- `BeastMon Master Ruleset Document.md` — Authoritative battle rules (for kernel/game logic work)
- `TEST_SPEC.md` — Pre-computed expected test values (immutable — never modify expected values)
- `Session Docs/session-NN-*.md` — Per-session implementation scopes

## Non-Negotiable Constraints

These are system-level correctness requirements, not style preferences. Violating them produces incorrect simulations.

**No floating point.** All math uses integer arithmetic. Multipliers are scaled by 1000. Every division uses `Math.floor()`. Never use `/` without an immediate `Math.floor()` wrapping it when operating on game values.

```typescript
// WRONG
const result = (a * b) / 1000

// RIGHT
const result = Math.floor((a * b) / 1000)
```

**No raw magic numbers.** Every numerical constant comes from `constants.ts`. If the constant does not exist there, ask before adding it. Do not hardcode `500`, `1500`, `2000`, etc. inline.

```typescript
// WRONG
const atk = Math.floor((base_atk * 500) / 1000)

// RIGHT
const atk = Math.floor((base_atk * CONSTANTS.BURN_ATK_MUL) / CONSTANTS.FIXED_POINT_DENOM)
```

**No speculative logic.** Never compute a value "just in case" it is needed. Every branch, draw, and calculation must only occur if its triggering condition has actually been reached. This applies especially to RNG draws — see the RNG section of `ARCHITECTURE.md`.

**No type redefinition.** All shared types live in `packages/kernel/src/types.ts`. Never redeclare an interface that already exists there. Import it.

## TypeScript Standards

- **Strict mode is on.** No `any`. No `as unknown as X`. No `!` non-null assertions unless the null case is structurally impossible and you explain why in a comment.
- **`exactOptionalPropertyTypes` is on.** Do not assign `undefined` to optional fields. Omit the field or provide the value.
- **No `// @ts-ignore` or `// @ts-expect-error`** unless you include a comment explaining exactly why it is unavoidable.
- Prefer `const` over `let`. Use `let` only when the variable is reassigned.
- Prefer explicit return types on all exported functions.
- Use `satisfies` for content data objects to get inference without widening.

## Function Design

- **Pure functions for all game logic.** A function that computes damage, weights, or state transitions must take all its inputs as parameters and return a value. No reading from module-level mutable state.
- **One responsibility per function.** If a function is doing two things, it should be two functions.
- **Short functions.** If a function exceeds ~40 lines, consider whether it contains multiple distinct steps that should be named and extracted.
- **Name functions after what they compute, not how.** `computeEffectiveAtk` not `applyBurnAndAbilitiesToAtk`.

## Error Handling

- **Throw on invalid input to pure game functions.** If `getMoveById` receives an unknown ID, throw. Do not return `undefined` and let it propagate silently.
- **Use discriminated unions, not nullable returns**, when a function can legitimately return "nothing".
- **Do not swallow errors.** No empty `catch` blocks.
- In server code, return structured error responses with appropriate HTTP status codes. Do not let unhandled exceptions crash the process silently.

## Security

- **No eval, no dynamic code execution.**
- **Validate all external inputs at the server boundary.** Seeds, species IDs, and any request body field must be validated before reaching the kernel. The kernel assumes its inputs are valid — enforcement happens at the HTTP layer.
- **No secrets in code.** No API keys, tokens, or credentials committed to source.
- **The kernel is the only source of battle truth.** No endpoint should allow a client to submit battle outcomes, damage values, or event lists. The server computes everything.

## Build & Test Commands

- Run all tests: `npm test`
- Build all packages: `npm run build`
- Run tests for kernel only: `npm test --workspace=packages/kernel`
- Start dev server: `npm run dev:server`
- Start dev client: `npm run dev:client`
- Run a deterministic battle simulation: `npm run battle`

Always run `npm test` after modifying any TypeScript file. All tests must pass before considering work complete.

## Git Workflow

Follow conventional commits: https://www.conventionalcommits.org/en/v1.0.0/

Format: `type(scope): description`

Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`
Scopes match package names: `kernel`, `server`, `client`, `rng`, `damage`, `weighting`, `abilities`

Examples:
```
feat(rng): implement Mulberry32 with named draw methods
test(damage): add burn halves atk case
fix(weighting): correct rough KO integer cross-multiply
```

- One logical change per commit.
- Do not mix implementation and test changes in the same commit if they are for different concerns.
- Do not commit files outside your session scope.
- Never push directly to `main`. Open a pull request from a feature branch.

## Session-Based Development

This project uses session-based implementation. Session spec documents live under `Session Docs/` as `session-NN-name.md`. When working on a session:

1. Read the session document completely before writing any code.
2. Read `ARCHITECTURE.md` and `TEST_SPEC.md`.
3. Implement only what the session specifies — do not touch files outside your session scope.
4. Do not change test expected values — tests are fixed contracts.

## What to Do When Unsure

If the specification is ambiguous, check in this order:
1. `ARCHITECTURE.md`
2. `BeastMon Master Ruleset Document.md`
3. Flag the ambiguity as a comment `// AMBIGUITY: ...` rather than guessing.

Do not invent behavior. Do not fill gaps with "reasonable" assumptions. Flag them.

## What Not to Do

- Do not refactor files outside your session scope, even if you think they could be improved.
- Do not add dependencies not already in the relevant `package.json`.
- Do not change test files to make your implementation pass. Tests are fixed. Your implementation must satisfy them.
- Do not remove or skip tests that are failing. A failing test is information.
- Do not add `console.log` to production code paths. Use it only in test debugging, and remove it before committing.
