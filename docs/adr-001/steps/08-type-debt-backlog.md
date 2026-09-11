# Step 08 — Type-debt backlog, worked in parallel with the sprints

**Status:** 🟦 In progress — 17 findings closed (TD-21 · TD-22 · TD-23 · TD-26 through TD-32 · TD-38 · TD-39 · TD-40 · TD-41 · TD-44 · TD-45 · TD-47), TD-33 and TD-42/43/46/48 open
**Date:** 2026-09-09 → …
**PR(s):** all merged into `2-dev` — TD-26 [#2699](https://github.com/kuzzleio/kuzzle/pull/2699) · TD-21 [#2700](https://github.com/kuzzleio/kuzzle/pull/2700) · TD-23 [#2701](https://github.com/kuzzleio/kuzzle/pull/2701) · TD-22 [#2702](https://github.com/kuzzleio/kuzzle/pull/2702) · TD-27 [#2709](https://github.com/kuzzleio/kuzzle/pull/2709) · TD-28 [#2710](https://github.com/kuzzleio/kuzzle/pull/2710) · TD-31 [#2711](https://github.com/kuzzleio/kuzzle/pull/2711) · TD-29 [#2712](https://github.com/kuzzleio/kuzzle/pull/2712) · TD-30 [#2713](https://github.com/kuzzleio/kuzzle/pull/2713) · TD-32 [#2716](https://github.com/kuzzleio/kuzzle/pull/2716); TD-34 + TD-35 in the post-merge fix pass
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md) · **Register:** [type-debt register](../type-debt-register.md)

## Goal

The [register](../type-debt-register.md) accumulates findings faster than the sprints can absorb them, and step 06 made the rule explicit: *a review finding ends as a ratchet, an adopted-list entry or a GitHub issue — never as prose alone.* An issue that nobody schedules is prose with extra steps, so the register's tracked findings are burned down as a **parallel track**: small, single-purpose PRs that do not sit in a sprint's critical path.

This step is the execution log of that track. It stays open for as long as the register has open findings.

## What was done

### TD-26 — the five `await`s of a non-Promise ([#2699](https://github.com/kuzzleio/kuzzle/pull/2699), `914341a31`)

Five `await`s on values that are not thenable (`typescript:S4123`), each deliberately preserved across its conversion PR because dropping an `await` shifts the enclosing async function's resolution by a microtask — a behaviour change a conversion must not make. Done in one pass, outside any conversion: `funnel.processRequest` → `_checkSdkVersion()`, `roleRepository.load` / `validateAndSaveRole` → `Map.set()`, `security/index.init` → `role.init()` / `profile.init()`.

Two specs had **encoded the bug**: they stubbed a synchronous method with a rejected promise, which now resolves nowhere. Both re-baselined to throw, which is what the real signature does. That is the tell worth keeping: *when a spec can only pass because of a pointless `await`, the spec is asserting the defect.*

### TD-21 — `_wrapError`'s dead guard ([#2700](https://github.com/kuzzleio/kuzzle/pull/2700), `65a9e0987`)

`Funnel._wrapError` called `isNativeController(request)` where the method expects a controller **name**, so the guard was always false and every non-`KuzzleError` was reported as `plugin.runtime.unexpected_error` — native controllers included. Latent since the JavaScript version; the sprint-4 conversion only turned the argument mismatch into a type error (papered over with `as unknown as string` at the time, which is why the written-`any` count could then drop 208 → 207).

Fixed by guarding on `request.input.controller`. ⚠️ **The 2026-09-10 review found this fix reaches wider than intended** — see below.

### TD-23 — the first CPD exclusion removed ([#2701](https://github.com/kuzzleio/kuzzle/pull/2701), `a1053736f`)

`sonar.cpd.exclusions` is the one list in this migration that may only **shrink**: every entry added to get a conversion PR through the new-code gate disables duplication detection on that file forever. `documentController.ts` is the first entry to go.

`mExists`/`mGet` differed only in the storage event, and `createOrReplace`/`replace` only in the event, the notification action and what that notification carries. They now delegate to `_mFetch(request, methodName)` and `_writeDocument(request, methodName, action)`, modelled on the `_mChanges` helper the file already had. **Equivalence note:** both helpers reproduce their originals' statement order exactly (argument extraction → `getIndexAndCollection` → `getBoolean("strict")` → `assertNotExceedMaxFetch` → `ask` → guard → return); the two quirks the duplication was hiding are preserved and *commented* rather than copied — `mGet`'s `@todo` about empty successes, and `replace` notifying the request's own payload where `createOrReplace` notifies the storage response.

