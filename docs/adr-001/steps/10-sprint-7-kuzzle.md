# Step 10 — Sprint 7: `lib/kuzzle` (bootstrap, vault, dumps, event runner)

**Status:** 🟦 In progress — opened 2026-09-15
**Date:** 2026-09-15 → …
**PR(s):** —
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the six `.js` files left under `lib/kuzzle`. 882 LOC — the smallest sprint since `lib/util`, and the first with **no spec effort in it at all**.

| File | LOC | Spec |
|------|----:|------|
| `dumpGenerator.js` | 274 | `test/kuzzle/dumpGenerator.test.js` |
| `internalIndexHandler.js` | 234 | `test/kuzzle/internalIndexHandler.test.js` |
| `event/pipeRunner.js` | 144 | `test/kuzzle/event/pipeRunner.test.js` |
| `event/waterfall.js` | 101 | `test/kuzzle/event/waterfall.test.js` |
| `vault.js` | 89 | `test/kuzzle/vault.test.js` |
| `kuzzleStateEnum.js` | 40 | — (covered through its importers) |

After this step the only `.js` left under `lib/` is `lib/cluster` (sprint 8).

## Sequencing: this sprint is sequenced by nothing, and that is the finding

Every sprint since [step 07](07-sprint-5-core-i.md) has been ordered by **measured, gate-facing coverage**, because a `.js` → `.ts` rename re-scores the whole file as new code and the gate wants `new_coverage ≥ 80%`. Measured on `2-dev` after sprint 6 merged:

| File | Lines (normalised) | Line % | **Sonar %** | Gate |
|------|-------------------:|-------:|------------:|------|
| `internalIndexHandler.js` | 170 | 100.0% | **100.0%** | ✅ |
| `kuzzleStateEnum.js` | 8 | 100.0% | **100.0%** | ✅ |
| `event/pipeRunner.js` | 71 | 100.0% | **100.0%** | ✅ |
| `event/waterfall.js` | 50 | 100.0% | **100.0%** | ✅ |
| `dumpGenerator.js` | 205 | 93.2% | **91.5%** | ✅ |
| `vault.js` | 46 | 100.0% | **88.7%** | ✅ |

550 measurable lines, aggregate **95.9%**, and **no file is within 8 points of the threshold**. There is nothing to sequence: any order works, so the split below is by coupling rather than by risk.

⚠️ **The two percentages are not the same measurement, and only the second one is the gate's.** SonarQube's `coverage` is `(covered_lines + covered_conditions) / (lines_to_cover + conditions_to_cover)` — it folds **branch** coverage into the same ratio. Every figure this migration has quoted so far has been line-only, which is the same number whenever branch coverage tracks line coverage, and diverges when it does not: `vault.js` is **100% of lines and 1 of 7 branches** — a single `load()` call in the whole suite, walking one path through six `assert`s — so the gate sees 88.7%, not 100%. It still clears, and so does everything else here, but the aggregate this sprint is planned against is **95.9%**.

### Why this layer and not `lib/cluster`

The hub planned sprint 7 as `lib/cluster` and sprint 8 as `lib/kuzzle`. The measurement inverts that:

| Layer | Files | Lines | Aggregate | Below gate |
|-------|------:|------:|----------:|------------|
| `lib/kuzzle` | 6 | 550 | 95.9% | — |
| `lib/cluster` | 6 | 1 544 | 88.9% | `command.js` **16.9%** (needs ≈ +101 covered lines) · `workers/IDCardRenewer.js` **71.3%** (≈ +10) |

`lib/cluster` holds the **only two spec efforts left in the repo**, and `command.js` is the largest single one the migration has faced outside sprint 6's original plan. Doing `lib/kuzzle` first keeps the two kinds of work apart — six plain conversions here, then a sprint that is mostly about writing tests — which is the split step 09 proved is worth making explicit: its H4/H5/H6 block was sized as a spec effort and turned out to be plain conversions once [TD-50](../type-debt-register.md#td-50) was fixed, and the mixed framing cost a re-plan mid-sprint.

## Plan

Two PRs, split where the module graph splits.

### I1 — the leaves (4 files, 374 LOC)

`kuzzleStateEnum.js` · `vault.js` · `event/waterfall.js` · `event/pipeRunner.js`

Four modules with four different export shapes, which is most of the conversion work:

- **`kuzzleStateEnum`** is `module.exports = Object.freeze({…})`. A frozen object of numeric states, read by `kuzzle.ts` — a `const` object plus a derived union type, not a TS `enum` (the repo has none, and an `enum` emits a runtime object the frozen one already is).
- **`vault`** is `module.exports = { load }` — a named-export object, the one shape that converts to plain `export function` with no `export =`.
- **`waterfall`** is `module.exports = waterfall` with two module-private helpers and a `WaterfallContext` class. The callback chain is the typing problem: `waterfallCB` is invoked with `(err, res)` from arbitrary plugin code.
- **`pipeRunner`** is `module.exports = PipeRunner`, depends on `waterfall`, and holds a `Denque` of `PipeChain`. It converts after `waterfall`, in the same PR.

### I2 — the two classes (2 files, 508 LOC)

`internalIndexHandler.js` · `dumpGenerator.js`

- **`InternalIndexHandler extends Store`** — `lib/core/shared/store.ts` is already TypeScript, so this is the first file in the sprint where the base class constrains the subclass rather than the other way round. Expect the same category of finding as H6's `implements NetworkEntryPoint`: members the JavaScript read that the declared base does not have.
- **`DumpGenerator`** is the one file under 100% on lines (93.2%, 91.5% to the gate). It shells out to `dumpme`, walks the filesystem and gzips — the uncovered lines are the error paths, and they stay uncovered; it clears the gate with room.

Both have Mocha specs. Per the standing rule, **convert first, then touch the spec** — and only to follow the source (`node:fs` specifiers, per step 09's H5/H6 equivalence notes).

## Expected counters

`js` **17 → 11** · `strict` **131 → 137** (all six are expected to adopt; `--candidates` will confirm) · `mocha` unchanged at **149** unless a spec is replaced rather than kept · `any` and `implicit-any` must not rise.

## What was done

*(filled per PR)*
