# Claude Code Session Prompt — Boilerplate

Use this exact text in the Claude Code message box when attaching a session document.
Replace the bracketed values for each session.

---

## Prompt to Type

```
You are working on the BeastMon project. I have attached your session document which contains everything you need.

Before doing anything else:
1. Read the attached session document completely
2. Read ARCHITECTURE.md in the project root
3. Read CLAUDE.md in the project root
4. Read TEST_SPEC.md in the project root for your session's test cases

Your session is: [SESSION NAME e.g. "Session 0 — Skeleton"]
Your branch is: [BRANCH NAME e.g. "session/00-skeleton"]

Do not begin any implementation until you have confirmed you have read all four documents. Summarise in one sentence what your session must deliver, and one sentence what it must not touch. Then proceed.
```

---

## Per-Session Fill-in Values

| Session | Session Name | Branch Name |
|---|---|---|
| 0 | Session 0 — Skeleton | session/00-skeleton |
| 1 | Session 1 — RNG | session/01-rng |
| 2 | Session 2 — Types, Constants, TypeChart | session/02-types |
| 3 | Session 3 — Content | session/03-content |
| 4 | Session 4 — Damage | session/04-damage |
| 5 | Session 5 — Weighting | session/05-weighting |
| 6 | Session 6 — Abilities | session/06-abilities |
| 7 | Session 7 — Kernel | session/07-kernel |
| 8 | Session 8 — Server | session/08-server |
| 9 | Session 9 — Frontend | session/09-frontend |

---

## Files to Attach Per Session

Attach all of these every time:

| File | Why |
|---|---|
| `session-NN-name.md` | The session's implementation spec |
| `ARCHITECTURE.md` | Full system context and type reference |
| `CLAUDE.md` | Code standards and git workflow |
| `TEST_SPEC.md` | Pre-specified test cases for this session |
| `BeastMon_Master_Ruleset_Document.md` | Authoritative rules — attach for sessions 1–7 only |

Sessions 8 and 9 (Server and Frontend) do not need the ruleset document — they consume the artifact, they do not implement rules.

---

## If Claude Code Gets Stuck or Goes Off Track

Paste this as a follow-up message:

```
Stop. Re-read CLAUDE.md and your session document.
Confirm:
- Which files you are allowed to touch
- Which files you are not allowed to touch
- Whether your current approach introduces any floating point, magic numbers, or speculative logic

Do not continue until you have answered all three.
```

---

## When Claude Code Reports the Branch Is Pushed

1. Go to GitHub
2. Open a pull request from `session/NN-name` → `main`
3. Review the diff — check that only the files listed in the session document were changed
4. If clean, approve and merge using Squash merge
5. Delete the branch after merging
6. Start the next session only after the merge is complete
