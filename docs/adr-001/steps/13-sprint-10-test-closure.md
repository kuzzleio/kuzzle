# Step 13 — Sprint 10: test closure (Mocha → vitest)

**Status:** 🟦 Open · **Opened:** 2026-09-21 · **PR(s):** — · ← [ADR-0001](../ADR-0001-migration-typescript.md)

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
| **L1b** ⬜ | **The specs built on `test/mocks/kuzzle.mock.js`** — one fixture derived per spec, never that mock                                                                                                                                                                                                                   | **30** |  **3 459** | Not a translation: the vitest tree refuses the ~600-line application stub on purpose, so each spec has to state what its subject actually reads from `global.kuzzle`. Found by L1; it had no slice before.                                                                                                                            |
| **L2**     | The clean specs at **201–1 000 lines**, by layer                                                                                                                                                                                                                                                                     | **29** | **12 995** | Same transformation at a size where review still fits in one sitting.                                                                                                                                                                                                                                                                 |
| **L3**     | The **six clean specs over 1 000 lines** — `documentController` 2 143, `authController` 1 836, `documentExtractor` 1 484, `securityController/users` 1 390, `request` 1 378, `roleRepository` 1 046                                                                                                                  |  **6** |  **9 277** | Still only the codemod, but each one is a PR's worth of review on its own, and five of the six are `api`. After L3 the suite is **52 files and all of them are hard**.                                                                                                                                                                |
| **L4**     | **`mock-require` → `vi.mock`**, excluding the Elasticsearch twins, `core` first                                                                                                                                                                                                                                      | **34** | **14 128** | One decision repeated 34 times: `vi.mock` is hoisted and static where `mock-require` is dynamic, so a spec that swaps a module _conditionally_ or inside a `beforeEach` needs restructuring, not translating. Its own slice because the answer generalises.                                                                           |
| **L5**     | The **two Elasticsearch twins** (they carry `mock-require` too)                                                                                                                                                                                                                                                      |  **2** | **12 431** | 19% of the suite in two near-identical files, so the second is largely the first's diff — exactly K3's shape, and K3's cost is the estimate to use. Its own PR because its size dominates any review it shares.                                                                                                                       |
| **L6**     | The **`rewire` specs**                                                                                                                                                                                                                                                                                               | **14** |  **6 306** | **Not ports — redesigns.** Each needs its subject to expose what is tested, or the test rewritten against the public surface. Expect `lib/` changes, expect the coverage gate to have opinions, one PR per subject rather than per spec.                                                                                              |
| **L7**     | **Closure**: delete `.mocharc`, `mocha`, `should`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`, the `test:unit:mocha*` scripts, `npm run build:tests`, the `mocha` ratchet and its baseline; shrink `tsconfig.tests.json` to the cucumber directories and clear its 65 own strict errors |      — |          — | Mechanical **and only correct when the ratchet is 0** — the same condition K6 had. ⚠️ **`build:tests` exists because `.mocharc` globs `dist/test/**`** ([step 12 K6](12-sprint-9-strict-flip.md#what-k6-found)); vitest runs from source, so this slice removes a build step, and the payload must be diffed exactly as K6 diffed it. |

The seven work slices partition the 148 specs and the 64 295 lines exactly: 3 + 60 + 29 + 6 + 34 + 2 + 14 = **148**, and 3 385 + 5 773 + 12 995 + 9 277 + 14 128 + 12 431 + 6 306 = **64 295**.

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
