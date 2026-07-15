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
| [TD-18](#td-18) | 🟡 low | Config | Runtime fields `version` / `internal.allowAllOrigins` unmodelled | XS | ⬜ |
| [TD-19](#td-19) | 🟡 low | Config | `any` in config sections (`internal.hash`, `cluster.interface`, `http.routes`…) | S | ⬜ |

**Quick wins (handled first, cf. ADR Action Item #8):** TD-01, TD-04, TD-05, TD-06.

---

## SDK — kuzzle-sdk boundary

### TD-01
**Unbounded `kuzzle-sdk` pin — non-deterministic public surface** · 🟠 medium · `package.json:46`

`"kuzzle-sdk": ">=7.17.1"` is the **only** unpinned dependency in `package.json` (the ~41 others are exact-pinned). Combined with `export * from "kuzzle-sdk"` in `index.ts:19`, **139 of the 258 names** exported by the `kuzzle` package (~54%) come from the SDK. With no upper bound, npm may resolve a future major (8.x, 9.x): the public surface of `kuzzle` then silently changes for a consumer resolving afresh (the lockfile only protects the internal build).

- **Today, 0 collisions** (0 `TS2308` diagnostics); the re-export is **intentional** (PR #1800, 2020 — to let plugins import SDK types from `kuzzle`), not a leak.
- **Reco:** bound it (`>=7.17.1 <8` or `^7.17.1`) + add a **snapshot test** of the set of names exported at the root, to catch in CI any SDK bump that adds/removes/collides a name.
- **ADR link:** Action Item #3 (Sprint 0 — SDK prerequisite).
- **✅ Partially done (2026-07-12, PR #2668):** bound applied (`>=7.17.1 <8.0.0`), package.json + lockfile synced, resolved version unchanged. **Remaining ⬜:** the snapshot test of the exported surface.

### TD-09
**`JSONObject` imported from the client SDK — dependency inversion** · 🟡 low · `lib/types/KuzzleDocument.ts:1` (representative)

`JSONObject` (`Record<PropertyKey, any>` on the SDK side) is imported from `kuzzle-sdk` by **~44 files / ~323 uses**, across every layer (api/request, kerror, core/security, core/realtime, cluster, types/config, util, kuzzle/Logger). Yet the server is the source of truth for the concepts the client SDK mirrors: sourcing the most-used primitive *from* the client is an inversion (conceptual; the import is type-only, erased at compile time).

- **Reco:** `lib/types/JSONObject.ts` (server-owned) + codemod the imports (name/structure unchanged → no call-site edits). Keep the genuine SDK contracts (`RequestPayload`, `KuzzleEventEmitter`, etc., confined to `embeddedSdk.ts`/`funnelProtocol.ts`) imported from the SDK.
- **ADR link:** Action Item #7 (cross-cutting task).

### TD-10
**Three divergent `JSONObject` definitions** · 🟡 low · `lib/types/storage/7/Elasticsearch.ts:21`, `lib/types/storage/8/Elasticsearch.ts:48`

The SDK defines `type JSONObject = Record<PropertyKey, any>`; both storage files redeclare `export interface JSONObject { [key: string]: any }` (interface, string keys only) without importing the SDK. Non-equivalent semantics (union alias vs mergeable interface; `symbol` keys). No root collision only because those 2 files are not in the barrel.

- **Reco:** consolidate to a single server-owned definition (TD-09) and delete the 2 redefinitions.

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

---

## Enforcement (config & contracts)

### TD-02
**No `strict` + ESLint disables `no-explicit-any`** · 🟠 medium · `tsconfig.json:1`, `eslint-plugin-kuzzle/lib/configs/typescript.js:13-14`

`tsconfig.json` only has `noUncheckedIndexedAccess` (no `strict`/`noImplicitAny`/`strictNullChecks`). The shared ESLint config sets **both `@typescript-eslint/no-explicit-any` AND `explicit-module-boundary-types` to `off`**. Result: neither implicit nor explicit `any` is constrained at the boundaries.
- **Reco:** incremental strict adoption (ADR §6.2) + local re-enable of `no-explicit-any` (as `warn`).
- **ADR link:** Action Items #4, #10; §6.2.
- **🟦 In progress (2026-07-12, PR #2669):** `no-explicit-any` re-enabled as `warn` (`.eslintrc.json`); strict tooled up (`tsconfig.strict.json` + `strict-check.sh`, 41 adopted files). **Remaining:** progressively harden the rest of `lib/` then the final `strict` flip (Sprint 9).

### TD-03
**Explicit `any` invisible to strict → 3rd ratchet required** · 🟠 medium · cross-cutting

The ADR's strict ratchet would pass *over* the ~200 explicit `any`: "strict:true" would give a false sense of safety (undetected null-safety holes).
- **Reco:** 3rd CI ratchet `no-explicit-any` as *baseline-and-decrement* (baseline ~200).
- **ADR link:** §6.2 (dedicated block), Action Item #2.
- **✅ Done (2026-07-12, PR #2669):** ratchet shipped (`scripts/ratchet.sh any`, baseline 200, `npm run ratchet:any`). The actual *reduction* of the ~200 `any` remains to do (see TD-11/12/13).

### TD-14
**Cosmetic request/response getters** · 🟡 low · `lib/api/request/requestInput.ts:206`

The request/response classes advertise typed getters/setters but rely on **untyped private index access** + a plain-JS `assertType` module → the contracts don't actually narrow (`any` underneath).
- **Reco:** real typed private fields (or a typed private state object) + migrate `lib/util/assertType.js` to `.ts` with generic returns (`assertString(name, v): string`).

### TD-15
**Implicit-any constructors on public request/response classes** · 🟡 low · `lib/api/request/requestInput.ts:149`

- **Reco:** type the parameters. `RequestInput`/`KuzzleRequest` data has a known shape (controller/action/_id/index/collection/body/volatile/jwt…) that deserves a named interface; `RequestResponse.constructor` should take `KuzzleRequest`.

---

## Config & storage

### TD-16
**ES7/ES8 copy-paste; one-directional drift** · 🟡 low · `lib/types/storage/7/Elasticsearch.ts`, `…/8/Elasticsearch.ts`

`JSONObject`/`KRequestBody`/`KImportError`/`KRequestParams` duplicated verbatim. ES8 gained types (`KStats*`, `KUpdateResponse`) typing its `stats()`/`update()`, **not ES7**. The only genuine reason they can't merge: the SDK v7→v8 rename of `ByteSize`/`ClusterNodesStats`.
- **Reco:** a shared `types/storage` module for the SDK-agnostic types; backport the stats/update types to ES7.

### TD-17
**`loadConfig()` returns `any`** · 🟡 low · `lib/config/index.ts:38`

Defeats typing at the config assembly point.
- **Reco:** type the return as `KuzzleConfiguration` (or `LoadedKuzzleConfiguration` extending it with `version`/`internal`).

### TD-18
**Unmodelled runtime fields** · 🟡 low · `lib/types/config/KuzzleConfiguration.ts:154`

`version: string` (always present at runtime) and `internal.allowAllOrigins: boolean` are absent from the type.
- **Reco:** add them to `IKuzzleConfiguration`.

### TD-19
**`any` in otherwise-typed config sections** · 🟡 low · `lib/types/config/KuzzleConfiguration.ts:155`

`internal.hash`, `cluster.interface`, `http.routes`, `storageEngine.client` typed `any`/`JSONObject`.
- **Reco:** `internal.hash: { seed: Buffer }`, `cluster.interface: string | null`, concrete interfaces (or at least `Record<string, unknown>`) for the others.

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
- **2026-07-12** — Sprint 1 (warm-up) delivered in PR #2670: 5 `lib/util` modules (safeObject, bytes, wildcard, memoize, extractFields) converted JS→TS; JS baseline 111→106; strict 41→46 adopted files; tsc + build + unit tests (7/7) green. `bin/` scope adjusted (see ADR §6.4): `.upgrades` to be deleted (separate PR).
- **2026-07-14** — Sprint 1 finished in PR #2674 (merged into `2-dev`): the remaining 7 `lib/util` files converted → `lib/util` is now 100% TS. Counters: js=86, mocha=151, any=200, strict adopted=51.
- **2026-07-15** — Sprint 3 delivered in PR #2676: `lib/model` (baseModel, apiKey, rights) + `lib/service` (service, redis, esWrapper 7/8) converted JS→TS → both layers now 100% TS. JS baseline 86→79; `any` unchanged (200), no `@ts-ignore` (one documented `@ts-expect-error` for `ApiKey.load`'s static-signature divergence). tsc clean; full mocha suite (3025) green in Docker. Sprint 2 (`bin/`) deprioritized.
- **2026-07-15** — ADR docs relocated from `adrs/` to `docs/adr-001/` (`git mv`, history preserved); all references updated (CONTRIBUTING, CI workflow, `scripts/`, `tsconfig.strict.json`, `/wrapup` skill). New convention: ADRs live under `docs/adr-<n>/`.

---

*Register initialised on 2026-07-12 from the multi-agent audit. Keep it up to date as the ADR-0001 sprints progress.*
