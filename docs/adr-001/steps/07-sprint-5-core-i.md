# Step 07 — Sprint 5: `lib/core` I (storage, security, realtime, cache, shared)

**Status:** 🟦 In progress
**Date:** 2026-09-09 → …
**PR(s):** G1 (`chore/ts-migration-sprint5-realtime-security`) · G2 · G3
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the first half of `lib/core` — the layers that sit *below* the network and plugin machinery. `lib/api` (sprint 4) already builds on them, so nothing above is blocked by this step, and the cucumber functional suite covers every path they serve.

**Scope (16 files, 3 801 LOC).** The hub's sequencing names "storage, security, realtime" for this sprint and "validation, plugin, network" for the next, which left `lib/core/cache` and `lib/core/shared` unassigned. They are three small leaves, so they are folded in here rather than given a sprint of their own:

| Area | Files |
|------|-------|
| `storage` | `clientAdapter`, `storageEngine` |
| `security` | `index`, `roleRepository`, `securityLoader`, `userRepository` |
| `realtime` | `index`, `actionEnum`, `notifier`, `notification/{index,document,server,user}` |
| `cache` | `cacheEngine` |
| `shared` | `abstractManifest`, `sdk/impersonatedSdk` |

## What is different this time: the coverage gate is armed

[Step 06](06-hardening-mid-course.md) removed `**/*.ts` from `sonar.coverage.exclusions`, and the SonarCloud quality gate requires **`new_coverage` ≥ 80%**. Sprint 4 never felt this — its conversions reported `new_lines_to_cover = 0` (verified on [#2686](https://github.com/kuzzleio/kuzzle/pull/2686): the metric is literally absent) because `.ts` was excluded outright.

So **this sprint is sequenced by measured coverage, not only by layer**. Line coverage of the 16 candidates, from a Mocha coverage run on `2-dev` (2026-09-09):

| File | LOC | Coverage | Gate | Dedicated spec |
|------|----:|---------:|------|----------------|
| `security/roleRepository.js` | 569 | 100.0% | ✅ | yes |
| `realtime/notification/index.js` | 28 | 100.0% | ✅ | — |
| `realtime/notification/server.js` | 42 | 100.0% | ✅ | — |
| `realtime/notification/user.js` | 70 | 100.0% | ✅ | — |
| `realtime/actionEnum.js` | 42 | 100.0% | ✅ | — |
| `cache/cacheEngine.js` | 288 | 100.0% | ✅ | yes |
| `realtime/notifier.js` | 541 | 98.9% | ✅ | yes |
| `security/userRepository.js` | 446 | 98.0% | ✅ | yes |
| `realtime/notification/document.js` | 108 | 97.2% | ✅ | — |
| `security/securityLoader.js` | 174 | 93.1% | ✅ | yes |
| `realtime/index.js` | 39 | 84.6% | ⚠️ thin | — |
| `shared/abstractManifest.js` | 102 | 81.4% | ⚠️ thin | yes (`rewire`) |
| `security/index.js` | 48 | 75.0% | ❌ | — |
| `shared/sdk/impersonatedSdk.js` | 94 | 66.0% | ❌ | yes (`rewire`) |
| `storage/storageEngine.js` | 63 | 61.9% | ❌ | yes |
| **`storage/clientAdapter.js`** | **1 045** | **24.0%** | ❌❌ | yes |

`clientAdapter.js` is the outlier that decides the shape of this sprint: 1 045 lines at 24%, i.e. roughly 790 uncovered lines. It cannot be renamed without either a large body of new specs or an explicit gate decision.

### The unknown, measured — ✅ answered by G1

Does a `.js` → `.ts` rename make **all** of a file's lines count as *new* for coverage, the way it does for issues (the sprint-4 gotcha)? Sprint 4 gave no evidence (`new_lines_to_cover = 0`, `.ts` was excluded then), so G1 was built out of ≥ 93% files: it passes the gate under either hypothesis *and reports the number*.

**It does.** G1's analysis: **`new_lines_to_cover = 2 646`** for 2 308 converted LOC plus the cross-layer edits — i.e. the whole body of every renamed file is measured, not just the changed lines. `new_coverage` came out at **98.5%**, comfortably over the 80% threshold.

So the plan's arithmetic holds, and the consequences are now facts rather than guesses:

- **G2's sub-80% files must be lifted over the threshold before renaming** — the whole file is measured, so today's coverage *is* tomorrow's `new_coverage`.
- **`clientAdapter.js` at 24% would fail the gate outright.** G3 is a spec effort with a rename at the end, not a conversion with tests added afterwards.

## PR breakdown

- **PR G1 — the gate-safe block (10 files, 2 308 LOC).** `realtime` (`actionEnum`, `notifier`, `notification/{index,document,server,user}`), `security` (`roleRepository`, `userRepository`, `securityLoader`) and `cache/cacheEngine`. All ≥ 93% covered, so no new specs are needed to clear `new_coverage`. Doubles as the measurement above. js 66 → 56.
- **PR G2 — spec-first, then convert (5 files, 346 LOC).** `security/index`, `realtime/index`, `storage/storageEngine`, `shared/abstractManifest`, `shared/sdk/impersonatedSdk`. All small, and four of them under or near 80%: the conversion standard's *"a file with no spec ships one"* rule applies in its stronger form here — **write the vitest spec first, lift the file over the threshold, then rename**. Two have `rewire`-driven Mocha specs (the sprint-4 gotcha: keep top-level bindings and `export =`). js 56 → 51.
- **PR G3 — `clientAdapter.js` alone (1 045 LOC, 24%).** The dispatch layer between the API and Elasticsearch. Needs a real spec effort before it can be renamed; sized after G1 reports the rename's coverage arithmetic. js 51 → 50.

Ordering follows the ADR's leaves → core rule *and* the coverage risk: the files that need no new tests go first, the file that needs the most goes last.

## What was done (PR G1 — the gate-safe block)

10 files, 2 308 LOC, all `export =` (the CommonJS shape `cluster/subscriber.js`, `cluster/node.js`, the barrels and the Mocha specs depend on). **js 66 → 56**: `lib/core/realtime`, `lib/core/security`'s repositories + loader, and `lib/core/cache` hold no `.js` any more.

### The implicit-any ratchet earned its keep on the first try

The conversion compiled clean (`tsc --noEmit`: 0 errors) and then **`npm run ratchet` failed: implicit-any 575 > baseline 520**. Fifty-five inferred `any` had walked in unnoticed — 32 in `notifier.ts` alone, 17 in `roleRepository.ts`, 5 in `userRepository.ts`, 1 in `cacheEngine.ts`. All are now annotated and the counter is back to **exactly 520**.

This is the step-06 finding in miniature: every one of those 55 would have been invisible to `tsc`, invisible to the `any` ratchet, and invisible to review — a "converted" file that had simply stopped being type-checked. Without the fourth ratchet this PR would have shipped as a rename.

### Typing decisions worth keeping

- **`actionEnum` keeps `Object.freeze` and gains `as const`** (type-only). That is what lets `notifier` derive `type NotifyAction = (typeof actionEnum)[keyof typeof actionEnum]` instead of widening to `number` — one source of truth, no drift. A real TS `enum` was rejected: it changes the emitted shape (reverse mappings).
- **Both repositories were `extends ObjectRepository` with no type argument.** That is why the first pass reported ~40 "property does not exist" errors on inherited members: the unparameterised base resolves to nothing usable. `ObjectRepository<Role>` / `ObjectRepository<User>` fixed the lot. **Check the base class's generics before believing a subclass is missing members.**
- **`RoleRepository.roles` is `Map<string, Role | Promise<Role>>`.** `loadRoles` caches the *in-flight promise* to de-duplicate concurrent loads, so the union is the honest type — declaring `Map<string, Role>` (the obvious guess) is wrong.
- **`module` is typed with `import type` against the real classes** (`HotelClerk`, `ProfileRepository`, `TokenRepository`), describing only the members actually reached. `core/{realtime,security}/index` are still JS and land in G2; a type-only import adds no runtime `require`, so there is no cycle with the module that constructs these objects.
- **The `{ … } = {}` option parameters are where TS2525 comes from.** JS's "destructure with an empty default" idiom needs an explicit parameter type or every property is reported as having no default. Naming them (`WriteOptions`, `LoadOptions`, `SecurityPermissions`, `PersistOptions`) removed a dozen errors at once and documents the call contract.
- **`core:cache:internal:script:execute` needed a real decision.** It does `this.internal.client[name](...args)`, and Lua scripts are attached to the raw ioredis client at runtime by `defineCommand` — invisible to the client's declared type. `Redis.exec()` looks like the answer but is not: it goes through the `commands` surface, which `defineCommand` does not populate, so using it would change behaviour. Resolved with `Reflect.get(this.internal.client, name) as CacheScript` — the correct API for a dynamic property read, cast to a precise function type rather than to `any`.

### Cross-layer type-only fixes (own commit)

- **`ObjectRepository.serializeToDatabase`: `Omit<TObject, "_id">` → `JSONObject`.** A contract none of its three overrides honoured (RoleRepository strips `restrictedTo` too; TokenRepository's override was untyped). Nothing consumes the precision — the result only flows into the base's two store calls.
- **`HotelClerk.rooms`: `private` → `public`.** `notifier` has always read it directly to resolve a room's channels. Third occurrence of this shape (cf. PR D's `kuzzle.statistics`): **a `private` that a sibling module reads is a mis-declaration, not an encapsulation to work around.**

### Two failures worth recording

The first CI round came back **12 pass / 33 fail**. Neither failure was in the unit suites.

#### 1. A real runtime regression the 3 025 unit tests did not catch

`Build and Run` failed, and Kuzzle would not start at all:

```
TypeError: Cannot read properties of undefined (reading 'options')
    at ioredis/built/utils/Commander.js:106
    at lib/core/cache/cacheEngine.js:125
    at Mutex.unlock (lib/util/mutex.js:152)
```

The `core:cache:internal:script:execute` handler had been converted to `Reflect.get(client, name)` followed by `script(...args)` — which resolves the Lua script but calls it **detached**. `defineCommand` attaches scripts to the client *instance*, so ioredis' Commander needs `this`; the original `client[name](...args)` was a method call, and the conversion silently dropped the receiver. Fixed with `Reflect.apply(Reflect.get(client, name), client, args)`.

Two lessons:

- **This path has no unit spec exercising a real ioredis client**, so `Build and Run` is the only gate covering it — a conversion touching a service boundary must be run for real, not just unit-tested. Locally: `docker compose -f ./.ci/services-7.yml up -d --build` then `MAX_TRIES=60 ./bin/wait-kuzzle`. ⚠️ Plain `up -d` **reuses a stale image** — `--build` is required, which cost a confusing round of "the fix didn't work".
- **A dynamic method call is not a dynamic property read.** Anywhere a conversion replaces `obj[name](...)`, the receiver has to be preserved explicitly.

#### 2. The gate's new-code issues, as budgeted

3 Critical + 1 Major + 10 Minor, all pre-existing and all re-scored by the renames — the standing sprint-4 pattern. Resolved behaviour-preservingly: S3776 (complexity 25 on `checkRolePluginsRights`) split into two verbatim helpers; S2933 `readonly`; S7757 ×4 class-field initialisers; S7765 ×3 `.includes()`; **S1874 ×4 — `request.input.resource.{index,collection}` → `request.input.args.*`**, which is a genuine drop-in (`RequestResource` is built as `new RequestResource(this.args)` and its getters read that very object), so unlike TD-20's deprecations this one needed no `NOSONAR`. The two S4123 `await this.roles.set(...)` are kept with `// NOSONAR` — `Map.set` is synchronous so the `await` is pointless, but removing it shifts the method's resolution by a microtask; they join PR E2's `_checkSdkVersion` follow-up.

## Validation (PR G1)

- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors (373 pre-existing warnings); `prettier` clean.
- Ratchets: **js 66 → 56** (baseline updated), mocha 151, any 208, **implicit-any 520** — all green (see above for the 575 → 520 round trip).
- `npm run test:strict`: ✅ **98/98**, `--candidates` empty. Adopted: `actionEnum`, the notification barrel, `ServerNotification`, `securityLoader`.
- **Full Mocha suite (3025) green** and **vitest 6 files / 64 tests green** in Docker (`npm run build` included in both pipelines).
- **Kuzzle starts for real**: the CI stack (`.ci/services-7.yml`, ES7) reports `[✔] Kuzzle 2.56.0 is ready` with **0 errors** in the logs, `bin/wait-kuzzle` exit 0.
- **Coverage gate: `new_coverage` 98.5% over `new_lines_to_cover` 2 646** — see *The unknown, measured* above.
- **First CI round failed on two counts, both fixed in-PR** — see *Two failures worth recording* below.
