# Step 12 — Sprint 9: the strict flip

**Status:** 🟦 Open · **Opened:** 2026-09-18 · **PR(s):** K0 [#2799](https://github.com/kuzzleio/kuzzle/pull/2799) · K1 [#2800](https://github.com/kuzzleio/kuzzle/pull/2800) · K2 [#2801](https://github.com/kuzzleio/kuzzle/pull/2801) · K3 [#2802](https://github.com/kuzzleio/kuzzle/pull/2802) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

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
| **K2** ✅ | `lib/api/request/*` — `kuzzleRequest`, `requestContext`, `requestResponse`, `requestInput`                                                                                                                    |    133 | One object, four files, and it is **public API surface** (`KuzzleRequest` is re-exported). Its types are what every controller and every plugin sees, so fixing it changes error counts everywhere else — do it before the controllers, not after.                                                                                                                          |
| **K3** ✅ | The two `elasticsearch.ts` — **cleared 430 errors and adopted both**, see _What K3 found_                                                                                                                     |    433 | 26% of the debt in two files, and [TD-62](../type-debt-register.md#td-62) says 32 of its 56 lying `null` declarations live here. Same file twice (ES 7 and ES 8), so the second is largely the first's diff. Its own PR because its size will dominate any review it shares.                                                                                                |
| **K4** ✅ | `lib/core` mid-weights — `validation`, `httpwsProtocol`, `pluginsManager`, `plugin`, `tokenRepository`, `store`, `ObjectRepository`, `hotelClerk` — **cleared 349 errors, adopted 19 files, closed [TD-62](../type-debt-register.md#td-62)**, see _What K4 found_ |   ~334 | The layer with the most files and the most history. `ObjectRepository` and `store` are base classes — expect their fixes to clear errors in subclasses, so measure after, not before.                                                                                                                                                                                       |
| **K5** ✅ | The rest: `funnel`, the controllers, `kerror`, `kuzzle`, `cluster`'s 85, `service/cache`, `queryTranslator` — **cleared the remaining 522 and adopted 37 files; `--count` is empty**, see _What K5 found_ |   ~530 | Whatever K0–K4 has not already retired. Re-slice on the count that exists then; this row is a bucket, not a plan.                                                                                                                                                                                                                                                           |
| **K6** 🟦 | **The flip**: `strict: true` in `tsconfig.json`, `allowJs` removed, `tsconfig.strict.json` + `strict-check.sh` + `strict-adopted.txt` deleted, `npm run test:strict` and the `pr-preflight` reminders retired |      0 | Mechanical, and only correct when `--count` is empty. The build-payload diff is part of this PR.                                                                                                                                                                                                                                                                            |

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

## What K2 found

**1 435 → 1 302 errors, 54 → 50 files, 201 → 205 adopted**, and **zero collateral**: no file outside `lib/api/request` changed its count, which for the public request API is the result worth reporting.

### 121 of the 133 were one convention

Every accessor in these four classes is backed by a string key with a **zero-width space** appended — `const _input = "input\u200b"` — so that `console.log(request)` prints `input` where the real property is `input​`. It is deliberate, ten years old, and commented as such. The compiler cannot check `this[_input]` when the class never declares that key.

The keys are now **declared as class members**, keyed by the same constants. Nothing changes at runtime. That was chosen over `private _input` and over `#input`, both of which move the runtime key and change what a plugin author sees when inspecting a request — see the [decision register, 2026-09-19](../ADR-0001-migration-typescript.md#decision-register). **Removing the masquerade is still available as its own decision; it is not something a typing slice should do on the way past.**

### Three defects

- **`RequestResponse.deprecations` had never worked.** Its setter assigns through to `KuzzleRequest.deprecations`, which had a getter and **no setter** — in a module, which is strict mode, that is a `TypeError`. Nothing in the tree exercised it, so the throw was never seen.
- **`RequestResponse.error` accepted `null` and could not honour it.** `setError` throws an `InternalError` on anything that is not an `Error`, so `response.error = null` never cleared anything; `clearError()` does.
- **`RequestInput.triggerEvents` was initialised to `null`** while its getter declared `boolean | undefined` and its setter normalised to `undefined`.

### Stating a public return type beats widening it

`getIndex`, `getCollection` and `getId` answer `string` for every caller except the one shape that can return null — `{ required: false }`, `{ ifMissing: "ignore" }` — which is now an **overload**. Only `documentController` passes `required: false`, so the union reaches exactly the call site that can observe it. The same reasoning made `assertObject` generic over what it is handed rather than widening its result to a bare record.

---

## What K3 found

✅ **Landed.** Branch `feat/step-12-k3-elasticsearch`, [#2802](https://github.com/kuzzleio/kuzzle/pull/2802). Both services are adopted, so the ratchet guards them.

| File                                     | At K3's start |   Now |
| ---------------------------------------- | ------------: | ----: |
| `lib/service/storage/8/elasticsearch.ts` |           233 | **0** |
| `lib/service/storage/7/elasticsearch.ts` |           197 | **0** |
| `lib/service/storage/7/esWrapper.ts`     |   0 (adopted) | **0** |
| `lib/service/storage/8/esWrapper.ts`     |   0 (adopted) | **0** |

Repo-wide: strict **1 302 → 871**, `implicit-any` **386 → 212**, adopted **205 → 207**, unadopted **50 → 48**, `casts` unchanged at 84. 3 091 mocha and 261 vitest green, build and error-codes green.

### Four levers, and they carried both files

1. **`ESWrapper.formatESError` takes `unknown`.** `catch` answers `unknown` and the wrapper was declared `JSONObject`: that mismatch alone was **39** of each file's errors, at the call sites rather than in the wrapper. It normalises once (`error instanceof Error ? error : new Error(inspect(error))` — `inspect`, not `String`, because a thrown object stringifies to `[object Object]`), and the handlers say what they need: `meta` is what distinguishes a cluster response from a client-side failure, so the three that read it require it instead of re-checking it four times each.
2. **Anything optional on a request type is written through the local the request holds by reference**, never read back off the request. `operations`, `document`, `doc`, `upsert`, `settings` and ES7's whole `body` are each declared optional, so reading them back was `| undefined` however they had been initialised.
3. **Narrow once, at the helper, not at every call site.** `_catAliases` answers the two fields `cat.aliases` declares optional and Elasticsearch always fills, replacing six duplicated fetch-and-wrap blocks; `_getAliasFromIndice` answers a non-empty tuple `[string, ...string[]]`, so callers read `aliases[0]` without a guard its own `throw` had already made redundant.
4. **Name the envelope the method builds.** `AliasToTargets`, `CatAliasRecord`, `KMExecuteResult`, `KImportResult`, `KuzzleInfo` and ES7's `BulkBody` replace the `{}` and `[]` literals that inferred `{}` and `never[]` and then rejected every push into them.

**Fourteen index loops became `for…of`** across the two files (three keep the index through `entries()`). The `@warning Critical code section` comments stay: the traversal is identical, minus an indexed read that had to be trusted.

### Five defects, two of which only the specs could catch

- **`mCreateOrReplace` reset `esRequest.operations = []`** after construction and before anything had been pushed. Dead code as written — but once the array was shared by reference it silently discarded every operation, and the mocha suite said so on the first run. _A refactor that turns dead code into live code is the dangerous kind._
- **`mReplace` read `"error" in doc` before `doc?.found`**, so an mget answer shorter than its request threw on the `in`. It now has the spec K3 first left it without.
- **`deleteByQuery` built `max_docs: size` and then assigned `undefined` to it** — the one shape [TD-56](../type-debt-register.md#td-56)'s gate checks over the whole program, adopted or not. It is built once now, and `refresh` with it: that property was being assigned onto an object already spread into the search above.
- **`mGet` and `mExists` answered `{ errors, item: [] }` on the empty-ids shortcut**, in both services. Every caller destructures `items`, so every one of them got `undefined` — a four-way typo the compiler saw the moment the return type stopped being inferred from a single branch.
- **`KImportError.status` was declared `string`** while the bulk response echoes an HTTP status code. Nothing ever compared it, so nothing ever complained.

### `ms` and `semver` got local declarations, not `@types` packages

Both files import them, and both were implicitly `any`. K1 set the precedent (`didyoumean.d.ts`, `dumpme.d.ts`): a dependency change is not a typing slice's to make. `lib/types/ms.d.ts` and `lib/types/semver.d.ts` declare only what Kuzzle calls — an unused declaration is a claim nothing checks.

Declaring them honestly surfaced two silent holes: `semver.coerce` answers `null` for a version string it cannot parse, and `ms` answers `undefined` for a duration it cannot read. Both were being fed straight into `semver.satisfies` and a `>` comparison.

### ES7 was the twin, and the diff was the helper signatures

The levers ported as written down. What ES7 had on top was **nineteen untyped helper signatures** — `_getAlias`, `_extractIndex`, `_sanitizeSearchBody`, `findDynamic`, `assertNoRouting` and the rest, all of which their ES8 counterparts already carried — and the bulk-body `never[]`. That is where `implicit-any`'s 306 → 212 comes from; ES8's own share was 386 → 306.

**Doing ES8 to zero first was the right order.** ES7 went 197 → 0 in one pass with no re-derivation and no test failures, against ES8's six red specs on the `_catAliases` change alone.

### One thing the ES8 specs caught that the types could not

`_catAliases` first dropped rows whose `alias` or `index` was missing, on the reasoning that Elasticsearch always fills both. Six specs failed at once: the fixtures answer `[{ alias: "@&nepali.mehry" }]`, with no `index`. The helper now defaults both to `""` instead of dropping the row — and an empty alias fails the index-prefix test every caller already applies, which is what a row without one used to throw on. _A narrowing that discards data is a behaviour change wearing a type's clothes._

### The gate's last condition was not a defect, and the exception is recorded

With both services strict-clean, SonarCloud's `new_duplicated_lines_density` read **36.7% against a 5% threshold** — because taking the twins to zero re-scores their pre-existing ≈57% duplication as new code. Nothing inside the slice moves that: it is the files' own density, present whether one twin is touched or both.

The two files join `sonar.cpd.exclusions`, where their own `esWrapper.ts` pair already sits for the same reason ([TD-16](../type-debt-register.md#td-16): one adapter per Elasticsearch major, deduplication a declared non-goal). That takes [TD-23](../type-debt-register.md#td-23)'s list **4 → 6** — a deliberate exception to its "may only shrink" rule, argued and costed in that entry rather than slipped in as a comment. **CPD is now off for the two largest files in `lib/`**, and the register is the only thing that will flag it later.

Everything else the gate found was real and is fixed: six `S3776` (the guards K3 added pushed `search`, `import` and `_mExecute` one or two points over the complexity threshold, in both files — three extractions each side) and two minor violations in ES7. The two red functional shards were Docker Hub answering `502` to a `docker pull`.

[TD-62](../type-debt-register.md#td-62) closes with this slice for the storage layer: the 32 lying `null` declarations that lived in these two files are gone. The 24 in `lib/model/security` remain, and belong to K4.

---

## What K4 found

✅ **Landed.** `lib/core`'s mid-weights, in six commits. `validation` 95 → 0, `httpwsProtocol` 48 → 0, `pluginsManager` 44 → 0, `plugin` 24 → 0, `hotelClerk` 20 → 0, `tokenManager` 19 → 0, `tokenRepository` 17 → 0, plus the two base classes and the security models.

Repo-wide: strict **871 → 522**, adopted **207 → 226**. [TD-62](../type-debt-register.md#td-62) closed with it.

### One shape carried most of the layer: state that `init()` establishes

`Protocol.entryPoint` and `maxRequestSize`, `HttpWsProtocol`'s `server`/`wsConfig`/`httpConfig`, `ClusterCommand`'s REP socket and protobuf schema, `ClusterNode.nodeId`, `Redis.connectedClient` (K3's, finally used by its own file). Each is a field the constructor sets to `null`, `init()` fills, and everything afterwards reads unchecked — **forty-odd dereferences across the layer**.

They are accessors now: one throw, at the one place it can fail, instead of a guard at each call site that cannot. Where a spec assigns the field — `maxRequestSize`, `nodeId` — the accessor has a setter, because a field replaced by a read-only accessor is a behaviour change to every test double.

### The `_id` nullability that K1 measured, paid

[TD-62](../type-debt-register.md#td-62)'s remaining 24 sites were `lib/model/security`'s `_id: string = null`. K1 had measured making them honest as **+18 relocated errors** and reverted; the real figure was **+19**, and what K1's estimate did not include is that the widening reaches three *already adopted* files, so the ratchet refused the commit until those were fixed too. That is the property to keep: the ratchet makes the real cost non-negotiable instead of letting it drift.

It surfaced `ObjectRepository` building cache keys and deletions from `object._id` without ever checking — a model that has never been stored addresses `repos/<index>/<collection>/null`, silently. There is a single `idOf()` that refuses, at the four sites.

### Defects

- **`initMapping`'s eighteen aliases could not be assigned.** `memoryStorageController`'s command table was *annotated* `RedisCommandMapping`, so every read-back was `CommandArguments | undefined`. `satisfies` checks it against the same type — which is what contextually types the `map` closures, the reason the annotation was there — while leaving the entries known.
- **`setHeader("Content-Length", null)`** set the header to the string `"null"`; `setHeader` does `String(value)`. `removeHeader` is what the comment says it does.
- **`wsOnMessageHandler` read `connection.id` six times** without checking the map answered. A socket torn down by `wsOnCloseHandler` has nothing to answer on, not even a rate-limit error.
- **`HttpWsProtocol.init` never awaited `super.init()`**, which sets the two values `parseWebSocketOptions` reads two lines down.
- **`getActions` raised a TypeError for a controller `isController` says does not exist** — through `isAction`, which is the pair's whole point.
- **`PluginPipeDefinition.pipeId` was `string | null`** while its constructor answers `pipeId || uuidv4()`.
- **`init(null, entryPoint)` threw on all three protocol subclasses**, though the base class publishes that call shape. `Protocol.entryPointOf` normalises it once and `Protocol.InitArgs` is the implementation signature the three overrides share.

### `bindPluginMethod` is the deferred decision, taken

Its annotation answered `undefined` and said so in its own comment, deferring the choice to _"the day this file joins `strict-adopted`"_. That day was this slice: it throws, and the three callers keep no guard for a value that cannot exist. **A deferral written into a type is a decision with a trigger; the trigger fired.**

---

## What K5 found

✅ **Landed.** Ten commits, and it emptied the step: **`strict-check.sh --count` is empty and all 263 production files are adopted.**

Repo-wide: strict **522 → 0**, adopted **226 → 263**, implicit-any **197 → 30**, `any` **180 → 178**, `casts` unchanged at 84.

### Three levers that each paid across files

1. **`assertHasBody` carries its check.** It is an assertion signature now — `asserts request is RequestWithBody`. `input.body` is `JSONObject | null` on every request and the controllers read it straight after asserting it: thirty-five times in `memoryStorageController` alone. The check existed; it did not reach the reads.
2. **`request.context` and `request.input` are getters, so a check on one of their properties never narrows the next read of it.** That is one line of TypeScript semantics and it accounts for ~40 errors across `authController`, `funnel` and `pluginContext`. Read once into a local, or ask a helper that throws — `userOf`, `tokenOf`, `targetOf`.
3. **`satisfies` instead of an annotation**, wherever a literal table is both checked against a type and read back by key: the Redis command table, `kerror`'s nine domains.

### Seven defects, three of them visible to a client

- **`kerror.get("notconnected")` matched no error.** The code is `services.cache.not_connected`, with the underscore both Elasticsearch wrappers spell correctly. Every command issued while the cache adapter was down raised `core.fatal.unexpected_error`.
- **Both ES wrappers declared one mapping entry `subCode` where the reader asks `subcode`.** `es_rejected_execution_exception` therefore fell through to `core.fatal.unexpected_error`: `services.storage.too_many_operations` was unreachable. _Two error names, found the same way — by declaring what a name is, not by reading the code._
- **`Kuzzle.id` was declared `string` and assigned nowhere.** Every reader of `global.kuzzle.id` read `undefined`: the redis `SETNAME`, the cluster ID card, and the `node` field of every realtime notification. `accessLogger` sends `global.nodeId` to its worker and reads it back as `kuzzle.id`, which is what says the two are the same value.
- **`auth:logout` cleared its cookie by serialising `null`**, so the header read `authToken=null`. The funnel has carried an explicit `=== "null"` check for that string ever since — the fossil of the bug, and the reason it never surfaced.
- **`auth:getCurrentUser` answered `strategies: [[]]` for the anonymous user.**
- **`promiseAllN([])` answered `undefined`, not a promise** — its guard read `return resolve([])`, the resolver's return value.
- **`performDocumentAlias` indexed its alias table with a possibly-null action, twice.**

### `Kuzzle.id` is the one behaviour change to watch

Three carriers change from absent to the node's name: the redis client name, the ID card's `id` field, and `node` on every realtime notification. All three were documented as carrying it. The functional suites are the check; nothing in the unit suites pinned `undefined`.

### Four more local declarations, and the rule held

`rc`, `ndjson`, `json2yaml` — plus `jsonwebtoken` and `sorted-array` earlier in K4. Same reasoning as `ms`/`semver` in K3 and `didyoumean` in K1: a dependency change is not a typing slice's to make, and each declares only what Kuzzle calls.

### Two ratchets misfired, and both were informative

- **`any` rose by 1 with no `any` added.** The ratchet greps *lines*, and Prettier had split a two-parameter signature across two lines. This is [TD-73](../type-debt-register.md#td-73)'s fourth telling. It went to 178 once the two parameters were actually typed.
- **`casts` rose by 1 on an `event as string` added three lines below an identical one.** Naming the value once served both.
