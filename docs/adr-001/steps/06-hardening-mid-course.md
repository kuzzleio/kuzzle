# Step 06 — Mid-course hardening (enforcement before `lib/core`)

**Status:** 🟦 In progress — PR F1 done, F2 and F3 to come
**Date:** 2026-09-09 → …
**PR(s):** F1 = [#2689](https://github.com/kuzzleio/kuzzle/pull/2689) (`chore/ts-migration-hardening-strict`) · F2 (coverage, to open — [#2692](https://github.com/kuzzleio/kuzzle/issues/2692)) · F3 (test debt, to open)
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
6. **The test axis has not moved, and no counter shows it.** `mocha = 151` unchanged since 2026-07-14; the branch's only vitest spec (`tests/util/distributedLock.test.ts`) came from unrelated PR #2664. 30 files converted, **0 tests written** — and 6 of the 12 converted `lib/util` files (`assertType`, `bytes`, `promback`, `safeObject`, `wildcard`, `debug`) have no unit spec at all, so they were converted with no unit net. → **PR F3**.
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

## What is planned (PR F2 — restore coverage, before Sprint 5)

The one item that changes the *nature* of the risk on sprints 5→7, hence its position before them.

- Remove `**/*.ts` from `sonar.coverage.exclusions`, then **verify empirically where the c8 lcov points**: mocha runs the compiled `dist/` output with `sourceMap: true`, so c8 should remap to `lib/**/*.ts` — to be confirmed, and remapped explicitly if not.
- Feed the vitest coverage to the scanner too: separate report paths, both listed in `sonar.javascript.lcov.reportPaths` (today both runners write `coverage/lcov.info`, so one would overwrite the other).
- **Record the measured coverage of the 30 converted files** in this step file. That number is the missing piece of the whole review.
- If the lcov remapping turns out to be heavier than expected, the PR still ships the measurement and the diagnosis, and the unblocking becomes an issue — but Sprint 5 does not start on an unmeasured gate.

## What is planned (PR F3 — test debt)

- **Decide the vitest spec location** (hub open point): `tests/` mirror, which is already `vitest.config.ts`'s `root`. Record it in `CONTRIBUTING.md` — it blocks every new spec.
- First vitest specs for the **6 converted files with no unit spec**: `assertType`, `bytes`, `promback`, `safeObject`, `wildcard`, `debug`. Small and pure, so they buy real coverage cheaply and install the vitest habit.
- Fix `promback.ts`'s typing hole under those specs; clear `didYouMean` / `debug` `TS7016` and adopt both into strict.
- **New conversion rule:** a PR converting a file that has no spec ships a vitest spec for it. This is the only mechanism that makes the mocha counter fall instead of deferring all 151 specs to sprint 10.

## Validation (PR F1)

- `npx tsc --noEmit` clean.
- `npm run test:strict`: **✅ 94 adopted files pass** (was 46). `--candidates` now empty.
- `npm run ratchet`: js 66, mocha 151, any **208** (broadened, see above), implicit-any **520** (new) — all at baseline.
- `npm run test:lint`: 0 errors.
- Strict error total repo-wide: **1483 → 1344**.
- **Full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`).
- `npx prettier --check` clean on the edited source.
- No runtime change: the only `lib/` edit is three type annotations and one exported type in `baseController.ts` (137 of the 139 cleared strict errors come from the `never[]` fix, the other 2 from typing `_addAction`'s parameters).
