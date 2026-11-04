# Step 06 — Elasticsearch 7 and 8 as packages Kuzzle depends on

**Status:** 🟦 In progress · **Opened:** 2026-10-30 · **PR:** [#3112](https://github.com/kuzzleio/kuzzle/pull/3112) (part C) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

The ES7 and ES8 drivers leave the core for their own packages, `kuzzle-storage-es-7` and `kuzzle-storage-es-8`, and
`kuzzle` depends on them at pinned versions: every engine then runs through the same driver path as ES9. Nothing
changes for an ES7 / ES8 stack (decision 8): same `.kuzzlerc`, same `package.json`, `majorVersion` still selects the
driver. The next major only drops the two dependencies (step 08).

## Design choices (maintainer, 2026-10-30)

- **One public repository per driver**, `kuzzleio/storage-es-7` and `kuzzleio/storage-es-8`, released like
  `storage-es-9` (semantic-release, `master` stable / `beta` prerelease, npm trusted publishing).
- **The code moves as it is**: `lib/service/storage/<7|8>/` and its `ES7Driver` / `ES8Driver` wrapper, no
  factorisation (decision 10). Each package exports its driver class and ships a `manifest.json`.
- **Pinned versions** in `kuzzle`'s `dependencies`: a driver release reaches users only through a `kuzzle` release.
- **Lazy loading**: a driver `require`s `kuzzle`, so `kuzzle` loads the built-in one at storage startup, not at
  module load, to avoid a require cycle.
- Names reserved on npm by an empty `0.0.0` (published by the maintainer, 2026-10-30).

## Parts

| Part | What | Where | Status |
| --- | --- | --- | --- |
| A | `kuzzle-storage-es-7`: the ES7 code and driver, manifest, conformance kit on ES7 in CI, first beta | storage-es-7 | ✅ `kuzzle-storage-es-7@1.0.0-beta.1` published 2026-10-30 |
| B | `kuzzle-storage-es-8`: the same for ES8 | storage-es-8 | ✅ `kuzzle-storage-es-8@1.0.0-beta.1` published 2026-10-30 |
| C | `kuzzle` depends on both at pinned versions, loads them lazily, drops `lib/service/storage/7` / `8`; ES7 / ES8 matrix unchanged | kuzzle | ✅ [#3112](https://github.com/kuzzleio/kuzzle/pull/3112) merged 2026-10-30 |
| D | The ES unit suite (`elasticsearchCases`, `esWrapperCases`, ~6 400 lines) moves out of `kuzzle` to the three driver repositories, ES9 included: every driver has the conformance kit **and** a unit suite (maintainer, 2026-10-30) | storage-es-7 / -8 / -9 | ✅ storage-es-7#1, storage-es-8#1, storage-es-9#2 merged 2026-10-30 |
| E | Documentation pass (maintainer, 2026-10-30): a detailed README per driver (install, config, compatibility, typings, capabilities, troubleshooting); a "Drivers" category on docs.kuzzle.io next to plugins and modules, validated on next-docs first; a "Write a storage driver" guide in `doc/2/guides/` | drivers, documentation, kuzzle | ✅ merged 2026-10-30 (driver docs in the part D PRs, documentation#612, [#3113](https://github.com/kuzzleio/kuzzle/pull/3113)); on next-docs only |
| F | Beta test period (maintainer, 2026-10-30): the drivers stay on `beta`, the docs on next-docs; an iteration on 2.61.0-beta.2 (template projects on ES7 / ES8 / ES9) before the drivers' 1.0.0, the docs' move to production and 2.61.0 | all | ✅ template pass green on ES7 / ES8 / ES9 (2026-10-31); drivers `1.0.0` published 2026-10-31 |

## What was done

- Parts A and B ([`kuzzleio/storage-es-7`](https://github.com/kuzzleio/storage-es-7),
  [`kuzzleio/storage-es-8`](https://github.com/kuzzleio/storage-es-8)): the scaffolding of `storage-es-9`, and
  `lib/service/storage/<7|8>/` with their types moved as they are. Only the imports change: `kuzzle`'s exports, the
  `@elastic/elasticsearch` version Kuzzle pins (7.13.0, 8.17.1), `storageError`, the small helpers copied as for ES9.
- First betas published by semantic-release itself: the npm trusted publisher declared first, then `master` pushed with
  a licence-only `chore` commit (a release branch must exist, nothing to release) and `beta` with the `feat` commit.
  No hand publish, hence no missing note (gotcha below).

- Part C: `builtInStorageDriver` `require`s the package on first use. `lib/service/storage/7|8`, their unit suites and
  `tests/mocks/elasticsearchClient.ts` leave (kept for part D); their Sonar CPD exclusions and S2187 ignores go too.

- Part D: the suite is the same in the three repositories (only the two entry specs name their driver). ES 9 differs
  from ES 8 by one wire detail, `generateMissingAliases`' alias actions at the root: the envelope's `aliasRequest`.
  It reaches Kuzzle's `loadConfig` and `StorageService` through the pinned `kuzzle` devDependency's `dist/`.
- Part E: one template wrote the three READMEs and `doc/1/` sections (getting started, configuration, TypeScript,
  compatibility, troubleshooting). Each release workflow triggers the doc deploy (`master` → docs.kuzzle.io, `beta` →
  next-docs). Merge documentation#612 before the driver PRs, whose merge triggers that deploy.

- Part F, template pass on 2.61.0-beta.2 (2026-10-30/31, the 3-node cluster harness of the 2.60 passes): green on
  `template-kuzzle-project` (ES 8.17.1, 7.17.26, and 9.5.5 with `kuzzle-storage-es-9@1.0.0-beta.1`),
  `template-kiotp-project` and `template-hypervision-project` (ES8, then ES9). Functional suites, cluster start /
  restart, 171 stops during startup, all converged; graceful SIGTERM exits 0. Their plugins (device-manager,
  multi-tenancy, workflows, IoT / hypervision backends) behave the same on ES9 as on ES8: same mappings, same
  statuses over their search / get actions. One `kuzzle` in every image, driver errors
  recognized as `KuzzleError` (404 / 400), no new log line type vs the 2.60 passes. One finding: a missing built-in
  package failed with a raw `Cannot find module`; it now throws `services.storage_driver.not_found`, as for ES9.
- Drivers `1.0.0` (2026-10-31): `beta` merged into `master` in each driver repository (storage-es-7#2,
  storage-es-8#2, storage-es-9#3), published by semantic-release on `latest`, back-merged into `beta`; `kuzzle` pins
  es-7 / es-8 `1.0.0` and its ES9 CI stages `kuzzle-storage-es-9@latest` ([#3118](https://github.com/kuzzleio/kuzzle/pull/3118)).
- 2.61.0-beta.3 published 2026-11-02 ([#3120](https://github.com/kuzzleio/kuzzle/pull/3120), notes
  [#3119](https://github.com/kuzzleio/kuzzle/pull/3119)). Its CI and #3119's each had one functional scenario fail and
  pass on rerun: a node not yet knowing an index or a collection another node had just created or deleted. Not a 2.61
  regression (the cluster cache broadcast never was awaited); fixed for beta.4 by checking storage before such an
  answer ([#3121](https://github.com/kuzzleio/kuzzle/issues/3121)).
- The driver docs' home redirect pointed to an absolute path that the framework's `Redirect` appends to the current
  URL (404): relative in storage-es-7#4, storage-es-8#4, storage-es-9#5.
- 2.61.0-beta.5 review (core, driver repos, docs, usability): findings tracked in
  [#3145](https://github.com/kuzzleio/kuzzle/issues/3145). Its docs pass (#3135, the docs part of #3133, the v3 rows
  of #3144) fixed the raw-client pages, the upgrade notes (ES8 → ES9 path, `majorVersion` warning for plugin authors),
  the sample `.kuzzlerc` and this hub's stale names and ranges.
- Optional `close()` engine hook (#3141): called once per scope instance on a graceful shutdown, after the funnel
  drains and the locks are freed, bounded to 5 s, a failure only logged; the kit closes its instances and has a
  capability-free case for it. The built-in drivers do not implement it yet (driver repositories' follow-up).
- #3133 (feature): `context.accessors.getStorageEngine()` / `app.storage.getEngine()` give `{ driver, engine,
  version }` (driver package, `info().type`, `info().version`); `majorVersion` unchanged. The OpenSearch drivers'
  `info()` still reports `type: "elasticsearch"`: driver-side fix.

## Local decisions / gotchas

- **npm installs a second `kuzzle` in Kuzzle's own trees.** The packages' peer dependency `kuzzle` is auto-installed
  from npm in this repository and in the Docker image (`node_modules/kuzzle`), where Kuzzle is the application, not a
  dependency: its error classes would not be the running Kuzzle's (`esWrapper` checks `instanceof KuzzleError`).
  `builtInStorageDriver` puts the running Kuzzle (`index.ts` or `index.js`, from Node's module cache) in that copy's
  cache entry before loading the package; a no-op in an application, where the peer *is* the running Kuzzle. npm
  `overrides` (`file:` resolves against the dependent package) and a self `devDependency` (npm crashes) were tried
  and dropped. Under vitest, Kuzzle is not in Node's cache: `tests/helpers/driverPackagesKuzzle.ts` gives the
  packages a stand-in that throws on use, since loading the copy would replace `global.kuzzle`.
- **Native clients now come from the package's own `@elastic/elasticsearch`** (same pinned versions), no longer from
  `sdk-es7` / `sdk-es8`: same API, but a different class for `instanceof`. `sdk-es7` / `sdk-es8` stay dependencies for
  the public typings until v3 (row already in the v3 backlog).

- `@elastic/elasticsearch` 7 exposes its type subpaths (`api/types`) only through the folder mapping `"./": "./"`,
  which TypeScript's `bundler` resolution ignores: `storage-es-7`'s `tsconfig.json` maps them with `paths`, as Kuzzle does
  for `sdk-es7`.
- To check in part C: `lib/types/storage/7|8/Elasticsearch.ts` import types from `sdk-es7` / `sdk-es8`, so the two
  SDKs likely stay direct `kuzzle` dependencies through v2 for the public typings; they leave at the next major.

- **A first beta published by hand needs its semantic-release note** (found on `storage-es-9`, 2026-10-30): without
  it, the next push to `beta` sees no previous release, commits a changelog and fails on `git tag`. Attach
  `{"channels":["beta"]}` to the tagged **commit** (not the annotated tag object) under
  `refs/notes/semantic-release-v<version>`, and push that ref. The first publish also sets npm `latest` to the beta.

- **With a `driver`, plugins still see the default `majorVersion: "7"`** (`lib/config/index.ts`). multi-tenancy
  (`MultiTenancyPlugin.js`) adds the ES7-only geo_shape `strategy` when `majorVersion` is missing or the number `7`:
  it compares strictly to the number, so the string `"7"` skips it and ES8 / ES9 work, by accident. Maintainer
  (2026-10-31): fixed in the plugin, which no longer reads `majorVersion`; nothing changes in Kuzzle 2.
- **Upgrading an application to 2.61 can need a lockfile cleanup**: a stale `node_modules/kuzzle` entry (2.56 / 2.59)
  in the templates' `package-lock.json` kept npm on the old version ("up to date"). Removing the entry, then
  `npm install --package-lock-only --legacy-peer-deps`, fixed it. Not specific to 2.61.

- **A docs deploy invalidates only its section root on CloudFront** (`kuzdoc`): the sub-pages stay cached, and a
  cached page keeps loading the chunks the deploy deleted. Fixed in kuzdoc#19 (`<path>*`); until it is released, run
  `aws cloudfront create-invalidation --paths "/<deploy path>/*"` by hand (profile with the docs account).

- **Loader hardening (#3132, #3134, #3137, #3142).** External drivers now get the running Kuzzle too
  (`provideRunningKuzzle`, moved to `lib/service/storage/driverPackage.ts`); the CI copy at `/node_modules/kuzzle`
  is `features/fixtures/kuzzle-stale-copy`, which throws if loaded, so the es9 / OpenSearch jobs catch a regression.
  Core methods are checked at startup (`CORE_METHODS`, exhaustive over `StorageDriverCore` by the compiler). Kept
  cwd-first resolution (`.kuzzlerc` is found from cwd too; Kuzzle's own location is the fallback, and the log now
  shows the driver's directory); npm aliases supported, paths refused with a hint. New id
  `services.storage_driver.unsupported_major_version` replaces the plain `Error` for an unknown `majorVersion`.

- **Docs in production (2026-11-04).** documentation#599 (`develop` → `master`) merged, then a prod job
  condition bug from documentation#615 skipped every section build; fixed by documentation#616 and shipped by
  documentation#617 (deploy run 41837054685): all sections rebuilt, drivers' sections live, private sections 403
  without sign-in. This was the last item before 2.61.0.
- **Release PR #3167 failed the SonarCloud gate (2026-11-04)**: 26 issues on lines older than v2.60.1, in files
  2.61 touched. SonarCloud compared with `master`'s last analysis, from 2026-05-20, as only PRs were analysed.
  Maintainer: fix them rather than accept them (2.61.0-beta.9), analyse pushes to `master` / `beta` / `2-dev`
  (`sonar-branches.workflow.yaml`), and make the SonarCloud check required.

## Validation

- Conformance kit 32 / 32: `storage-es-7` on Elasticsearch 7.17.26, `storage-es-8` on 8.17.1, locally and in each
  repository's CI.
- Kit extended to 43 cases ([#3151](https://github.com/kuzzleio/kuzzle/pull/3151), #3138): 43 / 43 on the built-in
  drivers at `1.1.0-beta.1` (ES 7.17.26, 8.17.1).
