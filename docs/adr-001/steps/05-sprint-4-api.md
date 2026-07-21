# Step 05 — Sprint 4: API layer (`lib/api`)

**Status:** 🟦 In progress
**Date:** 2026-07-17
**PR(s):** #2679 (PR A, merged 2026-07-17) · #2680 (PR B, merged 2026-07-17) · #2681 (PR C, merged 2026-07-21) · #2682 (PR D, `chore/ts-migration-sprint4-api-server`, open 2026-07-21)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/api` (controllers + `funnel`, `httpRoutes`, helpers) to TypeScript. Unblocked by Sprint 3 (models & services), which the API layer builds on. The layer runs under the cucumber functional-test net; the real `strictNullChecks` cost lands on `funnel` and `httpRoutes`, so the sprint is split into small, reviewable PRs.

## PR breakdown (13 JS files)

- **PR A — clean controllers + rate limiter (6 files) ✅ (#2679, merged 2026-07-17)** — `clusterController`, `realtimeController`, `indexController`, `bulkController`, `collectionController`, `rateLimiter`. JS baseline **79 → 73**.
- **PR B — `documentController` (1 file) ✅ (#2680, merged 2026-07-17)** — clean of deprecated APIs; converts without gate friction (one `for-of` fix). JS baseline **73 → 72**.
- **PR C — `memoryStorageController` (1 file) ✅ (#2681, merged 2026-07-21)** — clean of deprecated APIs; own PR because of its dynamic Redis-command registration + dense module-level helpers + a `rewire`-driven spec. JS baseline **72 → 71**.
- **PR D — `serverController` + `documentExtractor` (2 files) ✅ (#2682, open 2026-07-21)** — grouped because both call the same deprecated request APIs. On conversion these turned out **not** to be behaviour-preservingly migratable ([TD-20](../type-debt-register.md)), so they were **kept as-is** with `// NOSONAR`; the real (breaking) migration is deferred to a dedicated PR. `serverController` also needed `kuzzle.statistics` made non-`private` + `config.version` modelled (TD-18, partial). JS baseline **71 → 69**.
- **PR E — dispatch + routing (3 files) ⬜** — `funnel`, `httpRoutes`, `controllers/index` barrel; also removes the `new AdminController.default()` workaround by giving `adminController` an `export =`.

## What was done (PR A)

- 6 files converted with **`export =`** — preserves the CommonJS shape the barrel (`require("./x")`) and the funnel (`new XController()`) depend on — ES imports, and `KuzzleRequest` / `JSONObject` types. **No new explicit `any`**, no behaviour change.
- **Companion fix** — `lib/core/validation/validation.js`: `validate()`'s JSDoc `@param {Request}` resolved to the **DOM** `Request` (the file imports no `Request`), which broke the first TS caller (`realtimeController.publish`). Repointed to `@param {import("../../api/request").KuzzleRequest}` — type-only, no runtime change. Also unblocks `documentController`'s five `validate()` calls ahead of PR B.

## What was done (PR C)

- `memoryStorageController.js` → `.ts` (1023 LOC) via **`export =`** — preserves `require("./memoryStorageController")` in the barrel and `new MemoryStorageController()` in the funnel. Imports rewritten to ES: `import { wrap } from "../../kerror"` then `const kerror = wrap("api", "assert")` keeps **every `kerror.get(...)` call site unchanged**; plus `{ KuzzleRequest, Request }`, `NativeController`, `* as kassert`, `{ isPlainObject, has }`. Public function signatures typed (`request: KuzzleRequest`, `command: string`); the dynamic Redis-command `mapping` table + arg-extraction internals stay inferred (no `strictNullChecks` yet). **No new explicit `any`**, no behaviour change.

## What was done (PR D)

- `serverController.js` → `.ts` (381 LOC) and `documentExtractor.js` → `.ts` (309 LOC), both via **`export =`** — preserves `require(...)` + `new` in the barrel / funnel / their (rewire-free) Mocha specs. ES imports (`import * as os`, `import jsonToYaml = require("json2yaml")` for the untyped module, `import packagejson from "../../../package.json"` matching `config/index.ts`, `import * as kerror`, `{ KuzzleRequest }`, `{ JSONObject }`). Public method params typed `request: KuzzleRequest`; `_buildApiDefinition` and the document extractors modelled with small local interfaces (`ApiActionDefinition`, `ApiRoute`, `ExtractorMethods`/`ExtractorDefinition`) so **no new explicit `any`**. **0 logic lines changed** (verified with `git diff -w`).
- **Cross-layer type fixes** (needed to compile, both type-only at runtime): `kuzzle.statistics` `private` → `public` (`lib/kuzzle/kuzzle.ts`) — the `private` never matched the cross-class runtime access `global.kuzzle.statistics.getStats(...)`; and `version: string` added to `IKuzzleConfiguration` (TD-18 partial) for `serverController`'s `global.kuzzle.config.version` read.
- **Deprecated request APIs kept, not migrated (TD-20).** `documentExtractor` (7× `setResult(result, { status })`) and both files (`getArrayLegacy`) keep their `@deprecated` calls with `// NOSONAR` — see the gotcha below; migrating them changes behaviour, which a conversion PR must not do.

## Local decisions / gotchas

- **`documentExtractor` deferred to PR B.** Typing its `request` param surfaced two deprecated internal request APIs — `request.setResult(result, options)` (×7, `@deprecated Use request.response.configure`) and `request.getArrayLegacy` (×1, intentional legacy string→array path). Because a renamed `.js`→`.ts` file has **all its lines counted as "new code"** by SonarCloud, those pre-existing deprecations fail the new-code gate (`0 New Issues`). Migrating off them is a behaviour-adjacent refactor the ADR keeps *out* of conversion PRs → do it in PR B, together with `documentController` (which calls the same APIs).
- **`serverController` deferred to PR B** — it reads `global.kuzzle.statistics` (declared **`private`** in `kuzzle.ts`) and `global.kuzzle.config.version` (**unmodelled** — TD-18). Both are cross-layer type fixes; grouping them into PR B keeps a controllers-only PR clean.
- **`global.kuzzle` is typed by the real `Kuzzle` class** (`lib/kuzzle/kuzzle.ts`), not `lib/types/Kuzzle.ts`. `funnel` / `validation` come from still-JS modules, so their members infer to `any` — dynamic access (`funnel.controllers.get("document").validate(...)`) type-checks without casts.
- Converted files are **not** strict-clean yet (nullable `request.context.user`, dynamic ES payloads) → none added to `.migration/strict-adopted.txt`; strict adoption stays a Sprint-9 concern.
- **PR C is the first converted controller whose Mocha spec drives `rewire`.** `memoryStorageController.test.js` does `rewire(".../memoryStorageController.js").__get__("mapping" | "extractArgumentsFromRequest" | …)` and `__set__({ mapping })`. rewire operates on the **compiled CJS in `dist/`**, so keeping `mapping` (a module `let`), the `extractArguments*` (function declarations) and the helper `const`s as top-level bindings — and using `export =` (compiles to `module.exports =`, no `__esModule` wrapper) — keeps every internal `__get__`/`__set__` resolving. No spec change needed; verified by the full suite (3025) in Docker.
- **6 `kuzzle/array-foreach` lint warnings left as-is** (PR C). `.forEach` → `for-of` is a structural refactor the conversion standard defers (two sites would need `return`→`continue` / `.entries()` for the index). Non-blocking: `test:lint` runs without `--max-warnings` (380 warnings, 0 errors repo-wide) and the same warnings already exist in committed conversions (`documentController`, `baseController`, `kuzzleRequest`, …); Sonar does not flag `.forEach`.
- **PR D — the "deprecated request-API migration" planned for this PR turned out to be a behaviour change, so it was deferred (TD-20), not done.** `setResult(result, { status })` has no drop-in: `response.configure` doesn't set the result, and the `response.result =` setter routes back through `setResult(result)` with no options → **forces status 200** (dropping a preserved 201). `getArrayLegacy` → `getArray` is breaking: `getArray` throws `invalid_type` on a non-JSON-array string, while legacy falls back to `value.split(",")` — so `?services=internalCache` / `?ids=a,b` would break. Both kept as-is with `// NOSONAR` (`typescript:S1874`); the real migration is a dedicated behaviour-change PR. This **corrects the original PR D plan** recorded in the hub/register.
- **Neither PR D spec uses `rewire`** — `documentExtractor.test.js` and `serverController.test.js` just `require` + `new`, so `export =` is a clean fit (no repeat of the PR C `__get__`/`__set__` concern).
- **PR D added no explicit `any` despite dynamic JS-boundary inputs.** `_buildApiDefinition` takes `Map<string, { _actions: string[] }>` + a local `ApiRoute[]`; `config` from `JSON.parse(JSON.stringify(...))` stays `any` at the boundary (justified), and `Object.entries<{ backend?: string }>(config.services)` types the loop variable without a cast.

## SonarCloud gate note (applies to every conversion PR)

A `.js`→`.ts` rename makes SonarCloud treat the **whole file as new code**, so pre-existing smells *and duplication* are re-scored against the strict new-code gate (`0 New Issues`, `≤ 5% new duplicated lines`). Budget for fixing them in-PR (all behaviour-preserving): `readonly` on constructor-only fields (S2933), `for-of` over index loops (S4138), optional chaining (S6582), `.includes()` instead of `.indexOf() !== -1`, a single `Array#push(...items)` instead of consecutive pushes, and a guard-clause early-return to shave **cognitive complexity** (S3776) — PR C hit the last three. Two escape hatches for what a conversion must not refactor:
- **Un-removable deprecated-API usage** → split that file out (as for `documentExtractor` in PR D), then **keep the call with `// NOSONAR`** if migrating it would change behaviour (PR D: `setResult`/`getArrayLegacy`, [TD-20](../type-debt-register.md)).
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
- SonarCloud gate: the pre-empted `sonar.cpd.exclusions` entry held (no duplication failure), but the first run flagged **1 New Critical** (S3776 cognitive complexity 16>15 on `extractArgumentsFromRequestForSort`) + **5 New Minor** (`.indexOf()!==-1` ×3 → `.includes()`; consecutive `Array#push()` ×2 → one call). All fixed in-PR (idiomatic rewrites + a guard-clause de-nest of the sort builder), no behaviour change; re-validated (tsc, lint, full mocha 3025). `.ts` is coverage-excluded.

## Validation (PR D)

- `tsc --noEmit` clean.
- Ratchets: **js 71 → 69** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted; neither converted file adopted — nullable `request` fields / dynamic payloads).
- Lint: 0 errors on both files (1 non-blocking `array-foreach` warning in `documentExtractor`'s module-level reduce, deferred like PR C); repo-wide `npm run test:lint` 0 errors.
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`); **vitest green** (no specs) in Docker; `npm run build` runs green inside both pipelines.
- SonarCloud gate: _(filled after the gate resolves — expected concern is `typescript:S1874` on the kept deprecated calls, pre-empted with `// NOSONAR`)._
