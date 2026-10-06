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

1. **A dedicated contract, the plugin system's mechanics.** Not a plugin: a driver exports a `StorageDriver` class and ships a manifest in the spirit of `kuzzle.json` (compatible `kuzzleVersion` semver range — the only versioning of the contract, as for plugins — and declared capabilities). Packages are named `@kuzzleio/storage-<engine>-<major>` (e.g. `@kuzzleio/storage-es-9`, `@kuzzleio/storage-opensearch-2`): the `storage-` prefix sets them apart from plugins. It is loaded by a dedicated loader before `StorageEngine`. A driver that also needs controllers or pipes ships a regular plugin alongside.
2. **Core + capability groups.** The contract has a mandatory core (CRUD, `m*`, index / collection management, basic search) and optional capability groups (e.g. `scroll`, `aggregations`, `byQuery`, dynamic mappings, aliases) declared in the manifest. Engine-specific mechanics (alias naming, cursors, query translation) stay inside the driver.
3. **ES DSL stays the lingua franca.** The public API does not change. Each driver translates what it supports; a request using an undeclared capability is rejected with a dedicated, documented error — no silent approximation.
4. **Selected by configuration.** `services.storageEngine.driver: "<package name>"` in `.kuzzlerc`; Kuzzle `require()`s it at startup. No auto-discovery (ambiguous with several drivers installed). Without `driver`, the built-in drivers are selected by `majorVersion` exactly as today. `majorVersion` is deprecated when the ES9 driver ships (step 05) — documentation and a startup notice only; it keeps working unchanged until v3.
5. **The contract is exported by `kuzzle`.** Drivers import `StorageDriver`, the capability types and the conformance kit from `kuzzle` and declare it as a `peerDependency`. Pinned by the typings gate (`tests/typings/`), like the other contract types of ADR-0002.
6. **One repository per driver.** `kuzzleio/<driver>`, each with its own CI against its real engine.
7. **Native client through the driver.** Each driver exposes its own typed native client (`getNativeClient()`); `app.storage.storageClient`, `StorageClient` and `ESClient` delegate to it — same names, no break.
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
- **Auto-discovery of installed `@kuzzleio/storage-*` packages** — the literal "just `npm install`", but ambiguous with several installed and invisible in the config.
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

app.storage.storageClient · StorageClient · context.constructors.ESClient  ──►  driver.getNativeClient()

v2 built-in drivers : es7, es8 (thin adapters over today's classes)
external drivers    : ES9 (first), OpenSearch 2 / 3 · SQL at v3
v3                  : es7 / es8 extracted, core ships no engine SDK
```

---

## Cold start

**Where we are (2026-10-06):** ADR **accepted** ([#2948](https://github.com/kuzzleio/kuzzle/pull/2948)). Step 00 (`ESClient` fix) is merged ([#2947](https://github.com/kuzzleio/kuzzle/pull/2947)) and shipped in 2.57.0. 2.57.0 has been stable since 2026-09-30, so steps 01+ can start.

**Next action:** open step 01 (contract + capability list).

**Conventions** (same as ADR-0001 / 0002): base branch `2-dev`; non-breaking only in v2; unit tests in Docker; Claude cannot merge — it hands the maintainer `!` commands.

---

## Step table

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 00 | Fix: `context.constructors.ESClient` built an ES7 client on ES8 deployments | ✅ Done 2026-09-29 | [#2947](https://github.com/kuzzleio/kuzzle/pull/2947) | [detail](steps/00-fix-plugin-esclient.md) |
| 01 | Contract: `StorageDriver` core + capability groups + manifest, exported by `kuzzle`, pinned by the typings gate | ⬜ To do | — | — |
| 02 | ES7 / ES8 as thin internal drivers; `ClientAdapter` consumes the contract; native client delegation; ES7 / ES8 matrix unchanged | ⬜ To do | — | — |
| 03 | Loader: `services.storageEngine.driver`, manifest check, capability errors, same-driver check at cluster join (+ error-code docs), config & upgrade docs | ⬜ To do | — | — |
| 04 | Conformance kit (vitest) exported with the contract; capability tags in the functional suite | ⬜ To do | — | — |
| 05 | First external driver: `@kuzzleio/storage-es-9` (own repo), in Kuzzle's functional matrix; `majorVersion` deprecated (doc + startup notice) | ⬜ To do | — | — |
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
- **2026-09-29** — **Out of scope:** cache engine; data migration between engines; ADR written now, implementation after 2.57 stable.

---

## Open points

- **Package granularity:** one package per engine major (`storage-opensearch-2`, `storage-opensearch-3`) assumed — or one per family with a version option, if OpenSearch 2 and 3 turn out to share one SDK?
- **Capability list:** the exact groups and their granularity (step 01) — derived from what `ClientAdapter` and the controllers actually call, and checked against a paper SQL driver.
- **Startup notice wording for `majorVersion`** (step 05): informational, must never fail or alter an ES7 / ES8 startup.
- **Cross-repo CI loop** (step 04): Kuzzle's functional matrix runs the official drivers, which live in their own repos — a Kuzzle PR changing the contract cannot be tested against a driver not yet released for it. Either the matrix installs the drivers' main branches, or contract changes stay backward-compatible within a minor (or both).
- **Interaction with ADR-0002 step 03** (shared types package): whether the driver contract later moves there.
- *(v3)* Which subset of ES mappings a non-ES driver must accept.

---

## References

- `lib/service/storage/Elasticsearch.ts` — today's runtime switch
- `lib/core/storage/clientAdapter.ts`, `lib/core/storage/storageEngine.ts` — the seam
- `lib/core/backend/backendStorage.ts`, `lib/core/plugin/pluginContext.ts` — raw client surfaces
- `lib/core/plugin/pluginManifest.ts` — manifest mechanics to mirror
- `lib/kuzzle/kuzzle.ts` — init order (storage l. 272, plugins l. 304)
