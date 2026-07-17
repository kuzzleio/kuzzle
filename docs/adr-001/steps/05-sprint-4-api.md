# Step 05 — Sprint 4: API layer (`lib/api`)

**Status:** 🟦 In progress
**Date:** 2026-07-17
**PR(s):** #2679 (PR A) · #2680 (PR B)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/api` (controllers + `funnel`, `httpRoutes`, helpers) to TypeScript. Unblocked by Sprint 3 (models & services), which the API layer builds on. The layer runs under the cucumber functional-test net; the real `strictNullChecks` cost lands on `funnel` and `httpRoutes`, so the sprint is split into small, reviewable PRs.

## PR breakdown (13 JS files)

- **PR A — clean controllers + rate limiter (6 files) ✅ (#2679)** — `clusterController`, `realtimeController`, `indexController`, `bulkController`, `collectionController`, `rateLimiter`. JS baseline **79 → 73**.
- **PR B — `documentController` (1 file) ✅ (#2680)** — clean of deprecated APIs; converts without gate friction (one `for-of` fix). JS baseline **73 → 72**.
- **PR C — `memoryStorageController` (1 file) ⬜** — clean of deprecated APIs; own PR because of its dynamic Redis-command registration + dense module-level helpers.
- **PR D — `serverController` + `documentExtractor` (2 files) ⬜** — grouped because both need the deprecated request-API migration (`setResult(result, options)` → `response.configure`, `getArrayLegacy`); `serverController` also needs `kuzzle.statistics` made non-private + `config.version` modelled (TD-18).
- **PR E — dispatch + routing (3 files) ⬜** — `funnel`, `httpRoutes`, `controllers/index` barrel; also removes the `new AdminController.default()` workaround by giving `adminController` an `export =`.

## What was done (PR A)

- 6 files converted with **`export =`** — preserves the CommonJS shape the barrel (`require("./x")`) and the funnel (`new XController()`) depend on — ES imports, and `KuzzleRequest` / `JSONObject` types. **No new explicit `any`**, no behaviour change.
- **Companion fix** — `lib/core/validation/validation.js`: `validate()`'s JSDoc `@param {Request}` resolved to the **DOM** `Request` (the file imports no `Request`), which broke the first TS caller (`realtimeController.publish`). Repointed to `@param {import("../../api/request").KuzzleRequest}` — type-only, no runtime change. Also unblocks `documentController`'s five `validate()` calls ahead of PR B.

## Local decisions / gotchas

- **`documentExtractor` deferred to PR B.** Typing its `request` param surfaced two deprecated internal request APIs — `request.setResult(result, options)` (×7, `@deprecated Use request.response.configure`) and `request.getArrayLegacy` (×1, intentional legacy string→array path). Because a renamed `.js`→`.ts` file has **all its lines counted as "new code"** by SonarCloud, those pre-existing deprecations fail the new-code gate (`0 New Issues`). Migrating off them is a behaviour-adjacent refactor the ADR keeps *out* of conversion PRs → do it in PR B, together with `documentController` (which calls the same APIs).
- **`serverController` deferred to PR B** — it reads `global.kuzzle.statistics` (declared **`private`** in `kuzzle.ts`) and `global.kuzzle.config.version` (**unmodelled** — TD-18). Both are cross-layer type fixes; grouping them into PR B keeps a controllers-only PR clean.
- **`global.kuzzle` is typed by the real `Kuzzle` class** (`lib/kuzzle/kuzzle.ts`), not `lib/types/Kuzzle.ts`. `funnel` / `validation` come from still-JS modules, so their members infer to `any` — dynamic access (`funnel.controllers.get("document").validate(...)`) type-checks without casts.
- Converted files are **not** strict-clean yet (nullable `request.context.user`, dynamic ES payloads) → none added to `.migration/strict-adopted.txt`; strict adoption stays a Sprint-9 concern.

## SonarCloud gate note (applies to every conversion PR)

A `.js`→`.ts` rename makes SonarCloud treat the **whole file as new code**, so pre-existing smells are re-scored against the strict new-code gate (`0 New Issues`). Budget for fixing them in-PR: `readonly` on constructor-only fields (S2933), `for-of` over index loops (S4138), optional chaining (S6582). When the only remaining smells are **deprecated-API usages that can't be removed without changing behaviour**, split that file out rather than suppressing (as done here for `documentExtractor`).

## Validation (PR A)

- `tsc --noEmit` clean; `npm run build` green.
- Ratchets: **js 79 → 73** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted files).
- Lint: 0 errors, 0 warnings.
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`); vitest green (no specs).
- SonarCloud Quality Gate green (after the `documentExtractor` split + the S2933/S4138 fixes above).
