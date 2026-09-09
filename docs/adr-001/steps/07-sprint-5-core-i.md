# Step 07 — Sprint 5: `lib/core` I (storage, security, realtime, cache, shared)

**Status:** 🟦 In progress — G1 and G2 merged, G3 open
**Date:** 2026-09-09 → …
**PR(s):** G1 [#2695](https://github.com/kuzzleio/kuzzle/pull/2695) · G2 [#2696](https://github.com/kuzzleio/kuzzle/pull/2696) · G3 (`chore/ts-migration-sprint5-clientadapter`)
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

## What was done (PR G2 — the module wiring, spec-first by intent)

5 files, 346 LOC: the `security` and `realtime` module barrels, `storage/storageEngine`, `shared/abstractManifest` and `shared/sdk/impersonatedSdk`. **js 56 → 51.** `lib/core/{cache,realtime,security,shared}` are done; under `lib/core` only `clientAdapter.js` (G3) and the sprint-6 files (validation, plugin, network) remain.

### `kerror` could not be loaded as ESM — every vitest spec on an error path crashed

The first spec written (`abstractManifest`, whose whole contract is *which* kerror it throws) failed with `TypeError: Cannot read properties of undefined (reading 'substr')`. The cause is one line in `lib/kerror/index.ts`:

```ts
_currentFileName = module.filename.substr(process.cwd().length + 1);
```

`module` is a **CommonJS global**. Kuzzle ships as CommonJS, but vitest loads `lib/` as ESM, where `module` is undefined. Since nearly every failure path in `lib/` funnels through kerror, **this made the ADR's "every new unit test in vitest" rule unworkable in practice** — and it would have blocked every remaining sprint, not just this one. Guarded so it degrades to "no stack-trace cleaning" (cosmetic), with the consumer guarded too: an empty filename would make `line.includes("")` strip the whole stack.

### Two ordering rules learned the hard way

- **"Spec-first, then convert" does not work mechanically.** A vitest spec for a still-`.js` module fails to load: vite cannot resolve its CommonJS `require` graph (`Error: Cannot find module '../../kerror'`). The order must be **convert, then spec** — equivalent for the gate, which measures the PR's final state, not its commit order.
- **`import x = require(...)` is unloadable under vitest.** It emits a real `require()` that vite cannot resolve, so any spec importing that module dies on `Cannot find module './x'`. A **default import** type-checks against `export =` under `esModuleInterop` *and* works in both worlds. PR E2's rule ("a named import cannot target `export =`, use `import x = require`") is therefore refined: **use a default import**; `import x = require` is a last resort. G1's three occurrences in `notifier.ts` were switched over.

### Other decisions

- `impersonatedSdk`'s `this[controllerProxy] = new Proxy(...)` → `Reflect.set(this, controllerProxy, …)`: the key is a runtime-built string that a plain index access cannot type. Note the contrast with the cacheEngine regression — that one was a dynamic *method call* (receiver matters), this is a property *write* (it does not).
- `query()` takes the SDK's `BaseRequest`, and `__kuid__` / `__checkRights__` are written with `Reflect.set` since they are not part of that declared shape.
- The wiring specs assert the back-reference (`new RoleRepository(this)`) through **constructor arguments recorded by the mocks**, not by reading the `private`/`protected` `module` field. `vi.mock` factories are hoisted above the module body, so the mocks must come from `vi.hoisted`.
- **`storageEngine`'s Mocha spec never awaited its own assertion** (`should(engine.init()).rejectedWith(...)`), so neither the rejection nor the success path was exercised — which is most of why the file sat at 62.7%. The vitest spec awaits both.

### ⚠️ The margin is thin — and the local estimate was pessimistic, not wrong

A local merged (mocha ∪ vitest) per-file estimate put `storageEngine` at 79.1% and `impersonatedSdk` at 78.3%, just under the gate. Its "uncovered" lines turned out to be comments, blank lines and closing braces — the two providers instrument different line sets (c8 over source-mapped `dist/`, v8 over the TS directly), and a line only one of them knows about drags a naive union down. Sonar counts executable lines only.

But the real figure vindicated the *direction*: **`new_coverage` = 83.5%** over **424** new lines to cover (63 uncovered) — above the 80% threshold, and only by **3.5 points**. Compare G1's 98.5%.

Two conclusions for the rest of the migration:

- **The local union is not a usable proxy for the exact number, but it is a usable early warning.** When it lands within a few points of 80%, expect the gate to be tight.
- **G3 cannot be bluffed.** `clientAdapter.js` starts at 24%; on a 1 045-LOC file that is ~790 uncovered lines against a threshold that G2 cleared by three points on 424. The specs have to be real.

## What was done (PR G3 — `clientAdapter`, the spec effort)

1 045 LOC, the sprint's largest file and its worst covered (**23.4%**). Since a rename makes the whole file new code, **the spec is the work and the conversion is the easy half**. js 51 → 50: **`lib/core/storage` is 100% TypeScript.**

### The conversion

Mechanically regular — ~740 of the 1 045 lines are `onAsk` registrations forwarding to the storage client — so the conversion was a rename plus **51 handler signatures annotated up front**. That is why the implicit-any ratchet stays flat at 518 across a file this size; leaving them inferred would have added well over a hundred.

Two typing decisions worth keeping:

- **`client` is declared `Elasticsearch["client"]`, not `any`.** That field *is* `any` on the service itself, tracked there as [TD-13](../type-debt-register.md). Referencing it keeps the one hole counted once at its source and points a reader at the real cause, instead of writing a second `any` for the same thing. Flagged here rather than buried: it is a deliberate choice about *where* debt is recorded, not an attempt to dodge the ratchet.
- `populateCache` states the schema shape locally (`Record<string, string[]>`), since it arrives through that untyped client and drives the cache-population loop.

### The spec: the table is the contract

The 39 pass-through events are a single `it.each` table — one row per event, listing arguments, delegation target, and whether it asserts the collection. A guard test cross-checks that the rows plus the dedicated blocks account for **all 51** registered events, so a new handler cannot be added without being tested.

Dedicated blocks cover the four handlers that *reshape* their arguments (`document:search` wraps index/collection into a target object; `document:multiSearch` asserts every (index, collection) pair of every target; `document:mExecute` passes a callback through; `cache:removeIndexes` loops), the eight that delegate to the adapter's own methods, and the real logic — including the `indexCacheOnly` / `propagate` branches, the emitted `core:storage:*:after` events, and `loadMappings`' deliberate tolerance of `index_already_exists` (the cluster propagation race).

70 tests. Measured with an explicit `coverage.include`: **211 instrumented source lines, 211 covered.**

### The coverage gate could not credit a vitest-tested file — root cause and fix

This is the finding of the PR, and it was about to block the whole rest of the migration.

The first run came back **`new_coverage` 40.3%** on a file whose 51 handlers and every method are under test. Diagnosis, in order:

1. `c8` (wrapping Mocha) derives its line set from the **compiled** output and maps it back onto the source, producing a `DA:` entry for **every line of a loaded file** — blank lines and comments included. It listed **1 217** lines for `clientAdapter.ts`.
2. `vitest`'s v8 provider reports only real statements: **213**, all covered.
3. Sonar takes "lines to cover" from the **union** of both reports, so c8's inflated set dominates. The ~1 000 lines c8 lists inside regions Mocha never executes count as uncovered — even the JSDoc among them.

So **a file whose tests live in vitest could not pass the gate**, and the vitest reporter can only ever *add* covered lines, never shrink c8's denominator. Every remaining sprint would have hit this — sprint 6 opens with two 1 200-LOC files.

Two things that did **not** work, tried and discarded: `c8 --exclude-after-remap` (still 1 189 lines), and running vitest under `c8` (it does not instrument vitest's workers — the report contained only `vitest.config.ts`).

**The fix is `.ci/scripts/prepare-coverage.ts`, run between the suites and the scan.** Two passes:

- **Drop non-executable lines** — blank and comment-only — from both reports, recomputing `LF`/`LH`. Repo-wide: 23 234 of 58 781 entries removed, and the Mocha figure moves **84.3% → 80.1%**. *Down*, because comment lines sitting inside executed regions had been credited as hit. More truthful in both directions, and worth stating plainly since it lowers a number the team watches.
- **Give each file one owner.** Pass 1 is not enough — `clientAdapter` still shows 662 c8 lines against 213 real statements (closing braces, `});`, multi-line call continuations; trimming those needs real parsing, and being wrong there would *overstate* coverage). Since the two line sets are irreconcilable, a file is measured by the runner that owns its spec, per the `tests/` mirror convention.

Pass 2 is **conservative by construction**: the Mocha record is dropped only when vitest's ratio is at least as high, so it can never lower a file's measured coverage, and it *prints* any file where Mocha measures better rather than papering over it. All 12 vitest-owned files hand over cleanly today, none regress.

> **Correction worth recording.** Two of my own earlier calls here were wrong. The local mocha ∪ vitest union (36.7%) was *right* about `clientAdapter` — the "211/211 so it will pass" reading was not. And the first sketch of this fix was expected to *raise* the project's coverage figure; it lowers it. Measure, then claim.

## Validation (PR G3)

- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors; `prettier` clean.
- Ratchets: **js 51 → 50** (baseline updated), mocha 151, any 208, **implicit-any 518** — all green, the last one unchanged across 1 045 converted lines.
- `npm run test:strict`: ✅ 101/101, `--candidates` empty. `clientAdapter` is **not** adopted — it is built on an untyped storage client, so strict has nothing to hold on to until [TD-13](../type-debt-register.md) is addressed.
- **Full Mocha suite (3025) green**; **vitest 11 files / 166 tests green** (was 10 / 88).

## Validation (PR G2)

- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors; `prettier` clean.
- Ratchets: **js 56 → 51** (baseline updated), mocha 151, any 208, **implicit-any 520 → 518** (baseline updated) — all green.
- `npm run test:strict`: ✅ **101/101** (was 98), `--candidates` empty. Adopted: the two module barrels and `impersonatedSdk`.
- **Full Mocha suite (3025) green** — including the `rewire`-driven specs on `abstractManifest` and `impersonatedSdk`, which the default-import switch could have broken (their `__set__` targets the `global` free variable, not the imports).
- **vitest 10 files / 88 tests green** (was 6 / 64).
- **All 51 CI checks green, SonarCloud gate `OK`** — `new_coverage` **83.5%** over 424 new lines. Took two rounds: the first reported 2 New Critical (`S4123`, both true positives — `RoleRepository.init()` and `ProfileRepository.init()` are not `async`, so awaiting them is pointless; kept for timing parity and tracked as [TD-26](../type-debt-register.md) / [#2697](https://github.com/kuzzleio/kuzzle/issues/2697)) plus one functional variant flaking on `api.process.not_enough_nodes` in a `BeforeAll` hook — the known cluster-formation flake, one of 30 matrix variants, on a path this PR does not touch.

## Validation (PR G1)

- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors (373 pre-existing warnings); `prettier` clean.
- Ratchets: **js 66 → 56** (baseline updated), mocha 151, any 208, **implicit-any 520** — all green (see above for the 575 → 520 round trip).
- `npm run test:strict`: ✅ **98/98**, `--candidates` empty. Adopted: `actionEnum`, the notification barrel, `ServerNotification`, `securityLoader`.
- **Full Mocha suite (3025) green** and **vitest 6 files / 64 tests green** in Docker (`npm run build` included in both pipelines).
- **Kuzzle starts for real**: the CI stack (`.ci/services-7.yml`, ES7) reports `[✔] Kuzzle 2.56.0 is ready` with **0 errors** in the logs, `bin/wait-kuzzle` exit 0.
- **Coverage gate: `new_coverage` 98.5% over `new_lines_to_cover` 2 646** — see *The unknown, measured* above.
- **First CI round failed on two counts, both fixed in-PR** — see *Two failures worth recording* below.
