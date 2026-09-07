# Step 05 — Sprint 4: API layer (`lib/api`)

**Status:** 🟦 Closing — every `lib/api` file is converted; PR E2 ([#2686](https://github.com/kuzzleio/kuzzle/pull/2686)) open, flip to ✅ on merge
**Date:** 2026-07-17 → 2026-09-07
**PR(s):** #2679 (PR A, merged 2026-07-17) · #2680 (PR B, merged 2026-07-17) · #2681 (PR C, merged 2026-07-21) · #2682 (PR D, merged 2026-07-21) · #2685 (PR E1, merged 2026-09-07) · [#2686](https://github.com/kuzzleio/kuzzle/pull/2686) (PR E2, `chore/ts-migration-sprint4-funnel`, open 2026-09-07)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/api` (controllers + `funnel`, `httpRoutes`, helpers) to TypeScript. Unblocked by Sprint 3 (models & services), which the API layer builds on. The layer runs under the cucumber functional-test net; the real `strictNullChecks` cost lands on `funnel` and `httpRoutes`, so the sprint is split into small, reviewable PRs.

## PR breakdown (13 JS files)

- **PR A — clean controllers + rate limiter (6 files) ✅ (#2679, merged 2026-07-17)** — `clusterController`, `realtimeController`, `indexController`, `bulkController`, `collectionController`, `rateLimiter`. JS baseline **79 → 73**.
- **PR B — `documentController` (1 file) ✅ (#2680, merged 2026-07-17)** — clean of deprecated APIs; converts without gate friction (one `for-of` fix). JS baseline **73 → 72**.
- **PR C — `memoryStorageController` (1 file) ✅ (#2681, merged 2026-07-21)** — clean of deprecated APIs; own PR because of its dynamic Redis-command registration + dense module-level helpers + a `rewire`-driven spec. JS baseline **72 → 71**.
- **PR D — `serverController` + `documentExtractor` (2 files) ✅ (#2682, merged 2026-07-21)** — grouped because both call the same deprecated request APIs. On conversion these turned out **not** to be behaviour-preservingly migratable ([TD-20](../type-debt-register.md)), so they were **kept as-is** with `// NOSONAR`; the real (breaking) migration is deferred to a dedicated PR. `serverController` also needed `kuzzle.statistics` made non-`private` + `config.version` modelled (TD-18, partial). JS baseline **71 → 69**.
- **PR E1 — routing table + barrel (2 files) ✅ ([#2685](https://github.com/kuzzleio/kuzzle/pull/2685), merged 2026-09-07)** — `httpRoutes`, `controllers/index` barrel, and the removal of the `new XController.default()` workaround. Split out of PR E so that `httpRoutes`' duplication risk and `funnel`'s `rewire`-driven spec don't share one gate iteration. JS baseline **69 → 67**.
- **PR E2 — `funnel` (1 file) 🟦 ([#2686](https://github.com/kuzzleio/kuzzle/pull/2686), `chore/ts-migration-sprint4-funnel`, open 2026-09-07)** — the dispatch core; its spec (`test/api/funnel/execute.test.js`) drives `rewire(...).__get__("PendingRequest")`, so `PendingRequest` must stay a top-level binding under `export =` (the PR C gotcha). JS baseline **67 → 66** — **`lib/api` is now 100% TypeScript**.

## What was done (PR A)

- 6 files converted with **`export =`** — preserves the CommonJS shape the barrel (`require("./x")`) and the funnel (`new XController()`) depend on — ES imports, and `KuzzleRequest` / `JSONObject` types. **No new explicit `any`**, no behaviour change.
- **Companion fix** — `lib/core/validation/validation.js`: `validate()`'s JSDoc `@param {Request}` resolved to the **DOM** `Request` (the file imports no `Request`), which broke the first TS caller (`realtimeController.publish`). Repointed to `@param {import("../../api/request").KuzzleRequest}` — type-only, no runtime change. Also unblocks `documentController`'s five `validate()` calls ahead of PR B.

## What was done (PR C)

- `memoryStorageController.js` → `.ts` (1023 LOC) via **`export =`** — preserves `require("./memoryStorageController")` in the barrel and `new MemoryStorageController()` in the funnel. Imports rewritten to ES: `import { wrap } from "../../kerror"` then `const kerror = wrap("api", "assert")` keeps **every `kerror.get(...)` call site unchanged**; plus `{ KuzzleRequest, Request }`, `NativeController`, `* as kassert`, `{ isPlainObject, has }`. Public function signatures typed (`request: KuzzleRequest`, `command: string`); the dynamic Redis-command `mapping` table + arg-extraction internals stay inferred (no `strictNullChecks` yet). **No new explicit `any`**, no behaviour change.

## What was done (PR D)

- `serverController.js` → `.ts` (381 LOC) and `documentExtractor.js` → `.ts` (309 LOC), both via **`export =`** — preserves `require(...)` + `new` in the barrel / funnel / their (rewire-free) Mocha specs. ES imports (`import * as os`, `import jsonToYaml = require("json2yaml")` for the untyped module, `import packagejson from "../../../package.json"` matching `config/index.ts`, `import * as kerror`, `{ KuzzleRequest }`, `{ JSONObject }`). Public method params typed `request: KuzzleRequest`; `_buildApiDefinition` and the document extractors modelled with small local interfaces (`ApiActionDefinition`, `ApiRoute`, `ExtractorMethods`/`ExtractorDefinition`) so **no new explicit `any`**. **No behaviour change** — the conversion itself changed zero logic (`git diff -w`); the SonarCloud new-code gate then required behaviour-preserving idiomatic rewrites (see the gate gotcha + Validation).
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
- **PR D gate iteration (the rename re-scored both files as new code, as predicted).** First gate run: **3 New Major + 11 New Minor**. Fixed in-PR, all behaviour-preserving: S2933 (`readonly` on ctor-only fields), S6661 (`Object.assign({}, …)` → object spread), S7772 (`node:os`), S4138 (`for-of` over the **3 simple** index loops — the `tmpDocuments[it]` paired-index loop is not flagged and was kept), S6582 (optional chaining). Kept with `// NOSONAR`: the deprecated `setResult`/`getArrayLegacy` (S1874 → TD-20); `JSON.parse(JSON.stringify(config))` (S7784 — an intentional JSON-safe clone, `structuredClone` would change semantics / can throw); a pre-existing `@todo` (S1135).
- **Prettier vs `NOSONAR` on a multi-line call.** Prettier pushes a trailing `// NOSONAR` onto the next line, where it no longer suppresses the flagged call → S1874 leaked on the multi-line `mGet` `setResult`. Fix: extract the argument to a `const` so the deprecated call **and** its marker fit on one line.

## What was done (PR E1)

- `httpRoutes.js` → `.ts` (1554 LOC, a pure data table) via **`export = routes`** — preserves `module.exports = routes`, so the Mocha spec (`test/core/network/httpRouter/httpRouter.test.js`, which `require`s the compiled module) and `features-legacy/support/api/http.ts` (`import routes from …`, which `esModuleInterop` resolves against `export =`) both keep working. A module-local **`KuzzleHttpRoute`** interface types the table: `verb` as a literal union (`get|post|put|patch|delete` — the five verbs actually present), `controller`/`action`/`path` as `string`, `deprecated?: { since, message }`, and `url?` because it is *not* in the literals — the loop at the end of the file derives it from `path`. **No new explicit `any`**, no behaviour change.
- `controllers/index.js` → `.ts` (the barrel) via `import X = require("./x")` + **`export = { … }`** — identical CJS shape, so `require("../../../api/controllers")` in `impersonatedSdk.js` and the specs is unaffected. `DebugController` keeps its named import (it is the one controller exported as a named class).
- **The `new XController.default()` workaround is gone.** `adminController`, `authController` and `securityController` were the three still using `export default class`, which compiles to `exports.default = X` + an `__esModule` marker — hence the `.default()` at every `new` site. All three now end with `export = X`, matching the other ten controllers, so `funnel.js` instantiates `new AuthController()` / `new SecurityController()` / `new AdminController()` and 10 spec call sites drop their `.default`. **Scope note:** the ADR only planned `adminController`; `auth` and `security` were folded in because they are the *same* workaround on the *same* barrel — fixing one of three would have guaranteed a repeat pass.
- `default.config.ts`: `import httpRoutes from "../api/httpRoutes.js"` → `"../api/httpRoutes"`. Under `moduleResolution: "node"` (node10) TypeScript does **not** rewrite a `.js` specifier to `.ts` — that substitution only exists in the `node16`/`bundler` modes — so the explicit extension would have stopped resolving the moment the file became TS.
- `sonar.cpd.exclusions`: the existing `lib/api/httpRoutes.js` entry retargeted to `.ts` (the route table's near-identical 5-line literals are exactly the pre-existing duplication the rename would re-score as new code).
- **`HttpConfiguration.routes` left as `any`.** Typing it would have been the natural follow-through, but it cascades into `serverController.ts` (which assigns `config.http.routes = undefined` and passes the array to its own local `ApiRoute[]`) — a type refactor of already-converted files, which the conversion standard keeps out of conversion PRs.

- **A `git mv`-less conversion can leave the `.js` behind.** `httpRoutes.ts` was added while `httpRoutes.js` stayed tracked, so both shipped in the same tree. Nothing broke locally — every consumer uses the extensionless specifier (`require("../../lib/api/httpRoutes")`, `import … from "../api/httpRoutes"`), which `allowJs` happily resolves to *either* — but the `js` ratchet counted **68** against a 67 baseline and would have failed CI on the PR. Removed in a follow-up commit; the check is `git ls-files lib/api | grep httpRoutes` (or simply `npm run ratchet:js`) before pushing a conversion.

## What was done (PR E2)

- `funnel.js` → `.ts` (1143 LOC, the dispatch core) via **`export = Funnel`** — preserves `module.exports = Funnel`, so the 8 Mocha specs under `test/api/funnel/` keep their `require("../../../lib/api/funnel")` + `new Funnel()`.
- **`rewire` survives (the PR C gotcha, second occurrence).** `test/api/funnel/execute.test.js` does `rewire(".../lib/api/funnel").__get__("PendingRequest")`. rewire operates on the compiled CJS in `dist/`, so `PendingRequest` (a `class`) and the module-level helpers `capitalize` / `doAction` / `satisfiesMajor` (function declarations) were **kept as top-level bindings**, and `export =` emits `module.exports =` with no `__esModule` wrapper. No spec change; verified by the full suite (3025) in Docker.
- **The controllers barrel is imported with `import apiControllers = require("./controllers")` + destructuring.** PR E1 gave the barrel an `export = { … }` shape, which a **named ES import cannot target** (`TS2497`); the destructuring reproduces the original `const { AdminController, … } = require("./controllers")` exactly. The local binding is named `apiControllers`, not `controllers`, because `getController` shadows that name in a `for…of` (ESLint `@typescript-eslint/no-shadow`).
- Class fields and every public method signature typed — `KuzzleRequest` throughout, plus module-local `ThrottledFn`, `ExecuteCallback`, `SdkRequirements` and `DocumentEventAliases` (= `EventAliases` + the `mirrorList` the funnel builds at construction). `this.controllers` is `Map<string, NativeController>` and `this.logger` is `Logger`.
- **`doAction`'s dynamic `controller[request.input.action](request)` is left untouched.** `noImplicitAny` is off repo-wide (`BaseController._addAction` already relies on it with `this[name] = fn`), so the string index needs no cast and no `any`.
- `loadDocumentEventAliases` rewritten as `for…of` over `Object.entries(documentEventAliases.list)` instead of nested `.forEach` — same semantics, satisfies `noUncheckedIndexedAccess` **without a cast**, and clears two `kuzzle/array-foreach` lint warnings.
- **No new explicit `any`** (ratchet unchanged at 200). JS baseline **67 → 66**; **`lib/api` contains zero `.js`**.

### Cross-layer type-only fixes (split into their own commit)

Typing the funnel surfaced four gaps in already-converted files. All are type-only (zero runtime change), committed separately so the conversion commit stays a pure rename:

- **`IKuzzleConfiguration.internal.allowAllOrigins: boolean` added — [TD-18](../type-debt-register.md) is now closed.** PR D deferred exactly this half of TD-18 to "the conversion of its JS consumers"; `funnel._isOriginAuthorized` is one of them. The field is derived at startup by `lib/config/index.ts`.
- **`HttpConfiguration.accessControlAllowOrigin`: `string` → `string | string[] | RegExp[]`.** `lib/config/index.ts` normalizes the raw string to an array and, when `accessControlAllowOriginUseRegExp` is set, maps it to `RegExp[]`; the declared type described only the raw, pre-normalization form. The funnel narrows the union locally with two casts (`as RegExp[]` / `as string[]`) rather than promoting a discriminated config type — the same containment PR E1 applied to `HttpConfiguration.routes`.
- **`EventAliases.list`: `Record<string, unknown>` → `Record<string, string[]>`** — the `filter()` helper that builds it already returns `Array<string>`.
- **`serverController._buildApiDefinition(controllers: Map<string, { _actions: Iterable<string> }>)`** (was `string[]`) — `_actions` is a `Set<string>`, and the method only iterates it. The mismatch was invisible while `global.kuzzle.funnel` inferred from JS.
- **`realtimeController.validate`** narrows `global.kuzzle.funnel.controllers.get("document")` to `DocumentController` via `import type` (no runtime `require` added, no import cycle).

### Type debt opened — TD-21 (a latent bug, kept as-is)

`Funnel._wrapError(request, error)` calls `this.isNativeController(request)`, but `isNativeController(controller: string)` does `this.controllers.has(controller)` — it expects a controller **name**. A `KuzzleRequest` is never a key of that map, so **the guard is always false** and *every* non-`KuzzleError` is wrapped into a `PluginImplementationError` (`plugin.runtime.unexpected_error`), native controllers included. The intent was plainly `request.input.controller`.

Latent since the JS version; the conversion turned the mismatch into a type error, which is how it surfaced. **Behaviour preserved** with an explicit `request as unknown as string` cast plus an inline comment pointing at TD-21 — fixing it changes observable behaviour, and `handleProcessRequestError.test.js` / `processRequest.test.js` assert the current wrapped error. Real fix deferred to a dedicated behaviour-change PR. This is the third time Sprint 4 has found a pre-existing defect that a conversion PR must *not* fix (cf. TD-20, and the `kuzzle.statistics` visibility in PR D).

## Local decisions / gotchas (PR E2)

- **`export =` on a JS module cannot be imported with `import x = require(...)`.** `import kuzzleStateEnum = require("../kuzzle/kuzzleStateEnum")` fails with `TS2497` because the target is still `.js`; the `allowJs` inference gives it an ES-module-ish shape, so it needs a **default import** (`import kuzzleStateEnum from …`) under `esModuleInterop`. The mirror of the barrel problem above — the right import form depends on the *target's* export shape, not on a repo-wide convention.
- **`require("../config/sdkCompatibility")` resolved to a `.json`.** Converted to `import sdkCompatibility from "../config/sdkCompatibility.json"` — the extension is **required** for `resolveJsonModule`, unlike the `.js` extension PR E1 had to *remove* from `default.config.ts`.
- **The `NativeController` element type is what cascades.** Typing `this.controllers` as `Map<string, NativeController>` (rather than leaving it `any`) is what surfaced the `serverController` and `realtimeController` fixes above. That is the intended direction — but it is why a conversion of a *hub* file costs more than its own LOC suggest: budget for the consumers it newly type-checks.

## Validation (PR E2)

- `tsc --noEmit` clean; `npm run build` green.
- Ratchets: **js 67 → 66** (baseline updated), mocha 151, any 200 — all green. `npm run test:strict` green (46 adopted; `funnel.ts` **not** adopted — nullable `request.context.token` / `request.context.user`, dynamic pipe payloads).
- Lint: 0 errors repo-wide (309 non-blocking `array-foreach`/`no-explicit-any` warnings, none in `funnel.ts`).
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`) — includes the rewire-driven `execute.test.js`; **vitest green (7/7)**; `npm run build` runs green inside both pipelines.
- Error-codes documentation: in sync (`lib/kerror/codes/*.json` untouched).
- **SonarCloud gate: two iterations.** As predicted, the rename re-scored all 1143 lines as new code — the first run failed on **5 New Critical + 13 New Minor**, all pre-existing smells. Duplication was *not* an issue, so `funnel.ts` never needed a `sonar.cpd.exclusions` entry (the pair of near-identical `.catch` blocks in `execute` is ≈2.5% of the file, under the 5% threshold) — and the fix below removed them anyway. All resolved behaviour-preservingly:
  - **S2004 (nesting > 5 levels, ×2)** — `execute`'s throttle callback split into three private methods, each moved **verbatim**: `_executeThrottled` (connection-alive check + `asyncStore.run`), `_dispatch` (`checkRights` → rate limit → action) and `_reportExecutionError` (both `catch` blocks did exactly the same thing — extracting it also killed the duplication). ⚠️ `_dispatch` takes **both** the original request *and* the pipe-modified one: the rate-limit branch inspects `request.input.controller/action` on the **original**, and a `request:beforeExecution` pipe may hand back a different object.
  - **S3776 (cognitive complexity)** — `throttle` 17 → <15 via `_warnOverload()`; `checkRights` 24 → <15 via `_applyCookieAuthToken()`. Both are guard-clause de-nests of code moved verbatim.
  - **13 Minor** — optional chaining ×4 (S6582), `.includes()` over `.indexOf() > -1` ×2, `String#substring` over the deprecated `substr` ×2 (identical for the non-negative indices used here), `SKIP_TOKEN_VERIF_ACTIONS` as a `Set`, `error === undefined` instead of a boolean ternary, class-field initializers instead of constant assignments in the constructor, and the two `@deprecated` `setResult(result, { status })` calls kept with `// NOSONAR` (same [TD-20](../type-debt-register.md) rationale as PR D).
  - **`await` of a non-Promise** — kept with `// NOSONAR`: `_checkSdkVersion` is synchronous, so the `await` only costs a microtask hop and dropping it is *very likely* unobservable — but "very likely" is not the bar for a conversion PR. Deferred to a follow-up.
  - ⚠️ **The PR D `NOSONAR` placement gotcha bit again, in a new shape.** A `// NOSONAR` sitting on a *preceding comment line* does not suppress anything — the marker must be on the **flagged line itself**. The first fix round put the four-line justification (ending in `NOSONAR`) above the `await` and the issue survived; moving the bare marker to the end of the statement and leaving the prose above it fixed it.
- **Unit tests for the gate-fix round ran in CI, not locally** — the host Docker daemon was down and `re2` will not `dlopen` on host arm64. Mocha + vitest green on Node 20/22/24 in the CI matrix.

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
- **SonarCloud Quality Gate GREEN** (on `1d423e526`). First run failed on 3 New Major + 11 New Minor (pre-existing smells re-scored by the rename); all resolved via the behaviour-preserving fixes + `NOSONAR` markers described in the gotchas. `.ts` is coverage-excluded. *(A single `Cluster Monkey Tests` chaos variant flaked once on "not enough nodes connected" — a cluster-formation flake unrelated to the conversion; the first run had all 6 green, and every unit + functional suite is green.)*

## Validation (PR E1)

- `tsc --noEmit` clean.
- Ratchets: **js 69 → 67** (baseline updated), mocha 151, any 200 — all green. Neither converted file adopted into `.migration/strict-adopted.txt` (46 unchanged): the route table is strict-clean but adopting it buys nothing, and the barrel re-exports still-loose controllers.
- Lint: 0 errors repo-wide (376 non-blocking `array-foreach` warnings, none in the converted files).
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`); **vitest green** (7/7); `npm run build` runs green inside that pipeline — which also type-checks `features-legacy/**/*.ts`, confirming `import routes from ".../httpRoutes"` still resolves against `export =` via `esModuleInterop`.
- Error-codes documentation: in sync (`lib/kerror/codes/*.json` untouched). *Note: `pr-preflight`'s error-codes step cannot run on this host — `ts-node` is missing from the partial local `node_modules`, as is the bare `tsc` bin; `npx tsc`, ESLint and the pure-bash ratchets do run.*
- **Pending:** the real SonarCloud Quality Gate on [#2685](https://github.com/kuzzleio/kuzzle/pull/2685). Budget a gate iteration: the `httpRoutes` rename re-scores 1554 lines as new code (duplication pre-empted via `sonar.cpd.exclusions`, smells not). The first CI run on the branch failed **`TS migration - ratchets & strict`** — that was the leftover `.js` above, fixed.