4 exclusions remain: `httpRoutes.ts` and the two `esWrapper.ts` are declared irreducible by nature, so the real remaining target is `memoryStorageController.ts`.

### TD-22 — `memoryStorageController` typed ([#2702](https://github.com/kuzzleio/kuzzle/pull/2702), `c4d93aa54` + `08983c1cf` + `f396617f7`)

The largest inferred-`any` pocket of the converted set: 0 written `any` and 54 implicit ones, cascading into 37 `TS2339` because the Redis-command table was an untyped `let`. The table now has names (`CommandArgumentPath`, `CommandArgumentSpec`, `CommandArguments`, `RedisCommandMapping`, plus `GeoPoint`/`FieldEntry`/`KeyEntry` for the three shapes the closures assert at runtime). **implicit-any 518 → 464**, the file's own diagnostics 91 → 0, its strict errors 122 → 54, written `any` unchanged.

Three things worth keeping:

- **`mapping` deliberately stays a `let`** assigned by `initMapping()`: the Mocha spec's `__set__({ mapping })` writes to that binding on the compiled CJS, which a `const` would make throw. Emitted JavaScript unchanged.
- **The coverage gate scored the typing pass at 62.4%** — every annotated line counts as new, and the Mocha spec swaps the real command table for a 6-command fixture, so none of the table's own `map` closures had ever run. Fixed by driving the **real** table from vitest (17 tests through the public actions, argument lists asserted, rejection paths included): 86.9%. *Typing a file re-scores it; a spec that mocks the thing being typed cannot pay for it.*
- **`scalarToString`** replaced `String(value)` in `assertFloat`/`assertInt` to stop stringifying an `unknown` (S6551). Parity holds for everything JSON can carry; it is **not** exact for an object with a numeric `toString()`/`valueOf()` or a bigint, which used to parse and are now rejected. Unreachable from a parsed request body, recorded here rather than left implied by the commit's "exactly as `Number.parse*` did".

## Post-sprint review — 2026-09-10

