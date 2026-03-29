# CLAUDE.md — BeastMon Code Standards

This file is read automatically by Claude Code. Follow every rule here on every file you touch.

---

## Your Role

You are implementing one module of a deterministic battle simulation system. You have been told which session you are working on. Read `ARCHITECTURE.md` to understand the full system. Implement only your assigned module. Do not touch files outside your session scope.

---

## Non-Negotiable Constraints

These are system-level correctness requirements, not style preferences. Violating them produces incorrect simulations.

**No floating point.**
All math uses integer arithmetic. Multipliers are scaled by 1000. Every division uses `Math.floor()`. Never use `/` without an immediate `Math.floor()` wrapping it when operating on game values.

```typescript
// WRONG
const result = (a * b) / 1000

// RIGHT
const result = Math.floor((a * b) / 1000)
```

**No raw magic numbers.**
Every numerical constant comes from `constants.ts`. If the constant does not exist there, ask before adding it. Do not hardcode `500`, `1500`, `2000`, etc. inline.

```typescript
// WRONG
const atk = Math.floor((base_atk * 500) / 1000)

// RIGHT
const atk = Math.floor((base_atk * CONSTANTS.BURN_ATK_MUL) / CONSTANTS.FIXED_POINT_DENOM)
```

**No speculative logic.**
Never compute a value "just in case" it is needed. Every branch, draw, and calculation must only occur if its triggering condition has actually been reached. This applies especially to RNG draws — see `ARCHITECTURE.md` RNG section.

**No type redefinition.**
All shared types live in `packages/kernel/src/types.ts`. Never redeclare an interface that already exists there. Import it.

---

## TypeScript Standards

- **Strict mode is on.** No `any`. No `as unknown as X`. No `!` non-null assertions unless the null case is structurally impossible and you explain why in a comment.
- **`exactOptionalPropertyTypes` is on.** Do not assign `undefined` to optional fields. Omit the field or provide the value.
- **No `// @ts-ignore` or `// @ts-expect-error`** unless you include a comment explaining exactly why it is unavoidable.
- Prefer `const` over `let`. Use `let` only when the variable is reassigned.
- Prefer explicit return types on all exported functions.
- Use `satisfies` for content data objects to get inference without widening.

---

## Function Design

- **Pure functions for all game logic.** A function that computes damage, weights, or state transitions must take all its inputs as parameters and return a value. No reading from module-level mutable state.
- **One responsibility per function.** If a function is doing two things, it should be two functions.
- **Short functions.** If a function exceeds ~40 lines, consider whether it contains multiple distinct steps that should be named and extracted.
- **Name functions after what they compute, not how.** `computeEffectiveAtk` not `applyBurnAndAbilitiesToAtk`.

---

## Error Handling

- **Throw on invalid input to pure game functions.** If `getMoveById` receives an unknown ID, throw. Do not return `undefined` and let it propagate silently.
- **Use discriminated unions, not nullable returns**, when a function can legitimately return "nothing".
- **Do not swallow errors.** No empty `catch` blocks.
- In server code, return structured error responses with appropriate HTTP status codes. Do not let unhandled exceptions crash the process silently.

---

## Security

- **No eval, no dynamic code execution.**
- **Validate all external inputs at the server boundary.** Seeds, species IDs, and any request body field must be validated before reaching the kernel. The kernel assumes its inputs are valid — enforcement happens at the HTTP layer.
- **No secrets in code.** No API keys, tokens, or credentials committed to source.
- **The kernel is the only source of battle truth.** No endpoint should allow a client to submit battle outcomes, damage values, or event lists. The server computes everything.

---

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

---

## What Clean Code Looks Like Here

```typescript
// Good: named constants, explicit types, pure function, floor at every step
export function computeDamage(
  attacker: BattleMon,
  defender: BattleMon,
  move: Move,
  critDraw: number,
  varianceDraw: number,
  typeEffectiveness: number
): number {
  const A = computeEffectiveAtk(attacker)
  const D = computeEffectiveDef(defender)
  const x1 = Math.floor((2 * CONSTANTS.LEVEL) / 5) + 2
  const x2 = x1 * move.power
  const x3 = Math.floor((x2 * A) / D)
  const x4 = Math.floor(x3 / 50) + 2
  const critMul = critDraw === 0 ? CONSTANTS.CRIT_MUL : CONSTANTS.FIXED_POINT_DENOM
  const stabMul = move.type === attacker.type ? CONSTANTS.STAB_ON : CONSTANTS.STAB_OFF
  const x5 = Math.floor((x4 * critMul) / CONSTANTS.FIXED_POINT_DENOM)
  const x6 = Math.floor((x5 * stabMul) / CONSTANTS.FIXED_POINT_DENOM)
  const x7 = Math.floor((x6 * typeEffectiveness) / CONSTANTS.FIXED_POINT_DENOM)
  const x9 = Math.floor((x7 * varianceDraw) / CONSTANTS.FIXED_POINT_DENOM)
  if (typeEffectiveness === 0) return 0
  return Math.max(1, x9)
}
```

---

## What to Do When You Are Unsure

If the specification is ambiguous, check in this order:
1. `ARCHITECTURE.md` — most decisions are pinned there
2. `BeastMon_Master_Ruleset_Document.md` — authoritative for all battle rules
3. Stop and surface the ambiguity as a comment `// AMBIGUITY: ...` rather than guessing

Do not invent behavior. Do not fill gaps with "reasonable" assumptions. Flag them.

---

## What Not to Do

- Do not refactor files outside your session scope, even if you think they could be improved.
- Do not add dependencies not already in the relevant `package.json`.
- Do not change test files to make your implementation pass. Tests are fixed. Your implementation must satisfy them.
- Do not remove or skip tests that are failing. A failing test is information.
- Do not add `console.log` to production code paths. Use it only in test debugging, and remove it before committing.
