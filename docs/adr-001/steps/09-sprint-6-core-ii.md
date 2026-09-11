# Step 09 — Sprint 6: `lib/core` II (validation, plugin, network)

**Status:** 🟦 In progress — opened 2026-09-11
**Date:** 2026-09-11 → …
**PR(s):** —
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the second half of `lib/core`: the **validation** engine, the **plugin** machinery and the **network** layer. 34 `.js` files, 8 195 LOC — the largest and hardest sprint so far, and the one holding the repo's two biggest remaining files (`httpwsProtocol` 1 254 LOC, `pluginsManager` 1 244).

| Area | Files | LOC |
|------|------:|----:|
| `validation` — engine + 13 leaf types + `baseType` | 15 | 2 779 |
| `plugin` — `plugin`, `pluginsManager`, `pluginRepository`, `pluginManifest`, `privilegedContext` | 5 | 1 911 |
| `network` — entrypoint, router, protocols, HTTP router, access log | 14 | 3 505 |

After this step the only `.js` left under `lib/` is `lib/cluster` (sprint 7) and `lib/kuzzle` (sprint 8).

## Sequencing: measured coverage first — and measured the way the gate measures

[Step 07](07-sprint-5-core-i.md) established the rule the hard way: **a `.js` → `.ts` rename re-scores the whole file as new code**, so `new_lines_to_cover` is the file's entire body and *today's coverage is tomorrow's `new_coverage`*. The SonarCloud gate requires `new_coverage ≥ 80%`.

### ⚠️ The raw c8 report is not the number the gate sees — and here it is optimistic

Step 07 also added `.ci/scripts/prepare-coverage.ts`, which drops blank and comment-only lines from the LCOV before SonarCloud reads it. Planning this sprint off the *raw* `c8` output would have put **three files in the wrong block**, because normalisation removes hit comment lines as well as unhit ones:

| File | Raw | Normalised | |
|------|----:|-----------:|---|
| `plugin/pluginManifest.js` | 80.4% | **59.3%** | looked gate-safe, is not |
| `plugin/privilegedContext.js` | 90.7% | **66.7%** | looked comfortable, is not |
| `network/router.js` | 81.6% | **79.3%** | looked gate-safe, is just under |

Repo-wide the same pass moves coverage 84.4% → 80.2%, i.e. **normalisation is not a free uplift**. Every figure below is the normalised one. (Measured on `2-dev`, 2026-09-11: `npm run test:unit:mocha:coverage`, then `prepare-coverage.ts`. The raw `LF` happens to equal `wc -l` exactly — c8 instruments every line of a loaded file, which is precisely the inflation the script exists to undo.)

### Per-file

| File | Lines (raw c8) | Raw | Lines (normalised) | **Normalised** | Gate |
|------|---------------:|----:|-------------------:|---------------:|------|
| `network/clientConnection.js` | 57 | 100.0% | 23 | **100.0%** | ✅ |
| `network/context.js` | 80 | 100.0% | 54 | **100.0%** | ✅ |
| `network/protocolManifest.js` | 34 | 100.0% | 9 | **100.0%** | ✅ |
| `network/httpRouter/routeHandler.js` | 111 | 100.0% | 53 | **100.0%** | ✅ |
| `validation/baseType.js` | 80 | 100.0% | 25 | **100.0%** | ✅ |
| `validation/types/anything.js` | 38 | 100.0% | 11 | **100.0%** | ✅ |
| `validation/types/boolean.js` | 52 | 100.0% | 18 | **100.0%** | ✅ |
| `validation/types/date.js` | 284 | 100.0% | 219 | **100.0%** | ✅ |
| `validation/types/email.js` | 92 | 100.0% | 46 | **100.0%** | ✅ |
| `validation/types/enum.js` | 100 | 100.0% | 54 | **100.0%** | ✅ |
| `validation/types/geoPoint.js` | 54 | 100.0% | 19 | **100.0%** | ✅ |
| `validation/types/integer.js` | 57 | 100.0% | 21 | **100.0%** | ✅ |
| `validation/types/ipAddress.js` | 83 | 100.0% | 39 | **100.0%** | ✅ |
| `validation/types/numeric.js` | 108 | 100.0% | 62 | **100.0%** | ✅ |
| `validation/types/object.js` | 88 | 100.0% | 38 | **100.0%** | ✅ |
| `validation/types/string.js` | 110 | 100.0% | 63 | **100.0%** | ✅ |
| `validation/types/url.js` | 83 | 100.0% | 39 | **100.0%** | ✅ |
| `validation/types/geoShape.js` | 370 | 98.1% | 262 | **97.7%** | ✅ |
| `network/protocols/httpMessage.js` | 69 | 98.6% | 31 | **96.8%** | ✅ |
| `network/protocols/internalProtocol.js` | 109 | 96.3% | 48 | **95.8%** | ✅ |
| `network/httpRouter/routePart.js` | 147 | 96.6% | 67 | **94.0%** | ✅ |
| `network/httpRouter/index.js` | 316 | 92.1% | 156 | **89.7%** | ✅ |
| `network/protocols/mqttProtocol.js` | 291 | 89.3% | 194 | **88.1%** | ✅ |
| `plugin/pluginRepository.js` | 132 | 93.9% | 52 | **86.5%** | ✅ |
| `network/protocols/protocol.js` | 102 | 88.2% | 51 | **84.3%** | ⚠️ |
| `network/accessLogger.js` | 322 | 83.5% | 221 | **82.4%** | ⚠️ |
| `network/router.js` | 255 | 81.6% | 145 | **79.3%** | ❌ |
| `plugin/privilegedContext.js` | 43 | 90.7% | 9 | **66.7%** | ❌ |
| `network/protocols/httpwsProtocol.js` | 1254 | 66.8% | 865 | **61.7%** | ❌ |
| `plugin/pluginManifest.js` | 56 | 80.4% | 27 | **59.3%** | ❌ |
| `plugin/pluginsManager.js` | 1244 | 66.1% | 841 | **58.1%** | ❌ |
| `network/entryPoint.js` | 358 | 65.1% | 223 | **55.2%** | ❌ |
| `plugin/plugin.js` | 436 | 49.3% | 337 | **46.9%** | ❌ |
| `validation/validation.js` | 1180 | 43.1% | 890 | **36.2%** | ❌ |