The five PRs merged into `2-dev` ([#2698](https://github.com/kuzzleio/kuzzle/pull/2698) plus the four above) were re-read against the ADR. State verified locally: `tsc --noEmit` clean, the four ratchets at equality (js 50 · mocha 151 · any 207 · implicit-any 464), `test:strict` 101/101 with `--candidates` empty, CI green on `2-dev`.

The conversions and the dedup hold up — the helpers are equivalent statement for statement, the `await` removals are all genuinely non-thenable, and TD-22's five type assertions are each preceded by a runtime `assertBodyAttributeType`. Five findings, all filed:

| Finding | Sev. | Issue |
|---|---|---|
| TD-21's fix is scoped to the wrong place: `_wrapError` is the shared funnel for controller errors *and* two plugin-pipe paths, so plugin pipes changed too; and an unwrapped error loses its `id`/`code` in `setError` | 🟠 med | [#2703](https://github.com/kuzzleio/kuzzle/issues/2703) |
| `memoryStorageController`'s class-wide `[command: string]: unknown` index signature makes the whole controller surface untyped — and no ratchet charges for it | 🟠 med | [#2704](https://github.com/kuzzleio/kuzzle/issues/2704) |
| The DoD claims all 4 remaining `bin/` `.js` are plugin fixtures; `bin/copy-binaries.js` is build tooling, so the `js` floor is 3 | 🟡 low | [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) |
| TD-23's helpers take `methodName: string` / `action: number`, and `_writeDocument` branches on `action` rather than the method, so the two arguments can disagree | 🟡 low | [#2706](https://github.com/kuzzleio/kuzzle/issues/2706) |
| Nothing charges for `@ts-ignore`: 4 in `lib/`, 2 without a reason or a ticket, against a standard that forbids exactly that | 🟡 low | [#2707](https://github.com/kuzzleio/kuzzle/issues/2707) |

### The lesson behind #2703, worth generalising

A guard placed on a **shared funnel** cannot express a fact about a **single source**. `_wrapError` receives errors from the controller, from the `<controller>:error<Action>` pipe and from `request:onError`; "was this thrown by native code?" is only answerable where the error is raised. The correction is to decide at the source (wrap the `doAction` call) and let the funnel keep its one honest rule. The same shape will recur wherever a conversion inherits a predicate applied too late.

The second half of that finding matters more than the mislabelling it fixes: an error that traverses `_wrapError` unwrapped ends in `KuzzleRequest.setError` → `new InternalError(error)`, i.e. **`id: undefined`, `code: undefined`** on a 500 sent to a client, while Kuzzle's whole error contract is built on documented id/code pairs. Keeping the change a `fix` rather than a breaking one therefore means routing native-controller crashes to the already-documented `core.fatal.unexpected_error` instead of letting them through raw.

### Process findings

- **`Closes #NNN` does not fire on `2-dev`.** GitHub only resolves closing keywords on the default branch (`master`), so #2687, #2690 and #2697 stayed open after their PRs merged while the register already marked them ✅. Closed by hand on 2026-09-10; **closing the issues is now part of the `wrapup` ritual**, not a side effect of merging.
- **The hub drifted from the counters** it publishes (any 208 vs 207, implicit-any 518 vs 464) as soon as PRs landed outside a sprint step. The parallel track moves the ratchets too, which is the other reason it needs this step file rather than register lines alone.

## Validation

- Every PR merged green: `tsc --noEmit`, lint, prettier, the four ratchets, the full Mocha suite and the vitest suite, plus the SonarCloud gate on each.
- Repo state after the first four PRs (2026-09-10 on `2-dev`): js 50 · mocha 151 · any 207 · implicit-any 464, strict adopted 101.
- Repo state after all ten plus the post-merge fix pass: **js 49 · mocha 151 · any 205 · implicit-any 462**, strict adopted **102** (`--candidates` empty). Mocha **3 030** passing, vitest **183** passing (13 files).
- Only TD-30 adopted a new file into strict (`bin/copy-binaries.ts`, 101 → 102); `funnel`, `documentController` and `memoryStorageController` all still fail strict (the last one at 54 errors, down from 122).

## What was done (the review's follow-ups, 2026-09-10)

All five findings became single-purpose PRs off `2-dev`, none stacked. [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) was first triaged as "a decision, not a patch", but the decision was taken in the same pass and shipped with [#2713](https://github.com/kuzzleio/kuzzle/pull/2713), so it is closed like the rest.

### TD-27 — the guard moves to the error's source ([#2709](https://github.com/kuzzleio/kuzzle/pull/2709))

`processRequest` wraps only the `doAction` call, through `_wrapControllerError`; `_wrapError` returns to its pre-TD-21 rule and **loses its guard entirely**. The constraint that shaped the fix was Ricky's: *this must stay a `fix`, never a breaking change.* It does — pipes and plugin controllers keep `plugin.runtime.unexpected_error` verbatim, status stays 500, `getFrom` keeps the source stack, and the only client-visible delta is the `id` of a crash inside a native controller (`plugin.runtime.unexpected_error` → the documented `core.fatal.unexpected_error`, where TD-21 had left `id` and `code` `undefined`).

The generalisable part: **a predicate about one caller cannot be expressed where several callers converge.** `_wrapError` is downstream of the controller *and* of three pipes; "was this thrown by native code?" is only answerable where the error is raised.

### TD-28 — the ratchet chose the fix ([#2710](https://github.com/kuzzleio/kuzzle/pull/2710))

The issue recommended replacing the class-wide index signature with a localised `this as unknown as Record<string, CommandAction>`. That was written first, and **the `any` ratchet rejected it at 208 > 207** — it counts `as unknown as`. The cast-free `Reflect.set(this, command, buildCommandFn(command))` came out of that refusal, and it is strictly better: no cast, class surface closed, and the same idiom `impersonatedSdk` already uses for a runtime-built key. A ratchet earning its keep by making a proposed solution too expensive is worth recording as much as one catching a regression.

### TD-31 — the disagreement removed, not documented ([#2711](https://github.com/kuzzleio/kuzzle/pull/2711))

`_writeDocument` **derives** the notification action from the method instead of taking both, so the two can no longer contradict each other; the method names become unions. `_mChanges` keeps `action` (it varies over five methods) but takes the `as const` enum's value type.

### TD-29 — `ban-ts-comment`, and two suppressions deleted ([#2712](https://github.com/kuzzleio/kuzzle/pull/2712))

The rule is an error on `.ts`; `@ts-expect-error` is allowed only with a description, and is preferred over `@ts-ignore` because it fails once the error it hides disappears.

Two of the three undocumented sites did not need a suppression at all — `embeddedSdk` writes `propagate` with `Reflect.set` (its own idiom, two lines below), and `Profile._hash` is declared as the patchable static it is. **The suppression was hiding a mis-declaration:** `static _hash() { return false; }` never described the real contract, since `profileRepository` replaces it with `global.kuzzle.hash` at startup and uses the `false` return as its "not patched yet" probe. A bare `@ts-ignore` is often a wrong declaration wearing a hat.

### TD-30 — converted, and a wrong risk assessment corrected ([#2713](https://github.com/kuzzleio/kuzzle/pull/2713))

The DoD wording and the ratchet floor (3, not 4) are corrected, and the file is **converted rather than exempted** — decision taken with Ricky after the options were laid out. It is run through `tsx` **from the source tree** (`npx tsx ./bin/copy-binaries.ts`), which is already how CI runs `.ci/scripts/prepare-coverage.ts`; because the script stays in `bin/`, `path.join(__dirname, "..")` still resolves to the repository root and **not one path needed changing**. js 50 → 49, `bin/` at its floor of 3 fixtures, file adopted into strict (102).

Running the compiled `dist/bin/copy-binaries.js` was the alternative, and was rejected for a concrete reason: from `dist/bin/`, `__dirname/..` is `dist/`, so the script would read its sources from `dist/lib/` and write into `dist/dist/` — source and target roots would have had to be split apart, on release tooling whose failure mode is a **published package silently missing its `.proto` files**. Identical outcome on the ratchet, strictly more risk. The build's payload was checked rather than assumed: `.proto` files present, `start-kuzzle-server` at mode 755, `dist/bin/copy-binaries.js` still emitted so `package.json`'s `files` entry stays valid.

> **Correction worth recording.** The review's first pass claimed the emit path was at risk because `tsconfig.json` sets `rootDir: "lib/"` while including `bin/`. It is not: `rootDir` sits **outside** `compilerOptions`, so tsc ignores the key entirely — `dist/` already mirrors the repository root and `dist/bin/copy-binaries.js` was already emitted from the `.js` source under `allowJs`. A risk asserted from a config line read too fast, and it nearly picked the worse option. The dead key is now [TD-32](../type-debt-register.md#td-32) / [#2714](https://github.com/kuzzleio/kuzzle/issues/2714): it cannot simply move into `compilerOptions`, since `index.ts`, `bin/`, `features/`, `test/` and `tests/` all sit outside `lib/` and would each raise `TS6059`.

No spec ships with it: `sonar.sources` is `./lib`, so `bin/` is outside both the analysed and the coverage-measured scope, and the ADR's *"a file with no spec ships one"* rule targets product code. ⚠️ **That reasoning was right about specs and wrong about checks** — see TD-35 below.

## Second review — the seven merged PRs, 2026-09-10

The seven PRs above were merged into `2-dev` and re-read as landed code, this time with the suites actually executed rather than trusted from CI: `tsc --noEmit` clean, lint 0 error, the four ratchets at equality, `test:strict` 102/102, **Mocha 3 030 passing**, **vitest 183 passing**, `dist/` layout unchanged and its payload verified file by file.

**The direction holds and no API contract broke.** The single client-visible delta is the intended one: a crash *inside a native controller* now answers `core.fatal.unexpected_error` instead of `plugin.runtime.unexpected_error`, still 500, source stack preserved by `getFrom`. Plugin controllers and all three pipe paths are byte-identical to the released behaviour. Everything else is behaviour-preserving, and each equivalence was checked rather than assumed: `Reflect.set` ≡ assignment, `String(_hash(…))` ≡ the computed key's implicit coercion, `_writeDocument`'s derived action matches its two former call sites exactly (and the existing `#replace` / `#createOrReplace` specs already pin the notification action and payload, which is why TD-31 needed no new spec).

**Four defects the seven PRs introduced**, all fixed in one follow-up pass:

| Defect | From | Filed |
|---|---|---|
| `npm run build` dies wherever esbuild's binary does not match the platform, leaving `dist/` without its `.proto` files and entrypoint | TD-30 | [TD-35](../type-debt-register.md#td-35) |
| Nothing asserts the build's payload — the failure mode TD-30 named is the one it left ungated | TD-30 | [TD-35](../type-debt-register.md#td-35) |
| `Profile._hash`'s new overload declares `string \| false`; the installed patch returns a `number` | TD-29 | [TD-34](../type-debt-register.md#td-34) |
| `profileRepository` still casts the `_hash` site to `any`, which is what hid the wrong overload | TD-29 | [TD-34](../type-debt-register.md#td-34) |

Plus two cosmetic/consistency fixes taken in the same pass: a JSDoc block duplicated verbatim over `Profile._hash` (TD-29), and `baseController._addAction`'s `this[name] = fn` — the exact write TD-28 replaced with `Reflect.set` one file away — brought in line (implicit-any 464 → 462 together with TD-34).

### The two lessons

- **A declaration is only load-bearing once every caller is typed against it.** TD-29 correctly diagnosed a bare `@ts-ignore` as *"a wrong declaration wearing a hat"*, replaced the declaration, and left the `as any` at the only call site — so the new declaration was decoration, and it was itself wrong. The check after replacing a suppression is not "does it compile" but "**is there still a cast between this declaration and its callers**".
- **A risk you name in a decision record is a risk you should gate in CI.** TD-30 named the failure mode exactly — *"a published package silently missing its `.proto` files"* — weighed two options against it, and shipped no check for it. `.ci/scripts/check-build-payload.sh` now runs after `npm run build` in both the PR and the release workflow, and was verified negatively (skip the copy step, it fails on the three missing paths).

### Process finding

**Two functional scenarios can never pass under `docker-test.sh functional`.** `features/Network.feature:33` hardcodes `http://localhost:17510` and `features/Websocket.feature:5` hardcodes `ws://localhost:7512` — both are **host** port mappings (`17510:7512` on `kuzzle_node_1`, `7512:7512` on nginx), while the wrapper runs cucumber *inside* a container on the compose network, where `localhost` is the cucumber container itself. `ECONNREFUSED` both times: deterministic, environment-only, and unrelated to [TD-33](../type-debt-register.md#td-33)'s flake — CI is unaffected because there cucumber runs on the runner's host network.

Measured on `2-dev` + this pass: **155 scenarios, 153 passed**, the 2 failures being exactly those two. Until the wrapper reaches nodes by service name (or joins the host network), a local functional run is only conclusive read as *153/155 with those two known*.

## Third review — the follow-up pass itself, 2026-09-10

The four fixes above were re-read as landed code, on the same rule that produced them: *a risk you name is a risk you gate*. Two of them did not hold.

| Defect | From | Filed |
|---|---|---|
| The payload gate runs one build too early: `npm publish` re-runs `prepublishOnly` → `build`, which `rm -Rf ./dist` before packing the tarball | TD-35 | [TD-36](../type-debt-register.md#td-36) |
| The gate checked 6 hand-written paths while claiming to cover `files` — the error-code catalogue and `index.d.ts` were not among them | TD-35 | [TD-37](../type-debt-register.md#td-37) |
| `core/shared/store.ts`'s `this[method] = …` loop — the third instance of the write TD-28 replaced, after `memoryStorageController` and `baseController` | TD-28 | folded into [TD-28](../type-debt-register.md#td-28) |

Plus the `catch` in `copy-binaries.ts`, which reported *"Failed to copy protobuf definitions"* for a failure that is just as likely to be the entrypoint copy or its `chmod`.

`prepublishOnly` now carries the check, so the gate sits on the artifact that is packed rather than on a directory that is deleted first; and the check derives its expectations from `package.json`'s `files` list instead of restating it. implicit-any 462 → **461**.

**Validated on this pass:** `tsc --noEmit` clean, lint 0 error, four ratchets at equality, `test:strict` 102/102, **Mocha 3 030 passing**, **vitest 183 passing**, build payload green and failing correctly on all three sabotages.

### Process finding — the platform break was reproducible here all along

[TD-35](../type-debt-register.md#td-35) was argued from esbuild's error message. It is stronger than that: **this working tree's `node_modules` is Linux-installed**, so `npm run test:unit:mocha` dies in `re2.node` (*"slice is not valid mach-o file"*) and `vitest` dies in `rollup`'s native module — while `tsc` and `ts-node` run fine, which is exactly the property the fix relies on. The consequence for validation: **local unit runs are not available on this tree**, and both suites must go through `.ci/scripts/docker-test.sh unit <mocha|vitest>` (the `docker-tests` skill). A green "3 030 passing" in this log is a container's, not the host's.

**CI on [#2718](https://github.com/kuzzleio/kuzzle/pull/2718):** 51 checks green (lint ×3, error codes, ratchets & strict, unit ×6, build & run ES 7/8, SonarCloud gate pass) — **after one re-run**. The first round lost `Functional tests (http, 24, 7)` to a fourth [TD-33](../type-debt-register.md#td-33) occurrence, and with it the 29 variants `fail-fast` cancelled. New symptom, recorded there: `resetDatabase` + `refresh: "wait_for"` returned before the index deletion was visible to the next scenario's node.


---

## Fourth review — the sprint-6 conversions and the CI, 2026-09-11

The fifteen PRs merged into `2-dev` between [#2708](https://github.com/kuzzleio/kuzzle/pull/2708) and [#2724](https://github.com/kuzzleio/kuzzle/pull/2724) were re-read end to end: sprint 6's three conversions (H1/H2/H3), this track's ten, and the CI work of #2718/#2719/#2720.

The conversions hold up. H2's four latent bugs are real and correctly fixed — including the removal of `removeStacktrace` from the router, which was checked against `lib/util/stackTrace.ts`'s two branches, against `_res` being a `KuzzleRequest` that matches neither, and against the eight protocol call sites that do the real sanitising. H3's decision to write two specs rather than four assertions is this register's own rule working exactly as designed.

Eleven findings, [TD-38](../type-debt-register.md#td-38) → [TD-48](../type-debt-register.md#td-48), filed as [#2725](https://github.com/kuzzleio/kuzzle/issues/2725)–[#2735](https://github.com/kuzzleio/kuzzle/issues/2735). The register holds the detail; the three shapes they fall into are worth stating here.

**The gates are aggregates, and an aggregate hides its worst member.** H3 landed *under* the coverage threshold and the arithmetic pointed straight at the two files that were not really tested. H2 landed comfortably *above* it and three files went in with no spec at all — `context.ts`, which received a bug fix in that same PR, `protocol.ts`, which received a logic change, and `protocolManifest.ts`. Four latent bugs were found and fixed in H2 and **not one shipped a regression test**, because the aggregate was comfortable and the rule never fired. The same shape recurs across the tooling: the `any` ratchet counts the hatches it was told about while the debt moved to `as T`; the `js` ratchet counts `*.js` and had never seen two Node executables in `bin/`; `strict-check.sh` derived a verdict from a log and read an empty one as success. Every one of those was blind **in the direction of passing**.

**Twice, the standard was honoured and its purpose defeated.** [TD-40](../type-debt-register.md#td-40) and [TD-41](../type-debt-register.md#td-41) both refuse a cast the conversion standard forbids, and both arrive at the outcome the standard exists to prevent by a quieter route — a return type that does not describe what the function returns, and a parameter union the body cannot serve. A cast is counted by a ratchet and visible to a reader. A wrong type is cheaper than a cast at review time and more expensive everywhere after it.

**The CI gates what maintainers push, not what arrives.** [TD-38](../type-debt-register.md#td-38): three iterations went into making the build-payload gate real, and it lives in the one fork-gated job — along with, by way of `needs:`, 30 functional jobs and 6 monkey jobs.

### A finding corrected during verification

The first version of [#2725](https://github.com/kuzzleio/kuzzle/issues/2725) claimed a fork PR is never type-checked, on the grounds that `npm run build` appears only in the fork-gated `sonarqube` job. Reading `.github/actions/` rather than the workflow showed that `unit-tests` and `build-and-run-kuzzle` both run `npm run build` and neither is fork-gated, so `tsc` runs eight times on a fork PR. Corrected before any work started on it. *The workflow file is not the whole workflow; a composite action is where half of this repository's CI actually lives.*

## What was done (TD-38 · TD-39 · TD-44 · TD-45 · TD-47)

Five of the eleven in one PR, chosen on the same criterion every time: **tooling only, no runtime change**. Nothing under `lib/` is touched.

### TD-39 — `tests/` enters the linters, and Prettier becomes a gate

Both globs widened to `./lib ./test ./tests ./bin ./features ./features-legacy`, a new `prettier:check` script, and that script run in the `lint` job — `npm run prettier` had only ever *written*.

Its first run found **7 ESLint errors**, all `@typescript-eslint/no-shadow` and all the same pattern: a `vi.hoisted` factory whose inner `const` shadows the destructured binding it is returned as. Fixed by naming the inner one for what it is and aliasing on the way out (`const initCalls` … `return { calls: initCalls }`), across 4 spec files. One unformatted `features-legacy` fixture besides. 478 warnings remain, overwhelmingly `sort-keys`, which is `warn` project-wide and just as noisy on `test/`; they do not gate, and quieting them is not this PR's business.

### TD-44 — the strict check fails closed

The first attempt was wrong and is worth recording: it treated `exit > 1` as "tsc did not run", which broke on the first real run, because **tsc returns 2 both for "I found errors in your code" and for "I could not read your config"**. The status cannot separate the cases. The discriminator is the output's shape — a `^error TS` line with no `path(line,col)` prefix is a config- or CLI-level diagnostic (TS5xxx/TS6xxx/TS18003) and means the project asked for was never read.

Verified negatively three ways, and the first two were instructive:

| Injected failure | Result |
|---|---|
| `tsconfig.strict.json` with a broken `extends` | `❌ … could not read tsconfig.strict.json`, exit 2. **Needed the first guard:** with no usable config, tsc cheerfully fell back to compiling `dist/` and filled the log with genuine diagnostics about the wrong files — the second guard alone would have passed it. |
| `mv node_modules/typescript` away | `❌ … exited 1 without reporting a single file diagnostic`, exit 2. `npx` had silently downloaded the unrelated **`tsc@2.0.4`** package from npm, which prints a banner and exits 1. The old script read that as 125 passing files. |
| unmodified | `✅ strict: all 125 adopted file(s) pass.`, exit 0 |

Plus a guard on an empty `$ADOPTED`, which used to print `✅ all 0 adopted file(s) pass`.

### TD-45 — the `js` ratchet sees what Node executes

The predicate now matches the shebang as well as the extension. **The baseline goes up, 20 → 22.** That is the one direction this ratchet exists to forbid, and it is right here and only here: the metric did not regress, the instrument was wrong, and freezing a known-false floor to preserve a monotonic number would be the worse trade. `bin/start-kuzzle-server` and `bin/wait-kuzzle` are now in scope; the ADR's floor is corrected from 3 to 5.

### TD-38 + TD-47 — the workflow

A `build` job (`npm ci` → `npm run build` → `check-build-payload.sh`) with no fork condition, and `functional-tests: needs: [build, unit-tests]`. `sonarqube` keeps a build step of its own — its Mocha coverage run executes against `dist/`, and artifacts are not shared between jobs here — and keeps its `if:`, which is legitimate: a fork cannot reach `SONAR_TOKEN`.

Alongside it: a workflow-level `concurrency` group with `cancel-in-progress`, `permissions: contents: read`, `lint` off its 3-version Node matrix (ESLint's verdict does not depend on the Node major, and `lint` gates three other jobs), and `NODE_LTS_ACTIVE_VERSION` — referenced four times, **defined nowhere**, so two jobs had been running on whatever Node the runner image shipped — replaced by a declared `NODE_VERSION`.

Deliberately **not** done: pinning third-party actions to a commit SHA. Worth doing, a separate diff.

## Validation (2026-09-11, this PR's branch)

- `npm run ratchet` — five green (js **22**, mocha 150, any 205, implicit-any 457, cpd-exclusions 4)
- `npm run test:strict` — `✅ all 125 adopted file(s) pass`, and the three injected-failure cases above all exit 2
- `npm run test:lint` — exit 0, 479 warnings, **0 errors** (was 7 before the shadow fixes)
- `npm run prettier:check` — *All matched files use Prettier code style!*
- `.ci/scripts/docker-test.sh unit mocha` — **3027 passing**, unchanged
- `.ci/scripts/docker-test.sh unit vitest` — **189 passing**, unchanged


## What was done (TD-40 · TD-41 — the two wrong signatures)

The fourth review's two 🟠 findings, both of the same shape: the conversion honoured the "no double cast" standard and reached the outcome the standard exists to prevent by a quieter route. Both are fixed where the defect is, in the base class, and both base classes now have a file in strict that could not be adopted before.

### TD-40 — the nullable load was the base class's all along ([#2727](https://github.com/kuzzleio/kuzzle/issues/2727))

`PluginRepository.load()` declared `Promise<PluginDocument>` and resolved `null`, and the file was held out of strict so that nothing would notice. #2724 recorded the reason honestly — the base's `Promise<TObject>` cannot express it without a double cast — and the reading was right about the base class and wrong about what to do.

Reading `ObjectRepository` settled it in one look: **`load`, `loadFromCache` and `loadOneFromDatabase` all have a `return null` path**. The declaration was wrong about the base class itself, and the subclass was only the place it became visible. All three now say `Promise<TObject | null>`.

**It costs nothing today.** `strictNullChecks` is off in `tsconfig.json`, so `T | null` collapses to `T` and `tsc --noEmit` is unchanged — no call site had to move. The entire value is at step 12, where this would otherwise have surfaced as a hard error in a file nobody had looked at since sprint 6, with the root cause two classes away.

Adopting `pluginRepository.ts` then turned up two more, both in the base's constructor options:

- `constructor({ cache = cacheDbEnum.INTERNAL, store = null } = {})` has no type annotation, so `store` **infers from its default** as `null`. Every subclass passing a real store was, under strict, passing "something not assignable to `null`". Named as `ObjectRepositoryOptions`, with `store?: { index: string } | null` — the constructor reads `.index` and nothing else.
- `delete result._id` on a `PluginDocument`, where `_id` is required (`TS2790`). The local is a `JSONObject`: dropping `_id` is the whole point of `serializeToDatabase`.

**strict 125 → 126, implicit-any 457 → 456.**

### TD-41 — the overloads the union was standing in for ([#2728](https://github.com/kuzzleio/kuzzle/issues/2728))

`Protocol.init`'s first parameter had been widened to `string | null | NetworkEntryPoint` so that `protocol.init(entryPoint)` would type-check; the body still read the entry point from the **second** parameter, so that call type-checked and threw. Two real overloads and a normalising body. `protocol.ts` passes strict, is adopted (**126 → 127**), and ships **its first spec** — 9 vitest cases, the first being exactly the call that used to compile and crash.

**Writing the spec is what found the rest of it.** The deprecated `(name, entryPoint)` form is not discouraged, it is *dead*:

```js
assert(
  this.name && !name,
  "A name has been given in the constructor and init method. …",
);
```

`this.name` must be **truthy**. So passing a name to `init` throws — including when the constructor was given none, which is the one case the deprecation was meant to still allow. That assert arrived with [#1645](https://github.com/kuzzleio/kuzzle/pull/1645) on **2020-06-16**; the parameter has been unusable for five years, and the first TypeScript conversion widened the type to `string | null` to accommodate it. The legacy overload is therefore typed `init(name: null, entryPoint)` — the only second shape this method can accept — and the assert is left exactly as it is. Re-opening a path closed for five years is a decision about the plugin API, not about a method's type. Recorded in the register rather than filed as an issue: nothing calls it.

*A dead parameter is worse than a removed one: it survives a conversion as a type.*

**One behaviour change**, stated plainly: a missing entry point now fails an `assert` with `'Invalid "entryPoint" parameter value'` rather than a `TypeError` on `entryPoint.config` three lines later. Both call shapes already died there, and `httpwsProtocol.js` is still JavaScript, so the overloads do not constrain it — the message is worth having.

Also here, from the same finding: `MqttProtocol.disconnect`'s `message` parameter, left unused by #2723's correct removal of `client.close(undefined, message)`, is documented and suppressed rather than left reading as a live argument.

## Validation (2026-09-11, TD-40/41 branch — stacked on [#2736](https://github.com/kuzzleio/kuzzle/pull/2736))

- `npx tsc --noEmit` — clean, and **unchanged by the widening**, which is the point
- `npm run ratchet` — five green (js 22, mocha 150, any 205, implicit-any **456**, cpd-exclusions 4)
- `npm run test:strict` — **127** adopted files pass, `--candidates` empty
- `npm run test:lint` / `npm run prettier:check` — clean
- `.ci/scripts/docker-test.sh unit vitest` — **198 passing** (189 + 9)
- `.ci/scripts/docker-test.sh unit mocha` — **3027 passing**, unchanged
