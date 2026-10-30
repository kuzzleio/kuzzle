# ADR-0003: Storage engines as installable drivers

**Status:** Accepted (2026-09-29)
**Date:** 2026-09-29
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io)
**Scope:** `services.storageEngine` — how Kuzzle talks to its database (`lib/service/storage/`, `lib/core/storage/`), how a storage engine is packaged, selected and loaded, and the public surfaces that expose the raw client
**Related documents:** [ADR-0002](../adr-002/ADR-0002-own-api-contract-types.md) (Kuzzle owns its contract types — the driver contract is one more of them) · step files under [`steps/`](steps/)

> Living hub (structure per the `kuzzle-adr` skill). To resume, read **Cold start**.

---

## Decision

### Context

Measured on `2-dev` (2026-09-29):

- **Two storage implementations ship together, one is dead weight.** `lib/service/storage/7/elasticsearch.ts` (3 986 lines) and `8/elasticsearch.ts` (4 008 lines) differ by ~720 diff lines; their `esWrapper.ts` (371 lines each) by 10. The facade `lib/service/storage/Elasticsearch.ts` picks one at runtime from `services.storageEngine.majorVersion`. Both SDKs (`sdk-es7` = `@elastic/elasticsearch@7.13.0`, `sdk-es8` = `@8.17.1`) are runtime dependencies: an ES8 deployment installs and ships the ES7 code and SDK, and vice versa.
- **The roadmap multiplies engines:** Elasticsearch 9, then OpenSearch 2 and 3, then SQL databases. Following today's pattern, each one adds ~4 000 lines and an SDK to every install.
- **The seam already exists.** `ClientAdapter` (`lib/core/storage/clientAdapter.ts:76`) is the only place core code instantiates the storage class (`new Elasticsearch(config, scope)`), once per scope (public / private). The ES8 class exposes 53 public methods (`info`, `search`, `scroll`, CRUD, `m*`, `*ByQuery`, index / collection / mapping management, aliases, `import`…); the engine-specific parts (the `@&` alias naming, ES scroll, Koncorde → ES DSL translation) are internal to it.
- **Storage initializes before plugins.** `kuzzle.ts` runs `new StorageEngine().init()` (l. 272) well before `pluginsManager.init()` (l. 304), and the plugin context assumes a ready storage (plugin private storage, `Repository`). A driver cannot be an ordinary plugin.
- **The raw client leaks into three public surfaces:** `app.storage.StorageClient` / `app.storage.storageClient` (`lib/core/backend/backendStorage.ts`) and `context.constructors.ESClient` (`lib/core/plugin/pluginContext.ts`). The last one does not pass `majorVersion`, so **plugins always receive an ES7 client, even on an ES8 deployment** (see open points).
- **The public API speaks Elasticsearch.** `document:search` queries, collection mappings, aggregations and `scroll` are ES DSL. This is fine for the ES / OpenSearch family; a SQL engine can only support a subset of it.

### Decision

**A storage engine is a driver: an npm package exporting a class that implements a Kuzzle-defined `StorageDriver` contract, selected by configuration and loaded before the storage engine initializes.** `npm install @kuzzleio/<driver>` plus one config line gives a working setup.

