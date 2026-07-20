# Step 05 — Sprint 4: API layer (`lib/api`)

**Status:** 🟦 In progress
**Date:** 2026-07-17
**PR(s):** #2679 (PR A, merged 2026-07-17) · #2680 (PR B, merged 2026-07-17) · #2681 (PR C, `chore/ts-migration-sprint4-api-memorystorage`, in review)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/api` (controllers + `funnel`, `httpRoutes`, helpers) to TypeScript. Unblocked by Sprint 3 (models & services), which the API layer builds on. The layer runs under the cucumber functional-test net; the real `strictNullChecks` cost lands on `funnel` and `httpRoutes`, so the sprint is split into small, reviewable PRs.

## PR breakdown (13 JS files)

- **PR A — clean controllers + rate limiter (6 files) ✅ (#2679, merged 2026-07-17)** — `clusterController`, `realtimeController`, `indexController`, `bulkController`, `collectionController`, `rateLimiter`. JS baseline **79 → 73**.
- **PR B — `documentController` (1 file) ✅ (#2680, merged 2026-07-17)** — clean of deprecated APIs; converts without gate friction (one `for-of` fix). JS baseline **73 → 72**.
- **PR C — `memoryStorageController` (1 file) 🟦 (#2681)** — clean of deprecated APIs; own PR because of its dynamic Redis-command registration + dense module-level helpers + a `rewire`-driven spec. JS baseline **72 → 71**.
- **PR D — `serverController` + `documentExtractor` (2 files) ⬜** — grouped because both need the deprecated request-API migration (`setResult(result, options)` → `response.configure`, `getArrayLegacy`); `serverController` also needs `kuzzle.statistics` made non-private + `config.version` modelled (TD-18).
- **PR E — dispatch + routing (3 files) ⬜** — `funnel`, `httpRoutes`, `controllers/index` barrel; also removes the `new AdminController.default()` workaround by giving `adminController` an `export =`.

## What was done (PR A)

- 6 files converted with **`export =`** — preserves the CommonJS shape the barrel (`require("./x")`) and the funnel (`new XController()`) depend on — ES imports, and `KuzzleRequest` / `JSONObject` types. **No new explicit `any`**, no behaviour change.
- **Companion fix** — `lib/core/validation/validation.js`: `validate()`'s JSDoc `@param {Request}` resolved to the **DOM** `Request` (the file imports no `Request`), which broke the first TS caller (`realtimeController.publish`). Repointed to `@param {import("../../api/request").KuzzleRequest}` — type-only, no runtime change. Also unblocks `documentController`'s five `validate()` calls ahead of PR B.

## What was done (PR C)

- `memoryStorageController.js` → `.ts` (1023 LOC) via **`export =`** — preserves `require("./memoryStorageController")` in the barrel and `new MemoryStorageController()` in the funnel. Imports rewritten to ES: `import { wrap } from "../../kerror"` then `const kerror = wrap("api", "assert")` keeps **every `kerror.get(...)` call site unchanged**; plus `{ KuzzleRequest, Request }`, `NativeController`, `* as kassert`, `{ isPlainObject, has }`. Public function signatures typed (`request: KuzzleRequest`, `command: string`); the dynamic Redis-command `mapping` table + arg-extraction internals stay inferred (no `strictNullChecks` yet). **No new explicit `any`**, no behaviour change.

## Local decisions / gotchas

- **`documentExtractor` deferred to PR B.** Typing its `request` param surfaced two deprecated internal request APIs — `request.setResult(result, options)` (×7, `@deprecated Use request.response.configure`) and `request.getArrayLegacy` (×1, intentional legacy string→array path). Because a renamed `.js`→`.ts` file has **all its lines counted as "new code"** by SonarCloud, those pre-existing deprecations fail the new-code gate (`0 New Issues`). Migrating off them is a behaviour-adjacent refactor the ADR keeps *out* of conversion PRs → do it in PR B, together with `documentController` (which calls the same APIs).
- **`serverController` deferred to PR B** — it reads `global.kuzzle.statistics` (declared **`private`** in `kuzzle.ts`) and `global.kuzzle.config.version` (**unmodelled** — TD-18). Both are cross-layer type fixes; grouping them into PR B keeps a controllers-only PR clean.
- **`global.kuzzle` is typed by the real `Kuzzle` class** (`lib/kuzzle/kuzzle.ts`), not `lib/types/Kuzzle.ts`. `funnel` / `validation` come from still-JS modules, so their members infer to `any` — dynamic access (`funnel.controllers.get("document").validate(...)`) type-checks without casts.
- Converted files are **not** strict-clean yet (nullable `request.context.user`, dynamic ES payloads) → none added to `.migration/strict-adopted.txt`; strict adoption stays a Sprint-9 concern.
- **PR C is the first converted controller whose Mocha spec drives `rewire`.** `memoryStorageController.test.js` does `rewire(".../memoryStorageController.js").__get__("mapping" | "extractArgumentsFromRequest" | …)` and `__set__({ mapping })`. rewire operates on the **compiled CJS in `dist/`**, so keeping `mapping` (a module `let`), the `extractArguments*` (function declarations) and the helper `const`s as top-level bindings — and using `export =` (compiles to `module.exports =`, no `__esModule` wrapper) — keeps every internal `__get__`/`__set__` resolving. No spec change needed; verified by the full suite (3025) in Docker.
- **6 `kuzzle/array-foreach` lint warnings left as-is** (PR C). `.forEach` → `for-of` is a structural refactor the conversion standard defers (two sites would need `return`→`continue` / `.entries()` for the index). Non-blocking: `test:lint` runs without `--max-warnings` (380 warnings, 0 errors repo-wide) and the same warnings already exist in committed conversions (`documentController`, `baseController`, `kuzzleRequest`, …); Sonar does not flag `.forEach`.

## SonarCloud gate note (applies to every conversion PR)

A `.js`→`.ts` rename makes SonarCloud treat the **whole file as new code**, so pre-existing smells *and duplication* are re-scored against the strict new-code gate (`0 New Issues`, `≤ 5% new duplicated lines`). Budget for fixing them in-PR: `readonly` on constructor-only fields (S2933), `for-of` over index loops (S4138), optional chaining (S6582). Two escape hatches for what a conversion must not refactor:
- **Un-removable deprecated-API usage** → split that file out (as for `documentExtractor` in PR D).
- **Pre-existing intra-file duplication** → add the file to `sonar.cpd.exclusions` and defer the dedup (as for `documentController` in PR B — its mExists/mGet and createOrReplace/replace pairs blew the 5% new-code duplication gate; and `memoryStorageController` in PR C — the `mapping` table + the repeated arg-extraction closures).

## Validation (PR A)

- `tsc --noEmit` clean; `npm run build` green.
- Ratchets: **js 79 → 73** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted files).
- Lint: 0 errors, 0 warnings.
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`); vitest green (no specs).
- SonarCloud Quality Gate green (after the `documentExtractor` split + the S2933/S4138 fixes above).

## Validation (PR C)

- `tsc --noEmit` clean.
- Ratchets: **js 72 → 71** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted; file **not** adopted — dynamic payloads).
- Lint: 0 errors (6 non-blocking `array-foreach` warnings, see gotchas).
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`) — includes the rewire-driven spec; `npm run build` runs green inside that pipeline.
- SonarCloud gate: pre-empted the new-code duplication by adding `memoryStorageController.ts` to `sonar.cpd.exclusions`; no S2933/S4138/S6582 candidates; `.ts` is coverage-excluded. **Real gate to be confirmed on push.**
