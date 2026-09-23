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

| #          | Content                                                                                                                                                                                                                                                                                                                                                                                            |  Specs |      Lines | Why this grouping                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0** ✅  | **The three specs that already had a vitest counterpart** — measured by coverage rather than by line count, completed where the coverage said so, then deleted; see _What L0 found_                                                                                                                                                                                                                |  **3** |  **3 385** | The only place the ratchet can be moved by _deleting_ rather than porting — and the only place it can be moved dishonestly. Doing it first sets the standard the rest is measured against. Two of the three also carry `mock-require`.                                                                                                |
| **L1** ✅  | **The codemod, proven on the specs that mock nothing shared**: `should` → `expect`, `sinon` → `vi`, `require` → `import` — **27 specs, not 60**; see _What L1 found_                                                                                                                                                                                                                               | **27** |  **2 049** | 41% of the files for 9% of the lines. It is where the codemod gets written and proven, and it shrinks the remaining file list to the specs that need thought.                                                                                                                                                                         |
| **L1b** ✅ | **The specs built on `test/mocks/kuzzle.mock.js`** — one fixture derived per spec, never that mock. Sub-sliced by subject area: **b1** `api/` ✅ (8) · **b2** `hotelClerk` ✅ (7, incl. 2 taken from L2 to close the mirror) · **b2b** `notifier` ✅ (7, idem) · **b3** the rest of `core/` ✅ (8 specs → 7 files) · **b4** `service/` + `util` ✅ (4); see _What L1b1/L1b2/L1b2b/L1b3/L1b4 found_ | **30** |  **3 459** | Not a translation: the vitest tree refuses the ~600-line application stub on purpose, so each spec has to state what its subject actually reads from `global.kuzzle`. Found by L1; it had no slice before.                                                                                                                            |
| **L2** ✅  | The clean specs at **201–1 000 lines**, by layer — sub-sliced below into **a**–**e**, all landed (28 specs, 11 765 lines)                                                                                                                                                                                                                                                                          | **29** | **12 995** | Same transformation at a size where review still fits in one sitting.                                                                                                                                                                                                                                                                 |
| **L3** ✅  | The **six clean specs over 1 000 lines** — `documentController` 2 143, `authController` 1 836, `documentExtractor` 1 484, `securityController/users` 1 390, `request` 1 378, `roleRepository` 1 046                                                                                                                                                                                                |  **6** |  **9 277** | Still only the codemod, but each one is a PR's worth of review on its own, and five of the six are `api`. After L3 the suite is **52 files and all of them are hard**.                                                                                                                                                                |
| **L4** ✅  | **`mock-require` → `vi.mock`**, excluding the Elasticsearch twins, `core` first — sub-sliced [by subject](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd) into **a**–**e**; **all five landed** ([L4 is closed](#l4-is-closed))                                                                                                                                            | **34** | **14 128** | One decision repeated 34 times: `vi.mock` is hoisted and static where `mock-require` is dynamic, so a spec that swaps a module _conditionally_ or inside a `beforeEach` needs restructuring, not translating. Its own slice because the answer generalises.                                                                           |
| **L5** ✅  | The **two Elasticsearch twins** (they carry `mock-require` too) — sub-sliced [by action group](#how-l5s-2-are-cut-by-action-group--measured-on-2-dev-2026-09-23-623676e7f) into **a**–**e**; **all five landed, both files deleted**                                                                                                                                                               |  **2** | **12 431** | 19% of the suite in two near-identical files, so the second is largely the first's diff — exactly K3's shape, and K3's cost is the estimate to use. Its own PR because its size dominates any review it shares.                                                                                                                       |
| **L6**     | The **`rewire` specs** — **12** since [L4e2](#what-l4e2-found) deleted two of them as already-ported duplicates, [cut into a–h](#how-l6s-12-are-cut--measured-on-this-branch-2026-09-23-20052a2b3)                                                                                                                                                                                                 | **12** |  **6 083** | Budgeted as redesigns — **measurement says five of the twelve are ports** (`rewire` used as `require`), and the redesign is one shape appearing twice: a module-private helper stubbed in place. Expect `lib/` changes in three of the eight sub-slices, not all of them.                                                             |
| **L7**     | **Closure**: delete `.mocharc`, `mocha`, `should`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`, the `test:unit:mocha*` scripts, `npm run build:tests`, the `mocha` ratchet and its baseline; shrink `tsconfig.tests.json` to the cucumber directories and clear its 65 own strict errors                                                                               |      — |          — | Mechanical **and only correct when the ratchet is 0** — the same condition K6 had. ⚠️ **`build:tests` exists because `.mocharc` globs `dist/test/**`** ([step 12 K6](12-sprint-9-strict-flip.md#what-k6-found)); vitest runs from source, so this slice removes a build step, and the payload must be diffed exactly as K6 diffed it. |

### Re-measured on `2-dev` after L1b (2026-09-21, `089ef8160`)

The table above is the plan as it stood at 148 specs. L1b closed at **84 specs / 53 920 lines**, and it did not consume its slices cleanly: b2 and b2b each pulled two specs out of L2 to close a mirror, and b4 pulled the two `esWrapper` specs. **What is actually left:**

| Class                              |  Specs |      Lines | Slice                                  |
| ---------------------------------- | -----: | ---------: | -------------------------------------- |
| Clean, ≤ 200 lines                 |      3 |        265 | L2 — three strays L1/L1b's axes missed |
| Clean, 201–1 000 lines             |     25 |     11 500 | **L2**                                 |
| Clean, > 1 000 lines               |      6 |      9 277 | **L3** (unchanged)                     |
| `mock-require`, minus the ES twins |     34 |     14 128 | **L4** (unchanged)                     |
| The two Elasticsearch twins        |      2 |     12 431 | **L5** (unchanged)                     |
| `rewire`                           |     12 |      6 083 | **L6** (−2: [L4e2](#what-l4e2-found))  |
| **Total**                          | **84** | **53 920** |                                        |

L2 is therefore **28 specs / 11 765 lines**, not 29 / 12 995. The three strays are `core/auth/passportResponse` (26), `util/memoize` (61) and `kuzzle/vault` (178) — under 200 lines, no KuzzleMock, no `mock-require`, no `rewire`: they fit L1's axis and were missed by it. _A fourth demonstration that a slice's axis is a hypothesis;_ here the cost is three cheap files rather than a re-cut.

L3, L4, L5 and L6 are untouched by L1b and their numbers still hold.

#### How L2's 28 are cut, by layer

Five sub-slices of comparable size, because 11 765 lines is four times what a
sitting reviews and the layers do not interleave:

| Sub-slice  | Specs | Lines | Shape       | Content                                                                                                                            |
| ---------- | ----: | ----: | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **L2a** ✅ |     7 | 1 637 | codemod     | the three strays + `service/storage/queryTranslator`, `kuzzle/event/pipeRunner`, `kerror/codes`, `kuzzle/event/KuzzleEventEmitter` |
| **L2b** ✅ |     6 | 3 293 | **fixture** | security: `model/security/{profile,role,user}`, `core/security/{profileRepository,userRepository}`, `core/shared/repository`       |
| **L2c** ✅ |     5 | 2 365 | **fixture** | the rest of `core/` (`tokenManager`, `kuzzleDebugger`, `statistics`) and `cluster/` (`idCardHandler`, `state`)                     |
| **L2d** ✅ |     5 | 2 038 | **fixture** | the `api` controllers: `base`, `bulk`, `realtime`, `server`, `collection`                                                          |
| **L2e** ✅ |     5 | 2 432 | **fixture** | `securityController/{profiles,roles}`, `funnel/checkRights`, `rateLimiter`, `requestResponse`                                      |

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

| Sub-slice                                                          | Spec                                       | Lines | `it`s | Leans on                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------ | ----: | ----: | ----------------------------------------------------------------------------------- |
| **L3a** ✅ ([#2820](https://github.com/kuzzleio/kuzzle/pull/2820)) | `core/security/roleRepository`             | 1 046 |    54 | `profileRepository`, `userRepository`, `shared/repository` ([L2b](#what-l2b-found)) |
| **L3b** ✅ ([#2821](https://github.com/kuzzleio/kuzzle/pull/2821)) | `api/controllers/securityController/users` | 1 390 |    69 | `securityController/{profiles,roles}` ([L2e](#what-l2e-found--and-l2-is-closed))    |
| **L3c** ✅ ([#2822](https://github.com/kuzzleio/kuzzle/pull/2822)) | `api/request/request`                      | 1 378 |   131 | `request/requestResponse` ([L2e](#what-l2e-found--and-l2-is-closed))                |
| **L3d** ✅ ([#2823](https://github.com/kuzzleio/kuzzle/pull/2823)) | `api/documentExtractor`                    | 1 484 |    57 | nothing — the only one of the six that is **codemod-shaped**                        |
| **L3e** ✅ ([#2824](https://github.com/kuzzleio/kuzzle/pull/2824)) | `api/controllers/authController`           | 1 836 |    71 | the five controllers of [L2d](#what-l2d-found)                                      |
| **L3f** ✅ ([#2825](https://github.com/kuzzleio/kuzzle/pull/2825)) | `api/controllers/documentController`       | 2 143 |    90 | idem                                                                                |

#### How L4's 34 are cut, by subject — measured on `2-dev` (2026-09-22, `d377ec6fd`)

Both pre-flight checks [L3 asked for](#l3-is-closed) were run before sizing this
one, and both changed the answer.

**The block hash found almost nothing: ~218 lines of copied `it` bodies across
all 34 files**, and the duplication is intra-file (four identical _"should
synchronize roles creation"_ in `cluster/node`, three in
`network/protocols/http`) rather than between files. The one cross-file pair is
`BackendStorage-es7`/`-es8`. **L4 is not [L3d](#what-l3d-found)-shaped**: its
cost is not copy, so de-duplication will not pay for it.

**The `mock-require` calls are not what the slice is about either.** Across the
34 specs there are **52** `mockrequire(…)` calls and **49** `reRequire(…)` — and
the target of the re-require is the _subject_, not the mock. The idiom is
overwhelmingly `mockrequire(dep, stub)` once, then `reRequire(subject)` in a
`beforeEach`: `mock-require` can only affect a _later_ `require`, so the subject
has to be reloaded after the stub is registered. `vi.mock` is hoisted above the
imports, so that reason disappears. Genuinely _conditional_ substitution — a
different stub per block — is rare: `network/accessLogger` (two different
`pino`s), `network/protocols/http`, `network/protocols/mqtt`,
`kuzzle/internalIndexHandler` and `cluster/node`.

⚠️ **And the third idiom is here too, for the sixth time in this step: 28 of the
34 also build on `test/mocks/kuzzle.mock.js`.** Ten of them substitute
`lib/kuzzle` _with_ it. So most of L4 is L1b-shaped work again.

| Sub-slice                                                          | Specs | Lines | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ----: | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L4a** ✅ ([#2827](https://github.com/kuzzleio/kuzzle/pull/2827)) |    11 | 1 336 | **the `Backend` family** — all eleven re-require the same subject, `lib/core/backend/backend`, and each mirrors a real `lib/core/backend/*.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **L4b**                                                            |     5 | 3 301 | **network**: `accessLogger`, `httpRouter`, `protocols/{http,websocket,mqtt}` — the node builtins (`zlib`, `net`, `uWebSockets.js`, `aedes`, `worker_threads`, `pino`) and every conditional swap in the slice. Sub-split one PR per subject: **b1** ✅ `accessLogger` ([#2828](https://github.com/kuzzleio/kuzzle/pull/2828)) · **b2** ✅ `mqtt` ([#2829](https://github.com/kuzzleio/kuzzle/pull/2829)) · **b3** ✅ `httpRouter` ([#2830](https://github.com/kuzzleio/kuzzle/pull/2830)) · **b4** ✅ the `httpwsProtocol` pair ([#2831](https://github.com/kuzzleio/kuzzle/pull/2831)) — `http` + `websocket`, one subject, one mirror                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **L4c**                                                            |     3 | 2 627 | **cluster**: `node`, `subscriber`, `publisher` — `zeromq` plus the sibling cluster modules. Sub-split: **c1** ✅ `publisher` + `subscriber` ([#2832](https://github.com/kuzzleio/kuzzle/pull/2832)) · **c2** ✅ `node` ([#2833](https://github.com/kuzzleio/kuzzle/pull/2833))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **L4d**                                                            |     4 | 3 882 | **plugin + validation**: `plugin/pluginsManager`, `plugin/context/context`, `validation/init`, `validation/types/date`. Sub-split: **d1** ✅ `validation/types/date` ([#2835](https://github.com/kuzzleio/kuzzle/pull/2835)) · **d2** ✅ `validation/init` ([#2836](https://github.com/kuzzleio/kuzzle/pull/2836)) · **d3** ✅ `plugin/context/context` ([#2837](https://github.com/kuzzleio/kuzzle/pull/2837)) · **d4** ✅ `plugin/pluginsManager` + `api/funnel/processRequest` ([#2838](https://github.com/kuzzleio/kuzzle/pull/2838)), which [the sweep](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for) says share the `pluginContext` / `privilegedContext` / `pluginsManager` trio and must therefore land together — so d4 pulled one spec out of L4e, leaving it 10                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **L4e**                                                            |     9 | 2 501 | **the strays** (`api/funnel/processRequest` left with [L4d4](#what-l4d4-found)): `config/index`, `kuzzle/internalIndexHandler`, `model/storage/{baseModel,apiKey}`, `api/controllers/adminController`, `util/{mutex,asyncStore}`, `core/auth/passportWrapper`, `core/shared/sdk/embeddedSdk`, `core/storage/storageEngine`. Sub-split: **e1** ✅ `config/index` ([#2840](https://github.com/kuzzleio/kuzzle/pull/2840)) · **e2** ✅ **the three already-ported duplicates** ([#2841](https://github.com/kuzzleio/kuzzle/pull/2841)), `core/storage/storageEngine` among them — see [what L4e2 found](#what-l4e2-found) · **e3** ✅ `model/storage/{baseModel,apiKey}` ([#2842](https://github.com/kuzzleio/kuzzle/pull/2842)) · **e4** ✅ `kuzzle/internalIndexHandler` (the conditional one, [#2843](https://github.com/kuzzleio/kuzzle/pull/2843)) · **e5** ✅ `util/{mutex,asyncStore}` ([#2844](https://github.com/kuzzleio/kuzzle/pull/2844)) · **e6** ✅ `core/auth/passportWrapper` + `core/shared/sdk/embeddedSdk` (both drop their substitution entirely, [#2845](https://github.com/kuzzleio/kuzzle/pull/2845)) · **e7** ✅ `api/controllers/adminController`, the last one ([#2846](https://github.com/kuzzleio/kuzzle/pull/2846)) |

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

| Class                                     |                                                            Specs | Port                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Reset only — no substitution at all**   | **3** (`validation/init`, `util/mutex`, `plugin/pluginsManager`) | `vi.resetModules()` and nothing else. They import `mock-require` purely to call `reRequire`; **`vi.mock` never appears in the port.** |
| Substitution **and** reset of the subject |                                                           **20** | `vi.mock` at module level + the L4a fixture shape                                                                                     |

⚠️ **The sweep is a grep and it under-reports.** Its first run put
`plugin/context/context` in a third class, "substitutes but never reloads",
which would have made its `mutex` stub dead. It reloads its subject through a
**template literal** — `reRequire(\`${root}/lib/core/plugin/pluginContext\`)`—
and a regex looking for a quoted string does not see it. Same failure mode as
[L3e](#what-l3e-found)'s`globalThis.kuzzle`and [L3f](#what-l3f-found)'s
single-quoted`it`names: **three times in this step, a count taken by grep has
been wrong about the thing it was counting.** Read the`beforeEach` before
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

#### How L5's 2 are cut, by action group — measured on `2-dev` (2026-09-23, `623676e7f`)

**The twins are far closer than the raw diff says, and far less identical than
[L1b4](#the-es-twins-one-body-two-mirrors-no-duplication) assumed.** Both
pre-flight checks were run before cutting, and both changed the plan.

| Measure                                            |                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Raw `diff`                                         | 1 279 lines over **205 hunks** — ~10%                                                           |
| Per block, non-blank lines                         | 5 392 per twin, **499 divergent → 4.6%**                                                        |
| Structure                                          | **54 action blocks, same names, same order, in both.** 11 of 54 **byte-identical**              |
| `it`s                                              | 222 vs 223 — the single extra is in `#deleteFields`                                             |
| [L3d](#what-l3d-found)'s block hash, within a twin | **~81 redundant lines of 6 293** (`mGet`≈`mExists`, `isIndexNameValid`≈`isCollectionNameValid`) |

So **L5 is not L3d-shaped either** — like [L4](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd), its cost is not copy _within_ a file. The
copy is entirely _between_ the two, and the 4.6% that is not copy falls into
four systematic classes, every one of them the ES 7/ES 8 wire format:

|                     | ES 7                | ES 8               |
| ------------------- | ------------------- | ------------------ |
| response            | `{ body: payload }` | `payload`          |
| search request body | `body: searchBody`  | `...searchBody`    |
| document body       | `body: { … }`       | `document: { … }`  |
| total-hits flag     | `trackTotalHits`    | `track_total_hits` |
| `_source` filter    | `"true"`            | `true`             |

⚠️ **The subject is one file, not two.** Both Mocha specs construct
`lib/service/storage/Elasticsearch.ts` — a dispatcher that reads
`config.majorVersion` and delegates to `ES7` or `ES8`. The twins are therefore
not two specs: they are **the same spec run with one config value changed**,
which is what makes shared cases the honest shape rather than a saving.

**But `describeESWrapper(version, Subject)` does not transfer as-is.** The
envelope is what distinguishes ES 7 from ES 8; hide it behind a helper and the
suite stops asserting the one thing these subjects do not agree on. So the
cases are shared and the delta is a **value they read** —
`tests/service/storage/elasticsearchCases/envelope.ts`, the whole ES 7/ES 8
difference on one screen instead of 205 hunks across 12 431 lines. Each
version's spec still pins its own wire format, because the table is what the
assertion runs _through_, not something it skips.

Two independent ports were the alternative and are ruled out: 95% copy in front
of SonarCloud, and [TD-23](../type-debt-register.md#td-23) says
`sonar.cpd.exclusions` may only shrink — the third and fourth exclusion this
step's [risk list](#risks) flagged as a decision for a human never has to be
asked for.

| Sub-slice                                                          | Blocks | ~Lines/twin | Content                                                                                                                                          |
| ------------------------------------------------------------------ | -----: | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L5a** ✅ ([#2849](https://github.com/kuzzleio/kuzzle/pull/2849)) |     16 |        ~600 | harness + envelope table + the small blocks, **11 of them byte-identical**: wiring, listings, existence, naming                                  |
| **L5b** ✅ ([#2850](https://github.com/kuzzleio/kuzzle/pull/2850)) |      8 |        ~900 | single-document CRUD: `get`, `count`, `create`, `createOrReplace`, `update`, `upsert`, `replace`, `delete`                                       |
| **L5c** ✅ ([#2851](https://github.com/kuzzleio/kuzzle/pull/2851)) |      9 |      ~1 300 | query-wide: `scroll`, `search`, `updateByQuery`, `bulkUpdateByQuery`, `deleteByQuery`, `deleteFields`, both `_mExecute`                          |
| **L5d** ✅ ([#2852](https://github.com/kuzzleio/kuzzle/pull/2852)) |     11 |      ~1 600 | index/collection lifecycle: `createIndex`, `createCollection` (388 L), mappings, settings, `import`, `_createHiddenCollection`, `_checkMappings` |
| **L5e** ✅ ([#2853](https://github.com/kuzzleio/kuzzle/pull/2853)) |     10 |      ~1 800 | the `m*` family + `Collection emulation utils` (671 L) — **and the twins themselves**                                                            |

⚠️ **The ratchet could not move until L5e, and did.** (Baseline 14 → **12**.) It counts spec _files_, and the two
twins are one file each however much of them is ported. So each sub-slice
**removes the blocks it ported from both Mocha twins in the same PR** — the
twins shrink to nothing and L5e deletes two empty files, rather than four PRs
leaving the same assertions running in both suites and the fifth deleting 12 431
lines on trust. The number each PR owes is therefore Mocha's **test** count, not
its file count, which is what the [DoD](#definition-of-done-per-pr) asks for
anyway.

#### How L6's 12 are cut — measured on this branch (2026-09-23, `20052a2b3`)

**L6 was budgeted as twelve redesigns. Five of the twelve never reach a private
binding at all**: they call `rewire()` and then use it as `require()`. Measured
per spec — `__set__` / `__get__` / `__with__` call sites, not mentions of the
word:

| Spec                                             | Lines | `__set__`/`__get__`/`__with__` | `mock-require` | What it actually is                         |
| ------------------------------------------------ | ----: | -----------------------------: | :------------: | ------------------------------------------- |
| `api/controllers/securityController/credentials` |   515 |                          **0** |       —        | a plain port                                |
| `api/controllers/securityController/security`    |   184 |                          **0** |       —        | a plain port                                |
| `service/cache/redis`                            |   357 |                          **0** |       —        | a plain port                                |
| `core/plugin/plugin`                             |   274 |                          **0** |       ✔        | an L4 port (`fs`, a fake plugin package)    |
| `kuzzle/dumpGenerator`                           |   284 |                          **0** |       ✔        | an L4 port (`fs`, `dumpme`)                 |
| `util/didYouMean`                                |    70 |                              2 |       —        | `vi.mock("didyoumean")` — and a `lib/` debt |
| `api/funnel/execute`                             |   566 |                              1 |       —        | one `instanceof` on a private class         |
| `kuzzle/kuzzle`                                  |   845 |                              6 |       ✔        | rewires the **compiler's** namespaces       |
| `core/network/entryPoint`                        |   520 |                              3 |       ✔        | stubs the dynamic `require` of a protocol   |
| `core/validation/util`                           |   446 |                              5 |       —        | tests four module-private helpers directly  |
| `core/validation/validate`                       | 1 165 |                              9 |       —        | stubs two of those helpers **in place**     |
| `core/validation/types/geoShape`                 |   857 |                         **60** |       ✔        | stubs six private predicates **in place**   |

In `plugin` and `dumpGenerator` the `rewire` is redundant twice over: the line
above it is already `mockrequire.reRequire(<same path>)`, which returns the
reloaded module. **2 214 of L6's 6 083 lines are L1/L4 work wearing L6's
label**, and they are the first three sub-slices.

**The redesign is one shape, and it appears twice.** `geoShape` and
`validation` both stub a helper the module calls _itself_ — `isPoint`,
`manageErrorMessage` — which is exactly what `vi.mock` cannot do and
[`rewire`](#the-axis-that-actually-decides-cost-what-a-spec-mocks-with) exists
to do. Two honest answers, and they are not the same answer: move the helpers
to a sibling module and mock **that**, or let them run and assert the outcome.
`geoShape`'s six predicates are pure functions of coordinates, so stubbing them
asserted _delegation_, not validation — 60 call sites buying a fact the real
predicates state for free.

⚠️ **`kuzzle.test.js` rewires `koncorde_1` and `vault_1` — the variable names
`tsc` emits for two imports.** It is the plainest case in the suite of a test
written against compiled output rather than against the subject, and the
reason it has to run out of `dist/test` at all
([L7](#slices) deletes `build:tests` for the same reason). `vi.mock("koncorde")`
names the dependency instead, so this one gets _simpler_ as a port.

⚠️ **`didYouMean.test.js` holds `lib/` hostage.** `lib/util/didYouMean.ts`
carries the last `import … = require()` in `lib/` with a comment saying why:
`__set__("didYouMean", …)` addresses the compiled variable by name, and a
default import would compile to `didyoumean_1.default`, which the stub would
miss. Porting 70 lines of spec pays off a debt in the subject. (Its other
`__set__` — `"process"` — assigns `process` to itself and does nothing.)

**What coverage says, and where it cannot be read.** Four of the ten subjects
already have a vitest spec, so [L0](#what-l0-found)'s instrument applies before
any port is written (`--coverage` per subject, Mocha side restricted to these
12 specs):

| Subject                 | Mocha, L6 specs only (L/F) | vitest, whole suite (L/F) |
| ----------------------- | -------------------------: | ------------------------: |
| `securityController.ts` |              28.0% / 11.1% |         **69.8% / 71.8%** |
| `funnel.ts`             |              34.4% / 20.4% |         **62.8% / 51.0%** |
| `validation.ts`         |              35.5% / 25.0% |         **56.5% / 61.2%** |
| `plugin.ts`             |              48.4% / 36.1% |         47.1% / **77.8%** |
| `didYouMean.ts`         |               72.9% / 0.0% |           **100% / 100%** |
| `entryPoint.ts`         |              59.1% / 35.3% |               3.5% / 0.0% |
| `geoShape.ts`           |              41.4% / 35.7% |               7.4% / 4.5% |
| `redis.ts`              |              54.8% / 40.7% |               9.7% / 3.7% |
| `dumpGenerator.ts`      |              50.3% / 36.4% |               1.2% / 0.0% |
| `kuzzle.ts`             |              40.6% / 23.0% |               0.8% / 0.0% |

⚠️ **The branch column is missing on purpose: it is not comparable.** `c8`
instruments the **compiled** `dist/` build, vitest the source, so the
denominators are different files — Mocha reports 75–82% branches on subjects
whose lines it covers a third of. Lines and functions are the usable columns,
and even those only bound the question: **coverage compares reach, not
assertions** ([L0](#what-l0-found)), so a sub-slice still owes the Mocha spec's
_tests_, per the [DoD](#definition-of-done-per-pr). `didYouMean.ts`'s 100% is
incidental — its callers load it; no vitest spec asserts it.

| Sub-slice                                                          | Specs | Lines | Content                                                                                           |
| ------------------------------------------------------------------ | ----: | ----: | ------------------------------------------------------------------------------------------------- |
| **L6a** ✅ ([#2854](https://github.com/kuzzleio/kuzzle/pull/2854)) |     3 | 1 056 | `rewire`-as-`require`, nothing else: `securityController/{credentials,security}`, `cache/redis`   |
| **L6b** ✅ ([#2856](https://github.com/kuzzleio/kuzzle/pull/2856)) |     2 |   558 | `rewire`-as-`require` over `mock-require`: `plugin/plugin`, `kuzzle/dumpGenerator` — L4's idiom   |
| **L6c** ✅ ([#2857](https://github.com/kuzzleio/kuzzle/pull/2857)) |     1 |    70 | `util/didYouMean` **+ the `import = require()` it forces on `lib/util/didYouMean.ts`**            |
| **L6d** ✅ ([#2858](https://github.com/kuzzleio/kuzzle/pull/2858)) |     1 |   566 | `api/funnel/execute` — one `__get__("PendingRequest")` behind one `instanceof`                    |
| **L6e** ✅ ([#2859](https://github.com/kuzzleio/kuzzle/pull/2859)) |     1 |   845 | `kuzzle/kuzzle` — `koncorde_1` / `vault_1` / `process` become `vi.mock` and `vi.spyOn`            |
| **L6f** ✅ ([#2860](https://github.com/kuzzleio/kuzzle/pull/2860)) |     2 | 1 611 | `validation/{util,validate}` — the private-helper redesign, one `lib/` decision for both          |
| **L6g** ✅ ([#2861](https://github.com/kuzzleio/kuzzle/pull/2861)) |     1 |   857 | `validation/types/geoShape` — the same redesign, 60 call sites, plus `mock-require` on `koncorde` |
| **L6h** ✅ (PR pending)                                            |     1 |   520 | `network/entryPoint` — the dynamic `require(protocolPath)`, the only module-loading redesign left |

3 + 2 + 1 + 1 + 1 + 2 + 1 + 1 = **12**, and 1 056 + 558 + 70 + 566 + 845 +
1 611 + 857 + 520 = **6 083**. Ordered cheapest first so the ratchet moves in
every PR, with the two redesigns that share a question (`f`, `g`) adjacent and
the one that stands alone (`h`) last.

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

| Remaining Mocha specs, by idiom           |   Specs |      Lines |
| ----------------------------------------- | ------: | ---------: |
| KuzzleMock + (`mock-require` or `rewire`) |      41 |     30 056 |
| KuzzleMock + sinon only                   |      41 |     16 869 |
| KuzzleMock only                           |      19 |      6 006 |
| Neither                                   |      17 |      5 930 |
| **Total**                                 | **118** | **58 861** |

L1b1 is the `api/` eighth of it: `funnel` × 5, `debugController`, `indexController`, `OpenApiManager`.

### The fixture is the deliverable, not the assertions

The translation was mechanical — L1's codemod handles `should` → `expect` and `sinon` → `vi`. What each spec cost was **one question per subject: what does it actually read from `global.kuzzle`?** The answers are small and they are the point:

| Spec                          | What the subject actually needs                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `funnel.metrics`              | `log.child()` — nothing else. The shared fixture already provides it, so `stubKuzzle()` is bare.                                                                     |
| `funnel.performDocumentAlias` | `pipe`, and it must **return** its documents: the result feeds `DocumentExtractor.insert`.                                                                           |
| `funnel.init`                 | `onAsk`, `pipe`, `pluginsManager.getStrategyMethod`, `ask` (the anonymous user), and **nine config keys** — this is what thirteen controller constructors add up to. |
| `indexController`             | `ask`. That is all: every action is one storage-engine event.                                                                                                        |
| `debugController`             | `ask` + `config.security.debug.native_debug_protocol`.                                                                                                               |
| `OpenApiManager`              | `onAsk`. It reads no config at all.                                                                                                                                  |

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

L1b2 was planned as "the 5 `hotelClerk` specs under 200 lines". It shipped as **all 7**, `subscribe` (249) and `unsubscribe` (246) included, because [L1b1's mirror finding](#what-l1b1-found) makes the size axis the wrong one: seven spec files for one subject cannot be mirrored, and `lib/core/realtime/hotelClerk.ts` would have stayed attributed to the mocha report with two specs left in it. Porting five would have created the debt; porting seven retires it. **The subject is the unit, not the file and not the line count** — a fourth confirmation, and the first time the correction was applied _before_ the slice rather than after it.

The two extra specs cost far less than their 495 lines suggest: they share the fixture the other five already needed.

### Four defects the Mocha specs could not see

| What                                                                                                                                                                                                                                                                                                        | Caught by        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `new Channel(roomId, { cluster: true })` — the constructor option is **`propagate`**; `cluster` is the _field_ it sets. The option was silently ignored, and the spec passed only because `propagate` defaults to `true`.                                                                                   | TS2353           |
| `clearConnections()` calls `removeConnection(id, **false**)`, and the second argument is the whole point of it — nobody is left to notify on shutdown. sinon's `calledWith` matches a **prefix**, so the Mocha spec asserted the ids and said nothing about it. `toHaveBeenCalledWith` is exact.            | vitest           |
| `request["context​"]` looked like a typo and is not: `​` is a zero-width space `KuzzleRequest` uses so its private fields do not show up in a `console.log`. The spec reached past the public `context` getter into the backing field. The port uses the getter.                                            | reading it       |
| **`list()` leaves an emptied index behind.** It deletes each forbidden collection and never prunes the index that held them, so a user forbidden from _every_ collection of an index still learns the index exists. `should(...).match()` ignores extra keys, so seven years of this spec could not see it. | `toHaveProperty` |

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

So the spec implements it, in nine lines: a `Map` of event → handlers, and a `pipe` that folds the payload through them. The difference from the KuzzleMock version is not the code, it is that **the spec that needs the behaviour is the spec that states it** — and the test that exercises it now asserts the _intermediate_ payloads (`{foo}` → `{foo,bar}` → `{foo,bar,baz}`), which the Mocha version did too but as three unrelated `calledWith`s against a shared stub.

### ⚠️ TD-74: `scope: "none"` is accepted at runtime and forbidden by the type

Six TS2322/TS2345 on the `notifyMethods` fixture, all the same finding, now [TD-74](../type-debt-register.md#td-74):

- `RealtimeScope` is `"in" | "out" | "all"`.
- `Channel.SCOPE_ALLOWED_VALUES` is **literally** `USERS_ALLOWED_VALUES` — `["all", "in", "out", "none"]` — so the subscribe validator accepts `"none"`.
- It is **meaningful**: `_notifyDocument` keeps a channel when `channel.scope === "all" || channel.scope === notification.scope`, so `"none"` is how a channel takes user events and no document event. Four of the six fixture channels are built that way.
- And `Channel.hash`'s `scope` switch has **no `"none"` case**, so such a channel contributes nothing to the hash and collides with a channel that has no scope at all. Channel _names_ derive from that hash.

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

| What                                                                                                                                                                                                                        | Caught by  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `InternalProtocol.joinChannel(channel, connectionId)` and `leaveChannel` take **two** arguments; the Mocha spec passed one, four times.                                                                                     | TS2554 × 4 |
| `_send` emits one message per channel — and the Mocha spec asserted `room: "c1"` **twice**, by copy-paste, so nothing checked that the second channel was emitted at all. The port pins both, and the call count with them. | reading it |
| `ObjectRepository`'s `index`, `collection`, `ObjectConstructor`, `store` and `cacheDb` are **`protected`**, and the `pluginRepository` spec reads all five — they are what its constructor is _for_.                        | TS2445 × 5 |
| `Router.logger` is `private`, and half the connection-bookkeeping assertions are about what it was handed (an invalid connection is _logged_, not thrown).                                                                  | TS2341     |

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

`lib/util/didYouMean.ts` reads **`global.NODE_ENV`**. `didYouMean.test.js` only ever set **`process.env.NODE_ENV`**. It passed because Mocha runs the whole suite in one process, `deprecate.test.js` sorts first, and its `beforeEach` set the _global_ to `"development"` and left it there. The assertion under test — "calls the library" — was being satisfied by a sibling's leftover state.

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
- **`Service` is `abstract`** and the Mocha spec instantiated it directly (TS2554 ×4 — `_initSequence` is the hook a real service implements). The port declares a four-line concrete subclass, which is both what type-checks and what a service _is_; the sequence is a `vi.fn` the tests drive rather than a field assigned onto the instance afterwards.
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
- **Reading private state.** The emitter spec asserted on `pluginPipes` and `pluginPipeDefinitions`; both are `private`. What they were being read _for_ — the handler runs on that event, and stops when the pipe is unregistered — is public behaviour, and the port asserts it there. Third occurrence of [L1b2](#what-l1b2-found)'s private-state problem, and the first where the public surface answered it outright.

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

| Where                                                | What it said                                               | Why it held regardless                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role.checkRestrictions(req, restrictions)`          | "should properly handle restrictions"                      | a `Request` where the index goes, a `Map` where the collection goes, **no third argument** — the method answers `true` before reading either. `TS2345`. |
| two `profile` rate-limit tests                       | "should throw if the rate limit is not a valid integer"    | assertions inside a `catch` with no `else`: accepting the value passes the test by not entering the block.                                              |
| `should(profileRepository.profiles).not.have.key(…)` | the deleted profile left the in-memory map                 | there is no `profiles` property on the repository; the assertion was on `undefined`.                                                                    |
| `userRepository.search`                              | called with `{ query: { term: { profileIds: "admin" } } }` | it is called with `{ size: 1 }` as well. **sinon's `calledWith` matches a prefix; vitest's `toHaveBeenCalledWith` matches the call.**                   |

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

| The Mocha spec asserted          | The port asserts                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `inspector.connect` called once  | `core:debugger:isEnabled` answers `true`, and `cluster:node:preventEviction` was asked |
| `events.clear()` called          | a connection that was listening is no longer notified                                  |
| `notifyConnection` called with … | `entryPoint._notify` received the payload                                              |

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

| Where                                                         | Shape                                                 | Why it never failed                                              |
| ------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `baseController`, 9 tests                                     | `should((async () => { sync(); })()).rejectedWith(…)` | neither returned nor awaited; the `it` resolved first            |
| `realtimeController#subscribe`, 3 tests · `bulkController`, 2 | `should(promise).rejectedWith(…)` with no `return`    | same, and the _same file's_ other describes do have the `return` |
| `bulkController#mWrite`, 1                                    | called `controller.import(request)`                   | wrong subject, and unasserted                                    |

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

| Found                                               |  Count | First seen             |
| --------------------------------------------------- | -----: | ---------------------- |
| Assertions that could not fail                      | **23** | [L2a](#what-l2a-found) |
| Signature defects caught by `tsc`                   | **11** | [L2b](#what-l2b-found) |
| Specs asserting on a collaborator's calls           |  **4** | [L2b](#what-l2b-found) |
| `sinon` prefix-matches completed                    |  **5** | [L2b](#what-l2b-found) |
| Private members re-asked through the public surface | **13** | [L2b](#what-l2b-found) |

_None of the 23 dead assertions was found by running the suite_ — they are green in both runners. They were found by writing the assertion a second time, in a language that checks it.

**What is left: L4 (34 specs / 14 128 lines), L5 (2 / 12 431), L6 (14 / 6 319), then L7's closure.** L3 is closed — see _[L3 is closed](#l3-is-closed)_.

## What L3f found — and L3 is closed

**`mocha` 51 → 50**, vitest **1 821 → 1 911 tests** across **106 → 107 files**. One spec, 2 143 lines, 90 `it`s in and 90 out. The block hash found no duplicates.

### ⚠️ Nine negative assertions pinned to a call that never happens

Eleven blocks carry a `'should not notify with "silent" argument'` test, and all eleven were written the same way:

```js
should(kuzzle.ask).not.be.calledWithMatch(
  "core:realtime:document:notify",
  request,
  actionEnum.CREATE,
  { _id: "_id", _source: "_source" },
);
```

It was copied out of `#create` into ten other blocks **without changing the action**. `update` notifies with `actionEnum.UPDATE`, `replace` with `REPLACE`, `delete`/`mDelete`/`deleteByQuery` with `DELETE`, `createOrReplace` with `WRITE`. So in **nine of the eleven**, the assertion names a call the subject never makes — with `silent` set _or unset_. They could not fail.

What the flag owes is that **nothing** is notified, which is what the port says. **A twelfth form**, and the first where the dead assertion is a _negative_: `not.calledWith(…)` is satisfied by a call that differs in any argument, so over-specifying a negative is the same as deleting it.

### `calledWithMatch` is partial, and five things were hiding in the gap

Every write action asserted its storage call with `calledWithMatch`. Making those exact says what the subject actually does:

| Hidden by the partial match                                                                                                                                                                                                                     |           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| The controller **injects `_kuzzle_info` into the body itself** and passes `injectKuzzleMeta: false` so the storage layer does not do it twice. Nothing in the suite said the metadata is added, or by whom.                                     | 5 actions |
| The shape differs per action: `create` stamps `{author, createdAt}` with `updatedAt: null`; `update`/`upsert` stamp only `{updatedAt, updater}`; `createOrReplace` and `replace` go through `_writeDocument` and stamp **both halves at once**. | —         |
| `upsert`'s **`default` values are stamped too**, with their own shorter `{author, createdAt}`.                                                                                                                                                  | —         |
| The `create` and `createOrReplace` notifications carry `_version`; `createOrReplace`'s carries **`created`** as well.                                                                                                                           | —         |
| The `update` notification carries the **merged** document — the stored `name: "gordon"` the request never sent — and no `_version`. The spec asserted `_source: content`, partially, and so said the opposite of what happens.                  | —         |

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

| Found                                        |  L2 |                L3 | First seen in L3       |
| -------------------------------------------- | --: | ----------------: | ---------------------- |
| Assertions that could not fail               |  23 |           **+15** | [L3a](#what-l3a-found) |
| New _forms_ of assertion that cannot fail    |   6 | **+6** (7th–12th) | —                      |
| Signature / declaration defects              |  11 |            **+9** | [L3b](#what-l3b-found) |
| Specs asserting on a collaborator            |   4 |            **+3** | [L3b](#what-l3b-found) |
| `sinon` prefix- or partial-matches completed |   5 |           **+14** | [L3b](#what-l3b-found) |
| `lib/` defects filed, not fixed              |   — |             **3** | [L3a](#what-l3a-found) |

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

| Shape                                                | Actions                                                       | Lines each |
| ---------------------------------------------------- | ------------------------------------------------------------- | ---------: |
| one document in `_id` + `body`                       | `create`, `createOrReplace`, `replace`, `update`              |         84 |
| many in `body.documents`, out via `result.successes` | `mCreate`, `mCreateOrReplace`, `mReplace`, `mUpdate`          |        154 |
| one document, `_id` only                             | `delete`, `get`                                               |         53 |
| one-offs                                             | `updateByQuery`, `mDelete`, `mGet`, `search`, `deleteByQuery` |      63–91 |

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
    request.getSearchBody().be.eql({}); // never runs
  });
});
```

`should(fn)` builds an assertion object and waits for `.throw()`, `.not.throw()` — something. Nothing came, so the function was wrapped and dropped. **A ninth form of assertion that asserts less than it reads**, and the most complete one yet: the test asserted _nothing at all_.

**Running it says why it was written that way.** With `searchBody: null`, `getSearchBody()` does not return `{}` — it throws `api.assert.invalid_type`, because `null` is not _absent_, so the default never applies and `getObject` rejects it. The test's **name** described a behaviour the subject does not have. The port asserts what it does, and renames it. Whether `null` ought to be read as absent is a `lib/` question, filed not fixed.

### ⚠️ `should(x).be.exactly(x)` — a value compared with itself

```js
should(request.error.status).be.exactly(request.error.status);
```

Twice, in the two tests that build a request from an error and from a _serialized_ error. Both meant "the error keeps the status it came in with" — which is the whole point of the second one, deserialization — and both are true of every value in the language. **A tenth form.**

### Three declarations `tsc` refused, all in the subject

|                                                                                                                                                                                                                                                                            |            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `getBodyArray`, `getArray` and `getArrayLegacy` declare their default as `def: [] \| undefined` — the empty **tuple**. No caller can pass a default with anything in it. Four tests do, at runtime, happily.                                                               | TS2345 × 4 |
| `serialize()` returns a `headers` field (deprecated, a duplicate of `options.connection.misc.headers`) that its return type `{ data, options }` does not mention.                                                                                                          | TS2339     |
| `timestamp` is declared `number`, and the request carries through whatever it was handed — the spec has always round-tripped the **string** `"timestamp"`. `tsc` let it pass because `toBe` accepts anything; **SonarCloud's S5845 is what caught it**, as a new Critical. | the gate   |

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

`restrictDefaultRights` iterates `config.security.standard`, so the honest fixture is the shipped default rather than a hand-written one that would agree with the assertion by construction ([L1b4](#what-l1b4-found) settled that). But `loadConfig()` returns the _same_ object each call: pinning `limits.documentsFetchCount = 1` in one test made the next three fail. `KuzzleMock` deep-cloned it, which is the detail a fixture derived from it has to carry over. _A fixture may inherit a mock's bug fix as easily as its bug._

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
afterEach(() => {
  mockrequire.stopAll();
});
```

It reads as a mocking idiom and half of it is: `mock-require` only affects a
_later_ `require`, so the subject had to be reloaded after the stub was
registered. `vi.mock` is hoisted, so that half disappears — and dropping the
whole thing for a plain import is the obvious port. **It fails every test after
the first, in all eleven files.**

`backend.ts` keeps `global.app` in a module-level `_app`, behind a setter that
throws `"Cannot build an App instance: another one already exists"` on the
second write. One `new Backend()` per module _evaluation_ is all the subject
allows — and `reRequire` was re-evaluating the module on every test. **The dance
was what made a per-test `new Backend()` legal, and nothing in the spec said
so.**

So the re-evaluation stays, stated for what it is: `createBackend()` calls
`vi.resetModules()` and imports the subject fresh (`tests/core/backend/backendFixture.ts`).
`vi.mock` survives a reset — the registry is per test _file_ — so the
substitution is still in place on every re-import.

**This is the answer L4 was carved out to find, and it is not the expected one.**
The question was framed as "`vi.mock` is static where `mock-require` is
dynamic". For this family the substitution is perfectly static; what is dynamic
is the _subject's own module state_. ⚠️ **Before porting any of L4b–L4e, ask
what the `reRequire` is resetting, not what the `mockrequire` is replacing.**

### ⚠️ A mock factory must not import the mocked module — it deadlocks silently

The first attempt put `FakeKuzzle` in the same file as `createBackend`, so the
factory read:

```ts
vi.mock("../../../lib/kuzzle", async () => ({
  default: (await import("./backendFixture")).FakeKuzzle, // imports Backend…
})); // …which imports lib/kuzzle
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
the object the subject built came from a _different_ copy of the module. Both
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
between them — neither pins `majorVersion`, so both ran the _configured_ default,
twice. It is stated once now. The first genuinely differs, and only in how the
two Elasticsearch clients expose `maxRetries`: a plain property on 7, a symbol on 8. That is `it.each(["7", "8"])` over one body, which is
[L1b4](#what-l1b4-found)'s `esWrapper` move at the smallest possible scale.

### Small things

- **+4 tests on 79.** `BackendPlugin`'s _"should throw an error if the plugin is
  invalid"_ was four `should(…).throwError()` in one `it`; split, each failure
  mode now names itself. `BackendPipe` gains the `application === undefined`
  branch and `Backend` the `already_started` one; `BackendStorage` loses the
  duplicate above.
- `Backend`'s _"should call kuzzle.start…"_ asserted `plugin.instance` equals a
  second read of `_instanceProxy`. It is a getter that builds a fresh object,
  `init` closure included, so the two are never the same object — `should`'s
  `eql` accepted it, `toEqual` does not. The port asserts what the proxy
  carries.
- Node's _"Cannot find module 'foo'"_ is _"Cannot find package 'foo'"_ under
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
needs `pino` to be _absent_; the outer stub omits it only because the `#init`
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
  that is _correct_: the module's bottom sets `global.kuzzle = { id:
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

`tests/mocks/kuzzle.ts` both _read_ the global (to remember what was there) and
_assigned_ it. Neither is safe, and — this is the part that matters — **whether
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
was stubbed before it. So the subject must be loaded _first_ and the global
stubbed _second_. Stated in the spec, because nothing about the two lines says
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

`entrypoint.mock.js`'s `execute` was `sinon.stub().yields({})` — it _answers_.
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

|                                                             |                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The slice's premise was wrong three times out of three.** | L4 was carved out because `vi.mock` is static where `mock-require` is dynamic. In [L4a](#what-l4a-found) the dynamic thing was `global.app`'s singleton; in [L4b1](#what-l4b1-found) the "two pino stubs" were one stub plus a key; in [L4b3](#what-l4b3-found) and [L4b4](#what-l4b4-found) exactly **three tests out of 79** need `vi.doMock`. |
| **The real cost is the globals.**                           | `global.kuzzle`, `global.app` and `global.nodeId` are all write-once accessors installed by module evaluation, and `vi.resetModules()` re-installs them. Load the subject first, stub the global second, import nothing later.                                                                                                                   |
| **Two mocks retired, two promoted.**                        | `test/mocks/uWS.mock.js` → `tests/mocks/uWS.ts`, `test/mocks/entrypoint.mock.js` → `tests/mocks/entryPoint.ts`. `test/mocks/` is down to `kuzzle.mock.js` and its remaining L4c–L4e users.                                                                                                                                                       |

**Next: L4c (cluster, 3 specs / 2 627 lines), L4d (plugin + validation, 4 /
3 882), L4e (the strays, 11 / 2 982).**

## What L4c1 found

**`mocha` 34 → 32**, vitest **2 129 → 2 205 tests** across **121 → 123 files**.
Two specs, 1 233 lines, 73 `it`s in and **76** out. `publisher` and `subscriber`
are siblings — `node` stubs both — so they share a PR.

### ⚠️ A deleted Mocha spec keeps running until a full build

`npm run test:unit:mocha` runs `build:tests` (`tsc -p tsconfig.tests.json`) and
then Mocha over `dist/test/**`. **`tsc` does not prune its output.** After
deleting `test/cluster/{publisher,subscriber}.test.js`, `dist/test/cluster/`
still held both compiled files, and the suite reported _exactly the same count
as before the deletion_ — 1 262 passing, twice, with 73 tests that no longer
have a source file. `npm run build` begins with `rm -Rf ./dist`, and the count
then falls to 1 189, which is the honest one.

CI is safe: its job is `npm run build && npm run test:unit:mocha`. **A local
verification that skips the build is not**, and the failure mode is the worst
kind — a green suite over deleted code, and a test count that looks
unchanged when it should have dropped. Every earlier slice in this step
happened to run `build` in the same chain. **The DoD's "run the whole Mocha
suite after every deletion" means `npm run build` first.**

### ⚠️ A test that compared `undefined` to `undefined`

`#handleNodeEviction`'s _"should kill itself if evicted node is itself"_ sets
`message.nodeId = localNode.nodeId` and the subject checks
`message.nodeId === this.localNode.nodeId`. The Mocha `ClusterNodeMock` **has no
`nodeId`**, so both sides were `undefined` and the strict equality held on two
absent values — while the real `ClusterNode.nodeId` is a getter that _throws_
when the node has none. The fixture names one, and the test now compares an id.
**A fourteenth form for the step's list**, and the first where the dead
assertion is caused by the _mock_ rather than by the assertion.

### The one command the suite never sent

`publisher` exposes seventeen `sendXxx` methods and the spec covered sixteen:
`sendNodePreventEviction` had no test. It has one now — found by writing the
sixteen `describe`/`it` pairs as one `it.each` table, where the missing row is
visible.

### Sixteen blocks, one shape

Each of those pairs was 8 to 20 lines saying the same thing: the method calls
`send` with one topic and one payload, and answers what `send` answered. One
table states it once, and makes the two rows that genuinely differ — the
notifications, whose `result` and `volatile` are JSON-stringified — visible at a
glance. [L3d](#what-l3d-found)'s move, at the smallest useful scale: 349 lines
of spec become 230.

### Small things

- `#send` gained a test for the disposed case: `send()` answers `Long.NEG_ONE`
  and buffers nothing once `socket` and `protoroot` are null. Nothing covered
  the guard.
- `#checkHeartbeat`'s third test asserted the state and not that the node was
  _left alone_; the eviction is what distinguishes it from the second test.
- ⚠️ **A `vi.fn()` with no declared parameters types every recorded call as an
  empty tuple**, so `mock.calls[0][0]` is a compile error (`TS2493`). Declare
  the signature — `vi.fn<(a: A, b: B) => R>(...)` — on any stub whose arguments
  a spec reads. Third time in L4.

## What L4c2 found — and L4c is closed

**`mocha` 32 → 31**, vitest **2 205 → 2 284 tests** across **123 → 124 files**.
One spec, 1 394 lines, 71 `it`s in and **79** out — the largest single file of
L4, and the one with the most substitutions: six sibling modules plus `os`.

### ⚠️ A `vi.mock` factory's result is cached per registration, not per registry

The stubs live in `tests/cluster/nodeFixture.ts`, and the factories load them
with `await import("./nodeFixture")`. The spec then read static state off that
same file — the list of mutexes taken, the flag that makes
`waitForSubscription` answer false.

**It was reading a second copy.** `loadSubject()` calls `vi.resetModules()`, and
a later `import("./nodeFixture")` after a reset answers a _fresh_ module, while
the factory keeps handing the subject the classes it resolved the first time.
So the spec set a flag on one class and the subject consulted another, and read
a mutex list that nothing had ever pushed to.

Three tests failed, and the failure mode is the point: **an empty list and an
unheeded flag both read as "the subject did nothing"**, which is exactly what
two of those three tests were asserting the _absence_ of. The rule: **after
mocking a module, reach its stub through the mocked specifier**
(`await import("../../lib/util/mutex")`), never through the file the factory
loaded.

### ⚠️ A test that never called the subject — a fifteenth form

`#topology check`'s _"should do nothing if the cluster is consistent"_ built a
consistent topology, and then asserted `kuzzle.shutdown` had not been called.
It never called `enforceClusterConsistency()`. The assertion is true of a
subject that was never asked anything, which is what it was testing.

### `lib/`'s bare `os` import is now held in place by a Mocha-era reason

`lib/cluster/node.ts` imports `assert`, `util`, `net` and `os` with **bare**
specifiers and carries a comment saying why: `mock-require` keys on the literal
specifier and would not see `require("node:os")`. `vi.mock` has the same
constraint, so nothing changes here — but the reason is now about a runner this
step is removing. **When [L7](#slices) deletes `mock-require`, those four can go
back to their `node:` prefixes.** Filed, not done: a porting slice leaves `lib/`
alone.

### Three `it.each` tables out of twenty-seven `it`s

The [block hash](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd)
had flagged four identical _"should synchronize roles creation"_ bodies and
three more against another. They are all one shape — _this kuzzle event becomes
that `publisher.send` topic_ — and are now one table of twelve rows. The eight
IP-selection cases, which the Mocha spec drove as eight `new ClusterNode()` in a
**single** `it`, are eight tests: a failure now says which configuration broke.
The seven network-split cases become two tables.

### Small things

- `SerializedIdCard` declares `id`, `ip`, `birthdate` and `topology` all
  required, and the spec built partial ones in nineteen places — each test
  naming only the fields it is about. Harmless at runtime; the defaults live in
  one helper now.
- The event bus is a fixture behaviour, not a field: `cluster/node` registers on
  **four** buses (`on`/`emit`, `onAsk`/`ask`, `onCall`/`call`, `onPipe`/`pipe`),
  and the only way to test a registration is to fire it. `tests/mocks/kuzzle.ts`
  grows `stubBus()`, which backs all four with real registries — `emit` fans out
  to every listener, the three request/response buses throw on an event nothing
  registered.
- `ClusterSubscriberMock.prototype.__waitForSubscription = false` … `delete`
  became a static flag restored in a `finally`: a prototype property removed by
  a `delete` on the happy path survives a failing test and leaks into the next.

## L4c is closed

**3 specs, 2 627 lines, `mocha` 34 → 31, vitest 2 129 → 2 284 tests.** Two PRs.
Its own finding — the cached mock factory — is the third distinct way
`vi.resetModules()` has cost this step a debugging session, after the write-once
globals ([L4b2](#what-l4b2-found)) and `instanceof` ([L4a](#what-l4a-found)).
**Next: L4d (plugin + validation, 4 specs / 3 882 lines), L4e (the strays, 11 /
2 982).**

## What L4d1 found

**`mocha` 31 → 30**, vitest **2 284 → 2 382 tests** across **124 → 125 files**.
One spec, 476 lines, **98 `it`s in and 98 out** — the format table is the same
75 entries, checked key by key.

### ⚠️ A sixth conditional substitution the sizing did not list — and it was not one

The [sizing](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd)
named five specs as _genuinely conditional_ — `accessLogger`, `protocols/http`,
`protocols/mqtt`, `internalIndexHandler`, `cluster/node`. **`validation/types/date`
is a sixth and is not on the list**, because the grep behind that count reads
the file's `mockrequire(…)` calls and this spec makes exactly **one**: a single
registration, in the `before` of a _nested_ describe. One call looks
unconditional; _where_ it sits is what makes it conditional. The spec's first
three blocks run against the real `moment` and `#formatMap` alone re-requires
the subject against a total stub. **Four times now in this step a count taken by
grep has been wrong about the thing it was counting** — after
[L3e](#what-l3e-found)'s `globalThis.kuzzle`, [L3f](#what-l3f-found)'s
single-quoted `it` names and [L4's own sweep](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for)
misreading `pluginContext`'s template literal.

**It does not need to.** What `#formatMap` asserts is _which arguments each of
the 75 formats hands `moment.utc`_ — a question a **spy** answers. The Mocha
spec had to phrase it as "replace the module, then reload everything that
imports it" only because `mock-require` swaps a module wholesale: there is no
smaller unit. So one `vi.mock` over `moment` whose three functions
(`utc`, `invalid`, `unix`) are spies **delegating to the real implementation**
serves every block in the file, and the re-require disappears.

The one thing `#formatMap` genuinely needs is a **return** it controls —
`"1234567890"` parses as a valid date under almost none of the 75 formats, and
each test asserts that no error was recorded — so it pins the return value in
its own `beforeEach` and `passThrough()` puts the real implementation back
after it. A `describe`-scoped `mockReturnValue`, which is the vitest way of
saying "conditional".

This is [L4b1](#what-l4b1-found)'s finding from the other direction: there, two
`pino` registrations turned out to be **one stub**; here, one registration turns
out **not to be a stub at all**. Both times the Mocha idiom had inflated a
narrow need into a whole-module swap, and both times the port is smaller than
the original. **Of the conditional swaps this slice has reached so far —
`accessLogger`, `protocols/http`, `protocols/mqtt`, `cluster/node` and now
`date` — not one has needed a conditional `vi.mock`.** `internalIndexHandler`
(L4e) is the last one left to check.

### The mock is a `Proxy`, not a copy

`moment` carries far more than the subject uses — `ISO_8601`, the locale
machinery, the `Moment` prototype every returned object is built from — and a
spread flattens exactly the parts that are not plain data. The factory returns
a `Proxy` over the real module that answers the three spied names and forwards
everything else, so `moment.ISO_8601` is the **real** sentinel. The Mocha spec
could only compare that one format against its own `"ISO_8601_MOCK"` string.

### ⚠️ `DateTypeOptions` describes the output and is used for the input — [TD-75](../type-debt-register.md#td-75)

Eight TS2322s, all of the same shape: `DateRangeBound` is `Moment | "NOW"` —
the shape `validateFieldSpecification` _returns_, after converting the bounds
in place — and the same type names its **input**, where a moment is exactly
what a caller does not have yet. Every fixture that exercises the conversion
fails to type-check against the method whose job is to perform it.

Filed, not fixed: widening the bound makes `checkRange`'s `max.isBefore(...)`
illegal, which is a `lib/` change with its own coverage consequences, and a
test-porting slice leaves `lib/` alone — the same line [TD-74](../type-debt-register.md#td-74)
drew. The spec names the cast `specification()` and points at the entry.

### Small things

- The two `done`-driven tests — _"should call `moment.utc` if min/max equals
  the string `NOW`"_ — are one `it.each`-style loop over `min`/`max` now, and
  they do not need [`settle`](../../../tests/helpers/settle.ts): nothing calls
  back, the 100 ms wait is the test. What they check is worth naming, so they
  are: _resolves `"NOW"` at validation time, not at specification time_.
- The rejected fixtures each `it` already carried as two or three repeated
  `should(() => …).throw(…)` calls — `formats: []` / `null`, `range: null` /
  `[]` / `{ unknown }`, an invalid `min` / `max` — are loops over their inputs
  now, so a failure says _which_ value was accepted. The `it` count is
  unchanged by that: 23 literal `it(`s become **22**, the one difference being
  the `NOW` pair above, for the same **98** tests.

## What L4d2 found

**`mocha` 30 → 29**, vitest **2 382 → 2 433 tests** across **125 → 126 files**.
One spec, 1 198 lines, 50 `it`s in and **51** out. The port is
`tests/core/validation/validation.test.ts` — the Mocha file was named after a
method (`init`) rather than after its subject, and it tests nine of them.

### ⚠️ The "reset only" classification was right about the outcome and wrong about the spec

[The sweep](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for)
put `validation/init` in the class _"reset only — no substitution at all …
`vi.mock` never appears in the port"_. `vi.mock` indeed never appears. But the
spec **does** substitute — thirteen modules at once:

```js
["anything", "boolean", "date", …].forEach((fileName) => {
  mockRequire("../../../lib/core/validation/types/" + fileName, validationStub);
});
```

a **concatenated specifier**, which the sweep's regex — looking for a quoted
string — does not see. That is the same failure mode as
[`pluginContext`'s template literal](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for),
in the same sweep, and the **fifth** count this step has taken by grep that was
wrong about the thing it was counting.

### The thirteen-module swap was proving something directly observable

What that test asserted was _the stub was constructed thirteen times, and
`addType` was called thirteen times_. Two counts, and nothing about **which**
types were registered — it could not say more, because every type was the same
anonymous stub.

`init()` fills `validation.types`, keyed by each type's own `typeName`. So the
port asserts the thirteen **names**, which tests `init` _and_ `addType` against
the public surface, needs no mock at all, and catches a type dropped from
`BUILT_IN_TYPES` — something the call count would have reported only as
"twelve". A second test pins `typeAllowsChildren`, which is the other half of
what `init` does and which nothing asserted.

**The generalisable part:** the sweep asks _what does this `reRequire` reset_.
The question that dissolved this one is the next one along — **what is the
substitution proving, and can the subject be asked directly?**

### ⚠️ Ten arrangement lines wired to nothing

`#curateCollectionSpecification` opens with `const checkAllowedPropertiesStub =
sinon.stub();` and then calls `checkAllowedPropertiesStub.returns(true)` or
`.returns(false)` in **ten** of its eleven tests. The stub is never attached to
anything. `checkAllowedProperties` is a module-private _function_ in
`validation.ts`, not a method — it was never stubbable, in either runner — so
every one of those tests has always run against the real check, including the
two that set it to `false` and then assert the rejection the real check
produces anyway. Deleted.

### ⚠️ A sixteenth dead-assertion form: assertions that only run in a `catch`

All six of `#addType`'s rejection tests were written as

```js
try {
  validation.addType(validationType);
} catch (error) {
  should(error.id).be.eql("validation.types.missing_type_name");
}
```

**A subject that accepted the type passes every one of them.** It is the first
form on this step's list that is a control-flow shape rather than a weak
matcher, and it is the most complete: there is no assertion at all on the path
that matters.

### ⚠️ And one test that was already on the wrong side of it

`"should reject an error if the field specification returns an error in verbose
mode"` asserted inside a `.catch(error => …)` on a promise the subject
**resolves** — answering the errors instead of throwing is the entire point of
verbose mode — so the callback never ran. Its three assertions described an
`error.details` array no path in `validation.ts` produces. The port asserts what
the subject answers.

### `internalIndex.search`, not an `ask` answerer

The Mocha spec arranged `kuzzle.ask.withArgs("core:storage:private:document:search")`,
an event the subject never names: `getValidationConfiguration` calls
`global.kuzzle.internalIndex.search`, and `internalIndex` is a `Store` whose
methods are _generated_ as calls onto that bus. The arrangement was live, but
only through a `KuzzleMock` whose `internalIndex` subclasses the real `Store` —
two indirections that both had to be right for the fixture to reach the subject.
The port stubs the method the subject calls.

### `stubLogger` is promoted to `tests/mocks/kuzzle.ts`

Three specs had already written the same seven-line `kuzzle-logger` stub
locally ([L3a](#what-l3a-found), [L3b](#what-l3b-found), [L3e](#what-l3e-found));
this would have been the fourth. It is one export now, and the fixture's own
default logger is the same spied object — a subject that logs its way past a
failure has said something, and the only place it said it is there.

### Small things

- Four `it` names covered eleven tests: _"should throw an error if the
  multivalued field is malformed"_ named **five**, and three more named two
  each. The five malformed cases plus the non-boolean `value` are one
  `it.each` table of six rows now, so a failure says which shape was accepted.
- **Eleven assertions were pinned on the literal string
  `"undefined.undefined.undefined"`** — `curateFieldSpecificationFormat` takes
  an index, a collection and a field name, and the spec called it with none of
  them, so its error messages named three missing arguments. TypeScript refuses
  that call (the three are `string`), and naming them makes the assertions about
  the message rather than about the absence of the arguments.

## What L4d3 found

**`mocha` 29 → 28**, vitest **2 433 → 2 484 tests** across **126 → 127 files**.
One spec, 669 lines, 36 `it`s in and **51** out. The port is
`tests/core/plugin/pluginContext.test.ts`.

### The substitution is real, and the spec never said so

After [L4d1](#what-l4d1-found) and [L4d2](#what-l4d2-found), both of which
turned out to need no mock at all, this one does. `lib/util/mutex` was
registered in a bare `beforeEach` with no comment, and **nothing in the four
hundred lines that follow it needs a mutex** — which is why the first port
deleted it, on the reading that `MutexMock` extends the real `Mutex` and stubs
only `lock`/`unlock`, neither of which the spec calls.

Four tests then hung for the full 20-second timeout. What needs the mock is
`#accessors.strategies`, five hundred lines down: `curryAddStrategy` takes a
real `new Mutex("auth:strategies:add").lock()`, which **retries against the
cache until it wins or times out**, so against a fixture that answers nothing
it never returns. The failure is a timeout rather than an error, which is the
worst shape for a missing dependency to take.

**The lesson is the placement, not the mock.** A substitution registered at the
top of a file for the sake of one block at the bottom cannot be read as either
necessary or unnecessary — and this one had a second signal that nobody used:
`MutexMock.__getLastMutex()` exists precisely so a spec can check which lock was
taken, and no spec ever called it. The port declares the stub next to the
`vi.mock` that installs it, says which block needs it, records the resources,
and **asserts them** — the two strategy tests now state that a lock is taken and
which one.

### ⚠️ A seventeenth dead-assertion form: an expectation computed from the same wrong accessor as the actual

`#accessors.subscription`'s register test asserted, through `sinon.match`:

```js
input: {
  body: customRequest.input.body,
  collection: customRequest.input.collection,
  index: customRequest.input.index,
}
```

`RequestInput` has **no** `index` or `collection` getters — they live on
`input.args` (and on the deprecated `input.resource`). So two of those three
expected values are `undefined`, and they were compared against the subject's
`input.index` and `input.collection`, also `undefined`. **`undefined ===
undefined` twice**, and a subject that dropped the index entirely passed.

This is the first form on the list where the assertion is wrong on _both_
sides, and it is the reason it survived: reading the expectation off the same
accessor as the actual makes any accessor look right. The port asserts
`input.args` against literals.

### ⚠️ `PluginContext.constructors` is declared as instances — [TD-76](../type-debt-register.md#td-76)

Six TS2351s. Four of the seven entries — `Koncorde`, `Request`,
`RequestContext`, `RequestInput` — are typed as the **instances** they build,
while `Mutex`, `Repository` and `ESClient` are typed as constructors. So the
shape is not a convention the file follows; it is a mistake in four places, each
hidden by the `as any` it carries at its assignment.

It lands on the **public plugin API**: `new context.constructors.Request(…)`,
what every plugin writes, does not type-check. Filed, not fixed — a porting
slice leaves `lib/` alone. The spec names the cast `constructorOf()`.

### Small things

- The log-level test drove five levels through one `it` whose `calledOnce`
  held only because each happened to reach a different logger method. That
  stops being true the moment `silly` is included — which is exactly the level
  it left untested. Six tests now, one per level, `silly` and `verbose` both
  landing on `trace`.
- `should(context.accessors).have.properties([…])` listed seven of the nine
  accessors: `cluster` was missing outright, and `nodeId` was covered only by a
  test of its own. The port asserts the key set, so an accessor added or dropped
  is named.
- The `process.nextTick` in _"should add the plugin name in logs"_ waited for
  nothing — `context.log.info` calls the logger synchronously. Folded into the
  per-level table.

## What L4d4 found

**`mocha` 28 → 26**, vitest **2 484 → 2 661 tests** across **127 → 129 files**.
Two specs, 1 974 lines, **97 `it`s in and 177 out**. The ports are
`tests/core/plugin/pluginsManager.test.ts` and
`tests/api/funnel/processRequest.test.ts`, and `test/mocks/controller.mock.js`
retires with them.

### The pairing the sweep insisted on turned out to cost nothing — and to be unnecessary

[The sweep](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for)
put these two specs in one slice because both re-require the same trio —
`pluginContext`, `privilegedContext`, `pluginsManager` — and a shared subject
means a shared mirror. Both re-requires are **resets with no substitution
underneath**, exactly as the sweep's own table said for `pluginsManager`, so
neither port declares a single `vi.mock`: `processRequest` builds its
controllers itself, and `pluginsManager` needs nothing more than a `global`.
**The trio was never a coupling between the two specs; it was the same
`reRequire` habit written twice.** They still land together, because splitting
them after the fact would have cost a second review of the same fixture.

⚠️ And `processRequest` opened with `mockrequire("elasticsearch", { Client: … })`
— **a substitution of a package that is not a dependency and is not installed**
(`sdk-es7`/`sdk-es8` are the aliases this repo uses). Nothing imported it,
nothing could have. Another arrangement wired to nothing, and the first that names
a module that does not exist.

### ⚠️ An eighteenth dead-assertion form: a promise assertion nobody returned

Four of `_initApi`'s six tests read

```js
it("should throw an error if the openAPI specification is invalid", () => {
  plugin.instance.api.email.actions.receive.http[0].openapi = {
    invalid: "specification",
  };

  should(pluginsManager._initApi(plugin)).be.rejectedWith({
    id: "plugin.controller.invalid_openapi_schema",
  });
});
```

No `return`, and the test function is not `async`. `should`'s promise
assertions **answer** a promise rather than throwing; unreturned, Mocha ends
the test before it settles and the rejection is reported — if at all — as an
unhandled rejection attributed to no test. All four were green against any
behaviour whatsoever, which is how the next finding survived.

### ⚠️ `invalid_openapi_schema` is documented, coded twice, and raised nowhere — [TD-77](../type-debt-register.md#td-77)

Two of those four tests assert an error id that **`lib/` never produces**.
`plugin.assert.invalid_openapi_schema` and
`plugin.controller.invalid_openapi_schema` are both declared in
`lib/kerror/codes/4-plugin.json` and both published in
`doc/2/api/errors/error-codes/plugin/`; `grep -rn invalid_openapi_schema lib`
matches the codes file and nothing else. A route's `openapi` member is not
validated at all — `checkHttpRoute` splices the name out of the property list
before complaining about unknown properties, and `registerApiAction` copies the
value into the route verbatim, object or `true` alike.

So a validation nobody wrote has had two green tests and a documentation page
for as long as the codes have existed. Filed, not fixed: the port states what
the subject _does_, in two tests named
_"carries an openapi declaration that is not a valid specification, unchecked"_.

### ⚠️ A nineteenth form: the subject called outside the assertion

Three of `_checkSdkVersion`'s cases read `should(funnel._checkSdkVersion(request)).not.throw()`
— the subject invoked **as the argument**, so the matcher applies to its return
value, `undefined`. If the call had thrown, the throw would have escaped the
test rather than being caught by `.not.throw()`, so the assertion could neither
pass nor fail on its own terms: it was `should(undefined).not.throw()`, seven
characters away from `should(() => …)`.

It is the mirror image of the fifteenth form — _a test that never called the
subject_ — which this slice hits again: `_initControllers`' sixth invalid-route case
was written `should(() => { pluginsManager._initControllers(plugin); });` — a
wrapper with no matcher, so the subject was **never called**. It is the case
that proves a typo in a route's property _name_ is caught, and it had never run.
The port asserts it, with the `Did you mean "controller"?` suggestion.

### ⚠️ The plugin-facing hook and pipe types admit neither form the spec needed — [TD-78](../type-debt-register.md#td-78)

18 TS2322s, all of one shape. `PluginHookDefinition` and `PluginPipeDefinition`
declare their values as handler **functions**, and `resolveEventHandler` takes
two more shapes: **the name of a plugin method** (deprecated, warned about, and
what half of these tests are _about_), and, for pipes, the **callback form** —
which `lib/types/EventHandler.ts` already models as `CallbackPipeHandler`, and
which the emitter's own `RegisteredPipeHandler` admits. The plugin-facing type
is the one that does not, so it is narrower than the type the value ends up
stored in one layer down. Named once each as `byName()` and `asPipe()`.

### Small things

- **`plugins` answers an array, and the spec called `.keys()` on it.**
  `should(Array.from(pluginsManager.plugins.keys())).be.length(1)` reads the
  _indices_ of an array, so the assertion was "one plugin came back", said
  through an accessor that would answer the same for any single element. The
  port compares the array.
- **`pluginsManager._plugins.set(plugin)`** — one argument, in the alias-pipe
  test. `Map.set(k)` stores the plugin as its own key with the value
  `undefined`; `_initPipes` reads the argument it is handed, so the line was
  wired to nothing either way.
- **`NODE_ENV` was set to `"development"` and never put back**, by four tests
  that need `didYouMean` to answer. In a single-process Mocha run that is a
  global left flipped for every file that follows. The port restores it.
- **Assertions comparing two separately-bound functions.** The action registered
  for a method name was compared with a fresh `plugin.instance.functionName.bind(plugin.instance)`.
  What the binding is _for_ is the receiver, so the port calls the action and
  asserts what `this` was.
- **Forty-eight assertions on twelve routes** became one table: every declared
  route is published twice, under the deprecated `/_plugin/<name>` prefix and
  under `/_`, in declaration order.
- **Seven tests the Mocha suite did not have**, on public methods next to the
  ones it drove: `unregisterPipe` (a pipe stops being called), `exists`,
  `getActions`/`isAction`/`isController` on an unregistered controller,
  `listStrategies`, `_initAuthenticators`' copy under the plugin's name, the
  `application` setter's second assertion, and `registerStrategy` reaching
  passport not at all before `init`. The Mocha suite ended instead on
  `describe("#loadPlugin", () => it("", () => {}))` — an empty test with an
  empty name, reported as a passing case called _"Plugin #loadPlugin "_.

## What L4e1 found

**`mocha` 26 → 25**, vitest **2 661 → 2 799 tests** across **129 → 130 files**.
One spec, 586 lines, **31 `it`s in and 138 out**. The port is
`tests/config/index.test.ts`.

The 31 → 138 is not a rewrite: eleven of the Mocha tests were `for` loops over
a list of bad values inside a single `it`, so a failure named the test and not
the value. They are `it.each` tables now — the ten limits, the six bad values
per HTTP option, the six per WebSocket option — and the case that fails says
which one it is.

### The substitution is `rc`, and it is the whole fixture

This spec is the cleanest `reRequire` in the slice: one `mockRequire("rc", …)`
and a re-require, because `mock-require` only affects a _later_ `require`.
`vi.mock` is hoisted, so the subject is imported normally and both halves
disappear — including the `afterEach` that re-required `lib/config` a second
time to undo the first.

### ⚠️ `loadConfig` mutates what `rc` hands it, and the spec's fixture was the packaged defaults

`loadConfig` rewrites its input in place: it splits
`http.accessControlAllowOrigin` into an array, replaces
`server.protocols.http.maxFormFileSize` with its parsed byte count, and
assigns `config.internal`. The Mocha stub answered
`Object.assign({}, defaults, overrides)` — a **shallow** copy of the imported
`default.config` module — so every one of those writes landed in the real
packaged-defaults object and stayed there for the rest of the process.

That is visible in the suite itself: _"should convert string separated coma to
an array"_ asserts on `mockedConfigContent.http.accessControlAllowOrigin`, the
object the test handed _in_, not on what `loadConfig` answered. It passes
because by then the two are the same object. The port clones the defaults per
call and asserts the result.

### ⚠️ A test that called the subject and then asserted on something else

_"should use storage engine default settings for the imports collection"_
calls `config.loadConfig()`, discards it, and asserts on
`defaultConfig.default.services.storageEngine.internalIndex.collections.imports.settings`
— the packaged module. Whatever `loadConfig` did to those settings, the
assertion could not see it; the call is decoration. Not a new form —
[the fifteenth](#slices) is its neighbour — but the first where the subject
_is_ called and the result is simply dropped. The port reads the loaded
configuration.

### ⚠️ Two messages that describe something other than what they check — [TD-79](../type-debt-register.md#td-79)

Found by writing the two assertions the Mocha spec never had:

- `checkHttpOptions` **checks** `config.http.accessControlAllowOriginUseRegExp`
  and **prints** `cfg.accessControlAllowOriginUseRegExp`, where `cfg` is
  `server.protocols.http` — a section that never carries the key. The message
  reads `invalid value "undefined"` whatever was configured. Every other
  assert in the function reads and prints the same object.
- `checkWebSocketOptions` accepts `idleTimeout >= 0` and says
  `(integer >= 1000 expected)`. `idleTimeout: 500` is accepted while being
  told it is not allowed.

Both are pinned as they are — the message asserted verbatim, `500` asserted as
_accepted_ — so whichever way they are fixed, the spec says so.

### What the Mocha suite never covered

- **`checkClusterOptions` — the whole function.** Eleven assertions on the
  section that decides whether a node joins its cluster, and a `.kuzzlerc` is
  the only place any of them is ever set. Now eleven tests, including the two
  spellings an environment variable uses for "no IP selector" (`""` and the
  string `"null"`), which the checker normalises before validating.
- **`preprocessProtocolsOptions`** — `internal.notifiableProtocols` is what
  the realtime notifier iterates, so a protocol missing from it is a protocol
  whose subscribers are never notified.
- **The `accessControlAllowOriginUseRegExp` path**, which compiles every
  configured origin into a `RegExp`.
- **`maxFormFileSize` being replaced by its parsed value** — the checker does
  not only validate it, and every reader downstream expects the number rather
  than the `"1mb"` a `.kuzzlerc` writes.
- **`options.db` winning over the deprecated `database`** — the spread exists
  for that precedence and nothing asserted it.
- **A single limit that is not a number.** The Mocha spec only replaced the
  whole `limits` section; each limit is read through a guard of its own.

## What L4e2 found

**`mocha` 25 → 22** and **[L6](#slices) 14 → 12**, with no port written: three of
the Mocha specs this step counted as remaining work **were already ported, and
the original was never deleted**.

| Mocha spec                                          | vitest twin                                         | since                                                            |
| --------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| `test/core/storage/storageEngine.test.js` (2 `it`s) | `tests/core/storage/storageEngine.test.ts` (5)      | `c49d3214f`, _"vitest specs for the converted lib/core modules"_ |
| `test/core/shared/abstractManifest.test.js` (9)     | `tests/core/shared/abstractManifest.test.ts` (10)   | `c7fcc84ba`, [L1b3](#what-l1b3-found)                            |
| `test/core/shared/sdk/impersonatedSdk.test.js` (4)  | `tests/core/shared/sdk/impersonatedSdk.test.ts` (8) | `555264df9`                                                      |

Each twin covers strictly more than its original, **except one case**:
`abstractManifest`'s _"should throw if kuzzleVersion is not a string"_, which
feeds `semver.satisfies` a range it cannot parse and gets a mismatch rather
than a type error. It is now a test of the vitest spec, and the three Mocha
files are deleted.

**Two of the three are `rewire` specs**, so L6 — [budgeted as redesigns rather
than ports](#slices) — loses two of its fourteen before it opens.

### ⚠️ The count was never wrong; nothing was ever asked to compare the two trees

The step's inventory is `find test -type f -name '*.test.js'`, which is exactly
what the `mocha` ratchet counts, and it is the right question for _"how much
Mocha is left"_. It is the wrong question for _"how much work is left"_, and
nothing else asked: the vitest tree is addressed by [`specTarget()`](#slices)
from spec to **subject**, never from subject back to spec, so a subject with
two specs is invisible in both directions.

The check is one line and worth keeping for the rest of the step:

```bash
for f in $(find test -name '*.test.js'); do
  t="tests/${f#test/}"; [ -f "${t%.js}.ts" ] && echo "DUPLICATE $f"
done
```

It is the same shape as [L3d](#what-l3d-found)'s block hash and as the
[unmirrored-spec warning](#slices): **this step keeps finding that its own
inventory is a `find` nobody cross-checked.**

### ⚠️ `build:tests` never cleaned its output, so a deleted spec kept passing

Deleting the three files and running `npm run test:unit:mocha` reported
**804 passing** — the same count as before the deletion. `.mocharc` globs
`./dist/test/**/*.test.js` and `build:tests` was a bare `tsc -p`, which emits
over the previous output without removing anything: the compiled copies of the
three deleted specs were still there, and still ran. After `rm -rf dist/test`,
789 — the 15 tests that had just been deleted.

CI never saw it (a fresh checkout has no `dist/`), and it is invisible in the
direction that matters least: a spec that is deleted keeps _passing_. `npm run
build:tests` now removes `dist/test` and `dist/tests` first. ⚠️ **Every slice
of this step deletes specs, so every local Mocha run before this one was
reporting a stale count.**

## What L4e3 found

**`mocha` 22 → 20**, vitest **2 800 → 2 840 tests** across **130 → 132 files**.
Two specs, 613 lines, **29 `it`s in and 40 out**. The ports are
`tests/model/storage/baseModel.test.ts` and
`tests/model/storage/apiKey.test.ts`; `test/mocks/clientAdapter.mock.js`
retires with them, and `test/mocks/elasticsearch.mock.js` goes too — it had no
user left at all.

### ⚠️ The substitution these two specs shared was wired to nothing — and the sweep's third pair dissolves

Both opened with the same four lines: `mockrequire` the `clientAdapter`,
`reRequire` `storageEngine`, build one, `init()` it. **Neither spec touches a
storage engine again.** `BaseModel` persists through
`global.kuzzle.internalIndex.<method>()` and `ApiKey` asks two security-token
events; the engine is not on either path.

So [the sweep](#what-each-of-the-remaining-23-re-requires--the-sweep-l4a-asks-for)'s third pair —
_"`storage/storageEngine`, `model/storage/baseModel` and `model/storage/apiKey`
all reset `storageEngine` over a stubbed `clientAdapter`"_ — was a shared
_arrangement_, not a shared subject, and it dissolves the same way the
`pluginsManager` / `processRequest` pair did in [L4d4](#what-l4d4-found).
**All three of the sweep's "must land together" pairs turned out not to be
couplings**; two were re-require habits copied between files, and the third
([the `httpwsProtocol` pair](#what-l4b4-found--and-l4b-is-closed)) was the only real one.

### ⚠️ The assertions were one layer below the subject — for the seventh time

`BaseModel.load` calls `global.kuzzle.internalIndex.get(...)`. The Mocha spec
asserted `kuzzle.ask("core:storage:private:document:get", kuzzle.internalIndex.index, "models", "mylehuong")`
— four arguments, of which the subject passes two, because **those events are
`InternalIndexHandler`'s**, one layer down, and `KuzzleMock` supplied a real
handler that emits them.

That is [L2b](#what-l2b-found)'s `ObjectRepository` finding, [L2d](#what-l2d-found)'s
`collectionController`, [L2e](#what-l2e-found--and-l2-is-closed)'s and
[L3b](#what-l3b-found)'s `securityController` halves — **seven specs across
five slices, always the same cause**: a mock that supplies a real
collaborator makes the layer below reachable, and a spec that reaches it
cannot tell you when its subject stops calling it. The ports assert on
`internalIndex` and take a nine-method fixture in exchange.

### ⚠️ `serialize()` deletes the token from the model, not from a copy

```ts
serialize({ includeToken = false } = {}) {
  const serialized = super.serialize();       // { _id, _source: this.__source }
  if (!includeToken && this.token) {
    delete serialized._source.token;          // ← the model's own __source
  }
  return serialized;
}
```

`BaseModel.serialize()` answers `{ _id: this._id, _source: this._source }`,
and `_source` is the backing object rather than a copy — so hiding the token
from one caller **removes it from the ApiKey instance**. The Mocha spec built
_two_ instances to assert the two cases, which is exactly what kept the order
from mattering; the port asserts the aliasing on one instance, so a future
`serialize()` that stops mutating says so. Left as it is: `lib/` is not this
slice's to change, and every current caller serialises once, at the end.

### Small things

- **`kuzzle.hash.returns("hashed-jwt-token")`** arranged the wrong function:
  the fingerprint is `sha256(token.jwt)` from `lib/util/crypto`. The test that
  needed it asserted `apiKey._id === apiKey._source.fingerprint` — true of any
  two equal values, and it never said what the id _is_. The port asserts both
  against `sha256(TOKEN.jwt)`.
- **`ApiKey.load` had no test for the case that works** — only for the one
  that throws.
- **`loadFromRequest`'s precedence was untested**: `_id` over `key` over
  `fingerprint`, and a request may carry two of them.
- **`_afterDelete`'s guard was untested**: the token may already be expired or
  revoked, and the `if (token)` is what keeps deleting an API key from failing
  on it.
- **`BaseModel.batchExecute`, `register`'s misuse guard, the `_source`
  setter's field filter, and both "must be defined" getters** had no test at
  all.

## What L4e4 found

**`mocha` 20 → 19**, vitest **2 840 → 2 857 tests** across **132 → 133 files**.
One spec, 419 lines, **12 `it`s in and 17 out**. The port is
`tests/kuzzle/internalIndexHandler.test.ts`.

### The two-step mock becomes one declaration

This is the slice's genuinely conditional spec, and the reason is the base
class: `InternalIndexHandler` takes a mutex named `InternalIndexBootstrap`,
and `Store.init` — which it calls first — takes one named
`Store.init(%kuzzle)`. Under `mock-require` that needs **two** steps, because
the substitution only reaches a module required _after_ it:

```js
mockrequire("../../lib/util/mutex", { Mutex: MutexMock });
// the shared object "Store" also uses mutexes that we need to mock
mockrequire.reRequire("../../lib/core/shared/store");
InternalIndexHandler = mockrequire.reRequire(
  "../../lib/kuzzle/internalIndexHandler",
);
```

`vi.mock` replaces the module for the whole graph, so the second and third
lines go. **The `reRequire` was never about the handler; it was about its base
class** — the same question [L4a](#what-l4a-found) asked and answered for
`global.app`.

### ⚠️ `MutexMock.__getLastMutex()` could not say which lock it was reading

The mock kept a module-level `lastMutex`, and the bootstrap test asserted on
it — `resource`, `lock`, `unlock`. Two mutexes are taken on that path, and
which one is "last" depends on the order the subject happens to take them in.
The port records **all** of them and asserts the sequence
`["Store.init(%kuzzle)", "InternalIndexBootstrap"]`, then reads the bootstrap
one by name.

### ⚠️ `calledWith` matches a prefix, so a fourth argument went unmentioned

```js
should(kuzzle.ask).calledWith(
  "core:storage:private:collection:create",
  "fooindex",
  "foo",
  { mappings: collections.foo },
);
```

`createCollections` passes a fourth argument, `{ indexCacheOnly }` — and
sinon's `calledWith` is satisfied by a call that passed _more_ arguments than
it was given. That flag is the difference between the node that won the
`Store.init` lock and writes the mappings, and the ones that waited and only
fill their cache; it was invisible to the assertion. **A `calledWith` is a
prefix match, and the arguments a spec does not mention are the ones nobody
is watching** — the second matcher-shaped hole in this step, after
`not.calledWith` in [L1b](#what-l1b-found).

### What the Mocha suite never covered

- **The lock is released when the bootstrap fails.** That is what the
  `finally` is for: a node that fails to bootstrap and keeps the lock makes
  every other node wait out its 30-second TTL.
- **`authToken.secret` winning over the deprecated `jwt.secret`.** The
  fallback is written `authToken?.secret ?? jwt?.secret`, and only the
  deprecated half was tested.
- **A restart finding its seed already stored** — it must not generate a
  second one, and must read the stored value back, or every restart
  invalidates every token in circulation.
- **`createInitialValidations` with nothing configured**, which is the
  packaged default.
- **Only the `admin` profile carrying `rateLimit: 0`** — the unlimited rate is
  what lets an operator recover a node that is rate-limiting everyone else.

## What L4e5 found

**`mocha` 19 → 17**, vitest **2 857 → 2 880 tests** across **133 → 135 files**.
Two specs, 323 lines, **18 `it`s in and 23 out**. The ports are
`tests/util/mutex.test.ts` and `tests/util/asyncStore.test.ts`.

### ⚠️ `asyncStore`'s stub made the suite describe the wrapper instead of the store

The Mocha spec replaced `async_hooks` with

```js
class AsyncLocalStorageStub {
  constructor() {
    this._store = new Map();
    this.run = sinon.stub(); // ← does not call its callback
    this.getStore = sinon.stub().returns(this._store);
  }
}
```

**`run` never runs anything**, and `getStore` answers the same Map forever —
outside any asynchronous context. So `#set` and `#get` asserted against a Map
the stub invented, `#run` asserted only that _a_ Map and _a_ callback were
handed over, and nothing could tell whether a value set inside a context is
visible to the code running in it. That is the single thing an
`AsyncLocalStorage` wrapper exists to do.

`AsyncLocalStorage` is a Node builtin with no I/O. The port uses the real one
and asserts the real property: a value set inside `run` is still there on a
later tick, and two runs do not see each other's store.

The spec also carried a `process.version >= "v12.18.1"` branch whose `else`
half asserted on an `AsyncStoreStub` class that **no longer exists in the
subject** — dead since the minimum supported Node became 20, and unreachable
long before that.

### The mutex's fake clock becomes four answer queues

The Mocha spec drove `lock()`'s retry loop with `sinon.useFakeTimers()` and
`clock.tick(1000)` in a `for` loop, twelve lines per case — and its last
assertion, `should(mutexPromise).be.fulfilledWith(false)`, was **never
awaited**. What those tests are about is the sequence of answers the cache
gives: the port arranges that sequence (`stored = [false, false, true]`) with
a 1 ms attempt delay and real timers, and asserts the number of attempts. Same
property, deterministic, and the assertion runs.

### ⚠️ `instanceof` across `vi.resetModules()`, for the fifth time

`delScriptRegistered` is module-level, so "the LUA script is defined once" is
a question about the module and the port re-imports it per test. The two
rejection tests then failed with _"expected InternalError … to be an instance
of InternalError"_: a statically imported error class is a **different class
object** from the one the re-evaluated graph raises. The error class is now
imported from the same fresh graph as the subject. Fifth occurrence, after
[L4a](#what-l4a-found)'s and [L4b](#what-l4b-found)'s.

### What the Mocha suite never covered

- **The node half of a mutex id.** `mutexId` is `<node>/<random>`, and the
  Mocha spec only asserted that two ids differ — the part that makes a lock
  traceable to the node holding it, when a cluster deadlocks, was untested.
- **`wait()` never writing.** It reads the cache; a `wait` that stored
  anything would be taking the lock it is only supposed to be watching.
- **`unlock` passing its own id to the script**, which is the whole reason the
  LUA script exists: a lock whose TTL expired and was re-taken by another node
  must not be deleted by this one.
- **`AsyncStore` refusing to `get`/`set`/`has` outside a run.** The subject
  asserts `"Associated AsyncStore is not set"`; the stub always answered a
  Map, so that branch could never be reached.

## What L4e6 found

**`mocha` 17 → 15**, vitest **2 880 → 2 919 tests** across **135 → 137 files**.
Two specs, 255 lines, **14 `it`s in and 39 out**. The ports are
`tests/core/auth/passportWrapper.test.ts` and
`tests/core/shared/sdk/embeddedSdk.test.ts`. **Neither declares a single
`vi.mock`.**

### Both substitutions were replacing something that needs no replacing

`passportWrapper`'s spec replaced the `passport` module with four stubs —
and then **un-replaced it** for its one redirect test, which is the only one
that exercised passport's protocol rather than the stub's. `passport` is a
registry with no I/O: the port registers real strategies, each one taking one
of the four outcomes the wrapper exists to translate (`success`, `fail`,
`error`, `redirect`), and asserts what the wrapper answers.

`embeddedSdk`'s spec replaced `impersonatedSdk` with a `sinon.spy()` and
asserted it had been _called_ with the kuid — which says the constructor ran,
not that the result impersonates anyone. The port asserts the object that
comes back: an `ImpersonatedSDK` whose `kuid` and `checkRights` are what
`as()` was given.

### ⚠️ `use()` was called with the wrong arity, and it worked

```js
passportWrapper.use(new MockupStrategy("mockup", stub));
```

The signature is `use(name, strategy, opts)`. It worked because `passport.use`
accepts the one-argument form and reads the name off the strategy — but the
wrapper then ran `this.options[name] = opts` with `name` being **the strategy
object**, so the options were stored under the key `"[object Object]"` and
the next `authenticate("mockup")` found none. TypeScript refuses the call
outright, which is how the port found it.

### ⚠️ An unknown strategy is reported as `next is not a function` — [TD-80](../type-debt-register.md#td-80)

The port's first new assertion — authenticate against a strategy that was
just unregistered — did not answer `Unknown authentication strategy "foobar"`.
It answered `Caught an unexpected plugin error: next is not a function`.

`passport.authenticate(...)` returns Express middleware, which the wrapper
invokes as `(request, response)`; passport reports everything it decides
itself, an unknown strategy first among them, by calling **`next(error)`**.
With no `next`, the middleware throws a `TypeError` that the wrapper's own
`catch` wraps. Pinned as it is, and filed.

The Mocha spec could not have found this: with `passport.authenticate`
replaced by a stub, the middleware whose arity is wrong never ran.

### What the Mocha suite never covered

- **The other fourteen forbidden `auth` actions.** The list is the API surface
  a plugin may not reach as itself, and one test named one of them; an entry
  dropped from that list is a privilege the embedded SDK silently gains. All
  fifteen are a table now.
- **`propagate` being set on `realtime:subscribe` and on nothing else** — the
  Mocha spec asserted the two values of the flag, never its absence
  elsewhere.
- **A warned action still running.** _"should warn if the action is not
  supported"_ called `query` without awaiting it and asserted only the
  warning, so nothing said whether `auth:login` still works.
- **`as()`'s `checkRights` defaulting to false**, which is the safe half of
  the option.
- **A strategy throwing a non-`Error`** — plugin code may throw anything, and
  the subject wraps it before reading `.message` off it.

## What L4e7 found — and L4 is closed

**`mocha` 15 → 14**, vitest **2 919 → 2 943 tests** across **137 → 138 files**.
One spec, 305 lines, **16 `it`s in and 24 out**. The port is
`tests/api/controllers/adminController.test.ts`.

### `__getLastMutex()` again, and this time it was load-bearing

The same `test/mocks/mutex.mock.js` accessor [L4e4](#what-l4e4-found) found —
one module-level `lastMutex`, one module-level `__canLock()` switch — and here
the spec had to work around both: _"should unlock the action even if the
promise rejects"_ reads `__getLastMutex()` twice and ends with
`should(mutex2).not.eql(mutex1)`, an assertion whose only job is to check that
the accessor moved on. The lock-refused tests wrap themselves in
`try { … } finally { MutexMock.__canLock(true) }`, because the switch is
process-global and a test that throws before restoring it breaks the next
file.

The port records the mutexes in a list and reads the one it means by name, so
both workarounds disappear.

### What the Mocha suite never covered

- **`resetSecurity`'s return value.** It asserted the three truncations and
  dropped what they answered — and `{ deletedUsers, deletedProfiles,
deletedRoles }` is the API's response body.
- **`resetDatabase` releasing its lock when the deletion fails**, which is
  what its `finally` is for. The `resetSecurity` half was tested; its twin
  was not.
- **Nothing being flushed when `resetCache` refuses an unknown database.**
- **`dump`'s default suffix** (`manual-api-action`).
- **The nine-action list**, which is what `_isAction` answers from: an action
  missing from it is an action the API refuses although the method exists.
- **⚠️ `_waitForAction`, the branch three actions share.** `refresh: "false"`
  means _do not wait_: the action answers `{ acknowledge: true }` immediately
  and the work runs on, detached. The failure of that promise is swallowed
  into a single `logger.error` line — the only place it is ever reported —
  and nothing asserted either half. Both are tested now.

## What L6h found — and L6 is closed

**`mocha` 26 → 0 tests and 1 → 0 spec files.** vitest **3 734 → 3 764** across
153 files. 26 Mocha tests in, 30 out.

**The ratchet this step exists for reads zero.** `✅ 'mocha' ratchet: 0 (= baseline 0)`.

### ⚠️ The only `rewire` in the suite that `vi.mock` genuinely could not replace

```js
Rewired.__with__({ require: requireStub })(() =>
  new Rewired().loadMoreProtocols(),
);
```

`loadMoreProtocols` reads `protocols/enabled/`, and `require`s every directory
in it at a path it computes from `__dirname`. The Mocha spec replaced **both
halves** — `fs` through `mock-require`, and the module's own `require` through
`rewire` — which is why it could assert only that `require` had been called
twice. **Nothing about loading a protocol was under test**: not the manifest,
not the name it registers under, not what happens when two protocols claim the
same one.

The answer is [L6b](#what-l6b-found)'s, again: the fixtures are **real
directories**, written into the very place the subject looks and removed
afterwards, so `require` resolves a real module and the manifest is read off
disk. The spec asserts the directory is empty before it starts and after it
finishes — an operator's protocol must never be what a test loaded.

_Stated once, for [L7](#slices):_ across L6's twelve specs, **`rewire` was
irreplaceable exactly once, and the replacement was not a mocking technique but
a fixture.**

### The mocha runner leaves CI in this slice, and only the runner

With no spec left, `mocha` exits 2 — its glob matches nothing and that is an
error, not an empty run. So this PR takes `mocha` out of the unit-test matrix
and drops the `Mocha coverage` step from the `sonarqube` job; the coverage
normalisation keeps both arguments and simply finds no mocha report, which is
what it already did for a runner that had not run.

Everything else is [L7](#slices)'s: the dependencies (`mocha`, `should`,
`should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`),
`.mocharc.json`, `test/` itself, the `test:unit:mocha*` scripts,
`npm run build:tests`, the ratchet and its baseline, and shrinking
`tsconfig.tests.json` to the cucumber directories.

### What the Mocha suite never covered

- **The stack trace being stripped from an error on its way to a client.** The
  subject does it on every response; nothing asserted it.
- **A protocol whose `init` rejects**, reported by name, and **two protocols
  claiming the same name** — a mistake an operator makes by copying a
  directory. Both were unreachable while `require` was a stub answering a fresh
  anonymous class each time.
- **`init()` not starting the other two protocols.** A protocol that listened
  before the API is up would accept traffic it cannot serve, and the ordering
  was asserted only through `startListening`.
- **`removeConnection` on a connection that is not there** — a double
  disconnection, which the network layer sees routinely.
- **The funnel not being called at all once shutting down**, rather than being
  called and its answer discarded.

## What L6g found

**`mocha` 80 → 26 tests and 2 → 1 spec _file_**, vitest **3 669 → 3 734**
across 152 files. 54 Mocha tests in, 63 out. **The sixty `__set__` call sites
are gone and nothing replaced them.**

### Sixty stubs asserted delegation, not validation

```js
const isPointStub = sinon.stub().returns(true);
GeoShapeType.__set__("isPoint", isPointStub);

should(
  geoShapeType.recursiveShapeValidation(
    ["point"],
    {
      type: "point",
      coordinates: ["some coordinates"],
    },
    [],
  ),
).be.true();
should(isPointStub.callCount).be.eql(1);
```

`["some coordinates"]` is not a coordinate pair, and the shape validates
because the predicate was replaced by one that answers `true`. What the test
established is that validating a point **calls `isPoint` once** — a fact about
the subject's internal wiring, and the only fact available once the predicate
is gone.

The predicates are pure functions of two numbers. Given real coordinates they
run for free, so the port replaces nothing: every case is a shape a user could
send, and each answer is what Elasticsearch would have accepted or refused.
Six of them moved to `geoShapeUtils.ts` — the same `export =` problem
[L6f](#what-l6f-found) found — and have [their own spec](../../tests/core/validation/types/geoShapeUtils.test.ts),
where `isLine` is tested by handing it points rather than by counting how often
it called a stub.

_Generalisable, and it is the other half of L6f's lesson:_ **a stub is only
worth its cost when the real thing is expensive or unavailable.** A pure
function of two numbers is neither, and replacing it converts a test about
behaviour into a test about call order. Sixty times.

### ⚠️ A whole branch was unreachable to the Mocha suite

A multi-shape — `multipoint`, `multilinestring`, `multipolygon` — reports a
**different message** from its single-shape sibling:

```
One of the shapes in  the shape type "multipoint" has bad coordinates.
```

double space included. No Mocha test ever produced it, because every
multi-shape case there had its predicate stubbed to answer `true`, so the
failure path could not be entered. Pinned as it ships, typo and all — a
porting slice does not change a user-visible string.

### What the Mocha suite never covered

- **The six orientations Elasticsearch accepts** (`right`, `ccw`,
  `counterclockwise`, `left`, `cw`, `clockwise`). One invalid value was
  tested; the list itself was not, and it is the kind of list a refactor drops
  an entry from.
- **A circle's radius as a number**, and as a distance with a space (`"10 km"`).
  Only `"10m"` through a stubbed `convertDistance` was exercised — and one
  Mocha test asserted `convertDistance` _returning a string_, which the real
  library cannot do.
- **`validate()` with no `shapeTypes` at all**: the option is optional, and an
  absent one means _no shape is allowed_, not _every shape_.
- **The boundaries of a point** — `[-180, -90]` and `[180, 90]` are valid,
  `[-190, 20]` and `[20, -100]` are not. The Mocha spec tested one side of
  each.
- **A polygon part that does not close on itself**, with real points: the
  closing rule was asserted through a stubbed `isPointEqual`.

## What L6f found

**`mocha` 133 → 80 tests and 4 → 2 spec _files_**, vitest **3 615 → 3 669**
across 150 files. 53 Mocha tests in, 54 out — and **L6's first `lib/` change**.

### The redesign, and why it is the only honest one here

`validation.ts` ends with `export = Validation`, which **cannot carry named
exports beside it**. So six functions the specs test by name — `checkAllowedProperties`,
`curateStructuredFields`, `getParent`, `storeErrorMessage`, `throwErrorMessage`,
`manageErrorMessage`, plus `getValidationConfiguration` and its helper — had no
address a test could use, and `rewire`'s `__get__` was not a shortcut but the
only door.

They now live in `lib/core/validation/validationUtils.ts` and are exported.
That is the change, and it is small: a move, an import, and two names dropped
from `validation.ts`'s import list. **The subject shrank by 250 lines and
nothing about its behaviour changed** — which is what makes the port's coverage
comparable to what it replaces.

_The generalisable part:_ **`export =` and a private helper are the two halves
of the same problem.** A module with a single default export has no place to
put anything else, so everything else becomes unreachable — and a spec that
needs it reaches through the compiled scope. Moving the helpers is not
"exporting internals for the tests": it is giving a unit an address.

### ⚠️ Seven tests asserted their own stub

```js
Validation.__set__(
  "manageErrorMessage",
  sinon.spy(function () {
    throw new Error(arguments[2]);
  }),
);

return should(validation.validate(request, verbose)).be.rejectedWith(
  "The document does not match validation filters.",
);
```

The message reaches the assertion **because the stub put it there**. The real
`manageErrorMessage` already throws a `BadRequestError` carrying that text, so
what the seven tests established was that the subject called the stub with the
string the test then read back — not that the API answers anything in
particular.

The port replaces nothing and asserts the error the subject produces, which
also pins its `id` (`validation.check.failed_document`,
`validation.check.failed_field`) — the part a client actually branches on, and
the part a stubbed helper can never report.

_And the verbose case is the same finding from the other side:_ one test
stubbed `manageErrorMessage` and asserted **the argument it received**, so the
verbose report — the object an API client reads — was never checked at all. The
port asserts the report.

### What the Mocha suite never covered

- **`checkAllowedProperties` against an array or `null`.** Both pass a naive
  `typeof === "object"` and neither is a specification; only the string case
  was tested.
- **A document-scope message being collected** rather than thrown —
  `manageErrorMessage`'s fourth branch.
- **A stored specification missing `index`, `collection` or `validation`.** The
  refusal names the collection it came from, and it is what stands between a
  malformed document in `%kuzzle/validations` and a silently wrong validator.
- **The difference the verbose flag makes to how much work is done**:
  fail-fast stops at the first invalid field, verbose checks them all. The two
  Mocha tests asserted the same return value and differed only in a call count
  nobody had named.

## What L6e found

**`mocha` 154 → 133 tests and 5 → 4 spec _files_**, vitest **3 591 → 3 615**
across 148 files. 21 Mocha tests in, 24 out, and `test/mocks/mutex.mock.js`
with them — this spec was its last caller.

### ⚠️ The spec rewired the compiler's variable names

```js
Kuzzle.__with__({
  koncorde_1: { Koncorde },
  vault_1: { default: { load: () => {} } },
});
```

`koncorde_1` and `vault_1` are **the names `tsc` emits** for
`import { Koncorde } from "koncorde"` and `import vault from "./vault"`. Nothing
in `lib/` is spelled that way; the spec addressed the _compiled output_, which
is the plainest statement in this whole step of why the Mocha suite has to run
out of `dist/test` at all — and [L7](#slices) deletes `build:tests` for exactly
that reason.

`vi.mock("koncorde")` names the dependency instead. **This is the one place in
L6 where the port is not just equivalent but simpler**: a module id a reader can
grep for, replacing a variable name that only exists after compilation and that
a rename in `lib/` would have silently broken.

_Generalisable:_ `rewire` cannot tell a module's _dependencies_ from its
_locals_ — both are bindings in the compiled scope. `vi.mock` only offers the
former, and the former is what a test should be replacing.

### ⚠️ `calledWith` matched a prefix again — twice more

[L6d](#what-l6d-found) found the first (`core:overload`'s percentage). Two more
here:

- `should(kuzzle.entryPoint.dispatch).calledWith("shutdown")` — the subject
  dispatches `("shutdown", {})`, and the payload reached no assertion.
- The start-order test asserted `kuzzle.ask.withArgs("core:security:verify")`
  and friends through `sinon.assert.callOrder`, which says _these happened in
  this relative order_ and nothing about what happened between them.

The port replaces the ordering assertion with **the sequence itself** — a list
of sixteen strings the fixture appends to as the subject initialises. It says
what `callOrder` said, plus what it could not: that nothing else happened, and
that nothing happened twice.

### `global.kuzzle`'s write-once setter, stated where it bites

`lib/kuzzle/kuzzle.ts` installs `global.kuzzle` as an accessor whose setter
throws on the second write, so a spec cannot build two instances — and three
tests here need to. The Mocha spec handled it inside a helper called
`_mockKuzzle`, with `Reflect.deleteProperty(global, "kuzzle")` as its first
line and no explanation: **deleting the property removes the accessor**, so the
constructor's `global.kuzzle = this` becomes a plain assignment. The port keeps
the trick and says why, which is the same finding [L4a](#what-l4a-found) filed
for `global.app`.

### What the Mocha suite never covered

- **The cluster being initialised when it _is_ enabled.** One test asserted the
  disabled half and nothing asserted the other, so a subject that never
  initialised the cluster would have passed.
- **What `vault.load` is called with** — the vault key and secrets file come
  from the start options, and a subject ignoring them would have passed.
- **`dump()`'s argument.** The suffix is what names the dump directory;
  `calledOnce()` was the whole assertion.
- **`start()`'s options reaching what consumes them**: `installations` to
  `install`, `support` to `loadInitialState`, the application to the plugins
  manager.

## What L6d found

**`mocha` 182 → 154 tests and 6 → 5 spec _files_**, vitest
**3 564 → 3 591** across 147 files. 27 Mocha tests in, 27 out — and this
one needed `rewire` for a single line.

### The whole `rewire` was one `instanceof`

```js
should(funnel.pendingRequestsById.get(request.internalId)).be.instanceOf(
  FunnelController.__get__("PendingRequest"),
);
```

`PendingRequest` is a three-field class declared beside `Funnel`: the request to
replay, the function that replays it, and the receiver to replay it on. The
port asserts those three, which is what the queue entry _is_ — no export, no
`lib/` change, and the class stays private because nothing outside the module
has a use for its identity.

_Worth stating because it is the cheap end of L6's spectrum:_ **a private
binding reached once, for an identity check, costs a `lib/` change only if the
test insists on identity.** Here the value's shape is the contract.

### ⚠️ `calledWith` matches a prefix, so the overload percentage was never asserted

```js
should(kuzzle.emit).be.calledOnce().be.calledWith("core:overload");
```

The subject emits `("core:overload", overloadPercentage)` — the number an
operator's alerting reads. `sinon`'s `calledWith` succeeds on a **prefix** of
the call, so three tests watched this event fire and none of them said anything
about what it reported. `toHaveBeenCalledWith` is exact, so the port had to
name the second argument to pass.

_This is a different shape from the vacuous assertions found so far_ — the
assertion does hold something, it just holds less than it reads as. Every
`calledWith` in a ported spec is a place where trailing arguments went
unasserted, and the port is what surfaces them.

### ⚠️ `execute` answers its caller before it has finished

The callback runs from _inside_ the promise chain — `request:afterExecution` is
awaited around it — and the overload hook fires from a path with no callback at
all. A spec that tears its fixture down as soon as the callback has answered
therefore leaves the subject running against a `global.kuzzle` that is no
longer there, which surfaces as **an unhandled rejection attributed to whatever
test runs next**.

Mocha never showed this: its `KuzzleMock` is a fresh object per test but
`global.kuzzle` is never taken away, so the trailing work found a usable global
and failed silently. The vitest fixture puts the global back, which is what
made the trailing work visible at all. The port waits for the subject to be
done rather than for its answer — and the same is true of the replayer, a
background loop that reschedules itself with `setTimeout` for as long as
anything is queued.

_The generalisable part:_ **a fixture that restores what it replaced turns
"work that outlives its answer" into a test failure.** That is a property worth
having, and it means a port can inherit tests that were only ever passing
because nothing was watching after the assertion.

### What the Mocha suite never covered

- **`execute`'s return code.** It answers `1` for a refusal, `0` for a request
  that is being processed and `-1` for one that was queued — the caller's whole
  view of what happened — and exactly one of 27 tests asserted it. Every test
  in the port does.
- **The request the `request:beforeExecution` pipe answers.** The pipe may hand
  back a _different_ request, and that one is what `checkRights` and
  `processRequest` receive; the Mocha spec stubbed the pipe to echo its payload
  and never varied it, so the subject could have used either and passed.
- **`log:error` on a discarded request.** A full buffer is an operational
  event and that emit is the only place it is reported.
- **An origin check that does not happen.** A request with no `origin` header
  must not reach `_isOriginAuthorized` at all — the Mocha spec asserted the
  outcome, not the absence of the call.

## What L6c found

**`mocha` 186 → 182 tests and 7 → 6 spec _files_**, vitest
**3 558 → 3 564**. Seventy lines of spec, four Mocha tests in, six out —
and **the last `import … = require()` in `lib/` with them**.

### The spec was holding a `lib/` shape hostage, and the register had said so

[TD-49](../type-debt-register.md#td-49) replaced 24 of the 25
`import x = require()` forms in `lib/` a year's worth of steps ago. The
twenty-fifth stayed, with a comment naming the reason:

```ts
/*
 * The one `import … = require()` left in `lib/` … `test/util/didYouMean.test.js`
 * rewires this module and calls `__set__("didYouMean", …)`, which addresses the
 * compiled variable by name. A default import compiles to `didyoumean_1.default`
 * and the stub would silently miss. It goes when that spec moves to vitest.
 */
```

That is `rewire`'s cost stated exactly: **a test reaching a private binding
pins the shape of the compiled output**, so the subject cannot be written the
way the other 24 are. `vi.mock("didyoumean")` replaces the _module_ instead of
the compiled variable, the wrapper takes a default import like everything else,
and **`lib/` now holds no `import … = require()` at all**.

_Generalisable, and it is the argument for L6 as a whole:_ what a `rewire` spec
costs is not the porting effort — this one is seventy lines — it is the
constraint it leaves on `lib/` for as long as it exists. The register is what
made that cost visible; without the entry, the comment would read like a
preference.

### ⚠️ One of its two `__set__`s did nothing, and the other one had a side effect

```js
processStub = Object.assign(process, {
  env: Object.assign(process.env, { NODE_ENV: "development" }),
});
didYouMean.__set__("process", processStub);
```

`Object.assign(process, …)` mutates `process` and answers it, so the `__set__`
assigns the real `process` over itself: a no-op. What the line _did_ do is set
`process.env.NODE_ENV` to `"development"` **for the rest of the Mocha run**,
since `Object.assign(process.env, …)` writes through to the real environment —
a spec leaving a global behind for whatever ran next, which is the same failure
mode [L1b4](#what-l1b4-found--and-l1b-is-closed) found here from the other side
(these tests passed only because `deprecate.test.js` had set `global.NODE_ENV`
earlier in the same process).

And the subject reads **`global.NODE_ENV`**, not `process.env.NODE_ENV`. So the
one `__set__` that was not a no-op was writing to a place the subject never
reads.

### What the Mocha suite never covered

- **That the library is not called at all outside development.** The guard's
  purpose is to skip the work, not just the string; the Mocha spec asserted the
  empty answer only.
- **`NODE_ENV` unset**, which is every process that does not set it.
- **An empty suggestion** — `didyoumean` answers `""` for an empty candidate
  list, and the wrapper's falsy check is what stops `Did you mean ""?` from
  reaching a user.

## What L6b found

**`mocha` 209 → 186 tests and 9 → 7 spec _files_**, vitest
**3 512 → 3 558** across 145 files. Two specs out, 23 Mocha tests in,
**46 vitest tests out**, and `test/mocks/fs.mock.js` with them — these two were
its only callers.

Both specs were the other half of [L6a](#what-l6a-found)'s finding: `rewire`
used as `require`, and here **redundantly twice over** — the line above it is
already `mockrequire.reRequire(<same path>)`, which returns the reloaded module
the `rewire` then loads again.

### ⚠️ `loadFromDirectory` was tested with the filesystem taken away

The method's entire job is to read a plugin off disk: it `require`s the plugin
directory, its `manifest.json` (through `AbstractManifest`) and its
`package.json`, at three paths known only at runtime. The Mocha spec replaced
`fs` and all three module ids with `mock-require`, so what ran was never a
plugin being loaded — it was a set of stubs answering each other.

`vi.mock` cannot substitute a runtime `require(path)` anyway, and **it does not
have to: runtime `require` works under vitest.** The port hands the subject
real directories — `tests/fixtures/plugins/{lambda-core,with-errors,invalid-errors,no-manifest,not-a-plugin}`,
each an actual `index.cjs` + `manifest.json` + `package.json` — and asserts
what came back. The subject runs unmodified, and the five refusals
(`cannot_load` for a non-directory, `manifest.cannot_load`, `invalid_errors`,
`init_not_found`, `runtime.unexpected_error`) are each a directory on disk
rather than a `mockrequire.stop()` in the middle of a test.

_Generalisable, and it revises a premise:_ `mock-require` is not always
replaced by `vi.mock`. **When a subject reads the real world, the honest port
gives it a real one** — a fixture directory is smaller, more readable and
strictly more truthful than four module substitutions, and it is available
because [L4](#how-l4s-34-are-cut-by-subject--measured-on-2-dev-2026-09-22-d377ec6fd)'s
constraint is about the _module graph_, not about `fs`.

### ⚠️ `dump()` never gives its lock back — [TD-81](../type-debt-register.md#td-81)

Found by calling `dump()` twice in one test. The lock is taken **before** the
argument is validated and released only on the success path:

```ts
this._dump = true;               // taken here
if (!suffixRegex.test(suffix)) {
  throw new BadRequestError(…);  // and never given back
}
…
this._dump = false;              // the only release
```

So one malformed `admin:dump` — a bad suffix, a dump path outside the
configured directory, an unwritable folder — disables dumping **for the
lifetime of the process**, and every later call is answered
`Cannot execute action "dump": already executing.` about a dump that is not
running. Reachable from the API, process-wide, and it misreports the state to
the operator at the moment they most need the tool. Pinned in a test that names
the entry; the fix is a `try/finally` in `lib/`, which a porting slice does not
do.

### ⚠️ Two tests asserted a method the subject has never called

```js
should(fsStub.removeSync).not.be.called();
```

`removeSync` is `fs-extra`'s. The subject removes directories with `fs.rmSync`
and core files with `fs.unlinkSync`. Both _"should do nothing if…"_ tests
therefore asserted that something which cannot happen did not happen —
**the negative form of the vacuous assertion**, and it is worth naming apart
from the positive one: a negative assertion on the wrong name is invisible
even to a reader who checks that the method exists somewhere, because the
whole point of the line is that it was not called.

### ⚠️ `plugins.json` was asserted against the wrong object

The subject dumps `pluginsManager.getPluginsDescription()`. The Mocha spec set
`pluginsManager.plugins` **and** `getPluginsDescription()` to the same `{foo:{}}`
and asserted on `plugins` — so a subject dumping the other one, or the raw
plugin objects rather than their description, would have passed. The port gives
the two different values.

### What the Mocha suite never covered

- **Both halves of privileged mode's handshake.** It takes two
  acknowledgements — the manifest's and the operator's configuration — and the
  subject refuses each one alone (`privileged_not_supported`,
  `privileged_not_set`). Only the agreeing case was tested.
- **The configuration being copied rather than aliased**: a plugin that mutates
  its own config must not reach into `kuzzle.config`.
- **The kebab-case deprecation warning**, and `deprecationWarning: false`
  silencing it — the only notice a plugin author gets about a name Kuzzle will
  refuse in a future version.
- **`info()` for a plugin that registers nothing**: it feeds `server:info`, and
  the empty shape is what an operator reads.
- **`Plugin.checkName`**, five rows.
- **The configured `dump.gcore` command** — the Mocha spec only ever saw the
  `"gcore"` default.
- **A dump with no core file produced**: the subject warns instead, and nothing
  asserted the empty half of that branch.
- **The lock being released after a successful dump** — the other side of
  TD-81, and what makes a second dump possible at all.

## What L6a found

**`mocha` 256 → 209 tests and 12 → 9 spec _files_**, vitest
**3 441 → 3 512** across 143 files. Three specs out, 47 Mocha tests in,
**71 vitest tests out** — and `test/mocks/service/` with them: the two Redis
client mocks were this spec's alone, so the directory the Elasticsearch twins
emptied at [L5e](#what-l5e-found) is now gone.

**The whole remaining Mocha suite is L6.** Nine files, and every one of them
reaches a private binding.

### `rewire` was decoration in all three

None of the three ever called `__set__`, `__get__` or `__with__`. Removing
`rewire(…)` in favour of an import changes nothing about what they assert —
which is the whole of the porting cost these three were budgeted for.

### ⚠️ `#refresh` asserted an event the controller does not emit

```js
should(kuzzle.ask).calledWith(
  "core:storage:private:collection:refresh",
  kuzzle.internalIndex.index,
  collection,
);
```

The subject calls `global.kuzzle.internalIndex.refreshCollection(collection)`.
That event is what the real `Store` wrapper emits one layer below, and the
assertion held only because `KuzzleMock.internalIndex` **extends the real
`InternalIndexHandler`** — so the spec was asserting the internals of a
collaborator it had not stubbed. Replace that collaborator with a `vi.fn` and
the assertion has nothing to stand on; assert the call the controller makes and
it does.

_The general form:_ a mock that inherits from the real thing lets a spec assert
through it. What the assertion then pins is the pair, and the spec is silent
about which half changed.

### ⚠️ The fifth argument of `validate` is the create/update distinction, and nothing asserted it

`createCredentials` and `updateCredentials` both call a strategy's `validate`
hook; the only thing that tells the plugin which one it is, is the fifth
argument — `false` for a creation, `true` for an update. The Mocha spec
asserted `args[0]` through `args[3]` of both calls in both actions, so **the two
tests were, assertion for assertion, the same test**, and the boolean they
existed to distinguish was in neither. The port asserts the whole call.

### ⚠️ `new Redis(config)` — one argument where the signature takes two

The constructor is `(config, name)`, and `name` is what the adapter calls
itself to the server:

```ts
await client.client("SETNAME", `${this.adapterName}/${global.kuzzle.id}`);
```

Every client the Mocha spec built was therefore named `undefined/undefined`,
and that line was asserted nowhere. TypeScript refuses the call outright —
the same way [L4e6](#what-l4e6-found) found `use()` being called with the wrong
arity, and the fourth time in this step that the port's compiler has found what
the port's assertions were not looking at.

### ⚠️ The Redis spec never had a cluster, so half of `searchKeys` never ran

The spec stubbed `Redis.prototype._buildClient` and `_buildClusterClient` — the
subject's two `private` factories — so the client under test was a stand-in the
subject never builds. `searchKeys()` splits on `client instanceof Cluster`, and
a stand-in that is not one **cannot enter the cluster branch**: the scan of
every master and the merge of their keys were dead code to this suite, while
`_buildClusterClient` being _called_ was asserted four times.

Mocking `ioredis` instead of the factories (`tests/mocks/redis.ts`) means the
subject builds its client exactly as it does in production, `instanceof`
answers what it answers there, and the branch is now covered. The fixture also
had `exec()` answering synchronously, where ioredis answers a promise.

_This is the L6 thesis in its cheapest form:_ **a spec that replaces the
subject's own internals tests the replacement.** Here the fix is to substitute
one layer lower — the module the subject imports — and nothing about the
subject has to change. `geoShape` and `validation` ([L6f](#slices),
[L6g](#slices)) are the same question with no layer below to move to.

### What the Mocha suite never covered

- **An unregistered strategy**, on all nine credentials actions. Every Mocha
  test registered exactly the strategy it then asked for, so
  `assertIsStrategyRegistered` — the guard between an API call and an unknown
  plugin — was asserted nowhere. One row per action now.
- **`validateCredentials` without an `_id`**: the only credentials action whose
  id is optional (`getId({ ifMissing: "ignore" })`), because it validates a
  payload for a user who may not exist yet.
- **`searchUsersByCredentials`'s pagination** — the second argument to the
  plugin's `search`, which a plugin that ignores it answers the whole
  collection for.
- **`_mDelete`'s log line past a thousand ids**, a branch that writes a
  different message: the audit trail of a bulk security deletion.
- **`store` answering `false`** — `SET … NX` on an existing key answers `null`,
  and the method's return value is the whole point of the `onlyIfNew` option.
- **A failed keep-alive ping**, which runs from a `setInterval` where nothing
  would catch a rejection, and **no keep-alive at all** when the delay is 0.
- **A command issued while disconnected** (`services.cache.not_connected`), and
  **`exec()` on a command the client does not have** — the two guards
  `setCommands()` and `exec()` exist for.
- **The DNS override actually answering**: the AWS ElastiCache workaround was
  asserted as "is a function".

## What L5e found

**`mocha` 376 → 256 tests and 14 → 12 spec _files_** — the first time the file
ratchet has moved since L4 — vitest **3 333 → 3 441** across 140 files. Ten
blocks, **120 `it`s across the two twins in, 108 cases per version out**, and
then `test/service/storage/elasticsearch-{7,8}.test.js` **deleted**, along with
`test/mocks/service/elasticsearchClient.mock.js`, whose last caller they were.

12 431 lines gone, and not one of them on trust: every sub-slice removed what
it had ported in the PR that ported it, so the last commit deletes two files
that hold nothing any suite was still asserting.

### Two ES 8 call sites never moved their payload to the root

[L5d](#what-l5d-found) found `updateSettings` still wrapping its payload in
`body` where every other ES 8 call site had moved it to the root. L5e found the
second and last one: **`generateMissingAliases`**, whose `updateAliases`
request is `{ body: { actions: [...] } }` on both versions. Both are asserted
literally rather than through the envelope — which is the honest form, since
the envelope describes what the subjects do agree on.

### `mCreate` never sends the id it was given

A document handed to `mCreate` with an `_id` is checked for existence under
that id — and then written with **no id at all**, so Elasticsearch allocates a
new one. The check decides _whether_ to write, not _where_. Both twins asserted
the bulk operations with `calledWithMatch`, under which a missing `_id` is
indistinguishable from one that matches; asserting the whole operation is what
states it.

### The `m*` family stamps three different ways, and one action stamps twice

| Action                                    | `_kuzzle_info` written                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `mCreate`, `mCreateOrReplace`, `mReplace` | the creation half, with `updatedAt`/`updater` explicitly `null`                          |
| `mUpdate`                                 | the update half only                                                                     |
| `mUpsert`                                 | **both, in one operation** — the update half onto `doc`, the creation half onto `upsert` |

The same split [L5b](#the-stamp-is-split-three-ways-and-now-each-is-stated)
found on the single-document actions, which is the point: the `m*` family is
the same behaviour in bulk, and now says so in the same words.

### `mDelete` reads the collection twice, and the answer comes from the second read

`mDelete` calls `mGet` to find out which ids exist, then `deleteByQuery`, whose
own fetch is what fills the `documents` it answers. The subject's own `@todo`
says as much. The twins armed both halves with the same two documents and
asserted the result with `should().match()`, which passes a **shorter** array
against a longer one — so the case that was supposed to show one document
deleted out of two would have passed either way. The port arms the two reads
separately and asserts with `toEqual`.

### An indice name is truncated by exactly the suffix it makes room for

`_getAvailableIndice` caps a name at 255 **bytes**, and when it has to add a
numeric suffix it truncates the collection half by exactly that suffix's
length — no more. The twins asserted it and it is worth keeping in words,
because "truncate to fit" and "truncate by the suffix" differ by however many
digits the suffix happens to have.

### The two scopes are one character, asserted in pairs

Everything in `Collection emulation utils` is the same translation twice:
`&index.collection` for the public store, `%index.collection` for the private
one, each behind an `@`-prefixed alias. The port keeps the twins' shape of
driving a public and a private client in the same case, because that pairing
**is** the assertion — a case that drove one would state the naming without
stating the scope.

## What L5d found

**`mocha` 480 → 376 tests**, vitest **3 233 → 3 333** across 140 files. Eleven
blocks, **52 `it`s per twin in, 100 cases per version out**. The whole Mocha
suite was run after the deletion: **−104 exactly**, nothing else leaning.

The largest sub-slice by line count and the plainest by content: **every
divergence in it was already in the envelope table**, bar one. Which is the
result — [L5a](#what-l5a-found) built that table from 16 small blocks, and
1 600 lines of index and collection lifecycle needed one new row.

### The one new row: a single node asks for a different shard count

`_getWaitForActiveShards` differs between the twins in its last line and
nowhere else: one node answers `"1"` in ES 7 and `1` in ES 8. The twins hid it
by stubbing the method; the port arms `cat.nodes` instead and lets the real one
run, so the cases state the rule — one node, one shard; more than one, `all` —
rather than restating a stub.

### ⚠️ `updateSettings` is the one ES 8 call site that still wraps its payload

```ts
await this._client.indices.putSettings({ ...esRequest, body: settings });
```

Every other ES 8 call moved its payload to the root of the request; this one
did not, and the ES 8 twin asserted `body:` right along with it. The port
therefore asserts `body` **on both versions**, deliberately not through the
envelope: routing it through `request()` would have made the case pass while
asserting something the ES 8 subject does not do.

### `updateSettings` closes the index every time, and the twins' name said otherwise

> _"should close then open the index when changing the analyzers"_

The subject never looks at what changed: it closes, writes, and reopens in a
`finally`, for any settings at all. The name reads as a condition that does not
exist. Renamed, and the `finally` — which neither twin covered — now has its
own case: **a failed write still reopens the index**.

### `truncateCollection` is a delete and a rebuild

There is no "delete every document" in Elasticsearch that is not a query, so
truncating means dropping the indice and creating it again — which is why the
mapping and the settings are read **first**, and why the mapping is read
`includeKuzzleMeta: true`: without it the rebuilt collection would silently
lose `_kuzzle_info`. The twins asserted `getMapping` was called with the index
and the collection, and left the third argument — the one that matters — out.

### What `createCollection` does that a reader would not guess

- **The merge with the common mapping is one-way.** A caller may _add_ fields;
  every field Kuzzle's own mapping declares wins. A `gordon` declared `text` by
  the common mapping and `keyword` by the caller comes out `text`.
- **Settings are completed field by field**, not all-or-nothing: a caller who
  gives `number_of_replicas` alone still gets the configured
  `number_of_shards`.
- **A race with another node is swallowed.** `hasCollection` says no,
  `indices.create` says `resource_already_exists_exception`, and the action
  answers `null` as if it had created it — because the caller asked for the
  collection to exist, and it does.
- **`_kuzzle_keep` is what makes an empty index exist**, and the first real
  collection deletes it, under a lock.

## What L5c found

**`mocha` 569 → 480 tests**, vitest **3 141 → 3 233** across 140 files. Nine
blocks — the eight planned actions plus the _second_ `_mExecute` — **44 `it`s
in the ES 7 twin and 45 in the ES 8 one, 92 cases per version out**. The whole
Mocha suite was run after the deletion: **−89 exactly**, nothing else leaning.

### `_mExecute` was declared twice in each twin, 2 400 lines apart

`#_mExecute` near the top and a bare `_mExecute` after `#mDelete`, each with
its own `beforeEach`, neither mentioning the other. Nine `it`s between them for
seven distinct behaviours, and they looked contradictory: the first says a
bulk answer row with no matching document is **skipped**, the second says an
errored row is **reported**. Both are true, of different rows — which only
reading them side by side shows. They are one group here.

The merge also states what neither twin did: the shape of a reported error
**depends on the status**. A 404 answers `{ document: { _id, body } }`; every
other status answers the document **whole**, `_source` and all. Two shapes
under one key, and the port's first attempt asserted the wrong one.

### ⚠️ The subject writes on both things the caller lends it

Two more instances of what [L5b](#three-actions-answer-the-document-they-sent-not-the-one-es-echoed)
found on `_kuzzle_info`, both surfaced by the port failing:

- **`partialErrors` is pushed onto, not copied.** `result.errors` **is** the
  array the caller handed in, now holding the subject's own findings. The
  port's first expectation read `[...partialErrors, found]` and failed with
  three entries against two.
- **`_extractMDocuments` rewrites each document in place** — `_source` out,
  `body` in — so a fixture declared once in a `describe` is a different object
  by the second case that uses it. The twins only ever handed it fresh
  literals, so neither could say so. The port's fixture is a factory, and says
  why.

**⚠️ Filed, not fixed** in both cases: this is a porting slice, and
[the DoD](#definition-of-done-per-pr) says `lib/` stays untouched.

### Both twins' `maxScrollDuration` case tested nothing

> `elasticsearch._config.maxScrollDuration = "21m";` (ES 7)
> `elasticsearch.client._config.maxScrollDuration = "21m";` (ES 8)

The subject reads `this.maxScrollDuration`, a number resolved **once in the
constructor** by `_loadMsConfig`. Assigning the config afterwards — on the
dispatcher in one twin, on the client in the other, neither of which is where
the value lives — changes nothing. Four cases (two per twin, `scroll` and
`search`) passed against the real default of `1m`, and would have passed with
the line deleted. It is deleted, and the configurability it meant to state is
now a case of its own: rebuild with `maxScrollDuration: "1h"` and watch the
same `42m` scroll get past the guard.

### `deleteFields` genuinely diverges, and only ES 8 had the case

ES 8 checks that the client's answer carries a `_source` and raises
`services.storage.not_found`; ES 7 walks into `_.has(undefined, field)` and
then assigns onto it, so its caller gets whatever `formatESError` makes of a
`TypeError`. This is the **only behaviour** divergence L5c found — everything
else is transport — which is why it is written as a branch on
`envelope.version` and not as an envelope entry.

### The envelope grew four rows, and one of them is not a payload shape

|                       | ES 7                             | ES 8                        |
| --------------------- | -------------------------------- | --------------------------- |
| bulk operations       | `body: [...]`                    | `operations: [...]`         |
| delete-by-query limit | `size`                           | `max_docs`                  |
| a query failure       | `{ shardId, reason }`            | `{ id, cause: { reason } }` |
| a scrolled batch      | a callback the client calls back | a promise                   |

The last is a **calling convention**: `mExecute` drives the ES 7 client
Node-style, handing `search` a callback it calls again for each page, while the
ES 8 subject awaits and loops. A case cannot arm one the way it arms the other,
so the arming is named in the table like every other delta (`answerScroll`).
The third is the one entry that changes what a _caller_ sees, not just what the
wire carries: the two subjects normalise a failed shard differently.

### The harness grew a cache bus

Everything in this slice carries a cursor, and the cursor lives in the internal
cache behind `global.kuzzle.ask`. The harness now stubs `ask` as a spy and
`hash` as the identity, so a case can both arm what a scroll remembers and
assert that the key a `store` wrote is the key the matching `del` deletes.

## What L5b found

**`mocha` 623 → 569 tests**, vitest **3 087 → 3 141** across 140 files. Eight
blocks, **27 `it`s per twin in, 27 cases per version out**. The whole Mocha
suite was run after the deletion: **−54 exactly**, nothing else leaning.

### The envelope needed one rename, and the rename is the finding

[L5a](#what-l5a-found)'s table called the request-nesting field `searchRequest`,
because `search` was the only case in sight. L5b found the same nesting on
`count`'s filter and on `update`/`upsert`'s `doc`/`upsert` pair, so it is the
general rule: **ES 7 nests a request payload under `body`, ES 8 puts it at the
root.** Renamed to `request`. Nothing else in the table moved across eight more
actions, which is the evidence the shape was right.

### ⚠️ Three actions answer the document they _sent_, not the one ES echoed

Every assertion in these eight blocks was `calledWithMatch` — partial, the
idiom [L3f](#calledwithmatch-is-partial-and-five-things-were-hiding-in-the-gap)
showed is where behaviour hides. Asserting the whole request and the whole
result showed it immediately:

```ts
return { _id: body._id, _source: esRequest.body, _version: body._version };
```

`create`, `createOrReplace` and `replace` answer **`esRequest.body`** — the
document that went out, `_kuzzle_info` included. The caller therefore receives
metadata Elasticsearch never returned, and would receive the _stale_ body if a
mapping or an ingest pipeline had changed it. Under `.match()` the extra key
was invisible; under `toEqual` the port has to name all four stamp fields,
which is now what it does.

**⚠️ Filed, not fixed** (this is a porting slice, and [the DoD](#definition-of-done-per-pr)
says `lib/` stays untouched): `esRequest.body = content` followed by
`esRequest.body._kuzzle_info = …` writes the stamp **onto the caller's own
object**. A caller's document comes back mutated, and nothing in either suite
said so.

### `#replace`'s failure case was named the opposite of what it does

> _"should throw a NotFoundError Exception if document already exists"_

It arms `exists → false` and asserts `services.storage.not_found`. `replace`
refuses to **create**: it checks existence first and never reaches
`client.index`. The name says the reverse, in both twins. Renamed, and the
"never reached the client" half — which the Mocha version did assert — kept.

### `id: undefined` is on the wire, and a negative said otherwise

`create` with no id builds its request with `id` in the object literal either
way, so the key **is** sent, holding `undefined`, and the client drops it. The
port's first attempt asserted `not.toHaveProperty("id")` and failed. Small, but
it is the third time in this step that writing an assertion in a language that
checks it has corrected the author's model of the subject.

### The stamp is split three ways, and now each is stated

| Action                       | `_kuzzle_info` written                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `create`                     | `author` + `createdAt`, with `updatedAt`/`updater` explicitly `null`                           |
| `update`                     | `updatedAt` + `updater` only                                                                   |
| `createOrReplace`, `replace` | **both halves at once**                                                                        |
| `upsert`                     | updater half onto `doc`, author half onto `upsert` — two different destinations in one request |

`upsert`'s `defaultValues` go to the `upsert` branch **only**, which is the one
thing about that action a reader cannot guess: they describe a document that
does not exist yet, so they must not reach the partial update applied to one
that does.

## What L5a found

**`mocha` 701 → 623 tests** (the two twins shrink; the ratchet's file count
stays 14 until L5e), vitest **2 943 → 3 087 tests** across **138 → 140 files**.
Sixteen blocks, **39 `it`s per twin in, 72 tests per version out**.

The whole Mocha suite was run before and after: **701 → 623 is exactly −78**,
so nothing else was leaning on what these blocks left behind — the check
[L1b4](#the-finding-that-matters-most-a-spec-was-passing-because-of-another-file)
made mandatory, paying nothing this time.

### The shape holds, and the envelope is one line per case

Eleven of the sixteen blocks are byte-identical between the twins, which is why
they went first: if shared cases plus a wire table cannot express the blocks
that already agree, the plan for the other 38 is wrong. They can. The five that
differ — `#stats`, `#listCollections`, `#listIndexes`, `#listAliases`,
`#deleteIndexes`, `#getSchema` — differ in exactly one thing,
`harness.envelope.respond(payload)`, and nothing else in the case body changes.

### ⚠️ `#init` asserted three things and all three were vacuous

```js
should(elasticsearch.client._client).not.be.null();
should(elasticsearch.client._esWrapper).not.be.null();
should(elasticsearch.client.esVersion).not.be.null();
```

The first two hold **because the fixture assigned them**, not because `init()`
did: `_initSequence`'s first line is `if (this._client) { return; }`, and
presetting `_client` is the only way a spec gets a stub in at all — the real
sequence builds an `@elastic/elasticsearch` `Client` and waits for a live
cluster.

The third reads a property **that does not exist**. The field is `_esVersion`;
`esVersion` is `undefined`, and `undefined` is not `null`, so the assertion
passed. **Had it been spelled right it would have failed** — `_esVersion` is
`null` from the constructor and the early return never overwrites it. _A typo
is what kept this test green_, in both twins, for the whole life of the file.

The port states what `init()` does under this fixture: nothing, idempotently.
One test, where three were worth none.

### Two more dead or misdirected cases

- **`#deleteIndexes`' failure case called `listIndexes()`**, not
  `deleteIndexes()` — a copy-paste from the block above, in both twins, so
  `#deleteIndexes` had no failure path of its own. It passes when pointed at
  the right subject, because both read the same `cat.aliases`.
- **`#deleteCollection`'s second case asserted a strict subset of its first**
  and its name — _"should create the hidden collection if the index is empty"_ —
  described a condition it never set up. Merged into one case that states both
  halves: the indice goes, and the hidden collection keeps the index alive.

### The ES client mock is a proxy, not a declaration list

`test/mocks/service/elasticsearchClient.mock.js` declares ~40 stubs by hand, so
a spec that exercises a call the mock never heard of fails on `undefined is not
a function` rather than on its own assertion. `tests/mocks/elasticsearchClient.ts`
auto-vivifies a memoised `vi.fn` per name instead — [L1b3](#three-mocks-retired-one-fixture-relocated)'s
`stubRedis()` move, at the scale that needs it. **Nothing is pre-armed**,
including `info()` and `cluster.health()`: `_initSequence` returns early, so
arming them would be fixture no test reaches.

### Where the real config is the right fixture, again

`ES7`'s constructor runs `_loadMsConfig`, which _asserts_ that
`maxScrollDuration` and `defaults.scrollTTL` are present and parseable. So the
harness clones `loadConfig()` and writes `majorVersion` on the copy — L3d's
[route-table precedent](#where-the-real-config-is-the-right-fixture): when the
real config is what the subject reads, a fixture would be testing the
invention.

### TD-57 paid for itself again

Six `should(promise).be.rejected()` — that it rejects, not with what — became
`rejects.toThrow()` with no matcher, and [TD-57](../type-debt-register.md#td-57)'s
rule refused them. Every one is now `rejects.toBe(harness.esClientError)`: the
subject re-throws `_esWrapper.formatESError(error)` untouched, so the identity
is assertable and the `formatESError` spy states the route rather than standing
in for the result. _Third slice in a row that gate has caught something._

## L4 is closed

**34 specs, 14 128 lines, `mocha` 50 → 14, vitest 1 911 → 2 943 tests.**
Thirteen PRs, a–e.

Its premise — _"`vi.mock` is hoisted and static where `mock-require` is
dynamic"_ — turned out to be the wrong question in **every** sub-slice. What
the `beforeEach` + `reRequire` pairs were actually holding up, in order:
`global.app`'s write-once singleton ([L4a](#what-l4a-found)), one `pino` stub
plus a key ([L4b1](#what-l4b1-found)), three tests out of 79 that genuinely
need `vi.doMock` ([L4b3](#what-l4b3-found), [L4b4](#what-l4b4-found--and-l4b-is-closed)),
a cached mock factory ([L4c1](#what-l4c1-found)), a mutex the **base class**
takes ([L4e4](#what-l4e4-found)) — and, four times, nothing at all
([L4d1](#what-l4d1-found), [L4d2](#what-l4d2-found), [L4d4](#what-l4d4-found),
[L4e3](#what-l4e3-found)).

**The lesson, stated once: ask what a `reRequire` is resetting, not what the
`mockrequire` is replacing.** Three of the sweep's "pairs that must land
together" dissolved on that question, and three specs turned out to be
[already ported](#what-l4e2-found).

**Next: L5** (the two Elasticsearch twins, 2 specs / 12 431 lines) —
[cut into a–e](#how-l5s-2-are-cut-by-action-group--measured-on-2-dev-2026-09-23-623676e7f),
**L5 is closed**, and **L6 is closed**: twelve specs, eight sub-slices,
[cut a–h](#how-l6s-12-are-cut--measured-on-this-branch-2026-09-23-20052a2b3) —
**five of the twelve were ports, not redesigns**, `rewire` was irreplaceable
exactly once ([L6h](#what-l6h-found--and-l6-is-closed)), and **the `mocha`
ratchet reads 0**. What is left is **L7** (closure).