1. **A dedicated contract, the plugin system's mechanics.** Not a plugin: a driver exports a `StorageDriver` class and ships a manifest in the spirit of `kuzzle.json` (compatible `kuzzleVersion` semver range — the only versioning of the contract, as for plugins — and declared capabilities). Packages are named `kuzzle-storage-<engine>-<major>` (e.g. `kuzzle-storage-es-9`, `kuzzle-storage-opensearch-2`), unscoped like `kuzzle` and `kuzzle-types` (amended 2026-10-30, see register): the `storage-` part sets them apart from plugins. It is loaded by a dedicated loader before `StorageEngine`. A driver that also needs controllers or pipes ships a regular plugin alongside.
2. **Core + capability groups.** The contract has a mandatory core (CRUD, `m*`, index / collection management, basic search) and optional capability groups (e.g. `scroll`, `aggregations`, `byQuery`, dynamic mappings, aliases) declared in the manifest. Engine-specific mechanics (alias naming, cursors, query translation) stay inside the driver.
3. **ES DSL stays the lingua franca.** The public API does not change. Each driver translates what it supports; a request using an undeclared capability is rejected with a dedicated, documented error — no silent approximation.
4. **Selected by configuration.** `services.storageEngine.driver: "<package name>"` in `.kuzzlerc`; Kuzzle `require()`s it at startup. No auto-discovery (ambiguous with several drivers installed). Without `driver`, the built-in drivers are selected by `majorVersion` exactly as today. `majorVersion` is deprecated when the ES9 driver ships (step 05) — in the documentation only, no startup notice (amended 2026-10-30, see register); it keeps working unchanged until v3.
5. **The contract is exported by `kuzzle`.** Drivers import `StorageDriver`, the capability types and the conformance kit from `kuzzle` and declare it as a `peerDependency`. Pinned by the typings gate (`tests/typings/`), like the other contract types of ADR-0002.
6. **One repository per driver.** `kuzzleio/<driver>`, each with its own CI against its real engine.
7. **Native client through the driver.** Each driver class builds its own typed native client (`createNativeClient(clientConfig)`); `app.storage.storageClient`, `StorageClient` and `ESClient` delegate to it — same names, same behaviour (a new client each, as today), no break.
8. **Hard backward-compatibility rule for v2: an existing ES7 or ES8 stack changes nothing** — same `.kuzzlerc`, same `package.json`, no package to add — through every v2 release, including the one that brings ES9. Enforced by the existing ES7 / ES8 functional matrix, run on its untouched configuration.
9. **Every cluster node runs the same driver.** A node whose driver (package name and version) differs from the cluster's is refused at join, with a dedicated error.
10. **v2 is non-breaking; extraction is v3.** In v2, ES7 and ES8 become **thin internal drivers** wrapping today's classes as-is (no factorisation of the shared code), still shipped with the core; new engines (ES9 first, then OpenSearch) are external drivers only. The next major moves ES7 and ES8 to their own packages and drops `sdk-es7` / `sdk-es8` from the core's dependencies.
11. **The Koncorde → ES DSL translator stays in the core, as an ES-family helper.** `QueryTranslator` (`lib/service/storage/commons/queryTranslator.ts`, publicly exported by `index.ts`) is already shared by the ES7 and ES8 classes; the ES9 and OpenSearch drivers import it from `kuzzle`, like the rest of the contract. It is not part of the mandatory contract: a non-ES driver translates Koncorde filters its own way, but must raise the same `KeywordError` for an untranslatable keyword — `baseController.ts` relies on its shape. It stays in the core at v3 unless step 07 finds a reason to move it.
12. **Three validation layers:** a vitest conformance kit shipped with the contract, run by every driver repo against its engine (Docker); Kuzzle's functional suite (cucumber) run with each official driver, capability-dependent scenarios gated by tags; and the existing ES7 / ES8 matrix staying green unchanged — the safety net of the non-breaking rule.

