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

**Six lib files already have a spec in BOTH runners, and three of those ports are unfinished:**

| Spec                                           | Mocha lines | vitest lines |
| ---------------------------------------------- | ----------: | -----------: |
| `core/storage/clientAdapter.test`              |   **1 903** |      **948** |
| `api/controllers/memoryStorageController.test` |   **1 424** |      **225** |
| `util/stacktrace.test`                         |          58 |           39 |
| `core/shared/abstractManifest.test`            |         130 |          159 |
| `core/shared/sdk/impersonatedSdk.test`         |         106 |          130 |
| `core/storage/storageEngine.test`              |          59 |          107 |

The bottom three grew in the port, which is what a finished port looks like. The top three did not: `memoryStorageController` is at **16%** of its Mocha spec and `clientAdapter` at **50%**. **Deleting those Mocha files today would lose real coverage**, and the `mocha` ratchet would read it as progress — it counts files, not tests. `prepare-coverage.ts` is what has kept this honest so far — it never hands a file over to the runner that measures it worse ([ADR § Coverage measurement](../ADR-0001-migration-typescript.md#cold-start)) — but that is a coverage gate, not a permission to delete. **Finishing these three is L0**, and they are the measure of what a "port" costs when nobody is counting.

**52 of the 148 specs do not mirror a `lib/` file**, e.g. `test/api/funnel/execute.test.js`, `test/api/funnel/checkRights.test.js` and four more that between them cover one file, or `test/kerror/codes.test.js` which covers a directory. The `tests/` mirror convention is what `prepare-coverage.ts` uses to assign a file its owning runner, so **for a third of the suite the convention cannot answer who owns what**. Decide the target layout for those 52 before porting them, not during: a per-file mirror means merging six funnel specs into one, and that is a judgement about test organisation, not a translation.

## Slices

Ordered so each is independently mergeable, the ratchet moves in every one of them, and the deletions are last.

| #      | Content                                                                                                                                                                                                                                                                                                              |  Specs |      Lines | Why this grouping                                                                                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0** | **Finish the three half-ported specs** (`clientAdapter`, `memoryStorageController`, `stacktrace`) and delete their Mocha originals                                                                                                                                                                                   |  **3** |  **3 385** | The only place the ratchet can be moved by _deleting_ rather than porting — and the only place it can be moved dishonestly. Doing it first sets the standard the rest is measured against. Two of the three also carry `mock-require`.                                                                                                |
| **L1** | **The codemod, proven on the small clean specs**: `should` → `expect`, `sinon` → `vi`, on the ≤ 200-line specs using neither `mock-require` nor `rewire`                                                                                                                                                             | **60** |  **5 773** | 41% of the files for 9% of the lines. It is where the codemod gets written and proven, and it shrinks the remaining file list to the specs that need thought.                                                                                                                                                                         |
| **L2** | The clean specs at **201–1 000 lines**, by layer                                                                                                                                                                                                                                                                     | **29** | **12 995** | Same transformation at a size where review still fits in one sitting.                                                                                                                                                                                                                                                                 |
| **L3** | The **six clean specs over 1 000 lines** — `documentController` 2 143, `authController` 1 836, `documentExtractor` 1 484, `securityController/users` 1 390, `request` 1 378, `roleRepository` 1 046                                                                                                                  |  **6** |  **9 277** | Still only the codemod, but each one is a PR's worth of review on its own, and five of the six are `api`. After L3 the suite is **52 files and all of them are hard**.                                                                                                                                                                |
| **L4** | **`mock-require` → `vi.mock`**, excluding the Elasticsearch twins, `core` first                                                                                                                                                                                                                                      | **34** | **14 128** | One decision repeated 34 times: `vi.mock` is hoisted and static where `mock-require` is dynamic, so a spec that swaps a module _conditionally_ or inside a `beforeEach` needs restructuring, not translating. Its own slice because the answer generalises.                                                                           |
| **L5** | The **two Elasticsearch twins** (they carry `mock-require` too)                                                                                                                                                                                                                                                      |  **2** | **12 431** | 19% of the suite in two near-identical files, so the second is largely the first's diff — exactly K3's shape, and K3's cost is the estimate to use. Its own PR because its size dominates any review it shares.                                                                                                                       |
| **L6** | The **`rewire` specs**                                                                                                                                                                                                                                                                                               | **14** |  **6 306** | **Not ports — redesigns.** Each needs its subject to expose what is tested, or the test rewritten against the public surface. Expect `lib/` changes, expect the coverage gate to have opinions, one PR per subject rather than per spec.                                                                                              |
| **L7** | **Closure**: delete `.mocharc`, `mocha`, `should`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `@types/mocha`, the `test:unit:mocha*` scripts, `npm run build:tests`, the `mocha` ratchet and its baseline; shrink `tsconfig.tests.json` to the cucumber directories and clear its 65 own strict errors |      — |          — | Mechanical **and only correct when the ratchet is 0** — the same condition K6 had. ⚠️ **`build:tests` exists because `.mocharc` globs `dist/test/**`** ([step 12 K6](12-sprint-9-strict-flip.md#what-k6-found)); vitest runs from source, so this slice removes a build step, and the payload must be diffed exactly as K6 diffed it. |

The seven work slices partition the 148 specs and the 64 295 lines exactly: 3 + 60 + 29 + 6 + 34 + 2 + 14 = **148**, and 3 385 + 5 773 + 12 995 + 9 277 + 14 128 + 12 431 + 6 306 = **64 295**.

**Read L4, L5 and L6's line counts as the one thing they are not: a budget.** Their cost is not proportional to their size — that is the whole point of separating them from L1–L3 — and [step 12 K0](12-sprint-9-strict-flip.md#what-k0-found) is the precedent: its own estimate was low by a quarter because a per-class estimate under-counts whatever the class boundary cuts through. Re-measure before picking one up.

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this step adds:

- **The `mocha` ratchet moves, and its baseline moves with it, in the same PR.** A slice that ports without deleting is not done.
- **Report tests, not files.** The ratchet counts spec _files_, and the three half-ported specs above are the proof that a file count can fall while coverage does. Every PR states the test count before and after for what it touched, and the coverage report is the arbiter — not the file list.
- **A ported spec is not allowed to assert less than the one it replaces.** If it does, say so and say why in the PR body: an assertion dropped on purpose (it tested an implementation detail) is a finding worth having; one dropped by accident is the failure mode this whole step is exposed to.
- **A `rewire` spec that needs `lib/` to change gets its own PR**, with the `lib/` change reviewed as a `lib/` change.
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
