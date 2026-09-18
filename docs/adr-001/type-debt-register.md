# Type-debt register — Kuzzle

> Companion to [ADR-0001](ADR-0001-migration-typescript.md), and to [lessons.md](lessons.md) — the index of every *generalisable part* below, with what enforces it. It details and tracks the findings of the **2026-07-12** type-debt audit (multi-agent audit, findings verified adversarially). The ADR sets the *strategy*; this register tracks the *execution*.

**Effort legend:** XS (< 1h) · S (~½ day) · M (1–3 d) · L (> 3 d)
**Status:** ⬜ to do · 🟦 in progress · ✅ done · 🔴 open defect — filed, and wrong *today*: shipped behaviour is incorrect, or the item blocks work that is otherwise ready

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
| [TD-23](#td-23) | 🟡 low | Duplication | `sonar.cpd.exclusions` growing into permanent, untracked debt (5 → 4 files, now ratcheted) — [#2691](https://github.com/kuzzleio/kuzzle/issues/2691) | M | ✅ [#2701](https://github.com/kuzzleio/kuzzle/pull/2701) + the `cpd-exclusions` ratchet |
| [TD-24](#td-24) | 🟠 med | Enforcement | SonarCloud measures **no coverage on `.ts`** — every conversion voids its own coverage gate — [#2692](https://github.com/kuzzleio/kuzzle/issues/2692) | S | ✅ |
| [TD-25](#td-25) | 🟡 low | Dependencies | `@types/debug` is narrower than `debug`'s runtime — adopting it costs 3 casts, so `util/debug.ts` stays out of strict | S | ⬜ |
| [TD-26](#td-26) | 🟡 low | Correctness | 5 `await`s of a non-Promise, kept for timing parity across conversions (`NOSONAR: TD-26`) | XS | ✅ |
| [TD-27](#td-27) | 🟠 med | Correctness | TD-21's guard fix sits on a shared funnel: plugin pipes changed too, and the unwrapped error loses its `id`/`code` — [#2703](https://github.com/kuzzleio/kuzzle/issues/2703) | S | ✅ [#2709](https://github.com/kuzzleio/kuzzle/pull/2709) |
| [TD-28](#td-28) | 🟠 med | `any` | `memoryStorageController`'s class-wide index signature untypes the whole controller — [#2704](https://github.com/kuzzleio/kuzzle/issues/2704) | XS | ✅ [#2710](https://github.com/kuzzleio/kuzzle/pull/2710) |
| [TD-29](#td-29) | 🟡 low | Enforcement | Nothing charges for `@ts-ignore` (4 in `lib/`, 2 undocumented) — [#2707](https://github.com/kuzzleio/kuzzle/issues/2707) | S | ✅ [#2712](https://github.com/kuzzleio/kuzzle/pull/2712) |
| [TD-30](#td-30) | 🟡 low | Enforcement | `bin/copy-binaries.js` miscounted as a plugin fixture: the `js` floor is 3, not 4 — [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) | XS | ✅ [#2713](https://github.com/kuzzleio/kuzzle/pull/2713) |
| [TD-31](#td-31) | 🟡 low | Duplication | TD-23's helpers take loose `methodName`/`action`, which can disagree — [#2706](https://github.com/kuzzleio/kuzzle/issues/2706) | XS | ✅ [#2711](https://github.com/kuzzleio/kuzzle/pull/2711) |
| [TD-32](#td-32) | 🟡 low | Enforcement | `tsconfig.json`'s `rootDir` sits outside `compilerOptions` and has never applied — [#2714](https://github.com/kuzzleio/kuzzle/issues/2714) | XS | ✅ [#2716](https://github.com/kuzzleio/kuzzle/pull/2716) |
| [TD-33](#td-33) | 🟠 med | Enforcement | One flaky variant blocks unrelated PRs; cluster nodes disagree on membership — [#2715](https://github.com/kuzzleio/kuzzle/issues/2715) | M | ✅ closed 2026-09-17 — harness half done; cluster half split into [TD-65](#td-65) + [TD-67](#td-67), both fixed in [#2777](https://github.com/kuzzleio/kuzzle/pull/2777) |
| [TD-34](#td-34) | 🟠 med | Correctness | `Profile._hash`'s new overload declared `string \| false`; the patch (`global.kuzzle.hash`) returns a `number`, and `profileRepository` still cast the site to `any` | XS | ✅ |
| [TD-35](#td-35) | 🟠 med | Enforcement | `npm run build` ran `copy-binaries` through `tsx` (esbuild native binary) and nothing asserted its payload — a broken copy step shipped a `.proto`-less package | XS | ✅ |
| [TD-36](#td-36) | 🔴 high | Enforcement | TD-35's payload gate never sees the published artifact: `npm publish` re-runs `prepublishOnly` → `build`, which wipes the `dist/` the workflow step verified | XS | ✅ |
| [TD-37](#td-37) | 🟠 med | Enforcement | TD-35's gate was a hand-written 6-path list sold as "every path `files` promises" — the error-code catalogue (`dist/lib/**/*.json`) was not among them | XS | ✅ |
| [TD-38](#td-38) | 🟠 med | Enforcement | A fork PR never runs the functional suite, the monkey tests or the build-payload gate — `needs: [sonarqube]` — [#2725](https://github.com/kuzzleio/kuzzle/issues/2725) | XS | ✅ |
| [TD-39](#td-39) | 🟠 med | Enforcement | `tests/` (the vitest tree) is neither linted nor formatted; `prettier` is never checked — [#2726](https://github.com/kuzzleio/kuzzle/issues/2726) | XS | ✅ |
| [TD-40](#td-40) | 🟠 med | Correctness | `PluginRepository.load()` is declared non-nullable and resolves `null`; `ObjectRepository` cannot express a nullable load — [#2727](https://github.com/kuzzleio/kuzzle/issues/2727) | S | ✅ |
| [TD-41](#td-41) | 🟠 med | Correctness | `Protocol.init`'s union advertises a call shape the body cannot honour — [#2728](https://github.com/kuzzleio/kuzzle/issues/2728) | XS | ✅ |
| [TD-42](#td-42) | 🟠 med | Enforcement | The coverage rule is an aggregate over the block, so a 0-spec file ships behind its siblings — [#2729](https://github.com/kuzzleio/kuzzle/issues/2729) | S | ✅ |
| [TD-43](#td-43) | 🟡 low | Enforcement | Nothing charges for a single `as` assertion, nor for a type-only import written as a value import — [#2730](https://github.com/kuzzleio/kuzzle/issues/2730) | S | ✅ done (2026-09-14 [#2742](https://github.com/kuzzleio/kuzzle/pull/2742) type-only imports; 2026-09-15 [#2743](https://github.com/kuzzleio/kuzzle/pull/2743) `casts` ratchet, baseline **87**) |
| [TD-44](#td-44) | 🟡 low | Enforcement | `strict-check.sh` fails **open**: a tsc that never ran reads as "all adopted files pass" — [#2731](https://github.com/kuzzleio/kuzzle/issues/2731) | XS | ✅ |
| [TD-45](#td-45) | 🟡 low | Enforcement | Extensionless Node executables in `bin/` are invisible to the `js` ratchet — the floor is 5, not 3 — [#2732](https://github.com/kuzzleio/kuzzle/issues/2732) | XS | ✅ |
| [TD-46](#td-46) | 🟡 low | Tests | `privilegedContext`'s new spec mocks the base class it exists to exercise; fixture leaks beside it — [#2733](https://github.com/kuzzleio/kuzzle/issues/2733) | XS | ✅ |
| [TD-47](#td-47) | 🟡 low | Enforcement | CI hygiene: no `concurrency` group, a pointless Node matrix on `lint`, an undefined `NODE_LTS_ACTIVE_VERSION`, no least-privilege — [#2734](https://github.com/kuzzleio/kuzzle/issues/2734) | XS | ✅ |
| [TD-48](#td-48) | 🟡 low | Tests | Nothing asserts that a stack trace never leaves the process — [#2735](https://github.com/kuzzleio/kuzzle/issues/2735) | S | ✅ |
| [TD-49](#td-49) | 🟠 med | Tests | The vitest tree cannot load anything reaching `lib/api/controllers`: 25 `import x = require()` reach Node's resolver and die on a `.ts` path — [#2739](https://github.com/kuzzleio/kuzzle/issues/2739) | M | ✅ |
| [TD-50](#td-50) | 🔴 high | Enforcement | c8 loses coverage when a module is loaded twice in one process: the whole coverage gate reads 11 points low, and sprint 6's five remaining files by 30 to 60 — [#2744](https://github.com/kuzzleio/kuzzle/issues/2744) | S | ✅ |
| [TD-51](#td-51) | 🟡 low | Correctness | The application logger is never flushed on shutdown: the optional chain reads `log` off the Plugin wrapper, which never has one — [#2747](https://github.com/kuzzleio/kuzzle/issues/2747) | XS | ✅ |
| [TD-52](#td-52) | 🔴 high | Correctness | Three things `httpwsProtocol` reads that are never set: the multipart file-size limit is not enforced, and an HTTP connection's headers are always empty — [#2749](https://github.com/kuzzleio/kuzzle/issues/2749) | S | ✅ |
| [TD-53](#td-53) | 🟠 med | Enforcement | `KuzzleConfiguration` is `Partial<…>`, so every config section is `undefined` under strict — but it accounts for 14 of the 246 strict errors in the converted files, not for all of them — [#2756](https://github.com/kuzzleio/kuzzle/issues/2756) | M | 🔴 |
| [TD-54](#td-54) | 🟠 med | Enforcement | 232 of the 246 strict errors in the sprint 6/7 conversions are not TD-53: the nullability work was deferred, not blocked — [#2757](https://github.com/kuzzleio/kuzzle/issues/2757) | L | 🔴 |
| [TD-55](#td-55) | 🟡 low | Correctness | `waterfall.shift()` resolves the chain silently where the JavaScript rejected — [#2758](https://github.com/kuzzleio/kuzzle/issues/2758) | XS | ✅ |
| [TD-56](#td-56) | 🟡 low | Correctness | `bindPluginMethod` declares `PluginMethod` and returns `undefined` — TD-40 again, in a file strict does not read — [#2759](https://github.com/kuzzleio/kuzzle/issues/2759) | XS | ✅ |
| [TD-57](#td-57) | 🟡 low | Tests | `vault.ENV_VAULT_KEY` is typed `string` and starts `undefined`; its only env-var spec asserts nothing — [#2760](https://github.com/kuzzleio/kuzzle/issues/2760) | XS | ✅ |
| [TD-58](#td-58) | 🟠 med | Correctness | `Node out-of-sync` under-reports by one: every single-message loss prints `0 messages lost`, which is why TD-33 has been dismissed five times — [#2762](https://github.com/kuzzleio/kuzzle/issues/2762) | XS | ✅ |
| [TD-59](#td-59) | 🟠 med | Correctness | Every node has **two** unrelated `knode-*` ids — the cluster's and the one it logs under — so no cluster log line can be attributed to a container — [#2764](https://github.com/kuzzleio/kuzzle/issues/2764) | S | ✅ |
| [TD-60](#td-60) | 🟡 low | Enforcement | `pr-preflight.sh` diffs against `master`, 278 commits behind `2-dev`: both of its reminders saw ~330 changed files on every branch, so neither could fire meaningfully | XS | ✅ |
| [TD-61](#td-61) | 🟡 low | Enforcement | [TD-54](#td-54)'s DoD lived only in the decision log: nothing a conversion author reads carried the strict-count rule, and no tool printed the number | XS | ✅ |
| [TD-62](#td-62) | 🟡 low | Correctness | 56 `x: T = null` declarations state a type the constructor contradicts — [TD-56](#td-56)'s gate covers the `undefined` spelling, not this one | M | ⬜ |
| [TD-63](#td-63) | 🟠 med | Correctness | `IDCardRenewer` reports a redis failure to `this.parentPort`, which it never has: the node is evicted without the reason — [#2770](https://github.com/kuzzleio/kuzzle/issues/2770) | XS | 🔴 |
| [TD-64](#td-64) | 🟠 med | Enforcement | The `tests/` mirror convention resolved `.ts` targets only, so a vitest spec on a not-yet-converted file counted for nothing — [#2771](https://github.com/kuzzleio/kuzzle/issues/2771) | XS | ✅ |
| [TD-65](#td-65) | 🔴 high | Correctness | A joining node resumes from a message id snapshotted on the **command** channel while its **sync** subscription is still propagating: messages published in that window are dropped by ZeroMQ and read as a desync — the mechanism [TD-33](#td-33) has been chasing — [#2773](https://github.com/kuzzleio/kuzzle/issues/2773) | M | ✅ [#2777](https://github.com/kuzzleio/kuzzle/pull/2777) — a residual race via a third party's lag is documented in the entry |
| [TD-66](#td-66) | 🟡 low | Enforcement | [TD-61](#td-61)'s strict-count reminder reads committed history only, so it prints *"no conversion in this branch"* in the state a conversion is usually checked in — [#2774](https://github.com/kuzzleio/kuzzle/issues/2774) | XS | ✅ [#2796](https://github.com/kuzzleio/kuzzle/pull/2796) — plus untracked files, which the entry did not name |
| [TD-67](#td-67) | 🔴 high | Correctness | `evictSelf` broadcasts the node's own eviction and never receives it, so the node keeps serving traffic with state that stopped advancing; the gap is also never resynced, so one drop reports forever — [#2776](https://github.com/kuzzleio/kuzzle/issues/2776) | S | ✅ [#2777](https://github.com/kuzzleio/kuzzle/pull/2777) — *resync instead of evict* is a design decision left open |
| [TD-68](#td-68) | 🟠 med | Correctness | `sync.proto` types a notification's `scope`/`user` as `string`, the notification types as closed unions, and nothing between them checked — [#2779](https://github.com/kuzzleio/kuzzle/issues/2779) | XS | ✅ |
| [TD-69](#td-69) | 🔴 high | Correctness | The mappings-import mutex has a 5 s TTL it never renews and decides from reads taken before the lock: a node that loses the race calls `document:create` on an id that now exists and **refuses to boot** — [#2782](https://github.com/kuzzleio/kuzzle/issues/2782) | S | ✅ [#2786](https://github.com/kuzzleio/kuzzle/pull/2786) — `Mutex`'s 5 s default left as it is, deliberately |
| [TD-70](#td-70) | 🟠 med | Tests | `array of objects matching` compares positionally, so 25 `"hits"` assertions pin the order of an Elasticsearch search nothing ordered — [#2784](https://github.com/kuzzleio/kuzzle/issues/2784) | S | ✅ [#2787](https://github.com/kuzzleio/kuzzle/pull/2787) — the 40 `successes`/`errors` assertions weakened with it, stated in the entry |

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
- **✅ Closed (2026-09-11):** the last piece was *enforcement*. (1) and (3) had shipped as **prose in `sonar-project.properties`**, which the ADR's own governing rule forbids — *a review finding ends as a ratchet, an adopted-list entry or an issue, never as prose alone*. Added a **fifth ratchet**, `cpd-exclusions`, baselined in `.migration/cpd-exclusions.txt` and wired into `npm run ratchet` (so into the `migration-ratchets` CI job and `pr-preflight`). Unlike its four siblings it compares a **set, not a count**: a count would let a PR swap an entry out for a new one, which is precisely the move the entry warns about. It fails on any addition, and — like the others — on an unrecorded removal, so the baseline always mirrors reality. The four remaining exclusions are unchanged: `esWrapper` ×2 ([TD-16](#td-16), declared non-goal), `httpRoutes` (irreducible route table), `memoryStorageController` (belongs with [TD-22](#td-22)).
- **The generalisable part:** *an exclusion list is a ratchet or it is debt.* Writing "this list may only shrink" next to the list changes nothing a reviewer has to notice; the same sentence as a CI check is the only version that survives a rushed conversion PR.
- **Tracked as [#2691](https://github.com/kuzzleio/kuzzle/issues/2691)** (opened 2026-09-09, closed 2026-09-11).
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
- **Scoping pass (2026-09-11), picked up on the step-08 parallel track and put back down:** this entry is **two items of different natures**, and keeping them under one issue is why neither moves.
  - The **`getArrayLegacy` half is a breaking HTTP API change** on three documented routes (`document:mDelete`, `security:mDelete*`, `server:healthCheck`) — `?ids=a,b,c` stops working. It belongs in a major behind a deprecation cycle, and no amount of type-debt scheduling will make it landable on `2-dev`.
  - The **`setResult` half is non-breaking but blocked on a missing API**: the documented replacement does not exist. `RequestResponse.configure()` takes no result, and the `response.result =` setter *calls the deprecated method* — so `RequestResponse` is itself a caller, and there is currently no way to set a result without going through `setResult`. Migrating the ~12 sites means first giving the implementation a home on `RequestResponse` (either `configure({ result })` or a status-preserving setter) and having `setResult` delegate to it. That is a designed PR touching `funnel.ts`'s hot path, not a mechanical sweep — which is why it does not fit the parallel track's "one small single-purpose PR per finding" shape.
  - **Split applied (2026-09-11):** [#2688](https://github.com/kuzzleio/kuzzle/issues/2688) now carries the `setResult` half only (blocked on the API-shape decision); the `getArrayLegacy` half is [#2721](https://github.com/kuzzleio/kuzzle/issues/2721), scheduled for the next major behind a deprecation cycle.
  - **The generalisable part:** *a `@deprecated` tag that names a replacement should be checked against the replacement.* Both of these point at APIs that cannot do the job — one is missing the parameter, the other changes behaviour — so the tags have been generating `NOSONAR` markers instead of migrations for two sprints.
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

> **✅ CLOSED 2026-09-17.** Nine occurrences, five reviews, three diagnostics and one conversion. The harness half's three proposals are all done; the cluster half is split into two entries that are **the ones to read**, both fixed in [#2777](https://github.com/kuzzleio/kuzzle/pull/2777): **[TD-65](#td-65)** ([#2773](https://github.com/kuzzleio/kuzzle/issues/2773)) is *why a message is lost* at formation, and **[TD-67](#td-67)** ([#2776](https://github.com/kuzzleio/kuzzle/issues/2776)) is *why one lost message costs a whole run* — the node that detects the gap broadcasts its own eviction, never receives it, and keeps serving traffic behind nginx with state that stopped advancing. TD-67 carries the ninth occurrence, the first whose log ties the lost message to the failing assertion end to end. **A residual race is documented rather than closed in [TD-65](#td-65) — if `Node out-of-sync` reappears at formation, look there first.** The rest of this entry is the CI harness half, and is history.

The 30-variant functional matrix is `fail-fast`, so **one flake cancels the other 29 jobs** and the PR must be re-run whole. Four occurrences: [#2696](https://github.com/kuzzleio/kuzzle/pull/2696) (sprint 5 G2), [#2708](https://github.com/kuzzleio/kuzzle/pull/2708) — a **docs-only** PR — [#2712](https://github.com/kuzzleio/kuzzle/pull/2712) and [#2718](https://github.com/kuzzleio/kuzzle/pull/2718). All three on 2026-09-10 passed on re-run with no code change.

**A second symptom, on #2718:** `Functional tests (http, 24, 7)` failed on `Given an index "nyc-open-data"` with `PreconditionError: A public index named "nyc-open-data" already exists` — after 41 scenarios had passed, and with every scenario running `admin:resetDatabase` with `refresh: "wait_for"` in a `Before` hook. So the reset returned before the deletion was visible on the node the next scenario talked to: `wait_for` is Elasticsearch's *refresh* contract, not a cluster-wide one. Same root shape as the readiness gap below — **the suite trusts a per-node acknowledgement as if it were cluster state** — and it cancelled the other 29 variants for a PR that touched `package.json`, one CI script and one `Reflect.set`.

Root cause of the common symptom: `run-test-cluster.sh` gates the suite on four `bin/wait-kuzzle` calls, and `wait-kuzzle` resolves on the SDK's **`connected` event** — the WebSocket handshake succeeded. That proves the transport is listening; it proves nothing about the cluster having formed a quorum, which is what the tests actually need. Hence `api.process.not_enough_nodes` in a `Before` hook, 1.7 s into the run.

A second symptom was recorded as unexplained: on #2708 the wait on port 17510 timed out after 60 s while the containers logged `[✔] Kuzzle 2.56.0 is ready` 30 s in. The SDK *does* retry (`Realtime.clientNetworkError` re-calls `connect()` every second, `autoReconnect` on by default), so "it only tried once" is **not** the explanation.

**✅ Root cause found (2026-09-11) — the retry is real but unreachable.** `clientNetworkError()` is the only thing that schedules a retry, and `WebSocketProtocol.onclose` forwards a close to it *conditionally*:

```js
if (status === 1000) { this.clientDisconnected(USER_CONNECTION_CLOSED); }
// do not forward a connection close error if no connection has been previously established
else if (this.wasConnected) { this.clientNetworkError(error); }
```

A socket that is **accepted and then closed before the first successful connection** matches neither branch: `wasConnected` is still `false` on the first attempt. Nothing is emitted, no retry is scheduled, and `connect()`'s promise neither resolves nor rejects — `onopen` never fired and `onerror` never fired either. That is exactly what a *published Docker port whose container is still booting* produces: `docker-proxy` accepts the TCP connection, then drops it. The wait then spends its entire 60 s budget on one dead attempt, which is precisely the log on #2708.

So the SDK's auto-reconnect cannot be the retry mechanism for a *first* connection, only for a re-connection — a distinction worth remembering anywhere else the SDK is used as a readiness probe.

- **Reco:** (1) poll `cluster:status` for the 3 expected nodes after the port waits — this is the state the tests depend on; (2) reproduce the `wait-kuzzle` timeout before touching it; (3) consider `fail-fast: false` on the matrix, so one flake stops hiding the other 29 results.
- **✅ Fixed (2026-09-11)** — all three, in `bin/wait-kuzzle` and the PR workflow:
  - **(1) readiness, done without `cluster:status`.** `funnel.throttle()` is the single gate *every* request passes, and it is where `NOT_ENOUGH_NODES` rejects. With `minimumNodes=3`, a node that answers a request at all *is* a node in quorum — so each attempt now sends `auth:getCurrentUser` (cheap, open to anonymous) and treats any answer other than `api.process.not_enough_nodes` as ready. No credentials, no extra endpoint, and it works unchanged for the single-node waits in `docker-test.sh`. Polling `cluster:status` would have needed an admin login, since anonymous has no `cluster` rights.
  - **(2) reproduced by reading the SDK rather than the logs** — see the root cause above. The retry loop is now ours: a fresh client per attempt with `autoReconnect: false`, each bounded by `ATTEMPT_TIMEOUT` (5 s), inside an overall `MAX_TRIES` deadline. A dead attempt now costs 5 s instead of the whole budget.
  - **(3) `fail-fast: false`** on the functional matrix.
- **A fourth symptom (2026-09-15), and it is the third one again.** `Cluster Monkey Tests` failed twice in an hour, on two unrelated PRs and two different matrix variants — [#2751](https://github.com/kuzzleio/kuzzle/pull/2751) `(24, 7)` seed `d6432db20ca96eff`, [#2753](https://github.com/kuzzleio/kuzzle/pull/2753) `(22, 8)` seed `c884b3318030acc7` — with the same error both times:

  ```
  core.realtime.room_not_found: The room "…" doesn't exist
  >    at HotelClerk.join (lib/core/realtime/hotelClerk.ts:338:29)
  ```

  A `realtime:join` on a room created against another node. Both runs also had the **same node** (`:17510`) slow to come up — "Connection error" on the first, "attempt timed out after 5s" on the second — so the suspicion is a node that joins late and answers requests before its room table has caught up. Both passed on re-run with no change.

  Note what the readiness gate can and cannot say here. Its fix above is exactly right about *quorum*: `funnel.throttle()` stops rejecting once the node is in the cluster. But that is **peer discovery, not state propagation** — nothing in `wait-kuzzle` waits for realtime rooms, and nothing could, since there is no request whose answer means "I have everyone's rooms". So this is the third symptom's shape once more, one layer further in, and the gate is not the place to fix it.

- **A fifth symptom (2026-09-16), and it is the sharpest so far: the membership views disagree.** `Functional tests (legacy:http, 22, 7)` died at the readiness gate, before Cucumber ran:

  ```
  ./bin/wait-kuzzle :17510   6 attempts timed out, then ready
  ./bin/wait-kuzzle :17511   ready immediately
  ./bin/wait-kuzzle :17512   52 attempts, the whole 60s budget,
                             "this cluster is disabled because there
                              aren't enough nodes connected"
  ```

  ~~`kuzzle_node_prod` runs **without the cluster plugin**, so the cluster is exactly nodes 1-3 and `minimumNodes: 3` leaves no slack — all three must be connected.~~ **Wrong on both halves, corrected 2026-09-16 (see the seventh occurrence below).** The cluster is **core**, not a plugin: `kuzzle.ts:335` starts it whenever `config.cluster.enabled`, and the `cluster` entry in nodes 1-3's *"Successfully loaded 3 plugins"* is a different thing. `kuzzle_node_prod` is a **full cluster member**, so the cluster is **four** nodes against a `minimumNodes` of 3 — there is slack, and the losses are not a quorum-sizing problem. Nodes 1 and 2 answered, which means each of them counted enough members; node 3 counted fewer, for a minute, and said so. Its container logged no error, no fatal and no exit.

  So this is not "a node was slow to start", which is how the fourth symptom was first read. **Two nodes considered the cluster formed while the third did not** — an asymmetric membership view, which is the same disagreement the `realtime:join` failures show one layer up, where a node answers requests with a room table the others do not share.

  What it is **not** is a readiness-gate failure: the gate reported the truth. The cause is in cluster membership itself (`lib/cluster`, still JavaScript), and it is not identified.

- **The cleanest witness of the same disagreement, and the one to reproduce against.** `features/BulkController.feature:137`, two **consecutive steps of one scenario**, with nginx balancing over nodes 1-3:

  ```
  ✔ Given a collection "garden":"fruits"
  ✖ And I "create" the following multiple documents:
      PreconditionError: The index "garden" does not exist.
  ```

  (`Scenario: Bulk mWrite allows custom kuzzle metadata`.) The step that creates the index returned success, and the very next step — routed to another node — did not see it. Passes on re-run. This is the third symptom (`nyc-open-data already exists`) and the fifth (asymmetric membership) in their shortest form: **no reset, no cluster formation, no realtime state — one write acknowledged by one node and not visible to the next.** Two steps and one feature file make it the cheapest reproduction we have, and it is where work on this should start.

- **A sixth symptom (2026-09-16), and the first the log dump made readable — it corrects the reading of the fifth.** `Functional tests (legacy:websocket, 22, 8)` on [#2761](https://github.com/kuzzleio/kuzzle/pull/2761), a PR touching `waterfall`, one `pluginsManager` annotation and `vault`. `dump-cluster-logs.sh` turned an hour of work into one `grep`:

  | time | what |
  |---|---|
  | 10:16:46.989 | node 3 logs `[✔] Kuzzle 2.56.0 is ready` — **first of the three** |
  | 10:16:48.015 | `ERROR [CLUSTER] Node out-of-sync: 1 messages lost from node knode-spicy-radiologist-99792` |
  | 10:16:50.524-526 | both peers `evicted. Reason: heartbeat timeout` |
  | 10:16:50.527 | `Not enough nodes active (expected: 3, active: 2). Deactivating node until new ones are added.` |
  | 10:16:51 → 10:17:51 | `wait-kuzzle :17512` rejects `not_enough_nodes` for the full budget |

  **It is not "a node was slow", and not only "the views disagree".** Node 3 was the *fastest*, it **did** reach quorum — `Node.init()` blocks until `countActiveNodes() >= minimumNodes`, which is why it logged ready at all — and then **lost** its peers 3.5 s later and never regained them. The gate reported that truthfully for 60 s.

  **The node evicts itself over a real message loss**, at cluster formation, before any test runs. And the reason this thread has survived five reviews without a root cause is a printf: the gap is reported as `messageId - lastMessageId - 1` while `lastMessageId` already holds the *expected* id, so a one-message loss prints `0 messages lost` and reads as a spurious eviction. [TD-58](#td-58) / [#2762](https://github.com/kuzzleio/kuzzle/issues/2762), and it should land **before** sprint 8 converts `lib/cluster`.

  **The identities puzzle is [TD-59](#td-59), resolved a run later:** every node draws **two** independent `knode-*` names — `global.nodeId` (what it logs under) and the cluster's own, from `idCardHandler.createIdCard()`. Same generator, same prefix, nothing prints both. So the peers named in cluster lines are the *other* halves of the same four processes, and no cluster log line has ever been attributable to a container. That is why this analysis had to be reconstructed from timestamps.

- **A seventh occurrence (2026-09-16) — the first fully attributable one, and it names a culprit.** `legacy:mqtt, 22, 7` on [#2765](https://github.com/kuzzleio/kuzzle/pull/2765), with [TD-59](#td-59)'s fix in place so every id maps to a container:

  | container | id |
  |---|---|
  | `kuzzle_node_1` | `knode-illustrious-ungoliant-80341` |
  | `kuzzle_node_2` | `knode-irritating-poseidon-29609` |
  | `kuzzle_node_3` | `knode-determined-gaia-50422` |
  | `kuzzle_node_prod` | `knode-infamous-zephyrus-18239` |

  Every out-of-sync report in the run names **the same source**, and it is `kuzzle_node_prod`:

  ```
  node_3 11:44:35.984 ERROR Node out-of-sync: 1 messages lost from node knode-infamous-zephyrus-18239
  node_1 11:44:35.988 WARN  Node "knode-determined-gaia-50422" evicted.
                            Reason: Node out-of-sync: 1 messages lost from node knode-infamous-zephyrus-18239
  node_2 11:44:36.011 WARN  … same …
  node_3 ×7 more through 11:44:40.908, then
  node_3 11:44:41.523 WARN  Node "knode-infamous-zephyrus-18239" evicted. Reason: heartbeat timeout
  ```

  (Nodes 1 and 2 are reporting `gaia`'s **self**-eviction, broadcast by `evictSelf`, whose reason names the peer *it* lost sync with.)

  So the shape is: **the production-mode node drops a sync message at formation, and whoever reads it self-evicts.** `kuzzle_node_prod` differs from the other three in exactly one way in `.ci/test-cluster-{7,8}.yml` — `NODE_ENV: "production"` — which makes its publisher the first place to look, not the membership logic. Two prerequisites had to land before this was even statable: [TD-59](#td-59) (ids that map to containers) and the log dump covering the suite.

- **An eighth occurrence (2026-09-16), and it corrects the seventh: the culprit is not `kuzzle_node_prod`.** Four jobs of one run on [#2767](https://github.com/kuzzleio/kuzzle/pull/2767) — `http 20/8`, `http 24/8`, `legacy:mqtt 20/8`, `legacy:websocket 20/8` — a docs-only PR. **All four are the ES 8 variants; every ES 7 variant passed.** All four die in readiness with `Rejected: this cluster is disabled because there aren't enough nodes connected`, and the dump reads straight through:

  | container | id |
  |---|---|
  | `kuzzle_node_1` | `knode-tense-naturalist-40368` |
  | `kuzzle_node_2` | `knode-few-thales-21177` |
  | `kuzzle_node_3` | `knode-livid-ehrenfest-76618` |
  | `kuzzle_node_prod` | `knode-chunky-haydn-20724` |

  ```
  node_1 13:10:46.504 INFO  handshake with knode-few-thales-21177 (node_2) complete
  node_1 13:10:46.691 ERROR Node out-of-sync: 1 messages lost from knode-few-thales-21177
  node_3 13:10:46.699 WARN  Node "knode-tense-naturalist-40368" (node_1) evicted.
                            Reason: … 1 messages lost from knode-few-thales-21177
  node_2 13:10:46.707 WARN  … same relay …
  node_1 13:10:48.129 WARN  Node "knode-chunky-haydn-20724" (node_prod) evicted.
                            Reason: … 1 messages lost from knode-few-thales-21177
  node_2 13:10:48.128 / node_3 13:10:48.131  … same relay …
  node_1 13:10:49.273 INFO  Kuzzle is ready (node name: knode-tense-naturalist-40368)
  node_2 13:10:51.601 INFO  Kuzzle is ready (node name: knode-few-thales-21177)
  node_1 13:10:52.326 WARN  Node "knode-few-thales-21177" evicted. Reason: heartbeat timeout
  ```

  **Two nodes self-evict — `node_1` and `node_prod` — and both name the same source: `kuzzle_node_2`.** Not the production node, which is on this occasion a *victim*. The seventh occurrence's `NODE_ENV: "production"` correlation does not survive: it was one draw.

  **What does survive, and is now the finding:** *one node's publisher drops exactly one message at formation, and every node that reads it self-evicts.* The count is `1 messages lost` in both occurrences — a single message, at the same moment in the lifecycle, right after the handshakes complete. Which container plays that role varies; `prod` in the seventh, `node_2` here. So [step 11](steps/11-sprint-8-cluster.md)'s instruction — *look at the publisher, not at the membership logic* — stands, but it is `publisher.js` as a file, not one node's configuration.

  **Also new: the readiness paradox is visible.** `node_1` self-evicts at `46.699` and then prints *"Kuzzle is ready"* at `49.273`. Whatever `Node.init()` waits for, it is satisfied by a node that has already left the cluster — which is why `bin/wait-kuzzle` cannot see this, and is the same gap as *a readiness probe must exercise the thing the caller depends on*.

  **ES 8 only, 4 for 4.** Too clean to ignore and too small a sample to conclude from; the next occurrence should be checked for it first. If it holds, the question is what `.ci/test-cluster-8.yml` does differently to formation timing.

- **✅ Improved (2026-09-16) — the failure now diagnoses itself.** Establishing the paragraph above took an hour and was then lost to a re-run, because `trap 'docker compose logs' err` dumps four Kuzzle nodes interleaved with Elasticsearch's JSON firehose in one flat block, and "which node saw which" is not findable in it. Both cluster scripts now share `.ci/scripts/dump-cluster-logs.sh`: one collapsible group per Kuzzle service, infrastructure tail-limited. This fixes nothing about the race; it makes the next occurrence conclusive instead of expensive.

- **✅ Fixed (2026-09-16) — the log dump was scoped to the wrong half of the run.** Both cluster scripts cleared the trap (`trap - err`) immediately *before* the suite, so `dump_cluster_logs` only ever fired for a **readiness** failure. The class of failure where the nodes' own view is the whole evidence — a scenario failing because state did not propagate — dumped nothing. Two occurrences prove the cost: the 2026-09-16 `legacy:http, 24, 8` failure (74 scenarios, one red step on `services.storage.unknown_collection` at `IndexCache.assertCollectionExists`, **no node logs**), and both monkey `room_not_found` failures (seeds `d6432db20ca96eff`, `c884b3318030acc7`), which are the same shape. The trap now covers the suite in `run-test-cluster.sh` and the monkey run in `run-monkey-tests.sh`.

- **✅ Fixed (2026-09-15) — `fail-fast` on the monkey matrix.** `(3)` above says "on the functional matrix", and that is all it was: `cluster-monkey-tests` kept the default, so each of the two failures above cancelled its five siblings and showed up as six red checks for one real failure. It now carries `fail-fast: false` too. While there, `.github/actions/monkey-tests/action.yml` declares the `es-version` input it has always been passed — the value did reach the step env, so this only silences `##[warning]Unexpected input(s) 'es-version'`, but an action whose declaration does not match its call site is one rename away from silently running the wrong Elasticsearch.
- **⬜ Still open — the third symptom (`nyc-open-data` already exists) is *not* addressed by this.** That one is inside the cucumber `Before` hook, not in the readiness gate: `admin:resetDatabase` with `refresh: "wait_for"` returns on an Elasticsearch *refresh* acknowledgement, which says nothing about the other cluster nodes. The two share a shape — *a per-node acknowledgement trusted as cluster state* — but not a fix.
- **The generalisable part:** *a readiness probe must exercise the thing the caller depends on.* The handshake gate, `wait_for` and quorum are all real signals about the wrong layer for the caller that reads them; the suite needs "this node processes my requests" — and then, one layer in, "this node has the state my last request created", which no probe currently answers.
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


---

## Fourth review — the sprint-6 conversions and the CI, 2026-09-11

The fifteen PRs merged into `2-dev` between #2708 and #2724 were re-read end to end — the three sprint-6 conversions (H1 [#2722](https://github.com/kuzzleio/kuzzle/pull/2722), H2 [#2723](https://github.com/kuzzleio/kuzzle/pull/2723), H3 [#2724](https://github.com/kuzzleio/kuzzle/pull/2724)), the type-debt track, and the CI work of [#2718](https://github.com/kuzzleio/kuzzle/pull/2718)/[#2719](https://github.com/kuzzleio/kuzzle/pull/2719)/[#2720](https://github.com/kuzzleio/kuzzle/pull/2720).

The conversions hold up. H2's four latent bugs are all real and all correctly fixed — including the removal of `removeStacktrace` from the router, verified against `lib/util/stackTrace.ts`'s two branches and the eight protocol call sites that do the real sanitising. H3's decision to write two specs rather than four assertions is the register's own rule working as designed.

Eleven findings, all filed. They fall into three groups.

**The conversions bought their types with a wrong signature, twice** ([TD-40](#td-40), [TD-41](#td-41)). Both times the ADR's "no double cast" standard was honoured and the *outcome* the standard exists to prevent was reached anyway, by a different route: a return type that does not describe what the function returns, and a parameter union that describes a call the body cannot serve. A cast is at least counted by the `any` ratchet and visible to a reader. **A wrong type is cheaper than a cast at review time and more expensive at every point afterwards** — and the file excluded from strict to accommodate it is the one place nothing will look again until step 12.

**The gates are aggregates, and an aggregate hides its worst member** ([TD-42](#td-42), [TD-43](#td-43), [TD-44](#td-44), [TD-45](#td-45)). H3 landed under the coverage threshold and the arithmetic pointed straight at the two files that were not really tested; H2 landed comfortably above it and three files went in with no spec at all — one of them receiving a bug fix in that same PR. The same shape recurs across the tooling: the `any` ratchet counts the hatches it was told about and the debt moved to `as T`; the `js` ratchet counts `*.js` and two Node executables in `bin/` have never been seen; `strict-check.sh` derives a verdict from a log and reads an empty one as success. *A counter is only a gate for the things it can see, and every one of these was blind in the direction of passing.*

**The CI gates what maintainers push, not what arrives** ([TD-38](#td-38), [TD-47](#td-47)). Three iterations (TD-35 → TD-36 → TD-37) went into making the build-payload gate real; it lives in the one job that is fork-gated, and everything hung off that job — 30 functional jobs and 6 monkey jobs — is skipped on a fork PR too.

| Finding | Sev. | Issue |
|---|---|---|
| A fork PR never runs the functional suite, the monkey tests, or the build-payload gate | 🟠 med | [#2725](https://github.com/kuzzleio/kuzzle/issues/2725) |
| `tests/` is in neither the ESLint nor the Prettier glob, and `prettier` is never checked anywhere | 🟠 med | [#2726](https://github.com/kuzzleio/kuzzle/issues/2726) |
| `PluginRepository.load()` declares `Promise<PluginDocument>` and resolves `null` | 🟠 med | [#2727](https://github.com/kuzzleio/kuzzle/issues/2727) |
| `Protocol.init(entryPoint)` type-checks and throws; the documented legacy shape is not the one in the tree | 🟠 med | [#2728](https://github.com/kuzzleio/kuzzle/issues/2728) |
| The coverage rule is per block, so `context.ts`, `protocol.ts` and `protocolManifest.ts` shipped with no spec | 🟠 med | [#2729](https://github.com/kuzzleio/kuzzle/issues/2729) |
| Nothing charges for `as T`, nor for a type-only import written as a value import | 🟡 low | [#2730](https://github.com/kuzzleio/kuzzle/issues/2730) |
| `strict-check.sh` prints "all 125 adopted files pass" when tsc never ran | 🟡 low | [#2731](https://github.com/kuzzleio/kuzzle/issues/2731) |
| `bin/wait-kuzzle` and `bin/start-kuzzle-server` have never been counted by the `js` ratchet | 🟡 low | [#2732](https://github.com/kuzzleio/kuzzle/issues/2732) |
| H3's new `privilegedContext` spec mocks the base class, the fault the same PR removed elsewhere | 🟡 low | [#2733](https://github.com/kuzzleio/kuzzle/issues/2733) |
| CI hygiene: no `concurrency`, a Node matrix on `lint`, an undefined `NODE_LTS_ACTIVE_VERSION` | 🟡 low | [#2734](https://github.com/kuzzleio/kuzzle/issues/2734) |
| Nothing asserts that a stack trace never leaves the process | 🟡 low | [#2735](https://github.com/kuzzleio/kuzzle/issues/2735) |

### Correction made to a finding during verification

The first version of [#2725](https://github.com/kuzzleio/kuzzle/issues/2725) claimed a fork PR is **never type-checked**, on the grounds that `npm run build` appears only in the fork-gated `sonarqube` job. Reading the composite actions rather than the workflow showed that `.github/actions/unit-tests` and `.github/actions/build-and-run-kuzzle` both run `npm run build`, neither is fork-gated, and `tsc` therefore runs eight times on a fork PR. The issue was corrected before any work started on it. *The workflow file is not the whole workflow; a composite action is where half of this repository's CI actually lives.*

### TD-38
**A fork PR never runs the functional suite, the monkey tests or the build-payload gate** · 🟠 medium · `.github/workflows/pull_request.workflow.yaml`

`sonarqube` carries `if: github.event.pull_request.head.repo.fork == false`, which is correct in itself — a fork cannot reach `SONAR_TOKEN`. What is not correct is what has been hung off it: `functional-tests` declares `needs: [sonarqube, unit-tests]`, and a skipped `needs` skips its dependents, so the 30-job functional matrix is skipped on every fork PR — and `cluster-monkey-tests`, which needs it, with it. Nothing in either suite consumes the scan; the dependency was sequencing, to stagger the runner bill.

The same job is also the only place `check-build-payload.sh` runs in the PR workflow — the gate TD-35, TD-36 and TD-37 took three iterations to get right.

- **Fix:** a `build` job (`npm ci` → `npm run build` → `check-build-payload.sh`) with no fork condition, and `functional-tests: needs: [build, unit-tests]`. `sonarqube` keeps a build step of its own, because its Mocha coverage run executes against `dist/` and artifacts are not shared between jobs here.
- **The generalisable part:** *a job's `if:` is inherited by everything downstream of it.* A conditional job is a fine thing; a conditional job in the middle of a dependency chain silently rewrites the gate for everyone who trips the condition.

### TD-39
**`tests/` is neither linted nor formatted, and `prettier` is never checked** · 🟠 medium · `package.json:12,28`

```
"prettier":  "prettier ./lib ./test ./features --write",
"test:lint": "eslint ./lib ./test ./bin ./features",
```

`./tests` is in neither glob — nor is `./features-legacy`. ADR-0001 freezes `test/` and sends every new spec to `tests/`, so the reach of both tools shrinks with each sprint, and the tree they still cover is the one being deprecated. Nothing enforced `@typescript-eslint/no-explicit-any`, the `ban-ts-comment` rule [TD-29](#td-29) installed, or any formatting at all on 15 spec files.

And `prettier` is only ever `--write`: there is no `--check`, in any script or any job. Formatting was applied by whoever remembered.

- **Fix:** both globs widened to `./lib ./test ./tests ./bin ./features ./features-legacy`; a new `prettier:check`, run in the `lint` job; a `.prettierignore` so the new globs stay cheap.
- **What it caught on its first run:** 7 ESLint **errors**, all `@typescript-eslint/no-shadow`, all the same pattern — a `vi.hoisted` factory whose inner `const` shadows the destructured binding it is returned as. Renamed in place (`calls` → `initCalls` returned as `calls`, etc.), 4 files. Plus one unformatted `features-legacy` fixture. 478 warnings remain, overwhelmingly `sort-keys`, which is `warn` project-wide and equally noisy on `test/`; they do not gate.
- **The generalisable part:** *a tool's scope is a glob written once and never revisited, while the tree it was written for is the one the migration is moving away from.* Any rule aimed at "new code" has to name where new code goes.

### TD-40
**`PluginRepository.load()` is declared non-nullable and resolves `null`** · 🟠 medium · `lib/core/plugin/pluginRepository.ts:104`

```ts
load(documentId: string): Promise<PluginDocument> {
  return super.load(documentId).catch((error) => {
    if (this.collection === "users" && error instanceof NotFoundError) {
      return null;                       // ← not a PluginDocument
    }
    throw error;
  });
}
```

Resolving `null` for a missing user is documented, intentional behaviour. The `null` only type-checks because the file is excluded from strict, and [#2724](https://github.com/kuzzleio/kuzzle/pull/2724) records the exclusion honestly: the nullable load cannot be declared against `ObjectRepository<TObject>`'s `Promise<TObject>` without a double cast, which the conversion standard forbids.

The reasoning about the base class is right; the conclusion is not. Refusing the cast did not avoid the lie, it moved it somewhere no tool looks. Every converted caller is now told it holds a document, and at step 12 — the final strict flip — the file has to enter strict with no local fix available.

- **Fix, in order of preference:** widen the base to `Promise<TObject | null>` and let the call sites narrow (which will surface other unhandled `null`s — the point); or give the base an overridable not-found behaviour so the subclass *declares* its nullability; failing both, `Promise<PluginDocument | null>` with a documented `@ts-expect-error` on the override, which is at least visible to the rule [TD-29](#td-29) installed.
- **The generalisable part:** *"no cast" is a proxy for "no unchecked claim", and a wrong return type is the same claim made more quietly.* When a standard cannot be met, the honest move is the visible violation, not the invisible one.
- **✅ Done (2026-09-11):** option 1, and it cost nothing. The base class *already* resolved `null` from all three of `load`, `loadFromCache` and `loadOneFromDatabase` — the declared `Promise<TObject>` was wrong about `ObjectRepository` itself, not only about its subclass. All three widened to `Promise<TObject | null>`, and `PluginRepository.load` to `Promise<PluginDocument | null>`. **`tsc --noEmit` is unchanged**: with `strictNullChecks` off, `T | null` collapses to `T`, so the fix is free today and is the entire difference at step 12. Two further strict errors then stood between `pluginRepository.ts` and the adopted list — a `store` option that inferred its type from a `= null` default, so every subclass passing a real store was passing "something not assignable to `null`", and a `delete result._id` on a type where `_id` is required — both fixed, and **the file is adopted** (strict 125 → 126, implicit-any 457 → 456).

### TD-41
**`Protocol.init`'s union advertises a call shape the body cannot honour** · 🟠 medium · `lib/core/network/protocols/protocol.ts:56`

The first parameter was widened to `string | null | NetworkEntryPoint` so that `protocol.init(entryPoint)` type-checks. The body was not changed to match — it still reads the entry point from the **second** parameter — so that call shape passes the type-checker and throws on `entryPoint.config`. It works today only because every subclass overrides `init` and calls `super.init(null, entryPoint)`; a third-party protocol extending `Protocol` and calling `super.init(entryPoint)` gets a green check and a `TypeError`.

The doc comment's account of the legacy shape is also not the one in the tree: `lib/core/network/entryPoint.js:205` calls `protocol.init(this, new Context())` — `(entryPoint, context)`, not the documented `(name, entryPoint)`.

- **Fix:** two real overloads plus a normalising body. Note `protocol.ts` has no spec of its own ([TD-42](#td-42)); the change should ship one.
- **Related, same block:** `MqttProtocol.disconnect(connectionId, message)` — [#2723](https://github.com/kuzzleio/kuzzle/pull/2723) correctly removed `client.close(undefined, message)` (aedes' `close()` takes a callback and nothing else), leaving `message` an unused parameter, neither prefixed nor deprecated nor removed.
- **The generalisable part:** *widening a parameter to make a call site compile is not the same as supporting that call.* An `any` that was never passed is harmless; a union that was never implemented is an invitation.
- **✅ Done (2026-09-11):** two real overloads and a body that normalises, so `init(entryPoint)` — the shape the type advertised and the body could not serve — works. `protocol.ts` passes strict and is **adopted** (126 → 127), and ships **its first spec**: 9 vitest cases, the first of which is exactly the call that used to type-check and throw.
- **What writing the spec turned up:** the deprecated `(name, entryPoint)` form is not merely discouraged, it is **dead**. `assert(this.name && !name)` — added by [#1645](https://github.com/kuzzleio/kuzzle/pull/1645) on 2020-06-16 — requires `this.name` to be *truthy*, so passing a name to `init` has thrown for five years, including in the one case the deprecation was meant to still allow (no name given to the constructor). The legacy overload is therefore typed `init(name: null, entryPoint)`, the only second shape this method can accept; the `string | null` the first conversion wrote advertised a call that throws. The assert itself is left untouched — fixing it would re-open a path closed for five years, which is a decision about the plugin API, not about this method's type — and recorded here rather than filed, since nothing calls it.
- **The one behaviour change:** a missing entry point now fails an `assert` with *'Invalid "entryPoint" parameter value'* instead of a `TypeError` on `entryPoint.config` three lines later. Both shapes already died there; `httpwsProtocol.js` is still JavaScript and the overloads do not constrain it, so the message is worth having.
- **Also done:** `MqttProtocol.disconnect`'s unused `message` parameter is documented and suppressed rather than left reading as a live argument.

### TD-42
**The coverage rule is an aggregate over the block, so a 0-spec file ships behind its siblings** · 🟠 medium · process

The conversion standard says *"a file with no spec ships one"*, and blocks are measured as an aggregate against SonarCloud's 80% `new_coverage`. [#2724](https://github.com/kuzzleio/kuzzle/pull/2724) shows the rule working: 76.1%, under the gate, and the arithmetic named the two thinnest files. [#2723](https://github.com/kuzzleio/kuzzle/pull/2723) shows it failing: 88.3% aggregate, no spec written, and three files in with none at all — `lib/core/network/context.ts`, `lib/core/network/protocols/protocol.ts`, `lib/core/network/protocolManifest.ts`.

Not theoretical. `context.ts` received a bug fix in that very PR — `context.Request`, `context.RequestContext` and `context.RequestInput` were destructured from `kerror/errors`, which does not export them, so a protocol plugin calling `new context.Request(...)` crashed — and it shipped with no assertion that they are now defined. `protocol.ts` received the logic change that is [TD-41](#td-41). **Four latent bugs were found and fixed in that PR and not one shipped a regression test**, because the aggregate was comfortable and the rule never fired.

- **Fix:** make the rule per file. Extend `.ci/scripts/prepare-coverage.ts`, which already owns and normalises both lcov reports, to assert that every file renamed `.js` → `.ts` in the PR appears in the merged report with at least one hit. A well-covered sibling must not be able to pay for a file nothing executes.
- **The generalisable part:** *an aggregate threshold prices the block and says nothing about its worst member*, and the worst member is exactly the file a reviewer would have asked about.
- ✅ **Done** — pass 3 of `.ci/scripts/prepare-coverage.ts`, run from the `sonarqube` job with `COVERAGE_BASE_SHA` taken from `github.event.pull_request.base.sha`. Three things it needed to be real rather than decorative: it reads the `D`+`A` shape as well as the `R` one, because `--find-renames` records the *most* rewritten conversions as a delete plus an add (`context.js` → `context.ts` in #2723 is one of them, and it is one of the three files this finding is about); it does nothing at all when the base commit is unset, since outside a PR there is no set of "files this change converted"; and its escape hatch, `.migration/coverage-exempt.txt`, takes a reason on the same line and prints it back on every run — the only admissible one being that the file has no executable line to hit. Verified in both directions against #2723's own base commit: 14 conversions named and exit 1, and `✔ no .js → .ts conversion` / exit 0 on a PR that converts nothing. The gate carries 13 vitest cases of its own (`tests/ci/prepareCoverage.test.ts`), which also put the script inside `tsc --noEmit`'s program for the first time. *Not done:* `.ci/` is still outside the prettier/eslint scopes [TD-39](#td-39) extended to `tests/`.

### TD-43
**Nothing charges for a single `as` assertion, nor for a type-only import written as a value import** · 🟡 low · `scripts/ratchet.sh`, `.eslintrc.json`

The `any` ratchet counts `: any`, `as any` and `as unknown as`, and its own comment explains why the third is there: *"it is the escape hatch a conversion reaches for once `': any'` is forbidden, so leaving it out would just move the debt."* It then stops one step short. `as SomeType` is the next hatch and the debt moved there on schedule — sprint 6 alone added `as PublishPacket` ×4, `as PluginDocument` ×4, `{} as TConfig`, `{} as Record<LogLevel, …>`, `as HttpVerb`. 16 in `lib/**/*.ts` today, against a ratcheted 205 `any`. Unlike `any`, a wrong `as` does not degrade to a permissive type — it asserts a specific wrong one, silently.

Separately, `lib/core/plugin/pluginContext.ts` imports `Kuzzle` as a value and uses it only as a type. Elided by `tsc` today; the moment `verbatimModuleSyntax` or `isolatedModules` is on — which is step 12 — `pluginContext` → `kuzzle` becomes a runtime circular `require`.

- **Fix:** a sixth ratchet, `casts`, counting `as [A-Z]` minus `as const` and minus what the `any` ratchet already owns; and `@typescript-eslint/consistent-type-imports` as an error, with the mechanical `import type` pass it forces.
- **Deliberately not bundled** with the TD-38/39/44/45/47 tooling PR: a new baseline interacts with sprint 6's remaining PRs (H4–H6), so it lands between sprints rather than across them.
- 🟦 **The type-only-import half landed with [TD-49](#td-49)** (2026-09-14), because it turned out to be *load-bearing* rather than stylistic: `lib/types/Global.ts` imported `Backend` as a value to declare `var app`, so every module that touched the global type pulled the backend barrel → `kuzzle` → `lib/cluster/*.js` at runtime. `@typescript-eslint/consistent-type-imports` is now an error and its autofix has run over the lint scope (135 files, no change to the emitted JavaScript). `disallowTypeAnnotations` is off — an `import()` in a type position has none of this problem. **The `casts` ratchet half followed on 2026-09-15.**
- **What that changes about the entry's framing:** it was filed as *nothing charges for this*, i.e. an enforcement gap. Half of it was in fact a correctness bug in the module graph that only a test runner which actually loads modules could see — `tsc` elides the import, so nothing in the type system ever complains.
- ✅ **Closed (2026-09-15, [#2743](https://github.com/kuzzleio/kuzzle/pull/2743)):** the `casts` ratchet is in, wired into `npm run ratchet` (so into the `migration-ratchets` CI job and `pr-preflight`), baseline `.migration/casts-baseline.txt` = **87**.
- **The filed predicate did not survive contact, and that is the entry's real lesson.** `as [A-Z]` matches **84** times across `lib/**/*.ts`, and most of those are not assertions: `import * as Cookie from "cookie"`, `import * as URL from "url"`, and plain English — *"tracked as TD-43"*, *"we try to parse it as JSON"*, *"Kuzzle ships as CommonJS"*, *"the same as Node"*. The "16" in the paragraph above was an eyeball count of the assertions that happened to be *visible* in a sprint-6 diff, not a measurement of the tree. Both numbers were wrong: there are **87** assertion nodes. The gap matters beyond arithmetic — a ratchet whose predicate fires on a comment teaches contributors to reword comments to get a PR through, which inverts the point of having one. So `casts` is the first ratchet that **parses** instead of grepping: `scripts/count-casts.ts` walks the TypeScript AST via `ts.createSourceFile` and counts `AsExpression` and `TypeAssertionExpression` nodes. It is also the first that counts **nodes, not matching lines** — the `any` ratchet gives a second `any` on an already-counted line for free, and there was no reason to inherit that.
- **What it does not count, and why each exclusion is a claim:** `as const` — it narrows to what is already written and cannot assert a wrong type, so it is outside the hazard entirely; `as any` and `as unknown` — the `any` ratchet's, and double-charging would mean a single fix has to move two baselines; both halves of `x as unknown as T` *and* of `x as any as T` (the form `lib/kerror/index.ts` uses) — same reason; `satisfies T` — checked against the annotation instead of asserted over it, i.e. the fix rather than the hatch; and `x!` — a different hatch with a different cost, which this entry never covered.
- **Verified negatively:** four probe assertions appended to a `lib/` file — `{} as Date`, `{ a: 1 } as const`, `{} as any`, `{} as unknown as Date` — move the count by exactly **+1**, and the ratchet fails with `88 > baseline 87`.

### TD-44
**`strict-check.sh` fails open: a tsc that never ran reads as "all adopted files pass"** · 🟡 low · `scripts/strict-check.sh`

```bash
npx tsc -p tsconfig.strict.json --noEmit > "$LOG" 2>&1 || true
```

The exit status was discarded and the verdict derived purely from grepping the log for `error TS` against each adopted path. A tsc that never got as far as reporting diagnostics — an OOM kill, a malformed `tsconfig.strict.json`, a missing `typescript` after a bad install — produces a log with no matching line and the script prints `✅ strict: all 125 adopted file(s) pass.` and exits 0. This is the check that guards the migration's central invariant, and it was the one member of the set that failed **open**. (`ratchet.sh`'s `implicit-any` has the same `|| true` and fails closed by accident: a crashed tsc yields a count of 0, which trips the "progress — update the baseline" branch.)

- **Fix, and why it is not an exit-code check:** the first attempt treated `exit > 1` as "did not run" and broke immediately — tsc returns 2 both for "I found errors in your code" and for "I could not read your config". The status alone cannot separate the cases, so the discriminator is the output. Two guards: any line matching `^error TS` is a config- or CLI-level diagnostic (TS5xxx/TS6xxx/TS18003) printed with no `path(line,col)` prefix, meaning tsc never read the project asked for → hard fail; and a non-zero exit with no `path(line,col): error TS` line anywhere → hard fail. Plus a guard on an empty `$ADOPTED`, which used to print `✅ all 0 adopted file(s) pass`.
- **Verified negatively, three ways:** a broken `extends` → caught by the first guard (and worth noting *why* it needed that guard — with no config tsc happily fell back to compiling `dist/` and filled the log with genuine diagnostics about the wrong files); `mv node_modules/typescript` → caught by the second, and `npx` had silently downloaded the unrelated `tsc@2.0.4` package from npm, which prints a banner and exits 1; and the normal run, still `✅ 125`.
- **The generalisable part:** *a check that reads its verdict out of another process's stdout has to prove that process ran.* Absence of an error message is not evidence of absence of errors.

### TD-45
**Extensionless Node executables in `bin/` are invisible to the `js` ratchet** · 🟡 low · `scripts/ratchet.sh`

```bash
current="$(find lib bin -type f -name '*.js' ! -name '*.d.ts' | wc -l)"
```

`bin/start-kuzzle-server` and `bin/wait-kuzzle` are `#!/usr/bin/env node` scripts with no extension. Neither has ever been counted. The baseline said **20**; the real figure is **22**, and the `bin/` floor the ADR describes as "3, all plugin fixtures under `bin/plugins/available/**`" is **5**.

Same class of defect as [TD-30](#td-30), which corrected a file's *classification*; this corrects the *predicate*. It bites now: [#2719](https://github.com/kuzzleio/kuzzle/pull/2719) rewrote `bin/wait-kuzzle` and added ~100 lines of JavaScript to `bin/` during a TypeScript migration whose stated invariant is "no new `.js` under `lib/` or `bin/`", and the ratchet could not see the file. (`! -name '*.d.ts'` is also dead: no path matches both `*.js` and `*.d.ts`.)

- **Fix:** match on the shebang as well as the extension, and re-record the baseline at its true value. **The baseline goes up, 20 → 22** — the one direction this ratchet is built to forbid. That is correct here and only here: the metric did not regress, the instrument was wrong, and freezing a known-false floor to preserve a monotonic number would be the worse trade. Both files remain in scope for conversion; `bin/wait-kuzzle` first, being the one with logic worth type-checking.
- **The generalisable part:** *a ratchet measures its predicate, not its label.* "`.js` files under `lib/` and `bin/`" and `-name '*.js'` are not the same set, and the gap is invisible precisely because the counter reports a number rather than a list. It now reports what it counted.

### TD-46
**`privilegedContext`'s new spec mocks the base class it exists to exercise** · 🟡 low · `tests/core/plugin/privilegedContext.test.ts`

[#2724](https://github.com/kuzzleio/kuzzle/pull/2724)'s strongest move was deleting a Mocha spec that faked its own subject — *"it stubbed `AbstractManifest.load()` to a no-op … so it never exercised the base at all"*. The vitest spec added beside it `vi.mock`s `PluginContext`. But `PrivilegedPluginContext` **is** `PluginContext` plus one assignment, so what remains asserts an assignment to a field on a stub the test itself declared; it would pass if `PluginContext` were deleted. The one property worth pinning — that a privileged context is a *complete* plugin context which additionally carries `kuzzle` — is exactly the one the mock removes.

The mock is presumably there because the real constructor reaches `global.kuzzle`. The sibling `pluginManifest.test.ts` shows the answer: give it a `global.kuzzle`.

- **Also, in that sibling:** `mkdtempSync` runs once per fixture and nothing ever removes the directories (five per run, forever); and `globalThis.kuzzle` is set in `beforeEach` and never restored — harmless only because vitest isolates per file by default, i.e. the spec is correct by virtue of a config setting it neither states nor controls.
- **The generalisable part:** *a review finding is a rule, not an anecdote.* "A spec that stubs its subject's base class is not testing anything" was learned and written down in the PR body, and broken twenty lines away in the same commit — because it was applied to the file under repair rather than adopted as a check on the file being written.
- ✅ **Done**, and *not* the way this entry expected. Dropping the mock and handing the real constructor a `global.kuzzle` **cannot run**: `pluginContext.ts` → `index.ts` → `funnel.ts` → `controllers/` crosses `import x = require("…")`, which vite leaves for Node's resolver, which cannot resolve a `.ts` path. That is [TD-49](#td-49), filed from this finding, and it is *why* the mock was there. So the vitest spec was **removed** rather than kept as a weaker second witness — `test/core/plugin/context/privilegedContext.test.js` already exercises the real class through `KuzzleMock`, and a note there records that the port waits on TD-49. The sibling's two defects are fixed: the fixture directories are removed in an `afterAll`, and `globalThis.kuzzle` now comes from `tests/mocks/kuzzle.ts` — a small, readable fixture (what the subject touches at construction, nothing more) with a `restoreKuzzle()` that puts back what was there, so the spec no longer depends on vitest's per-file isolation without saying so.
- **What the finding was actually about, in hindsight:** the mock read as a testing choice and was a resolver limitation. *A spec that stubs its subject's collaborator is sometimes reporting that the collaborator cannot be loaded — which is a fact about the build, not about the test.*

### TD-47
**CI hygiene: no `concurrency`, a pointless Node matrix, an undefined Node version, no least-privilege** · 🟡 low · `.github/workflows/pull_request.workflow.yaml`

The workflow schedules roughly 50 jobs per push and nothing cancels a run the next push supersedes, so three pushes in a row mean three full runs to completion. `lint` and `error-codes-check` ran on `node-version: [20, 22, 24]`, which cannot change either verdict — and `lint` is a `needs:` of three other jobs, so the slowest of three identical runs sat on the critical path.

The sharpest of the four: `NODE_LTS_ACTIVE_VERSION` is referenced four times, in `error-codes-check` and `sonarqube`, and **defined nowhere** — the workflow has no `env:` block, and the `env` context reads only workflow/job/step env. Both jobs called `setup-node` with an empty `node-version`, ran on whatever Node the runner image shipped, and rendered in the UI as the bare string `Node version`. The sibling workflows define `NODE_VERSION` instead, and disagree: `release` says `"24"`, `sbom-release` says `"22"`.

- **Fix:** workflow-level `env: NODE_VERSION`, `permissions: contents: read`, a `concurrency` group with `cancel-in-progress`, and `lint` pinned to one Node. Four jobs saved per run and a shorter critical path, on top of the cancellations.
- **Not done here:** pinning third-party actions to a commit SHA. `actions/checkout@v4`, `SonarSource/sonarqube-scan-action@v7.0.0` and `actions/create-github-app-token@v3` are referenced by mutable tag; the mitigation is a SHA plus a version comment, kept current by dependabot. Left out of this PR so the diff stays one reviewable idea.
- **Note on the interaction with [TD-33](#td-33):** `cancel-in-progress` and the `fail-fast: false` [#2719](https://github.com/kuzzleio/kuzzle/pull/2719) put on the functional matrix pull in the same direction, not opposite ones — finish every variant of the commit under test, abandon every variant of the commit nobody is asking about.

### TD-48
**Nothing asserts that a stack trace never leaves the process** · 🟡 low · `lib/util/stackTrace.ts` and its 8 call sites

[#2723](https://github.com/kuzzleio/kuzzle/pull/2723) removed a `removeStacktrace` call from `router._executeFromHttp`. **The removal is correct** — verified against `lib/util/stackTrace.ts:71`, which takes an `Error` or a *serialized* response, against `_res` being a `KuzzleRequest` that matches neither branch, and against the eight call sites in `httpwsProtocol.js` (`:455`, `:936`, `:990`), `mqttProtocol.ts:287` and `entryPoint.js` (`:269`, `:313`, `:332`, `:349`) that do the real sanitising on `toJSON()` output. The call had been a no-op for as long as it had existed.

What remains is that the property is guarded by a comment. `removeStacktrace`'s own docstring says it "must be invoked by all protocols" — an obligation stated in prose, spread over eight call sites in four files, two of which (`entryPoint.js`, `httpwsProtocol.js`) are still JavaScript and are exactly what sprint 6's H6 is about to rewrite. No test asserts the outcome. A conversion that drops one of the eight fails nothing.

- **Fix:** functional-suite scenarios, not unit tests — the property is about what crosses the wire. With `NODE_ENV` ≠ `development`, provoke a 500 over HTTP and assert `content.error.stack` is absent; the same over WebSocket, since `httpwsProtocol` serves both and sanitises them on different paths (`:455` vs `:990`); ideally the same for a notification (`entryPoint.js:349`).
- **The generalisable part:** *when a review concludes "this call was always dead, the real work happens elsewhere", the same reading has just established where the invariant actually lives — and that nothing is testing it there.* The dead call was, in effect, the only thing naming the requirement.
- ✅ **Done** — `features/StackTrace.feature`, four scenarios. The property holds only outside development mode (development keeps the stack and highlights it), and every node of the functional cluster ran with `NODE_ENV=development`, so the suite had no node that could express it: `.ci/test-cluster-{7,8}.yml` now runs a **fourth node in production mode** on port 17513, outside nginx's rotation *and outside the cluster* — nothing in the suite reads state from it, and a fourth cluster member would add synchronisation traffic to all thirty functional jobs for no benefit. The scenarios address it by port, the way `Network.feature` already addresses node 1 by 17510.
- **The assertions are made against the wire, not against the SDK.** The first WebSocket attempt asserted `error.stack` on the SDK's error object and failed — the SDK rebuilds the error client-side, so that stack is the *caller's* and says nothing about what the server sent. The step now opens a raw socket (`ws`, added as a direct devDependency) and reads the JSON frame.
- **Two of the four scenarios are controls**, one per transport, asserting that the development node *does* carry a stack. Without them the other two would also pass against a response that never had a stack — a renamed action, a wrong route, an error raised before the handler. This is [TD-42](#td-42)'s lesson in the functional suite: *an assertion that cannot fail is not evidence, and the cheapest way to know it can fail is to watch it fail.*
- **Verified negatively:** with `removeStacktrace`'s non-development branch disabled, the HTTP scenario fails with the real 500 payload, stack and all.

### TD-49
**The vitest tree cannot load anything that reaches `lib/api/controllers`** · 🟠 medium · `lib/**/*.ts` (25 sites)

Found while fixing [TD-46](#td-46), and it is the reason TD-46 exists.

```
Error: Cannot find module '../../util/extractFields'
Require stack:
- /var/app/lib/api/controllers/documentController.ts
❯ lib/api/controllers/documentController.ts:33:24
    33| import extractFields = require("../../util/extractFields");
```

`import x = require("…")` is TypeScript's CommonJS import form. Vite's SSR transform leaves the `require(…)` call in place, so it reaches **Node's** resolver — which cannot resolve a `.ts` path. Every module reachable through one of these is unloadable from a vitest spec.

**A class, not a file:** changing that one line to an ESM import moves the error to `import apiControllers = require("./controllers")` in `funnel.ts`. There are **25** in `lib/**/*.ts`, 11 of them in `lib/api/controllers/index.ts`, and `pluginContext.ts` → `index.ts` → `funnel.ts` → `controllers/` puts the whole API surface behind them. A vitest spec can exercise `lib/util` and `lib/core/shared`; it cannot exercise most of `lib/core`.

- **Fix:** replace the form with a standard ESM import — `esModuleInterop` is on and the targets use `export =`, so a default import is the shape. Mechanical, type-checked, and covered by the 3027 Mocha specs. Prerequisite work for **step 12** in any case: `verbatimModuleSyntax`/`isolatedModules` reject this form outright, which is where [TD-43](#td-43)'s type-only-import half already points.
- **Not bundled** into the TD-46 PR: 25 files across `lib/api` and `lib/core` is a different diff from a test fix.
- **The generalisable part:** *the frozen suite and the new one do not resolve modules the same way, so "the Mocha spec passes" says nothing about whether the vitest tree can load the subject at all.* The gap surfaces as a mocked collaborator, which reads like a testing choice.
- ✅ **Done** (2026-09-14). 24 of the 25 are standard ESM default imports; `lib/util/didYouMean.ts` keeps the form and now carries a comment saying why — `test/util/didYouMean.test.js` rewires it and calls `__set__("didYouMean", …)`, which addresses the *compiled variable by name*, and a default import compiles to `didyoumean_1.default`, so the stub would silently miss. It goes when that spec moves to vitest.
- **The rewrite was necessary and not sufficient — three further walls sat behind it**, found one at a time by re-running the spec, each one a module pulling far more of the application than it uses:
  1. **type-only imports written as value imports** ([TD-43](#td-43)'s second half) — the big one, and the reason it looked like whack-a-mole: `lib/types/Global.ts` alone put the whole backend barrel behind *every* module that touches `global.kuzzle`;
  2. **`lib/` importing the package's own `index.ts`** — `pluginContext` took `KuzzleRequest`/`RequestContext`/`RequestInput` from the barrel that re-exports `pluginContext` itself, and `BackendCluster` from the backend barrel for one `new BackendCluster()`. Both now import the module that defines what they use. 12 more of these remain in `lib/`, all currently type-only and therefore harmless — *while the rule holds them so*;
  3. **a lazy `require()` in a constructor body** — `pluginContext`'s `require("../validation/baseType")`, now a static import (`baseType` has no runtime import of its own, so there was no cycle to break). One other survives, `backend.ts`'s `require("../plugin/plugin")`, and it cannot be static until H5 converts `plugin.js`.
- **The witness is a test, not a count.** `tests/core/plugin/privilegedContext.test.ts` is back, this time with **no mock of any kind** — the shape TD-46 wanted and could not have — and it replaces the Mocha spec rather than sitting beside it, so **mocha 150 → 149**. Without it nothing would fail if wall (1) came back, since `tsc` is blind to all of this by construction.
- **The generalisable part, second half:** *"this is a style rule" and "this is what makes the program loadable" can be the same rule.* `consistent-type-imports` reads as a lint preference right up until a runner that actually executes the import graph asks for it.


### TD-50
**c8's merge loses coverage for any module loaded more than once in a process** · 🔴 high · `.ci/scripts/merge-coverage.ts`, `package.json`

Found while opening sprint 6's H4, which [step 09](steps/09-sprint-6-core-ii.md) had sized as a **+390 covered-line spec effort** on `lib/core/validation/validation.js` (36.2%). The file turned out to be **99.2%** covered by the specs it already has. There was no spec effort to do.

**The tell was in the report all along: line coverage far below branch coverage.** `validation.js` read 36% of lines against **93% of branches**. Those two cannot diverge that way in an honestly-measured file — a branch cannot be exercised on a line that never ran, so branches sit at or below lines. Every one of the five files left to convert in the sprint carried the same signature, +24 to +57 points.

**The mechanism.** `mock-require`'s `reRequire` gives each test a fresh module instance, and **43 spec files use it**. V8 then compiles the module several times and the process reports several `ScriptCoverage` entries for one URL. c8 merges those with `mergeProcessCovs` (`@bcoe/v8-coverage`), which works on **V8 ranges, before conversion**, and that merge is lossy — a function V8 never compiled in one instance is *not reported* there, which is not the same as *executed zero times*, and the range merge cannot tell the two apart.

Measured on `validation.js` with three spec files, the three instances and the two merges:

| | statements covered (of 1180) |
| --- | ---: |
| scriptId 1809 | 186 |
| scriptId 2141 | 878 |
| scriptId 2216 | 995 |
| **c8's report** | **508** ← below its own largest input |
| **merged as istanbul** | **1171** |

The three instances produce an **identical** 1180-entry `statementMap`, so merging the converted `FileCoverage` objects is a per-key sum and is exactly right. The loss is entirely in doing it at the V8 level first.

- **Fix:** `.ci/scripts/merge-coverage.ts` re-derives `coverage/mocha/lcov.info` from c8's raw temp directory, converting each `ScriptCoverage` separately through `v8-to-istanbul` and merging the results. Wired into `npm run test:unit:mocha:coverage`, so CI and `pr-preflight` both get it; `prepare-coverage.ts` then runs on the result unchanged.
- **Blast radius.** Overall mocha coverage **81.4% → 92.7%**; 29 files gain more than 5 points, several enormously (`cluster/subscriber.js` 28.3% → 98.9%, `cluster/publisher.js` 34.2% → 99.4%, `core/auth/passportWrapper.ts` 52.7% → 100%). It has been understating the gate since c8 was introduced, for `.ts` conversions as much as for `.js`.
- **Which direction it failed in:** *closed*. Understated coverage blocks work, it does not let defects through — no conversion was waved past on a bad number. What it cost is plan: the sprint was sequenced, and two PRs sized, against phantom debt.
- **The generalisable part:** *a coverage number is the output of a merge, and a merge is a claim about what two measurements have in common.* Every other gate in this ADR reads one number from one run. This one silently combined several and the combination was wrong — and the arithmetic that would have caught it (branch > line is impossible) was sitting in the same report from the start.


### TD-51
**The application logger is never flushed on shutdown** · 🟡 low · `lib/kuzzle/kuzzle.ts`

```js
await this?.log?.flush?.();
await this?.pluginsManager?.application?.log?.flush?.();
```

The second line is a no-op and always has been. `log` is set on the **application instance** (`Backend`, `this.log = new Logger(...)`), while `pluginsManager.application` is the **`Plugin` wrapper** around that instance, and nothing anywhere assigns a `log` to a wrapper — `Backend` sets `version`, `commit` and `openApi` on it, and that is all. The optional chain turned a wrong property path into silence.

Found by H5's conversion: typing `pluginsManager.application` as `Plugin` made the access a compile error, which is the only reason anyone looked.

- **Fixed** 2026-09-17 ([#2769](https://github.com/kuzzleio/kuzzle/pull/2769), closes [#2747](https://github.com/kuzzleio/kuzzle/issues/2747)): the flush is routed to the instance — `pluginsManager?.application?.instance?.log?.flush?.()` — and `PluginInstance` now declares `log?: Logger`, so the path is typed rather than reached through the index signature. The application's buffered logs are written on shutdown, which is the behaviour change the finding asked for, and `test/kuzzle/kuzzle.test.js` asserts both loggers are flushed.
- **The generalisable part:** *optional chaining is a null guard, not a correctness guard.* `?.` over a property that never exists is indistinguishable, at runtime, from `?.` over one that is merely absent right now. Only a type can tell those apart, and this line sat in the shutdown path unread for as long as the file was JavaScript.


### TD-52
**Three things `httpwsProtocol` reads that nothing ever sets** · 🔴 high · `lib/core/network/protocols/httpwsProtocol.ts`

All three were found by H6's conversion, and all three are invisible to JavaScript for the same reason: reading a property that does not exist yields `undefined` rather than failing.

#### 1. The multipart file-size limit is not enforced

```js
if (part.data.byteLength > this.maxFormFileSize) {
```

`this.maxFormFileSize` is **never assigned** anywhere in `lib/`. The configured value is parsed and validated (`lib/config/index.ts` turns `"1MB"` into a number and asserts it), and `parseHttpOptions` puts it in `httpConfig.opts.maxFormFileSize` — nothing copies it onto the instance. So the comparison is `byteLength > undefined`, which is **always false**, and a multipart upload of any size passes.

The spec that covers this path is the tell: `test/core/network/protocols/http.test.js` does `httpWs.maxFormFileSize = 2;` **by hand** before asserting the rejection. It sets the property production never sets, so it passes while production does not enforce anything.

- **Severity:** the limit exists to bound memory per request. `maxRequestSize` still caps the whole body, so this is not unbounded, but the per-file limit a user configures does nothing.

#### 2. An HTTP connection's headers are always empty

```js
const connection = new ClientConnection("HTTP/1.1", getHttpIps(response, request), request.headers);
```

`request` is a uWS `HttpRequest`, which has **no `headers` property** — its headers are only reachable through `forEach`, which is exactly how `HttpMessage` collects them two lines later. So `ClientConnection` receives `undefined`, falls back to `{}`, and `connection.headers` is empty for every HTTP connection — while `ClientConnection`'s own doc says *"for http, will receive the request headers"*.

#### 3. `Protocol.joinChannel`'s return value

Not a bug, but the same family: the base class returns `{ channel, connectionId }` and every override returns nothing. A vitest spec pins the base's echo, so the declared type is now `… | void` rather than either half of the truth.

- **Fixed** 2026-09-17 ([#2769](https://github.com/kuzzleio/kuzzle/pull/2769), closes [#2749](https://github.com/kuzzleio/kuzzle/issues/2749)): (1) the instance property is gone and `httpParseMultipart` reads `this.httpConfig.opts.maxFormFileSize`, the same way the file already reads `maxEncodingLayers` and `allowedContentTypes` — the configured limit is enforced, and the spec configures it instead of setting it by hand; (2) a `getRequestHeaders(request)` helper collects the headers once and both `ClientConnection` and `HttpMessage` receive them, so `connection.headers` finally holds what `ClientConnection`'s doc promises. (3) is unchanged: it was never a defect. Both changes are **behaviour changes** — the point of each is that something starts happening — which is why they waited for their own PR rather than riding in H6's conversion.
- **The generalisable part:** *a comparison against `undefined` is not a check, and JavaScript cannot tell you which of your reads is one.* Two of these sat in the HTTP entry point, the file step 09 called the riskiest of the migration, and both were found by writing down what the types were rather than by reading the code.

### TD-53
**`KuzzleConfiguration` is `Partial<…>`, and that is what keeps config readers out of strict** · 🟠 med · `lib/types/config/KuzzleConfiguration.ts`

```ts
export type KuzzleConfiguration = Partial<IKuzzleConfiguration>;
```

Every top-level section — `dump`, `services`, `security`, `validation`, `server`, … — is therefore optional, and under `strictNullChecks` every read of one is `possibly undefined`. Found by sprint 7's I2: `internalIndexHandler` and `dumpGenerator` convert cleanly, pass `tsc --noEmit`, and **cannot be adopted into strict** — not for anything in them, but because between them they read `config.dump`, `config.services`, `config.security` and `config.validation`.

The errors are all the same shape:

```
dumpGenerator.ts(158,12):        'global.kuzzle.config.dump' is possibly 'undefined'.
internalIndexHandler.ts(93,7):   'global.kuzzle.config.services' is possibly 'undefined'.
internalIndexHandler.ts(216,13): Property 'authToken' does not exist on type 'SecurityConfiguration | undefined'.
```

- **Why it is `Partial` at all:** the type serves two jobs at once. It describes what a **user** may put in a `.kuzzlerc` — where every section is genuinely optional — *and* what `global.kuzzle.config` holds at runtime, which is that file **merged over the packaged defaults**, where no section is ever missing. One name for both, so the looser of the two wins everywhere.
- **Fix:** split the two. `IKuzzleConfiguration` is already the total shape; `global.kuzzle.config` should be typed with it, and the partial kept for what the user supplies (`Partial<IKuzzleConfiguration>`, under a name that says so). The change itself is small; the blast radius is not, since every config reader's narrowing assumptions change at once — which is why it is its own piece of work and not a conversion's.
- **Until then:** a converted file that reads config is adopted into strict only once this lands. I2 leaves both its files out of `.migration/strict-adopted.txt` rather than scattering guards for a condition that cannot happen.
- **Tracked as [#2756](https://github.com/kuzzleio/kuzzle/issues/2756).**
- **The generalisable part, corrected by [TD-54](#td-54):** *a ratchet measures the file it names, but a type can make a file unmeasurable from the outside.* That is true, and it was over-applied. Measured across the whole of sprints 6 and 7, the config shape accounts for **14 of 246** strict errors. The strict list mostly *is* a quality score per file — these two files are the case where it is partly something else, not the proof that it generally is.

---

## Fifth review — the sprint 6/7 conversions, 2026-09-16

The seven PRs merged into `2-dev` between [#2745](https://github.com/kuzzleio/kuzzle/pull/2745) and [#2755](https://github.com/kuzzleio/kuzzle/pull/2755) were re-read end to end: sprint 6's H4/H5/H6, sprint 7's I1/I2, and the two ADR PRs.

**The conversions hold.** Zero `as any`, zero `: any`, zero `@ts-ignore` across 5 200 lines of new TypeScript. Four of the equivalence notes were re-verified against the pre-conversion JavaScript and all four are exact: `validate`'s dead `if (collectionSpec)` (the `|| {}` fallback is on the line above), the validators branch's `check(...) && isValid` (the check still runs, so its message still lands), `Buffer.from(content.data)` for a JSON-serialised Buffer, and `Number(headers["content-length"])` against the JavaScript's `>` coercion. The gate-driven refactors are documented to a standard that made this review possible at all.

**What the review found is one shape, in three sizes.**

The conversions typed the code and deferred the question the types exist to ask. 246 strict errors across the six largest converted files, of which 14 are the config shape the ADR named ([TD-54](#td-54)) — so the exclusions were read as blocked when they were mostly unattempted, and the generalisation drawn from two files has been corrected in [step 10](steps/10-sprint-7-kuzzle.md). At the next size down, the same deferral produced [TD-56](#td-56), which is [TD-40](#td-40) written again in a helper added to make a conversion compile: *a ratchet a file is exempt from cannot catch the defect it exists for.* At the smallest, [TD-55](#td-55) is one merged lookup that turns a rejected pipe chain into a silent success, and [TD-57](#td-57) is a type that strict cannot see through and a spec that asserts "it threw" in a function where every path throws.

Two of these were already the sprint's own findings, and the compiler had both: [TD-52](#td-52)'s unenforced multipart limit is a `TS2564` on line 134 of the file it was found in by hand, and [TD-51](#td-51) was found only because a wrapper got a type. That is the argument for [TD-54](#td-54) in one line — *the remaining 232 are the same class of question, unanswered.*

**Also filed:** the missing tracker for [TD-53](#td-53) ([#2756](https://github.com/kuzzleio/kuzzle/issues/2756)), and the `garden` witness recorded in [TD-33](#td-33) — two consecutive steps of one scenario, which is the cheapest reproduction of the cross-node disagreement we have.

| Finding | Sev. | Issue | Status |
|---|---|---|---|
| `KuzzleConfiguration` is `Partial<…>` — tracker opened | 🟠 med | [#2756](https://github.com/kuzzleio/kuzzle/issues/2756) | 🔴 |
| 232 of 246 strict errors in the conversions are not TD-53 | 🟠 med | [#2757](https://github.com/kuzzleio/kuzzle/issues/2757) | 🔴 |
| `waterfall.shift()` resolves where the JavaScript rejected | 🟡 low | [#2758](https://github.com/kuzzleio/kuzzle/issues/2758) | ✅ |
| `bindPluginMethod` declared non-nullable, returns `undefined` | 🟡 low | [#2759](https://github.com/kuzzleio/kuzzle/issues/2759) | ✅ |
| `vault`: false type on first call, vacuous env-var spec | 🟡 low | [#2760](https://github.com/kuzzleio/kuzzle/issues/2760) | ✅ |

**What did not survive verification.** Two candidates were dropped: `validation.ts:174`'s move from lodash `get(spec[index], collection)` to `has(indexSpec, collection) && indexSpec[collection]` is a *hardening* (the lodash form resolves paths and reaches the prototype), not a regression, and deserved a line in H4's equivalence note rather than a ticket; and `_initHooks`' `debug()` call now runs before the target is validated rather than after, which changes one log line on a path that then throws.

**The rule for sprint 8.** `lib/cluster` is the last conversion sprint. If it lands the way these did, the migration finishes with its six biggest files typed and unchecked — so the DoD for a conversion should name the strict count it leaves behind, the way it already names coverage.

### TD-54
**232 of the 246 strict errors in the sprint 6/7 conversions are not TD-53** · 🟠 med · Enforcement · [#2757](https://github.com/kuzzleio/kuzzle/issues/2757)

The six largest files converted in sprints 6 and 7 are in TypeScript and out of `.migration/strict-adopted.txt`. Running the strict program over them (`npx tsc -p tsconfig.strict.json --noEmit`, 2026-09-16):

| File | `--strict` errors |
|------|------:|
| `lib/core/validation/validation.ts` | 95 |
| `lib/core/network/protocols/httpwsProtocol.ts` | 51 |
| `lib/core/plugin/pluginsManager.ts` | 42 |
| `lib/core/plugin/plugin.ts` | 27 |
| `lib/core/network/entryPoint.ts` | 14 |
| `lib/kuzzle/dumpGenerator.ts` | 11 |
| `lib/kuzzle/internalIndexHandler.ts` | 6 |
| **total** | **246** |

[Step 10](steps/10-sprint-7-kuzzle.md) attributes the exclusion to [TD-53](#td-53) and generalises from it. **14 of the 246 are the config shape**; the rest are not:

| Diagnostic | Count |
|---|---:|
| `TS18048` — *X is possibly undefined* | 76 |
| `TS2345` — argument not assignable | 43 |
| `TS18046` — *`error`/`e` is of type `unknown`* (catch bindings) | 25 |
| `TS2531` / `TS2532` / `TS18047` — object/null guards | 49 |
| `TS2769` — no overload matches | 18 |
| rest | 35 |

Even in the two files the generalisation was drawn from it does not hold: they carry 17 errors between them, 6 of which are not the config shape — two `unknown` catch bindings (`dumpGenerator.ts:81,83`), an unguarded `Array.prototype.shift()` result (`:247`), `corefiles[0]` passed as a `PathLike` (`:172`), an unguarded index (`:254`), and an overload mismatch (`internalIndexHandler.ts:203`).

- **Why it matters beyond the ratchet.** Two of the sprint's own findings are in this list, and the compiler had both: [TD-52](#td-52)'s unenforced multipart limit is `httpwsProtocol.ts(134,10): Property 'maxFormFileSize' has no initializer and is not definitely assigned in the constructor`, and [TD-51](#td-51) was found only because H5 gave a wrapper a type. The other 232 are the same class of question, unanswered — `httpwsProtocol.ts(397)`'s `socket.count` on a back-pressure counter, `validation.ts(350-372)`'s `specSubset` indexed six times without a guard.
- **Reco:** (1) a per-file triage of the 246 splitting *needs a guard the runtime can reach* from *needs a type the runtime already guarantees* — the first kind is a bug list; (2) the correction to step 10's generalisable part, done above; (3) a rule for sprint 8, because `lib/cluster` is the last conversion sprint and if it lands the same way the migration finishes with its six biggest files typed and unchecked.
- **The generalisable part:** *a conversion that compiles is not a conversion that checks.* The `js` ratchet counts files moved; nothing counted what the move was worth, and the strict list — the thing that does count it — was read as blocked when it was mostly unattempted.

---

### TD-55
**`waterfall.shift()` resolves silently where the JavaScript rejected** · 🟡 low · `lib/kuzzle/event/waterfall.ts` · [#2758](https://github.com/kuzzleio/kuzzle/issues/2758)

The JavaScript asked two questions — `hasNext()` about the chain, then an indexed read of the value. Sprint 7's I1 merged them into one truthiness test, and the two forms disagree on a chain entry that is not callable:

- **Before:** `hasNext()` is `true`, `next()` calls `undefined(...)`, the `TypeError` reaches `waterfallNext`'s `try`, and the chain **rejects**.
- **After:** `shift()` answers `undefined` and the chain **resolves** with the payload it has — silently, skipping every remaining step.

Unreachable today: `pluginsManager.resolveEventHandler` rejects a non-callable target at registration. It is a ticket for *what* silently succeeds — a pipe chain is where a plugin denies a request, and a truncated chain reported as success is the one failure mode this file must not have.

- **✅ Fixed (2026-09-16):** `exhausted` answers the chain, `invokeNext()` answers the value and throws a named `TypeError` into the same `try` the JavaScript relied on. `noUncheckedIndexedAccess` is why the call could not simply be written back the way it was.
- **The generalisable part:** *two questions merged into one lookup are only equivalent when the value can answer both.* Safe for `pipeRunner`'s `Denque`, which owns its elements; unsafe for an array of third-party callables.

---

### TD-56
**`bindPluginMethod` is declared non-nullable and returns `undefined`** · 🟡 low · `lib/core/plugin/pluginsManager.ts` · [#2759](https://github.com/kuzzleio/kuzzle/issues/2759)

```ts
function bindPluginMethod(instance: PluginInstance, name: string): PluginMethod {
  const method = instance[name];

  if (!isPluginMethod(method)) {
    return undefined;
  }

  return method.bind(instance);
}
```

This is [TD-40](#td-40) — *declared non-nullable, resolves `null`* — written a second time, two sprints later, in a helper added to make the conversion type-check. It compiled because `pluginsManager.ts` is not in `strict-adopted` ([TD-54](#td-54)): without `strictNullChecks`, `undefined` is assignable to everything.

The branch is dead — all four call sites establish the member is callable first — so the cost is what the *next* caller reads off the signature.

- **✅ Fixed (2026-09-16):** the return type is `PluginMethod | undefined`. Under the current non-strict program the union collapses, so no call site needs a guard yet; the guards appear the day the file joins `strict-adopted`, which is also the moment to decide whether the dead branch should throw with the unresolved name instead. `isThenable`'s predicate, which claimed `Bluebird<unknown>` for a duck-typed `then`/`catch` check, now says `Promise<unknown>`.
- **🔒 Gated (2026-09-16):** `strict-check.sh` now fails on `TS2366` and on `TS2322: Type 'undefined' is not assignable` **over the whole program, adopted or not** — the one diagnostic class the adoption list cannot help with, because the defect is precisely that the file is exempt. It is deliberately narrow: not "strict everywhere" (the other ~1 600 diagnostics are [TD-54](#td-54)'s per-file triage), only the subset where the type states something the code contradicts on the same line, with no guard to write and nothing to decide.
  Three sites existed and are fixed: `idCardHandler.ts:176` (`candidate` is `string | undefined` after the first turn of [TD-59](#td-59)'s loop — which is what makes the `??` fall through), `profile.optimizedPolicies` (cleared before persisting, and two readers already tested it for `undefined`), and `kuzzleError.props`. No cascade: the 135 adopted files still pass, total strict errors 1 602 → 1 599. Verified negatively by reintroducing the `kuzzleError` one, the way [TD-44](#td-44) established.
- **The generalisable part:** *a ratchet a file is exempt from cannot catch the defect it exists for.* TD-40 was found by strict; TD-56 is TD-40 in a file strict does not read. The fix is not to adopt the file — it is to pick the defect class that does not need the file adopted.

---

### TD-57
**`vault`: a type that is false on the first call, and a spec that asserts nothing** · 🟡 low · `lib/kuzzle/vault.ts`, `test/kuzzle/vault.test.js` · [#2760](https://github.com/kuzzleio/kuzzle/issues/2760)

1. **`let ENV_VAULT_KEY: string;`** is never assigned at declaration and is read on the first call. `vault.ts` **is** in `strict-adopted` and passes: TypeScript's definite-assignment analysis covers locals, not module-scope `let`, so the declared type was false for every read before the first assignment.
2. **`should(() => vault.load()).throw()`** — no matcher — was the only test of the `KUZZLE_VAULT_KEY` path. Without the env var, `load()` throws the *missing-key* assertion instead, so the test passed either way. It asserted that `load()` throws, which every other test in the file already establishes.
3. **The memoisation was untested.** `kuzzle-vault` deletes the variable from the environment after reading it, and Kaaf loads the vault twice — which is the entire reason the module-scope variable exists.

- **✅ Fixed (2026-09-16):** `string | undefined`; the env-var spec asserts *which* error comes back, not that one does; and two tests cover the memoisation — the key survives the environment being cleared, and it does not survive a fresh process. The spec re-requires the module per test so that module state stops leaking between them.
- **🔒 Gated (2026-09-16):** two `no-restricted-syntax` selectors over `test/`, `tests/`, `features/` and `features-legacy/` reject a matcher-less `should(fn).throw()` / `.throwError()` and `expect(fn).toThrow()` / `.toThrowError()`. `.not.throw()` is excluded — "does not throw" is a complete assertion; the vacuous one is the positive. It found **15** sites in three files, all now pinned to an error id or message, and one of the fifteen was pinned to the wrong id first: `zrangebyscore`'s `limit: "1"` answers `api.assert.invalid_argument`, not `invalid_type`, which is the rule making its own case.
- **What pinning them showed.** `pluginsManager`'s two "already an application" / "already some plugins" tests assert the *same* message — setting the application adds it to `_plugins`, so the second guard is unreachable by the route the test name claims — and the setter's second assertion, on the `application` property, is covered by neither. `memoryStorageController`'s "non-numeric coordinate" case passes on the geopoint-shape error just as happily as on the float error it means to exercise.
- **The generalisable part:** *`should(fn).throw()` with no matcher is not a test of why.* In a function whose control flow is four `assert`s, "it threw" is what every path has in common.

---

### TD-58
**`Node out-of-sync` reports one fewer message than was lost** · 🟠 med · `lib/cluster/subscriber.js:754-760` · [#2762](https://github.com/kuzzleio/kuzzle/issues/2762)

```js
this.lastMessageId = this.lastMessageId.add(1);

if (this.lastMessageId.notEquals(message.messageId)) {
  await this.localNode.evictSelf(
    `Node out-of-sync: ${message.messageId - this.lastMessageId - 1} messages lost from node ${this.remoteNodeId}`,
  );
```

`lastMessageId` has already been advanced to the id this node *expects*, on the line above, so the number of missing messages is `messageId - lastMessageId`. The `- 1` is a leftover from computing the gap against the *previous* id.

| expected | received | really lost | reported |
|---:|---:|---:|---:|
| 1 | 2 | **1** | **0** |
| 1 | 3 | 2 | 1 |

`Long` is not the culprit: `long`'s prototype defines `valueOf`, so the subtraction coerces correctly.

- **Why it is worth more than an off-by-one.** It is why [TD-33](#td-33) has survived five reviews without a root cause. Every startup failure there was read as a *membership* problem because the log said `0 messages lost` — which reads as a spurious eviction, so the detector was never believed. It is the only component in that thread telling the truth: a sync message really is lost at cluster formation.
- **✅ Fixed (2026-09-16):** the `- 1` is gone, with the reason on the lines above it. The spec asserted only that `evictSelf` was called, never with what — which is how the off-by-one survived — and now pins both counts: the two-message gap the existing case produces, and the one-message gap that used to read as zero. Landed **before** sprint 8 converts `subscriber.js`, so the sprint's own CI failures are legible while it runs.
- **The generalisable part:** *a diagnostic that under-reports by one is worse than no diagnostic, because it reads as a contradiction and gets dismissed.* Five reviews treated "0 messages lost" as evidence the detector was wrong.

---

### TD-59
**Every node has two unrelated `knode-*` identities** · 🟠 med · `lib/cluster/idCardHandler.ts:163`, `lib/core/backend/backend.ts:245` · [#2764](https://github.com/kuzzleio/kuzzle/issues/2764)

```ts
// backend.ts:245 — becomes global.nodeId
this.nodeId = NameGenerator.generateRandomName({ prefix: "knode" });

// idCardHandler.ts:163 — the id the cluster knows this node by
this.nodeId = NameGenerator.generateRandomName({ prefix: "knode" });
```

Two independent draws from the same generator with the same prefix. `global.nodeId` is what `Logger` stamps on every line, what `kuzzle.ts:313` prints as *"node name"*, and what `accessLogger` and `pluginContext` expose; the cluster uses the other for handshakes, evictions, heartbeats and the Redis IdCard. **Nothing prints both**, so eight identities exist for four processes and

```
[CLUSTER] Node "knode-energetic-defoe-8020" evicted. Reason: heartbeat timeout
```

names a node that no other line in the run mentions. Measured on the `legacy:mqtt, 22, 7` dump of [#2763](https://github.com/kuzzleio/kuzzle/pull/2763): the four containers log as `brash-nietzsche`, `crooked-ghostwriter`, `illegal-cow` and `lucky-dancer`, while the cluster traffic names `energetic-defoe`, `zany-giraffe`, `healthy-architect` and `colossal-arborist` — disjoint sets.

- **This is the single biggest reason [TD-33](#td-33) has been unreadable** across six occurrences. Its "seven identities for four containers, unexplained" is this, and its node-by-node timelines had to be rebuilt from timestamps because the names carried nothing.
- **✅ Fixed (2026-09-16), in two halves.** [#2763](https://github.com/kuzzleio/kuzzle/pull/2763) made `handshake()` print both ids, so every dump from that point on is self-attributing whatever else is true. [#2765](https://github.com/kuzzleio/kuzzle/pull/2765) removed the second identity: `createIdCard()` adopts `global.nodeId`.
- **Why adopting it is safe, and why the loop stays.** `global.nodeId` is itself a random draw, but two cases can still leave it unusable — a stale IdCard from a crashed incarnation holding the key, and a Kuzzle running without a `Backend`, where there is no `global.nodeId` at all. Both fall through to a fresh draw on the next turn of the loop that has always been there, and `handshake()` prints both ids **only when they differ**, which is exactly those two cases.
- **The generalisable part:** *two ids from the same generator with the same prefix are one id as far as a reader is concerned.* Nothing in the logs suggested there were two — the extra names read as peers that had come and gone, which is exactly how six reviews read them.

---

### TD-60
**`pr-preflight.sh` measured every branch against the wrong base** · 🟡 low · `.ci/scripts/pr-preflight.sh`

The two heuristic reminders — *"`lib/` changed with no test changed"* and *"this file passes strict but is not adopted"* — both work off a diff:

```bash
base_ref="$(git merge-base HEAD origin/master 2>/dev/null || ...)"
```

The migration's base branch is **`2-dev`**, and `master` is the released 2.56.0. `git merge-base HEAD origin/master` therefore resolves to the release tag commit, **278 commits and 328 changed files** behind the branch under test — so every branch, including one that changed a single file, was measured against the whole migration. The strict-adoption reminder listed files nobody had touched, and the test-coverage reminder was green on every branch that touched any test anywhere in those 278 commits, which is all of them.

Nothing failed, which is why it survived: both checks are `[WARN]`-only, and a warning that is always the same is read as furniture.

- **✅ Fixed (2026-09-16):** the base is `2-dev`, with `PREFLIGHT_BASE` for a branch based elsewhere and the old `master` resolution kept as the last fallback.
- **The generalisable part:** *a diff-based check names a base branch, and a base branch is a fact about the project, not about git.* `origin/master` is the default that is always syntactically right; here it was 278 commits wrong, and the check reported on it in full confidence. Same shape as [TD-45](#td-45) — the predicate, not the label.

---

### TD-61
**Nothing reports the strict count a conversion leaves behind** · 🟡 low · `.ci/scripts/pr-preflight.sh`, `scripts/strict-check.sh`

The mechanism half of [TD-54](#td-54)'s decision (ADR decision register, 2026-09-16). The rule — *a conversion either adopts its files into strict or states, per file, the count it leaves and which errors are guards the runtime can reach* — was recorded as a dated decision-log entry and nowhere a conversion author reads at the time they convert.

- **✅ Done (2026-09-16):** the rule is now a bullet in [ADR § Conversion standards (per file)](ADR-0001-migration-typescript.md#conversion-standards-per-file) and in `CONTRIBUTING.md` › *TypeScript migration*, next to the adoption rule it is the other half of. `scripts/strict-check.sh --count [path…]` prints per-file error counts off the same tsc log as `--candidates`, so it inherits TD-44's fail-closed guards, and prints `?? path (no such file)` rather than `0` for a path tsc never saw. `pr-preflight.sh` detects a `.js` → `.ts` conversion (a git-detected rename, or an `A`/`D` pair when the rewrite fell under the similarity threshold), and for any converted file not in `strict-adopted.txt` prints its count with the reading the PR owes. Verified against [#2753](https://github.com/kuzzleio/kuzzle/pull/2753): it reproduces TD-54's table — `dumpGenerator.ts` 11, `internalIndexHandler.ts` 6.
- **Why a reminder and not a gate.** The number is cheap to compute and worthless alone; what the DoD asks for is the *reading* of it — which errors are reachable guards — and no script can check that a sentence was written honestly. The gate is the reviewer; the script's job is to make sure the number is on the table.
- **The generalisable part:** *a decision recorded only in a decision log is a decision the next author will not read.* The log says what was decided and why; the standards list is what gets followed. A rule that lands in one and not the other is prose.

---

### TD-62
**Fifty-six declarations assigned `null` on the line that declares them** · 🟡 low · `lib/**`

[TD-56](#td-56)'s gate fails on `Type 'undefined' is not assignable`. The same lie written `null` is 56 sites, which is why it is a ticket rather than part of that gate:

| File | Sites |
|---|---:|
| `lib/service/storage/7/elasticsearch.ts` | 16 |
| `lib/service/storage/8/elasticsearch.ts` | 16 |
| `lib/cluster/idCardHandler.ts` | 4 |
| `lib/util/dump-collection.ts`, `lib/util/bufferedPassThrough.ts`, `lib/core/auth/tokenManager.ts`, `lib/api/controllers/serverController.ts` | 2 each |
| 15 others | 1 each |

Almost all are the JavaScript idiom a conversion carried over verbatim — `this.client = null` in a constructor, with the field declared `Client` — so the type is false for the whole window before `init()`, which is exactly [TD-57](#td-57)'s `ENV_VAULT_KEY` at class scope. The fix per site is `| null` on the declaration or a definite-assignment assertion, and it is mechanical; the reason it is `M` and not `XS` is that the two `elasticsearch.ts` files hold 32 of them and their readers then need guards.

- **Why not fold it into TD-56's gate.** A gate that fails on 56 pre-existing sites is a gate nobody can turn on. This one needs a pass of its own, and then the gate widens to `Type 'null'` in the same breath — one line in `check_lies()`.
- **Sequencing:** `lib/cluster`'s four land naturally in **sprint 8**, under the strict-count DoD. The rest is a standalone PR.
- **The generalisable part:** *the narrow version of a gate is the one that ships.* [TD-56](#td-56) could have been filed as "no lying declarations" and stalled on 59 sites; filed as "no `undefined` assigned to a non-nullable", it cost three fixes and is live today, and widening it later is one regex.

---

### TD-63
**`IDCardRenewer` reports a redis failure to a port it never has** · 🟠 med · `lib/cluster/workers/IDCardRenewer.js`

```js
this.parentPort.postMessage({
  error: `Failed to connect to redis, could not refresh ID card: ${error.message}`,
});
```

`this.parentPort` is never assigned anywhere in `lib/`, and it is the wrong API rather than a missing assignment: the worker is spawned with `child_process.fork()` (`idCardHandler.ts:233`) and talks over `process.send`, which every other line of the file does — including the two error paths a few lines below. `parentPort` belongs to `worker_threads`, left behind by an earlier implementation.

The parent turns a worker's `{ error }` into `evictSelf(message.error)`. So when redis is unreachable at worker startup, the `catch` logs, then raises `TypeError: Cannot read properties of undefined`, the rejection escapes an unawaited `async` handler, the worker dies, and `idCardHandler`'s `close` handler evicts the node with the generic *"ID Card renewer worker closed unexpectedly"*. **The node still leaves the cluster; it leaves without the reason** — a redis outage and a worker crash produce the same line.

- **Fix:** `process.send({ error })`, matching the other two paths. A **behaviour change**, so it is not folded into the spec PR that found it; J0's spec pins the current behaviour with a comment naming this entry.
- **Why it outranks its severity.** It is the third diagnostic defect found in this layer in three weeks, after [TD-58](#td-58) and [TD-59](#td-59), and [TD-33](#td-33)'s remaining half is diagnosed by reading eviction reasons out of CI logs.
- **The generalisable part:** *a spec that assigns a property before calling the code is either describing production or replacing it, and only the source can say which.* The existing spec set `idCardRenewer.parentPort = { postMessage: sinon.stub() }` by hand — the same tell as `httpWs.maxFormFileSize = 2` in [TD-52](#td-52), sitting just as long.

---

### TD-64
**A vitest spec on a not-yet-converted file was measured by neither runner** · 🟠 med · `.ci/scripts/prepare-coverage.ts`

Pass 2 gives each file one owning runner, and resolved a spec's target through the `tests/` mirror convention — `tests/<path>.test.ts` → `lib/<path>.ts` or `lib/<path>/index.ts`. **`.js` was not tried.**

So `tests/cluster/command.test.ts`, which has existed and passed since before sprint 8 opened, resolved to nothing: `command.js` was never handed to the vitest report, its mocha record stood, and the three tests in that spec counted for **zero** on the gate.

This is not an edge case — it is the shape [step 11](steps/11-sprint-8-cluster.md)'s **J0** is built on. A file under the coverage threshold has its specs written *before* the rename, so the conversion does not fail CI on a number that has nothing to do with it. Under the old resolution that sequencing could not work: the specs did not count until the rename, which is the moment they were supposed to make safe.

- **Fix:** try `lib/<path>.js` and `lib/<path>/index.js` too. Blast radius is exactly one file today (`command.js`); the other two unresolved specs — `tests/ci/prepareCoverage.test.ts` and `tests/api/controllers/securityController/apiKeys.test.ts` — have no `lib/` target by design.
- **What it was hiding.** `command.js` read **41.5%** raw and **16.9%** after normalisation, and the gate sees the normalised number. Step 11 recorded 41.5% as the correction to an earlier 16.9%; both were mocha figures, one raw and one normalised, and the file was in worse shape than either reading suggested. Measured by the runner that owns it, it is now **98.8%**.
- **The generalisable part:** *a convention that maps names to files encodes an assumption about which files exist yet.* The mirror convention was written when every vitest spec targeted something already converted, and it silently stopped being true the first time someone wrote a spec ahead of a rename — which is the practice the ADR recommends.

---

### TD-65
**A joining node resumes from a counter that its subscription had not yet started tracking** · 🔴 high · `lib/cluster/node.js`, `lib/cluster/subscriber.js`, `lib/cluster/publisher.ts`

This is a reading of [TD-33](#td-33)'s surviving half, obtained while converting `publisher.ts` in sprint 8 J1. It is derived from the code, not from a reproduction — see *What would confirm it* below.

**The cluster talks over two independent sockets.** `publisher.ts` binds a ZeroMQ `PUB` on `config.ports.sync` (7511); `command.js` binds a `ROUTER`/`REP` pair on `config.ports.command` (7510). They share no ordering: a message sent on one establishes nothing about the other.

**A joining node's handshake uses both, in this order** (`node.js`, `handshake()`):

1. For every discovered node, `new ClusterSubscriber(...)` then `subscriber.init()` — which does `socket.connect(syncAddress)` and `socket.subscribe()`.
2. `command.getFullState(nodes)` — a request/response round trip on the **command** channel. The answer carries each node's `lastMessageId`, read off `this.node.publisher.lastMessageId` (`command.js:129`).
3. `command.broadcastHandshake(nodes)`.
4. `subscriber.sync(lastMessageId)` — the subscriber adopts that id as the last message it is deemed to have seen, and from then on expects `lastMessageId + 1`.

**Step 1 does not finish when it returns.** In ZeroMQ, `connect()` is asynchronous and a subscription is a message the subscriber sends *to the publisher*, which does the filtering. Until that subscription reaches the remote `PUB` socket, the remote has no subscriber on this connection and **silently drops** everything it publishes — the *slow joiner*, and the one failure mode the ZeroMQ guide warns about for PUB/SUB.

So let the snapshot in step 2 be taken at T₁ and the subscription register at Tₛ. Nothing in the protocol orders Tₛ before T₁: the two travel on different sockets. **If Tₛ > T₁, every message the remote published in (T₁, Tₛ) is dropped**, while step 4 has told the subscriber to resume at T₁. Its next received message is not T₁+1, `processData` finds the gap, and the node self-evicts with `Node out-of-sync: N messages lost`.

**Why this fits every observation recorded for TD-33:**

- *Exactly one message lost.* At formation the only periodic traffic on the sync channel is `sendHeartbeat`, so the window usually straddles zero or one publication.
- *Right after the handshakes complete.* Step 4 is the first moment the counter is enforced.
- *Any node can be the culprit.* The seventh occurrence blamed `kuzzle_node_prod`, the eighth `kuzzle_node_2`. Under this reading neither is a culprit: the source is whichever node happens to publish inside a peer's window.
- *Timing-sensitive, ES 8 four-for-four in one run.* The window is a race; anything that shifts boot timing shifts how often it is lost.
- *Nothing is wrong with the membership logic*, which is where five reviews looked.

**Second occurrence, 2026-09-17, and it times the loss precisely.** Same variant as the first (`http, 24, 8`), different actors:

```
14:17:52.756  node_1  ERROR Node out-of-sync: 1 messages lost from node knode-jaded-prokofiev-65530
14:17:52.758  node_1  INFO  Successfully completed the handshake with node knode-jaded-prokofiev-65530
```

The gap is reported **2 ms before** the handshake with that node is declared successful, because `node.js` calls `subscriber.sync(...)` **without awaiting it** and logs success on the next line. `sync()` replays the buffer, so the gap is found *inside that replay* — against messages the subscriber had **already captured**, not against something arriving later. The earliest buffered message is `N+2` where the snapshot said `N`: message `N+1` was published while the subscription had not taken effect, and the publisher dropped it. That is this entry's prediction, observed.

**A diagnostic defect falls out of the same two lines:** `Successfully completed the handshake with node X` is printed unconditionally, for a node whose sync against X has already failed. Same family as [TD-58](#td-58) and [TD-59](#td-59) — the cluster's log describing a state the code is not in. Cheap to fix with the main change: `await` the sync, and log success only if it succeeded.

- **What would confirm it.** Log, on the subscriber, the moment its first message arrives against the id it was synced to; or bind the sync socket as `XPUB` with `ZMQ_XPUB_VERBOSE` so subscription arrivals are observable, and compare their timestamps to the `getFullState` response. A reproduction should be possible by delaying `subscriber.init()`'s resolution relative to `getFullState`.
**⚠️ The first fix was incomplete — reopened and completed the same day.** [#2777](https://github.com/kuzzleio/kuzzle/pull/2777) fixed the ordering in `handshake()`, which is the path a **joining** node takes, and missed `addNode()` — the path every **existing** node takes when a new node joins. CI caught it on [#2780](https://github.com/kuzzleio/kuzzle/pull/2780): three nodes reported `1 messages lost` **from the same source, within 8 ms of each other**, 120 ms after that source joined. A per-subscriber race cannot produce that shape; one shared code path with a stale counter can, and does. With [TD-67](#td-67)'s fix in place all three then shut down, so the cluster never became ready — a flaky test turned into a hard failure, which is the honest consequence of making self-eviction mean what it says.

**The lesson is about the fix, not the bug:** *the same ordering defect usually exists once per code path, and a fix verified against the path you found it on says nothing about the others.* `grep`ping for the other callers of `subscriber.init()` would have found it in seconds.

**✅ Fixed 2026-09-17.** `ClusterSubscriber.waitForSubscription(timeout)` resolves once **any** message has been received from the remote node, which is the only observable proof that the subscription is live on its PUB socket, and **both** paths await it before resuming from a counter: `handshake()` before calling `getFullState`, and `addNode()` before `sync()`. No protocol change and no new message type: every node publishes a heartbeat every `cluster.heartbeat` ms (2 s by default) from before it is discoverable, so the wait normally costs less than one round, and a peer that never answers is warned about and left to the existing `fullState === null` retry. Joins are serialised by the `clusterHandshake` mutex, so the cost is per joining node, not per peer.

**⚠️ Residual race, stated rather than hidden.** The resume point comes from `fullState.nodesState`, i.e. from *whichever node answered* — not from the node being resumed. If that third party's record of a peer is older than the first message this node received from it, the gap reappears. It is a much narrower window than the one closed here (one node's processing lag, against a full TCP connect plus ZeroMQ subscription propagation), and it is what [TD-67](#td-67)'s third piece — resynchronise instead of evict — would close for good.

- **Original fix direction, kept for the record.** The counter and the subscription must be ordered by the same channel. Either the joining node signals *subscription established* on the command channel and the remote reports its `lastMessageId` only then, or the resume point travels on the sync socket itself. A subscriber that has never received a message could also tolerate its first gap — cheaper, but it trades a real desync detector for silence.
- **The generalisable part:** *a resume point is only valid if the transport it resumes was already listening when the point was taken.* Two channels, one counter, and no ordering between them is a gap by construction — and the diagnostic that finally exposed it ([TD-58](#td-58)) had been dismissed five times for printing `0 messages lost`.

---

### TD-66
**The strict-count reminder cannot see an uncommitted conversion** · 🟡 low · `.ci/scripts/pr-preflight.sh`

[TD-61](#td-61) gave `pr-preflight.sh` a reminder that detects a `.js` → `.ts` conversion and prints the strict count it leaves behind. It finds conversions with `git diff "$base_ref"...HEAD`, which reads **committed history only**.

Run on sprint 8 J1's two conversions before committing them, it printed `[OK] no .js -> .ts conversion in this branch`. Committing the same tree made it print both files and their counts.

The tell is that the *neighbouring* reminder in the same script, ten lines above, already unions three sources — `"$base_ref"...HEAD`, `git diff` and `git diff --cached` — precisely so it fires on work in progress. Two reminders in one script disagree about what "changed" means, and the one that disagrees is the one enforcing a definition of done.

- **Fix:** give the conversion detector the same three-source union the coverage reminder uses.
**✅ Fixed in [#2796](https://github.com/kuzzleio/kuzzle/pull/2796).** The detector now reads the same three sources as the coverage reminder — **and a fourth the entry did not name**: a freshly written `x.ts` that has not been `git add`ed appears in *no* `git diff` at all, which is exactly the state a conversion is in when its author runs preflight. Untracked `.ts` files are paired against a `.js` that is gone from disk but present in **HEAD** — tested against HEAD rather than the index because the delete may be unstaged, staged or already committed, and only HEAD is true in all three.

Verified by converting a fixture file and running preflight in each state: untracked `.ts` + unstaged delete, and both staged, are now reported; before, both printed *"no .js -> .ts conversion in this branch"*.

- **The generalisable part:** *a check that answers "is this ready?" must read the state it is asked about, not the state it was easiest to diff.* [TD-60](#td-60) was the same script reading the wrong **base**; this is the same script reading the wrong **range**.

---

### TD-67
**A node survives its own eviction and keeps serving traffic** · 🔴 high · `lib/cluster/node.js`, `lib/cluster/subscriber.js`

Found in CI on [#2775](https://github.com/kuzzleio/kuzzle/pull/2775) (`Functional tests (http, 24, 8)`, run 35230334541). It is [TD-33](#td-33)'s **ninth** occurrence and the first whose log ties the lost message to the failing assertion end to end — and it names a second defect, downstream of [TD-65](#td-65).

```
14:01:46.507  node_1  Successfully completed the handshake with node knode-solid-peacock-99998
14:01:47.276  node_2  ERROR Node out-of-sync: 1 messages lost from node knode-solid-peacock-99998
14:01:47.280  node_1  WARN  Node "knode-wrathful-potamoi-85816" evicted. Reason: …1 messages lost…
   … node_2 repeats the same ERROR 9 times, through 14:01:52.422 …
14:02:19              Given an existing collection "nyc-open-data":"yellow-taxi"
                      ✖ Error: Index nyc-open-data does not exist
```

`kuzzle_node_2` **is** `knode-wrathful-potamoi-85816`, and it **never shut down**. Evicted from every peer's view at 14:01:47, it answered HTTP behind nginx for the remaining 33 seconds with state that had stopped tracking the cluster. The failing step is the first one nginx happened to route to it after `loadFixtures` created the index elsewhere.

**Why it survives.** `evictSelf` logs the reason and calls `publisher.sendNodeEvicted(this.nodeId, this.nodeId, reason)`. Every *other* node receives that and takes `handleNodeEviction`'s `message.nodeId !== this.localNode.nodeId` branch, dropping it. The broadcasting node never receives its own publication — a ZeroMQ `PUB` does not loop back — so the `global.kuzzle.shutdown()` branch written for exactly this case is unreachable by the only node that needs it.

**Why one message becomes nine.** `subscriber.js`'s gap branch calls `evictSelf` and returns `false` without resynchronising `lastMessageId`. Advanced by one per message, it stays permanently one behind, so every subsequent message re-trips the check and re-broadcasts. Occurrence counts read off these lines overcount: nine lines, one event.

- **Impact.** A single drop at formation ([TD-65](#td-65) is the mechanism) does not degrade one message — it removes a node from the cluster while leaving it in the load balancer. The node serves reads and writes from state that stopped advancing, and nothing can correct it because every peer has already forgotten it.
**✅ Fixed 2026-09-17**, both defects:

- `evictSelf` now calls `global.kuzzle.shutdown()` after broadcasting. All four of its callers — two in `idCardHandler` for a dead ID-card renewer, two in `subscriber` — mean *this node can no longer be a cluster member*, so all four were leaving a node running that had asked everyone to forget it.
- the gap branch sets `state = EVICTED` before evicting, which ends `listen()`'s loop, so one drop is one event.
- `sync()` now returns whether it stayed in sync, and stops replaying once the replay evicts this node. **This was a latent bug of its own:** the loop went on applying the rest of the buffer and then overwrote `EVICTED` with `SANE` on the way out.
- `handshake()` awaits `sync()` and prints *Successfully completed the handshake* only when it succeeded — the line used to appear 2 ms after the eviction contradicting it.

**Left open on purpose:** *prefer resynchronisation to eviction* — a node that lost a sync message could request a fresh full state instead of leaving. That is a design decision, it is what would close [TD-65](#td-65)'s residual race, and it wants its own discussion.

- **Original fix direction, kept for the record.** (1) `evictSelf` calls the shutdown path directly instead of relying on a broadcast it cannot receive; (2) resync `lastMessageId` or mark the subscriber `EVICTED` so one drop is one event; (3) — a design decision, not a bug fix — prefer requesting a fresh full state over leaving the cluster.
- **Open detail, not invented here:** the reports stop after 5 s and this log does not say why. Worth establishing before assuming the window is bounded.
- **The generalisable part:** *a broadcast is not a way to tell yourself something.* The self-eviction path was written as a message, and the one subscriber that had to act on it is the one that could never receive it.

---

### TD-68
**A notification scope crossed the cluster unchecked** · 🟠 med · `lib/cluster/subscriber.ts`

`sync.proto` types two fields as plain strings — `DocumentNotification.scope` and `UserNotification.user` — while the objects built from them take closed unions: `RealtimeScope` is `"in" | "out" | "all"`, `RealtimeUsers` adds `"none"`. `handleDocumentNotification` and `handleUserNotification` passed the wire value straight into the constructor, and **nothing on either side checked that the string was a member**. Any node on the sync channel could put an arbitrary value into a notification that channel matching and `notifier` then treat as one of three or four known cases.

It is not reachable from the public API — these arrive on the cluster's own PUB/SUB channel — which is what keeps it medium.

**The tell was in the spec, for the third time.** `subscriber.test.js` fed `scope: "scope"`, a value that has never been a member of `RealtimeScope`, and asserted the notification was dispatched. It passed for as long as the file was JavaScript, because nothing could contradict it — the same shape as [TD-52](#td-52)'s `httpWs.maxFormFileSize = 2` and [TD-63](#td-63)'s hand-set `parentPort`. The neighbouring `handleUserNotification` spec was a copy of the document one: it carried `scope`, `requestId` and `rooms`, which that handler never reads, and neither `user` nor `room`, which it does, so it asserted nothing about the handler it named.

- **Fixed in the conversion**, because it could not compile otherwise and the only two options were to validate or to lie in the type. A value outside its union is now treated as the malformed message it is and the sender is evicted, which is the answer this file already gives to an unknown topic or a missing `messageId`. **This is a behaviour change:** before, the value was applied.
- **Worth doing separately:** the lists backing the guards live in `subscriber.ts` and `satisfies` their unions, so an invalid entry stops compiling — but a member *added* to a union and forgotten there would be silently rejected at runtime. One exported constant per union, next to the type, removes that for every consumer.
- **The generalisable part:** *a serialization schema and a domain type that describe the same field are two claims, and only one of them is enforced.* The proto could not express the union, so the union stopped being true at the point the data entered the process.

---

### TD-69
**A node that loses the import lock refuses to boot** · 🔴 high · `lib/kuzzle/kuzzle.ts`, `lib/util/mutex.ts` · [#2782](https://github.com/kuzzleio/kuzzle/issues/2782)

Found in CI on [#2780](https://github.com/kuzzleio/kuzzle/pull/2780) (`Functional tests (legacy:http, 24, 8)`, run 35316879978). `kuzzle_node_3` logged `[✔] Mappings import successful`, then `mappings import is not initialized, initializing...`, then **`Cannot start Kuzzle 2.56.0: Document already exists`** and shut down. `wait-kuzzle` timed out on 17512 and the job went red. **It happened again the same day on [#2783](https://github.com/kuzzleio/kuzzle/pull/2783)** (`Functional tests (legacy:http, 20, 7)`, run 35320332200) — a **docs-only** PR, on `kuzzle_node_prod` this time, with the identical four-line signature. Two occurrences within hours, across different suite/Node/ES combinations, is not a rare window — and the second reddened a PR that changes no code at all.

**This is not [TD-65](#td-65) or [TD-67](#td-67).** The cluster formed correctly — three handshakes, `Cluster initialized`, all plugins loaded — and nothing was lost on the sync channel. The node died in `Kuzzle._import()`. It is filed here because it is the same *symptom class* the register has been tracking since [TD-33](#td-33): a startup race that reddens an unrelated PR.

Two defects, either sufficient on its own:

- **The lock's TTL is shorter than the work it protects.** The mutex on `backend:import:<type>`, constructed with `{ timeout: 0 }`, takes `ttl`'s default of **5 000 ms** and never renews it, while the lock is held across `importMethod()`, `persistHashedImport()` and — the release being in the `finally` — `_waitForImportToFinish()`. An import slower than 5 s lets the Redis key expire under its holder, and a second node acquires a lock the first still believes it owns. Elasticsearch was saturated in the failing run (`131 cluster tasks remaining`), which is exactly when the import is slow. `timeout: 0` makes *acquisition* single-attempt — the intended "only one node imports" — and says nothing about the holder losing the lock mid-flight.
- **Check-then-act across the lock boundary.** `existingRedisHash` and `existingESHash` are read *before* `mutex.lock()` and branched on *after*, so even under perfect exclusion the second holder decides from a snapshot taken before the first holder wrote. It enters the `!existingRedisHash && !existingESHash` branch and calls `document:create` on the fixed id `backend:init:import:${type}` → `Document already exists`, uncaught, out of `_import()` and into the startup path.

- **Impact.** The node does not degrade, it refuses to start. In CI that is a red job on a PR that touched nothing involved. In production it is a node that will not come back from a restart whenever the import is slow — which is when Elasticsearch is already under load, i.e. when you are restarting it.
- **Suggested fix.** Read the hashes *inside* the lock, or make the write idempotent (`createOrReplace`, or treat the conflict on that fixed id as "someone else initialized it"); give the mutex a TTL that covers its body, or renew it while the work runs; and do not let the *hash bookkeeping* failing be fatal when the import itself reported success.
**✅ Fixed in [#2786](https://github.com/kuzzleio/kuzzle/pull/2786) (merged 2026-09-18).** Both reads moved inside the lock, and `persistHashedImport` uses `createOrReplace` on both branches — the id is fixed, so a conflict is convergence rather than death. The TTL is an explicit 60 s, but **the idempotent write is the fix**; the TTL only reduces duplicated work. 4 specs, each verified to fail against the previous implementation. Constructing the mutex re-scored as new code and raised `S1874` (`Mutex` deprecated): it carries `internalIndexHandler.ts`'s justified `// NOSONAR`, because every other node still takes this key with `Mutex`, so converting one site would remove the exclusion it exists for.

**Two pieces deliberately not done, and not tracked anywhere else:** `Mutex`'s 5 s default — a shared primitive under 14 callers, not a bug fix — and swallowing storage failures during bookkeeping, dropped because the conflict was the only realistic one and a blanket catch would hide the rest.

- **The generalisable part:** *a lock whose TTL is a guess about how long its body takes is not a lock, and a decision read before acquiring it is not protected by it.* `Mutex` hands out both mistakes by default — `ttl: 5000`, no renewal — so every caller that guards slow work is a candidate. **7 of the 14 `new Mutex(` sites in `lib/` take the 5 s default** — `clusterHandshake`, the four `hiddenCollection` locks in the ES 7/8 services, `backend:installations` and this one — so this wants an audit, not a one-site fix. The seven that set a TTL explicitly all chose 30 s or 60 s, which says the default is understood to be too short by everyone who thought about it.

---

### TD-70
**The functional suite pins the order of an unordered search** · 🟠 med · `features/step_definitions/controllers-steps.ts`, `features/*.feature` · [#2784](https://github.com/kuzzleio/kuzzle/issues/2784)

Found in CI on [#2783](https://github.com/kuzzleio/kuzzle/pull/2783) (`Functional tests (http, 20, 8)`, run 35320332200), again on a **docs-only** PR — which is what makes it legible as pre-existing. 176 scenarios, one failed, and the one that failed asserts a hit order nothing established: `"_id" does not match. Expected ""test-user"" have ""test-user2""`.

The step at `controllers-steps.ts:70` sorts for the scalar case and compares **positionally** for the object case — `should(result[i]).matchObject(expected[i])`. So `array matching` is order-insensitive while `array of objects matching` is order-sensitive, and **the two names differ in a semantic no reader of a feature file can see**. `SecurityController.feature:444` runs `security:searchUsers` with an `ids` query and no `sort`, so the order is whatever Elasticsearch returns: not a property of the request, and not stable run to run.

- **Scope: 25 `"hits" array of objects matching` assertions**, every one positional against an unordered search — 13 in `SecurityController.feature`, 6 in `DocumentController.feature`, 4 in `AuthController.feature`, 1 each in `CollectionController.feature` and `#BackendImport.feature`. Of the 65 total uses of the step, the other 40 are over `successes`/`errors`/`collections`, where the API's own ordering may genuinely be a contract — worth checking rather than assuming.
- **Suggested fix.** Match the object branch set-wise (each expectation against *some* element, failing with the unmatched one) and add an explicit `in order` variant for the cases where order is the contract. Sorting both sides needs a stable key; set-wise matching avoids inventing one.
- **Why it matters beyond one scenario.** It passes almost always, so the hundredth run spends its failure blaming whichever PR happens to be open — the same cost model as [TD-33](#td-33) and [TD-69](#td-69), but from a test rather than from the product.
**✅ Fixed in [#2787](https://github.com/kuzzleio/kuzzle/pull/2787) (merged 2026-09-18).** The object branch matches each expectation against *some* element, with an explicit `in order` variant for the cases where order is the contract; matching is greedy first-fit, documented on the helper. **The 40 `successes`/`errors`/`collections` assertions accept any order now too, so they are weaker than before** — for the m\* actions that may be a real contract worth pinning back with `in order`, but nothing in the repo states input order is promised, so it was not decided there.

**The 40 weakened assertions were then settled by reading the code, in [#2789](https://github.com/kuzzleio/kuzzle/pull/2789)** — 33 take `in order`, 32 stay insensitive. `successes` (31) is a real contract and a load-bearing one: `_mExecute` pairs `body.items[i]` with `documents[i]`, so a reordered bulk response would attach one document's `_source` to another's result — input order is something the code already depends on, not something observed about Elasticsearch. `collection:list` sorts by name explicitly, and `mGetRoles` resolves the requested ids through `Bluebird.all`, which preserves positions. **`errors` is the one that looked like it should be pinned and must not be:** `_mExecute` seeds it with the pre-bulk rejections and appends the bulk failures after, so it is not in input order at all.

**Two things worth knowing before touching these steps again:** `matchObject` is **not** a `should` built-in, it is `features/support/assertions.ts`, so any standalone harness must load that file; and **cucumber-js passes the inner capture group, not the wrapper** — the arity is not readable from the regex and has to be measured.

- **The generalisable part:** *an assertion stricter than the contract fails on the implementation's freedom, not on a defect.* Nothing promises a search hit order without a `sort`, so pinning it tests Elasticsearch's mood.
