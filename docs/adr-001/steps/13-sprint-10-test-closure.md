# Step 13 — Sprint 10: test closure (Mocha → vitest)

**Status:** 🟦 Open · **Opened:** 2026-09-21 · **PR(s):** L0 [#2805](https://github.com/kuzzleio/kuzzle/pull/2805) · L1 [#2806](https://github.com/kuzzleio/kuzzle/pull/2806) · L1b1 [#2807](https://github.com/kuzzleio/kuzzle/pull/2807) · L1b2 [#2808](https://github.com/kuzzleio/kuzzle/pull/2808) · L1b2b [#2809](https://github.com/kuzzleio/kuzzle/pull/2809) · L1b3 [#2811](https://github.com/kuzzleio/kuzzle/pull/2811) · L1b4 [#2812](https://github.com/kuzzleio/kuzzle/pull/2812) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

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
| **L2**     | The clean specs at **201–1 000 lines**, by layer                                                                                                                                                                                                                                                                     | **29** | **12 995** | Same transformation at a size where review still fits in one sitting.                                                                                                                                                                                                                                                                 |
| **L3**     | The **six clean specs over 1 000 lines** — `documentController` 2 143, `authController` 1 836, `documentExtractor` 1 484, `securityController/users` 1 390, `request` 1 378, `roleRepository` 1 046                                                                                                                  |  **6** |  **9 277** | Still only the codemod, but each one is a PR's worth of review on its own, and five of the six are `api`. After L3 the suite is **52 files and all of them are hard**.                                                                                                                                                                |
| **L4**     | **`mock-require` → `vi.mock`**, excluding the Elasticsearch twins, `core` first                                                                                                                                                                                                                                      | **34** | **14 128** | One decision repeated 34 times: `vi.mock` is hoisted and static where `mock-require` is dynamic, so a spec that swaps a module _conditionally_ or inside a `beforeEach` needs restructuring, not translating. Its own slice because the answer generalises.                                                                           |
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
