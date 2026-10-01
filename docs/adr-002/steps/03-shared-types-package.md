# Step 03 — Shared types-only contract package

**Status:** ✅ Done · **Opened:** 2026-09-30 · **Closed:** 2026-10-01 · **PR(s):** [#2953](https://github.com/kuzzleio/kuzzle/pull/2953) (this step) · [kuzzleio/types#1](https://github.com/kuzzleio/types/pull/1) (seed) · [#2959](https://github.com/kuzzleio/kuzzle/pull/2959) + [types#5](https://github.com/kuzzleio/types/pull/5) (reconciliation) · **Hub:** [ADR-0002](../ADR-0002-own-api-contract-types.md)

## Goal

Move the API contract types out of `sdk-javascript/src/types` into a **types-only, dependency-free** package that both `kuzzle` and `kuzzle-sdk` depend on and re-export under their current names — so the server owns its contract and neither package's users change a single import.

## Decisions taken when opening

- **Home: its own public repository `kuzzleio/types`** (maintainer's call, 2026-09-30). Not a workspace in `sdk-javascript`: the contract belongs to neither client nor server. Accepted cost: a contract change is two PRs (types, then the consumer).
- **npm name: `kuzzle-types`, unscoped** (maintainer, 2026-09-30: the `@kuzzleio` scope is Kuzzle's but kept for private packages; public ones — `kuzzle`, `kuzzle-sdk`, `kuzzle-plugin-s3` — are unscoped). Free on npm on 2026-09-30. First chosen as `@kuzzleio/types`, renamed before any publish.
- **Types only, zero runtime, zero dependencies.** Only `export type` / interfaces / type aliases. Enums (`ScopeOption`, `UserOption`) and every class stay in the SDK. Lesson from [`kuzzle-common-objects`](https://github.com/kuzzleio/kuzzle-common-objects) (archived 2020, folded back into the core): a shared package carrying runtime classes breaks `instanceof` and private-member assignability as soon as two versions coexist. A types-only package cannot: duplicate copies are structurally identical.
- **A regular `dependency` of both `kuzzle` and `kuzzle-sdk`**, caret range — not a peer dependency: users install nothing new (DX), and a duplicated types-only package is harmless.
- **Initial content = `sdk-javascript/src/types` as is** (853 lines, verified self-contained: it imports nothing outside its folder): `JSONObject`, `KDocument*`, `ApiKey`, `Mappings`, `Notification`, `BaseRequest`, `RequestPayload` / `ResponsePayload`, `ProfilePolicy`, `RoleRightsDefinition`, `HttpRoutes`, `ArgsDefault`, `mRequests` / `mResponses`, and the `@deprecated` names (`Document`, `DocumentMetadata`…) — kept, since consumers still import them (`kuzzle-plugin-commons` imports `Document` from `"kuzzle"`).
- **Release order**: `kuzzle-types` 1.0.0 → `kuzzle-sdk` minor re-exporting it (old deep-import paths kept as re-export stubs) → `kuzzle` minor depending on it. Kuzzle does not have to wait for the SDK release: the types are structurally identical.

## What was done

- **Repository `kuzzleio/types` created** (public, Apache-2.0, 2026-09-30), branches `master` and `beta`.
- **Seed PR [kuzzleio/types#1](https://github.com/kuzzleio/types/pull/1)** into `beta` (first release: `1.0.0-beta.1`), CI green. Commits, in review order: a verbatim copy of `sdk-javascript/src/types` at `06ac62b6` (kuzzle-sdk 7.17.1) · tooling (TypeScript 5.4.5, eslint-plugin-kuzzle 2 flat config, prettier, semantic-release-config-kuzzle) with lint autofixes only (`import type`, formatting) · `Document` as an interface · tests · README, CI and release workflow.
- **Gates in the package**:
  - `tests/sdk-equivalence.ts` — every exported type identical to kuzzle-sdk 7.17.1's under the same name (`Document` and `DocumentHit`: assignable both ways). Checked it bites: `KDocumentKuzzleInfo.author` made nullable fails it.
  - `scripts/check-types-only.mjs` — no `dependencies` / `peerDependencies` / `optionalDependencies`, and the built entrypoint exports no runtime value.
  - `npm pack --dry-run` in CI; a consumer compiled under `node10`, `node16` and `bundler` resolution (by hand, before the PR).
- **CI/CD identical to `kuzzle` / `kuzzle-plugin-s3`**: semantic-release on `master` and `beta`, Kuzzle bot app token, org secrets, npm trusted publishing (OIDC) — no `publishConfig`, like them. One addition, for the bootstrap: `NPM_TOKEN` (org secret) in the release step's env, commented to be removed after the first release.

## Local decisions

- **`Document` is an interface in `kuzzle-types`.** It is a class in kuzzle-sdk — a runtime value, and `kuzzle` re-exports it as one (`index.ts`). A types-only package cannot carry it, and `declare class` would type-check a `new Document()` that fails at runtime. So `kuzzle-sdk` keeps its class and does not re-export this name from the package; `kuzzle` keeps re-exporting the SDK's.
- **Plain `export *`, not `export type *`** in the entrypoint: the emitted `.d.ts` stay readable by TypeScript < 5.0; the emitted JS is empty re-exports, asserted by the types-only check.

## Before the first release

- Secrets: nothing to add — `KUZZLE_BOT_PRIVATE_KEY`, `SEMANTIC_RELEASE_SLACK_WEBHOOK` and `NPM_TOKEN` are org secrets visible to all repositories, `KUZZLE_BOT_APP_ID` an org variable. The `kuzzlebot` app (`KUZZLE_BOT_APP_ID`) is installed on all the org's repositories, this one included.
- Trusted publishing is configured per existing package: the first release goes out with the bootstrap `NPM_TOKEN` (which must still be valid and allowed to create packages); then declare `kuzzleio/types` / `release.workflow.yaml` as the trusted publisher of `kuzzle-types` and remove the `NPM_TOKEN` line.

## First release — `kuzzle-types@1.0.0-beta.1` (2026-09-30)

- **The CI release failed, nothing was published**: the org `NPM_TOKEN` is invalid (`EINVALIDNPMTOKEN`), and OIDC could not take over (`404 … package not found`: trusted publishing is configured per existing package).
- **Published by hand** by the maintainer from `beta` (`43d6222`), `npm publish --tag beta` after the `prepublishOnly` build + types-only check; git tag `v1.0.0-beta.1` pushed on that commit so semantic-release resumes from it. Tarball shasum `10a72ec479b930c21516e749706e4cc67023724f`, 35 files, 10.2 kB. It took a few minutes to show on the registry after npm's "published" e-mail. As the first version, it is also `latest`.
- **Trusted publisher declared, bootstrap `NPM_TOKEN` removed** ([kuzzleio/types#2](https://github.com/kuzzleio/types/pull/2)). The release run after it proved OIDC (`OIDC token exchange with the npm registry succeeded`) but tried to release `1.0.0-beta.1` again: **a hand-made tag is not a release to semantic-release on a prerelease branch** until it carries the channel note — `refs/notes/semantic-release-v1.0.0-beta.1` with `{"channels":["beta"]}` on the tagged commit, the format `kuzzle`'s own tags have. It had pushed its release commit (`d4d8ec5`, CHANGELOG + version) before failing on `git tag`; nothing reached npm. Fixed by pushing the note (the tag stays on `43d6222`) and creating the GitHub release by hand.
- Initially planned: declare `kuzzleio/types` / `release.workflow.yaml` as the trusted publisher of `kuzzle-types` on npmjs.com, and merge the removal of the bootstrap `NPM_TOKEN` line (branch `ci/drop-bootstrap-npm-token`, a `ci:` commit — no release).

## `kuzzle-sdk` takes its contract types from `kuzzle-types` — [sdk-javascript#771](https://github.com/kuzzleio/sdk-javascript/pull/771) (merged 2026-09-30, into `7-dev`)

- `kuzzle-types` `^1.0.0-beta.1` is a dependency; every file of `src/types/` stays, as a type re-export under the same names (deep imports keep working, the SDK's code is untouched). `Document` and `DocumentHit` stay in the SDK (a class, and the interface extending it).
- Checked: the 139 exported names and their kinds, and the 27 runtime exports, unchanged (compiler-API listing, diffed); each of the 40 contract types identical to kuzzle-sdk 7.17.1's; `kuzzle-types` absent from the browser bundle; Kuzzle built against the packed SDK green (`tsc`, `typecheck:typings`, `typecheck:tests`); 686 unit tests, full CI matrix green.
- Gate: `test/types/kuzzle-types.ts` (`npm run test:types`, strict, against the built declarations, in the unit-tests CI action).
- Not released yet: the SDK's `7-dev` goes out with its next release.

## `kuzzle` takes its contract types from `kuzzle-types`

- `kuzzle-types` `^1.0.0` is a dependency (next to `kuzzle-sdk`, unchanged) — first written `^1.0.0-beta.1`, moved to the stable range once `1.0.0` was out, before merging.
- `index.ts`: the 35 contract names of the SDK re-export list now come from `kuzzle-types`; the 76 others (controller `Args*`, `SearchResult`, events, `ObserverOptions`, `UpdateByQueryResponse`, and `DocumentHit` — it extends the SDK's `Document` class) still from `kuzzle-sdk`.
- `lib/types/JSONObject.ts` re-exports `kuzzle-types`' `JSONObject` — the same `Record<PropertyKey, any>`, so the server owns the one the SDK now uses.
- `lib/`: the contract types the SDK-facing code imported from `kuzzle-sdk` (`KDocument`, `KDocumentContent`, `BaseRequest`, `RequestPayload`, `ResponsePayload`, `Notification`) come from `kuzzle-types`. What remains of `kuzzle-sdk` in `dist/**/*.d.ts` is the client runtime `EmbeddedSDK` builds on (`Kuzzle`, `KuzzleEventEmitter`, `RealtimeController`, `ScopeOption`, `UserOption`) and `index.ts`'s re-exports.
- Checked: `dist/index.d.ts` exports the same 279 names with the same kinds, `dist/index.js` the same 82 runtime values (diffed); no `require("kuzzle-types")` in `dist/`; `check-typings-dependencies.sh` green (the published typings compile with production dependencies only); `kuzzle-plugin-commons` type-checks against this build as against 2.55.0.
- Gate: `tests/typings/consumer/contractTypes.ts` — each of the 36 names (35 + `JSONObject`) exported by `"kuzzle"` identical to `kuzzle-types`' and to the installed `kuzzle-sdk`'s, in both strict modes. Checked it bites.
- **`kuzzle-types` 1.0.0** published 2026-09-30 ([types#3](https://github.com/kuzzleio/types/pull/3), `beta` → `master`), by the release workflow through OIDC — the first automatic release, proving the trusted publisher. The maintainer's call: once validated in beta, go straight to the stable versions. The SDK's range still reads `^1.0.0-beta.1` (it accepts `1.0.0`); moved to `^1.0.0` before the SDK's stable release — no prerelease runtime dependency in a stable release.

## Released — 2026-09-30

Straight from beta to stable once validated (maintainer's call):

| Package        | Beta                     | Stable   | Release PRs                                                                                                                                                                                      |
| -------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kuzzle-types` | `1.0.0-beta.1` (by hand) | `1.0.0`  | [types#3](https://github.com/kuzzleio/types/pull/3), back-merge [types#4](https://github.com/kuzzleio/types/pull/4)                                                                              |
| `kuzzle-sdk`   | `7.18.0-beta.1`          | `7.18.0` | [#773](https://github.com/kuzzleio/sdk-javascript/pull/773), [#774](https://github.com/kuzzleio/sdk-javascript/pull/774), back-merge [#775](https://github.com/kuzzleio/sdk-javascript/pull/775) |
| `kuzzle`       | `2.58.0-beta.1`          | `2.58.0` | [#2955](https://github.com/kuzzleio/kuzzle/pull/2955), [#2956](https://github.com/kuzzleio/kuzzle/pull/2956), back-merge [#2957](https://github.com/kuzzleio/kuzzle/pull/2957)                   |

- **Validation on the published betas**: `kuzzle-device-manager` 2.12.0 (sources + tests) and `kuzzle-plugin-commons` 1.3.1 (type-check + build) compile against `kuzzle@2.58.0-beta.1` + `kuzzle-sdk@7.18.0-beta.1`. Gotcha when testing a Kuzzle beta: a prerelease does not satisfy a peer range such as `kuzzle >=2.55.0` (`kuzzle-plugin-commons`), so npm installs a second `kuzzle` next to the beta and TypeScript rejects the two copies' classes (private members). Not a regression — a stable version satisfies the range; test with a single copy.
- Every release went out through npm trusted publishing (OIDC). The SDK's first beta run failed on a transient npm error in the OIDC exchange (`error.errors is not iterable`, `@semantic-release/npm` 13.1.3 masking the registry's answer); re-run as is, it passed.
- Not ours: the `SBOM publish` workflow fails on every release since 2.57.0-beta.4 (Dependency-Track answers HTTP 500).

## Duplicates reconciled, `error.props` added

Non-breaking only; each change is pinned by a type test.

- **`RoleDefinition`** (kuzzle): step 02 listed it as "same shape" as `RoleRightsDefinition`. It is not: it is `{ controllers: RoleRightsDefinition }`. It is now written that way, with no alias, and `tests/typings/consumer/contractTypes.ts` asserts it is still identical to the literal type it declared before.
- **Diverged, kept apart and documented in their TSDoc**:
  - `Policy` / `PolicyRestrictions` against `ProfilePolicy`: a list vs a one-element tuple, `collections` required vs optional.
  - `KuzzleInfo` (`lib/types/storage/{7,8}/`) against `KDocumentKuzzleInfo`: `author` is nullable in Kuzzle's type, a `string` in the contract.

  Aligning either side of either pair would stop code written against it from compiling.

- **`ResponsePayload.error.props?: string[]`** (kuzzle-types 1.1.0): Kuzzle's `KuzzleError.toJSON()` has always sent it, and the SDK's `KuzzleError` already reads it with that type. `tests/sdk-equivalence.ts` in kuzzle-types asserts the rest is unchanged and that the new type and 7.17.1's are assignable both ways.
- **Released 2026-10-01**: `kuzzle-types` 1.1.0-beta.1, then 1.1.0 (`latest`) — [types#5](https://github.com/kuzzleio/types/pull/5), [#6](https://github.com/kuzzleio/types/pull/6), back-merge [#7](https://github.com/kuzzleio/types/pull/7). Validated on the beta: kuzzle `2-dev` builds and passes its typings gate against it and `kuzzle-sdk` 7.18.0 (one `kuzzle-types` copy).
- **Kuzzle's lockfile moved to `kuzzle-sdk` 7.18.0 + `kuzzle-types` 1.1.0** (ranges unchanged). Gotcha: `contractTypes.ts` asserts Kuzzle's types identical to the _installed_ SDK's. With `kuzzle-sdk` 7.17.1, which carries its own copy of the types, `ResponsePayload` would differ by the new optional `props`. A consumer still on 7.17.1 is not broken: the two types assign both ways. The `kuzzle-sdk` lower bound stays `>=7.17.1`: raising it would nest a second SDK under `kuzzle` for apps pinned to 7.17.1, and their classes would no longer be assignable (private members).
- **SonarCloud duplication gate**: the identical comment added to `storage/7` and `storage/8` landed inside a block those two files already duplicated. `KuzzleInfo` and `KRequestBody` now live in `lib/types/storage/KuzzleInfo.ts`, re-exported by both under the same names (type-only, recorded in `.migration/coverage-exempt.txt`).

## Gates used

- **Gates**: type tests inside `kuzzleio/types`; `tests/typings/` here (the re-exported names, `sdkReexports.ts`, must still compile); canary builds of `kuzzle-plugin-commons` and `kuzzle-device-manager` against the beta — the first imports 14 names from `"kuzzle"`, 3 of them SDK re-exports (`JSONObject`, `EmbeddedSDK`, `Document`).

## Risks checked

- **Module augmentation** (`declare module "kuzzle-sdk" { interface KDocumentContent … }`): still merges into the original interface through an `export type { … } from` re-export and through `export *` — tested with TypeScript 5.4.5, `node10` and `node16` resolution (a control without the augmentation fails as expected). Not searched for in client projects.
- **Deep imports** of `kuzzle-sdk/out/src/types/*`: every file kept, as a re-export stub (#771).

## Out of scope

- `kuzzle-plugin-commons` (runtime server helpers, peer-depends on `kuzzle`): a consumer to keep green, not a home for the contract. Its typed `ask` / `onAsk` (`AskEventDefinition`) is a candidate for a later, separate change in the core.
- Stale links to the archived `kuzzle-common-objects` README in `doc/2/guides/write-protocols/context/{request,requestcontext,requestinput}/index.md` — a Boy Scout fix for a doc PR.
