# Step 06 — Mid-course hardening (enforcement before `lib/core`)

**Status:** 🟦 In progress — F1, F2 and F3 done; closes once the three land
**Date:** 2026-09-09 → …
**PR(s):** F1 = [#2689](https://github.com/kuzzleio/kuzzle/pull/2689) (`chore/ts-migration-hardening-strict`) · F2 = `chore/ts-migration-hardening-coverage` (stacked on F1, closes [#2692](https://github.com/kuzzleio/kuzzle/issues/2692)) · F3 = `chore/ts-migration-hardening-tests` (stacked on F2)
**Issues opened by the review:** [#2690](https://github.com/kuzzleio/kuzzle/issues/2690) (TD-22) · [#2691](https://github.com/kuzzleio/kuzzle/issues/2691) (TD-23) · [#2692](https://github.com/kuzzleio/kuzzle/issues/2692) (TD-24)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Sprint 4 closed with `lib/api` at 100% TypeScript and every conversion PR green. A mid-course review of the **30 files converted so far** (sprints 1, 3 and 4) then measured what the enforcement machinery does *not* see. The findings are cheap to fix now and expensive to fix after `lib/core`, which is 50 files and far riskier than `lib/api`.

The rule this step follows: **a review finding must end up as a ratchet, as an entry in the adopted list, or as a GitHub issue — never as prose alone.** Prose is lost at the next cold start; CI is not.

### What the review found (2026-09-09)

The converted files are clean on the letter of the conversion standard — **0 explicit `any`, 0 `@ts-ignore`, 0 non-null assertions, 0 unused imports** across all 30, `tsc --noEmit` green, `eslint` 0 errors. The gaps are in what the machinery measures:

1. **The `any` ratchet only sees *written* `any`.** An un-annotated parameter costs it nothing, so a rename that types nothing scores a perfect zero. Measured: **520 `TS7xxx` implicit-any diagnostics** in `lib/` + `index.ts`, of which **87 sit in files already declared "converted"** — 54 in `memoryStorageController.ts` alone (which also produces 37 further `TS2339`/`TS2551` cascades, 91 diagnostics in total). The ratchet was also blind to `as unknown as`, the escape hatch a conversion naturally reaches for once `: any` is forbidden (8 lines repo-wide, 5 of them added by sprint 3/4 conversions).
2. **One un-annotated default parameter was costing 137 strict errors.** `NativeController.constructor(actions = [])` inferred `never[]`, so every `super(["import", "write", …])` in every native controller failed strict with `Type 'string' is not assignable to type 'never'`. The repo had **150** such diagnostics; **137 of them traced back to that single line** (the remaining 13 are unrelated `never` inferences, mostly in `service/storage/{7,8}/elasticsearch.ts`) — roughly 9% of the repo's strict total, from one missing annotation.
3. **The strict adopted list had drifted from the ADR's own policy** ("a file joins the list once it passes strict cleanly"). 46 files were adopted while **48 more already passed strict**, including 7 converted ones (`httpRoutes`, `rights`, `apiKey`, `esWrapper` 7/8, `assertType`, `deprecate`) — all free to regress silently.
4. **`strict-check.sh` matched adopted paths as an unanchored substring.** The bare `index.ts` entry therefore captured the errors of every `lib/**/index.ts`, so adopting the root barrel reported a false failure on `lib/config/index.ts`. A latent correctness bug in the ratchet itself.
5. **Coverage is voided for every converted file.** `sonar.coverage.exclusions=**/*.ts` (from #2658, predating this ADR) means each `.js` → `.ts` rename removes the file from SonarCloud's coverage measurement — the "Coverage on New Code" gate is vacuous on exactly the files a conversion touches. 30 files so far. Compounding it: only `test:unit:mocha:coverage` feeds the scanner, and mocha + vitest both write to `coverage/lcov.info`, so the vitest report would overwrite rather than add. → **PR F2**.
6. **The test axis has not moved, and no counter shows it.** `mocha = 151` unchanged since 2026-07-14; the branch's only vitest spec (`tests/util/distributedLock.test.ts`) came from unrelated PR #2664. 30 files converted, **0 tests written** — and 6 of the 12 converted `lib/util` files (`assertType`, `bytes`, `promback`, `safeObject`, `wildcard`, `debug`) have no dedicated unit spec at all. → **PR F3**. *(F2's measurement later qualified this: five of those six are covered incidentally by other specs — see "What was done (PR F2)". `wildcard.ts` is the one that is genuinely never loaded by the suite.)*
7. **The SonarCloud new-code gate makes conversion PRs violate this ADR's own rule** ("no behaviour change in a conversion PR — structural refactors stay separate"). PR E2's gate fix was **+230/−199 on `funnel.ts`**: three method extractions in the dispatch core, purely to clear S2004/S3776. The extractions were verified equivalent (see below), but the gate is effectively scheduling the repo's refactoring. → the rule is amended rather than quietly broken each sprint.
8. **`sonar.cpd.exclusions` is becoming permanent, untracked debt** — 5 files, one of them (`lib/api/httpRoutes.ts`) with no justifying comment, and the `documentController` / `memoryStorageController` dedups with no register entry and no issue. → **TD-23**.

**PR E2's `funnel.ts` extractions re-verified line by line against `master:lib/api/funnel.js`** (the review's one correctness spot-check, since it is the largest non-rename diff of the whole effort): `_dispatch(request, modifiedRequest, …)` is sound because `throttle` always invokes `fn` with the very request it was handed — directly (`fn.call(context, request)`) and when replayed (`pending.fn.call(pending.context, pending.request)`) — so the rate-limit branch still inspects the same object the original closure did; `_warnOverload`'s guard is the exact negation of the original condition; `_applyCookieAuthToken` is verbatim, double `cookieAuthentication` check included. **No behaviour change.**

## What was done (PR F1 — strict foundation)

- **`NativeController.constructor(actions: string[] = [])`** — the `never[]` inference above. `BaseController._addAction(name: string, fn: ControllerAction)` typed too, with a new exported `ControllerAction = (request: KuzzleRequest) => unknown` (`unknown` covers the async handlers: a `Promise<T>` is assignable to it, so no `any`). `this[name] = fn` is left as-is — the dynamic assignment is intrinsic to the plugin-controller design, and casting it would have bought a fresh `as unknown as` in exchange for a `TS7053`. Strict errors repo-wide: **1483 → 1344**.
- **`scripts/strict-check.sh`: anchor the adopted-path match** at the start of the line (finding 4). Without it a bare filename entry cross-matches every same-named file in the tree.
- **`.migration/strict-adopted.txt`: 46 → 94 files.** Every production file that passed `--candidates` on 2026-09-09 is adopted, so the ratchet guards the whole already-clean surface instead of a hand-picked subset. `--candidates` now returns **0**: from here, a file becoming strict-clean is the *only* way the list grows, which is what makes the reminder below meaningful.
- **4th ratchet: `implicit-any`** (`scripts/ratchet.sh implicit-any`, `npm run ratchet:implicit-any`, baseline **520**). It counts the `TS7xxx` diagnostics tsc reports over `lib/` + `index.ts` under `noImplicitAny` with strict off — a new `tsconfig.implicit.json` isolates that signal. This is the counter that makes "convert without typing" visible; the `any` ratchet cannot see it.
- **The `any` ratchet now also counts `as unknown as`.** Its baseline moves **200 → 208** — a *metric broadening, not a regression*: the same 8 lines were always there, they were simply outside the grep.
- **`.ci/scripts/pr-preflight.sh`: 3 → 5 checks.** Added (a) `npm run ratchet` + `npm run test:strict`, the pair that failed CI on PR E1 because of a leftover tracked `.js`, and (b) a **strict-adoption reminder** that warns when a changed `lib/**/*.ts` passes strict but is missing from the adopted list.
- **Conversion standard amended in the hub** (two changes): strict adoption of a converted file is part of a conversion PR's definition of done when the file is clean; and gate-driven, behaviour-preserving refactors are explicitly **in scope** for a conversion PR, under two conditions — extraction must be verbatim, and the step file must carry an equivalence note (finding 7).

### Deliberately not done in F1

- **`memoryStorageController.ts`'s 54 implicit-any sites** (+37 cascades; 122 strict errors — the worst file of the converted set). It is a real typing job on a 1020-LOC file with a `rewire`-driven spec — a PR of its own, not a rider. → **TD-22**.
- **`promback.ts`'s typing hole** (`resolve(result?: T)` passing `T | undefined` into `(result: T) => void`, plus 4 unchecked null invocations). It is the only converted util whose strict errors come from its own type design rather than an external constraint — and it has no spec, so it is fixed *under test* in F3, not before.
- **`didYouMean.ts` / `debug.ts`** are blocked from strict only by missing upstream declarations (`TS7016` on `didyoumean` and `debug`). Cheap, but a dependency change rather than a typing one — folded into F3.

## What was done (PR F2 — restore coverage)

The one item that changes the *nature* of the risk on sprints 5→7, hence its position before them. Tracked as [#2692](https://github.com/kuzzleio/kuzzle/issues/2692) (TD-24).

### The investigation: no remapping was needed

The open question was where the c8 lcov actually points, since Mocha runs the **compiled** `dist/**/*.test.js`. Measured by running `npm run build && npm run test:unit:mocha:coverage` in Docker and reading `coverage/lcov.info`: **c8 applies the source maps `tsc` emits** (`sourceMap: true`), so every record already points at the source — **`lib/**/*.ts`, not `dist/**/*.js`**. 249 files in the report, **172 of them `.ts`**.

So the fix is simply to stop excluding them. No lcov post-processing, no `--src` gymnastics.

### The number the review was missing

Line coverage of the **30 converted files**, from that run: **85.9% (7877/9170 lines)**. Repo-wide, `lib/**/*.ts` in the report sits at **88.5%**.

That is the reassuring half: the Mocha suite *does* exercise the converted code — the gate was blind, not the tests. The unreassuring half is the distribution:

| File | Line coverage |
|------|---------------|
| `lib/util/wildcard.ts` | **absent from the report** — never loaded by the suite |
| `lib/api/funnel.ts` | **55.7%** (687/1234) — the dispatch core, half uncovered |
| `lib/service/cache/redis.ts` | 62.5% |
| `lib/util/debug.ts` | 70.7% |
| `lib/api/controllers/memoryStorageController.ts` | 73.8% |
| `lib/service/storage/{7,8}/esWrapper.ts` | 81.2% each |
| `lib/util/bytes.ts` | 82.5% |
| `documentExtractor` · `serverController` | 87.0% · 87.7% |
| the other 19 | 91% → 100% |

**This corrects finding 6 above.** "Converted with no unit net" was too strong: of the six converted utils with no dedicated spec, five are covered incidentally by other specs (`assertType` and `safeObject` 100%, `stackTrace` 97.8%, `promback` 97.3%, `bytes` 82.5%, `debug` 70.7%). Only **`wildcard.ts` is genuinely untested** — it does not appear in the report at all. The real coverage gaps are elsewhere, and `funnel.ts` at 55.7% is the one that matters: it is the file this sprint refactored under gate pressure, and it is the least covered of the whole set.

### Two further bugs found on the way — vitest coverage measured *nothing*

Wiring vitest into the scanner turned up a pair of pre-existing defects, both caused by the single line `root: "tests"` in `vitest.config.ts`. Every coverage path was resolved against `tests/` instead of the repo root, so:

1. **`reportsDirectory: "./coverage"` wrote to `tests/coverage/lcov.info`** — not `coverage/lcov.info`. The two runners therefore never collided over a shared path, contrary to what the review assumed: vitest's report was simply somewhere `sonar.javascript.lcov.reportPaths` was never going to look.
2. **The instrumented scope was limited to `tests/`, so `lib/` was never measured.** The emitted report contained **0 file records**. "Every new unit test goes to vitest" has, since the runner was scaffolded, produced *no measurable coverage whatsoever*.

Fixed by dropping `root` and selecting the specs with `include: ["tests/**/*.{test,spec}.ts"]`, which keeps every path repo-root-relative like the rest of the tooling. Verified in Docker: same 1 file / 7 tests discovered, and the report now carries `lib/util/distributedLock.ts` at **96.6%**.

Deliberately **no explicit `coverage.include`**: the v8 provider then reports only the files the specs actually loaded (2 records here). Declaring all of `lib/` would emit ~180 zero-hit records that add nothing over the Mocha report — and depend on Sonar's merge semantics being a union, which is not worth betting the gate on.

### The changes

- **`sonar.coverage.exclusions`: `**/*.ts,**/*.vue` → `**/*.vue`.** The exclusion predated this ADR (#2658, 2026-05-21); the comment left in its place records why it must not come back.
- **One lcov per runner.** `test:unit:mocha:coverage` writes `coverage/mocha`, `vitest.config.ts` writes `coverage/vitest`, and `sonar.javascript.lcov.reportPaths` lists both.
- **`vitest.config.ts`: `root: "tests"` → `include: ["tests/**/*.{test,spec}.ts"]`** — the two bugs above.
- **The `sonarqube` CI job now runs vitest too**, right after the Mocha coverage — otherwise the vitest report never reaches the scanner.
- **`sonar.tests`: `./test` → `./test,./tests`.** The vitest tree was in neither `sonar.sources` nor `sonar.tests`, so Sonar did not know it existed.

### Consequence for the coming sprints

The "Coverage on New Code" gate now applies to conversions. Two things follow, and Sprint 5 should be planned around them:

1. A conversion PR whose file sits below the gate's new-code threshold **will now fail** where it used to pass silently. That is the point — but it means the F3 rule ("a file with no spec ships one") is no longer optional bookkeeping, it is what keeps conversion PRs green.
2. `funnel.ts` at 55.7% is a **pre-existing** hole that the gate will not flag (it is no longer new code). It deserves its own spec work regardless.

## What was done (PR F3 — test debt)

### The vitest spec location is settled

`tests/` mirrors the source tree (`lib/util/bytes.ts` → `tests/util/bytes.test.ts`), discovery is `tests/**/*.{test,spec}.ts`. Recorded in `CONTRIBUTING.md` with a new *Where unit tests live* section — this closes the hub's long-standing open point.

### `lib/util/wildcard.ts` was not untested — it was dead

F2 reported it absent from the coverage report. The reason is not a missing spec: **nothing in the repository imports it.** Zero references across `lib/`, `bin/`, `test/`, `tests/`, `features/`, `index.ts` and the types barrel. `git log` explains it — `a9bebdd0b abort wildcard support for now`: the feature was abandoned and the helper was left behind.

It also carried a latent bug. Its own comment says *"Keep only matching elements"*, and it returns:

```ts
return list.filter((item) => !regex.test(item));
```

— i.e. the elements that do **not** match. Identical on `master`, so the conversion preserved it faithfully; it has simply never had a caller to be wrong for.

**Deleted** rather than pinned by a spec: writing a spec would have frozen an inverted filter in code nobody calls. Removed from `.migration/strict-adopted.txt` at the same time. (It is not re-exported by `index.ts` or `lib/types/index.ts`, so it was never part of the `kuzzle` package's supported surface — only reachable by deep-importing `kuzzle/dist/lib/util/wildcard`.)

### Five vitest specs, and `promback`'s typing hole fixed under them

| File | Before (mocha, incidental) | After (vitest) |
|------|---------------------------|----------------|
| `lib/util/debug.ts` | 70.7% | **100%** |
| `lib/util/bytes.ts` | 82.5% | **91.7%** |
| `lib/util/promback.ts` | 97.3% | **100%** |
| `lib/util/assertType.ts` | 100% | 100% (now pinned directly) |
| `lib/util/safeObject.ts` | 100% | 100% (now pinned directly) |

64 vitest tests, up from 7. The specs deliberately pin the **quirks** as well as the happy paths — `bytes("-1kb") === 1024` (the digit scan drops the sign), `bytes("1.5kb") === 1024`, `has(null, "x")` **throwing** rather than returning false despite the module being called `safeObject` (which is exactly why `funnel._isOriginAuthorized` guards with `request.input.headers && has(…)`), and `assertInteger` being the one assertion with no null escape hatch.

**`promback.ts` is now strict-clean and adopted.** Its 5 strict errors came from its own type design, not an external constraint: `resolve(result?: T)` passed `T | undefined` into a `(result: T) => void`, and neither settler was proven non-null. The honest model is that the settled value **is** `T | undefined` — `resolve()` is callable with no argument, and `KuzzleEventEmitter` really does call `promback.resolve(updated[0])`, which is `T | undefined` under `noUncheckedIndexedAccess`. So `deferred` became `Bluebird<T | undefined>`, and the two settle methods now narrow on the settler (`if (this._resolve !== null)`) instead of on `isPromise` — equivalent, because the Bluebird executor runs synchronously, and it is what makes both branches provably non-null. **No cast, no `any`.** Strict errors 1344 → 1339, and `tsc --noEmit` stayed clean: no cascade into the two consumers.

### `didyoumean` / `debug` stay out of strict — the upstream types are wrong

The plan was to clear their `TS7016` ("could not find a declaration file") with `@types/debug` and `@types/didyoumean`. Both exist (4.1.13 / 1.2.3), and both were tried. **Installing them breaks `tsc --noEmit`**, because `@types/debug` is *narrower than the library's runtime*:

- `debug` populates `inspectOpts` from **any** `DEBUG_*` environment variable, so `lib/util/debug.ts` legitimately reads `inspectOpts.expand` (`DEBUG_EXPAND`) — a property the declaration does not have (`TS2339`).
- The declaration types those values as `number | boolean`, which node's `util.inspect(value, InspectOptions)` will not accept (`TS2769`, twice).

Adopting the typings would therefore mean adding two dependencies **and** three casts, to remove two implicit-any diagnostics — a net loss for a hardening PR. **Reverted**, and recorded as [TD-25](../type-debt-register.md) so the next person does not repeat the experiment.

### The mocha counter did not move — on purpose

All five specced files had *no* Mocha spec, so nothing was replaced: `mocha` stays at 151. The counter starts falling when a legacy spec is actually ported, which is sprint 10's job; F3's contribution is the rule (a conversion ships a spec) and the habit, not the number.

## Validation (PR F3)

- **Full Mocha suite (3025) green** and **vitest 6 files / 64 tests green** in Docker (`npm run build` included).
- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors; `prettier --check` clean on every touched file.
- Ratchets: js 66, mocha 151, any 208, implicit-any 520 — all at baseline. `npm run test:strict` ✅ **94/94**, `--candidates` empty (`wildcard` out, `promback` in).
- **All 51 CI checks green**, SonarCloud quality gate included.
- ✅ **The lcov-merge assumption is confirmed — SonarCloud unions the two reports.** `lib/util/assertType.ts` imports `BadRequestError`, so the vitest report necessarily carries ~15 zero-hit `lib/kerror/errors/*` records: the *production* import chain pulls them in, and no spec-side change avoids it (removing the spec's own import was tried and is useless). Merging is only safe if a line covered in *either* report counts as covered. Measured on the two PRs' own analyses:

  | | F2 ([#2693](https://github.com/kuzzleio/kuzzle/pull/2693)) | F3 ([#2694](https://github.com/kuzzleio/kuzzle/pull/2694)) |
  |---|---|---|
  | `coverage` | 84.7% | **84.7%** |
  | `lines_to_cover` | 57 027 | 57 033 |
  | `uncovered_lines` | 9 035 | **9 014** (−21) |
  | `new_coverage` | — | **100%** (0 uncovered of 20 new lines) |

  Coverage did **not** drop, and uncovered lines went *down* by exactly the amount the new specs cover. Union semantics hold; no `coverage.include` workaround is needed. *(Sonar's 84.7% is over all of `sonar.sources=./lib` including never-loaded files and branch conditions, hence lower than the 88.5% computed over the `lib/**/*.ts` records alone.)*

## Validation (PR F2)## Validation (PR F2)

- **Mocha coverage in Docker** (`npm run build && npm run test:unit:mocha:coverage`): 3025 passing, `coverage/mocha/lcov.info` written with **249 file records, 172 of them `.ts`**, all paths pointing at sources (`lib/**/*.ts`) — the source-map remap needs no help.
- **Vitest coverage in Docker**: 1 file / 7 tests, `coverage/vitest/lcov.info` written with real records (`lib/util/distributedLock.ts` 96.6%) where it previously emitted an empty report to the wrong directory.
- Measured line coverage of the 30 converted files: **85.9%** (7877/9170); `lib/**/*.ts` repo-wide **88.5%**.
- `npx tsc --noEmit` clean; `npm run test:lint` 0 errors; `prettier --check` clean; all 4 ratchets at baseline; `npm run test:strict` ✅ 94/94.
- No `lib/` change at all: this PR touches only CI, Sonar and test configuration.

## Validation (PR F1)

- `npx tsc --noEmit` clean.
- `npm run test:strict`: **✅ 94 adopted files pass** (was 46). `--candidates` now empty.
- `npm run ratchet`: js 66, mocha 151, any **208** (broadened, see above), implicit-any **520** (new) — all at baseline.
- `npm run test:lint`: 0 errors.
- Strict error total repo-wide: **1483 → 1344**.
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`).
- `npx prettier --check` clean on the edited source.
- No runtime change: the only `lib/` edit is three type annotations and one exported type in `baseController.ts` (137 of the 139 cleared strict errors come from the `never[]` fix, the other 2 from typing `_addAction`'s parameters).
