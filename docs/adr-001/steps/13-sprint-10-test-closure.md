# Step 13 — Sprint 10: test closure (Mocha → vitest)

**Status:** 🟦 Open · **Opened:** 2026-09-21 · **PR(s):** L0 [#2805](https://github.com/kuzzleio/kuzzle/pull/2805) · L1 [#2806](https://github.com/kuzzleio/kuzzle/pull/2806) · L1b1 [#2807](https://github.com/kuzzleio/kuzzle/pull/2807) · L1b2 [#2808](https://github.com/kuzzleio/kuzzle/pull/2808) · L1b2b [#2809](https://github.com/kuzzleio/kuzzle/pull/2809) · L1b3 [#2811](https://github.com/kuzzleio/kuzzle/pull/2811) · L1b4 [#2812](https://github.com/kuzzleio/kuzzle/pull/2812) · re-measure [#2813](https://github.com/kuzzleio/kuzzle/pull/2813) · L2a [#2814](https://github.com/kuzzleio/kuzzle/pull/2814) · L2b [#2815](https://github.com/kuzzleio/kuzzle/pull/2815) · L2c [#2816](https://github.com/kuzzleio/kuzzle/pull/2816) · L2d [#2817](https://github.com/kuzzleio/kuzzle/pull/2817) · L2e [#2818](https://github.com/kuzzleio/kuzzle/pull/2818) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Take the `mocha` ratchet to **0** and remove the Mocha apparatus: `mocha`, `.mocharc`, `should`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`, the `test:unit:mocha*` scripts and `npm run build:tests`' reason to exist. Axis 2 of [ADR-0001](../ADR-0001-migration-typescript.md) closes here, and it is the last one: axis 1 closed with [step 11](11-sprint-8-cluster.md), axis 3 with [step 12](12-sprint-9-strict-flip.md).

This is the largest remaining block of the whole ADR, and until now it had no plan. What follows is measured, the way step 12 was opened — because the last time a step was planned from a shape rather than from numbers ([step 10](10-sprint-7-kuzzle.md)'s generalisation from two files), the plan was wrong by a factor of sixteen.

## Perimeter — this step is the **unit** suites, not cucumber

[Step 12 K6](12-sprint-9-strict-flip.md#what-k6-found) left `tsconfig.tests.json` holding **773 strict errors**, and the hub's cold start called them "step 13's measured starting point". That reading needs splitting, because they are not one debt:

| Where                  | Strict errors | Runner   | Belongs to                      |
| ---------------------- | ------------: | -------- | ------------------------------- |
| `features-legacy/`     |       **661** | cucumber | **not this step** — see below   |
| `tests/`               |        **53** | vitest   | this step                       |
| `features/`            |        **47** | cucumber | **not this step**               |
| `start-kuzzle-test.ts` |         **6** | —        | this step (it is test plumbing) |
| `.ci/`                 |         **6** | vitest   | this step                       |

**85% of that debt is cucumber**, and cucumber is not being migrated: `features/` is already TypeScript, `features-legacy/` is the frozen functional suite, and neither has anything to do with Mocha → vitest. Bundling them here would make the step unreadable and its ratchet meaningless — the `mocha` counter cannot move for work done in `features-legacy/`.

**Decision: step 13 is the unit closure.** The 708 cucumber errors are a separate concern and want their own step once this one is done; noting it here so the number is not lost. What step 13 owns of the 773 is **65** (`tests/` 53, `.ci/` 6, `start-kuzzle-test.ts` 6), and they come due at L7, when `tsconfig.tests.json` shrinks to the cucumber directories.

## Scope, measured 2026-09-21 on `2-dev` (`afdaf468d`)

|            | Mocha (`test/`) | vitest (`tests/`) |
| ---------- | --------------: | ----------------: |
| Spec files |         **148** |            **25** |
| Lines      |      **64 295** |         **3 948** |
| Tests      |       **3 092** |           **261** |

By layer, which is how the work divides:

| Layer     | Specs |      Lines | Share of lines |
| --------- | ----: | ---------: | -------------: |
| `core`    |    74 | **23 322** |            36% |
| `api`     |    31 | **17 212** |            27% |
| `service` |     7 | **13 492** |            21% |
| `cluster` |     5 |      3 729 |             6% |
| `kuzzle`  |     8 |      2 569 |             4% |
| `model`   |     6 |      1 809 |             3% |
| `util`    |    10 |        806 |             1% |
| `kerror`  |     6 |        770 |             1% |
| `config`  |     1 |        586 |             1% |

By size — the same shape step 12 found, and it slices the same way:

| Bucket      | Specs |      Lines | Share of lines |
| ----------- | ----: | ---------: | -------------: |
| ≤ 200 lines |    79 |      7 692 |            12% |
| 201–500     |    35 |     12 299 |            19% |
| 501–1 000   |    19 |     12 791 |            20% |
| **> 1 000** |    15 | **31 513** |        **49%** |

**Half the lines are in fifteen files; half the files carry an eighth of them.** The two largest are the Elasticsearch twins again — `elasticsearch-7.test.js` 6 293 and `elasticsearch-8.test.js` 6 138, **12 431 lines between them, 19% of the whole suite**, and near-identical to each other exactly as their subjects are ([step 12 K3](12-sprint-9-strict-flip.md)).

### The axis that actually decides cost: what a spec mocks with

A port is not a rewrite of assertions — `should` → `expect` is mechanical and a codemod's job. What is **not** mechanical is how a spec replaces a module:

| Idiom                          |   Specs |      Lines | Why it matters                                                                      |
| ------------------------------ | ------: | ---------: | ----------------------------------------------------------------------------------- |
| `mock-require`                 |  **43** | **31 348** | Swaps a module in Node's require cache at runtime. `vi.mock` is hoisted and static. |
| `rewire` (`__set__`/`__get__`) |  **15** |  **7 730** | Reaches into a module's **private** bindings. vitest has no equivalent, by design.  |
| **Either one**                 |  **52** | **36 192** | **56% of the lines in 35% of the files** (6 specs use both)                         |
| **Neither**                    |  **96** | **28 103** | `should` + `sinon` only — the mechanical half                                       |
| `should`                       | 147/148 |            | Assertion style; a codemod.                                                         |
| `sinon`                        | 100/148 |            | `vi.fn` / `vi.spyOn` cover it; **0 vitest specs use sinon today**.                  |

`mock-require` concentrates in `core` (28 of the 43). **A spec that uses `rewire` is not a port, it is a redesign**: reaching a private binding means the test was written against an implementation detail, and vitest deliberately offers no way to do it. Those 15 specs — 14 of them in L6, the fifteenth being one of L0's half-ported files — each need their subject to expose what is being tested, or the test rewritten against the public surface — which is a change to `lib/`, with everything that implies for review and for the coverage gate.

### Two findings that change what "port" means

**Six lib files already have a spec in BOTH runners.** When this step was
opened, that was read off the line counts:

| Spec                                           | Mocha lines | vitest lines |
| ---------------------------------------------- | ----------: | -----------: |
| `core/storage/clientAdapter.test`              |   **1 903** |      **948** |
| `api/controllers/memoryStorageController.test` |   **1 424** |      **225** |
| `util/stacktrace.test`                         |          58 |           39 |
| `core/shared/abstractManifest.test`            |         130 |          159 |
| `core/shared/sdk/impersonatedSdk.test`         |         106 |          130 |
| `core/storage/storageEngine.test`              |          59 |          107 |

— and the conclusion drawn was that the top three were unfinished ports. **Two
of those three were not**, and the error is the same one the step's own DoD was
written to prevent: _lines are not tests_. Measured properly, before touching
anything (`--coverage` per subject):

| Subject                      | Mocha                | vitest, before L0  | What it meant                                                                                                                                                                                                                                |
| ---------------------------- | -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientAdapter.ts`           | **24.1%** L, 31.8% F | **100%** L, 100% F | The vitest port is table-driven — three tables instead of forty `describe`s. It is _shorter because it is denser_, and it strictly supersedes a 1 903-line spec that mocked so much of the subject it exercised a quarter of it.             |
| `stackTrace.ts`              | 91.8% L, 89.5% B     | 78.9% L, 70.8% B   | **Not a port at all**: the Mocha spec tests `hilightUserCode`, the vitest one tests `removeStacktrace`. Two functions of the same module. (They looked like a pair only because macOS matched `stacktrace.test.js` to `stackTrace.test.ts`.) |
| `memoryStorageController.ts` | 74.5% L, 48.0% F     | 55.7% L, 56.0% F   | **The one real partial port**, and the gap is named: `set`, `sort`, `zinterstore`/`zunionstore`, `mexecute` and the constructor.                                                                                                             |

_The generalisable part, and it is the reason L0 exists at all:_ **a line count
compares two texts; only coverage compares two tests.** The finding that drove
this slice survives — a file count can fall while coverage does, and
`memoryStorageController` is the proof — but the instrument that found it was
wrong twice out of three, in both directions: it accused a better port and it
invented a port that was not one.

`prepare-coverage.ts` is what has kept the underlying risk honest so far — it
never hands a file over to the runner that measures it worse
([ADR § Coverage measurement](../ADR-0001-migration-typescript.md#cold-start)) —
but that is a coverage gate, not a permission to delete.

**52 of the 148 specs do not mirror a `lib/` file**, e.g. `test/api/funnel/execute.test.js`, `test/api/funnel/checkRights.test.js` and four more that between them cover one file, or `test/kerror/codes.test.js` which covers a directory. The `tests/` mirror convention is what `prepare-coverage.ts` uses to assign a file its owning runner, so **for a third of the suite the convention cannot answer who owns what**. Decide the target layout for those 52 before porting them, not during: a per-file mirror means merging six funnel specs into one, and that is a judgement about test organisation, not a translation.

## Slices

Ordered so each is independently mergeable, the ratchet moves in every one of them, and the deletions are last.

| #          | Content                                                                                                                                                                                                                                                                                                              |  Specs |      Lines | Why this grouping                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0** ✅  | **The three specs that already had a vitest counterpart** — measured by coverage rather than by line count, completed where the coverage said so, then deleted; see _What L0 found_                                                                                                                                  |  **3** |  **3 385** | The only place the ratchet can be moved by _deleting_ rather than porting — and the only place it can be moved dishonestly. Doing it first sets the standard the rest is measured against. Two of the three also carry `mock-require`.                                                                                                |
| **L1** ✅  | **The codemod, proven on the specs that mock nothing shared**: `should` → `expect`, `sinon` → `vi`, `require` → `import` — **27 specs, not 60**; see _What L1 found_                                                                                                                                                 | **27** |  **2 049** | 41% of the files for 9% of the lines. It is where the codemod gets written and proven, and it shrinks the remaining file list to the specs that need thought.                                                                                                                                                                         |
| **L1b** ✅ | **The specs built on `test/mocks/kuzzle.mock.js`** — one fixture derived per spec, never that mock. Sub-sliced by subject area: **b1** `api/` ✅ (8) · **b2** `hotelClerk` ✅ (7, incl. 2 taken from L2 to close the mirror) · **b2b** `notifier` ✅ (7, idem) · **b3** the rest of `core/` ✅ (8 specs → 7 files) · **b4** `service/` + `util` ✅ (4); see _What L1b1/L1b2/L1b2b/L1b3/L1b4 found_                                                                                                                                                                                                                   | **30** |  **3 459** | Not a translation: the vitest tree refuses the ~600-line application stub on purpose, so each spec has to state what its subject actually reads from `global.kuzzle`. Found by L1; it had no slice before.                                                                                                                            |
| **L2** ✅ | The clean specs at **201–1 000 lines**, by layer — sub-sliced below into **a**–**e**, all landed (28 specs, 11 765 lines)                                                                                                                                                                                                                                                                     | **29** | **12 995** | Same transformation at a size where review still fits in one sitting.                                                                                                                                                                                                                                                                 |
| **L3** ✅  | The **six clean specs over 1 000 lines** — `documentController` 2 143, `authController` 1 836, `documentExtractor` 1 484, `securityController/users` 1 390, `request` 1 378, `roleRepository` 1 046                                                                                                                  |  **6** |  **9 277** | Still only the codemod, but each one is a PR's worth of review on its own, and five of the six are `api`. After L3 the suite is **52 files and all of them are hard**.                                                                                                                                                                |
| **L4** 🚧  | **`mock-require` → `vi.mock`**, excluding the Elasticsearch twins, `core` first — sub-sliced [by subject](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd) into **a**–**e**; **a landed**                                                                                                                                                                                                                                      | **34** | **14 128** | One decision repeated 34 times: `vi.mock` is hoisted and static where `mock-require` is dynamic, so a spec that swaps a module _conditionally_ or inside a `beforeEach` needs restructuring, not translating. Its own slice because the answer generalises.                                                                           |
| **L5**     | The **two Elasticsearch twins** (they carry `mock-require` too)                                                                                                                                                                                                                                                      |  **2** | **12 431** | 19% of the suite in two near-identical files, so the second is largely the first's diff — exactly K3's shape, and K3's cost is the estimate to use. Its own PR because its size dominates any review it shares.                                                                                                                       |
| **L6**     | The **`rewire` specs**                                                                                                                                                                                                                                                                                               | **14** |  **6 306** | **Not ports — redesigns.** Each needs its subject to expose what is tested, or the test rewritten against the public surface. Expect `lib/` changes, expect the coverage gate to have opinions, one PR per subject rather than per spec.                                                                                              |
| **L7**     | **Closure**: delete `.mocharc`, `mocha`, `should`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`, the `test:unit:mocha*` scripts, `npm run build:tests`, the `mocha` ratchet and its baseline; shrink `tsconfig.tests.json` to the cucumber directories and clear its 65 own strict errors |      — |          — | Mechanical **and only correct when the ratchet is 0** — the same condition K6 had. ⚠️ **`build:tests` exists because `.mocharc` globs `dist/test/**`** ([step 12 K6](12-sprint-9-strict-flip.md#what-k6-found)); vitest runs from source, so this slice removes a build step, and the payload must be diffed exactly as K6 diffed it. |

### Re-measured on `2-dev` after L1b (2026-09-21, `089ef8160`)

The table above is the plan as it stood at 148 specs. L1b closed at **84 specs / 53 920 lines**, and it did not consume its slices cleanly: b2 and b2b each pulled two specs out of L2 to close a mirror, and b4 pulled the two `esWrapper` specs. **What is actually left:**

| Class                              | Specs |  Lines | Slice                                    |
| ---------------------------------- | ----: | -----: | ---------------------------------------- |
| Clean, ≤ 200 lines                 |     3 |    265 | L2 — three strays L1/L1b's axes missed   |
| Clean, 201–1 000 lines             |    25 | 11 500 | **L2**                                   |
| Clean, > 1 000 lines               |     6 |  9 277 | **L3** (unchanged)                       |
| `mock-require`, minus the ES twins |    34 | 14 128 | **L4** (unchanged)                       |
| The two Elasticsearch twins        |     2 | 12 431 | **L5** (unchanged)                       |
| `rewire`                           |    14 |  6 319 | **L6** (unchanged)                       |
| **Total**                          | **84** | **53 920** |                                      |

L2 is therefore **28 specs / 11 765 lines**, not 29 / 12 995. The three strays are `core/auth/passportResponse` (26), `util/memoize` (61) and `kuzzle/vault` (178) — under 200 lines, no KuzzleMock, no `mock-require`, no `rewire`: they fit L1's axis and were missed by it. _A fourth demonstration that a slice's axis is a hypothesis;_ here the cost is three cheap files rather than a re-cut.

L3, L4, L5 and L6 are untouched by L1b and their numbers still hold.

#### How L2's 28 are cut, by layer

Five sub-slices of comparable size, because 11 765 lines is four times what a
sitting reviews and the layers do not interleave:

| Sub-slice   | Specs | Lines | Shape          | Content                                                                                                                           |
| ----------- | ----: | ----: | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **L2a** ✅ |     7 | 1 637 | codemod        | the three strays + `service/storage/queryTranslator`, `kuzzle/event/pipeRunner`, `kerror/codes`, `kuzzle/event/KuzzleEventEmitter` |
| **L2b** ✅ |     6 | 3 293 | **fixture**    | security: `model/security/{profile,role,user}`, `core/security/{profileRepository,userRepository}`, `core/shared/repository`       |
| **L2c** ✅ |     5 | 2 365 | **fixture**    | the rest of `core/` (`tokenManager`, `kuzzleDebugger`, `statistics`) and `cluster/` (`idCardHandler`, `state`)                     |
| **L2d** ✅ |     5 | 2 038 | **fixture**    | the `api` controllers: `base`, `bulk`, `realtime`, `server`, `collection`                                                          |
| **L2e** ✅ |     5 | 2 432 | **fixture**    | `securityController/{profiles,roles}`, `funnel/checkRights`, `rateLimiter`, `requestResponse`                                      |

⚠️ **The "shape" column is L2's own mis-cut, found while opening L2b, and it is
the fifth in this step.** L2 was sized on lines and cut on "clean", where clean
meant _neither `mock-require` nor `rewire`_ — the two idioms L4 and L6 are
about. It does not mean the third thing [L1](#what-l1-found) discovered:
**21 of L2's 28 specs are built on `test/mocks/kuzzle.mock.js`**, and so are
5 of L3's 6. They are **L1b-shaped work** — one fixture derived per spec, from
what the subject actually reads off `global.kuzzle` — not a codemod pass. L2a's
seven were, by coincidence, exactly the specs that use none of the three.

The cut stands, because the sub-slices are sized for review either way; what
changes is the cost per spec, which is L1b's and not L1's. _Re-measure the axis,
not just the size._

#### How L3's 6 are ordered

One PR per spec, as planned. The order is not size but **how much of the
fixture already exists**: five of the six sit next to a spec L2 already
converted, and the sixth needs no fixture at all.

| Sub-slice | Spec | Lines | `it`s | Leans on |
| --------- | ---- | ----: | ----: | -------- |
| **L3a** ✅ ([#2820](https://github.com/kuzzleio/kuzzle/pull/2820)) | `core/security/roleRepository` | 1 046 | 54 | `profileRepository`, `userRepository`, `shared/repository` ([L2b](#what-l2b-found)) |
| **L3b** ✅ ([#2821](https://github.com/kuzzleio/kuzzle/pull/2821)) | `api/controllers/securityController/users` | 1 390 | 69 | `securityController/{profiles,roles}` ([L2e](#what-l2e-found--and-l2-is-closed)) |
| **L3c** ✅ ([#2822](https://github.com/kuzzleio/kuzzle/pull/2822)) | `api/request/request` | 1 378 | 131 | `request/requestResponse` ([L2e](#what-l2e-found--and-l2-is-closed)) |
| **L3d** ✅ ([#2823](https://github.com/kuzzleio/kuzzle/pull/2823)) | `api/documentExtractor` | 1 484 | 57 | nothing — the only one of the six that is **codemod-shaped** |
| **L3e** ✅ ([#2824](https://github.com/kuzzleio/kuzzle/pull/2824)) | `api/controllers/authController` | 1 836 | 71 | the five controllers of [L2d](#what-l2d-found) |
| **L3f** ✅ ([#2825](https://github.com/kuzzleio/kuzzle/pull/2825)) | `api/controllers/documentController` | 2 143 | 90 | idem |

#### How L4's 34 are cut, by subject — measured on `2-dev` (2026-09-22, `d377ec6fd`)

Both pre-flight checks [L3 asked for](#l3-is-closed) were run before sizing this
one, and both changed the answer.

**The block hash found almost nothing: ~218 lines of copied `it` bodies across
all 34 files**, and the duplication is intra-file (four identical *"should
synchronize roles creation"* in `cluster/node`, three in
`network/protocols/http`) rather than between files. The one cross-file pair is
`BackendStorage-es7`/`-es8`. **L4 is not [L3d](#what-l3d-found)-shaped**: its
cost is not copy, so de-duplication will not pay for it.

**The `mock-require` calls are not what the slice is about either.** Across the
34 specs there are **52** `mockrequire(…)` calls and **49** `reRequire(…)` — and
the target of the re-require is the *subject*, not the mock. The idiom is
overwhelmingly `mockrequire(dep, stub)` once, then `reRequire(subject)` in a
`beforeEach`: `mock-require` can only affect a *later* `require`, so the subject
has to be reloaded after the stub is registered. `vi.mock` is hoisted above the
imports, so that reason disappears. Genuinely *conditional* substitution — a
different stub per block — is rare: `network/accessLogger` (two different
`pino`s), `network/protocols/http`, `network/protocols/mqtt`,
`kuzzle/internalIndexHandler` and `cluster/node`.

⚠️ **And the third idiom is here too, for the sixth time in this step: 28 of the
34 also build on `test/mocks/kuzzle.mock.js`.** Ten of them substitute
`lib/kuzzle` *with* it. So most of L4 is L1b-shaped work again.

| Sub-slice | Specs | Lines | Content |
| --------- | ----: | ----: | ------- |
| **L4a** ✅ ([#2827](https://github.com/kuzzleio/kuzzle/pull/2827)) | 11 | 1 336 | **the `Backend` family** — all eleven re-require the same subject, `lib/core/backend/backend`, and each mirrors a real `lib/core/backend/*.ts` |
| **L4b** | 5 | 3 301 | **network**: `accessLogger`, `httpRouter`, `protocols/{http,websocket,mqtt}` — the node builtins (`zlib`, `net`, `uWebSockets.js`, `aedes`, `worker_threads`, `pino`) and every conditional swap in the slice. Sub-split one PR per subject: **b1** ✅ `accessLogger` ([#2828](https://github.com/kuzzleio/kuzzle/pull/2828)) · **b2** ✅ `mqtt` ([#2829](https://github.com/kuzzleio/kuzzle/pull/2829)) · **b3** ✅ `httpRouter` ([#2830](https://github.com/kuzzleio/kuzzle/pull/2830)) · **b4** ✅ the `httpwsProtocol` pair ([#2831](https://github.com/kuzzleio/kuzzle/pull/2831)) — `http` + `websocket`, one subject, one mirror |
| **L4c** | 3 | 2 627 | **cluster**: `node`, `subscriber`, `publisher` — `zeromq` plus the sibling cluster modules |
| **L4d** | 4 | 3 882 | **plugin + validation**: `plugin/pluginsManager`, `plugin/context/context`, `validation/init`, `validation/types/date` |
| **L4e** | 11 | 2 982 | **the strays**: `config/index`, `api/funnel/processRequest`, `kuzzle/internalIndexHandler`, `model/storage/{baseModel,apiKey}`, `api/controllers/adminController`, `util/{mutex,asyncStore}`, `core/auth/passportWrapper`, `core/shared/sdk/embeddedSdk`, `core/storage/storageEngine` |

**L4a first, and deliberately**: eleven of the 34 specs for 9% of the lines, one
subject, and the mocking decision the whole slice turns on gets made once on the
cheapest possible material.

⚠️ **`test/mocks/uWS.mock.js` has exactly three users left and all three are in
L4b** (`httpRouter`, `protocols/http`, `protocols/websocket`). L4b is therefore
where it is promoted to `tests/mocks/uWS.ts`, with its smallest user — the note
[L1b4](#what-l1b4-found) left when it retired the mock's fourth user.

##### What each of the remaining 23 re-requires — the sweep [L4a](#what-l4a-found) asks for

Every spec's `reRequire` targets, minus the modules it actually substitutes.
What is left is **module state being reset**, which is the thing L4a found has
nothing to do with mocking:

| Class | Specs | Port |
| --- | ---: | --- |
| **Reset only — no substitution at all** | **3** (`validation/init`, `util/mutex`, `plugin/pluginsManager`) | `vi.resetModules()` and nothing else. They import `mock-require` purely to call `reRequire`; **`vi.mock` never appears in the port.** |
| Substitution **and** reset of the subject | **20** | `vi.mock` at module level + the L4a fixture shape |

⚠️ **The sweep is a grep and it under-reports.** Its first run put
`plugin/context/context` in a third class, "substitutes but never reloads",
which would have made its `mutex` stub dead. It reloads its subject through a
**template literal** — `reRequire(\`${root}/lib/core/plugin/pluginContext\`)` —
and a regex looking for a quoted string does not see it. Same failure mode as
[L3e](#what-l3e-found)'s `globalThis.kuzzle` and [L3f](#what-l3f-found)'s
single-quoted `it` names: **three times in this step, a count taken by grep has
been wrong about the thing it was counting.** Read the `beforeEach` before
trusting the row.

Three pairs of specs share a subject and therefore a mirror, and must land in
one PR each: `protocols/{http,websocket}` both reset `httpwsProtocol`;
`storage/storageEngine`, `model/storage/baseModel` and `model/storage/apiKey`
all reset `storageEngine` over a stubbed `clientAdapter`;
`plugin/pluginsManager` and `api/funnel/processRequest` share the
`pluginContext` / `privilegedContext` / `pluginsManager` trio.

⚠️ **The sub-slice table above cuts `processRequest` (L4e) away from
`pluginsManager` (L4d), and `storageEngine` is in L4e with its two model
specs.** The first split is the one to revisit when L4d is opened.

The seven work slices partitioned the original 148 specs and 64 295 lines exactly: 3 + 60 + 29 + 6 + 34 + 2 + 14 = **148**, and 3 385 + 5 773 + 12 995 + 9 277 + 14 128 + 12 431 + 6 306 = **64 295**. See the re-measurement above for what remains.

**Read L4, L5 and L6's line counts as the one thing they are not: a budget.** Their cost is not proportional to their size — that is the whole point of separating them from L1–L3 — and [step 12 K0](12-sprint-9-strict-flip.md#what-k0-found) is the precedent: its own estimate was low by a quarter because a per-class estimate under-counts whatever the class boundary cuts through. Re-measure before picking one up.

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this step adds:

- **The `mocha` ratchet moves, and its baseline moves with it, in the same PR.** A slice that ports without deleting is not done.
- **Report tests, not files.** The ratchet counts spec _files_, and the three half-ported specs above are the proof that a file count can fall while coverage does. Every PR states the test count before and after for what it touched, and the coverage report is the arbiter — not the file list.
- **A ported spec is not allowed to assert less than the one it replaces.** If it does, say so and say why in the PR body: an assertion dropped on purpose (it tested an implementation detail) is a finding worth having; one dropped by accident is the failure mode this whole step is exposed to.
- **A `rewire` spec that needs `lib/` to change gets its own PR**, with the `lib/` change reviewed as a `lib/` change.
- **`git diff origin/2-dev --name-only -- lib/` prints nothing.** A porting slice does not change production code; if it must, that is a finding to state in the PR, not a line to carry along. L1 committed a stray `git stash pop` conflict into `lib/` and only `tsc` and lint noticed.
- **Compare tests, not coverage percentages, across runners.** c8 and the v8 provider do not share a denominator (see _What L1 found_): the claim a port owes is that every `it` it replaces is accounted for, plus the normalised report from `prepare-coverage.ts` if a number is needed.
- **`npm run typecheck:tests` and `npm run build` both green** — the specs and the production code are separate programs since [step 12](12-sprint-9-strict-flip.md), and only the first one sees a test file.
- **Run the WHOLE Mocha suite after every deletion, and read its failure count.** A ported spec's siblings may be leaning on state it left on the global: deleting `deprecate.test.js` broke `didYouMean.test.js`, in a file that slice never touched (see _What L1b4 found_). 84 specs remain and there is no way to know which ones lean on a neighbour.
- Run the suites **in Docker** (`.ci/scripts/docker-test.sh unit vitest` / `unit mocha`); the host cannot load `re2` on arm64.

## Risks

- **The ratchet can be satisfied dishonestly, and once already nearly was.** `memoryStorageController` sits at 16% of its Mocha spec with both files present; deleting the Mocha one is `mocha −1` and a real loss. This is the step's defining risk and it is why L0 is first.
- **`vi.mock` is hoisted; `mock-require` is not.** 43 specs rely on a dynamic swap. Any of them that mocks conditionally, or inside a `beforeEach`, cannot be translated line by line.
- **`rewire` means the test reached into a private binding.** 15 specs, and each is a question about the subject's API rather than about the test. Budget them as `lib/` work.
- **L4 and L5 overlap in kind, not in files.** The Elasticsearch twins carry `mock-require` like the other 34, so whatever L4 decides about hoisting applies to them — do L4 first and L5 becomes a large application of a settled answer rather than a second investigation.
- **The two Elasticsearch specs will re-score under SonarCloud** — 12 431 lines, near-identical to each other, and `sonar.cpd.exclusions` already carries both subjects for exactly this reason ([TD-23](../type-debt-register.md#td-23), and the deliberate override K3 took). Adding a third and fourth exclusion is a decision to put to the user, not a default.
- **The mirror convention does not cover a third of the suite** (52 specs), and `prepare-coverage.ts` depends on it to assign a file its owning runner. Decide the target layout before porting, or the coverage gate will arbitrate it one PR at a time.

## Key commands

```bash
npm run ratchet:mocha                          # the step's only counter — 148 → 0
npm run ratchet:mocha -- --update              # after a slice: record the new floor
.ci/scripts/docker-test.sh unit vitest         # the suite that must grow
.ci/scripts/docker-test.sh unit mocha          # the suite that must shrink, and stay green until it is gone
npm run typecheck:tests                        # tsconfig.tests.json
npm run test:unit:mocha:coverage               # c8 + merge — what arbitrates a port's honesty
grep -rl "mock-require\|rewire" test --include='*.js' | wc -l   # the hard files: 52 today
```

---

## What L0 found

**`mocha` 148 → 145**, three specs deleted, and **not one of the three was what
the plan said it was.**

| Subject                      | Mocha (before)  | vitest before   | vitest after                | Action taken                           |
| ---------------------------- | --------------- | --------------- | --------------------------- | -------------------------------------- |
| `clientAdapter.ts`           | 24.1% L 31.8% F | 100% L 100% F   | unchanged                   | **Deleted outright** — nothing to port |
| `stackTrace.ts`              | 91.8% L 89.5% B | 78.9% L 70.8% B | **100/100/100**             | Ported + gap closed                    |
| `memoryStorageController.ts` | 74.5% L 48.0% F | 55.7% L 56.0% F | **98.4% L 98.7% B 96.0% F** | Ported                                 |

Vitest: **20 → 86 tests** across the two files (3 → 14 and 17 → 52).

**Suite totals: Mocha 3 092 → 2 921 tests, vitest 261 → 327.** That is **105
fewer test cases for strictly more coverage**, and it is the number a
file-counting ratchet cannot see in either direction. `clientAdapter`'s Mocha
spec alone held 93 `it`s exercising 24% of its subject; the port replaced them
with tables that exercise all of it. **Count of tests is not a proxy for
coverage either** — it is only a better one than count of files, which is why
the DoD asks for both numbers and the coverage report as the arbiter.

### The slice was planned on line counts, and line counts were wrong twice

This step's own DoD says _report tests, not files_. L0 was scoped on a third
thing — **lines** — and it misread two of the three subjects:

- **`clientAdapter`'s vitest spec is not a partial port, it is a better one.**
  948 lines against 1 903 because it replaces forty near-identical `describe`
  blocks with three typed tables (`pass-through handlers`, `handlers that
reshape their arguments`, `handlers delegating to the adapter's own methods`).
  It reaches **100% of the file**; the Mocha spec reaches **24.1%**, because it
  mocks so much of the adapter that most of it never runs. The 1 903-line file
  was pure redundancy and its deletion costs nothing.
- **`stackTrace` was never a pair.** `test/util/stacktrace.test.js` tests
  `hilightUserCode`; `tests/util/stackTrace.test.ts` tests `removeStacktrace`.
  They matched only because **macOS's filesystem is case-insensitive**, so the
  script that paired `test/**` with `tests/**` saw `stacktrace` and `stackTrace`
  as the same path. On CI's Linux filesystem the pair would not have been found
  at all — and the conclusion drawn from it would simply never have been drawn.

Only `memoryStorageController` was what it was filed as, and there the line
ratio (16%) understated the real gap (55.7% coverage): it was missing `set`,
`sort`, `zinterstore`/`zunionstore`, `mexecute` and the constructor's three
action shapes, which is more than 16% of the file's behaviour.

_Two lessons, and the second is the one to carry into L1–L7:_

1. **A line count compares two texts; only coverage compares two tests.** Three
   subjects, three different verdicts, and the cheap instrument got two wrong —
   in _both_ directions, accusing a better port and inventing a port that was
   not one.
2. **A path comparison on macOS is not a path comparison.** Anything that pairs
   `test/x` with `tests/x` has to be case-sensitive, or it will keep inventing
   pairs — and the remaining 145 specs are paired that way by the coverage
   gate's mirror convention.

### Both ported specs now cover more than the Mocha ones did

Not by translating assertions, but because the gaps were visible once coverage
was the instrument:

- **`stackTrace`** gained the `at /` and `at async /` frames (the two disjuncts
  that let an anonymous user frame be marked as user code), and the whole
  **serialized-request-response arm** of `removeStacktrace` — the shape the
  protocols actually hand it, which **neither spec covered**: 4 tests, 3 branches.
- **`memoryStorageController`** gained the table's own `map` closures, which the
  Mocha spec **could not reach by construction** — it swapped the command table
  for a fixture, so `toArray`, `sanitizeArrayArgument` and `processLimit` never
  ran there. Function coverage **48% → 96%** is almost entirely that.

### One thing L0 did not fix

`test/mocks/clientAdapter.mock.js` stays: `storageEngine`, `baseModel` and
`apiKey`'s Mocha specs still use it. It goes with the last of them, not here.

---

## What L1 found

**`mocha` 145 → 118**, 27 specs ported, vitest **327 → 494 tests** across **25 → 52 files**. The codemod exists (`should` → `expect`, `sinon` → `vi`, `require` → `import`), and it earns its keep: 811 `should()` calls, 336 `it`s, translated mechanically. What it cost is the part worth recording.

### The slice was mis-cut, for the third time, and on a third axis

L1 was scoped as "the 60 specs at ≤ 200 lines using neither `mock-require` nor `rewire`". **Half of them are not portable that way**: 30 of the 60 depend on `test/mocks/kuzzle.mock.js`, and the vitest tree _refuses that mock by policy_ — its own header says why: _"that mock is a ~600-line stub of the whole application, and a spec that depends on all of it cannot say which part of it the subject actually needs"_. Porting those 30 means deriving a fixture per spec, which is judgement, not translation.

The real partition of the 60:

|                                                   |  Specs |     Lines |
| ------------------------------------------------- | -----: | --------: |
| Neither the KuzzleMock nor sinon — **this slice** | **27** | **2 049** |
| Depend on `test/mocks/kuzzle.mock.js`             |     30 |     3 459 |
| Use sinon                                         |     22 |     2 345 |

⚠️ **Those 30 have no slice in the table above.** They are not L2 (which is sized on lines) and not L4 (which is about `mock-require`). **A slice has to be opened for them**, and its unit of work is "what does this subject actually need from `global.kuzzle`", not "translate these assertions".

_Third time the same shape:_ [K6](12-sprint-9-strict-flip.md#what-k6-found) sliced on a flag and missed the programs that read the config; [L0](#what-l0-found) sliced on lines and missed what coverage says; L1 sliced on two mocking idioms and missed a third. **The axis a slice is cut on is a hypothesis, and it is cheapest to test by measuring the whole population before committing to it.**

### Six mistranslations, and what caught each

The codemod's contract is that it never guesses a matcher. It broke that contract three times, and each break is a word that means different things depending on its subject's type:

| `should` form                      | Naive translation      | Why it is wrong                                                                                                                          | Caught by                  |
| ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `.throw(Err, { id })`              | `toThrow(Err, { id })` | vitest's `toThrow` takes **one** argument and **silently ignores** the second — the spec passed while asserting half of what it replaced | **`tsc`** (TS2554 × 22)    |
| `.match(x)`                        | `toMatch(x)`           | `toMatch` is string-only; a partial deep match is `toMatchObject`                                                                        | vitest (runtime TypeError) |
| `.be.empty()`                      | `toHaveLength(0)`      | on an object it means "no own enumerable key", not "length 0"                                                                            | vitest                     |
| `require("mod")` → `import X from` | default import         | correct only for `export =` / `export default`; `lib/kerror` has neither, so `kerror` was `undefined`                                    | vitest                     |
| `__dirname`                        | unchanged              | the Mocha suite runs from `dist/test/**`, one level deeper than the source                                                               | vitest                     |
| Mocha's `done`                     | unchanged              | vitest has no `done`; the waterfall spec needed rewriting as promises                                                                    | vitest                     |

**Only the first was invisible to the test run**, and it is the worst of the six: a green suite asserting less than the one it replaced. It is the reason the test program is type-checked at all ([K6](12-sprint-9-strict-flip.md#what-k6-found)), and the reason this step's DoD keeps `npm run typecheck:tests` next to the suites. `.be.empty()` was removed from the translation table afterwards: the codemod now reports it instead of guessing.

### The port found defects in the specs it replaced

Three calls passed fewer arguments than their signature — invisible in JavaScript, `TS2554` in TypeScript:

```js
should(geoPointType.validate({}, { lat: 25.2, lon: 17.3 }), []).be.true();
//                                                          ^^ should()'s second argument, not validate()'s third
```

`errorMessages` had been `undefined` all along; the same in `enumType.validate(…)` and `objectType.validate(…)`. They passed because the success path never touches it.

And `waterfall`'s spec **used** the receiver (`this.done()`) without ever **asserting** it — so a change dropping the receiver would have failed no test. That is exactly the defect class [K5 shipped to production](12-sprint-9-strict-flip.md#the-regression-k5-shipped-and-what-caught-it) in `Redis.setCommands`. The ported spec asserts it, and asserts that a propagated error stops the chain, which the original also left implicit.

### Comparing coverage across the two runners is meaningless

L0 compared Mocha's per-file percentages to vitest's. **That comparison does not hold**, and the numbers say so plainly — same file, same moment:

```
lib/util/dump-collection.ts
  mocha  (c8) : lines 173/377   branches 16/17   functions  5/24
  vitest (v8) : lines  22/93    branches 13/44   functions  6/31
```

The **denominators differ**: c8 counts every line of a loaded file, comments included, while the v8 provider counts statements; v8 sees 44 branches where c8 sees 17. In absolute terms vitest covers _more_ functions here (6 vs 5) while showing a "lower percentage". Seven of twelve subjects looked like regressions on percentages and none of them was one.

This is [step 07](07-sprint-5-core-i.md)'s finding — the reason `prepare-coverage.ts` exists and normalises both before Sonar sees them — applied to the very comparison the DoD asks for. **The arbiter is the normalised report, never two raw ones side by side.** L0's conclusion survives only because its gap was a factor of four in the safe direction (24.1% vs 100%), which no normalisation reverses; its wording is corrected above.

What does hold, and is what a port must show: **every `it` in the Mocha spec is accounted for in the vitest one**. 63 Mocha tests → 64 vitest tests here, one-for-one plus the receiver assertion.

### A porting slice must leave `lib/` untouched — and this one did not, for a while

A `git stash pop -q` conflicted during a coverage measurement, and because the command was quiet and its exit status unchecked, **conflict markers and a third party's stashed WIP were committed into `lib/core/realtime/hotelClerk.ts`** and `test/core/realtime/hotelClerk/list.test.js`. `tsc` caught it (`TS1185: Merge conflict marker encountered`) together with lint's 68 errors; the unit suites, running at the same time, said nothing.

Both files were restored from `2-dev`. The guard is one command, and it belongs in the DoD:

```bash
git diff origin/2-dev --name-only -- lib/   # must print nothing
```

_A test-porting slice that changes a production file has either found something it must state, or picked something up it must drop._

---

## What L1b1 found

**`mocha` 118 → 110**, 8 specs ported, vitest **494 → 542 tests** across **52 → 60 files**. Every `it` accounted for: the eight Mocha specs held **38** tests and the eight vitest ones hold **48** — one-for-one plus ten the Mocha specs did not have.

L1b was cut as "the 30 specs ≤ 200 lines that depend on `test/mocks/kuzzle.mock.js`", and that measurement held: re-counted on `2-dev` after L1, it is still exactly **30 specs / 3 459 lines**. It is the first slice in this step whose axis survived contact, and the reason is that it was cut from a measurement of the whole remaining population rather than from a shape:

| Remaining Mocha specs, by idiom              | Specs |  Lines |
| -------------------------------------------- | ----: | -----: |
| KuzzleMock + (`mock-require` or `rewire`)     |    41 | 30 056 |
| KuzzleMock + sinon only                       |    41 | 16 869 |
| KuzzleMock only                                |    19 |  6 006 |
| Neither                                       |    17 |  5 930 |
| **Total**                                     | **118** | **58 861** |

L1b1 is the `api/` eighth of it: `funnel` × 5, `debugController`, `indexController`, `OpenApiManager`.

### The fixture is the deliverable, not the assertions

The translation was mechanical — L1's codemod handles `should` → `expect` and `sinon` → `vi`. What each spec cost was **one question per subject: what does it actually read from `global.kuzzle`?** The answers are small and they are the point:

| Spec                          | What the subject actually needs                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `funnel.metrics`              | `log.child()` — nothing else. The shared fixture already provides it, so `stubKuzzle()` is bare. |
| `funnel.performDocumentAlias` | `pipe`, and it must **return** its documents: the result feeds `DocumentExtractor.insert`.      |
| `funnel.init`                 | `onAsk`, `pipe`, `pluginsManager.getStrategyMethod`, `ask` (the anonymous user), and **nine config keys** — this is what thirteen controller constructors add up to. |
| `indexController`             | `ask`. That is all: every action is one storage-engine event.                                   |
| `debugController`             | `ask` + `config.security.debug.native_debug_protocol`.                                          |
| `OpenApiManager`              | `onAsk`. It reads no config at all.                                                             |

`funnel.init`'s fixture is the one that looks large, and it is the argument for the exercise rather than against it: the nine config keys were always required — KuzzleMock supplied them silently, so nothing said that constructing the API reads `limits`, `http`, `internal`, `plugins`, `security`, `server`, `services` and `version`.

### Two mocks turned out to mock the subject, and one of them was dead

`test/mocks/mockAssertions.js` stubs six `assert*` methods on the controller under test. `indexController` **calls none of them** — the spec had been carrying it for nothing, and mocking the subject's own surface is precisely why that went unnoticed. Not ported, not replaced.

`test/mocks/controller.mock.js` is used by two specs and provides two classes, one of which is unused here. Inlined as a 10-line class in the one spec that needs it, so the controller under the funnel is readable beside the assertions.

_A mock of the subject cannot be ported, only re-decided._ Neither of these is a `global.kuzzle` fixture, so neither was in L1b's stated scope — they were found by porting, like the KuzzleMock dependency itself was found by L1.

### `tsc` caught two more signature defects, exactly where L1 said it would

- **`indexController.stats()` takes no argument** and the Mocha spec passed it a request (TS2554). Silent in JavaScript.
- **`lib/api/controllers` is `export =` an object literal**, which TS2497 refuses to reference from an ES import. The barrel is unusable from the test program; each controller module is `export =` a class and imports fine. `funnel.init`'s spec imports the twelve individually.

This is the third slice in which the test program's type-check found a defect no runner could see. It is the concrete return on [step 12](12-sprint-9-strict-flip.md)'s second program.

### ⚠️ The mirror convention cannot express "many specs, one subject"

`prepare-coverage.ts` assigns `tests/<path>.test.ts` to `lib/<path>.ts` ([its `specTarget`](../../../.ci/scripts/prepare-coverage.ts)). Two consequences turned up here:

1. **`test/api/OpenApiManager.test.js` was mis-filed**: the subject is `lib/api/openapi/OpenApiManager.ts`. Under Mocha that is harmless; under the mirror it means the spec would run, pass and **count for nothing**. The port moves it to `tests/api/openapi/`.
2. **The five `funnel` specs cannot satisfy the mirror.** `tests/api/funnel/metrics.test.ts` resolves to `lib/api/funnel/metrics.ts`, which does not exist, so `specTarget` returns `null` and `lib/api/funnel.ts` stays attributed to the **mocha** report — which is the correct outcome while three funnel specs (`checkRights`, `execute`, `processRequest`) are still in Mocha. Merging the five into `tests/api/funnel.test.ts` now would claim the subject for vitest and discard those three specs' coverage of it.

**The decision taken:** keep one file per concern, unmirrored, until the last Mocha spec for a subject is ported — then merge them into the mirrored file in that same PR. Whichever slice ports `processRequest` owns that merge for `funnel`.

⚠️ **An unmirrored spec is silently unowned.** `specTarget` returning `null` is not reported anywhere, so a typo in a spec's path is indistinguishable from a deliberate split. Worth a check that lists unmirrored specs — not a fix for this slice, but L7 should not shrink `tsconfig.tests.json` without one.

### `settle` is now a helper, because four specs in this slice need it

[L1](#what-l1-found) wrote `settle` inside `waterfall.test.ts` to replace Mocha's `done`. Of L1b's 30 specs, **4 use `done`** (22 call sites), so it moved to `tests/helpers/settle.ts` and the waterfall spec imports it.

One of the four is ported here, and the port improves on what `done` gave: `executePluginRequest`'s dump path runs inside a `setImmediate`, and the Mocha spec waited **50 ms** for it. Queueing behind the same macrotask (`new Promise(resolve => setImmediate(resolve))`) asserts the same thing with no sleep to be too short on a loaded machine.

---

## What L1b2 found

**`mocha` 110 → 103**, 7 specs ported into **one** file, vitest **542 → 585 tests** across **60 → 61 files**. The seven Mocha specs held **39** tests; the merged vitest one holds **43**.

### The slice was cut on the subject, and that is what closed the mirror

L1b2 was planned as "the 5 `hotelClerk` specs under 200 lines". It shipped as **all 7**, `subscribe` (249) and `unsubscribe` (246) included, because [L1b1's mirror finding](#what-l1b1-found) makes the size axis the wrong one: seven spec files for one subject cannot be mirrored, and `lib/core/realtime/hotelClerk.ts` would have stayed attributed to the mocha report with two specs left in it. Porting five would have created the debt; porting seven retires it. **The subject is the unit, not the file and not the line count** — a fourth confirmation, and the first time the correction was applied *before* the slice rather than after it.

The two extra specs cost far less than their 495 lines suggest: they share the fixture the other five already needed.

### Four defects the Mocha specs could not see

| What | Caught by |
| --- | --- |
| `new Channel(roomId, { cluster: true })` — the constructor option is **`propagate`**; `cluster` is the *field* it sets. The option was silently ignored, and the spec passed only because `propagate` defaults to `true`. | TS2353 |
| `clearConnections()` calls `removeConnection(id, **false**)`, and the second argument is the whole point of it — nobody is left to notify on shutdown. sinon's `calledWith` matches a **prefix**, so the Mocha spec asserted the ids and said nothing about it. `toHaveBeenCalledWith` is exact. | vitest |
| `request["context​"]` looked like a typo and is not: `​` is a zero-width space `KuzzleRequest` uses so its private fields do not show up in a `console.log`. The spec reached past the public `context` getter into the backing field. The port uses the getter. | reading it |
| **`list()` leaves an emptied index behind.** It deletes each forbidden collection and never prunes the index that held them, so a user forbidden from *every* collection of an index still learns the index exists. `should(...).match()` ignores extra keys, so seven years of this spec could not see it. | `toHaveProperty` |

⚠️ **The last one is a `lib/` defect, not a test defect.** It is asserted here **as it behaves**, with the reason written next to it, because a porting slice does not change production code. It needs its own PR and its own decision — it is an API-shape question (and arguably a small information-disclosure one), not a port.

### The private-state problem arrives early

`roomsCount`, `rooms`, `subscriptions`, `createRoom`, `removeRoom`, `subscribeToRoom` and `logger` are all `private` on `HotelClerk`, and `Room.connections` is private too. All seven Mocha specs drove them directly; JavaScript did not care and `tsc` does. The port names the cast **once** (`internals`, plus `connectionsOf` for the room) rather than at each of its ~58 uses, with the admission written there: this spec asserts on internal state because the suite it replaces did.

_This is [L6](#slices)'s problem without `rewire`._ L6 is budgeted as redesigns because `rewire` reaches a private **binding**; a `private` **member** is the same question with a cheaper answer available, and the cheap answer was taken here to keep the slice a port. **A subject whose spec needs eight private names is telling us something**, and L6 should not be planned as if `rewire` were the only place it happens.

---

## What L1b2b found

**`mocha` 103 → 96**, 7 specs ported into **one** file, vitest **585 → 623 tests** across **61 → 62 files**. The seven Mocha specs held **36** tests; the merged vitest one holds **38**.

Same shape as [L1b2](#what-l1b2-found) and for the same reason: seven spec files for `lib/core/realtime/notifier.ts`, none of which can satisfy the mirror. `notifyDocuments` (424 lines) and `notifyMethods` (576) came in from L2 with the five small ones — **`core/realtime` is now entirely on vitest**, and it was 14 of the 148 specs this step started with.

### A fixture had to grow a behaviour, not just fields

Every fixture so far has been data. This one needed one **behaviour**: `_dispatch`'s whole contract is that its three pipes are a chain — each sees the previous one's output — and KuzzleMock provided that through `registerPluginPipe` plus a `pipe` that threads the payload. A `pipe` that returns its argument cannot test it.

So the spec implements it, in nine lines: a `Map` of event → handlers, and a `pipe` that folds the payload through them. The difference from the KuzzleMock version is not the code, it is that **the spec that needs the behaviour is the spec that states it** — and the test that exercises it now asserts the *intermediate* payloads (`{foo}` → `{foo,bar}` → `{foo,bar,baz}`), which the Mocha version did too but as three unrelated `calledWith`s against a shared stub.

### ⚠️ TD-74: `scope: "none"` is accepted at runtime and forbidden by the type

Six TS2322/TS2345 on the `notifyMethods` fixture, all the same finding, now [TD-74](../type-debt-register.md#td-74):

- `RealtimeScope` is `"in" | "out" | "all"`.
- `Channel.SCOPE_ALLOWED_VALUES` is **literally** `USERS_ALLOWED_VALUES` — `["all", "in", "out", "none"]` — so the subscribe validator accepts `"none"`.
- It is **meaningful**: `_notifyDocument` keeps a channel when `channel.scope === "all" || channel.scope === notification.scope`, so `"none"` is how a channel takes user events and no document event. Four of the six fixture channels are built that way.
- And `Channel.hash`'s `scope` switch has **no `"none"` case**, so such a channel contributes nothing to the hash and collides with a channel that has no scope at all. Channel *names* derive from that hash.

Cast once in the spec (`scopeNone`), with the entry filed. `lib/` untouched.

### The "TTL = 0" test never tested anything

`notifyDocuments` is claimed to store rooms "forever" when the TTL is 0, and the Mocha spec asserted it by checking the **three-argument** form of the `core:cache:internal:store` ask. The subject always passes four — `{ ttl: this.ttl }`, unconditionally. **sinon's `calledWith` matches a prefix**, so the assertion passed against a call it did not describe, and the branch it was written for was never covered.

"Forever" is decided one layer down: `Redis.store` appends `PX` only when `ttl > 0`. The port asserts `{ ttl: 0 }` is passed and says where the meaning lives.

_This is the second time in two slices that sinon's prefix matching hid an argument_ ([L1b2](#what-l1b2-found)'s `removeConnection(id, false)` was the first). **It is not an incidental difference between the two runners — it is a class of missing assertion, and every ported spec should be read with it in mind.**

### Small things

- `DocumentNotification` and `UserNotification` ship `export =`, so a **default** import is the correct one — L1's trap, third occurrence.
- `notifyDocumentDelete` returns `[]` whatever it matched (a deleted document is in no room afterwards), which the Mocha spec asserted as "an empty array" without saying why. Written down now.
- The four `actionEnum` pairs — CREATE/DELETE, UPDATE/REPLACE, WRITE/UPSERT — are `it.each` tables rather than eight near-identical tests, which is what made it visible that WRITE and UPSERT differ **only** in which method handles the non-created documents.

---

## What L1b3 found

**`mocha` 96 → 88**, 8 specs ported into **7** files, vitest **623 → 713 tests** across **62 → 69 files**. The eight Mocha specs held **68** tests; the seven vitest ones hold **90**.

The rest of `core/`: `router` × 2 (merged), `internalProtocol`, `funnelProtocol`, `cacheEngine`, `indexCache`, `pluginRepository`, `securityLoader`.

### Two more mirror faults, found before porting rather than after

Checking the mirror **first** is now part of picking up a slice, and it paid twice:

- `test/core/network/router/router.test.js` **and** `httpRequest.test.js` are both for `lib/core/network/router.ts`. Merged, like [hotelClerk](#what-l1b2-found) and [notifier](#what-l1b2b-found).
- `test/core/network/protocols/internal.test.js` is for `internalProtocol.ts` — mis-filed, the second instance after `OpenApiManager`. Renamed.

### ⚠️ `kuzzle.pipe` has two calling conventions, and the less obvious one is silent

`Router._executeFromHttp` calls `global.kuzzle.pipe(event, request, callback)` — the **callback** form. A fixture whose `pipe` only returns a promise leaves it waiting forever, which is how this presented: **seven tests timing out at 20 seconds with no error at all**. KuzzleMock honoured both forms silently, so no spec had ever had to know.

```ts
pipe = vi.fn((event, payload, callback) =>
  callback ? (callback(null, payload), undefined) : Promise.resolve(payload),
);
```

_Second time in this slice group that a fixture needed a **behaviour** rather than fields_ — [L1b2b](#what-l1b2b-found)'s pipe chain was the first. **When a spec hangs instead of failing, suspect a calling convention the fixture does not implement.**

### `global.kuzzle.router` is how the router reaches itself

`httpRouter` looks a message's connection up through `global.kuzzle.router.connections`. The subject therefore needs to be **on the global it reads**, which KuzzleMock provided by carrying its own `Router` instance. The spec assigns it after `init()`, with the reason written down — it is a circular dependency the fixture has to close, not an incidental field.

### Four more defects, three of them signature mismatches

| What | Caught by |
| --- | --- |
| `InternalProtocol.joinChannel(channel, connectionId)` and `leaveChannel` take **two** arguments; the Mocha spec passed one, four times. | TS2554 × 4 |
| `_send` emits one message per channel — and the Mocha spec asserted `room: "c1"` **twice**, by copy-paste, so nothing checked that the second channel was emitted at all. The port pins both, and the call count with them. | reading it |
| `ObjectRepository`'s `index`, `collection`, `ObjectConstructor`, `store` and `cacheDb` are **`protected`**, and the `pluginRepository` spec reads all five — they are what its constructor is *for*. | TS2445 × 5 |
| `Router.logger` is `private`, and half the connection-bookkeeping assertions are about what it was handed (an invalid connection is *logged*, not thrown). | TS2341 |

The last two are the [L1b2](#what-l1b2-found) pattern again: **the private-member problem is not `hotelClerk`'s, it is the suite's.** Named once per spec, never dropped.

### Three mocks retired, one fixture relocated

- **`test/mocks/service/redisClient.mock.js`** models ioredis; nothing in `cacheEngine`'s spec is about ioredis — every assertion is "this event reaches this command with these arguments". Replaced by a 20-line `stubRedis()` whose `commands` is a `Proxy` returning a stable `vi.fn` per name, so a command needs no declaration to be asserted on. It also surfaced that the subject goes through **`Redis.connectedClient`**, not `client` — the K4/K5 accessor pattern.
- **`test/mocks/uWS.mock.js`** models the response side and the socket lifecycle too; the router spec needs the five request getters `HttpMessage` reads. Inlined. ⚠️ **Three Mocha specs still use that mock** — when the next one is ported, this belongs in `tests/mocks/uWS.ts`.
- **A real `EntryPoint`** was constructed by the `internalProtocol` spec only to stub two methods on it, which made the spec depend on the entry point's config for nothing. Two `vi.fn`s instead.
- **`test/mocks/securities.json` → `tests/fixtures/securities.json`.** It is a payload, not a mock: nothing in it stands in for a collaborator. `tests/fixtures/` is new and is where the next one goes.

### Where the real config is the right fixture

`router`'s HTTP half asserts "registers the routes from `config/httpRoutes`" — the route table **is** the subject. So that block loads the real config with `loadConfig()` and stubs only the funnel, rather than inventing three routes and testing the invention. A fixture is small because the dependency is small, not as a rule.

---

## What L1b4 found — and L1b is closed

**`mocha` 88 → 84**, 4 specs ported into 5 files, vitest **713 → 748 tests** across **69 → 73 files**. The four Mocha specs held **25** tests; the five vitest ones hold **35**.

**L1b is done: 30 specs, 3 459 lines, `148 → 84` on the ratchet across b1–b4** (plus the four L2 specs pulled in to close two mirrors). Not one of the 30 was a translation; every one was a question about what its subject actually needs.

### ⚠️ The finding that matters most: a spec was passing because of another file

Deleting `test/util/deprecate.test.js` **broke `test/util/didYouMean.test.js`** — two failures, in a file this slice never touched.

`lib/util/didYouMean.ts` reads **`global.NODE_ENV`**. `didYouMean.test.js` only ever set **`process.env.NODE_ENV`**. It passed because Mocha runs the whole suite in one process, `deprecate.test.js` sorts first, and its `beforeEach` set the *global* to `"development"` and left it there. The assertion under test — "calls the library" — was being satisfied by a sibling's leftover state.

```
2 failing
  1) Test: Deprecate util  ← didYouMean.test.js, under deprecate's describe title
       should call didYouMean library with provided args:
     expected 'stub' to be called once but was called 0 times
```

Even the `describe` title was `"Test: Deprecate util"`, copied from the file it depended on.

`didYouMean.test.js` now states its own precondition (and restores it in an `afterEach`). That is a change to a Mocha spec, which this step otherwise only deletes — justified because the slice is what removed the setup it was leaning on.

**This is the risk the `mocha` ratchet cannot see, and it is worse than the coverage one L0 found.** A file count going down says nothing about what the remaining files were silently relying on. **Run the whole Mocha suite after every deletion** — the DoD said so for correctness; this is the reason.

⚠️ **There are 84 specs left and no way to know which of them lean on a neighbour.** Each will surface the way this one did: as a failure somewhere else, in the PR that deletes its supplier.

### The ES twins: one body, two mirrors, no duplication

`esWrapper-es7.test.js` and `esWrapper-es8.test.js` are **188 lines each and byte-identical but for one import line**:

```
$ diff test/service/storage/esWrapper-es7.test.js test/service/storage/esWrapper-es8.test.js
9c9
< const ESWrapper = require("../../../lib/service/storage/7/esWrapper");
---
> const ESWrapper = require("../../../lib/service/storage/8/esWrapper");
```

Copying that across would have put 188 duplicated lines in front of SonarCloud, and [TD-23](../type-debt-register.md#td-23) says `sonar.cpd.exclusions` may only shrink — a third and fourth entry is a decision for a human, not a default. So:

- `tests/service/storage/esWrapperCases.ts` holds the cases once, as `describeESWrapper(version, ESWrapper)`.
- `tests/service/storage/7/esWrapper.test.ts` and `.../8/esWrapper.test.ts` are **four lines each**, naming their own subject.

Both mirrors resolve (`lib/service/storage/{7,8}/esWrapper.ts`), both subjects get their coverage, and there is nothing to exclude. **This is the shape [L5](#slices) needs for the two 6 000-line `elasticsearch.ts` twins** — 19% of the remaining suite in two near-identical files — proven here at 1/30th the size. _L5 is no longer an open question about duplication; it is an application of this._

(A third mis-filing, too: both Mocha specs sat flat in `test/service/storage/` while their subjects are nested under `7/` and `8/`.)

### Two more decorative or impossible tests

- **`describe("logging in production")` guarded nothing.** The two `esWrapper` specs set `global.NODE_ENV = "production"` around the emit assertions, which reads as "this only happens in production" — and `formatESError` emits **unconditionally**. There is no such branch. The block is gone and the port asserts the emit in both environments, with the absence of a guard stated.
- **`Service` is `abstract`** and the Mocha spec instantiated it directly (TS2554 ×4 — `_initSequence` is the hook a real service implements). The port declares a four-line concrete subclass, which is both what type-checks and what a service *is*; the sequence is a `vi.fn` the tests drive rather than a field assigned onto the instance afterwards.
- `lib/util/deprecate` exports a **named** `deprecateProperties`, and the Mocha spec imported the module object as if it were a namespace. Fourth occurrence of an import-shape mismatch in this step.

### `deprecate` needed no application at all

`deprecateProperties(logger, object, deprecations)` takes its logger **as an argument**. The Mocha spec built a full `KuzzleMock` to reach `kuzzle.log.warn` — so a spec about a `Proxy` looked like it needed the application. The port passes `{ warn: vi.fn() }` and touches no global. _It is the clearest single example of what L1b was for._

---

## What L2a found

**`mocha` 84 → 77**, vitest **748 → 861 tests** across **73 → 80 files**. Seven specs, 1 637 lines. Per file, Mocha → vitest: `passportResponse` 2 → 3, `memoize` 4 → 5, `vault` 10 → 10, `pipeRunner` 10 → 10, `queryTranslator` 15 → 15, `kerror/codes` 26 → 26, `KuzzleEventEmitter` 30 → 44. The two growths are one-for-one plus an assertion the original omitted; the emitter's +14 is two argument loops turned into `it.each` over the same cases.

### An assertion written inside the callback it was about

```js
res = emitter.pipe("foo:bar", "foobar", (error, result) => {
  should(res).not.be.a.Promise();   // `res` is still undefined here
  …
});
```

`pipe()`'s callback fires **during** `pipe()`, before the assignment completes — so `res` was `undefined` at every evaluation, and `should(undefined).not.be.a.Promise()` holds whatever `pipe()` returns. The assertion would have survived the return type changing to anything at all. The port awaits the callback, then asserts on the value.

_Same family as L1's `waterfall` receiver and [L1b4](#what-l1b4-found)'s passing-by-accident spec: **an assertion that cannot fail is not an assertion**, and neither runner can tell you so._ Two more in the same slice, both about an argument nothing checked: `PassportResponse.end(42)` sets the status code and no test read it, and `memoize`'s resolver is handed the argument **list**, which the spec's resolver ignored.

### Two mocking idioms that do not survive ES modules — and what replaces them

- **`kuzzleVault.Vault = stub`.** The vault spec reassigned the package's export to read which cipher was selected. A module namespace is frozen, so `vi.mock("kuzzle-vault")` replaces it — with a **subclass of the real `Vault`** that records its constructor arguments, not with a stub: three of the ten tests assert on what a real `decrypt` does with a key it cannot use, and stubbing the class would have stubbed that too. `vi.resetModules()` + `await import()` is what `delete require.cache[…]` was doing, and the module-memoisation tests still drive it deliberately.
- **Reading private state.** The emitter spec asserted on `pluginPipes` and `pluginPipeDefinitions`; both are `private`. What they were being read *for* — the handler runs on that event, and stops when the pipe is unregistered — is public behaviour, and the port asserts it there. Third occurrence of [L1b2](#what-l1b2-found)'s private-state problem, and the first where the public surface answered it outright.

### `pipe()` does not return a `Promise`

`should(x).be.a.Promise()` accepts any thenable. `Promback` defers through **bluebird**, so `toBeInstanceOf(Promise)` fails on the very object the Mocha spec called a promise. The port asserts a thenable, which is what the contract is. _A translation-table entry: `.be.a.Promise()` is `toHaveProperty("then", expect.any(Function))` unless the subject is known to be native._

### The package entrypoint cannot be imported from a vitest spec

`require("../../index")` is how a Mocha spec reaches the error classes. Under vitest it fails at import time:

```
TypeError: Cannot set property default of [object Module] which has only a getter
  ❯ lib/cluster/state.ts:472  module.exports = State;
  ❯ lib/cluster/node.ts → lib/cluster/index.ts → lib/kuzzle/kuzzle.ts
```

The entrypoint pulls in the whole application, and `lib/cluster/state.ts` still assigns `module.exports` directly. Three of this slice's seven specs hit it. The convention the vitest tree already had — import each error class from its own module (`lib/kerror/errors/badRequestError`) — is the answer, and it is now the third reason not to reach for `index`: it is also what makes a unit spec load the cluster.

### `.gitignore` was swallowing a spec directory

`tests/kerror/codes/index.test.ts` is the mirror of `lib/kerror/codes/index.ts`. It did not show up in `git status`: `.gitignore` carried an **unanchored `codes/`**, added for the error-code pages `doc/build-error-codes` writes at the repo root. Anchored to `/codes/`, with the reason written next to it. _`git add` of a whole directory is not a check that anything was added_ — the file existed, passed lint, type-check and the suite, and would have reached review as a deletion with no replacement.

(And two more mis-filings, after [L1b3](#what-l1b3-found)'s and [L1b4](#what-l1b4-found)'s: `queryTranslator` sat flat in `test/service/storage/` for a subject under `commons/`, and `kerror/codes` mirrors a **directory**, so the port lands at `tests/kerror/codes/index.test.ts`.)

---

## What L2b found

**`mocha` 77 → 71**, vitest **861 → 1 037 tests** across **80 → 86 files**. Six specs, 3 293 lines. Per file, Mocha → vitest: `profile` 18 → 18, `role` 17 → 20, `user` 13 → 10, `profileRepository` 41 → 43, `userRepository` 43 → 45, `repository` 41 → 40.

### The spec was asserting on a different subject

`test/core/shared/repository.test.js` builds an `ObjectRepository` over `kuzzle.internalIndex` — the **real** `InternalIndexHandler`, with only `init` stubbed — and then asserts on `core:storage:private:document:get`, `…:mGet`, `…:createOrReplace`. `ObjectRepository` emits none of those. It calls `this.store.get(...)`, `this.store.mGet(...)`; the events are **the handler's**, one layer down. So 41 tests about a repository were, for every database path, tests of the handler underneath it — which has its own spec.

The port stubs the store and asserts the calls the subject makes. _A spec that reaches its subject through a real collaborator is measuring both, and it will keep passing when the subject stops making the call._

### Four assertions that could not fail

| Where | What it said | Why it held regardless |
| --- | --- | --- |
| `role.checkRestrictions(req, restrictions)` | "should properly handle restrictions" | a `Request` where the index goes, a `Map` where the collection goes, **no third argument** — the method answers `true` before reading either. `TS2345`. |
| two `profile` rate-limit tests | "should throw if the rate limit is not a valid integer" | assertions inside a `catch` with no `else`: accepting the value passes the test by not entering the block. |
| `should(profileRepository.profiles).not.have.key(…)` | the deleted profile left the in-memory map | there is no `profiles` property on the repository; the assertion was on `undefined`. |
| `userRepository.search` | called with `{ query: { term: { profileIds: "admin" } } }` | it is called with `{ size: 1 }` as well. **sinon's `calledWith` matches a prefix; vitest's `toHaveBeenCalledWith` matches the call.** |

The last one is a translation-table entry and the counterpart of L1's `toThrow`: where `should`/`sinon` were laxer than vitest, a faithful port asserts **more**, and the diff is worth reading rather than silencing.

### `private` is now the dominant cost of this slice, not `should`

Third slice running ([L1b2](#what-l1b2-found), [L2a](#what-l2a-found), here), and this time six members in one PR: `optimizePolicy`, `optimizePolicies`, `areTargetsAllowed`, and `ObjectRepository`'s `collection`, `ObjectConstructor`, `cacheDb` and `store`. Two answers, and both are better than the access they replace:

- **A private method is asserted through the public path that reaches it.** `optimizePolicies` is what turns a policy's `restrictedTo` array into a `Map`, and `load()` is where that becomes visible — so the assertion is on the loaded profile, not on a stub having been called.
- **Protected configuration is set by a subclass.** Every repository in `lib/` declares its own `collection` and `ObjectConstructor` in its constructor; the spec now does the same instead of assigning them from outside.

⚠️ And two tests did not survive the trip: `areTargetsAllowed` was called directly with **an empty target list**, which `isActionAllowed` never produces — with no targets it takes the other branch entirely. They tested a state the application cannot reach.

### A fixture that answers the bus

A repository's `init()` is a list of `global.kuzzle.onAsk(...)` registrations, and what its spec owes is that each event reaches the right method. The Mocha specs asserted it by calling **`kuzzle.ask.restore()`** in the middle of a test — un-stubbing the mock to let a real emitter answer, which works only because `KuzzleMock` had stubbed one.

`tests/mocks/kuzzle.ts` grows `stubAsk(fallback?)`: `onAsk` records, `ask` dispatches, and an event **nothing registered and no fallback answers throws** — so a subject that grows a dependency says so in the spec that covers it. Nineteen "should register a X event" tests became two `it.each` tables.

### `PolicyRestrictions.collections` is declared required and is not

`{ index: "index" }` — a policy restricted to a whole index — is what `profileRepository`'s own fixture uses, and `optimizePolicy` has the guard for it (`if (!collections) { continue; }`). The type says `collections: string[]`, so the fixture needs `invalid<…>`. A restriction with no collections is a legitimate value the type cannot express; noted here rather than widened in a test-porting slice.

---

## What L2c found

**`mocha` 71 → 66**, vitest **1 037 → 1 148 tests** across **86 → 91 files**. Five specs, 2 365 lines. Per file, Mocha → vitest: `statistics` 25 → 24, `kuzzleDebugger` 17 → 23, `tokenManager` 24 → 24, `idCardHandler` 18 → 19, `state` 21 → 21.

### ⚠️ One line of `lib/` changed, and it is what [L2a](#what-l2a-found) had blamed the whole graph for

`lib/cluster/state.ts` ended with **`module.exports = State;`** — sitting next to the file's own `export default class State`. Two export forms for one class, of which only the default is used (`import State from "./state"` in `node.ts` and `subscriber.ts`).

Under vitest's ESM transform, that assignment is the error L2a reported:

```
TypeError: Cannot set property default of [object Module] which has only a getter
  ❯ lib/cluster/state.ts:472  module.exports = State;
```

So **the module, and everything that imports it — up to `index.ts`** — could not be loaded from a spec at all. L2a's conclusion ("the package entrypoint cannot be imported from a vitest spec, it pulls in the whole application") was right about the symptom and wrong about the cause: it is one legacy line, and removing it makes `import { BadRequestError } from "../index"` work in a vitest spec. The CommonJS emit is unchanged, so no consumer sees a difference.

_A porting slice that has to change `lib/` states it and stops there_ — which is what the DoD asks. This one is a deletion of dead syntax, and the mocha suite, the build and the functional matrix are the check.

### A private-only spec gains coverage when it is ported to the public surface

`kuzzleDebugger`'s Mocha spec asserted on `inspector`, `debuggerStatus`, `events`, `inspectorPost`, `notifyConnection` and `notifyGlobalListeners` — **every one of them `private`**. There was no way to translate it; it had to be re-asked from outside:

| The Mocha spec asserted | The port asserts |
| --- | --- |
| `inspector.connect` called once | `core:debugger:isEnabled` answers `true`, and `cluster:node:preventEviction` was asked |
| `events.clear()` called | a connection that was listening is no longer notified |
| `notifyConnection` called with … | `entryPoint._notify` received the payload |

17 tests became **23**, because the public surface has branches the private assertions never reached: the `reportProgress` segfault guard (it emits the progress event Chrome waits for, then turns the flag off), the eviction on a worker that closes unexpectedly, and the debug marker being dropped only once a socket's **last** listener goes.

_This is [L1b's finding](#what-l1b4-found--and-l1b-is-closed) in another form: the question "what does this subject actually expose" pays for itself._

### Two more sinon prefix-matches

`koncorde.remove(roomId, index)` — the spec named only the room. Same shape as [L2b](#what-l2b-found)'s `search`. **Third occurrence; it is now a translation-table entry, not an anecdote:** a `calledWith` assertion carries no information about the arguments it does not mention, and `toHaveBeenCalledWith` does.

### vitest's fake timers make a self-rescheduling loop infinite

`TokenManager.checkTokensValidity` reschedules itself through `runTimer`. `vi.runAllTimers()` then runs that loop until vitest aborts it ("Aborting after running 10000 timers"). The Mocha spec stubbed `runTimer` **before** the links that arm it and reset the history afterwards, which reads like ceremony and is not: it is the only way the assertion "the timer was rearmed exactly once" can be made at all. The port keeps the shape and says why.

### A decorative test, and a regression guard that now guards

- `should(stats.startRequest).be.a.Function()` × 8 asserted the module's shape; the type system states it. Gone.
- `idCardHandler`'s "should fork a worker file that exists on disk" carried a comment saying it could **not** catch the regression it was named after, because the Mocha suite runs from `dist/` where every file is a `.js`. **The vitest suite runs from source**, where the worker is a `.ts` and its parent is a `.ts` — so the port does cover the half its original could not.

---

## What L2d found

**`mocha` 66 → 61**, vitest **1 148 → 1 255 tests** across **91 → 96 files**. Five specs, 2 038 lines. Per file, Mocha → vitest: `base` 17 → 20, `bulk` 14 → 14, `realtime` 20 → 20, `server` 23 → 22, `collection` 31 → 31.

### ⚠️ Fourteen assertions in one slice that could not fail

This is the largest concentration of the family in the step, and all three shapes are about **a promise nobody waited for**:

| Where | Shape | Why it never failed |
| --- | --- | --- |
| `baseController`, 9 tests | `should((async () => { sync(); })()).rejectedWith(…)` | neither returned nor awaited; the `it` resolved first |
| `realtimeController#subscribe`, 3 tests · `bulkController`, 2 | `should(promise).rejectedWith(…)` with no `return` | same, and the *same file's* other describes do have the `return` |
| `bulkController#mWrite`, 1 | called `controller.import(request)` | wrong subject, and unasserted |

And two of the nine would have **failed** had they been asserted: they pass the option as `emptyCollectionsAllowed`, while `assertTargetsAreValid` reads **`allowEmptyCollections`**. A dead test hides a wrong test.

_`should(...)` returning a thenable is what makes this shape silent — the lesson L2a opened is now a pattern with fourteen instances, and it is worth a lint rule (`@typescript-eslint/no-floating-promises` over the spec trees, once they are all TypeScript)._

### A second spec asserting on the layer below its subject

`collectionController` builds its expectations on `core:storage:private:document:get` / `:search` / `:scroll` / `:createOrReplace` / `:delete`. The controller calls **`global.kuzzle.internalIndex.get(...)`**, `search`, `scroll`, `createOrReplace`, `delete`, `refreshCollection`. The events belong to `InternalIndexHandler`, which the `KuzzleMock` supplied for real.

Exactly [L2b](#what-l2b-found)'s finding on `ObjectRepository`, in a second place, which makes it a pattern rather than an accident: **`KuzzleMock` hands out real collaborators, so a spec written against it cannot tell its subject's calls from its collaborator's.** The port stubs `internalIndex`.

### Five more signature defects, all caught by `tsc`

- `getLastStats()`, `getAllStats()` and `now()` take **no** argument; the spec handed each of them the request.
- `_buildApiDefinition(controllers, routes)` takes two; the spec passed three.
- `assertBodyHasNotAttributes(request, ...paths)` was given `["invalid"]` where a path goes — it worked because lodash reads an array as a deep path.

That is 13 signature defects found by the type-checker across this step (3 in L1, 2 in L1b3, 4 in L1b4, 1 in L2b, 5 here). _Every one of them was invisible to a green JavaScript suite._

### `mockAssertions`, again

`test/mocks/mockAssertions.js` stubs six `assert*` methods on the subject. `bulkController` calls none of them — as `indexController` called none of them when [L1b1](#what-l1b1-found) dropped it. A mock of the subject's own surface is how that goes unnoticed; the mock is not ported.

---

## What L2e found — and L2 is closed

**`mocha` 61 → 56**, vitest **1 255 → 1 439 tests** across **96 → 101 files**. Five specs, 2 432 lines. Per file, Mocha → vitest: `profiles` 39 → 54, `roles` 37 → 47, `checkRights` 21 → 21, `rateLimiter` 8 → 8, `requestResponse` 28 → 45.

### ⚠️ `calledWithMatch(stub, …)` is an assertion that always holds

```js
should(getStub).calledWithMatch(getStub, request.input.args._id);
//                              ^^^^^^^ the stub, where the event name goes
```

`sinon.match(fn)` treats **a function as a custom matcher**: it calls it with the actual value and reads the return as the verdict. So this called the stub with `"core:security:profile:get"`, got a promise back, and matched — for any first argument whatsoever. Four assertions in `profiles.test.js` were written that way (one in `createProfile`, one in `getProfile`, two in `scrollProfiles`), and none could fail. _The same typo in `toHaveBeenCalledWith` is a type error._

### Two sibling methods, one `async` and one not

`updateProfileMapping` reads the body and returns the handler's promise; `updateRoleMapping`, three methods further down the same file, is `async`. So a missing body **throws** from one and **rejects** from the other, and the two Mocha specs were each written against their own half without either noticing the asymmetry. Both ports state which one they are asserting; the asymmetry itself is a `lib/` question for another slice.

### The mapping actions go through the handler, not the bus — third and fourth time

`securityController`'s six mapping actions call `global.kuzzle.internalIndex.getMapping/updateMapping`. Both specs asserted on `core:storage:private:mappings:*`. After [L2b](#what-l2b-found)'s `ObjectRepository` and [L2d](#what-l2d-found)'s `collectionController`, that is **four specs in three slices** aiming one layer below their subject, always for the same reason: `KuzzleMock` supplies a real `InternalIndexHandler`.

### Three more signature defects

`getProfileMapping()` and `getRoleMapping()` take no argument and were handed the request. And `checkRights`'s spec asserted `should(getUserEvent).not.called()` — on the **event's name**, a string, not on the stub.

## L2 is closed

**28 specs, 11 765 lines, five sub-slices, `mocha` 84 → 56.** What it cost, and what it was not: L2 was planned as "the codemod at a size where review fits in one sitting", and [the axis turned out to be wrong](#how-l2s-28-are-cut-by-layer) — 21 of the 28 were `KuzzleMock`-shaped work. What it actually produced is a count worth keeping:

| Found | Count | First seen |
| --- | ---: | --- |
| Assertions that could not fail | **23** | [L2a](#what-l2a-found) |
| Signature defects caught by `tsc` | **11** | [L2b](#what-l2b-found) |
| Specs asserting on a collaborator's calls | **4** | [L2b](#what-l2b-found) |
| `sinon` prefix-matches completed | **5** | [L2b](#what-l2b-found) |
| Private members re-asked through the public surface | **13** | [L2b](#what-l2b-found) |

_None of the 23 dead assertions was found by running the suite_ — they are green in both runners. They were found by writing the assertion a second time, in a language that checks it.

**What is left: L4 (34 specs / 14 128 lines), L5 (2 / 12 431), L6 (14 / 6 319), then L7's closure.** L3 is closed — see _[L3 is closed](#l3-is-closed)_.

## What L3f found — and L3 is closed

**`mocha` 51 → 50**, vitest **1 821 → 1 911 tests** across **106 → 107 files**. One spec, 2 143 lines, 90 `it`s in and 90 out. The block hash found no duplicates.

### ⚠️ Nine negative assertions pinned to a call that never happens

Eleven blocks carry a `'should not notify with "silent" argument'` test, and all eleven were written the same way:

```js
should(kuzzle.ask).not.be.calledWithMatch(
  "core:realtime:document:notify", request, actionEnum.CREATE, { _id: "_id", _source: "_source" });
```

It was copied out of `#create` into ten other blocks **without changing the action**. `update` notifies with `actionEnum.UPDATE`, `replace` with `REPLACE`, `delete`/`mDelete`/`deleteByQuery` with `DELETE`, `createOrReplace` with `WRITE`. So in **nine of the eleven**, the assertion names a call the subject never makes — with `silent` set _or unset_. They could not fail.

What the flag owes is that **nothing** is notified, which is what the port says. **A twelfth form**, and the first where the dead assertion is a _negative_: `not.calledWith(…)` is satisfied by a call that differs in any argument, so over-specifying a negative is the same as deleting it.

### `calledWithMatch` is partial, and five things were hiding in the gap

Every write action asserted its storage call with `calledWithMatch`. Making those exact says what the subject actually does:

| Hidden by the partial match | |
| --- | --- |
| The controller **injects `_kuzzle_info` into the body itself** and passes `injectKuzzleMeta: false` so the storage layer does not do it twice. Nothing in the suite said the metadata is added, or by whom. | 5 actions |
| The shape differs per action: `create` stamps `{author, createdAt}` with `updatedAt: null`; `update`/`upsert` stamp only `{updatedAt, updater}`; `createOrReplace` and `replace` go through `_writeDocument` and stamp **both halves at once**. | — |
| `upsert`'s **`default` values are stamped too**, with their own shorter `{author, createdAt}`. | — |
| The `create` and `createOrReplace` notifications carry `_version`; `createOrReplace`'s carries **`created`** as well. | — |
| The `update` notification carries the **merged** document — the stored `name: "gordon"` the request never sent — and no `_version`. The spec asserted `_source: content`, partially, and so said the opposite of what happens. | — |

### Three more `rejectedWith` with no `return` or `await`

In `#mExists`, `#mGet` and `#mDelete`. [L2d](#what-l2d-found) found fourteen of these; the family now stands at **17** across the step.

### A `beforeEach` that mutated the fixture it was building

`#mCreateOrReplace` registered two `withArgs` stubs, and built the second's answer with `items.map(item => { delete item._source; return item; })` — which **mutates the array the first stub had already captured**. Both ended up resolving documents with no `_source`. The test named _"…with `_source` for each documents"_ then asserted nothing about `_source` at all, and set `request.input.args._source` where the subject reads `source`. The port keys the answer on the option instead, and asserts the documents each branch returns.

### `.match()` cannot say a field was dropped

`#search` and `#scroll` both answer an object with an `other` key that the subject strips, and both asserted the result with `should(...).match({...})` — a partial match, which is satisfied whether `other` survives or not. `toEqual` is what states it.

### Small things

- Two `#search` tests shared the name `'should reject if the "lang" is not supported'`; one has a body and the other does not. Renamed.
- **The step's own `it` count for this file was nearly wrong**: `grep -cE '^\s*it\("'` says 69, because **21 of the 90 tests use single-quoted names**. The table's 90 came from a regex that allows both. Worth remembering before L4 is sized the same way.

## L3 is closed

**6 specs, 9 277 lines, `mocha` 56 → 50, vitest 1 439 → 1 911 tests.** One PR per spec, ordered by how much of the fixture already existed. What it added to [L2's count](#l2-is-closed):

| Found | L2 | L3 | First seen in L3 |
| --- | ---: | ---: | --- |
| Assertions that could not fail | 23 | **+15** | [L3a](#what-l3a-found) |
| New *forms* of assertion that cannot fail | 6 | **+6** (7th–12th) | — |
| Signature / declaration defects | 11 | **+9** | [L3b](#what-l3b-found) |
| Specs asserting on a collaborator | 4 | **+3** | [L3b](#what-l3b-found) |
| `sinon` prefix- or partial-matches completed | 5 | **+14** | [L3b](#what-l3b-found) |
| `lib/` defects filed, not fixed | — | **3** | [L3a](#what-l3a-found) |

The six new forms, in order of how much they hide: **`should(x).be.instanceof(Object)`** (true of every value), **an over-specified negative** (`not.calledWith` naming a call that never happens), **`should(() => {…})` with no matcher** (the callback never runs), **`calledWithMatch(event, {}, {})`** (an empty object matches every object), **`should(map).have.key(k, v)`** (the value is dropped), and **`should(x).be.exactly(x)`**.

**What is left: L4 (34 specs / 14 128 lines), L5 (2 / 12 431), L6 (14 / 6 319), then L7's closure.** ⚠️ **Run [L3d](#what-l3d-found)'s block hash before sizing any of them** — and grep for `(global as any)` and `globalThis.kuzzle` before believing a subject has no dependency on the global.

## What L3e found

**`mocha` 52 → 51**, vitest **1 750 → 1 821 tests** across **105 → 106 files**. One spec, 1 836 lines, 71 `it`s in and 71 out. [L3d](#what-l3d-found)'s hash was run first and found **no** duplicate blocks: the four `with cookies` halves genuinely differ from their siblings, so this one is a port, not a de-duplication.

### ⚠️ `should(x).be.instanceof(Object)` holds for every value in the language

```js
should(response.responseObject).be.instanceof(Object);
```

`42 instanceof Object` is natively `false`; `should(42).be.instanceof(Object)` **passes**, and so does `should(undefined)`, `should(null)` and `should("str")`. The matcher is correct for every other class — `should(42).be.instanceof(Array)` fails as it should — and inert for `Object` alone.

That is what hid the real defect: **`logout` answers `{ acknowledged: true }` and has no `responseObject`**, and four tests across `#logout` and `#logout with cookies` asserted on it. The port asserts what the method returns. **An eleventh form of assertion that asserts less than it reads**, and the first one that is a property of the assertion library rather than of how it was called.

### ⚠️ Two credentials hooks that differ in one argument, asserted identically

`createMyCredentials` and `updateMyCredentials` both call `validate` and then their own hook. The `validate` call takes **five** arguments, and the fifth — `isUpdate` — is `false` for one and `true` for the other. It is the only thing that tells the two apart.

The Mocha spec read `methodStub.firstCall.args[0]` through `[3]` and `secondCall.args[0]` through `[3]`, for both methods. Those four arguments are **identical between the two calls**, so the assertions could see neither the flag nor the order — and the order is `validate` first, `create`/`update` second, the reverse of how the spec reads. Three tests, one defect.

### An error class nothing was checking

`refreshToken`'s `security.token.refresh_forbidden` is an `UnauthorizedError`; the Mocha spec asserted `rejectedWith({ id })` with no class, so the port's first attempt guessed `BadRequestError` and failed. Written down now.

### TD-57's rule caught the port, which is the point of having it

Two `should(...).be.rejected()` — that it rejects, not with what — became `rejects.toThrow()` with no matcher, and [TD-57](../type-debt-register.md#td-57)'s `no-restricted-syntax` rule refused them. The answer is that `login` forwards the strategy's error untouched, which is now what they say. _A gate written three steps ago paying for itself._

### The fixture

`authController` reads thirteen paths off the global, and **every one of them is spelled `globalThis.kuzzle`** — so [L3c](#what-l3c-found)'s warning about `(global as any)` generalises: `global.kuzzle` is not the only spelling, and a grep for it under-reports. `pipe(event, payload)` must answer the payload by default; a promise-of-`undefined` stub makes every `login` fail on a property of `undefined`, which is the [L1b3](#what-l1b3-found) trap in its second form.

## What L3d found

**`mocha` 53 → 52**, vitest **1 693 → 1 750 tests** across **104 → 105 files**. One spec, **1 484 lines in, 465 out**, 57 `it`s in and 57 out.

### Sixteen `describe` blocks, nine shapes

The spec read as sixteen actions, one block each. Hashing each block with its own action name normalised away says otherwise:

| Shape | Actions | Lines each |
| --- | --- | ---: |
| one document in `_id` + `body` | `create`, `createOrReplace`, `replace`, `update` | 84 |
| many in `body.documents`, out via `result.successes` | `mCreate`, `mCreateOrReplace`, `mReplace`, `mUpdate` | 154 |
| one document, `_id` only | `delete`, `get` | 53 |
| one-offs | `updateByQuery`, `mDelete`, `mGet`, `search`, `deleteByQuery` | 63–91 |

**Four blocks were byte-identical to each other, and so were another four** — those three differed from `mCreate` only in having lost the word "should" from three test names, which is the whole diff across 462 lines. Stating a shape once and naming the actions that share it is [L1b4](#what-l1b4-found)'s `esWrapper` move at eight times the scale: **the duplication was in the spec, not in the subject**, so there is nothing to add to `sonar.cpd.exclusions` and nothing for a reader to diff by eye.

**57 tests in, 57 out** — each action still runs every case of its shape. What goes is 1 019 lines of copy.

### The one real difference the copies hid

`updateByQuery`, `search` and `deleteByQuery` have **no request-side extractor** — they are in `documentEventAliases.notBefore`, so the "before" pass never asks for one, and their blocks carry two tests where the write actions carry four. That is a genuine asymmetry in the subject, and in the Mocha spec it was indistinguishable from the ~1 000 lines of copy around it. Naming the shapes is what makes it visible.

### Small things

- `#mGet`'s last test wrapped its `ids` in an `args` key, which lands as `input.args.args`; what actually selects the argument branch is the **empty body**. The test passed for the right reason by accident. Written as it reads now.
- The Mocha spec used `new DocumentExtractor(req)` as a bare statement to assert its constructor throws — `no-new` in the vitest tree, so the port names the thunk.

## What L3c found

**`mocha` 54 → 53**, vitest **1 562 → 1 693 tests** across **103 → 104 files**. One spec, 1 378 lines, 131 `it`s in and 131 out.

### ⚠️ `should(() => { … })` with no assertion method — the callback is never invoked

```js
it("should return a {} object when the route is invoked with GET with a null search body is provided", () => {
  request.input.args.searchBody = null;

  should(() => {
    request.getSearchBody().be.eql({});   // never runs
  });
});
```

`should(fn)` builds an assertion object and waits for `.throw()`, `.not.throw()` — something. Nothing came, so the function was wrapped and dropped. **A ninth form of assertion that asserts less than it reads**, and the most complete one yet: the test asserted *nothing at all*.

**Running it says why it was written that way.** With `searchBody: null`, `getSearchBody()` does not return `{}` — it throws `api.assert.invalid_type`, because `null` is not *absent*, so the default never applies and `getObject` rejects it. The test's **name** described a behaviour the subject does not have. The port asserts what it does, and renames it. Whether `null` ought to be read as absent is a `lib/` question, filed not fixed.

### ⚠️ `should(x).be.exactly(x)` — a value compared with itself

```js
should(request.error.status).be.exactly(request.error.status);
```

Twice, in the two tests that build a request from an error and from a *serialized* error. Both meant "the error keeps the status it came in with" — which is the whole point of the second one, deserialization — and both are true of every value in the language. **A tenth form.**

### Three declarations `tsc` refused, all in the subject

| | |
| --- | --- |
| `getBodyArray`, `getArray` and `getArrayLegacy` declare their default as `def: [] \| undefined` — the empty **tuple**. No caller can pass a default with anything in it. Four tests do, at runtime, happily. | TS2345 × 4 |
| `serialize()` returns a `headers` field (deprecated, a duplicate of `options.connection.misc.headers`) that its return type `{ data, options }` does not mention. | TS2339 |
| `timestamp` is declared `number`, and the request carries through whatever it was handed — the spec has always round-tripped the **string** `"timestamp"`. `tsc` let it pass because `toBe` accepts anything; **SonarCloud's S5845 is what caught it**, as a new Critical. | the gate |

Cast at the call sites with the reason, as the DoD requires; both are `lib/` fixes for a slice that is allowed to touch it.

### ⚠️ A `global.kuzzle` dependency that `grep` cannot see

`KuzzleRequest` reads exactly one thing off the global — `global.NODE_ENV`, in `addDeprecation`. Grepping `global.kuzzle` across `lib/api/request/` returns **nothing**. It is still wrong: `requestResponse.ts` spells it `(global as any).kuzzle.id`, so the fixture needs one field after all, and the Mocha spec's bare `new KuzzleMock()` — a ~600-line application stub instantiated purely for its constructor's side effect — was there for that. _The cast that silences the compiler also hides the dependency from the reader._ Worth a grep for `(global as any)` before L4 sizes itself on what subjects appear to need.

### Small things

- Two tests shared the name _"should return the string of an array (lodash parameter)"_; one is about `names.0` and the other about `relations.lebron[0]`. Renamed, not merged.
- `getArray` and `getObject` **write their parse back onto `input.args`**. The Mocha spec asserted that, which is why the port's `throws()` helper runs its callback exactly once — a matcher that invokes it twice would be asserting against a request the first call already changed.

## What L3b found

**`mocha` 55 → 54**, vitest **1 493 → 1 562 tests** across **102 → 103 files**. One spec, 1 390 lines, 69 `it`s in and 69 out.

### ⚠️ `calledWithMatch(event, {}, {})` — an empty object matches every object

```js
should(searchStub).be.calledWithMatch(searchEvent, {}, {});
```

`sinon.match({})` is satisfied by **any** object, so _"should handle empty body requests"_ asserted only that `core:security:user:search` had been asked at all: neither the empty search body nor the default options were checked. **An eighth form of assertion that asserts less than it reads**, after [L2's six](#l2-is-closed) and [L3a's](#what-l3a-found).

Pinning the arguments is what said what the defaults actually are: **`size` defaults to `limits.documentsFetchCount` (10 000), not to the request's own `size`**. No spec in either runner had stated that.

### The mapping actions go through the handler, not the bus — fifth and sixth time

`getUserMapping` and `updateUserMapping` call `global.kuzzle.internalIndex.getMapping/updateMapping`; both Mocha tests asserted on `core:storage:private:mappings:*`, which `KuzzleMock`'s **real** `InternalIndexHandler` emits one layer below. Exactly [L2e](#what-l2e-found--and-l2-is-closed)'s finding on the `profiles` and `roles` halves of the same controller — the same six actions, the same cause, now **six specs in four slices**. And, as there, **`getUserMapping()` takes no argument** and was handed the request.

### Five sinon prefix-matches, all dropping the same argument

`_persistUser(request, profileIds, content, { humanReadableId })` takes four. `createUser`, `createRestrictedUser` (twice) and `createFirstAdmin` (twice) each asserted the first three and let the fourth through — so nothing in the suite said that `kuid=human` is the default, or that these five call sites pass it at all.

### `loadConfig()` answers a shared object

`restrictDefaultRights` iterates `config.security.standard`, so the honest fixture is the shipped default rather than a hand-written one that would agree with the assertion by construction ([L1b4](#what-l1b4-found) settled that). But `loadConfig()` returns the *same* object each call: pinning `limits.documentsFetchCount = 1` in one test made the next three fail. `KuzzleMock` deep-cloned it, which is the detail a fixture derived from it has to carry over. _A fixture may inherit a mock's bug fix as easily as its bug._

### Five protected members the spec drives

`anonymousId`, `_persistUser`, `_mDelete`, `restrictDefaultRights` and `translateKoncorde` are all `protected` or `private`, and the spec sets or stubs every one of them — `anonymousId` is what `getUserStrategies` compares against, and `_persistUser` has its own `describe` block. Named once in an `Internals` alias, as [L1b2](#what-l1b2-found) settled. The count now stands at **18**.

## What L3a found

**`mocha` 56 → 55**, vitest **1 439 → 1 493 tests** across **101 → 102 files**. One spec, 1 046 lines, 54 `it`s in and 54 out — but one of the 54 that went in had an empty body, so the port is 53 real tests → 54.

### ⚠️ `should(map).have.key(k, v)` silently ignores its second argument

```js
should(roleRepository.roles).have.key(fakeRole._id, fakeRole);
//                                                  ^^^^^^^^ read as a second KEY, then dropped
```

`should`'s `.key` takes key names, not a key and a value, and extra arguments do not tighten it: `have.key("foo", {a: 999})` passes on a one-entry `Map` holding `{a: 1}`, and `have.key("foo")` passes on a two-entry map. The test was named _"should load the role directly from DB if it is not in memory"_ and meant to assert **the cache now holds that role**; what it asserted was that the cache has a key called `"foo"`. The port states the value. **A seventh form of assertion that asserts less than it reads**, after [L2's six](#l2-is-closed).

### An `it` with an empty body

```js
it("should throw on an unknown plugin action, if not forced", () => {});
```

It duplicated the test three above it, so nothing was lost by it being empty — but nothing was gained either, and the suite counted it as passing. Rather than delete it, the port gives it the claim its neighbour does not make: **the suggestion the error carries**. Which is how the next one was found.

### `didYouMean` is inert outside development, and no spec had ever reached it

`lib/util/didYouMean.ts` returns `""` unless `global.NODE_ENV === "development"`. The unit suites run under `NODE_ENV=test`, so every `unknown_action` / `unknown_controller` error asserted in either runner carried an empty suggestion, and the branch that builds one has never been exercised by a spec. The ported test sets `global.NODE_ENV` for its duration and asserts the real message. _This is the branch [L1b3](#what-l1b3-found) predicted existed but did not name._

### A fifth spec asserting on a collaborator instead of its subject

`should(kuzzle.log.warn).be.not.called()` — the subject warns through `this.logger`, which is `global.kuzzle.log.child("core:security:roleRepository")`. `KuzzleMock`'s `child()` answers a **different** stub, so the assertion watched an object the subject never touches. It joins the four counted in [L2](#l2-is-closed). Two more of the same kind: `should(kuzzle.emit).not.be.called()`, twice in `#delete`, on a path where the subject never emits at all. The port replaces them with what the refusals actually owe — that nothing was looked up, and that nothing was deleted.

### ⚠️ `checkRolePluginsRights` `return`s where it means `continue` — and that is a `lib/` defect

```ts
for (const roleController of Object.keys(role.controllers)) {
  if (roleController === "*" || global.kuzzle.funnel.isNativeController(roleController)) {
    return;                       // <- leaves the method, not the iteration
  }
  ...
}
```

A role that grants rights on a native controller **and** a plugin controller has its plugin half validated only if the plugin controller is listed first. The Mocha spec's _"should skip non-plugins or wildcarded controllers"_ passed one controller at a time and could not see it. **Not changed here** — a porting slice leaves `lib/` alone (see the DoD), and this needs its own PR with its own regression test. Filed as a finding, not carried along.

### Small things

- Two `sinon` prefix-matches completed: `deleteFromDatabase(id)` is called with `(id, { refresh: "false" })`, and `persistToDatabase(role)` with `(role, options)`. Plus `validateAndSaveRole`'s second argument, which carries a `force` the three `calledWithMatch` assertions never mentioned.
- `checkRoleNativeRights` and `checkRolePluginsRights` are **synchronous and return nothing**; two tests stubbed them with `.resolves()`.
- `_kuzzle_info` is written by `_createOrReplace` and `update` and asserted by six tests, and `Role` does not declare it — the metadata rides on the DTO and the model never names it. The port says so in one alias rather than six casts.
- `new NativeController()` binds `global.kuzzle.pipe` in its constructor, so a fixture that builds real controllers to ask them their actions needs `pipe` even though the subject never pipes anything.
- The ten _"should register an X event"_ tests were written as `kuzzle.ask.restore()` — un-stubbing the mock mid-test to reach a real emitter underneath. `stubAsk`'s `ask`/`onAsk` pair answers them directly, which is what that helper's `answerers` map was built for; **L3a is its first user**.

## What L4a found

**`mocha` 50 → 39**, vitest **1 911 → 1 994 tests** across **107 → 117 files**.
Eleven specs, 1 336 lines, 79 `it`s in and **83** out. One PR, eleven deletions
— the largest single move of the ratchet in this step.

### ⚠️ The `beforeEach` was never about the mock

Every one of the eleven opened with the same ten lines:

```js
beforeEach(() => {
  mockrequire("../../../lib/kuzzle", KuzzleMock);
  ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));
  application = new Backend("black-mesa");
});
afterEach(() => { mockrequire.stopAll(); });
```

It reads as a mocking idiom and half of it is: `mock-require` only affects a
*later* `require`, so the subject had to be reloaded after the stub was
registered. `vi.mock` is hoisted, so that half disappears — and dropping the
whole thing for a plain import is the obvious port. **It fails every test after
the first, in all eleven files.**

`backend.ts` keeps `global.app` in a module-level `_app`, behind a setter that
throws `"Cannot build an App instance: another one already exists"` on the
second write. One `new Backend()` per module *evaluation* is all the subject
allows — and `reRequire` was re-evaluating the module on every test. **The dance
was what made a per-test `new Backend()` legal, and nothing in the spec said
so.**

So the re-evaluation stays, stated for what it is: `createBackend()` calls
`vi.resetModules()` and imports the subject fresh (`tests/core/backend/backendFixture.ts`).
`vi.mock` survives a reset — the registry is per test *file* — so the
substitution is still in place on every re-import.

**This is the answer L4 was carved out to find, and it is not the expected one.**
The question was framed as "`vi.mock` is static where `mock-require` is
dynamic". For this family the substitution is perfectly static; what is dynamic
is the *subject's own module state*. ⚠️ **Before porting any of L4b–L4e, ask
what the `reRequire` is resetting, not what the `mockrequire` is replacing.**

### ⚠️ A mock factory must not import the mocked module — it deadlocks silently

The first attempt put `FakeKuzzle` in the same file as `createBackend`, so the
factory read:

```ts
vi.mock("../../../lib/kuzzle", async () => ({
  default: (await import("./backendFixture")).FakeKuzzle,   // imports Backend…
}));                                                        // …which imports lib/kuzzle
```

vitest has to settle the factory before it can resolve the mocked module, and
the factory's own graph reaches back into it. **The run hangs at collection
time — no test, no timeout, no error, no output.** Two Docker runs were killed
at 24 and 10 minutes believing `npm ci` was slow. The fixture is now split:
`fakeKuzzle.ts` imports nothing from `lib/`, and the warning is written at the
top of it.

**Also: answer every name the module exports.** `lib/kuzzle` exports the class
twice, `export { Kuzzle }` and `export default`, and a factory returning only
one leaves the other `undefined` for whoever imports it that way.

### ⚠️ Module re-evaluation breaks `instanceof`, and three tests said so

`toBeInstanceOf(EmbeddedSDK)` and `toBeInstanceOf(BadRequestError)` fail when
the class is imported statically: `createBackend()` re-evaluated the graph, so
the object the subject built came from a *different* copy of the module. Both
are now imported with `await import(…)` inside the test, after the reset. The
cost is real and it is the price of the answer above — **any L4 spec that
re-evaluates its subject cannot compare classes across a static import.**

### `server.http.enabled` is not a configuration key

`BackendConfig`'s four tests drove `config.set("server.http.enabled", false)`
and read it back. The server's HTTP settings live under
`server.protocols.http`; there is no `server.http`. `_.set` creates whatever
path it is handed, so the test wrote a branch nothing reads and then read it
back — **it demonstrated lodash, not the subject**. `tsc` is what said so
(`TS2339`, on a type that is right). Driven on the real key now.

### ⚠️ A pipe asserting inside itself, that nothing ever ran — a thirteenth form

`Backend#start`'s main test appended a pipe on `kuzzle:state:ready`:

```js
application._pipes["kuzzle:state:ready"] = [
  ...application._pipes["kuzzle:state:ready"],
  async () => should(application.started).be.true(),
];
```

The pipes are handed to the `Kuzzle` that `start()` builds and reach its event
bus. That object is the stub; its `start()` triggers nothing. **The callback was
never called**, so the assertion could not fail — and could not pass either.
Close kin to [L2a](#what-l2a-found)'s assertion-inside-a-callback, but a
distinct shape: there the callback ran too early, here it never ran at all. The
port asserts what `start()` itself does.

### ⚠️ A deletion broke three tests in a file it did not touch — the second time

`test/core/plugin/pluginsManager.test.js` `#_initApi` went red with
`"App instance not found. Are you sure you have already started your
application?"` the moment the eleven Backend specs were deleted. It never built
an application: it passed because those specs ran **earlier in the same Mocha
process** and left a `global.app` behind. The spec now defines its own, with a
comment saying why. [L3a](#what-l3a-found) found the same shape through
`global.NODE_ENV`; **39 specs left, and the only way to see this is to run the
whole Mocha suite after every deletion** — which is what the DoD says and what
caught it.

**And the reason it can happen at all is a `lib/` question, filed not fixed:**
`checkActionDefinition` reads `global.app.config.content` for **every**
controller it checks, plugin controllers included, through a getter that throws
when no application was built. It takes an `application: boolean` parameter and
does not use it for this. A plugin registering a controller on a Kuzzle that was
not started from a `Backend` crashes on a missing application.

### The two `BackendStorage` specs were one test and a half

`BackendStorage-es7` and `-es8` hold two tests each. The second is byte-identical
between them — neither pins `majorVersion`, so both ran the *configured* default,
twice. It is stated once now. The first genuinely differs, and only in how the
two Elasticsearch clients expose `maxRetries`: a plain property on 7, a symbol on
8. That is `it.each(["7", "8"])` over one body, which is
[L1b4](#what-l1b4-found)'s `esWrapper` move at the smallest possible scale.

### Small things

- **+4 tests on 79.** `BackendPlugin`'s *"should throw an error if the plugin is
  invalid"* was four `should(…).throwError()` in one `it`; split, each failure
  mode now names itself. `BackendPipe` gains the `application === undefined`
  branch and `Backend` the `already_started` one; `BackendStorage` loses the
  duplicate above.
- `Backend`'s *"should call kuzzle.start…"* asserted `plugin.instance` equals a
  second read of `_instanceProxy`. It is a getter that builds a fresh object,
  `init` closure included, so the two are never the same object — `should`'s
  `eql` accepted it, `toEqual` does not. The port asserts what the proxy
  carries.
- Node's *"Cannot find module 'foo'"* is *"Cannot find package 'foo'"* under
  vitest: the Mocha suite ran the emitted CommonJS, vitest runs the source as
  ESM. **Any ported spec asserting on a module-resolution message will need
  this.**
- `FakeKuzzle` deep-copies the config it is handed, where production passes the
  real object: `loadConfig()` answers a shared singleton and `BackendConfig`
  mutates it in place ([L3b](#what-l3b-found)'s lesson, applied in the fixture
  rather than in each spec).

## What L4b1 found

**`mocha` 39 → 38**, vitest **1 994 → 2 004 tests** across **117 → 118 files**.
One spec, 478 lines, 10 `it`s in and 10 out.

### The "conditional substitution" was not conditional

This spec was the reason L4b was expected to be the hard half: it registers
`pino` twice, once in the file's outer `before` (`{ transport }`) and again in
the `AccessLoggerWorker` block (`{ transport, pino }`), re-requiring the subject
in between. That is the textbook case `vi.mock` cannot express — a different
stub per block.

**The second registration is the first plus a key.** Nothing in the file ever
needs `pino` to be *absent*; the outer stub omits it only because the `#init`
tests never reach the call. One `vi.mock("pino")` providing both exports serves
the whole file, and the swap disappears. Together with
[L4a](#what-l4a-found)'s finding, **two of the two "dynamic" cases examined so
far turned out to be static once the reason for the reload was named.**

### One stub where the Mocha spec registered two

`mock-require` keys on the literal specifier, so the spec registered both
`worker_threads` and `node:worker_threads`. The subject imports only the
`node:`-prefixed name. Same for `net`/`node:net` in
[`mqtt`](#slices) and `zlib`/`node:zlib` in `protocols/http` — **expect the
duplicate registration in the rest of L4b, and drop it.**

### `instanceof` across the reset, again

The `#init` test asserts the worker rebuilds a `KuzzleRequest` from the
serialized message. A statically imported `KuzzleRequest` is a different class
once `vi.resetModules()` has run, so it is imported inside the test. **Third
occurrence in two slices** — it is now the predictable cost of the L4a answer,
not a surprise.

### Small things

- `accessLogger.ts` reads `global.kuzzle.id` in both `logAccess` branches, and
  that is *correct*: the module's bottom sets `global.kuzzle = { id:
  workerData.kuzzleId }` when it runs as a worker thread, and `kuzzleId` is
  `global.nodeId` from the main thread. The spec asserted
  `nodeId: global.kuzzle.id` — the same expression on both sides of the
  assertion, so it could only fail if the property vanished. Pinned to the
  literal now.
- The three `calledWithMatch` on `postMessage` and `pino.transport` are exact
  here: the `targets` array is the whole point of `initTransport`, and a
  partial match said nothing about the two entries it did not name.

## What L4b2 found

**`mocha` 38 → 37**, vitest **2 004 → 2 027 tests** across **118 → 119 files**.
One spec, 461 lines, 17 `it`s in and **23** out.

### ⚠️ `global.kuzzle` is a write-once singleton, exactly like `global.app`

`lib/kuzzle/kuzzle.ts` installs an accessor over a module-level `_kuzzle`. Its
**getter throws** while no instance exists (`"Kuzzle instance not found. Did you
try to use a live-only feature before starting your application?"`) and its
**setter throws on the second write** (`"Cannot build a Kuzzle instance: another
one already exists"`). `global.nodeId`, installed by `backend.ts`, is the same
shape with a setter that always throws.

`tests/mocks/kuzzle.ts` both *read* the global (to remember what was there) and
*assigned* it. Neither is safe, and — this is the part that matters — **whether
either throws depends on whether the spec's import graph happens to reach those
modules**, which is not something a spec can be asked to know. Nine slices of
specs never noticed because their graphs never pulled `lib/kuzzle/kuzzle.ts` in;
this one imports the package entrypoint, so it did.

The fixture now **redefines** both properties (`Reflect.defineProperty`, both
are declared `configurable`) instead of assigning them, and reads them through a
`try`. That is idempotent, independent of the guards, and it is the same move
[L4a](#what-l4a-found) had to make by hand in `pluginsManager.test.js`.
**Second singleton of this shape in two slices — assume the next global is one
too.**

### The order of the two setup steps is now load-bearing

`loadSubject()` re-evaluates the module graph, and `lib/kuzzle/kuzzle.ts`
**re-installs `global.kuzzle`'s accessor when it does** — discarding whatever
was stubbed before it. So the subject must be loaded *first* and the global
stubbed *second*. Stated in the spec, because nothing about the two lines says
it.

### The event the spec meant to test, and did not

`#init`'s _"should attach events"_ walked the four `aedes.on` registrations by
index — `getCall(0)`, `getCall(1)`, then **`getCall(1)` again** with the history
reset in between, then `getCall(3)`. `getCall(2)` is `clientDisconnect`, and it
was never exercised; `clientError`'s handler was asserted twice instead. Both
handlers are named rather than indexed now, and `clientDisconnect` gains its
first assertion. **A copy-paste in an index, which is what
[L3e](#what-l3e-found) warned about — asserting `args[n]` by index stops where
the author stopped.**

### `publish` takes a callback the assertions never mentioned

`client.publish(packet, done)` — `calledWithMatch` is partial, so the second
argument was invisible in both `#onMessage` and `#_respond`. Named now.

### Small things

- `#broadcast` asserted `calledTwice()` and then named only `ch1`. Both
  channels are stated.
- `#onMessage`'s first test drove three distinct rejections — wrong topic, no
  payload, no client id — through one `it` and one `callCount(0)`. Three tests.
- The _"payload cannot be parsed"_ test looped over three `NODE_ENV` values
  inside one `it`, resetting the spy between them; `it.each` makes each its own
  test, and a failure now says which environment.
- `#_respond` only covered `developmentMode: true`. The other branch — answer
  the client directly — is the one that runs in production, and it had no test.
- `Bluebird.promisify` is four lines of local helper; the vitest tree does not
  take the dependency.
- ⚠️ The Mocha spec registered `net` **and** `node:net`. As
  [L4b1](#what-l4b1-found) predicted, one stub is enough.

## What L4b3 found

**`mocha` 37 → 36**, vitest **2 027 → 2 052 tests** across **119 → 120 files**.
One spec, 579 lines, 24 `it`s in and **25** out. `test/mocks/uWS.mock.js`'s
`MockHttpRequest` is promoted to `tests/mocks/uWS.ts`; the socket, the response
and the `App` stay behind until [L4b4](#slices) needs them.

### ⚠️ Import order is the whole difficulty of this spec

Two tests failed with `"Kuzzle instance not found"`, thrown from a stub that had
been installed correctly. The cause is the corollary of
[L4b2](#what-l4b2-found)'s finding: `vi.resetModules()` empties the registry,
and **the first module to pull `lib/kuzzle/kuzzle.ts` back in re-installs
`global.kuzzle`'s accessor over a null instance.** A test that reaches for the
package entrypoint mid-way — `await import("../../../../index")`, to get
`Request` for an `instanceof` — does exactly that, and throws the spec's own
global away between the arrange and the assert.

Every module this file needs is therefore loaded in one place, before the global
is stubbed, and nothing is imported from inside a test. **The rule for the rest
of L4: after a reset, load first, stub second, and import nothing later.**

### ⚠️ `kuzzle.pipe`'s second calling convention, for the third time

`http:options` is piped as `pipe(event, request, callback)`. A promise-only stub
does not fail the test — **it hangs it**, for the full 20-second timeout, with
no error. [L1b3](#what-l1b3-found) found this in `Router._executeFromHttp` and
[L1b](#what-l1b1-found) wrote it down; it is now the third slice to pay for it.
The fixture's `pipe` answers both shapes.

### Three tests that were reading a config the suite had not set yet

`#default headers`'s three tests disagree about `Access-Control-Allow-Credentials`,
and the reason is ordering: the Mocha `beforeEach` set
`kuzzle.config.http.cookieAuthentication = false` **after** constructing the
suite's `router`, and `defaultHeaders` is assembled in the constructor. So the
first test saw the packaged default (`true`, credentials header present) and the
other two, which build their own `Router`, saw `false`. Each test now sets what
it depends on, and the fixture uses the **real** configuration — deep-copied,
per [L3b](#what-l3b-found) — because three of these tests are about which
configured value lands in a header, and a hand-written config would agree with
the assertion by construction.

### The one genuinely per-test substitution in L4 so far

_"should return an error if an exception is thrown"_ swaps `routeHandler` for a
class whose `request` getter throws, for that test alone. `vi.mock` is hoisted
and would apply to the whole file, so this is `vi.doMock` — the non-hoisted
form — plus a re-import, and `vi.doUnmock` in a `finally`. **One test out of
34 specs so far actually needs the dynamic form.**

### Small things

- Six `it`s adding one route each, two pairs differing only in a URL, and two
  parametric-route tests that the [block hash](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd)
  had already flagged as duplicates, collapse into four `it.each`. The
  duplicate-url test covered two distinct cases in one `it`; they are two.
- Every routing test was `done` + `try`/`catch`; `settle` (from
  [L1b](#what-l1b1-found)) plus an `await` is what they are now, and an
  assertion that fails reports as a failure rather than as a timeout.
- The last test in the file is not about the router at all — it asserts that
  every deprecated route in `lib/api/httpRoutes` declares `since` and
  `message`. That subject has no spec of its own, so it is kept where it was
  found, with a note and with a `length > 0` guard: over an empty list, the
  loop asserted nothing.

## What L4b4 found — and L4b is closed

**`mocha` 36 → 34**, vitest **2 052 → 2 129 tests** across **120 → 121 files**.
**Two** specs, 1 783 lines, 75 `it`s in and **77** out — and two mocks retired:
`test/mocks/uWS.mock.js` and `test/mocks/entrypoint.mock.js` have no users left.

### Two files, one subject, one mirror

`protocols/http.test.js` and `protocols/websocket.test.js` both re-required
`httpwsProtocol` and both built the same `HttpWs`. The `tests/` mirror maps one
spec to one `lib/` file ([L1b1](#what-l1b1-found)), so they are **one** file
here — the HTTP half and the WebSocket half of the same protocol — and
`prepare-coverage.ts` attributes the subject once instead of losing one of the
two. Two specs, one ratchet step each, in one PR.

### A mocked module still needs its real constants

`vi.mock("uWebSockets.js")` answers `App()` with the mock — and `DISABLED`,
`SHARED_COMPRESSOR` and `getParts` with **`vi.importActual`'s**. The subject
compares the configured compression against `uWS.DISABLED` by value, and a
stubbed constant would make the assertion agree with itself. The same is true of
`node:zlib` in the two compression-failure tests: everything but the one failing
function is the real module.

### `init()` builds a new server, so "the second call" is on a different object

_"should start a websocket server according to the provided configuration"_
calls `init()` twice and asserted `ws` was called with `compression: DISABLED`.
`init()` assigns `this._server = uWS.App()`, so the second registration is
**call 0 of a second app**, not call 1 of the first. The Mocha assertion happened
to be right because `calledWithMatch` searches every call of whatever
`httpWs.server` currently points at; written exactly, the index has to say which
server it means.

### A default a fixture must not drop

`entrypoint.mock.js`'s `execute` was `sinon.stub().yields({})` — it *answers*.
`tests/mocks/entryPoint.ts` first stubbed it as a bare `vi.fn()`, and the
rate-limit test went red three calls later: a protocol writes its response from
that callback, so a stub that never calls it makes the socket look silent for
the wrong reason. **When a mock's method has a default behaviour, the behaviour
is part of the mock.**

### Small things

- `maxBackPressure`, not `maxBackpressure`. `calledWithMatch` accepted the
  misspelling silently because it never looked for the key; `toMatchObject` on
  the recorded options says which one exists.
- Sixteen `it`s collapse into six `it.each` — four content-type rejections, two
  encoding rejections, two backpressure shapes, four compression algorithms,
  six raw-response payload types, two `disconnect` messages and the
  `joinChannel`/`leaveChannel` pair.
- The applicative-PING test drove two messages and two assertions through one
  `it`; the second — that a PING carrying a request is routed rather than
  ponged — is its own test now.
- The `for (let i = 0; !tryEnd.calledOnce && i < 10; i++)` poll that four tests
  copied is one named helper.

## L4b is closed

**5 specs, 3 301 lines, `mocha` 39 → 34, vitest 1 994 → 2 129 tests.** Four PRs,
one per subject. What it settled:

| | |
| --- | --- |
| **The slice's premise was wrong three times out of three.** | L4 was carved out because `vi.mock` is static where `mock-require` is dynamic. In [L4a](#what-l4a-found) the dynamic thing was `global.app`'s singleton; in [L4b1](#what-l4b1-found) the "two pino stubs" were one stub plus a key; in [L4b3](#what-l4b3-found) and [L4b4](#what-l4b4-found) exactly **three tests out of 79** need `vi.doMock`. |
| **The real cost is the globals.** | `global.kuzzle`, `global.app` and `global.nodeId` are all write-once accessors installed by module evaluation, and `vi.resetModules()` re-installs them. Load the subject first, stub the global second, import nothing later. |
| **Two mocks retired, two promoted.** | `test/mocks/uWS.mock.js` → `tests/mocks/uWS.ts`, `test/mocks/entrypoint.mock.js` → `tests/mocks/entryPoint.ts`. `test/mocks/` is down to `kuzzle.mock.js` and its remaining L4c–L4e users. |

**Next: L4c (cluster, 3 specs / 2 627 lines), L4d (plugin + validation, 4 /
3 882), L4e (the strays, 11 / 2 982).**
