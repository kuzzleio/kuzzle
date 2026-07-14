# ADR-0001: Incremental migration from JavaScript to TypeScript

**Status:** Proposed
**Date:** 2026-07-12
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io), to be validated collectively
**Scope:** Production code (`lib/`, `bin/`, `index.ts`) and unit tests

---

## Progress & cold-start — updated 2026-07-12

> Living section (maintained by the `/wrapup` skill). **Read this first** to resume the effort in a fresh context.

### Progress table

| Item | Status | PR |
|------|--------|----|
| Type quick wins (filename typo, barrel, bound `kuzzle-sdk` pin) | ✅ | #2668 |
| Sprint 0 — tooling (3 ratchets, progressive strict, ESLint) + CI | ✅ | #2669 |
| ADR + type-debt register | ✅ | #2669 |
| Sprint 1 — `lib/util` warm-up (5 / 12 files) | 🟦 | #2670 |
| Remove dead code `bin/.upgrades` + `bin/.lib` | ✅ | #2671 |
| `/wrapup` skill | ✅ | #2672 |
| Sprint 1 — remaining 7 `lib/util` files | ⬜ | — |
| Sprints 2 → 10 (real bin, api, core, cluster, final strict, tests) | ⬜ | see §6.4 |

Counters (baselines in `.migration/`): **js = 93**, **mocha = 151**, **any = 200**; **strict adopted = 46**.

### Cold start

**Where we are:** the foundation is in place (ADR, register, 3 CI ratchets, progressive strict, ESLint) and the first conversion sprint (`lib/util`) is half done. Everything lives on a stack of not-yet-merged branches based on `2-dev`.

**Branch & PR topology** (= recommended merge order):

```
2-dev
 ├─ #2668  chore/ts-type-debt-quickwins           (independent)
 ├─ #2672  chore/wrapup-skill                      (independent)
 └─ #2669  chore/ts-migration-sprint0-tooling      → merge first
     └─ #2670  chore/ts-migration-sprint1-util     → then
         └─ #2671  chore/ts-rm-dead-upgrade-scripts  → then
             └─ chore/ts-migration-wrapup (this section) → last
```

Merge in stack order; GitHub retargets each child PR onto `2-dev` after its parent merges.

