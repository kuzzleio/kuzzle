# Step 12 — Sprint 9: the strict flip

**Status:** 🟦 Open · **Opened:** 2026-09-18 · **PR(s):** — · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Flip `strict: true` in `tsconfig.json`, drop the progressive-strict machinery (`tsconfig.strict.json`, `scripts/strict-check.sh`, `.migration/strict-adopted.txt`) and remove `allowJs`. Axis 3 of [ADR-0001](../ADR-0001-migration-typescript.md) closes here; axis 1 closed with [step 11](11-sprint-8-cluster.md).

This is not a conversion sprint. Every file is already TypeScript — what is left is the question the conversions were allowed to defer, and [TD-54](../type-debt-register.md#td-54) is the record of that permission being given.

## Scope, measured 2026-09-18 on `2-dev` (e35536cf2)

`bash scripts/strict-check.sh --count` over every unadopted production file:

| | |
|---|---:|
| Production `.ts` files | **252** |
| Adopted (`.migration/strict-adopted.txt`) | **141** |
| **Unadopted** | **112** |
| **Strict errors to clear** | **1 673** |

Distribution — the shape that decides the slicing:

| Bucket | Files | Errors | Share of errors |
|---|---:|---:|---:|
| ≤ 5 errors | 60 | 153 | 9% |
| 6–15 | 24 | 244 | 15% |
| 16–40 | 20 | 499 | 30% |
| > 40 | 8 | 777 | 46% |

**Half the debt is in ten files; half the files carry a tenth of it.** By layer: `lib/core` 503 (41 files) · `lib/service` 480 (**5** files) · `lib/api` 381 (16) · `lib/kerror` 89 (16) · `lib/cluster` 85 (6) · `lib/kuzzle` 65 (5) · `lib/util` 32 (12) · `lib/model` 17 (5) · `lib/config` 14 (1) · `lib/types` 7 (5).

The ten heaviest:

| File | Errors |
|---|---:|
| `lib/service/storage/8/elasticsearch.ts` | 235 |
| `lib/service/storage/7/elasticsearch.ts` | 198 |
| `lib/core/validation/validation.ts` | 95 |
| `lib/api/controllers/memoryStorageController.ts` | 54 |
| `lib/core/network/protocols/httpwsProtocol.ts` | 51 |
| `lib/api/request/kuzzleRequest.ts` | 50 |
| `lib/api/funnel.ts` | 49 |
| `lib/core/plugin/pluginsManager.ts` | 45 |
| `lib/api/controllers/authController.ts` | 37 |
| `lib/api/request/requestContext.ts` | 31 |

### By error class, because the class decides who can fix it

| Class | Codes | Count | Share |
|---|---|---:|---:|
| **Nullability** | TS18048, TS2532, TS18047, TS2531, TS2564, TS2538 | **598** | 36% |
| **Assignability** | TS2345, TS2322, TS2769 | **455** | 27% |
| **Implicit `any`** | TS7006, TS7053, TS7005, TS7019, TS7034, TS7031, TS7016 | **373** | 22% |
| **Property/shape** | TS2551, TS2339 | **133** | 8% |
| Other | TS18046 (`unknown` in `catch`), TS2722, … | 114 | 7% |

Two readings matter for planning:

- **The implicit-`any` third is already ratcheted.** `implicit-any` stands at 455 against 373 `TS7xxx` here, measured over a wider include — so that bucket is not new work discovered by this step, it is the existing ratchet's backlog finally coming due. It is also the most mechanical.
- **[TD-53](../type-debt-register.md#td-53) is 83 errors, not the whole nullability third.** `'…config…' is possibly 'undefined'` accounts for **83** of the 296 `TS18048` — about **5% of the 1 673**. That is the number [TD-54](../type-debt-register.md#td-54) ([#2757](https://github.com/kuzzleio/kuzzle/issues/2757)) was filed to establish, now measured repo-wide rather than over six files: **the config shape is a real blocker and a small one**, and the remaining 95% was deferred, not blocked.

### `allowJs` — measured, and it is not the blocker it looks like

`lib/**/*.js` now matches nothing, but `tsconfig.json` also includes `test/**/*.js` (148 Mocha spec files), which reads as *"`allowJs` waits for [step 13](../ADR-0001-migration-typescript.md#step-table)"*. It does not: compiling the project with `allowJs: false` **type-checks clean today** (0 errors) — the JavaScript specs drop out of the program and nothing imports them.

⚠️ Type-checking clean is not the same as emitting the same payload. **Diff the emitted file list before and after** (`npm run build`, then `.ci/scripts/check-build-payload.sh`) — that guard exists because this exact class of change broke the package once ([TD-35](../type-debt-register.md#td-35)/[TD-36](../type-debt-register.md#td-36)).

## Slices

Ordered so that each one is independently mergeable and the flip is last. Nothing here converts a file, so the coverage gate only sees what a fix touches — but a fix that adds a guard **adds a branch**, and an unexercised branch costs coverage on a file that is not being renamed. Expect specs with the fixes, not after them.

| # | Content | Errors | Why this grouping |
|---|---|---:|---|
| **K0** | [TD-53](../type-debt-register.md#td-53) — make `KuzzleConfiguration` a real shape instead of `Partial<…>` ([#2756](https://github.com/kuzzleio/kuzzle/issues/2756)) | ~83 | It is the one blocker that is *someone else's* to fix: every config reader in the repo waits on it, it is spread thin (83 errors over many files), and it already blocks a named file from adoption — `idCardHandler.ts`, [step 11](11-sprint-8-cluster.md#idcardhandlerts-is-not-adopted-and-the-reason-is-worth-stating). First, because everything after it re-measures. |
| **K1** | The 60 files at ≤ 5 errors, in layer-sized batches | 153 | 54% of the remaining files for 9% of the errors. Adopting them shrinks `--count`'s output to the files that actually need thought, and it is the cheapest way to make the ratchet's list stop being a survey. |
| **K2** | `lib/api/request/*` — `kuzzleRequest`, `requestContext`, `requestResponse`, `requestInput` | 133 | One object, four files, and it is **public API surface** (`KuzzleRequest` is re-exported). Its types are what every controller and every plugin sees, so fixing it changes error counts everywhere else — do it before the controllers, not after. |
| **K3** | The two `elasticsearch.ts` | 433 | 26% of the debt in two files, and [TD-62](../type-debt-register.md#td-62) says 32 of its 56 lying `null` declarations live here. Same file twice (ES 7 and ES 8), so the second is largely the first's diff. Its own PR because its size will dominate any review it shares. |
| **K4** | `lib/core` mid-weights — `validation`, `httpwsProtocol`, `pluginsManager`, `plugin`, `tokenRepository`, `store`, `ObjectRepository`, `hotelClerk` | ~334 | The layer with the most files and the most history. `ObjectRepository` and `store` are base classes — expect their fixes to clear errors in subclasses, so measure after, not before. |
| **K5** | The rest: `funnel`, the controllers, `kerror`, `kuzzle`, `cluster`'s 85, `service/cache`, `queryTranslator` | ~530 | Whatever K0–K4 has not already retired. Re-slice on the count that exists then; this row is a bucket, not a plan. |
| **K6** | **The flip**: `strict: true` in `tsconfig.json`, `allowJs` removed, `tsconfig.strict.json` + `strict-check.sh` + `strict-adopted.txt` deleted, `npm run test:strict` and the `pr-preflight` reminders retired | 0 | Mechanical, and only correct when `--count` is empty. The build-payload diff is part of this PR. |

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this step adds or changes:

- **A fix removes an error; it does not move it.** No `!`, no `as`, no widening a parameter to make a call site compile. The `casts` ratchet (87) and both `any` ratchets are the guard, and they must not rise in a step whose whole purpose is to make claims checkable.
- **Report the count before and after**, per file, the way [step 11](11-sprint-8-cluster.md)'s PRs did — and **adopt every file the PR clears** in the same PR. A file fixed but not adopted is a file that regresses next week.
- **A guard that cannot be reached is a defect report, not a guard.** This is the whole yield of the exercise: sprints 6, 7 and 8 each surfaced a real bug this way. If the compiler asks for a check the runtime can never fail, say so in the PR and file it — do not add a dead branch to silence it.
- Run impacted specs **in Docker** (`.ci/scripts/docker-test.sh unit mocha` / `unit vitest`); the host cannot load `re2` on arm64.

## Risks

- **This step has no `js` counter to show progress.** Its only visible metric is `strict-adopted` going 141 → 252 and `--count` going 1 673 → 0. Report both in every PR or the step becomes unreadable from the outside.
- **Nullability fixes are behaviour changes when the value really can be null.** 598 errors is 598 places where someone has to decide *which* of "it cannot be null here" and "it can, and we never handled it" is true. The second kind is a bug fix and belongs in its own PR with a spec — that is [step 09](09-sprint-6-core-ii.md)'s lesson, and [TD-52](../type-debt-register.md#td-52)/[TD-51](../type-debt-register.md#td-51) are what it looks like when it is done right.
- **The two `elasticsearch.ts` will re-score under SonarCloud** if a fix touches enough of them, and they are the two largest files in the repo. Keep changes minimal and mechanical; do not refactor while fixing types.
- **[TD-62](../type-debt-register.md#td-62) overlaps K3 and K4** (56 `x: T = null` declarations, 32 in the ES services). It is the same work seen from the register's side — close it *through* this step rather than as a parallel PR, or the two will conflict.

## Key commands

```bash
bash scripts/strict-check.sh --count            # every unadopted file, ranked — the step's backlog
bash scripts/strict-check.sh --count lib/x.ts   # the number a PR reports
bash scripts/strict-check.sh --candidates       # files that pass strict but are not adopted yet
npx tsc -p tsconfig.strict.json --noEmit        # the raw diagnostics, with their codes
npm run ratchet                                 # no counter may rise
```
