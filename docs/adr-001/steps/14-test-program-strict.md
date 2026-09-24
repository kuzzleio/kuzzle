# Step 14 — the test program under `strict`

**Status:** 🟦 In progress · **Opened:** 2026-09-24 · **PR(s):** M0 [#2867](https://github.com/kuzzleio/kuzzle/pull/2867) · M1a [#2868](https://github.com/kuzzleio/kuzzle/pull/2868) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Take `tsconfig.tests.json` from `strict: false` to parity with the production
program, and delete the second program when it is empty.

## Why this is a step and not a slice of [step 13](13-sprint-10-test-closure.md)

[Step 12's K6](12-sprint-9-strict-flip.md#what-k6-found) flipped `strict` in
`tsconfig.json` and discovered that `strict` is a property of a **program**: the
specs were in that program, so flipping it there put their errors in the build's
path. The resolution was two programs — production strict, tests not — and K6
measured 773 errors on the test side, 65 of which it attributed to step 13.

Step 13's [L7a](13-sprint-10-test-closure.md#what-l7a-found) re-measured after
L0–L6: **1 077**, and the reason is the step itself. It ported 3 092 Mocha tests
into 3 764 vitest tests across 153 files, all authored against a program with
`strict: false`. ADR-0001's Definition of Done asks for `strict` in the build and
for zero Mocha specs; it does not ask for strict test code. Bundling this into a
closure slice would have done to step 13 what
[its perimeter split](13-sprint-10-test-closure.md#perimeter--this-step-is-the-unit-suites-not-cucumber)
refused to do with cucumber's 708 — make the step unreadable and its finish line
arbitrary.

**So this is its own step, and it is planned from numbers the way step 13 was.**
It also absorbs the cucumber debt step 13 set aside, because the two share one
program and there is no way to flip half of it.

## Scope, measured 2026-09-24 on `2-dev` (L7a + L7b applied)

`tsconfig.tests.json` with `strict: true` and nothing else changed:

| Directory              | Errors | Files with ≥1 | Files total |
| ---------------------- | -----: | ------------: | ----------: |
| `features-legacy/`     |    638 |            24 |          35 |
| `tests/`               |    388 |        **52** |     **153** |
| `features/`            |     44 |            12 |          19 |
| `start-kuzzle-test.ts` |      5 |             1 |           1 |
| `.ci/`                 |      2 |             1 |           1 |
| **Total**              | **1 077** |        **90** |     **209** |

Adding `noUncheckedIndexedAccess: true` — full parity with the production
program — takes it to **1 448**. The +371 is a separate decision, kept at the end
of the plan, because that flag is a different argument from `strict`: it is right
for `lib/`, and in a spec `data[0]` is usually an assertion about a fixture the
same spec just wrote.

### What the errors actually are — and they are not one debt

By diagnostic, over the whole program:

| Code      | Count | What it is                                                          |
| --------- | ----: | ------------------------------------------------------------------- |
| `TS7006`  | **613** | Implicit `any` on a **parameter**                                   |
| `TS7005`  |   159 | Implicit `any` on a **variable** (used after an un-annotated `let`) |
| `TS18047` |    56 | "possibly `null`"                                                    |
| `TS7034`  |    46 | An un-annotated `let` whose type cannot be inferred                 |
| `TS2345`  |    46 | Argument type mismatch                                              |
| `TS2322`  |    42 | Assignment type mismatch                                            |
| `TS2683`  |    32 | `this` implicitly `any`                                             |
| _others_  |    83 |                                                                      |

**The split between the two suites is the finding, and it decides the slicing:**

| | `features-legacy/` (638) | `tests/` (388) |
| --- | ---: | ---: |
| `TS7006` — implicit-any parameter | **569 (89%)** | 27 (7%) |
| `TS7034` + `TS7005` — the un-annotated `let` | — | **191 (49%)** |
| `TS18047` + `TS18048` — nullability | — | 64 (16%) |
| `TS2322` + `TS2345` — type mismatch | 6 | 79 (20%) |
| `TS2341` — a private member | — | **8** |

**Cucumber's debt is one shape repeated 569 times**: a step-definition or
support-API callback whose parameters are un-annotated. It is dense —
`features-legacy/support/api/apiBase.ts` alone holds 186 and
`support/api/http.ts` 177, so **363 of 638 are in two files**. It is close to a
codemod, and it is the cheapest 59% of the whole step.

**The vitest suite's debt is different and is half one shape too**: 191 of 388
are an un-annotated `let` that TypeScript gives an evolving `any`. One annotation
each, and they are in the specs step 13 wrote.

⚠️ **Eight of them are not mechanical, and they are worth reading before
anything else.** `TS2341` is a spec reaching a **private** member —
`tests/cluster/command.test.ts` touching `ClusterCommand`'s `protoroot`, `server`
and `state`. That is [step 13's L6](13-sprint-10-test-closure.md) finding
arriving through the type system instead of through `rewire`: *reaching a private
binding means the test was written against an implementation detail.* L6 answered
it by changing the subject or the test, never by widening the type, and this step
inherits that rule.

### Concentration

`tests/`'s 388 errors touch **52 of 153 files** — two thirds of the suite is
already strict-clean — and five files hold 174 of them:

| Spec                                                  | Errors |
| ----------------------------------------------------- | -----: |
| `tests/core/backend/backendImport.test.ts`            |     58 |
| `tests/api/request/request.test.ts`                   |     38 |
| `tests/core/realtime/hotelClerk.test.ts`              |     35 |
| `tests/cluster/command.test.ts`                       |     23 |
| `tests/api/controllers/securityController/users.test.ts` | 20 |

## How the flip is staged

The same technique K6 landed on, and for the same reason — `strict` is a property
of a program, so a directory changes standard by changing program, not by being
edited:

- **`tsconfig.tests.json`** keeps `strict: false` and **shrinks**;
- **`tsconfig.tests.strict.json`** is added, `strict: true`, and **grows**;
- `npm run typecheck:tests` runs both, so nothing leaves checking at any point.

The step ends when the non-strict program is empty and its file is deleted — at
which point the specs can very likely move back into `tsconfig.json` as one
program, which is the shape the repo had before K6 and the thing to verify rather
than assume.

## Slices

Ordered so each is independently mergeable and the strict program only grows.

| #      | Content                                                                                             | Errors | Why this grouping                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** ✅ | `start-kuzzle-test.ts`, `start-kuzzle-dev.ts`, `.ci/`, `scripts/` — and the two-program machinery |  **7** | Two files. It is where the staging mechanism is built and proven, at a size where a mistake in it is visible. See _[What M0 found](#what-m0-found)_.           |
| **M1** | `features-legacy/support/api/**` — **a** `apiBase.ts` ✅ (186) · **b** `http.ts` (177)                | **363** | 34% of the step in two files, one diagnostic. The support API is also what the step definitions call, so typing it first is what makes M2 smaller than it looks. One file per PR: 2 651 lines between them. See _[What M1a found](#what-m1a-found)_. |
| **M2** | the rest of `features-legacy/`                                                                       |    275 | 22 files, same shape, now against a typed support API.                                                                                                          |
| **M3** | `features/`                                                                                          |     44 | 12 files, ~4 errors each. Thin and unrelated to M1/M2's shape; last of the cucumber work.                                                                        |
| **M4** | `tests/` — the un-annotated `let` (`TS7034`/`TS7005`) across the suite                               |    191 | One shape, 49% of the vitest debt. Mechanical, and doing it first shrinks every file the later slices open.                                                     |
| **M5** | `tests/` — the five hot files, whatever is left in them                                              |   ~120 | Each is a PR's worth of review on its own; four of the five are step 13 ports, so the author of the debt is in the git blame.                                    |
| **M6** | `tests/` — the tail, **including the 8 `TS2341`**                                                    |    ~77 | ⚠️ Not mechanical. A private member reached from a spec is L6's finding again: fix the subject or the test, never the visibility.                                |
| **M7** | The flip: delete `tsconfig.tests.json`, fold the specs back into one program if that holds           |      — | Only correct when the non-strict program is empty. K6's lesson applies verbatim — diff what the build emits before and after.                                    |
| **M8** | **A decision, not a slice:** `noUncheckedIndexedAccess` on the test program                          |   +371 | Right for `lib/`; in a spec, `data[0]` is usually an assertion about a fixture the same spec wrote three lines up. Argue it, then do it or record why not.      |

**M1 + M2 + M4 = 829 of 1 077 (77%), and all three are one annotation per site.**
The step is far more mechanical than its total suggests; what it is not is small.

## Definition of done

- [ ] `tsconfig.tests.json` deleted, or its `strict: false` removed.
- [ ] `npm run typecheck:tests` green with `strict: true` over `tests/`,
      `features/`, `features-legacy/`, `.ci/`, `scripts/` and the
      `start-kuzzle-*` entrypoints.
- [ ] No error silenced by a widening: no `any`, no `!`, no `@ts-expect-error`
      without a register entry. The fix removes the error rather than moving it —
      [ADR-0001 › Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file),
      which applies here even though nothing is being converted.
- [ ] `TS2341`'s eight sites resolved by changing the subject or the test, per
      [step 13's L6](13-sprint-10-test-closure.md).
- [ ] `noUncheckedIndexedAccess` decided either way, in writing.

## What M0 found

**The machinery is three files and one line in `package.json`**, and it works the
way the plan said:

- **`tsconfig.tests.strict.json`** — `strict: true`, `noEmit`, and an `include`
  list that grows one slice at a time. It opens holding `.ci/scripts/**`,
  `scripts/**` and the two `start-kuzzle-*.ts` entrypoints.
- **`tsconfig.tests.json`** — unchanged except for an `exclude` list that names
  the same paths, under a comment marking it as **the step 14 line**. When that
  list covers everything the file is deleted.
- **`npm run typecheck:tests`** runs both, so a path that leaves one program and
  does not arrive in the other fails immediately rather than going quiet.

⚠️ **`exclude` does not remove a file from a program that imports it.**
`tests/ci/coverageGate.test.ts` imports `.ci/scripts/coverage-gate.ts`, so the
non-strict program still pulls it in through the import graph and checks it
non-strictly, while the strict program checks it strictly. That is harmless — the
stricter check is the binding one and both run — but it means **`exclude` is not
how a file is removed from checking, only from being a root**. Worth knowing
before M4, where the same relationship runs the other way round.

### The seven errors, and what each one actually was

Three of them were the un-annotated-binding shape the plan predicted, and the
other four each said something:

- **`TS18048` ×2, `coverage-gate.ts`** — `totals.get(current)` is
  `Totals | undefined` on a map the same loop had just written to. The fix is not
  a `!`: the loop now **holds the record it is filling** instead of looking it up
  again by its path. Re-reading a map you have just written to is something a
  reader has to check too, so strict was pointing at a readability problem as much
  as at a type.
- **`TS7016`, `should/as-function`** — `should` ships a declaration for its main
  entry only, and the main entry extends `Object.prototype` on import, which is
  exactly why a test entrypoint uses the subpath. Declared in
  **`tests/types/should-as-function.d.ts`**, not in `lib/types/`: `should` is a
  test dependency — it outlived Mocha as cucumber's assertion library
  ([L7a](13-sprint-10-test-closure.md#what-l7a-found)) — and nothing in `lib/` may
  import it. Both programs include `tests/types/**/*.d.ts`.
- **`TS2345`, `plugin.use`'s options** — the call passed `null` where the
  parameter is optional. **An optional parameter admits the absence of a value,
  not a null one**, and the two are not the same claim; `undefined` is the fix.
- **`TS7034`/`TS7005`, `dynamicPipeId`** — a bare `let`. Annotating it honestly is
  `string | void`, because `pipe.register` answers a pipe id only when the
  application is **already started**, and nothing when the registration is queued
  before start. The handler that unregisters it then has a real absent case, which
  it now throws on by name instead of handing `undefined` to `unregister`.
  _Typing the variable is what turned up the untested path; this is the step's
  first instance of the thing that makes it worth doing at all._

### `.gitignore` said hand-written declarations only ever live in `lib/types/`

```
*.d.ts
# ...except hand-written declarations, which only ever live here.
!lib/types/*.d.ts
```

The repo ignores `*.d.ts` because `tsc` emits them, with one exception for the
hand-written ones — and the comment stated, as a fact about the repo, that they
only ever live in `lib/types/`. `tests/types/should-as-function.d.ts` was
therefore created, used, and **silently untracked**: both type-check runs were
green locally and the file would simply not have existed in CI.

This is [TD-64](../type-debt-register.md#td-64)'s lesson in a different file —
_a convention that maps names to files encodes an assumption about which files
exist yet_ — and the assumption here was that test code never declares anything.
The rule now carries both directories and says why the split is load-bearing
rather than tidy: nothing in `lib/` may import a test dependency.

### What M0 says about the rest of the step

Two of the seven were a bare `let` — **the shape M4 is 191 of** — and both were
mechanical. But `plugin.use`'s `null` and `dynamicPipeId`'s `void` were not: each
was a place where the code and the type disagreed about whether something could
be absent, and in one of them the answer was a path nobody had tested.
**The plan's "829 of 1 077 are one annotation per site" is a statement about the
diagnostics, not about the diffs**, and M0's ratio — 3 mechanical, 4 not, out of
7 — is too small a sample to revise it with. M1 is 363 of one diagnostic in two
files and will answer the question properly.

## What M1a found

**`features-legacy/support/api/apiBase.ts`: 186 errors → 0, and the diff is
type-only** — every removed line is a method signature, an `abstract`
declaration, one `const msg = {`, or one `.then`/`.catch` callback. Checked
mechanically rather than by reading, because at 118 changed lines a reading is
not evidence.

**178 of the 186 were one diagnostic, `TS7006`, and they were generated rather
than typed by hand**: a name → type table applied to every un-annotated
parameter of every method, `index`/`collection`/`id`/`userId`/`strategy` →
`string`, `body`/`query`/`args` → `JSONObject`, `ids`/`roles` → `string[]`. The
table left **nothing** unmatched on the first run, which is itself the finding
about this file: it is a wrapper whose parameters are named after what they are.

### The eight that were not the table

- **`TS7053` ×5** — `msg[k] = item` on an object literal. The file already had
  the answer: `ApiMessage`, its own alias, which the literal was simply not
  annotated with. _An inferred literal type has no index signature, and a loop
  that writes runtime keys needs one._
- **`TS7010` ×2** — the two `abstract` members, `send` and `sendAndListen`, with
  no return type. They are the whole point of the class, so a wrong guess here
  would land on every one of the ~120 methods that call them. Typed
  `Promise<ApiResponse>` with `ApiResponse` a named alias, because the suite
  asserts on `.result`, `.error` and `.status` by hand and **pinning a shape
  would be inventing one no step definition agrees to**.
- **`TS7006` ×2** — the `.then`/`.catch` pair in `checkToken`, the only callbacks
  in the file.

### ⚠️ M1's annotations are claims that M2 checks

`world.api` is typed (`HttpApi | MqttApi | WebSocketApi`), so a call site that
goes through a typed receiver verifies these annotations. **Many do not:** the
step definitions hold 32 `TS2683` — _`this` implicitly has type `any`_ — and a
call on an `any` receiver is not checked against anything. So the 178
annotations are, today, **inferred from each method's body and confirmed by the
call sites that happen to be typed**.

That is not a reason to widen them to `any` — an annotation that is never
checked and an annotation that is wrong are both fixed by typing `this`, and
only one of them says something in the meantime. But it does mean **M2 is not
only the remaining 275 errors: it is the verification pass for M1**, and a
`string` that should have been `string | null` will surface there rather than
here. Sequencing M1 first was still right — a typed `this` against an untyped
API would have produced the same 178 errors at 24 call-site files instead of one
declaration file — but the plan's "M1 is what makes M2 smaller than it looks"
should read **"M1 is what makes M2 a check rather than a rewrite."**