**Next actions:**
1. Review / merge the stack (#2669 → #2670 → #2671 → wrapup) + the two independent PRs (#2668, #2672).
2. Finish Sprint 1: convert the 7 remaining `lib/util` files (`debug`, `deprecate`, `promback`, `stackTrace`, `didYouMean`, `assertType`, `requestAssertions`). `didYouMean` touches `global.NODE_ENV` (already typed in `Global.ts`).
3. Continue with Sprints 2 → 10 (§6.4).

**Key commands:**

```bash
npm run ratchet                     # js / mocha / any (must not increase)
npm run test:strict                 # strict on adopted files
npm run test:strict -- --candidates # clean files not yet adopted
npm run ratchet:js -- --update      # after a reduction: update the baseline
npx tsc --noEmit                    # full type-check; npm run build = tsc + copy-binaries
```

**Conversion convention:** `export =` for a single export (preserves `require()` / default import), named exports for an object module; never `any` / `@ts-ignore` / `!` to "make it pass"; reuse `lib/types`. Details in §6.5.

---

## 1. Context

Kuzzle is a mature codebase (v2.56.0, Node ≥20 <25) whose TypeScript migration is **already underway but unfinished and uneven**. Analysing the current state shows this is not *one* migration but **three intertwined efforts**, which explains why it stalls:

| Axis | Current state | Target |
|------|---------------|--------|
| **1. Language** | ~50% of `lib/` still in JS (94 `.js` files); `bin/` 100% JS (17 files) | 100% `.ts` |
| **2. Unit-test runner** | 168 **Mocha specs in JS** under `test/` (compiled via `dist/`); vitest scaffolded but **empty** (`--passWithNoTests`) | vitest + TS |
| **3. Type strictness** | `strict` **off**; only `noUncheckedIndexedAccess: true` is enabled | `strict: true` |

### Measured breakdown (excluding `node_modules`, `dist`, `coverage`)

- **`lib/` (production):** 94 JS / 145 TS — of which 47 TS are *typedefs* (`lib/types`), so business logic is ~50/50.
- **`lib/core`:** 50 JS files remaining — **the critical core and the largest volume**.
- **`bin/`:** 17 JS, 0 TS — untouched.
- **`features/` + `features-legacy/` (cucumber functional tests):** **100% TS — done ✅**.
- **Unit tests:** 168 `.test.js` (Mocha) specs under `test/`, run from `dist/test/**/*.test.js` after `tsc` compilation.

### The remaining JS files are the hardest

The largest files in the repo are still in JS and concentrate the risk:

| File | LOC | Role |
|------|-----|------|
| [`lib/api/httpRoutes.js`](../lib/api/httpRoutes.js) | 1554 | HTTP routes table |
| [`lib/core/network/protocols/httpwsProtocol.js`](../lib/core/network/protocols/httpwsProtocol.js) | 1254 | HTTP/WS protocol (uWebSockets) |
| [`lib/core/plugin/pluginsManager.js`](../lib/core/plugin/pluginsManager.js) | 1244 | Plugin management |
| [`lib/cluster/node.js`](../lib/cluster/node.js) | 1203 | Cluster node |
| [`lib/core/validation/validation.js`](../lib/core/validation/validation.js) | 1180 | Document validation |
| [`lib/api/controllers/documentController.js`](../lib/api/controllers/documentController.js) | 1165 | Document controller |
| [`lib/api/funnel.js`](../lib/api/funnel.js) | 1143 | API request routing/execution |

### Constraints and forces at play

- **`allowJs: true`** is enabled: JS and TS coexist natively in the `tsc` build. **0 hard `require('./x.js')` imports** in the existing TS → interop is clean, file-by-file conversion does not break import chains.
- **Existing safety net:** functional tests (cucumber) are already in TS and cover the critical paths — they protect refactors of the big files.
- **Double test debt:** the language migration is *blocked by* the runner question. Converting a Mocha test to `.ts` without moving it to vitest only shifts the debt.
- **No prior ADR convention:** this document initialises the `adrs/` folder at the repo root (distinct from `doc/`, reserved for the Kuzzle documentation tool).
- **Why finish now?** A durable hybrid state costs more than either extreme: double tooling (Mocha + vitest), partial typing that gives a false sense of safety, confusing onboarding — and the remaining files are exactly the most critical ones (hence the riskiest to leave untyped).

---

## 2. Decision

We adopt an **incremental migration, driven by a CI ratchet, sequenced by architectural layer**, explicitly handling the three axes in a **decoupled but coordinated** way:

1. **Language (JS → TS)** — **top priority**. Every `.js` file in `lib/` and `bin/` is converted to `.ts`. A **CI ratchet forbids any new `.js`** (the JS file count may only decrease). Migration is organised in **per-layer sprints**, from the leaves toward the core, complemented by the *boy-scout rule* (convert what you touch).

2. **Strictness (progressive)** — the final target is `strict: true`, but **it does not block** the language migration. Strict is adopted **file by file**: a file joins the strict scope only once it passes cleanly. A second CI ratchet guarantees this scope never regresses.

3. **Unit tests (decoupled)** — the **168 Mocha specs in JS are frozen** (they keep running as-is). **Every new test is written in vitest + TS.** Legacy specs are migrated to vitest+TS **progressively**, with a ratchet ensuring the Mocha test count never goes back up. Mocha and its toolchain are removed once the count reaches zero.

**Definition of Done (for the whole effort):**
- [ ] `0` `.js` files in `lib/` and `bin/` (excluding generated files).
- [ ] `strict: true` in the main `tsconfig.json`; `allowJs` removed.
- [ ] `0` Mocha specs; vitest+TS is the only unit runner; mocha/should/rewire/c8 dependencies removed.
- [ ] Cucumber functional tests unchanged (already TS).

---

## 3. Options considered

### 3.1 Overall migration approach

#### Option A — Incremental, ratchet + per-layer sprints *(chosen)*
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Spread out, predictable |
| Risk | Low (small reversible batches) |
| Delivery continuity | Preserved (features in parallel) |

**Pros:** no product *freeze*; each PR stays small and reviewable; the ratchet prevents regressions; value from the first sprints.
**Cons:** long duration; prolonged JS/TS coexistence; requires CI discipline.

#### Option B — Big-bang
| Dimension | Assessment |
|-----------|------------|
| Complexity | Very high |
| Cost | Concentrated, blocking |
| Risk | Very high |
| Delivery continuity | Frozen |

**Pros:** final state reached at once, no coexistence.
**Cons:** unrealistic on 94 prod files + 168 tests including the biggest/most critical; giant non-reviewable PR; freezes other development; regressions hard to isolate. **Rejected.**

#### Option C — Pure opportunistic (boy-scout only, no ratchet)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Diffuse |
| Risk | Low short-term |
| Convergence | **Not guaranteed** |

**Pros:** zero ceremony.
**Cons:** without a ratchet the JS ratio can climb back up; critical files (rarely touched "for nothing") never migrate; no predictable end. **Rejected** in favour of A (which *includes* the boy-scout rule but adds a constraint + planning).

### 3.2 Strictness target

#### Option A — Rename + progressive strict via ratchet *(chosen)*
**Pros:** decouples two difficulties (changing the extension ≠ satisfying `strictNullChecks`); delivers TS value immediately; the big core files don't block on nulls at conversion time.
**Cons:** two ratchets to maintain; a period where some `.ts` are not yet strict.

#### Option B — Full strict immediately
**Pros:** maximum quality from the start, no residual typing debt.
**Cons:** far higher per-file cost, especially on `httpwsProtocol`, `node.js`, `validation`; risk of sloppy conversions (`any`, `!`) just to "make it pass"; strongly slows the first sprints. **Rejected.**

#### Option C — Rename only, strict deferred
**Pros:** fastest path to 100% `.ts`.
**Cons:** little TS value captured (loose typing lets most bugs through); risk that "strict later" never comes. **Rejected** — A keeps the strict target while making it non-blocking.

### 3.3 Handling of unit tests

#### Option A — Decouple: freeze Mocha, everything new in vitest+TS *(chosen)*
**Pros:** unblocks vitest immediately without a test big-bang; prevents writing new Mocha debt; legacy migration at a controlled pace.
**Cons:** two runners coexist temporarily (double config, double CI command).

#### Option B — Couple test ↔ module
**Pros:** consistency (a TS module has its vitest+TS tests).
**Cons:** makes every module conversion heavier (2 efforts per PR), inflates PRs, slows the priority language axis. **Rejected** as a *rule*, but stays **encouraged opportunistically** when a module and its tests are small.

#### Option C — Production only, tests later
**Pros:** focuses on production.
**Cons:** leaves 168 JS files + Mocha as indefinite debt and keeps the double tooling with no end. **Rejected.**

---

## 4. Trade-off analysis

- **Speed vs safety:** the ratchet turns an intention ("we'll migrate") into an invariant checked by CI, without imposing a risky big-bang. That is the central trade-off.
- **Decoupling the 3 axes:** handling them together per file (Option 3.2-B + 3.3-B everywhere) would produce huge PRs and block on the hardest link (strict on a 1200-line file). By decoupling them, each PR has **a single source of complexity**.
- **Leaves → core sequencing:** converting `bin/` and `lib/util` first (few dependencies) breaks in the process and tooling at low risk, before tackling `core` and `cluster` under the functional-test net.
- **Test debt temporarily accepted:** keeping Mocha alive avoids rewriting 168 tests at once, at the cost of a double unit-test CI during the transition — an accepted, bounded cost.

---

## 5. Consequences

**What becomes easier:**
- Safe refactorings (the compiler catches contract breaks) on today's untyped code.
- Onboarding and reading: one language, one unit runner in the end.
- Autocompletion/DX across the whole core, including the big critical files.

**What becomes harder / costlier:**
- Durable CI discipline: three ratchets (JS-count, strict-scope, explicit-any) + one (mocha-count) to maintain.
- Temporary coexistence of two runners and of heterogeneous typing (`.ts` strict and non-strict).
- The big files (`httpwsProtocol`, `node.js`, `pluginsManager`) will need special care and stronger review.

**To revisit:**
- Order of strict flag activation (see §6.2) based on the pain actually observed.
- Target location of vitest specs (co-location vs `tests/` mirror) — see Action Item.
- Removal of `allowJs`, Mocha, and legacy config once the counters reach zero (a closing ADR if needed).

---

## 6. Implementation

### 6.1 Language ratchet (JS → TS)

Dependency-free mechanism: a CI script counts the `.js` files under `lib/` and `bin/` and fails if the total exceeds a versioned baseline.

```bash
# scripts/ratchet-js-count.sh (sketch)
BASELINE=$(cat .migration/js-baseline.txt)   # e.g. 111 (94 lib + 17 bin) at start
CURRENT=$(find lib bin -name '*.js' ! -name '*.d.ts' | wc -l | tr -d ' ')
if [ "$CURRENT" -gt "$BASELINE" ]; then
  echo "❌ JS ratchet: $CURRENT > baseline $BASELINE — no new .js allowed."
  exit 1
fi
[ "$CURRENT" -lt "$BASELINE" ] && echo "✅ Update the baseline to $CURRENT (progress!)"
```

- Add an ESLint rule to guide (an explicit error message on creating a `.js` under `lib/`/`bin/`).
- The baseline is decremented on every migration PR (part of the PR's definition of done).

### 6.2 Strict ratchet (progressive)

Keep `tsconfig.json` in its current mode for the build; add a `tsconfig.strict.json` that enables `strict: true`.

> ⚠️ **You cannot isolate strict to a subset via `include`** — tsc pulls the entire import graph into the program and checks all of it. Empirical finding (2026-07-12): a `tsconfig.strict.json` with `include: ["lib/types/**/*.ts"]` still reports **1164 errors**, all located in the *imported* files (services, controllers, core…), not in `lib/types`. The progressive scope is therefore managed **by filtering tsc output**, not via `include`.

**Shipped mechanism (Sprint 0):**
- [`tsconfig.strict.json`](../tsconfig.strict.json): `extends` the base config + `strict: true`, `include` = all of `lib/` + `index.ts`.
- [`.migration/strict-adopted.txt`](../.migration/strict-adopted.txt): a **growing list** of files that MUST pass strict (seeded with the **41 already-clean `lib/types` files**).
- [`scripts/strict-check.sh`](../scripts/strict-check.sh) (`npm run test:strict`): compiles in strict but **only fails** on errors located in an adopted file. Harden a file → add it to the list → it is guaranteed forever. `npm run test:strict -- --candidates` lists clean files not yet adopted (**35 at start**).
- **Final goal:** the list covers all of `lib/`, then flip `strict` in `tsconfig.json` and remove this machinery.

Recommended flag activation order (least to most painful), if you prefer to enable flags one by one rather than by file list:
`noImplicitThis` → `alwaysStrict` → `strictBindCallApply` → `strictFunctionTypes` → `noImplicitAny` → **`strictNullChecks`** (the costliest, last).
> Note: `noUncheckedIndexedAccess` is **already enabled** — Kuzzle starts from a stricter-than-default baseline on this point.

#### `no-explicit-any` ratchet (3rd ratchet — strict's blind spot)

**Finding from the type-debt audit (2026-07-12):** **explicit** `: any` / `as any` (~200 sites, see Appendix) are **invisible** to both `noImplicitAny` and `strictNullChecks`. The strict ratchet above would therefore pass *over* all this debt without seeing it, while leaving null-safety holes: without a dedicated measure, "strict:true" would give a false sense of safety. Worse, the shared ESLint config (`eslint-plugin-kuzzle` → `lib/configs/typescript.js:13-14`) currently **disables** both `@typescript-eslint/no-explicit-any` and `explicit-module-boundary-types`: nothing enforces typing at the public boundaries.

Two actions, complementary to the strict ratchet:

1. **Re-enable the rule** via a local override (the `*.ts` block of `.eslintrc.json`) — or by bumping `eslint-plugin-kuzzle` — first as `warn` so as not to block immediately.
2. **3rd CI ratchet** `no-explicit-any` as *baseline-and-decrement* (same mechanics as the JS ratchet): the number of explicit `any` may only decrease.

**Shipped implementation (Sprint 0):** the three count ratchets (JS, mocha, any) are a single parameterised script [`scripts/ratchet.sh`](../scripts/ratchet.sh) `<js|mocha|any>`, exposed via `npm run ratchet` (all three) and `npm run ratchet:{js,mocha,any}`. Baselines in [`.migration/`](../.migration/): `js=111`, `mocha=151`, `any=200`. A metric may only decrease; any improvement must update its baseline in the same PR (`npm run ratchet:any -- --update`).

> **Priority targets (measured concentration):** `lib/core` holds ~48% of the `any`, and **4 files** — `core/shared/store.ts`, `core/plugin/pluginContext.ts`, `service/storage/7/elasticsearch.ts`, `service/storage/8/elasticsearch.ts` — concentrate ~40% of the `: any` and ~55% of the `as any`. Handling them first clears most of the debt. Most of this `any` is **recoverable** (lazy); the genuinely justified `any` is confined to the Elasticsearch client boundary.

### 6.3 Decoupling the tests

1. **Clarify the vitest location:** today `vitest.config.ts` has `root: "tests"` but `tests/` only contains a coverage report — no specs. Decide and document: `tests/` mirror (recommended, symmetric with `test/` which we'll empty) **or** co-location `lib/**/*.spec.ts`.
2. **Freeze Mocha:** `test:unit:mocha` keeps running on `dist/test/**/*.test.js`, unchanged.
3. **Mocha ratchet:** a script counting `test/**/*.test.js`, forbidding any increase.
4. **Rule:** every new unit test → vitest + TS. Migrating a legacy spec = removing the Mocha `.test.js` + creating the vitest `.spec.ts` (decrements the counter).
5. **Closure:** Mocha counter at 0 → remove `mocha`, `.mocharc`, `should`, `should-sinon`, `rewire`, `c8`, and the `test:unit:mocha` command.

### 6.4 Sequencing by layer (leaves → core)

| Sprint | Target | JS files | Risk | Net |
|--------|--------|----------|------|-----|
| **0 — Tooling & prerequisites** | 3 CI ratchets (JS / mocha / explicit-any), `tsconfig.strict.json`, baselines; **bound the `kuzzle-sdk` pin** + a snapshot test of the exported surface; process docs | — | Low | — |
| **1 — Warm-up** | `lib/util` (leaf, tested) | 12 | Low | Unit tests |
| **2 — Real bin/ & cleanup** | Delete `bin/.upgrades` + `bin/.lib` (dead code, separate PR); convert `copy-binaries.js` + entrypoints; `bin/plugins` fixtures handled separately | ~5 | Low/medium | Startup + functional |
| **3 — Models & services** | `lib/model`, `lib/service` | ~7 | Low/medium | Unit + functional |
| **4 — API** | `lib/api` (incl. controllers, `funnel.js`) | 13 | Medium | Functional (cucumber) |
| **5 — Core (I)** | `lib/core`: storage, security, realtime | ~20 | Medium/high | Functional |
| **6 — Core (II)** | `lib/core`: validation, plugin, network/protocols | ~20 | **High** | Functional + stronger review |
| **7 — Cluster** | `lib/cluster` (`node.js`, `subscriber.js`) | ~4 | **High** | Functional + cluster tests |
| **8 — Kuzzle root** | `lib/kuzzle`, `index` | ~6 | Medium | Full bootstrap |
| **9 — Final strict** | Grow `tsconfig.strict.json` to 100%, flip `strict:true`, remove `allowJs` | — | Medium | Full CI |
| **10 — Test closure** | Remaining legacy Mocha → vitest, remove Mocha | (168 specs) | Spread out | Coverage |

> Sprints 5–7 run **under the net of the cucumber functional tests** (already TS): that is the main guarantee against regressions on the core.

> **Strict cost centres (audit):** the real cost of `strictNullChecks` does **not** fall on the already-migrated TS, but on the **big files still in JS** (`funnel.js`, `httpwsProtocol.js`, `node.js`, `validation.js`). Corollary: the low `: any` count of `lib/cluster` is **misleading** — it's not-yet-converted JS, not already-clean code. Budget sprints 4, 6 and 7 accordingly (these are the real hardening cost centres).

> **`bin/` scope adjustment (finding 2026-07-12):** the initial "bin/ = 17 files" count was misleading. In reality `bin/.upgrades/**` + `bin/.lib/colorOutput.js` (~12 files) are **dead code** (unreferenced since 2023, no npm `bin` field) → **to be deleted** (separate PR), not migrated; `bin/plugins/available/*` are **test fixtures** loaded as JS at runtime by the functional tests → to be handled separately with care. Only `copy-binaries.js` and `start-kuzzle-server` are real entrypoints. **The warm-up (Sprint 1) is therefore carried by `lib/util`** (12 leaf tested files). The JS ratchet only targets production code (`lib/` + real bin entrypoints).

### 6.5 Conversion standards (per file)

- Rename `.js` → `.ts`; fix imports/exports (`export`/`import` or `export =` depending on the existing CommonJS shape).
- **Forbidden in conversions:** adding unjustified implicit `any`, `@ts-ignore`/`@ts-nocheck` without a comment + ticket, `!` (non-null assertion) to "make it pass". Prefer real typing or `unknown` + narrowing.
- Reuse the existing types in `lib/types`; enrich these definitions rather than duplicating.
- One PR = one layer (or a coherent subset), small and reviewable, which **decrements the JS baseline**.
- No behaviour change in a conversion PR (structural refactor kept separate).

### 6.6 Tracking

Publish three metrics and their trend in CI:
- Remaining `.js` files (`lib/` + `bin/`) — target 0.
- Files covered by `tsconfig.strict.json` — target 100%.
- Remaining Mocha specs — target 0.

---

## 7. Action Items

1. [ ] **Validate this ADR** with the core team (status Proposed → Accepted).
2. [ ] **Sprint 0 — tooling:** create `.migration/js-baseline.txt` + `.migration/any-baseline.txt`, `scripts/ratchet-js-count.sh`, `scripts/ratchet-mocha-count.sh`, `scripts/ratchet-any-count.sh`, `tsconfig.strict.json`, and wire the checks into CI.
3. [ ] **Sprint 0 — SDK prerequisite:** **bound the `kuzzle-sdk` pin** (`>=7.17.1 <8` or `^7.17.1`) and add a **snapshot test** of the set of names exported at the package root (see Appendix — the SDK re-export is intentional, but the floating pin makes the public surface non-deterministic).
4. [ ] **Re-enable `@typescript-eslint/no-explicit-any`** (as `warn`) via a local override in `.eslintrc.json`, a prerequisite of the 3rd ratchet (§6.2).
5. [ ] **Decide the vitest spec location** (`tests/` mirror vs co-location) and record it in `CONTRIBUTING.md`.
6. [ ] Document the **conversion standards** (§6.5) in `CONTRIBUTING.md`.
7. [ ] **Cross-cutting task — owning `JSONObject`:** create `lib/types/JSONObject.ts` (server-owned), codemod the ~44 `from "kuzzle-sdk"` imports, remove the 2 local redefinitions in `storage/{7,8}/Elasticsearch.ts`. Do it during the sprint touching `lib/types`.
8. [ ] **Audit quick wins** (small isolated commits): fix the `adminControlller.type.ts` typo (+ its import), complete the `lib/types/index.ts` barrel (`ClientConnection`, `HttpMessage`, `PluginManifest`, `StrategyDefinition`), reconcile the 3 divergent `Token` definitions.
9. [ ] Run **sprints 1 → 8** (language) in order, one PR per layer.
10. [ ] **Sprint 9:** enable `strict: true`, remove `allowJs`, update `tsconfig.json`.
11. [ ] **Sprint 10:** finish the Mocha → vitest migration, remove Mocha and its dependencies.
12. [ ] Close the ADR (status → *Superseded/Done*) and record the outcome.

---

## Appendix A — Reference figures (2026-07-12)

- `lib/`: 94 JS / 145 TS (of which 47 are typedefs in `lib/types`).
- JS breakdown in `lib/`: `core` 50 · `api` 13 · `util` 12 · `kuzzle` 6 · `cluster` 6 · `service` 4 · `model` 3.
- `bin/`: 17 JS.
- Mocha unit tests: 168 `.test.js`.
- Functional tests: 53 TS (18 `features/` + 35 `features-legacy/`) — migrated.
- `tsconfig.json`: `strict` OFF, `noUncheckedIndexedAccess` ON, `allowJs` ON, `module: commonjs`, `target: es2020`.
- Node: ≥20 <25. TypeScript 5.4.5. Vitest 4 / Mocha 11.

## Appendix B — Type-debt audit findings (2026-07-12)

Multi-agent audit (findings verified adversarially). Full detail and tracking in the companion register [type-debt-register.md](type-debt-register.md).

**`index.ts` — `export * from "kuzzle-sdk"` re-export:**
- **Intentional** (PR #1800, 2020): lets plugins import SDK types from `kuzzle`. Not an accidental leak.
- **0 collisions today** (0 `TS2308` diagnostics); a collision would be a **build failure**, not a silent drop.
- **139 of the 258 exported names (~54%)** of `kuzzle` come from the SDK through this one line.
- **Risk (medium):** `"kuzzle-sdk": ">=7.17.1"` is the **only unpinned dependency** (no upper bound) → non-deterministic public surface for consumers.
- **2 latent landmines (low):** `KuzzleError` and `Deprecation` (declared in the SDK source, with local twins) would break the build if the SDK ever root-exported them.

**`any` debt:** ~200 explicit sites (182 `: any`, 18 `as any`, + 50 `any[]`, 13 `Record<…,any>`). Concentration: `core` ~48%; 4 files ≈ 40% of the `: any` / 55% of the `as any`. **Invisible to strict** → 3rd ratchet required (§6.2). The shared ESLint config disables `no-explicit-any` + `explicit-module-boundary-types`.

**`lib/types`:**
- The `lib/types/index.ts` barrel is **incomplete**: 5 public names not re-exported (`ClientConnection`, `HttpMessage`, `PluginManifest`, `StrategyDefinition`, `StartOptions` family); 5 other omissions are legitimate (internal).
- **Filename typo** `controllers/adminControlller.type.ts` (3 "l"s); the import in `adminController.ts:27` depends on it.
- Mixed naming convention (3 `.type.ts` vs 44 `PascalCase.ts`); 13 exported event types never referenced internally.
- `Token`: **3 divergent definitions**; the published `lib/types/Token.ts` contradicts the runtime class.

**SDK coupling:** `JSONObject` imported from the **client SDK** in **~44 files / ~323 uses** (dependency-direction inversion, type-only); **3 definitions** coexist (SDK + 2 identical local ones in storage 7/8).

**Config & storage:** `storage/{7,8}/Elasticsearch.ts` are copy-paste, ES8 has drifted (typed `stats()`/`update()`, ES7 not); `loadConfig()` returns `any`; runtime fields `version` and `internal.allowAllOrigins` are unmodelled.