**Out of scope:** the cache engine (Redis) — storage only; data migration between engines (documentation points to the engines' own tools: snapshot / restore, remote reindex); non-ES drivers — **v2 targets the ES / OpenSearch family only** (essentially the same engine); SQL drivers are expected at v3 at the earliest. SQL stays the contract's *design check* (a SQL driver must be implementable against the core + capabilities without touching the public API), which is why the capability groups exist from step 01.

### Rejected alternatives

- **Driver = a Kuzzle plugin with an "early" loading phase** — reuses the most, but the plugin lifecycle and context assume a ready storage; reworking them costs more than a dedicated loader using the same mechanics.
- **A Kuzzle-owned query language** translated by every driver — cleaner for SQL, but a major API change for every client.
- **Contract = today's 53 methods as-is** — quick for ES9 / OpenSearch, but a SQL driver would implement dozens of methods only to throw "not supported".
- **Auto-discovery of installed `kuzzle-storage-*` packages** — the literal "just `npm install`", but ambiguous with several installed and invisible in the config.
- **Factorising ES7 / ES8 into a shared base in v2** — ~3 300 shared lines to deduplicate, a large rewrite for code the v3 extraction removes from the core anyway.
- **A monorepo (`packages/storage-*`)** — contract and drivers would evolve together, but the maintainer prefers one repository per driver.

### Consequences

- The core grows a loader, a contract and one indirection (`ClientAdapter` → `StorageDriver`); the build only stops carrying unused engines at v3 — v2 only stops the *growth* (ES9 and OpenSearch never enter the core).
- Every contract change becomes a public API change of `kuzzle` for driver authors: the contract is versioned with `kuzzle` and guarded by the typings gate.
- New error codes (unknown / missing driver, incompatible manifest, unsupported capability) need their documentation (`npm run doc-error-codes`).
- Kuzzle's CI gains a driver matrix; each driver repo carries its own engine in Docker.

---

## Target architecture

```
.kuzzlerc  services.storageEngine.driver = "@kuzzleio/<driver>"   (absent → built-in by majorVersion)
      │
      ▼
DriverLoader (before StorageEngine.init)
  require(driver) → manifest check (kuzzleVersion, capabilities) → StorageDriver class
      │
      ▼
StorageEngine ── ClientAdapter(PUBLIC)  ──► StorageDriver instance ──► engine SDK ──► database
             └── ClientAdapter(PRIVATE) ──► StorageDriver instance ──┘
                         ▲
                         │ capability check → dedicated error when undeclared
                API controllers / Repository / plugins

app.storage.storageClient · StorageClient · context.constructors.ESClient  ──►  DriverClass.createNativeClient()

v2 built-in drivers : es7, es8 (thin adapters over today's classes)
external drivers    : ES9 (first), OpenSearch 2 / 3 · SQL at v3
v3                  : es7 / es8 extracted, core ships no engine SDK
```

---

## Cold start

**Where we are (2026-10-30):** ADR **accepted** ([#2948](https://github.com/kuzzleio/kuzzle/pull/2948)). Steps 00–04 are done: the `StorageDriver` contract is exported by `kuzzle`, ES7 / ES8 run as built-in drivers, and `services.storageEngine.driver` loads an external driver (manifest checked, undeclared capabilities rejected, same driver on every cluster node). `describeStorageDriverConformance` (the conformance kit) is exported by `kuzzle` and passes on ES7 / ES8, and the functional suite runs on a driver declaring no capability. Step 05 (ES9 driver, own repository) is open: part A (`storageError` export, ES9 functional setup) merged in [#3103](https://github.com/kuzzleio/kuzzle/pull/3103); the driver exists locally only, waiting for the `kuzzle` beta.

**Next action:** publish `2.61.0-beta.1` (release PR `2-dev` → `beta`), then push the driver to `kuzzleio/storage-es-9` against it and publish its beta (part B) ([detail](steps/05-es9-driver.md)).

**Conventions** (same as ADR-0001 / 0002): base branch `2-dev`; non-breaking only in v2; unit tests in Docker; Claude cannot merge — it hands the maintainer `!` commands.

---

## Step table

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 00 | Fix: `context.constructors.ESClient` built an ES7 client on ES8 deployments | ✅ Done 2026-09-29 | [#2947](https://github.com/kuzzleio/kuzzle/pull/2947) | [detail](steps/00-fix-plugin-esclient.md) |
| 01 | Contract: `StorageDriver` core + capability groups + manifest, exported by `kuzzle`, pinned by the typings gate | ✅ Done 2026-10-29 | [#3099](https://github.com/kuzzleio/kuzzle/pull/3099) | [detail](steps/01-storage-driver-contract.md) |
| 02 | ES7 / ES8 as thin internal drivers; `ClientAdapter` consumes the contract; native client delegation; ES7 / ES8 matrix unchanged | ✅ Done 2026-10-29 | [#3100](https://github.com/kuzzleio/kuzzle/pull/3100) | [detail](steps/02-builtin-drivers.md) |
| 03 | Loader: `services.storageEngine.driver`, manifest check, capability errors, same-driver check at cluster join (+ error-code docs), config & upgrade docs | ✅ Done 2026-10-29 | [#3101](https://github.com/kuzzleio/kuzzle/pull/3101) | [detail](steps/03-driver-loader.md) |
| 04 | Conformance kit (test-runner-agnostic) exported with the contract; capability tags in the functional suite | ✅ Done 2026-10-29 | [#3102](https://github.com/kuzzleio/kuzzle/pull/3102) | [detail](steps/04-conformance-kit.md) |
| 05 | First external driver: `kuzzle-storage-es-9` (own repo), in Kuzzle's functional matrix; `majorVersion` deprecated (doc; warning only when set with `driver`) | 🟦 In progress | [#3103](https://github.com/kuzzleio/kuzzle/pull/3103) | [detail](steps/05-es9-driver.md) |
| 06 | OpenSearch 2 / 3 driver(s) (own repo) | ⬜ To do | — | — |
| 07 | Next major: extract ES7 / ES8, drop `sdk-es7` / `sdk-es8` from the core | ⬜ To do (next major) | — | — |

---

## Decision register

- **2026-09-29** — **Scope: ES / OpenSearch family delivered, SQL anticipated.** SQL is the contract's design check, not a deliverable.
- **2026-09-29** — **ES DSL stays the public query language; drivers declare capabilities** and reject what they do not support with a dedicated error.
- **2026-09-29** — **Driver selected explicitly in config** (`services.storageEngine.driver`), no auto-discovery.
- **2026-09-29** — **Dedicated `StorageDriver` contract, loaded before `StorageEngine`**, reusing the plugin system's mechanics (package + manifest) — not a plugin.
- **2026-09-29** — **Contract = mandatory core + optional capability groups.**
- **2026-09-29** — **Contract exported by `kuzzle`** (drivers `peerDependency` on it).
- **2026-09-29** — **One repository per driver.**
- **2026-09-29** — **Raw client access delegates to the driver's native client** — existing names kept.
- **2026-09-29** — **ES7 / ES8 stay built-in in v2 as thin adapters, no factorisation; extracted at the next major.**
- **2026-09-29** — **Validation: conformance kit + functional matrix + unchanged ES7 / ES8 non-regression.**
- **2026-09-29** — **ES9 is the first external driver.**
- **2026-09-29** — **`ESClient` bug fixed now**, as a standalone fix ahead of step 01: plugins get the client of the configured major.
- **2026-09-29** — **Package names `@kuzzleio/storage-<engine>-<major>`** — `storage-` sets them apart from plugins.
- **2026-09-29** — **Contract versioned by the manifest's `kuzzleVersion` range only**, as for plugins.
- **2026-09-29** — **Same driver mandatory on every cluster node**, checked at join.
- **2026-09-29** — **v2 = ES / OpenSearch family only; non-ES (SQL) drivers at v3.**
- **2026-09-29** — **`majorVersion` deprecated with the ES9 driver; an ES7 / ES8 stack changes nothing** (config, dependencies) across all of v2.
- **2026-09-29** — **`QueryTranslator` stays in the core as the ES family's Koncorde helper**, not part of the contract; drivers raise its `KeywordError` shape.
- **2026-09-29** — **ADR accepted** by the maintainer.
- **2026-10-29** — **Contract methods = what `ClientAdapter` calls today, as they are**; what Kuzzle itself needs (scroll, `deleteByQuery`, `mExecute`, `import`) is core. [step 01](steps/01-storage-driver-contract.md)
- **2026-10-29** — **Capability groups: `aggregations`, `mappingUpdates`, `stats`, `updateByQuery`**; engine hooks (aliases, shard wait) are optional without a capability. [step 01](steps/01-storage-driver-contract.md)
- **2026-10-29** — **Manifest = `manifest.json` at the package root** (`kuzzleVersion`, `capabilities`), read before the driver's code runs. [step 01](steps/01-storage-driver-contract.md)
- **2026-10-29** — **The driver class builds the native client** (static `createNativeClient(clientConfig)`, replacing step 01's instance `getNativeClient()`): the raw client surfaces keep building a new client each, as today. [step 02](steps/02-builtin-drivers.md)
- **2026-10-29** — **Built-in drivers are not compared at cluster join**: a card without a driver is a built-in node, so ES7 / ES8 clusters (and older nodes) join as before; a driver upgrade is a full cluster restart. [step 03](steps/03-driver-loader.md)
- **2026-10-29** — **Undeclared capability → `services.storage_driver.unsupported_capability` (400)**; a declared capability's methods are checked on the driver instance at startup. [step 03](steps/03-driver-loader.md)
- **2026-10-29** — **Conformance kit in `kuzzle`, test-runner-agnostic** (`describeStorageDriverConformance` takes the runner's `describe` / `it` / hooks, asserts with `node:assert`); Kuzzle runs it on ES7 / ES8 in a dedicated CI job. [step 04](steps/04-conformance-kit.md)
- **2026-10-30** — **No `majorVersion` deprecation notice at startup in v2** (an ES7 / ES8 stack has no alternative to switch to); Kuzzle only warns when `driver` and `majorVersion` are both set, `majorVersion` being ignored then. Amends decision 4. [step 05](steps/05-es9-driver.md)
- **2026-10-30** — **Package names unscoped: `kuzzle-storage-<engine>-<major>`**, like Kuzzle's other public packages: on npm, `@kuzzleio` is the private registry's scope (`packages.paas.kuzzle.io`). Amends the 2026-09-29 naming decision. [step 05](steps/05-es9-driver.md)
- **2026-10-29** — **Functional scenarios needing a capability are tagged `@capability-<name>`**, excluded from `KUZZLE_STORAGE_CAPABILITIES` (the driver's manifest list). [step 04](steps/04-conformance-kit.md)
- **2026-10-29** — **Cross-repo loop: the contract only grows within a minor** (optional methods or capabilities), so a released driver stays valid; Kuzzle's matrix tests published drivers, no cross-repo CI. [step 04](steps/04-conformance-kit.md)
- **2026-10-30** — **The ES9 driver: public repo `kuzzleio/storage-es-9`, a copy of the ES8 driver adapted to the ES9 client; Kuzzle's CI installs it from npm (beta first).** `kuzzle` exports `storageError` so a driver throws Kuzzle's storage errors. [step 05](steps/05-es9-driver.md)
- **2026-09-29** — **Out of scope:** cache engine; data migration between engines; ADR written now, implementation after 2.57 stable.

---

## Open points

- **Package granularity:** one package per engine major (`storage-opensearch-2`, `storage-opensearch-3`) assumed — or one per family with a version option, if OpenSearch 2 and 3 turn out to share one SDK?
- **Startup notice wording for `majorVersion`** (step 05): informational, must never fail or alter an ES7 / ES8 startup.
- **Interaction with ADR-0002 step 03** (shared types package): whether the driver contract later moves there.
- *(v3)* Which subset of ES mappings a non-ES driver must accept.

---

## References

- `lib/core/storage/storageDriverLoader.ts` — driver selection (step 03); `lib/service/storage/builtInDrivers.ts` — the ES7 / ES8 drivers (step 02)
- `lib/core/storage/clientAdapter.ts`, `lib/core/storage/storageEngine.ts` — the seam
- `lib/core/backend/backendStorage.ts`, `lib/core/plugin/pluginContext.ts` — raw client surfaces
- `lib/core/plugin/pluginManifest.ts` — manifest mechanics to mirror
- `lib/kuzzle/kuzzle.ts` — init order (storage l. 272, plugins l. 304)