Every one of the 34 files already has a spec reaching it — unlike sprint 5, nothing here is unnetted. The gap is **depth, not existence**.

## PR breakdown (planned)

The gate scores a PR's **aggregate**, not each file, so the blocks are formed to clear 80% as a whole. "Covered lines needed" is what each block is short of the threshold *before* any new spec is written.

| PR | Scope |
|----|-------|
| **H1** | `validation/types/*` + `baseType` — pure leaves |
| **H2** | `network` minus `entryPoint`/`httpwsProtocol`: `clientConnection`, `context`, `protocolManifest`, `httpRouter/*`, `protocols/{httpMessage,internalProtocol,mqttProtocol,protocol}`, `accessLogger`, `router` |
| **H3** | `plugin` leaves: `pluginRepository`, `privilegedContext`, `pluginManifest` |
| **H4** | `validation/validation.js` — spec effort, then rename |
| **H5** | `plugin/plugin.js` + `pluginsManager.js` — coupled; spec effort, then rename |
| **H6** | `network/entryPoint.js` + `protocols/httpwsProtocol.js` — coupled (`entryPoint` owns the protocols); spec effort, then rename |

| PR | Files | Lines | Uncovered | Aggregate | Covered lines needed for 80% |
|----|------:|------:|----------:|----------:|-----------------------------:|
| **H1** | 14 | 916 | 6 | 99.3% | — |
| **H2** | 12 | 1052 | 123 | 88.3% | — |
| **H3** | 3 | 88 | 21 | 76.1% | +4 |
| **H4** | 1 | 890 | 568 | 36.2% | +390 |
| **H5** | 2 | 1178 | 531 | 54.9% | +296 |
| **H6** | 2 | 1088 | 431 | 60.4% | +214 |
| **all** | 34 | 5212 | 1680 | 67.8% | |

Reading that table:

- **H1 and H2 are conversions.** They clear the gate on existing specs with room to spare and can move immediately, in parallel.
- **H3 is a conversion plus four lines of test.** `router.js` (79.3%) is carried by H2's aggregate; the three plugin leaves are only 88 lines between them, so their block lands at 76.1% and needs a handful of assertions — not a spec effort.
- **H4, H5 and H6 are spec efforts with a rename at the end**, the shape sprint 5 established for `clientAdapter`. Together they need roughly **+900 covered lines**. `validation.js` alone needs +390 and is the largest single piece of work in the sprint.

H1 → H3 are independent of each other and of H4 → H6; the leaves go first so `validation.js` (H4) is converted against already-typed types.

## Known risks, before starting

- **`httpwsProtocol.js` (865 measurable lines, 61.7%)** is the riskiest file of the whole migration: HTTP *and* WebSocket entrypoint, with its uncovered third largely error and back-pressure paths, where a regression is not caught by unit tests. Sprint 5's `Build and Run` job caught exactly that class of bug (a dynamic method call turned into a property read, losing its receiver) — keep that job in mind as the real net here.
- **`validation.js` at 36.2%** is the lowest-covered file in scope and the most branch-heavy (recursive schema walking). Its three existing specs (`init`, `util`, `validate`) cover the happy paths.
- **The plugin machinery is the API surface third-party plugins are written against.** The conversion must not change the shape of what `pluginContext` hands out; `lib/core/plugin/pluginContext.ts` is already TS and typed, so most of the risk sits in `plugin.js`'s manifest and loading paths.
- **`fail-fast: false` is now set on the functional matrix** and the readiness gate is fixed ([TD-33](../type-debt-register.md#td-33)), so a flaky variant no longer hides the other 29 results during this sprint's re-runs.

## Definition of done (per PR)

Unchanged from step 06, restated because this sprint is long:

- `export =` for modules consumed by JS; no new written `any`, no `@ts-ignore`, no `!`.
- All **five** ratchets green, baselines updated **in the same PR** (`js`, `mocha`, `any`, `implicit-any`, `cpd-exclusions`).
- Strict adoption when the converted file is clean (`npm run test:strict -- --candidates` must come back empty).
- A vitest spec for any file whose coverage the PR relies on, under `tests/` mirroring the source tree.
- A gate-driven, behaviour-preserving refactor is **in scope** when the rename's new-code score forces it — with a verbatim-extraction equivalence note in this file.

## What was done

_(nothing yet — the step was opened 2026-09-11 with the coverage measurement above)_

## Validation

_(pending)_
