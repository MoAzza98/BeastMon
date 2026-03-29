# BeastMon Project Overview

## What BeastMon is

BeastMon is a **provably fair, Pokémon-inspired 1v1 autobattler** built for a crypto wagering product.

Two BeastMon enter a battle. A single verified seed is used to determine all variable parts of that battle, and the system produces one complete, reproducible battle artifact. That artifact is then replayed for players in a synchronized way.

At its core, BeastMon is not a live player-input battle game. It is a **deterministic battle engine** that creates short, readable, exciting monster fights that feel familiar to fans of classic Pokémon, while being structured for fairness, replayability, and clean verification.

---

## What the product experience is

A player arrives at the site and watches or wagers on a BeastMon matchup.

Each side has one BeastMon. Every BeastMon has:
- one fixed type
- fixed HP, Attack, Defense, and Speed
- one ability
- two signature moves
- a pool of six variable moves

For each battle:
- the seed rolls two distinct variable moves from the six-move pool
- that gives each BeastMon a final four-move moveset
- the battle then plays out automatically
- move choice is context-aware, but the final move used is still chosen through the seed-driven battle process

The result is a battle that feels varied and dramatic, but is still fully reproducible.

---

## The design goal

BeastMon is designed to sit in the middle of three things:

### 1. Familiar monster-battle feel
It should feel recognizably inspired by early Pokémon:
- turn-based 1v1 combat
- typed moves
- status effects
- misses, crits, and damage variance
- readable strengths, weaknesses, and comeback moments

### 2. Provable fairness
The battle must be reproducible from public inputs and the verified seed.
The system should not rely on trusting a hidden server-side decision-maker.

### 3. Fast, watchable battle pacing
Battles should be short, legible, and exciting enough to support a wagering product.
They should produce dramatic moments without becoming chaotic or overly long.

---

## What makes BeastMon different from a normal battle game

BeastMon is **not** a traditional competitive battler where players pick moves manually each turn.

Instead:
- the battle is simulated in full by a deterministic engine
- the engine produces the canonical battle artifact
- the server stores that artifact and sets the playback timing
- clients replay the battle locally from the server-defined point in time

This means BeastMon is better thought of as:

> a deterministic battle artifact that is revealed over time

rather than:

> a live match being improvised in real time

That distinction is important for fairness, replay consistency, and technical simplicity.

---

## The battle fantasy

The battle fantasy is intentionally close to classic Pokémon, but simplified for clarity and robustness.

### Current MVP battle model
- 1v1 only
- one fixed type per BeastMon
- five types in the initial system:
  - Fire
  - Grass
  - Water
  - Ice
  - Dragon
- four core stats:
  - HP
  - Attack
  - Defense
  - Speed
- three non-volatile statuses:
  - Burn
  - Paralysis
  - Freeze

### Battle feel targets
- strong moves should feel strong
- type advantage should matter
- abilities should help create identity
- status moves should create believable comeback lines
- faster or stronger BeastMon should usually feel threatening
- weaker BeastMon should still have upset paths

---

## How a battle works at a high level

A BeastMon battle follows this rough flow:

1. Two BeastMon are selected for the matchup.
2. A verified seed is available for the round.
3. The engine rolls each BeastMon’s two extra moves from its six-move pool.
4. Each turn, the engine evaluates the current state and assigns weights to the four available moves.
5. The final move used is chosen through the deterministic seed-driven selection process.
6. Turn order is resolved by priority, then Speed, with seed-based tie-breaking if needed.
7. The action resolves through a fixed rules pipeline:
   - thaw / paralysis checks if relevant
   - accuracy check
   - crit check
   - damage calculation
   - status application if relevant
8. End-of-turn effects are applied.
9. The battle ends when one or both BeastMon are defeated.

The important thing is that all of this is deterministic and version-pinned.
The same seed and same rules produce the same battle every time.

---

## Why the system is modular

The MVP is deliberately limited, but the architecture is meant to grow.

The current system is built so future versions can add things like:
- more types
- dual typing
- more stats such as Special Attack and Special Defense
- more abilities
- more move effect categories
- more statuses
- more advanced content expansions

The product should feel expandable without needing to rewrite the core engine every time.

That means BeastMon is not just a single ruleset — it is the foundation for a growing battle framework.

---

## The fairness model in plain language

The product relies on a simple idea:

- the seed determines the battle’s variable outcomes
- the rules are fixed and versioned
- the simulator is deterministic
- the battle can be reproduced independently

So when a battle happens, the result is not supposed to be a mystery that only the operator can explain.
It should be something that can be checked and rerun from the same inputs.

This is the core trust model of the product.

---

## What the server does vs what the client does

### Server
The server is responsible for:
- receiving the seed and battle request
- running the full simulation immediately
- storing the canonical battle artifact
- setting playback and round timing
- serving the artifact and timing metadata to clients

### Client
The client is responsible for:
- loading the artifact
- loading timing metadata
- replaying the battle locally from the correct point in time
- optionally re-simulating for verification

The client is **not** authoritative for battle truth.

---

## What success looks like

A successful BeastMon MVP should feel like this:

- a clear matchup between two distinctive monsters
- a short, exciting, readable battle
- enough variety that battles do not feel repetitive
- enough structure that results do not feel random or fake
- a fairness model that can be explained simply
- a system that can later expand into richer content and releases

In short:

> BeastMon is a deterministic, provably fair, Pokémon-inspired 1v1 autobattler designed for fast, watchable, replayable monster battles in a wagering product.

That is the core product and project identity.
