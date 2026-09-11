# Step 09 — Sprint 6: `lib/core` II (validation, plugin, network)

**Status:** 🟦 In progress — opened 2026-09-11
**Date:** 2026-09-11 → …
**PR(s):** H1 [#2722](https://github.com/kuzzleio/kuzzle/pull/2722)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the second half of `lib/core`: the **validation** engine, the **plugin** machinery and the **network** layer. 34 `.js` files, 8 195 LOC — the largest and hardest sprint so far, and the one holding the repo's two biggest remaining files (`httpwsProtocol` 1 254 LOC, `pluginsManager` 1 244).

| Area | Files | LOC |
|------|------:|----:|
| `validation` — engine + 13 leaf types + `baseType` | 15 | 2 779 |
| `plugin` — `plugin`, `pluginsManager`, `pluginRepository`, `pluginManifest`, `privilegedContext` | 5 | 1 911 |
| `network` — entrypoint, router, protocols, HTTP router, access log | 14 | 3 505 |

After this step the only `.js` left under `lib/` is `lib/cluster` (sprint 7) and `lib/kuzzle` (sprint 8).

## Sequencing: measured coverage first — and measured the way the gate measures

[Step 07](07-sprint-5-core-i.md) established the rule the hard way: **a `.js` → `.ts` rename re-scores the whole file as new code**, so `new_lines_to_cover` is the file's entire body and *today's coverage is tomorrow's `new_coverage`*. The SonarCloud gate requires `new_coverage ≥ 80%`.

### ⚠️ The raw c8 report is not the number the gate sees — and here it is optimistic

Step 07 also added `.ci/scripts/prepare-coverage.ts`, which drops blank and comment-only lines from the LCOV before SonarCloud reads it. Planning this sprint off the *raw* `c8` output would have put **three files in the wrong block**, because normalisation removes hit comment lines as well as unhit ones:

| File | Raw | Normalised | |
|------|----:|-----------:|---|
| `plugin/pluginManifest.js` | 80.4% | **59.3%** | looked gate-safe, is not |
| `plugin/privilegedContext.js` | 90.7% | **66.7%** | looked comfortable, is not |
| `network/router.js` | 81.6% | **79.3%** | looked gate-safe, is just under |

Repo-wide the same pass moves coverage 84.4% → 80.2%, i.e. **normalisation is not a free uplift**. Every figure below is the normalised one. (Measured on `2-dev`, 2026-09-11: `npm run test:unit:mocha:coverage`, then `prepare-coverage.ts`. The raw `LF` happens to equal `wc -l` exactly — c8 instruments every line of a loaded file, which is precisely the inflation the script exists to undo.)

### Per-file

| File | Lines (raw c8) | Raw | Lines (normalised) | **Normalised** | Gate |
|------|---------------:|----:|-------------------:|---------------:|------|
| `network/clientConnection.js` | 57 | 100.0% | 23 | **100.0%** | ✅ |
| `network/context.js` | 80 | 100.0% | 54 | **100.0%** | ✅ |
| `network/protocolManifest.js` | 34 | 100.0% | 9 | **100.0%** | ✅ |
| `network/httpRouter/routeHandler.js` | 111 | 100.0% | 53 | **100.0%** | ✅ |
| `validation/baseType.js` | 80 | 100.0% | 25 | **100.0%** | ✅ |
| `validation/types/anything.js` | 38 | 100.0% | 11 | **100.0%** | ✅ |
| `validation/types/boolean.js` | 52 | 100.0% | 18 | **100.0%** | ✅ |
| `validation/types/date.js` | 284 | 100.0% | 219 | **100.0%** | ✅ |
| `validation/types/email.js` | 92 | 100.0% | 46 | **100.0%** | ✅ |
| `validation/types/enum.js` | 100 | 100.0% | 54 | **100.0%** | ✅ |
| `validation/types/geoPoint.js` | 54 | 100.0% | 19 | **100.0%** | ✅ |
| `validation/types/integer.js` | 57 | 100.0% | 21 | **100.0%** | ✅ |
| `validation/types/ipAddress.js` | 83 | 100.0% | 39 | **100.0%** | ✅ |
| `validation/types/numeric.js` | 108 | 100.0% | 62 | **100.0%** | ✅ |
| `validation/types/object.js` | 88 | 100.0% | 38 | **100.0%** | ✅ |
| `validation/types/string.js` | 110 | 100.0% | 63 | **100.0%** | ✅ |
| `validation/types/url.js` | 83 | 100.0% | 39 | **100.0%** | ✅ |
| `validation/types/geoShape.js` | 370 | 98.1% | 262 | **97.7%** | ✅ |
| `network/protocols/httpMessage.js` | 69 | 98.6% | 31 | **96.8%** | ✅ |
| `network/protocols/internalProtocol.js` | 109 | 96.3% | 48 | **95.8%** | ✅ |
| `network/httpRouter/routePart.js` | 147 | 96.6% | 67 | **94.0%** | ✅ |
| `network/httpRouter/index.js` | 316 | 92.1% | 156 | **89.7%** | ✅ |
| `network/protocols/mqttProtocol.js` | 291 | 89.3% | 194 | **88.1%** | ✅ |
| `plugin/pluginRepository.js` | 132 | 93.9% | 52 | **86.5%** | ✅ |
| `network/protocols/protocol.js` | 102 | 88.2% | 51 | **84.3%** | ⚠️ |
| `network/accessLogger.js` | 322 | 83.5% | 221 | **82.4%** | ⚠️ |
| `network/router.js` | 255 | 81.6% | 145 | **79.3%** | ❌ |
| `plugin/privilegedContext.js` | 43 | 90.7% | 9 | **66.7%** | ❌ |
| `network/protocols/httpwsProtocol.js` | 1254 | 66.8% | 865 | **61.7%** | ❌ |
| `plugin/pluginManifest.js` | 56 | 80.4% | 27 | **59.3%** | ❌ |
| `plugin/pluginsManager.js` | 1244 | 66.1% | 841 | **58.1%** | ❌ |
| `network/entryPoint.js` | 358 | 65.1% | 223 | **55.2%** | ❌ |
| `plugin/plugin.js` | 436 | 49.3% | 337 | **46.9%** | ❌ |
| `validation/validation.js` | 1180 | 43.1% | 890 | **36.2%** | ❌ |

Every one of the 34 files already has a spec reaching it — unlike sprint 5, nothing here is unnetted. The gap is **depth, not existence**.

## PR breakdown (planned)

The gate scores a PR's **aggregate**, not each file, so the blocks are formed to clear 80% as a whole. "Covered lines needed" is what each block is short of the threshold *before* any new spec is written.

| PR | Scope |
|----|-------|
| **H1** | `validation/types/*` + `baseType` — pure leaves |
| **H2** | `network` minus `entryPoint`/`httpwsProtocol`: `clientConnection`, `context`, `protocolManifest`, `httpRouter/*`, `protocols/{httpMessage,internalProtocol,mqttProtocol,protocol}`, `accessLogger`, `router` |
| **H3** | `plugin` leaves: `pluginRepository`, `privilegedContext`, `pluginManifest` |
| **H4** | `validation/validation.js` — spec effort, then rename |
| **H5** | `plugin/plugin.js` + `pluginsManager.js` — coupled; spec effort, then rename |
| **H6** | `network/entryPoint.js` + `protocols/httpwsProtocol.js` — coupled (`entryPoint` owns the protocols); spec effort, then rename |

| PR | Files | Lines | Uncovered | Aggregate | Covered lines needed for 80% |
|----|------:|------:|----------:|----------:|-----------------------------:|
| **H1** | 14 | 916 | 6 | 99.3% | — |
| **H2** | 12 | 1052 | 123 | 88.3% | — |
| **H3** | 3 | 88 | 21 | 76.1% | +4 |
| **H4** | 1 | 890 | 568 | 36.2% | +390 |
| **H5** | 2 | 1178 | 531 | 54.9% | +296 |
| **H6** | 2 | 1088 | 431 | 60.4% | +214 |
| **all** | 34 | 5212 | 1680 | 67.8% | |

Reading that table:

- **H1 and H2 are conversions.** They clear the gate on existing specs with room to spare and can move immediately, in parallel.
- **H3 is a conversion plus four lines of test.** `router.js` (79.3%) is carried by H2's aggregate; the three plugin leaves are only 88 lines between them, so their block lands at 76.1% and needs a handful of assertions — not a spec effort.
- **H4, H5 and H6 are spec efforts with a rename at the end**, the shape sprint 5 established for `clientAdapter`. Together they need roughly **+900 covered lines**. `validation.js` alone needs +390 and is the largest single piece of work in the sprint.

H1 → H3 are independent of each other and of H4 → H6; the leaves go first so `validation.js` (H4) is converted against already-typed types.

## Known risks, before starting

- **`httpwsProtocol.js` (865 measurable lines, 61.7%)** is the riskiest file of the whole migration: HTTP *and* WebSocket entrypoint, with its uncovered third largely error and back-pressure paths, where a regression is not caught by unit tests. Sprint 5's `Build and Run` job caught exactly that class of bug (a dynamic method call turned into a property read, losing its receiver) — keep that job in mind as the real net here.
- **`validation.js` at 36.2%** is the lowest-covered file in scope and the most branch-heavy (recursive schema walking). Its three existing specs (`init`, `util`, `validate`) cover the happy paths.
- **The plugin machinery is the API surface third-party plugins are written against.** The conversion must not change the shape of what `pluginContext` hands out; `lib/core/plugin/pluginContext.ts` is already TS and typed, so most of the risk sits in `plugin.js`'s manifest and loading paths.
- **`fail-fast: false` is now set on the functional matrix** and the readiness gate is fixed ([TD-33](../type-debt-register.md#td-33)), so a flaky variant no longer hides the other 29 results during this sprint's re-runs.

## Definition of done (per PR)

Unchanged from step 06, restated because this sprint is long:

- `export =` for modules consumed by JS; no new written `any`, no `@ts-ignore`, no `!`.
- All **five** ratchets green, baselines updated **in the same PR** (`js`, `mocha`, `any`, `implicit-any`, `cpd-exclusions`).
- Strict adoption when the converted file is clean (`npm run test:strict -- --candidates` must come back empty).
- A vitest spec for any file whose coverage the PR relies on, under `tests/` mirroring the source tree.
- A gate-driven, behaviour-preserving refactor is **in scope** when the rename's new-code score forces it — with a verbatim-extraction equivalence note in this file.

## What was done (PR H1 — the validation type leaves)

14 files, 916 measurable lines: `baseType` and the 13 leaf types. **js 49 → 35.** The block was measured at 99.3%, so it clears `new_coverage` on the specs that already exist — and every one of the 14 has a dedicated Mocha spec, so the ADR's *"a file with no spec ships one"* rule does not apply here. All 15 files (the 14 plus the new `typeOptions.ts`) were adopted into strict: **102 → 117**, `--candidates` back to empty.

### The generic is what makes `typeOptions` typable at all

The JSDoc had a single `TypeOptions` typedef that never existed as a real declaration. Writing it as one interface does not work: `range` means `{ min?: number; max?: number }` to `numeric` and `{ min?: Moment | "NOW"; max?: … }` to `date`, and a union of the two makes every comparison in `numeric.validate` a type error.

So `BaseType` is **generic over the options shape its subclass accepts** (`BaseType<NumericTypeOptions>`, `BaseType<DateTypeOptions>`, …), with the shapes in a new `lib/core/validation/typeOptions.ts`. Two consequences worth keeping:

- The declared shapes describe the options **after `validateFieldSpecification` has run** — that method is what rejects the invalid ones and fills the defaults in. That is what lets `validate` read `range.min` as a `number` without re-proving anything, and it is the honest reading of the contract: the two methods are a pipeline, not two independent entry points.
- **Method parameter bivariance is what keeps `this.types[…]` usable.** A `BaseType<NumericTypeOptions>` stays assignable to `BaseType`, so `validation.js`'s heterogeneous type registry needs no `any` when H4 converts it.

### `checkAllowedProperties` is a type guard, and that removed the casts

`checkAllowedProperties(o, ["min", "max"])` already proves `o` is a non-null, non-array object holding none but those keys. Declaring `o is Record<string, unknown>` means the code that follows it — which is always "now read `min` and `max`" — needs no cast. `safeObject.isPlainObject` got the same treatment (type-only, own commit); `date.validate` is its beneficiary.

**The generalisable part:** *a boolean-returning validator that every caller follows with a property read is a type guard that has not been declared yet.* Two of them in one file, both free.

### `{ range: undefined }` must still throw — the specs said so before review did

The first pass rewrote `Object.prototype.hasOwnProperty.call(typeOptions, "range")` as `if (range)`, which reads better and is what TS narrows on. Four Mocha specs failed: `numeric` and `string` both assert that `{ range: undefined }` / `{ range: { min: undefined } }` throw `validation.assert.unexpected_properties` and `…invalid_type`. An own-property test and a truthiness test differ exactly on the specifications that are malformed, which is the only input those methods exist to reject.

The conversion therefore keeps `has()` for presence and uses `!== undefined` only where TS genuinely needs the narrowing (the `max < min` comparisons, where the preceding loop has already thrown on any non-number). **A `hasOwnProperty` in validation code is load-bearing until a test says otherwise** — and here the test said so within one run.

### Three unreachable branches, made explicit rather than latent

Each was a `TypeError` waiting on an input `validateFieldSpecification` already rejects; strict mode is what surfaced them:

| Site | Was | Is |
|------|-----|----|
| `date.validate`, unknown format | `formatMap[f](v)` → `undefined is not a function` | skipped, with the reason in a comment |
| `geoShape`, shape type falling through the switch | `coordinateValidation` unassigned, then called | initialised to `() => true`; the `default:` branch already sets `result = false` |
| `geoShape`, `geometrycollection` coordinates | `undefined` passed to a validator that ignores it | destructured with a `[]` default |

### Other decisions

- **`@types/validator` is a new dev dependency.** `validator` ships no declarations, so the three `import validator from "validator"` scored `TS7016` — an implicit `any` on a whole third-party surface, which is exactly what the fourth ratchet is for. Hand-writing a local `.d.ts` for three functions was rejected: it is debt with no owner.
- **Two `as` casts, both at the boundary where the input is genuinely `unknown`** and the library it feeds is the thing that decides: `parse(fieldValue as MomentInput)` and `Koncorde.convertGeopoint(fieldValue as string | JSONObject)`. Neither is `as unknown as`, so neither moves the `any` counter.
- **`BaseType.validate` is declared as an overload** (`validate(typeOptions?, fieldValue?, errorMessages?): boolean` over an implementation taking none). The base returns `true` and reads nothing; without the overload, either the subclasses stop being assignable or ESLint reports three unused parameters.
- **Constructors are gone.** Every type's constructor did nothing but assign `typeName` / `allowChildren` / `allowedTypeOptions`; they are class-field initialisers now, which is the shape Sonar's S7757 asked for in sprint 5. With `target: es2020` and `useDefineForClassFields` off, the emitted code is the same assignment in the constructor, so `has(validationType, "allowChildren")` in `Validation.addType` still sees an own property.

## Validation

Run on the H1 branch, 2026-09-11:

- `npx tsc --noEmit` — clean
- `npm run ratchet` — five green (js **35**, mocha 151, any 205, implicit-any 461, cpd-exclusions 4)
- `npm run test:strict` — 117 adopted files pass; `--candidates` empty
- `.ci/scripts/docker-test.sh unit mocha` — **3030 passing**
- `.ci/scripts/docker-test.sh unit vitest` — **183 passing**
- `eslint` + `prettier` — clean
