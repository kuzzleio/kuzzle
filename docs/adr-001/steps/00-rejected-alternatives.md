# Step 00 — Rejected alternatives (decision rationale)

**Status:** 🧊 Frozen/Archive
**Date:** 2026-07-12
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

> Archive of the options weighed when the ADR was written. The **chosen** options are summarized in the hub's *Decision* and *Decision register*; this file keeps the full comparison off the living surface. Frozen — edit only to correct a factual error.

## Goal

Record why the incremental / progressive-strict / freeze-Mocha approach was chosen over the alternatives, so the trade-offs stay auditable without bloating the hub.

## 1. Overall migration approach

### Option A — Incremental, ratchet + per-layer sprints *(chosen)*
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Spread out, predictable |
| Risk | Low (small reversible batches) |
| Delivery continuity | Preserved (features in parallel) |

**Pros:** no product *freeze*; each PR stays small and reviewable; the ratchet prevents regressions; value from the first sprints.
**Cons:** long duration; prolonged JS/TS coexistence; requires CI discipline.

### Option B — Big-bang
| Dimension | Assessment |
|-----------|------------|
| Complexity | Very high |
| Cost | Concentrated, blocking |
| Risk | Very high |
| Delivery continuity | Frozen |

**Pros:** final state reached at once, no coexistence.
**Cons:** unrealistic on 94 prod files + 168 tests including the biggest/most critical; giant non-reviewable PR; freezes other development; regressions hard to isolate. **Rejected.**

### Option C — Pure opportunistic (boy-scout only, no ratchet)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Diffuse |
| Risk | Low short-term |
| Convergence | **Not guaranteed** |

**Pros:** zero ceremony.
**Cons:** without a ratchet the JS ratio can climb back up; critical files (rarely touched "for nothing") never migrate; no predictable end. **Rejected** in favour of A (which *includes* the boy-scout rule but adds a constraint + planning).

## 2. Strictness target

### Option A — Rename + progressive strict via ratchet *(chosen)*
**Pros:** decouples two difficulties (changing the extension ≠ satisfying `strictNullChecks`); delivers TS value immediately; the big core files don't block on nulls at conversion time.
**Cons:** two ratchets to maintain; a period where some `.ts` are not yet strict.

### Option B — Full strict immediately
**Pros:** maximum quality from the start, no residual typing debt.
**Cons:** far higher per-file cost, especially on `httpwsProtocol`, `node.js`, `validation`; risk of sloppy conversions (`any`, `!`) just to "make it pass"; strongly slows the first sprints. **Rejected.**

### Option C — Rename only, strict deferred
**Pros:** fastest path to 100% `.ts`.
**Cons:** little TS value captured (loose typing lets most bugs through); risk that "strict later" never comes. **Rejected** — A keeps the strict target while making it non-blocking.

## 3. Handling of unit tests

### Option A — Decouple: freeze Mocha, everything new in vitest+TS *(chosen)*
**Pros:** unblocks vitest immediately without a test big-bang; prevents writing new Mocha debt; legacy migration at a controlled pace.
**Cons:** two runners coexist temporarily (double config, double CI command).

### Option B — Couple test ↔ module
**Pros:** consistency (a TS module has its vitest+TS tests).
**Cons:** makes every module conversion heavier (2 efforts per PR), inflates PRs, slows the priority language axis. **Rejected** as a *rule*, but stays **encouraged opportunistically** when a module and its tests are small.

### Option C — Production only, tests later
**Pros:** focuses on production.
**Cons:** leaves 168 JS files + Mocha as indefinite debt and keeps the double tooling with no end. **Rejected.**

## Trade-off analysis

- **Speed vs safety:** the ratchet turns an intention ("we'll migrate") into an invariant checked by CI, without imposing a risky big-bang. That is the central trade-off.
- **Decoupling the 3 axes:** handling them together per file (Option 2-B + 3-B everywhere) would produce huge PRs and block on the hardest link (strict on a 1200-line file). By decoupling them, each PR has **a single source of complexity**.
- **Leaves → core sequencing:** converting the leaves first (few dependencies) breaks in the process and tooling at low risk, before tackling `core` and `cluster` under the functional-test net.
- **Test debt temporarily accepted:** keeping Mocha alive avoids rewriting 168 tests at once, at the cost of a double unit-test CI during the transition — an accepted, bounded cost.
