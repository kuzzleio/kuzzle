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
| C | `kuzzle` depends on both at pinned versions, loads them lazily, drops `lib/service/storage/7` / `8`; ES7 / ES8 matrix unchanged | kuzzle | 🟦 [#3112](https://github.com/kuzzleio/kuzzle/pull/3112) |
| D | The ES unit suite (`elasticsearchCases`, `esWrapperCases`, ~6 400 lines) moves out of `kuzzle` to the three driver repositories, ES9 included: every driver has the conformance kit **and** a unit suite (maintainer, 2026-10-30) | storage-es-7 / -8 / -9 | 🟦 storage-es-7#1, storage-es-8#1, storage-es-9#2 |
| E | Documentation pass (maintainer, 2026-10-30): a detailed README per driver (install, config, compatibility, typings, capabilities, troubleshooting); a "Drivers" category on docs.kuzzle.io next to plugins and modules, validated on next-docs first; a "Write a storage driver" guide in `doc/2/guides/` | drivers, documentation, kuzzle | 🟦 driver docs in the part D PRs, documentation#612, [#3113](https://github.com/kuzzleio/kuzzle/pull/3113) |

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

## Validation

- Conformance kit 32 / 32: `storage-es-7` on Elasticsearch 7.17.26, `storage-es-8` on 8.17.1, locally and in each
  repository's CI.
