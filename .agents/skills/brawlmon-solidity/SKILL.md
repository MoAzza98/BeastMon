---
name: brawlmon-solidity
description: >
  Solidity smart contract patterns and security rules for BrawlMon.
  Use when writing, reviewing, or modifying any Solidity code in /contracts.
  Triggers on: Solidity, .sol files, Foundry, forge, Chainlink VRF,
  OpenZeppelin, reentrancy, contract security.
---

# BrawlMon Solidity Patterns

BrawlMon is a deterministic on-chain wagering arena deployed to Base, using Chainlink VRF for randomness. The contract is the trust boundary for user funds — every rule here exists to protect invariants that matter in production.

## Core Invariants

- **Integer-only arithmetic.** `SCALE = 1000` is the fixed-point denominator. Every multiplier is an integer scaled by 1000. No floating-point equivalents (Solidity has none, but watch for patterns that assume decimal math).
- **Mulberry32 PRNG is deterministic.** If the contract re-derives randomness locally (e.g., from a VRF seed), the PRNG port must match the TypeScript kernel bit-for-bit. Cross-verify with kernel tests.
- **Client is not authoritative.** The contract is the only source of truth for outcomes and payouts. No function should accept a pre-computed winner, damage value, or event list from a caller.

## Reentrancy

- Use OpenZeppelin's `ReentrancyGuard` and apply `nonReentrant` to every external function that moves ETH or updates balances: `placeBet`, `claimWinnings`, `resolveMarket`.
- Follow Checks-Effects-Interactions strictly. Update all state before any external call or ETH transfer.
- Do not use `transfer` or `send` — gas stipends are unreliable on L2s. Use `call{value: amount}("")` and check the returned bool.
- Assume any external address can reenter. Pull payments (claim-based) are safer than push payments.

## Chainlink VRF Patterns

- `triggerVRF` requests randomness and stores the request ID keyed to the market. It must not change market state beyond marking "awaiting VRF".
- The VRF callback (`fulfillRandomWords` or equivalent) is the trust point where outcomes are derived. Validate the request ID, mark the market as resolved, compute the outcome deterministically from the word, and emit an event.
- `resolveMarket` (if separate from the callback) must gate on "VRF fulfilled" and on idempotency — re-entry or double-resolution must revert.
- Never branch on state that the VRF callback itself will set before the callback runs. No "if this might resolve, do X" logic in user-facing functions.
- Store the VRF word, not just a derived outcome — auditors and users need to verify the PRNG stream.

## Payout Logic

- `placeBet` must validate: market is open, bet amount within min/max bounds, caller has not exceeded per-market limits, `msg.value == expectedAmount`.
- `claimWinnings` is pull-based: winners call it themselves, contract never pushes. This bounds gas and prevents griefing.
- All payout math uses `SCALE = 1000` fixed-point. Compute payout as `Math.floor((stake * payoutMul) / SCALE)` equivalent in Solidity: `(stake * payoutMul) / SCALE` (Solidity division truncates — this IS the floor).
- Track claimed amounts per user per market to prevent double-claims.
- House fee, if any, is deducted at resolution time, not at claim time, so per-claim math stays simple.

## OpenZeppelin Usage

- Prefer audited OpenZeppelin contracts over custom implementations: `ReentrancyGuard`, `Ownable` / `AccessControl`, `Pausable`, `SafeERC20` (if ERC20s are involved).
- Pin the OZ version in `package.json` / `foundry.toml`. Do not float to `^latest`.
- Do not override OZ functions without a documented reason. If you must, re-audit the inherited invariants.

## Foundry Workflow

- `forge test` runs the full suite. All tests must pass before any merge.
- Use `forge test --match-contract` to scope to a single contract during development.
- Every money-moving function needs: a unit test for the happy path, a unit test for each revert condition, and a fuzz test over input ranges.
- Add invariant tests (`StdInvariant`) for contract-level properties: "sum of claimable ≤ contract balance", "no market resolves twice", "VRF request ID is never reused".
- Use `vm.expectRevert` with the specific error selector, not generic revert matching.

## Security Checklist

Before marking any contract change ready for review, confirm:

- [ ] Access control on every privileged function (`onlyOwner` / role-gated).
- [ ] Reentrancy guards on every ETH-moving external function.
- [ ] Checks-Effects-Interactions order in every function that both updates state and calls out.
- [ ] Events emitted for every state change users need to observe off-chain.
- [ ] Storage layout is append-only (never reorder or change types of existing slots if the contract is upgradeable).
- [ ] No `tx.origin` for authorization.
- [ ] No unbounded loops over user-controlled data.
- [ ] `block.timestamp` used only for coarse comparisons (minutes+), never for randomness or fine-grained ordering.
- [ ] Integer overflow is impossible (Solidity 0.8+ checks by default — flag any `unchecked { }` block with the specific reason it is safe).
- [ ] VRF callback is the only path that resolves outcomes.

## What to Avoid

- Do not introduce floating-point-style patterns (e.g., splitting multiplier into numerator/denominator at different call sites — keep `SCALE` explicit and consistent).
- Do not add new external dependencies without noting the audit status.
- Do not skip `forge test` because "the change is small". Every change runs the full suite.
- Do not deploy without a deployment script committed to the repo and verified locally.
