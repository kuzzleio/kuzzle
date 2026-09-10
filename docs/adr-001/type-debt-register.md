# Type-debt register — Kuzzle

> Companion to [ADR-0001](ADR-0001-migration-typescript.md). It details and tracks the findings of the **2026-07-12** type-debt audit (multi-agent audit, findings verified adversarially). The ADR sets the *strategy*; this register tracks the *execution*.

**Effort legend:** XS (< 1h) · S (~½ day) · M (1–3 d) · L (> 3 d)
**Status:** ⬜ to do · 🟦 in progress · ✅ done

## Overview

| ID | Sev. | Theme | Finding | Effort | Status |
|----|------|-------|---------|--------|--------|
| [TD-01](#td-01) | 🟠 med | SDK | Unbounded `kuzzle-sdk` pin (only floating dep) | XS | ✅ |
| [TD-02](#td-02) | 🟠 med | Enforcement | No `strict` + ESLint disables `no-explicit-any` | M | 🟦 |
| [TD-03](#td-03) | 🟠 med | Enforcement | Explicit `any` invisible to strict → 3rd ratchet required | S+M | ✅ |
| [TD-04](#td-04) | 🟠 med | `lib/types` | Barrel omits `ClientConnection`/`HttpMessage` (public events) | XS | ✅ |
| [TD-05](#td-05) | 🟡 low | `lib/types` | Barrel omits `PluginManifest`/`StrategyDefinition`/`StartOptions` | XS | 🟦 |
| [TD-06](#td-06) | 🟡 low | `lib/types` | Filename typo `adminControlller.type.ts` (3 "l"s) | XS | ✅ |
| [TD-07](#td-07) | 🟡 low | `lib/types` | `Token`: 3 divergent definitions | S | ⬜ |
| [TD-08](#td-08) | 🟡 low | `lib/types` | Mixed naming `.type.ts` vs `PascalCase.ts`; 13 dead event types | S | ⬜ |
| [TD-09](#td-09) | 🟡 low | SDK | `JSONObject` imported from the client SDK (~44 files / ~323 uses) | M | ⬜ |
| [TD-10](#td-10) | 🟡 low | SDK | 3 divergent `JSONObject` definitions | S | ⬜ |
| [TD-11](#td-11) | 🟡 low | `any` | `core/shared/store.ts`: 28 recoverable `: any` | S | ⬜ |
| [TD-12](#td-12) | 🟡 low | `any` | `core/plugin/pluginContext.ts`: `any` on the public plugin API | S | ⬜ |
| [TD-13](#td-13) | 🟡 low | `any` | ES services: densest `as any` cluster + copy-paste | M | ⬜ |
| [TD-14](#td-14) | 🟡 low | Enforcement | Cosmetic request/response getters (untyped private index + JS) | M | ⬜ |
| [TD-15](#td-15) | 🟡 low | Enforcement | Implicit-any constructors on public request/response classes | S | ⬜ |
| [TD-16](#td-16) | 🟡 low | Storage | ES7/ES8 copy-paste; ES8 drifted (typed `stats()`/`update()`) | S | ⬜ |
| [TD-17](#td-17) | 🟡 low | Config | `loadConfig()` returns `any` | XS | ⬜ |
| [TD-18](#td-18) | 🟡 low | Config | Runtime fields `version` / `internal.allowAllOrigins` unmodelled | XS | ✅ |
| [TD-19](#td-19) | 🟡 low | Config | `any` in config sections (`internal.hash`, `cluster.interface`, `http.routes`…) | S | ⬜ |
| [TD-20](#td-20) | 🟡 low | Deprecation | Deprecated request APIs (`setResult(result, options)`, `getArrayLegacy`) kept in converted controllers — [#2688](https://github.com/kuzzleio/kuzzle/issues/2688) | S | ⬜ |
| [TD-21](#td-21) | 🟠 medium | Correctness | `funnel._wrapError` passes a *request* to `isNativeController(name)` — guard always false — [#2687](https://github.com/kuzzleio/kuzzle/issues/2687) | XS | ✅ → [TD-27](#td-27) |
| [TD-22](#td-22) | 🟠 med | `any` | `memoryStorageController.ts`: converted without typing — 54 implicit-`any` sites (+37 cascades), 122 strict errors — [#2690](https://github.com/kuzzleio/kuzzle/issues/2690) | M | ✅ |
| [TD-23](#td-23) | 🟡 low | Duplication | `sonar.cpd.exclusions` growing into permanent, untracked debt (5 → 4 files) — [#2691](https://github.com/kuzzleio/kuzzle/issues/2691) | M | ✅ [#2701](https://github.com/kuzzleio/kuzzle/pull/2701) |
| [TD-24](#td-24) | 🟠 med | Enforcement | SonarCloud measures **no coverage on `.ts`** — every conversion voids its own coverage gate — [#2692](https://github.com/kuzzleio/kuzzle/issues/2692) | S | ✅ |
| [TD-25](#td-25) | 🟡 low | Dependencies | `@types/debug` is narrower than `debug`'s runtime — adopting it costs 3 casts, so `util/debug.ts` stays out of strict | S | ⬜ |
| [TD-26](#td-26) | 🟡 low | Correctness | 5 `await`s of a non-Promise, kept for timing parity across conversions (`NOSONAR: TD-26`) | XS | ✅ |
| [TD-27](#td-27) | 🟠 med | Correctness | TD-21's guard fix sits on a shared funnel: plugin pipes changed too, and the unwrapped error loses its `id`/`code` — [#2703](https://github.com/kuzzleio/kuzzle/issues/2703) | S | ✅ [#2709](https://github.com/kuzzleio/kuzzle/pull/2709) |
| [TD-28](#td-28) | 🟠 med | `any` | `memoryStorageController`'s class-wide index signature untypes the whole controller — [#2704](https://github.com/kuzzleio/kuzzle/issues/2704) | XS | ✅ [#2710](https://github.com/kuzzleio/kuzzle/pull/2710) |
| [TD-29](#td-29) | 🟡 low | Enforcement | Nothing charges for `@ts-ignore` (4 in `lib/`, 2 undocumented) — [#2707](https://github.com/kuzzleio/kuzzle/issues/2707) | S | ✅ [#2712](https://github.com/kuzzleio/kuzzle/pull/2712) |
| [TD-30](#td-30) | 🟡 low | Enforcement | `bin/copy-binaries.js` miscounted as a plugin fixture: the `js` floor is 3, not 4 — [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) | XS | ✅ [#2713](https://github.com/kuzzleio/kuzzle/pull/2713) |
| [TD-31](#td-31) | 🟡 low | Duplication | TD-23's helpers take loose `methodName`/`action`, which can disagree — [#2706](https://github.com/kuzzleio/kuzzle/issues/2706) | XS | ✅ [#2711](https://github.com/kuzzleio/kuzzle/pull/2711) |
| [TD-32](#td-32) | 🟡 low | Enforcement | `tsconfig.json`'s `rootDir` sits outside `compilerOptions` and has never applied — [#2714](https://github.com/kuzzleio/kuzzle/issues/2714) | XS | ✅ [#2716](https://github.com/kuzzleio/kuzzle/pull/2716) |
| [TD-33](#td-33) | 🟠 med | Enforcement | One flaky functional variant blocks unrelated PRs; cluster readiness is not gated — [#2715](https://github.com/kuzzleio/kuzzle/issues/2715) | M | ⬜ |
| [TD-34](#td-34) | 🟠 med | Correctness | `Profile._hash`'s new overload declared `string \| false`; the patch (`global.kuzzle.hash`) returns a `number`, and `profileRepository` still cast the site to `any` | XS | ✅ |
| [TD-35](#td-35) | 🟠 med | Enforcement | `npm run build` ran `copy-binaries` through `tsx` (esbuild native binary) and nothing asserted its payload — a broken copy step shipped a `.proto`-less package | XS | ✅ |
| [TD-36](#td-36) | 🔴 high | Enforcement | TD-35's payload gate never sees the published artifact: `npm publish` re-runs `prepublishOnly` → `build`, which wipes the `dist/` the workflow step verified | XS | ✅ |
| [TD-37](#td-37) | 🟠 med | Enforcement | TD-35's gate was a hand-written 6-path list sold as "every path `files` promises" — the error-code catalogue (`dist/lib/**/*.json`) was not among them | XS | ✅ |

**Quick wins (handled first, cf. ADR step 01 — type quick wins):** TD-01, TD-04, TD-05, TD-06.

---

## SDK — kuzzle-sdk boundary

### TD-01
**Unbounded `kuzzle-sdk` pin — non-deterministic public surface** · 🟠 medium · `package.json:46`

`"kuzzle-sdk": ">=7.17.1"` is the **only** unpinned dependency in `package.json` (the ~41 others are exact-pinned). Combined with `export * from "kuzzle-sdk"` in `index.ts:19`, **139 of the 258 names** exported by the `kuzzle` package (~54%) come from the SDK. With no upper bound, npm may resolve a future major (8.x, 9.x): the public surface of `kuzzle` then silently changes for a consumer resolving afresh (the lockfile only protects the internal build).

- **Today, 0 collisions** (0 `TS2308` diagnostics); the re-export is **intentional** (PR #1800, 2020 — to let plugins import SDK types from `kuzzle`), not a leak.
- **Reco:** bound it (`>=7.17.1 <8` or `^7.17.1`) + add a **snapshot test** of the set of names exported at the root, to catch in CI any SDK bump that adds/removes/collides a name.
- **ADR link:** step 01 (Sprint 0 — `kuzzle-sdk` pin).
- **✅ Partially done (2026-07-12, PR #2668):** bound applied (`>=7.17.1 <8.0.0`), package.json + lockfile synced, resolved version unchanged. **Remaining ⬜:** the snapshot test of the exported surface.

### TD-09
**`JSONObject` imported from the client SDK — dependency inversion** · 🟡 low · `lib/types/KuzzleDocument.ts:1` (representative)

`JSONObject` (`Record<PropertyKey, any>` on the SDK side) is imported from `kuzzle-sdk` by **~44 files / ~323 uses**, across every layer (api/request, kerror, core/security, core/realtime, cluster, types/config, util, kuzzle/Logger). Yet the server is the source of truth for the concepts the client SDK mirrors: sourcing the most-used primitive *from* the client is an inversion (conceptual; the import is type-only, erased at compile time).

- **Reco:** `lib/types/JSONObject.ts` (server-owned) + codemod the imports (name/structure unchanged → no call-site edits). Keep the genuine SDK contracts (`RequestPayload`, `KuzzleEventEmitter`, etc., confined to `embeddedSdk.ts`/`funnelProtocol.ts`) imported from the SDK.
- **ADR link:** ADR Open points — own `JSONObject` server-side.

### TD-10
**Three divergent `JSONObject` definitions** · 🟡 low · `lib/types/storage/7/Elasticsearch.ts:21`, `lib/types/storage/8/Elasticsearch.ts:48`

The SDK defines `type JSONObject = Record<PropertyKey, any>`; both storage files redeclare `export interface JSONObject { [key: string]: any }` (interface, string keys only) without importing the SDK. Non-equivalent semantics (union alias vs mergeable interface; `symbol` keys). No root collision only because those 2 files are not in the barrel.

- **Reco:** consolidate to a single server-owned definition (TD-09) and delete the 2 redefinitions.

### TD-26
**`await` of a non-Promise, kept for timing parity** · 🟡 low · `NOSONAR: TD-26`

Five call sites `await` a value that is not thenable. Every one predates the migration; the conversions merely made SonarCloud score them (`typescript:S4123`, Critical), and each was **kept** because removing an `await` shifts the enclosing async function's resolution by a microtask — which a conversion PR must not do (the bar set in PR E2: *"very likely unobservable" is not good enough*).

| Site | Awaited value | Opened by |
|------|---------------|-----------|
| `funnel._executeThrottled` → `_checkSdkVersion()` | a synchronous method | PR E2 |
| `roleRepository.load` → `this.roles.set(...)` | `Map.set` returns the Map | sprint 5 PR G1 |
| `roleRepository.validateAndSaveRole` → `this.roles.set(...)` | idem | sprint 5 PR G1 |
| `security/index.init` → `this.role.init()` | `RoleRepository.init()` is not `async` | sprint 5 PR G2 |
| `security/index.init` → `this.profile.init()` | `ProfileRepository.init()` is not `async` | sprint 5 PR G2 |

They are individually trivial and collectively worth one pass: the markers are accumulating one or two per conversion PR, and each one is a Critical the next reviewer has to re-justify.

- **Reco:** a single behaviour-change PR that drops all five `await`s (and the markers), with a note that the only observable effect is one microtask of resolution timing per site. `grep -rn "NOSONAR: TD-26" lib/` lists them.
- **Trigger:** independent of the migration sprints; a good companion to [TD-20](#td-20)'s deprecated-API cleanup, which is the same shape of "conversion found it, conversion must not fix it".
- **✅ Done (2026-09-09, #2697):** all five `await`s and their `NOSONAR: TD-26` markers dropped. The only observable effect is one microtask of resolution timing per site; `funnel._checkSdkVersion` still throws inside the same `try`, and `SecurityModule.init` stays `async` (its four remaining `await`s keep the ordering the loader depends on).

---

## Dead code

### Removed — `lib/util/wildcard.ts` (2026-09-09, step 06 PR F3)

Not a type-debt entry so much as a finding worth keeping: F2's coverage run showed `lib/util/wildcard.ts` absent from the report, which turned out to mean **nothing imported it** — zero references across `lib/`, `bin/`, `test/`, `tests/`, `features/`, `index.ts` and the types barrel. `git log` gives the reason: `a9bebdd0b abort wildcard support for now`.

It also carried a latent bug, identical on `master`: the comment says *"Keep only matching elements"* and the code returns `list.filter((item) => !regex.test(item))` — the **non**-matching ones. Never observed, because it never had a caller.

Deleted rather than pinned by a spec. Recorded here because the shape generalises: **a converted file that is absent from the coverage report is more likely dead than untested — check for callers before writing a spec for it.**

---

## `lib/types` — barrel & definition hygiene

### TD-04
**Barrel omits `ClientConnection` and `HttpMessage` (public event types)** · 🟠 medium · `lib/types/index.ts`

Imported only by `lib/types/events/EventProtocol.ts` (barrelled) and used in the public event-handler argument types (`EventWebsocket*`, `EventHTTP*`). They *leak* structurally through those public types but are **not importable by name** from `kuzzle`. The SDK exports neither → safe to add.

- **Reco:** add `export * from "./ClientConnection";` and `export * from "./HttpMessage";` to the barrel (after checking there is no root collision via `tsc --noEmit`).
- **✅ Done (2026-07-12, PR #2668):** both added to the barrel; 0 collision (absent from the whole kuzzle-sdk tree), `tsc --noEmit` at 0 errors.

### TD-05
**Barrel omits `PluginManifest`, `StrategyDefinition`, `StartOptions` family** · 🟡 low · `lib/types/index.ts`

`PluginManifest`/`StrategyDefinition` (imported by `Plugin.ts:25-26`, exposed via `Plugin._manifest`/`Plugin.strategies`) and `StartOptions`/`InstallationConfig`/`ImportConfig`/`SupportConfig` (`Kuzzle.ts`) are public concepts not importable by name. Empirically confirmed: `import { PluginManifest } from "kuzzle"` fails with `TS2305`.

- **Reco:** add to the barrel (check root collision). `StrategyDefinition` is especially plugin-author-facing.
- **✅ Done (2026-07-12, PR #2668):** `PluginManifest` and `StrategyDefinition` added to the barrel. **Remaining 🟦:** the `StartOptions`/`InstallationConfig`/`ImportConfig`/`SupportConfig` family from `Kuzzle.ts` (not handled in the quick win — root collision not yet verified for those names).

### TD-06
**Filename typo `adminControlller.type.ts` (3 "l"s)** · 🟡 low · `lib/types/controllers/adminControlller.type.ts`

The internal symbol (`ResetSecurityResult`) is spelled correctly — only the filename is wrong. The sole importer `lib/api/controllers/adminController.ts:27` **depends on the typo**, so the rename must fix the import in the same commit.

- **Reco:** `git mv` to `adminController.type.ts` + update the import.
- **✅ Done (2026-07-12, PR #2668):** file renamed + import fixed in `adminController.ts:27`; `tsc --noEmit` at 0 errors.

### TD-07
**`Token`: three divergent definitions** · 🟡 low · `lib/types/Token.ts:28`

The public type `lib/types/Token.ts` **contradicts** the runtime `Token` class: divergences on `connectionId(s)`, `type`, `singleUse`. The published type is therefore misleading for consumers.

- **Reco:** a single source of truth — either delete `lib/types/Token.ts` and derive a type from the class, or have the class implement the public interface and reconcile the fields.

### TD-08
**Mixed naming + 13 dead event types** · 🟡 low · `lib/types/`

3 files use `.type.ts` vs 44 in `PascalCase.ts` (no lint rule enforces it). 13 exported types (`EventGenericDocument*`, `EventHTTP*ParsingPayload`, `EventWebsocket*ParsingPayload`) are never referenced internally — plausibly public scaffolding, but no aggregate `EventDefinition` consumes them.

- **Reco:** decide on a single naming convention (and enforce it via lint); decide on the event types (keep as documented public API, or remove).

---

## `any` debt

> ~200 explicit sites (182 `: any`, 18 `as any`) + 50 `any[]` + 13 `Record<…,any>`. **Concentration:** `lib/core` ~48%; 4 files (`store.ts`, `pluginContext.ts`, `service/storage/{7,8}/elasticsearch.ts`) ≈ 40% of the `: any` / 55% of the `as any`. Mostly **recoverable**. Key point: these explicit `any` are **invisible** to `noImplicitAny`/`strictNullChecks` → see TD-03.

### TD-11
**`store.ts`: 28 recoverable `: any`** · 🟡 low · `lib/core/shared/store.ts:35`

The single largest `: any` cluster, on storage-forwarding methods typed `(...args:any[])=>Promise<any>`.
- **Reco:** type against the Elasticsearch service signatures (or a shared interface).

### TD-12
**`pluginContext.ts`: `any` on the public plugin API** · 🟡 low · `lib/core/plugin/pluginContext.ts:211`

2nd largest cluster, and the highest-stakes one because it is a **public API** (plugin-author surface).
- **Reco:** type against the existing kerror/controller types.

### TD-13
**Elasticsearch services: densest `as any` cluster + copy-paste** · 🟡 low · `lib/service/storage/8/elasticsearch.ts:95`

The genuinely *justified* `any`/`Record<…,any>` (ES client boundary) concentrates here, but is copy-pasted between `7/` and `8/`.
- **Reco:** a thin typed adapter over the ES client (dynamic casts localised in one place); type `_esVersion`/`config`; factor out the shared 7/8 logic.

### TD-22
**`memoryStorageController.ts` was renamed, not typed** · 🟠 medium · `lib/api/controllers/memoryStorageController.ts:32`

Converted in Sprint 4 PR C (#2681) with **0 written `any`** — and **54 implicit-`any` diagnostics** (`TS7xxx`), the largest pocket of inferred `any` among the converted files and 3rd repo-wide behind `service/storage/{7,8}/elasticsearch.ts` (108 and 86). They in turn cascade into **37 `TS2339`/`TS2551`** errors (`mapping.decr` and friends are currently reached through `any`), i.e. **91 diagnostics** for this file alone. It is also the worst file of the converted set under strict: **122 errors**. Concretely: `let mapping;` (an untyped mutable module binding, assigned by `initMapping()` and read by the constructor), 38 un-annotated `map: (val, request) => …` closures in the Redis-command table, 5 `result` accumulators inferring `any[]`, and `this[command] = buildCommandFn(command)` indexing the class dynamically.

The step-05 note says the table and the arg-extraction internals "stay inferred", which was a deliberate call — but nothing recorded the size of it, and the `any` ratchet charged nothing for it. It is now visible in the `implicit-any` ratchet (step 06).

- **Reco:** type the command table as a named interface (`RedisCommandMapping`, one entry type with the `skip`/`merge`/`path`/`map` shape), make `mapping` a `const` built at module load rather than a `let` + `initMapping()`, and annotate the `map` closures. Watch the constraint that made it dynamic in the first place: `memoryStorageController.test.js` drives `rewire(...).__get__("mapping" | "extractArgumentsFromRequest")` and `__set__({ mapping })` on the **compiled** CJS, so `mapping` must stay a top-level binding and the module must keep its `export =` shape.
- Fixing `mapping`'s type is what clears the 37 cascades above — they are not independent findings.
- **Tracked as [#2690](https://github.com/kuzzleio/kuzzle/issues/2690)** (opened 2026-09-09).
- **Trigger:** independent of the migration sprints; a good first `implicit-any` reduction PR since the file is self-contained and its spec is thorough.
- **✅ Done (2026-09-09, #2690):** the file is at **0 implicit-`any`** (91 diagnostics → 0), the `implicit-any` ratchet drops **518 → 464** (exactly the 54 sites) and strict errors for the file **122 → 54** (repo 1344 → **1309**). Written `any` unchanged at 208 — no hatch was used. Three deviations from the reco, each for a reason worth keeping:
  - **`mapping` stays a `let` + `initMapping()`.** A `const` is what the entry asked for, but the spec's `__set__({ mapping })` assigns to that binding on the compiled CJS, and assigning to a `const` throws at runtime. The annotation (`let mapping: RedisCommandMapping`) is what actually cleared the `TS7034`/`TS7005` and all 37 `TS2339` cascades, so the `const` bought nothing.
  - **The `map` closures are annotated one by one, not contextually.** An entry is `CommandArgumentPath | CommandArgumentSpec` (the table uses the bare path 100+ times), and TypeScript does not contextually type a callback through a union — so `(val: unknown, request: KuzzleRequest)` is written out.
  - **`this[command] = …` is typed by a class index signature** (`[command: string]: unknown`), not a cast. It is type-only, keeps the emitted JS identical, and costs the `any` ratchet nothing, where `as unknown as Record<string, unknown>` would have cost 1. ⚠️ **The 2026-09-10 review overturned this call** ([TD-28](#td-28) / [#2704](https://github.com/kuzzleio/kuzzle/issues/2704)): the signature applies to the *whole* class, so every member access is `unknown` and every property name is accepted. Costing the ratchet nothing was the wrong thing to optimise — the localised cast is the right trade.
  - **The typing pass had to come with a spec.** The coverage gate — vacuous on `.ts` until TD-24 was fixed — scored the PR at **62.4% on new code** and failed it: every annotated line counts as new, and the Mocha spec swaps the real table for a 6-command fixture, so not one of the table's own `map` closures ever ran. 17 vitest tests now drive them through the public actions (`geoadd`, `hmset`, `mset`, `scan`, `zrangebyscore`, `zadd`, `dbsize`) and assert the argument list handed to Redis. **First time the coverage gate caught something real** — worth remembering as the pattern: a rename-and-annotate PR on an under-tested file now costs a spec, which is the point.
  - The three runtime-asserted shapes now have names (`GeoPoint`, `FieldEntry`, `KeyEntry`) and the casts that follow their `kassert.assertBodyAttributeType(...)` calls are the only ones in the file. `assertFloat`/`assertInt` take `unknown` and go through a local `scalarToString` (Sonar S6551 forbids stringifying an `unknown`): scalars coerce exactly as `String(value)` did, everything else maps to `""`, which parses to `NaN` — the same rejection the implicit coercion produced. Arrays are rejected before reaching the parse, as before. **Not an exact identity**: an object with a numeric `toString()`/`valueOf()`, or a bigint, used to parse and is now rejected. Neither can come out of a parsed request body, so the path is unreachable in practice — recorded because the commit message claims exact parity.

### TD-25
**`@types/debug` is narrower than `debug`'s actual runtime** · 🟡 low · `lib/util/debug.ts`

`lib/util/debug.ts` and `lib/util/didYouMean.ts` are kept out of `strict` by a single diagnostic each — `TS7016`, "could not find a declaration file for module 'debug' / 'didyoumean'". The obvious fix is to install the DefinitelyTyped packages. **It was tried (step 06 PR F3, `@types/debug@4.1.13` + `@types/didyoumean@1.2.3`) and reverted**, because it *breaks* `tsc --noEmit`:

- `debug` builds `inspectOpts` from **any** `DEBUG_*` environment variable, so reading `inspectOpts.expand` (fed by `DEBUG_EXPAND`) is legitimate — but the declaration only knows `hideDate`/`colors`/`depth`/`showHidden` → `TS2339`.
- Those are declared `number | boolean`, which node's `util.inspect(value, InspectOptions)` rejects (`showHidden` must be `boolean`) → `TS2769`, at both call sites.
- `didYouMean.ts` additionally hits `TS2556` (spread into a non-rest parameter) once the module is typed.

So adopting the typings means two new dependencies **and** three casts, in exchange for removing two implicit-`any` diagnostics. Net loss for now.

- **Reco:** either upstream a fix to DefinitelyTyped (`inspectOpts` should be an index signature, and its values `string | number | boolean`), or write a repo-local ambient declaration that describes the real runtime — then adopt both files into strict. Do **not** simply install the packages and cast.
- **Trigger:** whenever the last non-strict files in `lib/util` are being cleared, or before the sprint-9 global `strict` flip.

---

## Duplication

### TD-23
**`sonar.cpd.exclusions` is becoming permanent, untracked debt** · 🟡 low · `sonar-project.properties`

The exclusion list is the documented escape hatch for pre-existing intra-file duplication that a `.js`→`.ts` rename re-scores as new code (ADR step 05). It has grown to **5 files** across Sprint 3 and 4, and nothing schedules any of it:

| File | Measured duplication | Register entry |
|------|---------------------|----------------|
| `lib/service/storage/7/esWrapper.ts` + `8/esWrapper.ts` | 197 duplicated 10-line windows (≈95% identical) | [TD-16](#td-16) — explicit non-goal |
| `lib/api/controllers/documentController.ts` | 36 duplicated 10-line windows (mExists/mGet, createOrReplace/replace) | **none** |
| `lib/api/controllers/memoryStorageController.ts` | the `mapping` table + the geoadd/hmset/mset and ZAdd/ZInterstore closures | **none** |
| `lib/api/httpRoutes.ts` | the route table's near-identical 5-line literals | **none — and no justifying comment in `sonar-project.properties`** |

Two distinct problems: the dedup work itself is unscheduled, and an exclusion added "temporarily" during a conversion has no expiry — CPD is simply off for those files from now on, including for *future* duplication introduced by unrelated PRs.

- **Reco:** (1) document the `httpRoutes.ts` entry alongside the other three; (2) open the `documentController` CRUD-pair dedup as its own refactor (it is the only one that is genuinely worth doing — `esWrapper` is a declared non-goal and `memoryStorageController`'s belongs with [TD-22](#td-22)); (3) when a file's duplication is dealt with, **remove its exclusion in the same PR** — treat the list as a ratchet that may only shrink.
- **🟦 Partially done (2026-09-09, step 06 PR F1):** (1) and (3) shipped — the `httpRoutes.ts` entry is documented and `sonar-project.properties` now records that the list may only shrink. **Remaining ⬜:** (2), the `documentController` dedup.
- **✅ (2) done (2026-09-09, #2691):** `mExists`/`mGet` collapse into `_mFetch(request, methodName)` and `createOrReplace`/`replace` into `_writeDocument(request, methodName, action)` — the same shape as the existing `_mChanges`, so the file gains no new idiom. **`documentController.ts`'s exclusion is dropped in the same PR**, which is the ratchet working as intended: 5 files → 4. The two behavioural quirks the pairs hid are preserved and now commented rather than duplicated — `mGet`'s `@todo` about empty successes, and `replace` notifying the request's own payload where `createOrReplace` notifies the storage response. **Remaining in the list:** `esWrapper` ×2 ([TD-16](#td-16), declared non-goal), `memoryStorageController` (belongs with [TD-22](#td-22)), `httpRoutes` (irreducible route table).
- **Tracked as [#2691](https://github.com/kuzzleio/kuzzle/issues/2691)** (opened 2026-09-09).
- **Trigger:** independent of the migration sprints.

---

## Enforcement (config & contracts)

### TD-02
**No `strict` + ESLint disables `no-explicit-any`** · 🟠 medium · `tsconfig.json:1`, `eslint-plugin-kuzzle/lib/configs/typescript.js:13-14`

`tsconfig.json` only has `noUncheckedIndexedAccess` (no `strict`/`noImplicitAny`/`strictNullChecks`). The shared ESLint config sets **both `@typescript-eslint/no-explicit-any` AND `explicit-module-boundary-types` to `off`**. Result: neither implicit nor explicit `any` is constrained at the boundaries.
- **Reco:** incremental strict adoption (ADR: Target architecture › Enforcement) + local re-enable of `no-explicit-any` (as `warn`).
- **ADR link:** Target architecture › Enforcement; final strict flip = step table sprint 9.
- **🟦 In progress (2026-07-12, PR #2669):** `no-explicit-any` re-enabled as `warn` (`.eslintrc.json`); strict tooled up (`tsconfig.strict.json` + `strict-check.sh`, 41 adopted files). **Remaining:** progressively harden the rest of `lib/` then the final `strict` flip (Sprint 9).
- **🟦 Advanced (2026-09-09, step 06 PR F1):** adopted files **46 → 94** — every production file that passed strict on that date, `--candidates` emptied — and strict adoption is now part of a conversion PR's DoD. Repo-wide strict errors **1483 → 1344** after typing `NativeController.constructor(actions: string[] = [])`, which was inferring `never[]` and alone accounted for 139 of them.

### TD-03
**Explicit `any` invisible to strict → 3rd ratchet required** · 🟠 medium · cross-cutting

The ADR's strict ratchet would pass *over* the ~200 explicit `any`: "strict:true" would give a false sense of safety (undetected null-safety holes).
- **Reco:** 3rd CI ratchet `no-explicit-any` as *baseline-and-decrement* (baseline ~200).
- **ADR link:** Target architecture › Enforcement (no-explicit-any ratchet); shipped in step 01.
- **✅ Done (2026-07-12, PR #2669):** ratchet shipped (`scripts/ratchet.sh any`, baseline 200, `npm run ratchet:any`). The actual *reduction* of the ~200 `any` remains to do (see TD-11/12/13).
- **✅ Completed (2026-09-09, step 06 PR F1):** the finding was **only half true** — the written-`any` ratchet is itself blind to two things. (1) `as unknown as`, the hatch a conversion reaches for once `: any` is forbidden → now counted (baseline 200 → **208**, a broadened metric, not a regression). (2) **Inferred** `any`: an un-annotated parameter costs the ratchet nothing, so a rename that types nothing scores zero. A **4th ratchet** (`implicit-any`, `tsconfig.implicit.json`, baseline **520** `TS7xxx`) now measures it — 87 of those 520 sit in files already declared "converted".

### TD-14
**Cosmetic request/response getters** · 🟡 low · `lib/api/request/requestInput.ts:206`

The request/response classes advertise typed getters/setters but rely on **untyped private index access** + a plain-JS `assertType` module → the contracts don't actually narrow (`any` underneath).
- **Reco:** real typed private fields (or a typed private state object) + migrate `lib/util/assertType.js` to `.ts` with generic returns (`assertString(name, v): string`).
- **⚠️ Opportunity missed (noted 2026-09-09, step 06 review):** `assertType` **was** converted (Sprint 1, PR #2674) but **without** the generic returns this entry asked for — it returns `Record<string, unknown> | null` / `unknown[]` / `string | null`, so `requestInput` still casts and the getters still do not narrow. The cheap window is gone; picking TD-14 up now means editing an already-converted file. `assertType.ts` is strict-clean and adopted, so the change is at least guarded.

### TD-15
**Implicit-any constructors on public request/response classes** · 🟡 low · `lib/api/request/requestInput.ts:149`

- **Reco:** type the parameters. `RequestInput`/`KuzzleRequest` data has a known shape (controller/action/_id/index/collection/body/volatile/jwt…) that deserves a named interface; `RequestResponse.constructor` should take `KuzzleRequest`.

### TD-24
**SonarCloud measures no coverage on `.ts` — every conversion voids its own coverage gate** · 🟠 medium · `sonar-project.properties`, `.github/workflows/pull_request.workflow.yaml`

`sonar.coverage.exclusions=**/*.ts,**/*.vue` (added by #2658 on 2026-05-21, before this ADR) excludes **all** TypeScript from coverage measurement. So every `.js` → `.ts` rename **removes its file from the "Coverage on New Code" gate** — the gate is vacuous on exactly the lines a conversion PR touches, and it has silently swallowed the 30 files converted so far. The conversion PRs noted this in passing ("`.ts` is coverage-excluded") as if it were neutral; it is the largest hole in the migration's safety story, and it widens with every sprint.

Two compounding problems in the pipeline:
- Only `npm run test:unit:mocha:coverage` runs in the `sonarqube` job, so **vitest coverage never reaches the scanner** — which also means the ADR's "every new test in vitest" produces no measurable coverage at all.
- `c8` (mocha, over the compiled `dist/`) and vitest both write to `coverage/lcov.info`, so wiring vitest in naively would have one report **overwrite** the other rather than add to it.

- **Reco:** drop `**/*.ts` from the exclusions; verify where the c8 lcov actually points (mocha runs `dist/**/*.test.js` with `sourceMap: true`, so c8 *should* remap onto `lib/**/*.ts` — confirm, and remap explicitly otherwise); give each runner its own report path and list both in `sonar.javascript.lcov.reportPaths`; then record the measured coverage of the already-converted files.
- **Tracked as [#2692](https://github.com/kuzzleio/kuzzle/issues/2692)** (opened 2026-09-09).
- **✅ Done (2026-09-09, step 06 PRs F2 + F3).** Verified end to end on the PRs' own SonarCloud analyses: project `coverage` is **84.7%** on both, `uncovered_lines` **drops** 9 035 → 9 014 with F3's specs, and F3's `new_coverage` is **100%** — so SonarCloud does take the **union** of the two lcov reports, and the zero-hit records the vitest report necessarily carries (production import chains) are harmless. c8 **does** apply the source maps, so the lcov already points at `lib/**/*.ts` (249 records, 172 `.ts`) and no remapping was needed — dropping the exclusion was enough. Measured line coverage of the 30 converted files: **85.9%** (7877/9170); `lib/**/*.ts` repo-wide **88.5%**. The Mocha suite *was* exercising the converted code — the gate was blind, not the tests. Worst offenders: `funnel.ts` **55.7%**, `redis.ts` 62.5%, `debug.ts` 70.7%, `memoryStorageController.ts` 73.8%; `lib/util/wildcard.ts` does not appear in the report at all.
- ⚠️ **Two further pre-existing bugs surfaced, both from `root: "tests"` in `vitest.config.ts`** (all coverage paths were resolved against `tests/`, not the repo root): `reportsDirectory: "./coverage"` wrote to **`tests/coverage/`**, where `sonar.javascript.lcov.reportPaths` never looked — so the two runners never actually collided over a shared path, contrary to the initial reading — and the instrumented scope was capped at `tests/`, so **`lib/` was never measured and the vitest report contained 0 file records**. "Every new unit test in vitest" had been producing no measurable coverage at all since the runner was scaffolded. Fixed by replacing `root` with `include: ["tests/**/*.{test,spec}.ts"]`.

---

## Config & storage

### TD-16
**ES7/ES8 copy-paste; one-directional drift** · 🟡 low · `lib/types/storage/7/Elasticsearch.ts`, `…/8/Elasticsearch.ts`

`JSONObject`/`KRequestBody`/`KImportError`/`KRequestParams` duplicated verbatim. ES8 gained types (`KStats*`, `KUpdateResponse`) typing its `stats()`/`update()`, **not ES7**. The only genuine reason they can't merge: the SDK v7→v8 rename of `ByteSize`/`ClusterNodesStats`.
- **Reco:** a shared `types/storage` module for the SDK-agnostic types; backport the stats/update types to ES7.
- **Measured (2026-09-09, step 06 review):** the duplication also covers the *wrappers*, not just the types — `esWrapper.ts` 7 vs 8 is **314 LOC each with a 16-line diff** (≈95% identical, 197 duplicated 10-line windows). The whole diff is the `sdk-es7`/`sdk-es8` import plus one error-message regex where ES8 wraps the type name in brackets (`matches[2]` instead of `matches[1]`). Both files are `sonar.cpd.exclusions`-listed and strict-clean/adopted. Deduplicating them stays an explicit non-goal of the migration — see [TD-23](#td-23) for the exclusion-list debt as a whole.

### TD-17
**`loadConfig()` returns `any`** · 🟡 low · `lib/config/index.ts:38`

Defeats typing at the config assembly point.
- **Reco:** type the return as `KuzzleConfiguration` (or `LoadedKuzzleConfiguration` extending it with `version`/`internal`).

### TD-18
**Unmodelled runtime fields** · 🟡 low · `lib/types/config/KuzzleConfiguration.ts:154`

`version: string` (always present at runtime) and `internal.allowAllOrigins: boolean` are absent from the type.
- **Reco:** add them to `IKuzzleConfiguration`.
- **🟦 In progress (2026-07-21, PR D):** `version: string` added to `IKuzzleConfiguration` (unblocks `serverController`'s `global.kuzzle.config.version` read). **Remaining ⬜:** `internal.allowAllOrigins: boolean` (only consumed by still-JS `httpwsProtocol`/`funnel`, so deferred to their conversion to avoid touching out-of-scope files).
- **✅ Closed (2026-09-07, PR E2):** `internal.allowAllOrigins: boolean` added to `IKuzzleConfiguration` — `funnel._isOriginAuthorized` reads it, and its conversion is exactly the trigger PR D deferred to. The remaining JS consumer (`httpwsProtocol`) is unaffected (type-only change).

### TD-19
**`any` in otherwise-typed config sections** · 🟡 low · `lib/types/config/KuzzleConfiguration.ts:155`

`internal.hash`, `cluster.interface`, `http.routes`, `storageEngine.client` typed `any`/`JSONObject`.
- **Reco:** `internal.hash: { seed: Buffer }`, `cluster.interface: string | null`, concrete interfaces (or at least `Record<string, unknown>`) for the others.

---

## Deprecation

### TD-20
**Deprecated request APIs kept in converted controllers** · 🟡 low · `lib/api/documentExtractor.ts`, `lib/api/controllers/serverController.ts`

Two `@deprecated` `KuzzleRequest` methods are still called by the files converted in Sprint 4 PR D and were **deliberately kept** rather than migrated, because both "replacements" change observable behaviour — out of scope for a conversion PR (ADR rule: *no behaviour change in a conversion*):

- **`request.setResult(result, { status })`** (×7 in `documentExtractor`) — JSDoc says *use `request.response.configure`*, but `configure` only sets headers/status/format, **not the result**; and the `response.result =` setter routes back through `setResult(result)` with no options, which **forces status 200** and would drop a preserved non-200 (e.g. `201` on create) in `funnel.performDocumentAlias`. No clean drop-in exists.
- **`request.getArrayLegacy(name)`** (×1 `documentExtractor` `ids`, ×1 `serverController` `services`) — JSDoc says *use `getArray`*, but `getArray` **throws `api.assert.invalid_type`** on a non-JSON-array string, whereas `getArrayLegacy` falls back to `value.split(",")`. Swapping breaks HTTP clients passing comma-separated or bare-string values (`?ids=a,b`, `?services=internalCache`).

Kept as-is in PR D with `// NOSONAR` on each call site (a `.js`→`.ts` rename re-scores the whole file as new code, so SonarCloud `typescript:S1874` — "deprecated API should not be used" — would fail the `0 New Issues` gate).

- **Reco:** migrate in a **dedicated behaviour-change PR** (not a conversion): add runtime deprecation warnings, document the breaking change, remove the legacy paths on a major version, then drop the `NOSONAR` markers.
- **Tracked as [#2688](https://github.com/kuzzleio/kuzzle/issues/2688)** (opened 2026-09-07) — the register alone was scheduling nothing.
- **Also in scope (added 2026-09-09, sprint 5 PR G3):** `clientAdapter.loadMappings` uses **`Mutex`**, deprecated in favour of `withLock` from `util/distributedLock`. Not swapped by the conversion: the two use incompatible acquisition/TTL formats, and `Mutex`'s own deprecation note warns they must not contend on the same key — so this is a behaviour change, and a riskier one than the request APIs above (it is a distributed lock taken during mapping import).
- **Trigger:** picked up when the deprecated request-API cleanup is scheduled — independent of the TS-migration sprints. Note the call-site count **grows with every conversion** (#2686 added 2 in `funnel.ts`, G3 added 2 more in `clientAdapter.ts`); grep `NOSONAR: TD-20` and `NOSONAR: see loadMappings`.

---

## Correctness

### TD-21
**`_wrapError` guards on the wrong argument** · 🟠 medium · `lib/api/funnel.ts` (`_wrapError`)

`Funnel._wrapError(request, error)` calls `this.isNativeController(request)`, but `isNativeController(controller: string)` does `this.controllers.has(controller)` — it expects a controller **name**. A `KuzzleRequest` is never a key of that map, so the guard is **always false** and *every* non-`KuzzleError` is wrapped into a `PluginImplementationError` (`plugin.runtime.unexpected_error`), native controllers included. The intent was clearly `request.input.controller`.

Latent since the JS version. Surfaced by the Sprint 4 PR E2 conversion, which made the argument mismatch a type error.

- **Kept as-is** (cast `request as unknown as string` + an inline comment): fixing it changes observable behaviour — native-controller internal errors would stop being reported as plugin errors — and the current Mocha specs (`handleProcessRequestError.test.js`, `processRequest.test.js`) assert the wrapped `plugin.runtime.unexpected_error`. A conversion PR must not change behaviour.
- **Reco:** in a dedicated behaviour-change PR, pass `request.input.controller`, re-baseline the two specs, and drop the cast + comment.
- **Tracked as [#2687](https://github.com/kuzzleio/kuzzle/issues/2687)** (opened 2026-09-07) — the register alone was scheduling nothing.
- **Trigger:** independent of the TS-migration sprints.
- **✅ Done (2026-09-09, #2687):** `_wrapError` now guards on `request.input.controller`; the cast and the inline comment are gone. **Behaviour change:** an internal error raised by a native controller (a `TypeError`, say) reaches the client as-is instead of as `plugin.runtime.unexpected_error` / `PluginImplementationError` — which is what the guard always meant to do. `processRequest.test.js`'s `_checkSdkVersion` case is re-baselined (`fakeController` is native), and a spec pinning the native-controller path was added next to the plugin one in `handleProcessRequestError.test.js`. Kept in Mocha: `lib/api/funnel` cannot be imported from a vitest spec yet — it pulls in `documentController`, which `import … = require("../../util/extractFields")`s a module vitest resolves as ESM.
- ⚠️ **Re-opened in effect by the 2026-09-10 review → [TD-27](#td-27) / [#2703](https://github.com/kuzzleio/kuzzle/issues/2703).** The guard was put on `_wrapError`, which is the shared funnel for the controller *and* two plugin-pipe paths, so plugin pipes changed too; and the now-unwrapped error reaches the client with `id`/`code` `undefined`. The fix belongs at the error's source.

---

## Findings rejected during verification (transparency)

The audit **rejected** 2 findings as non-reproducible or redundant:
- A claimed double `@ts-ignore` in `profile.ts` masking `TS2339` + `TS2554`: construct not reproducible on verification.
- A duplicate of the "storage redefines `JSONObject`" finding (already covered by TD-10).

---

## Journal

- **2026-07-12** — Register initialised from the multi-agent audit.
- **2026-07-12** — Quick wins delivered in PR #2668 (3 isolated commits, `tsc --noEmit` green at each step): TD-06, TD-04 + partial TD-05, partial TD-01.
- **2026-07-12** — ADR + register committed on the migration branch. Sprint 0 tooling delivered in PR #2669: 3 count ratchets (js/mocha/any), `strict-check.sh` + adopted list (41 files), ESLint `no-explicit-any` re-enabled, CI job wired. TD-03 ✅, TD-02 🟦.
- **2026-07-12** — Sprint 1 (warm-up) delivered in PR #2670: 5 `lib/util` modules (safeObject, bytes, wildcard, memoize, extractFields) converted JS→TS; JS baseline 111→106; strict 41→46 adopted files; tsc + build + unit tests (7/7) green. `bin/` scope adjusted (see ADR: Target architecture › Sequencing, and step 03): `.upgrades` to be deleted (separate PR).
- **2026-07-14** — Sprint 1 finished in PR #2674 (merged into `2-dev`): the remaining 7 `lib/util` files converted → `lib/util` is now 100% TS. Counters: js=86, mocha=151, any=200, strict adopted=51.
- **2026-07-15** — Sprint 3 delivered in PR #2676: `lib/model` (baseModel, apiKey, rights) + `lib/service` (service, redis, esWrapper 7/8) converted JS→TS → both layers now 100% TS. JS baseline 86→79; `any` unchanged (200), no `@ts-ignore` (one documented `@ts-expect-error` for `ApiKey.load`'s static-signature divergence). tsc clean; full mocha suite (3025) green in Docker. Sprint 2 (`bin/`) deprioritized.
- **2026-07-15** — ADR docs relocated from `adrs/` to `docs/adr-001/` (`git mv`, history preserved); all references updated (CONTRIBUTING, CI workflow, `scripts/`, `tsconfig.strict.json`, `/wrapup` skill). New convention: ADRs live under `docs/adr-<n>/`.
- **2026-07-17** — Sprint 4 (`lib/api`) PR B (#2680): `documentController` → TS (clean of deprecated APIs; only `validation.validate`, unblocked by PR A). js baseline 73 → 72. SonarCloud new-code gate: fixed 2 optional-chain smells (S6582); the file's **pre-existing intra-file CRUD duplication** (mExists/mGet, createOrReplace/replace) exceeded the 5% new-code duplication gate, so it was added to `sonar.cpd.exclusions`. **Deferred debt:** dedup those method pairs in a separate refactor (kept out of the conversion PR per ADR).
- **2026-07-17** — Sprint 4 (`lib/api`) started, PR A (#2679): 6 files → TS, js baseline 79 → 73. Items surfaced for PR B: (1) **TD-18** (`config.version` unmodelled) + a **`kuzzle.statistics` private-but-accessed-cross-class** visibility bug, both blocking `serverController`; (2) **deprecated request APIs** — `documentExtractor` (and `documentController`) call `request.setResult(result, options)` (`@deprecated` → `response.configure`) and `request.getArrayLegacy` (`@deprecated`); harmless in JS, but a `.js`→`.ts` rename makes SonarCloud score them as *new* code and fail the `0 New Issues` gate, so `documentExtractor` was split out of PR A. Fixed in passing: `validation.js` `validate()` JSDoc pointed at the DOM `Request` instead of `KuzzleRequest`.
- **2026-07-21** — Sprint 4 (`lib/api`) PR D (#2682): `serverController` + `documentExtractor` → TS. **TD-18** partially closed — `version: string` added to `IKuzzleConfiguration`; `internal.allowAllOrigins` still ⬜ (out-of-scope JS consumers). **TD-20** opened — the two files' `@deprecated` `setResult`/`getArrayLegacy` calls kept for behaviour parity (both replacements change behaviour), `NOSONAR`-marked, real migration deferred to a dedicated PR. Also made `kuzzle.statistics` non-`private` (cross-class access by `serverController`); the "visibility bug" flagged in PR A was in fact just the type not matching the runtime access. js baseline 71 → 69.
- **2026-09-07** — Sprint 4 (`lib/api`) PR E1 (#2685): `httpRoutes` + `controllers/index` → TS; js baseline 69 → 67. **TD-19 partially prepared, not closed** — the route table now carries a real shape (a module-local `KuzzleHttpRoute` interface: literal-union `verb`, `deprecated?`, `url?`), but `HttpConfiguration.routes` is deliberately **left `any`**: promoting the interface into `lib/types` and typing that field cascades into already-converted files (`serverController.ts` assigns `config.http.routes = undefined` and re-declares its own local `ApiRoute[]`), i.e. a type refactor the conversion standard keeps out of a conversion PR. Whoever picks up TD-19 should start from `KuzzleHttpRoute`. Also standardized `adminController`/`authController`/`securityController` on `export =` — the `export default` shape was the sole reason for the `new XController.default()` workaround in `funnel.js` and 10 spec call sites.
- **2026-09-07** — Sprint 4 (`lib/api`) **PR E2** ([#2686](https://github.com/kuzzleio/kuzzle/pull/2686)): `funnel` → TS; js baseline 67 → 66 — **`lib/api` is 100% TypeScript, Sprint 4 converted**. **TD-18 closed** (`internal.allowAllOrigins` modelled — the half PR D deferred to exactly this conversion). **TD-21 opened** (see above). Both deferred items now have **GitHub issues** ([#2687](https://github.com/kuzzleio/kuzzle/issues/2687) for TD-21, [#2688](https://github.com/kuzzleio/kuzzle/issues/2688) for TD-20): the register is read when someone picks up the ADR, which was scheduling nothing on its own. **Convention going forward: a TD entry that defers real work gets an issue, and the entry links to it.**

- **2026-09-09** — **Step 07 Sprint 5 (`lib/core` I), PRs G1 + G2.** G1: 10 files ≥93% covered (`realtime`, `security` repositories, `cache`) — js 66→56; the **`implicit-any` ratchet caught 55 inferred `any`** the compiler and the explicit-`any` ratchet both missed, and **`Build and Run` caught a startup regression** (a dynamic method call converted into a dynamic property read lost its receiver). G2: the module wiring — js 56→51, 5 vitest specs, and a **`kerror` fix without which no vitest spec could reach an error path** (`module.filename` is a CommonJS global; vitest loads `lib/` as ESM). **TD-26 opened** (5 `await`s of a non-Promise, kept for timing parity). Measured for the first time: **a `.js`→`.ts` rename makes the whole file count as new code for coverage** (`new_lines_to_cover` 2 646 for 2 308 LOC), so a file's current coverage *is* its future `new_coverage`.
- **2026-09-09** — **Step 06 PR F3 (test debt).** vitest spec location settled in `CONTRIBUTING.md` (`tests/` mirror). **TD-24 closed** by F2. **TD-25 opened** — `@types/debug` is narrower than `debug`'s runtime, so installing it breaks `tsc`; `util/debug.ts` and `util/didYouMean.ts` stay out of strict deliberately. **`lib/util/wildcard.ts` deleted** — dead code carrying an inverted-filter bug (see *Dead code* above). Five vitest specs added (64 tests, up from 7): `debug` 70.7% → **100%**, `bytes` 82.5% → **91.7%**, `promback`/`assertType`/`safeObject` at 100% and now pinned directly. **`promback.ts`'s own typing hole fixed under test and adopted into strict** — the settled value is honestly `T | undefined` (`resolve()` takes no argument, and `KuzzleEventEmitter` passes `updated[0]`), and the settle methods now narrow on the settler rather than on `isPromise`; no cast, no cascade. Strict errors 1344 → **1339**. The `mocha` counter stays at 151 on purpose: none of the five files had a Mocha spec, so nothing was replaced.
- **2026-09-09** — **Mid-course review of the 30 files converted so far** (sprints 1, 3, 4), opening [ADR step 06](ADR-0001-migration-typescript.md). The converted code holds up on the letter of the standard (0 written `any`, 0 `@ts-ignore`, 0 `!`, 0 unused imports, tsc + lint green, and PR E2's `funnel.ts` gate refactor re-verified equivalent line by line against `master`). What did not hold up is the **measurement**: **TD-22** opened (`memoryStorageController` renamed but not typed — 54 implicit-`any` sites, 91 diagnostics with the cascades), **TD-23** opened (`sonar.cpd.exclusions` at 5 files with no schedule and one undocumented entry), **TD-24** opened (SonarCloud measures no coverage on `.ts` — the biggest hole, and the reason PR F2 gates Sprint 5). All three have GitHub issues per the convention: [#2690](https://github.com/kuzzleio/kuzzle/issues/2690), [#2691](https://github.com/kuzzleio/kuzzle/issues/2691), [#2692](https://github.com/kuzzleio/kuzzle/issues/2692). **TD-02/TD-03 advanced** (4th ratchet on implicit `any` at 520; written-`any` ratchet widened to `as unknown as`, 200 → 208; strict adopted 46 → 94; repo strict errors 1483 → 1344 from one `never[]` inference). **TD-14 flagged as an opportunity missed** — `assertType` was converted without the generic returns the entry asked for. **TD-16 measured** — the esWrapper pair is 314 LOC each with a 16-line diff.

- **2026-09-09** — **TD-21 closed (#2687), first of the "conversion found it, conversion must not fix it" backlog.** `funnel._wrapError` now guards on `request.input.controller`: a native controller's internal error surfaces as itself instead of `plugin.runtime.unexpected_error`. Two lessons for the next such PR: the Mocha suite **encoded** the bug in a place the issue did not predict (`processRequest`'s `_checkSdkVersion` case, because `fakeController` is native), and the new spec had to stay in **Mocha** — `lib/api/funnel` is not importable from vitest, since it pulls in `documentController`, which `import … = require()`s the still-`.js` `util/extractFields`. **A converted file is not vitest-testable until its `import = require` dependencies are converted too**; that is the practical order constraint on where new specs can go.

- **2026-09-09** — **TD-23 (2) closed (#2691): first entry actually removed from `sonar.cpd.exclusions`** (5 files → 4). `documentController`'s two CRUD pairs collapse into `_mFetch` / `_writeDocument`, modelled on the `_mChanges` helper the file already had — 36 duplicated 10-line windows gone, ~150 lines shorter, Mocha unchanged at 3025 (the specs drive the public actions, so a faithful extraction needed no re-baselining). Confirms the intended workflow: **the dedup PR and the exclusion removal are the same PR**, otherwise the list never shrinks.

- **2026-09-09** — **TD-22 closed (#2690): the first `implicit-any` reduction PR.** `memoryStorageController` goes from 91 diagnostics to 0; the ratchet drops 518 → 464 and the repo's strict errors 1344 → 1309, with the written-`any` count untouched. The generalisable findings: **a union entry type blocks contextual typing of callbacks** (annotate them, or the table's 100+ bare paths have to go), **a class index signature is a cheaper hatch than a double cast** for dynamically installed action methods (type-only, ratchet-free), and **`rewire`'s `__set__` forbids `const`** — a spec's reflection style constrains what the production file may become. And the **coverage gate fired for the first time since TD-24** (62.4% on new code): a spec that mocks the very table it is meant to exercise reads as coverage but is not, and only counting the *annotated* lines as new code made it visible. Mocha stayed at 3025 passing throughout, which is the point: the file's spec drives `mapping` and `extractArgumentsFromRequest` directly, so a typing pass that broke either would have failed loudly.

---

*Register initialised on 2026-07-12 from the multi-agent audit. Keep it up to date as the ADR-0001 sprints progress.*

---

## Post-sprint review — 2026-09-10

Findings of the review of the five PRs merged into `2-dev` on 2026-09-09 ([#2698](https://github.com/kuzzleio/kuzzle/pull/2698) and the four type-debt PRs). Execution log: [step 08](steps/08-type-debt-backlog.md).

### TD-27
**`_wrapError`'s fix is scoped to a shared funnel** · 🟠 medium · `lib/api/funnel.ts:1116`

[TD-21](#td-21)'s fix guards on `request.input.controller`, but `_wrapError` is the common funnel for three sources: the whole of `processRequest`'s `try` (controller **and** the `request:onExecution` / before / after pipes), the `<controller>:error<Action>` pipe, and `request:onError`. A predicate on the controller name cannot separate "the native controller threw" from "a plugin pipe threw on a request to a native controller", so plugin-pipe behaviour changed too — which TD-21 never intended.

Second half, and the more serious one: an error that now traverses `_wrapError` unwrapped ends in `KuzzleRequest.setError` → `new InternalError(error)`, i.e. **`id: undefined` and `code: undefined`** on a 500 sent to a client, while Kuzzle's error contract is built on documented id/code pairs.

- **Reco:** decide at the source. Wrap only the `doAction` call in `processRequest`; a native controller's non-`KuzzleError` becomes `kerror.getFrom(e, "core", "fatal", "unexpected_error", e.message)` (documented code, `InternalError` 500, source stack preserved), a plugin controller's keeps `plugin.runtime.unexpected_error`. Then revert `_wrapError` to its pre-fix rule and **delete the guard** — everything reaching it comes from a pipe, i.e. from plugin code, and the dead guard was TD-21's actual bug.
- **This is what keeps the change a `fix`.** Pipes and plugin controllers keep their error verbatim, status stays 500 everywhere, and the only delta is the `id` of a crash inside a native controller: `plugin.runtime.unexpected_error` → `core.fatal.unexpected_error`. No `BREAKING CHANGE:` footer needed.
- **Tracked as [#2703](https://github.com/kuzzleio/kuzzle/issues/2703).**
- **✅ Landed ([#2709](https://github.com/kuzzleio/kuzzle/pull/2709), merged into `2-dev` 2026-09-10):** `processRequest` wraps only the `doAction` call, through a new `_wrapControllerError` that picks the domain from the controller and leaves a `KuzzleError` alone. `_wrapError` goes back to its pre-TD-21 rule and **the guard is deleted rather than fixed** — by the time an error reaches it, it comes from a pipe, so there is nothing left to discriminate. Pinned by specs: a pipe error on a native-controller request is a plugin error again; `_checkSdkVersion`'s stubbed raw `Error` returns to the plugin wrap (it is funnel code, not controller code); a native controller's `TypeError` becomes `core.fatal.unexpected_error` **with an id and a code**, where TD-21 left both `undefined`.

### TD-28
**A class-wide index signature untypes `memoryStorageController`** · 🟠 medium · `lib/api/controllers/memoryStorageController.ts:42`

[TD-22](#td-22) typed the dynamic action install with `[command: string]: unknown` on the class itself. That applies to the entire surface: every property access returns `unknown` and, worse, every property *name* compiles — `this.askk(...)` included. The file scores 0 written and 0 implicit `any` while being less type-safe about its own members than before.

No ratchet charges for it: it is not `: any`, not `as any`, not `as unknown as`, and it *removes* `TS7xxx` diagnostics. Exactly the blind spot [step 06](steps/06-hardening-mid-course.md) exists to close.

- **Reco:** keep the class closed and cast once at the install site (`const actions = this as unknown as Record<string, (request: KuzzleRequest) => unknown>`), or hold the cast in a small `installCommand()` helper. Costs the `any` ratchet 1, which is the honest price.
- **Tracked as [#2704](https://github.com/kuzzleio/kuzzle/issues/2704).**
- **✅ Landed ([#2710](https://github.com/kuzzleio/kuzzle/pull/2710), merged into `2-dev` 2026-09-10):** solved with `Reflect.set(this, command, buildCommandFn(command))` — no cast at all, and the same idiom `core/shared/sdk/impersonatedSdk` uses for a runtime-built key. **The ratchet picked the solution:** the localised `as unknown as Record<…>` this entry recommended was written first and rejected at `any` 208 > 207, which is what pushed the fix to the cast-free form.
  - **The sweep took two passes to finish.** The same runtime-built-key write lived in three places, and only one was fixed here: `baseController._addAction` followed in the post-merge pass, and `core/shared/store.ts`'s `this[method] = …` loop only in the pass after that (implicit-any 462 → **461**). When a fix is *"the idiom for this pattern"*, the pattern is what to grep for — `grep -rnE 'this\[[a-zA-Z_]+\] *='` over `lib/**/*.ts` finds all three in one command, and the remaining hits are symbol-keyed private fields, which are already typed.

### TD-29
**Nothing charges for `@ts-ignore`** · 🟡 low · `lib/`

The conversion standard forbids `@ts-ignore`/`@ts-nocheck` "without a comment + ticket", and nothing enforces it. `lib/` holds 4 suppressions: `types/HttpStream.ts:38` and `model/security/profile.ts:309` are bare `@ts-ignore`; `core/shared/sdk/embeddedSdk.ts:165` is an undocumented `@ts-expect-error`; only `model/storage/apiKey.ts:46` states its reason. A suppression is a hole exactly like a written `any`.

- **Reco:** `@typescript-eslint/ban-ts-comment` with `{"ts-ignore": true, "ts-nocheck": true, "ts-expect-error": "allow-with-description", "minimumDescriptionLength": 20}`, plus fixing the three undocumented sites. `@ts-expect-error` is preferable to `@ts-ignore`: it fails once the underlying error disappears. A 5th count ratchet only if the three cannot be cleared at once.
- **Tracked as [#2707](https://github.com/kuzzleio/kuzzle/issues/2707).**
- **✅ Landed ([#2712](https://github.com/kuzzleio/kuzzle/pull/2712), merged into `2-dev` 2026-09-10):** `ban-ts-comment` is an error on `.ts` (`@ts-ignore`/`@ts-nocheck` forbidden, `@ts-expect-error` allowed with a ≥ 20-char description). Two of the three sites lose their suppression entirely — `embeddedSdk` writes `propagate` with `Reflect.set`, and `Profile._hash` is declared as the patchable static it actually is (`profileRepository` swaps it for `global.kuzzle.hash` at startup and uses the `false` return as the "not patched" probe, which the `static _hash()` signature never said). ⚠️ **The replacement declaration was itself wrong** — see [TD-34](#td-34). `HttpStream`'s stays, as an explained `@ts-expect-error` over Node internals @types/node does not declare.

### TD-30
**`bin/copy-binaries.js` is not a plugin fixture** · 🟡 low · `bin/`, ADR Definition of Done

The DoD and the 2026-09-09 register entry state that all 4 remaining `bin/` `.js` are fixtures under `bin/plugins/available/**`. Only 3 are; `bin/copy-binaries.js` is build tooling (`npm run build` = `rm -Rf ./dist && tsc && node ./bin/copy-binaries.js`, and it ships as `dist/bin/copy-binaries.js`). The `js` ratchet's floor is therefore **3**, and the wording currently exempts a product file by accident.

- **Reco:** correct the DoD and the register wording, set the floor to 3, and record an explicit decision on `copy-binaries.js` — convert it (mind that the script is what populates `dist` with non-TS assets, so running it from `dist/` needs care) or exempt it with a stated reason.
- **Tracked as [#2705](https://github.com/kuzzleio/kuzzle/issues/2705).**
- **✅ Landed ([#2713](https://github.com/kuzzleio/kuzzle/pull/2713), merged into `2-dev` 2026-09-10):** the DoD wording and the floor (3) are corrected here; **the file is converted**, kept in `bin/` so `path.join(__dirname, "..")` still resolves to the repository root — **no path needed changing**. js 50 → **49**, `bin/` at its floor, adopted into strict (102). ⚠️ It first ran through `tsx`; **that broke `npm run build` outside Linux** — see [TD-35](#td-35).
  - Running the compiled `dist/bin/copy-binaries.js` was the alternative and was rejected: from `dist/bin/`, `__dirname/..` is `dist/`, so source and target roots would have had to be split apart — on release tooling whose failure mode is a published package silently missing its `.proto` files.
  - **A wrong risk assessment, corrected:** the review claimed the emit path was at risk because `tsconfig.json` sets `rootDir: "lib/"` while including `bin/`. It is not — `rootDir` sits *outside* `compilerOptions`, so tsc ignores it, and `dist/bin/copy-binaries.js` was already being emitted from the `.js` source under `allowJs`. That dead key is now [TD-32](#td-32).
  - No spec: `sonar.sources` is `./lib`, so `bin/` is outside the analysed and coverage-measured scope, and the "a file with no spec ships one" rule targets product code.

### TD-31
**TD-23's helpers take loose parameters that can disagree** · 🟡 low · `lib/api/controllers/documentController.ts`

`_mFetch(request, methodName: string)` and `_writeDocument(request, methodName: string, action: number)` interpolate `methodName` into a storage event name, so a typo fails at runtime instead of compile time. And `_writeDocument` picks the notification payload from `action === actionEnum.REPLACE` rather than from the method, so `("createOrReplace", actionEnum.REPLACE)` would silently get `replace`'s semantics.

- **Reco:** narrow to `"mGet" | "mExists"` and `"replace" | "createOrReplace"`, branch on the method, derive `action` from it, and type `action` as the notify-action type rather than `number`.
- **Tracked as [#2706](https://github.com/kuzzleio/kuzzle/issues/2706).**
- **✅ Landed ([#2711](https://github.com/kuzzleio/kuzzle/pull/2711), merged into `2-dev` 2026-09-10):** the method names are unions (`FetchMethod`, `WriteMethod`, `ChangeMethod`) and **`_writeDocument` derives the action from the method** instead of taking it, which removes the disagreement rather than documenting it. `_mChanges` keeps its `action` — it varies over five methods — but takes `NotifyAction`, the value type of the `as const` enum.

### TD-32
**`tsconfig.json`'s `rootDir` has never applied** · 🟡 low · `tsconfig.json`

`rootDir` is declared as a **top-level key, beside `compilerOptions` rather than inside it**, so tsc ignores it. `dist/` mirrors the repository root — which is what the build, `main` (`./dist/index.js`) and the `files` list all already rely on. Harmless at runtime, but it cost a wrong risk assessment during the [TD-30](#td-30) review.

- **Reco:** delete the key. Moving it into `compilerOptions` would **break the build**: `index.ts`, `bin/`, `features/`, `test/`, `tests/` and `start-kuzzle-*.ts` all sit outside `lib/` and would each raise `TS6059`. If an explicit root is wanted it has to be `"."`, which is what tsc infers today — compare `find dist -type f | sort` before and after.
- **Tracked as [#2714](https://github.com/kuzzleio/kuzzle/issues/2714).**
- **✅ Landed ([#2716](https://github.com/kuzzleio/kuzzle/pull/2716), merged into `2-dev` 2026-09-10):** the key is deleted. The claim that mattered was "the emitted layout does not change", so it was measured, not argued: `npm run build` then `find dist -type f | sort`, with and without the key — **1453 files, identical lists**.

### TD-33
**A flaky functional variant blocks unrelated PRs** · 🟠 medium · `.ci/scripts/run-test-cluster.sh`, `bin/wait-kuzzle`

The 30-variant functional matrix is `fail-fast`, so **one flake cancels the other 29 jobs** and the PR must be re-run whole. Three occurrences: [#2696](https://github.com/kuzzleio/kuzzle/pull/2696) (sprint 5 G2), [#2708](https://github.com/kuzzleio/kuzzle/pull/2708) — a **docs-only** PR — and [#2712](https://github.com/kuzzleio/kuzzle/pull/2712). The two on 2026-09-10 passed on re-run with no code change.

Root cause of the common symptom: `run-test-cluster.sh` gates the suite on four `bin/wait-kuzzle` calls, and `wait-kuzzle` resolves on the SDK's **`connected` event** — the WebSocket handshake succeeded. That proves the transport is listening; it proves nothing about the cluster having formed a quorum, which is what the tests actually need. Hence `api.process.not_enough_nodes` in a `Before` hook, 1.7 s into the run.

A second symptom is not explained yet: on #2708 the wait on port 17510 timed out after 60 s while the containers logged `[✔] Kuzzle 2.56.0 is ready` 30 s in. The SDK *does* retry (`Realtime.clientNetworkError` re-calls `connect()` every second, `autoReconnect` on by default), so "it only tried once" is **not** the explanation — recorded as open rather than guessed at.

- **Reco:** (1) poll `cluster:status` for the 3 expected nodes after the port waits — this is the state the tests depend on; (2) reproduce the `wait-kuzzle` timeout before touching it; (3) consider `fail-fast: false` on the matrix, so one flake stops hiding the other 29 results.
- **Tracked as [#2715](https://github.com/kuzzleio/kuzzle/issues/2715).**
- **Trigger:** independent of the migration, but it taxes every PR in it.

### TD-34
**`Profile._hash`'s replacement declaration was also wrong** · 🟠 medium · `lib/model/security/profile.ts`, `lib/core/security/profileRepository.ts`

[TD-29](#td-29) deleted a bare `@ts-ignore` over `Profile._hash` and declared the static properly — the right move, on the right diagnosis (*"a bare `@ts-ignore` is often a wrong declaration wearing a hat"*). But the replacement declared `static _hash(rightsItem?: unknown): string | false`, and the function that actually gets installed is `global.kuzzle.hash`, which returns **`murmur.v3(...)` — a `number`**. So the suppression was traded for a mis-declaration of the same contract, one layer up.

It stayed invisible because the *other* half of the finding was never done: `profileRepository.fromDTO` still probed and patched through `(profile.constructor as any)._hash`, and `any` accepts a wrong signature silently. The overload existed precisely to make that site typeable, and the site kept the cast.

- **Fix:** `number | false` on both the overload and the stub; `profileRepository` narrows `profile.constructor` to `typeof Profile` and drops both `as any`. `any` 207 → **205**, implicit-any 464 → **462** (the patch's `(obj)` parameter was un-annotated too).
- **The generalisable part:** *a declaration is only load-bearing once every caller is typed against it.* An `as any` at the call site turns a fresh signature into decoration — and here it hid a bug in the very fix that added the signature. When a PR replaces a suppression with a declaration, the check is not "does it compile", it is "**is there still a cast between this declaration and its callers**".
- **Found by:** the 2026-09-10 post-merge review, and only by removing the `as any` first — `tsc` then reported `TS2322: Type '(obj: unknown) => number' is not assignable to type '(rightsItem?: unknown) => string | false'`.

### TD-35
**`npm run build` was broken off Linux, and nothing asserted its payload** · 🟠 medium · `package.json`, `bin/copy-binaries.ts`, CI

[TD-30](#td-30) ran the converted script as `npx tsx ./bin/copy-binaries.ts`. `tsx` bundles **esbuild**, whose binary is platform-specific, so on any tree whose `node_modules` was installed for another platform the step dies with *"You installed esbuild for another platform than the one you're currently using"*. `tsc` has already succeeded at that point, so `dist/` is left **without the `.proto` files and without `start-kuzzle-server`**.

Two distinct defects, and the second is the one that matters:

1. A native binary was put on the **release path** (`prepublishOnly` → `build`) — the exact path whose failure mode TD-30 itself described as *"a published package silently missing its `.proto` files"*.
2. **Nothing checked the build's payload.** `npm run build` exits non-zero here, so CI would catch this particular break — but no check covers a `copy-binaries` that fails *quietly*, which is the failure TD-30 was reasoning about.

- **Fix:** `node -r ts-node/register/transpile-only ./bin/copy-binaries.ts` — `ts-node` is pure JavaScript, already a devDependency, and already the idiom of the `doc-error-codes` script. Plus `.ci/scripts/check-build-payload.sh`, run after `npm run build` in **both** the PR workflow and the release workflow: it asserts `dist/index.js`, a compiled `lib/` file, both `.proto` files, `dist/bin/copy-binaries.js` and `dist/bin/start-kuzzle-server` — every path `package.json`'s `files` list promises — and that the entrypoint is still executable.
- **Verified negatively**, not just positively: `rm -rf dist && npx tsc` (i.e. the copy step skipped) makes the script fail on exactly the three missing paths.
- **The generalisable part:** *a risk you name in a decision record is a risk you should gate in CI.* TD-30 identified the failure mode correctly, weighed two options against it, and shipped without a check for it — so the next regression on that path was found by a reviewer rather than by the pipeline.

### TD-36
**The build-payload gate never sees the artifact that is published** · 🔴 high · `package.json`, `.github/workflows/semantic-release.workflow.yaml`

[TD-35](#td-35) added `.ci/scripts/check-build-payload.sh` after `npm run build` in the release workflow. That is one build too early. `semantic-release` publishes with `npm publish`, and `npm publish` runs **`prepublishOnly`, which is `npm run build`** — whose first act is `rm -Rf ./dist`. So the sequence on `master` is:

```
npm run build            # workflow step
check-build-payload.sh   # ✅ verifies this dist/
npm publish              # prepublishOnly → rm -Rf ./dist && tsc && copy-binaries
                         # ↑ the tarball is packed from a dist/ nothing checked
```

The gate proves the payload of a directory that is deleted before the tarball is packed. Every failure mode TD-35 enumerated — a `copy-binaries` that dies on a platform-specific binary, or fails quietly — is still shipped, because it is the *second* build that ships.

- **Fix:** `"prepublishOnly": "npm run build && ./.ci/scripts/check-build-payload.sh"`. It gates the artifact that is actually packed, on **every** publish path (CI, or a maintainer publishing by hand), and needs no workflow change. The two workflow steps stay, as the fast feedback that fails a PR before review.
- **The generalisable part:** *gate the artifact, not a rehearsal of it.* A check placed next to a build step is only worth what the build step's output is worth — and here that output was thrown away. The question to ask of any packaging gate is "which bytes end up in the tarball, and did this run inspect *those*".
- **Found by:** the 2026-09-10 iteration review, reading `package.json`'s lifecycle scripts rather than the workflow file.

### TD-37
**The gate's coverage was a hand-written list, sold as derived** · 🟠 medium · `.ci/scripts/check-build-payload.sh`

[TD-35](#td-35) claimed the script asserts *"every path `package.json`'s `files` list promises to ship"*. It asserted six hard-coded paths out of the twelve entries in `files`, and the gap is not cosmetic: **`dist/lib/**/*.json` was unchecked**, and that glob carries `lib/kerror/codes/*.json` — the entire error-code catalogue, i.e. every error message the product can raise — plus `lib/config/sdkCompatibility.json`.

Those files reach `dist/` for a reason no one asserts either: `tsconfig.json` `include`s `lib/**/*.json` and sets `resolveJsonModule`, so **tsc copies them**. Narrow that include, drop `resolveJsonModule`, or set a `rootDir` — and `tsc` still exits 0, the payload check still passes, and the published package has no error messages. `dist/index.d.ts` (the package's public types) was unchecked for the same reason: it was not on the list.

- **Fix:** derive the checks from `files` itself, so the gate cannot drift from the promise. A literal entry must exist; a glob over a **verbatim-copied** asset (`.json`, `.proto`, `.yaml`) must match as many files under `dist/lib/` as exist under `lib/` — an exact count, since those are byte copies; any other glob (compiled `.js`, generated `.d.ts`) must match at least once, there being no source file to count against. `files`' dead `dist/lib/**/*.yaml` entry passes as 0 = 0 rather than needing a special case.
- **Verified negatively, three ways:** `rm -rf dist/lib/kerror/codes` → *`dist/lib/**/*.json` — 1 file(s), expected 10*; `rm -rf dist && npx tsc` (copy step skipped) → the missing entrypoint and *`*.proto` — 0, expected 2*; `chmod -x dist/bin/start-kuzzle-server` → the executable check. All three exit 1.
- **Portability note:** counted with `find -path`, not a shell glob — `globstar` is a bash-4 option and macOS still ships bash 3.2, so the original list would have been the *portable* half of a script whose replacement had to stay runnable on a maintainer's laptop.
- **The generalisable part:** *a check that repeats a promise by hand is a second thing to maintain, and it drifts silently — in the direction of passing.* Derive it from the promise, or the review question "does the gate cover X" has to be re-answered by reading both.
