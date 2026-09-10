# Step 08 — Type-debt backlog, worked in parallel with the sprints

**Status:** 🟦 In progress — 10 findings closed (TD-21 · TD-22 · TD-23 · TD-26 through TD-32), TD-33 open
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
