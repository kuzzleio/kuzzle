# Step 01 — Sprint 0: tooling & foundations

**Status:** ✅ Done
**Date:** 2026-07-12
**PR(s):** #2668 (type quick wins), #2669 (ratchets + strict + ADR + register)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

> Execution trace of the tooling sprint. Frozen — the *mechanisms* it shipped are summarized (stable) in the hub's *Target architecture*; this file keeps how they were built and what the audit found. Live counters are in the hub *Cold start* and [`.migration/`](../../../.migration/).

## Goal

Ship the enforcement machinery (three CI ratchets + progressive strict) and the foundational cleanup, so every later sprint runs under CI guarantees rather than good intentions.

## What was done

### Language ratchet (JS → TS)

Dependency-free mechanism: a script counts the `.js` files under `lib/` and `bin/` and fails if the total exceeds a versioned baseline.

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

- An ESLint rule guides (an explicit error message on creating a `.js` under `lib/`/`bin/`).
- The baseline is decremented on every migration PR (part of the PR's definition of done).

### Progressive strict ratchet

Keep `tsconfig.json` in its current mode for the build; add a `tsconfig.strict.json` that enables `strict: true`.

> ⚠️ **You cannot isolate strict to a subset via `include`** — tsc pulls the entire import graph into the program and checks all of it. Empirical finding (2026-07-12): a `tsconfig.strict.json` with `include: ["lib/types/**/*.ts"]` still reports **1164 errors**, all located in the *imported* files (services, controllers, core…), not in `lib/types`. The progressive scope is therefore managed **by filtering tsc output**, not via `include`.

**Shipped mechanism:**
- [`tsconfig.strict.json`](../../../tsconfig.strict.json): `extends` the base config + `strict: true`, `include` = all of `lib/` + `index.ts`.
- [`.migration/strict-adopted.txt`](../../../.migration/strict-adopted.txt): a **growing list** of files that MUST pass strict (seeded with the **41 already-clean `lib/types` files**).
- [`scripts/strict-check.sh`](../../../scripts/strict-check.sh) (`npm run test:strict`): compiles in strict but **only fails** on errors located in an adopted file. Harden a file → add it to the list → it is guaranteed forever. `npm run test:strict -- --candidates` lists clean files not yet adopted (**35 at start**).
- **Final goal:** the list covers all of `lib/`, then flip `strict` in `tsconfig.json` and remove this machinery.

Recommended flag activation order (least to most painful), if you prefer to enable flags one by one rather than by file list:
`noImplicitThis` → `alwaysStrict` → `strictBindCallApply` → `strictFunctionTypes` → `noImplicitAny` → **`strictNullChecks`** (the costliest, last).
> Note: `noUncheckedIndexedAccess` is **already enabled** — Kuzzle starts from a stricter-than-default baseline on this point.

### `no-explicit-any` ratchet (3rd ratchet — strict's blind spot)

**Finding from the type-debt audit:** **explicit** `: any` / `as any` (~200 sites) are **invisible** to both `noImplicitAny` and `strictNullChecks`. The strict ratchet would therefore pass *over* all this debt without seeing it, while leaving null-safety holes: without a dedicated measure, "strict:true" would give a false sense of safety. Worse, the shared ESLint config (`eslint-plugin-kuzzle` → `lib/configs/typescript.js:13-14`) currently **disables** both `@typescript-eslint/no-explicit-any` and `explicit-module-boundary-types`: nothing enforces typing at the public boundaries.

Two complementary actions:

1. **Re-enable the rule** via a local override (the `*.ts` block of `.eslintrc.json`) — or by bumping `eslint-plugin-kuzzle` — first as `warn` so as not to block immediately.
2. **3rd CI ratchet** `no-explicit-any` as *baseline-and-decrement*: the number of explicit `any` may only decrease.

**Shipped implementation:** the three count ratchets (JS, mocha, any) are a single parameterised script [`scripts/ratchet.sh`](../../../scripts/ratchet.sh) `<js|mocha|any>`, exposed via `npm run ratchet` (all three) and `npm run ratchet:{js,mocha,any}`. Baselines in [`.migration/`](../../../.migration/): `js=111`, `mocha=151`, `any=200`. A metric may only decrease; any improvement must update its baseline in the same PR (`npm run ratchet:any -- --update`).

> **Priority targets (measured concentration):** `lib/core` holds ~48% of the `any`, and **4 files** — `core/shared/store.ts`, `core/plugin/pluginContext.ts`, `service/storage/7/elasticsearch.ts`, `service/storage/8/elasticsearch.ts` — concentrate ~40% of the `: any` and ~55% of the `as any`. Handling them first clears most of the debt. Most of this `any` is **recoverable** (lazy); the genuinely justified `any` is confined to the Elasticsearch client boundary.

### Mocha freeze + ratchet

`test:unit:mocha` keeps running on `dist/test/**/*.test.js`, unchanged. A count ratchet on `test/**/*.test.js` forbids any increase (baseline `mocha=151`). Every new unit test goes to vitest + TS; migrating a legacy spec removes the Mocha `.test.js` and creates the vitest `.spec.ts` (decrements the counter). The full test strategy and the closure conditions live in the hub *Target architecture*.

### Type quick wins (#2668)

- **Bound the `kuzzle-sdk` pin** (`>=7.17.1 <8`) and add a **snapshot test** of the set of names exported at the package root (the SDK re-export is intentional; the floating pin made the public surface non-deterministic).
- Fix the `controllers/adminControlller.type.ts` filename typo (3 "l"s) and its import in `adminController.ts`.
- Complete the `lib/types/index.ts` barrel (`ClientConnection`, `HttpMessage`, `PluginManifest`, `StrategyDefinition`).

## Local decisions / gotchas

- **Strict scope is output-filtered, not `include`-scoped** (the 1164-errors finding above). This shaped the whole strict mechanism.
- **Explicit `any` is invisible to strict** → the 3rd ratchet exists specifically to cover that blind spot.
- The `index.ts` `export * from "kuzzle-sdk"` re-export is **intentional** (PR #1800, 2020) — not an accidental leak — but the unbounded pin was the real risk; hence the bound + snapshot.

## Validation

- CI job `migration-ratchets` runs `npm run ratchet` (js / mocha / any) + `npm run test:strict` on every PR — green.
- Metrics published and trended in CI: remaining `.js` (`lib/` + `bin/`) → target 0; files covered by strict → target 100%; remaining Mocha specs → target 0.

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

Multi-agent audit (findings verified adversarially). Full detail and tracking in the companion register [type-debt-register.md](../type-debt-register.md).

**`index.ts` — `export * from "kuzzle-sdk"` re-export:**
- **Intentional** (PR #1800, 2020): lets plugins import SDK types from `kuzzle`. Not an accidental leak.
- **0 collisions today** (0 `TS2308` diagnostics); a collision would be a **build failure**, not a silent drop.
- **139 of the 258 exported names (~54%)** of `kuzzle` come from the SDK through this one line.
- **Risk (medium):** `"kuzzle-sdk": ">=7.17.1"` was the **only unpinned dependency** (no upper bound) → non-deterministic public surface for consumers (bounded in #2668).
- **2 latent landmines (low):** `KuzzleError` and `Deprecation` (declared in the SDK source, with local twins) would break the build if the SDK ever root-exported them.

**`any` debt:** ~200 explicit sites (182 `: any`, 18 `as any`, + 50 `any[]`, 13 `Record<…,any>`). Concentration: `core` ~48%; 4 files ≈ 40% of the `: any` / 55% of the `as any`. **Invisible to strict** → 3rd ratchet required. The shared ESLint config disables `no-explicit-any` + `explicit-module-boundary-types`.

**`lib/types`:**
- The `lib/types/index.ts` barrel is **incomplete**: 5 public names not re-exported (`ClientConnection`, `HttpMessage`, `PluginManifest`, `StrategyDefinition`, `StartOptions` family); 5 other omissions are legitimate (internal).
- **Filename typo** `controllers/adminControlller.type.ts` (3 "l"s); the import in `adminController.ts:27` depends on it.
- Mixed naming convention (3 `.type.ts` vs 44 `PascalCase.ts`); 13 exported event types never referenced internally.
- `Token`: **3 divergent definitions**; the published `lib/types/Token.ts` contradicts the runtime class.

**SDK coupling:** `JSONObject` imported from the **client SDK** in **~44 files / ~323 uses** (dependency-direction inversion, type-only); **3 definitions** coexist (SDK + 2 identical local ones in storage 7/8).

**Config & storage:** `storage/{7,8}/Elasticsearch.ts` are copy-paste, ES8 has drifted (typed `stats()`/`update()`, ES7 not); `loadConfig()` returns `any`; runtime fields `version` and `internal.allowAllOrigins` are unmodelled.
