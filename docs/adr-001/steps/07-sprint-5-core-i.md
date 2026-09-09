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

### One unknown to measure, not assume

Does a `.js` → `.ts` rename make **all** of a file's lines count as *new* for coverage, the way it does for issues (the sprint-4 gotcha)? Sonar derives new lines from SCM blame, and a rename is a new path — so probably yes, but sprint 4 provides no evidence and the answer changes the plan's arithmetic entirely.

**PR G1 is therefore designed as the experiment**: it contains only files at ≥ 93%, so it passes the gate under either hypothesis, and its analysis tells us what `new_lines_to_cover` a rename actually produces. G2 and G3 are sized once that number is known.

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

## Validation (PR G1)

- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors (373 pre-existing warnings); `prettier` clean.
- Ratchets: **js 66 → 56** (baseline updated), mocha 151, any 208, **implicit-any 520** — all green (see above for the 575 → 520 round trip).
- `npm run test:strict`: ✅ **98/98**, `--candidates` empty. Adopted: `actionEnum`, the notification barrel, `ServerNotification`, `securityLoader`.
- **Full Mocha suite (3025) green** and **vitest 6 files / 64 tests green** in Docker (`npm run build` included in both pipelines).
- ⚠️ **Pending, and the reason this PR went first: what `new_lines_to_cover` a rename actually produces.** Read it off this PR's SonarCloud analysis (`curl "https://sonarcloud.io/api/measures/component?component=kuzzleio_kuzzle&pullRequest=<N>&metricKeys=new_lines_to_cover,new_coverage"`). Every file here is ≥ 93% covered, so the gate passes either way — the number is what sizes G2 and G3.
