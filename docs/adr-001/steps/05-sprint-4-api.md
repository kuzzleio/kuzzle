# Step 05 — Sprint 4: API layer (`lib/api`)

**Status:** 🟦 In progress
**Date:** 2026-07-17
**PR(s):** #2679 (PR A)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/api` (controllers + `funnel`, `httpRoutes`, helpers) to TypeScript. Unblocked by Sprint 3 (models & services), which the API layer builds on. The layer runs under the cucumber functional-test net; the real `strictNullChecks` cost lands on `funnel` and `httpRoutes`, so the sprint is split into three small, reviewable PRs.

## PR breakdown (13 JS files)

- **PR A — clean controllers + helpers (7 files) ✅ (#2679)** — `rateLimiter`, `documentExtractor`, `clusterController`, `realtimeController`, `indexController`, `bulkController`, `collectionController`. JS baseline **79 → 72**.
- **PR B — big controllers + server (3 files) ⬜** — `documentController`, `memoryStorageController`, `serverController`.
- **PR C — dispatch + routing (3 files) ⬜** — `funnel`, `httpRoutes`, `controllers/index` barrel; also removes the `new AdminController.default()` workaround by giving `adminController` an `export =`.

## What was done (PR A)

- 7 files converted with **`export =`** — preserves the CommonJS shape the barrel (`require("./x")`) and the funnel (`new XController()`) depend on — ES imports, and `KuzzleRequest` / `JSONObject` types. **No new explicit `any`**, no behaviour change.
- **Companion fix** — `lib/core/validation/validation.js`: `validate()`'s JSDoc `@param {Request}` resolved to the **DOM** `Request` (the file imports no `Request`), which broke the first TS caller (`realtimeController.publish`). Repointed to `@param {import("../../api/request").KuzzleRequest}` — type-only, no runtime change. This also unblocks `documentController`'s five `validate()` calls ahead of PR B.

## Local decisions / gotchas

- **`serverController` deferred to PR B** — not for its size, but because it reads `global.kuzzle.statistics` (declared **`private`** in `kuzzle.ts`) and `global.kuzzle.config.version` (**unmodelled** — TD-18). Both are cross-layer type fixes; grouping them into PR B keeps a controllers-only PR clean.
- **`global.kuzzle` is typed by the real `Kuzzle` class** (`lib/kuzzle/kuzzle.ts`), not `lib/types/Kuzzle.ts`. `funnel` / `validation` come from still-JS modules, so their members infer to `any` — dynamic access (`funnel.controllers.get("document").validate(...)`) type-checks without casts.
- Converted files are **not** strict-clean yet (nullable `request.context.user`, dynamic ES payloads) → none added to `.migration/strict-adopted.txt`; strict adoption stays a Sprint-9 concern.

## Validation (PR A)

- `tsc --noEmit` clean; `npm run build` green.
- Ratchets: **js 79 → 72** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted files).
- Lint: 0 errors (1 pre-existing `kuzzle/array-foreach` warning in `documentExtractor`, unchanged from the JS original).
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`); vitest green (no specs).
