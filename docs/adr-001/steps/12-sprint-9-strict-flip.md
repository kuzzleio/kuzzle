# Step 12 — Sprint 9: the strict flip

**Status:** 🟦 Open · **Opened:** 2026-09-18 · **PR(s):** K0 [#2799](https://github.com/kuzzleio/kuzzle/pull/2799) · K1 [#2800](https://github.com/kuzzleio/kuzzle/pull/2800) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Flip `strict: true` in `tsconfig.json`, drop the progressive-strict machinery (`tsconfig.strict.json`, `scripts/strict-check.sh`, `.migration/strict-adopted.txt`) and remove `allowJs`. Axis 3 of [ADR-0001](../ADR-0001-migration-typescript.md) closes here; axis 1 closed with [step 11](11-sprint-8-cluster.md).

This is not a conversion sprint. Every file is already TypeScript — what is left is the question the conversions were allowed to defer, and [TD-54](../type-debt-register.md#td-54) is the record of that permission being given.

## Scope, measured 2026-09-18 on `2-dev` (e35536cf2)

`bash scripts/strict-check.sh --count` over every unadopted production file:

|                                           |           |
| ----------------------------------------- | --------: |
| Production `.ts` files                    |   **252** |
| Adopted (`.migration/strict-adopted.txt`) |   **141** |
| **Unadopted**                             |   **112** |
| **Strict errors to clear**                | **1 673** |

Distribution — the shape that decides the slicing:

| Bucket     | Files | Errors | Share of errors |
| ---------- | ----: | -----: | --------------: |
| ≤ 5 errors |    60 |    153 |              9% |
| 6–15       |    24 |    244 |             15% |
| 16–40      |    20 |    499 |             30% |
| > 40       |     8 |    777 |             46% |

**Half the debt is in ten files; half the files carry a tenth of it.** By layer: `lib/core` 503 (41 files) · `lib/service` 480 (**5** files) · `lib/api` 381 (16) · `lib/kerror` 89 (16) · `lib/cluster` 85 (6) · `lib/kuzzle` 65 (5) · `lib/util` 32 (12) · `lib/model` 17 (5) · `lib/config` 14 (1) · `lib/types` 7 (5).

The ten heaviest:

| File                                             | Errors |
| ------------------------------------------------ | -----: |
| `lib/service/storage/8/elasticsearch.ts`         |    235 |
| `lib/service/storage/7/elasticsearch.ts`         |    198 |
| `lib/core/validation/validation.ts`              |     95 |
| `lib/api/controllers/memoryStorageController.ts` |     54 |
| `lib/core/network/protocols/httpwsProtocol.ts`   |     51 |
| `lib/api/request/kuzzleRequest.ts`               |     50 |
| `lib/api/funnel.ts`                              |     49 |
| `lib/core/plugin/pluginsManager.ts`              |     45 |
| `lib/api/controllers/authController.ts`          |     37 |
| `lib/api/request/requestContext.ts`              |     31 |

### By error class, because the class decides who can fix it

| Class              | Codes                                                  |   Count | Share |
| ------------------ | ------------------------------------------------------ | ------: | ----: |
| **Nullability**    | TS18048, TS2532, TS18047, TS2531, TS2564, TS2538       | **598** |   36% |
| **Assignability**  | TS2345, TS2322, TS2769                                 | **455** |   27% |
| **Implicit `any`** | TS7006, TS7053, TS7005, TS7019, TS7034, TS7031, TS7016 | **373** |   22% |
| **Property/shape** | TS2551, TS2339                                         | **133** |    8% |
| Other              | TS18046 (`unknown` in `catch`), TS2722, …              |     114 |    7% |

Two readings matter for planning:

- **The implicit-`any` third is already ratcheted.** `implicit-any` stands at 455 against 373 `TS7xxx` here, measured over a wider include — so that bucket is not new work discovered by this step, it is the existing ratchet's backlog finally coming due. It is also the most mechanical.
- **[TD-53](../type-debt-register.md#td-53) is 83 errors, not the whole nullability third.** `'…config…' is possibly 'undefined'` accounts for **83** of the 296 `TS18048` — about **5% of the 1 673**. That is the number [TD-54](../type-debt-register.md#td-54) ([#2757](https://github.com/kuzzleio/kuzzle/issues/2757)) was filed to establish, now measured repo-wide rather than over six files: **the config shape is a real blocker and a small one**, and the remaining 95% was deferred, not blocked.

### `allowJs` — measured, and it is not the blocker it looks like

`lib/**/*.js` now matches nothing, but `tsconfig.json` also includes `test/**/*.js` (148 Mocha spec files), which reads as _"`allowJs` waits for [step 13](../ADR-0001-migration-typescript.md#step-table)"_. It does not: compiling the project with `allowJs: false` **type-checks clean today** (0 errors) — the JavaScript specs drop out of the program and nothing imports them.

⚠️ Type-checking clean is not the same as emitting the same payload. **Diff the emitted file list before and after** (`npm run build`, then `.ci/scripts/check-build-payload.sh`) — that guard exists because this exact class of change broke the package once ([TD-35](../type-debt-register.md#td-35)/[TD-36](../type-debt-register.md#td-36)).

## Slices

Ordered so that each one is independently mergeable and the flip is last. Nothing here converts a file, so the coverage gate only sees what a fix touches — but a fix that adds a guard **adds a branch**, and an unexercised branch costs coverage on a file that is not being renamed. Expect specs with the fixes, not after them.

| #         | Content                                                                                                                                                                                                       | Errors | Why this grouping                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **K0** ✅ | [TD-53](../type-debt-register.md#td-53) — make `KuzzleConfiguration` a real shape instead of `Partial<…>` ([#2756](https://github.com/kuzzleio/kuzzle/issues/2756)) — **cleared 106**, see _What K0 found_    |    ~83 | It is the one blocker that is _someone else's_ to fix: every config reader in the repo waits on it, it is spread thin (83 errors over many files), and it already blocks a named file from adoption — `idCardHandler.ts`, [step 11](11-sprint-8-cluster.md#idcardhandlerts-is-not-adopted-and-the-reason-is-worth-stating). First, because everything after it re-measures. |
| **K1** ✅ | The files at ≤ 5 errors, in layer-sized batches — **cleared 132 errors and adopted 56 files**, see _What K1 found_                                                                                            |    153 | 54% of the remaining files for 9% of the errors. Adopting them shrinks `--count`'s output to the files that actually need thought, and it is the cheapest way to make the ratchet's list stop being a survey.                                                                                                                                                               |
| **K2**    | `lib/api/request/*` — `kuzzleRequest`, `requestContext`, `requestResponse`, `requestInput`                                                                                                                    |    133 | One object, four files, and it is **public API surface** (`KuzzleRequest` is re-exported). Its types are what every controller and every plugin sees, so fixing it changes error counts everywhere else — do it before the controllers, not after.                                                                                                                          |
| **K3**    | The two `elasticsearch.ts`                                                                                                                                                                                    |    433 | 26% of the debt in two files, and [TD-62](../type-debt-register.md#td-62) says 32 of its 56 lying `null` declarations live here. Same file twice (ES 7 and ES 8), so the second is largely the first's diff. Its own PR because its size will dominate any review it shares.                                                                                                |
| **K4**    | `lib/core` mid-weights — `validation`, `httpwsProtocol`, `pluginsManager`, `plugin`, `tokenRepository`, `store`, `ObjectRepository`, `hotelClerk`                                                             |   ~334 | The layer with the most files and the most history. `ObjectRepository` and `store` are base classes — expect their fixes to clear errors in subclasses, so measure after, not before.                                                                                                                                                                                       |
| **K5**    | The rest: `funnel`, the controllers, `kerror`, `kuzzle`, `cluster`'s 85, `service/cache`, `queryTranslator`                                                                                                   |   ~530 | Whatever K0–K4 has not already retired. Re-slice on the count that exists then; this row is a bucket, not a plan.                                                                                                                                                                                                                                                           |
| **K6**    | **The flip**: `strict: true` in `tsconfig.json`, `allowJs` removed, `tsconfig.strict.json` + `strict-check.sh` + `strict-adopted.txt` deleted, `npm run test:strict` and the `pr-preflight` reminders retired |      0 | Mechanical, and only correct when `--count` is empty. The build-payload diff is part of this PR.                                                                                                                                                                                                                                                                            |

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this step adds or changes:

- **A fix removes an error; it does not move it.** No `!`, no `as`, no widening a parameter to make a call site compile. The `casts` ratchet (87) and both `any` ratchets are the guard, and they must not rise in a step whose whole purpose is to make claims checkable.
- **Report the count before and after**, per file, the way [step 11](11-sprint-8-cluster.md)'s PRs did — and **adopt every file the PR clears** in the same PR. A file fixed but not adopted is a file that regresses next week.
- **A guard that cannot be reached is a defect report, not a guard.** This is the whole yield of the exercise: sprints 6, 7 and 8 each surfaced a real bug this way. If the compiler asks for a check the runtime can never fail, say so in the PR and file it — do not add a dead branch to silence it.
- Run impacted specs **in Docker** (`.ci/scripts/docker-test.sh unit mocha` / `unit vitest`); the host cannot load `re2` on arm64.

## Risks

- **This step has no `js` counter to show progress.** Its only visible metric is `strict-adopted` going 141 → 252 and `--count` going 1 673 → 0. Report both in every PR or the step becomes unreadable from the outside.
- **Nullability fixes are behaviour changes when the value really can be null.** 598 errors is 598 places where someone has to decide _which_ of "it cannot be null here" and "it can, and we never handled it" is true. The second kind is a bug fix and belongs in its own PR with a spec — that is [step 09](09-sprint-6-core-ii.md)'s lesson, and [TD-52](../type-debt-register.md#td-52)/[TD-51](../type-debt-register.md#td-51) are what it looks like when it is done right.
- **The two `elasticsearch.ts` will re-score under SonarCloud** if a fix touches enough of them, and they are the two largest files in the repo. Keep changes minimal and mechanical; do not refactor while fixing types.
- **[TD-62](../type-debt-register.md#td-62) overlaps K3 and K4** (56 `x: T = null` declarations, 32 in the ES services). It is the same work seen from the register's side — close it _through_ this step rather than as a parallel PR, or the two will conflict.

## Key commands

```bash
bash scripts/strict-check.sh --count            # every unadopted file, ranked — the step's backlog
bash scripts/strict-check.sh --count lib/x.ts   # the number a PR reports
bash scripts/strict-check.sh --candidates       # files that pass strict but are not adopted yet
npx tsc -p tsconfig.strict.json --noEmit        # the raw diagnostics, with their codes
npm run ratchet                                 # no counter may rise
```

---

## What K0 found

**1 673 → 1 567 errors, 112 → 108 files, 141 → 145 adopted.** 106 cleared against the 83 estimated: the top-level `Partial` also produced `TS2551`s — a property read off `SecurityConfiguration | undefined` — which the estimate had counted as a separate class. 30 files improved without becoming clean; the four that did are `internalIndexHandler.ts` and `storageEngine.ts` (the two sprint 7 named this blocker for), plus `Logger.ts` and `service.ts`.

The fix is three types where there was one name — `IKuzzleConfiguration` (merged, total), `PackagedKuzzleConfiguration` (what the defaults file ships), `KuzzleConfiguration` (what a user writes, now a **deep** partial). The register entry for [TD-53](../type-debt-register.md#td-53) carries the detail and the three things the fix found that were not in the plan.

**Two notes for the slices that follow:**

- **The estimate was low for a reason worth repeating.** 83 came from counting `TS18048` lines mentioning `config`; the real figure was 106, because one bad type produces errors in more than one code. **A per-class estimate under-counts whatever the class boundary cuts through** — so read the K1–K5 figures in the table above as lower bounds, not budgets.
- **K1 is now 60 files at ≤ 5 errors on a re-measure, not the same 60.** Every slice moves the others; re-run `--count` before picking one up.

### And it hit the `any` ratchet on a comment

The ratchet went 204 → 205 on a change that added no `any`: `grep -rE ': any'` matched the words _"total: anything else"_ in a doc comment. That is [TD-73](../type-debt-register.md#td-73), and it is the fourth telling of a lesson this ADR has already paid for twice — the comment was reworded to get the PR through, which is precisely the behaviour [TD-43](../type-debt-register.md#td-43) predicted a grep-based ratchet would teach.

## What K1 found

**1 567 → 1 435 errors, 108 → 54 files, 145 → 201 adopted**, in five batches —
`lib/kerror` (14 files), `lib/util` (12), `lib/types` + `baseModel` (6),
`lib/core` (9), then the remaining fifteen across `lib/api`, `lib/cluster`,
`lib/core` and `lib/kuzzle`. `implicit-any` 455 → 397, `casts` 87 → 85, `any`
unchanged at 204.

### The bucket was not homogeneous, and the shape of the exceptions is the finding

Three of the sixty files are not K1 work at all, and saying so cost more than
fixing most of the others:

| File                                     | Errors | Belongs to | Why                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -----: | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/security/{profile,user,token}.ts` |      9 | K4         | One question — `_id: string` assigned `null`, [TD-62](../type-debt-register.md#td-62)'s shape. **Answering it in the model relocates errors rather than removing them**: `Token`'s five `\| null` move **+10** into `authController`, `tokenManager` and `tokenRepository`; `Profile._id` moves **+8** into the two security repositories. Both were measured, then reverted. |
| `bulkController.ts`                      |      1 | K3         | Its `items.map((item) => …)` needs a return type on the ES service's `mCreateOrReplace`, which has none.                                                                                                                                                                                                                                                                      |
| `internalProtocol.ts`                    |      2 | K5         | `TS2416` on `init`: the subclass declares one signature against `Protocol.init`'s two overloads. `httpwsProtocol` has the same error, so it is one decision about the base class, not two local fixes.                                                                                                                                                                        |

**A file's error count does not predict whether it can be fixed alone.** That is
the number K1 was sliced on, and for 54 of 57 files it held; for the other
three the errors were the visible end of a type that lives somewhere else. Read
K2–K5's counts the same way K0 said to read K1's: as lower bounds.

### Seven defects, each with the spec it never had

- `new BufferedPassThrough({})` reached `Buffer.alloc(undefined)` and threw:
  `highWaterMark` is optional on `DuplexOptions`, and the constructor's default
  argument only covered the no-argument call.
- `removeStacktrace` did `error.stack.split(…)` in development. `KuzzleError`
  sets `stack` to `undefined` in its own constructor, and the branch two lines
  down had already spelled that case out for serialized responses.
- `assertIsAuthenticated` read `_id` off a null `context.user` — the case it
  exists to reject — throwing a `TypeError` instead of the unauthorized error.
- `roleRepository` passed a `Set` to `didyoumean`, which walks `list.length`:
  that "did you mean…" suggestion had always been empty.
- `BackendVault.decrypted` was written once, at its declaration, and never set,
  so the vault re-decrypted on every `secrets` read before start.
- `dumpGenerator._cleanUpHistory` looped `while (dumps.length >= reports)` and
  read `.path` off `dumps.shift()`. A configured `history.reports` of 0 makes
  that constant-true.
- `rateLimiter` destructured a nullable `context.user`; falling through would
  have left `limit` at -1 and **denied** the request.

And two the compiler did _not_ find, which the suites did — both worth keeping
in mind for the slices that follow:

- `safeObject.get` reads **own properties only**, so swapping a dynamic index
  for it silently stopped binding controller handlers, which are prototype
  methods. `Reflect.get` into an `unknown` is the version that works.
- `new BadRequestError()` with no arguments threw once `message` was typed
  `string | Error`. `doc/build-error-codes.js` constructs one of each class
  exactly that way to read its `status`, and plugin code in JavaScript may too.
  **The error-codes documentation gate caught it, not the unit suites** — run
  `.ci/scripts/check-error-codes-documentation.sh` when touching `lib/kerror`.

### Two things about the compiler that cost time

- **`as const` does not defeat `noUncheckedIndexedAccess`.** A tuple indexed by
  a value of type `number` is still `T | undefined`; only a _literal_ index is
  exempt. `name-generator` ended up with a `randomItem` helper whose fallback is
  the tuple's head — total, no assertion, no branch describing a state the
  runtime cannot reach.
- **`abstract` is not how to say "a subclass must set this field".** An abstract
  member cannot be assigned in a subclass constructor (`TS2715`), and that is
  exactly the documented Kuzzle controller pattern — `start-kuzzle-test.ts` is
  what said so. `Controller.definition` is optional instead, with
  `Plugin.checkControllerDefinition` carrying `asserts definition is
ControllerDefinition`: it already rejected anything that is not a plain
  object, so the assertion signature only writes down what it did.

### Structural fixes, where an invariant stood one line from its proof

Step 10's lesson kept paying: `routePart`'s subparts map is null-prototype, so
one indexed read is both safe and honest and every `has()`-then-index pair is
gone; `indexCache` answers "does this index exist" and "what are its
collections" with a single `Map` lookup; `RouteHandler.invokeHandler` is folded
into the caller that had just proved the handler non-null; `Redis` exposes
`connectedClient`, stating once — where it can actually fail — what four call
sites were taking on trust.

### Two local declarations, and why not `@types/*`

`debug` and `didyoumean` ship no types. Adding `@types/debug` would be a
dependency change on a branch whose point is that it changes none, and it would
contend with the [deps-bump PRs](../type-debt-register.md). Both got a local
`.d.ts` covering the surface `lib/` actually uses, the way `dumpme.d.ts`
already did — and writing `didyoumean`'s is what surfaced the `Set` defect
above.
