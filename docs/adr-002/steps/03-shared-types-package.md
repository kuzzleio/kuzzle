# Step 03 — Shared types-only contract package

**Status:** 🟦 In progress · **Opened:** 2026-09-30 · **PR(s):** [#2953](https://github.com/kuzzleio/kuzzle/pull/2953) (this step) · [kuzzleio/types#1](https://github.com/kuzzleio/types/pull/1) (seed) · **Hub:** [ADR-0002](../ADR-0002-own-api-contract-types.md)

## Goal

Move the API contract types out of `sdk-javascript/src/types` into a **types-only, dependency-free** package that both `kuzzle` and `kuzzle-sdk` depend on and re-export under their current names — so the server owns its contract and neither package's users change a single import.

## Decisions taken when opening

- **Name and home: `@kuzzleio/types`, in its own public repository `kuzzleio/types`** (maintainer's call, 2026-09-30). Not a workspace in `sdk-javascript`: the contract belongs to neither client nor server. Accepted cost: a contract change is two PRs (types, then the consumer). `@kuzzleio/types` is free on npm (404 on 2026-09-30); the npm org ownership and semantic-release publishing for the scope are to be confirmed before the first release.
- **Types only, zero runtime, zero dependencies.** Only `export type` / interfaces / type aliases. Enums (`ScopeOption`, `UserOption`) and every class stay in the SDK. Lesson from [`kuzzle-common-objects`](https://github.com/kuzzleio/kuzzle-common-objects) (archived 2020, folded back into the core): a shared package carrying runtime classes breaks `instanceof` and private-member assignability as soon as two versions coexist. A types-only package cannot: duplicate copies are structurally identical.
- **A regular `dependency` of both `kuzzle` and `kuzzle-sdk`**, caret range — not a peer dependency: users install nothing new (DX), and a duplicated types-only package is harmless.
- **Initial content = `sdk-javascript/src/types` as is** (853 lines, verified self-contained: it imports nothing outside its folder): `JSONObject`, `KDocument*`, `ApiKey`, `Mappings`, `Notification`, `BaseRequest`, `RequestPayload` / `ResponsePayload`, `ProfilePolicy`, `RoleRightsDefinition`, `HttpRoutes`, `ArgsDefault`, `mRequests` / `mResponses`, and the `@deprecated` names (`Document`, `DocumentMetadata`…) — kept, since consumers still import them (`kuzzle-plugin-commons` imports `Document` from `"kuzzle"`).
- **Release order**: `@kuzzleio/types` 1.0.0 → `kuzzle-sdk` minor re-exporting it (old deep-import paths kept as re-export stubs) → `kuzzle` minor depending on it. Kuzzle does not have to wait for the SDK release: the types are structurally identical.

## What was done

- **Repository `kuzzleio/types` created** (public, Apache-2.0, 2026-09-30), branches `master` and `beta`.
- **Seed PR [kuzzleio/types#1](https://github.com/kuzzleio/types/pull/1)** into `beta` (first release: `1.0.0-beta.1`), CI green. Commits, in review order: a verbatim copy of `sdk-javascript/src/types` at `06ac62b6` (kuzzle-sdk 7.17.1) · tooling (TypeScript 5.4.5, eslint-plugin-kuzzle 2 flat config, prettier, semantic-release-config-kuzzle) with lint autofixes only (`import type`, formatting) · `Document` as an interface · tests · README, CI and release workflow.
- **Gates in the package**:
  - `tests/sdk-equivalence.ts` — every exported type identical to kuzzle-sdk 7.17.1's under the same name (`Document` and `DocumentHit`: assignable both ways). Checked it bites: `KDocumentKuzzleInfo.author` made nullable fails it.
  - `scripts/check-types-only.mjs` — no `dependencies` / `peerDependencies` / `optionalDependencies`, and the built entrypoint exports no runtime value.
  - `npm pack --dry-run` in CI; a consumer compiled under `node10`, `node16` and `bundler` resolution (by hand, before the PR).
- `publishConfig`: `access: public`, `provenance: true`; release through npm trusted publishing (OIDC), same workflow as `kuzzle`.

## Local decisions

- **`Document` is an interface in `@kuzzleio/types`.** It is a class in kuzzle-sdk — a runtime value, and `kuzzle` re-exports it as one (`index.ts`). A types-only package cannot carry it, and `declare class` would type-check a `new Document()` that fails at runtime. So `kuzzle-sdk` keeps its class and does not re-export this name from the package; `kuzzle` keeps re-exporting the SDK's.
- **Plain `export *`, not `export type *`** in the entrypoint: the emitted `.d.ts` stay readable by TypeScript < 5.0; the emitted JS is empty re-exports, asserted by the types-only check.

## Before the first release

- npm: confirm the `@kuzzleio` org is ours. Trusted publishing is configured per existing package, so `1.0.0-beta.1` is published by hand (or with a temporary token), then `kuzzleio/types` / `release.workflow.yaml` is declared as trusted publisher.
- GitHub: `KUZZLE_BOT_APP_ID` is an org variable visible to all repositories, but `KUZZLE_BOT_PRIVATE_KEY` and `SEMANTIC_RELEASE_SLACK_WEBHOOK` are not org secrets — add them to `kuzzleio/types` and install the Kuzzle bot app on it.

## Planned, not started

- **`kuzzle-sdk` minor** depending on `@kuzzleio/types` and re-exporting it (all names but `Document`), old `src/types/*` paths kept as re-export stubs; then **`kuzzle` minor** doing the same for the contract types it takes from the SDK today (list in [step 02](02-kuzzle-owns-its-types.md#what-was-done)).

- **Reconcile the duplicates** listed in [step 02](02-kuzzle-owns-its-types.md#for-step-03--kuzzle-types-that-duplicate-an-sdk-contract-type), non-breaking only: same shape → one type plus an alias under the other name (`RoleDefinition` / `RoleRightsDefinition`); diverged (`ProfilePolicy.restrictedTo` tuple, `KuzzleInfo.author` nullable) → both kept, the gap documented.
- **Additive fix found while opening**: the SDK's `ResponsePayload.error` lacks `props`, which `KuzzleError.toJSON()` sends (`lib/kerror/errors/kuzzleError.ts`) — add it as optional.
- **Gates**: type tests inside `kuzzleio/types`; `tests/typings/` here (the re-exported names, `sdkReexports.ts`, must still compile); canary builds of `kuzzle-plugin-commons` and `kuzzle-device-manager` against the beta — the first imports 14 names from `"kuzzle"`, 3 of them SDK re-exports (`JSONObject`, `EmbeddedSDK`, `Document`).

## Risks to check

- **Module augmentation**: a project doing `declare module "kuzzle-sdk" { interface KDocumentContent … }` may stop merging once the interface is a re-export from another module — a silent breaking change. Search client projects for it and pin it in the typings gate before the swap.
- **Deep imports** of `kuzzle-sdk/out/src/types/*`: keep re-export stubs at the old paths.

## Out of scope

- `kuzzle-plugin-commons` (runtime server helpers, peer-depends on `kuzzle`): a consumer to keep green, not a home for the contract. Its typed `ask` / `onAsk` (`AskEventDefinition`) is a candidate for a later, separate change in the core.
- Stale links to the archived `kuzzle-common-objects` README in `doc/2/guides/write-protocols/context/{request,requestcontext,requestinput}/index.md` — a Boy Scout fix for a doc PR.
