---
name: audit-session
description: >
  Hostile audit of a BeastMon session PR diff against the spec.
  Finds spec deviations with CRITICAL/HIGH/MEDIUM/LOW severity ratings.
  Use after a session branch is pushed, before approving any PR merge.
---

# BeastMon Session Audit

Adversarial review of a session PR diff. Assume the implementation drifted. Your job is to find every deviation from the spec and rate it by severity. Do not be charitable.

## Before You Start

Read these documents fully. Do not skim.

- `ARCHITECTURE.md` — type definitions, RNG ordering, formula specs
- `TEST_SPEC.md` — pinned expected test values (immutable)
- `BeastMon Master Ruleset Document.md` — authoritative battle rules
- `Session Docs/session-NN-<name>.md` — the session spec whose PR you are auditing

Then read the PR diff in full. Every file, every line.

## What to Audit

### 1. Determinism Violations (CRITICAL by default)

- Any floating-point arithmetic on game values (look for `/` not wrapped in `Math.floor()`).
- Any use of `Math.random()` or `Date.now()` as a source of randomness.
- Speculative RNG draws — a `rng.draw*()` call made before its triggering condition is confirmed reached.
- Reordered, skipped, or extra RNG draws vs. the sequence pinned in `ARCHITECTURE.md`.
- HP / percentage comparisons that divide instead of cross-multiplying (e.g., `hp / max < 0.5` instead of `hp * 2 < max`).
- Non-integer inputs or outputs on any pure game function.

### 2. Constant Violations (HIGH)

- Inline magic numbers (`500`, `1000`, `1500`, `2000`, etc.) instead of `CONSTANTS.*` references.
- New constants added to `constants.ts` that don't appear in the ruleset or architecture docs.
- Renamed constants or changed numerical values.

### 3. Formula Deviations (CRITICAL)

- Damage formula: any step, multiplier order, or floor-point that diverges from the spec.
- Move weighting: cross-multiplication steps, rough-KO weighting, tie-breaking, all must match spec exactly.
- Ability trigger order and condition checks.

### 4. Type Violations (HIGH)

- Interfaces redeclared outside `packages/kernel/src/types.ts`.
- `any`, `as unknown as X`, or `!` non-null assertions without a justifying comment.
- `@ts-ignore` / `@ts-expect-error` without a justifying comment.
- Optional-field assignments that set `undefined` instead of omitting (violates `exactOptionalPropertyTypes`).

### 5. Test Violations (CRITICAL)

- Modified expected values in any test file.
- Deleted or `.skip`'d tests.
- Tests that were changed to match a buggy implementation rather than the spec.
- Missing test coverage for a behavior the session spec explicitly requires.

### 6. Scope Violations (HIGH)

- Files changed that are outside the session spec's declared scope.
- Unrelated refactors bundled into the session PR.
- New dependencies added to any `package.json`.
- Changes to `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`, or the ruleset document.

### 7. Code Quality (MEDIUM / LOW)

- Functions exceeding ~40 lines without extraction (MEDIUM).
- Poor naming (function named after implementation instead of what it computes) (LOW).
- Missing explicit return types on exported functions (LOW).
- `console.log` left in production code paths (MEDIUM).
- Empty `catch` blocks (HIGH — swallows errors).

## Severity Ratings

- **CRITICAL** — Breaks determinism or the battle artifact. Same seed now produces a different result, or the result violates the ruleset. Must block merge.
- **HIGH** — Correctness or safety issue that doesn't affect the artifact (e.g., error handling, input validation gaps, type-system erosion, scope creep). Must be fixed before merge.
- **MEDIUM** — Maintainability or code-quality issue that should be fixed but doesn't block merge if the author explicitly defers it.
- **LOW** — Style, naming, or minor polish. Noted for awareness, not a blocker.

## Output Format

Produce a markdown report grouped by severity, highest first. For each finding:

```
### CRITICAL: <one-line title>
File: `path/to/file.ts:42`
<2–3 sentence explanation of the deviation, why it violates the spec, and the specific line that triggered it.>
Fix: <concrete suggestion — what the correct implementation should look like.>
```

End the report with a one-line verdict:

- **BLOCK** if any CRITICAL or HIGH findings exist.
- **APPROVE WITH COMMENTS** if only MEDIUM/LOW findings exist.
- **APPROVE** if no findings.

Do not soften findings to be polite. The point of this audit is to catch drift the session author missed.
