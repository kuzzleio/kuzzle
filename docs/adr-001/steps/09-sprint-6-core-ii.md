# Step 09 — Sprint 6: `lib/core` II (validation, plugin, network)

**Status:** 🟦 In progress — opened 2026-09-11
**Date:** 2026-09-11 → …
**PR(s):** H1 [#2722](https://github.com/kuzzleio/kuzzle/pull/2722) · H2 [#2723](https://github.com/kuzzleio/kuzzle/pull/2723) · H3 [#2724](https://github.com/kuzzleio/kuzzle/pull/2724)
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

### The gate's new-code issues: four S3776, as budgeted

`new_coverage` came out at **97.0%** and duplication at 0.0%, but the gate failed on **4 new Critical** — `S3776` cognitive complexity on `date.validate` (23), `date.validateFieldSpecification` (22), `geoShape.recursiveShapeValidation` (23) and `geoShape.checkStructure` (17). All four are pre-existing and all four were re-scored by the rename: the standing sprint-4 pattern, and the reason the step's DoD says a gate-driven refactor is in scope.

Resolved by verbatim extraction — `parseDate`, `checkRange`, `validateFormats`, `validateRange`, `checkOrientation`, `checkRadius`, `checkCoordinates`, `checkGeometries`, `checkShapeType`, `checkShapeProperties`. **Equivalence note**, the two places where the extraction is not a straight cut-and-paste:

- **`geoShape`'s checks each push their own error message, so none of them may be short-circuited.** `checkStructure` and `recursiveShapeValidation` both accumulated into a `result` flag precisely so that every applicable message lands. The extracted helpers therefore return into locals that are combined *after* the fact (`return typeOk && propertiesOk`), never inline in a `&&` chain. A comment says so at both sites.
- **`recursiveShapeValidation`'s tail already collapsed to `result && coordinatesOk`.** The original returned `false` early when a non-multi shape had bad coordinates, skipping `result` — but `result` is the only other term, so the early return and the conjunction agree on every input. The conjunction is what the extraction leaves behind.
- **`checkRadius` keeps an assignment in its `catch`.** The original pushed the error message from inside the block; hoisting that push to a single site at the end would have left an empty `catch`, which is a Sonar issue of its own. The block assigns `valid = false` instead.

## What was done (PR H2 — the network leaves)

12 files: `lib/core/network` minus `entryPoint` and `httpwsProtocol`, which are coupled and land in H6. **js 35 → 23**, implicit-any **461 → 457**, strict **117 → 123**.

### The entry point is typed by a declared contract, not by inference

`entryPoint.js` is still JavaScript, so the obvious move was `import type EntryPoint from "../entryPoint"` and let TS infer it from the JS. It compiled, and it was **wrong**: `entryPoint.execute`'s JSDoc says `@param {Request}`, and in a file that imports no `Request`, that resolves to the **DOM** `Request` — `lib.dom` is in `tsconfig.json`'s `lib`. The protocols were being checked against `fetch`'s Request.

So H2 declares `NetworkEntryPoint`: the five members (`config`, `execute`, `logAccess`, `newConnection`, `removeConnection`) the protocols actually reach. H6 makes `entryPoint` implement it.

**The generalisable part:** *a JSDoc type in an unconverted file is not a type, it is a name lookup in that file's scope.* Inferring from JS is fine for shapes; for anything named, check what the name resolves to before trusting it.

### Four latent bugs, none of them reachable before the rename

| Site | What it did | Why it was invisible |
|------|-------------|----------------------|
| `context.{Request,RequestContext,RequestInput}` | were **`undefined`** — destructured from `kerror/errors`, which exports none of them | a plugin's `new context.Request(...)` is the only caller, and nothing in-tree tests it |
| `router.removeConnection` | logged `JSON.stringify(requestContext.context)` → `"undefined"` | `newConnection`, three lines up, stringifies `requestContext` |
| `router._executeFromHttp` | `removeStacktrace(_res)` matched neither branch (`_res` is a `KuzzleRequest`, not an `Error` or a serialized response) | the protocols sanitise the serialized response anyway, so nothing leaked |
| `mqtt.publishCallback` | a plain `function` handed detached to aedes: `this.logger` would have thrown | only reachable when a publish fails |

Plus `request.setResult({}, 200)` at two http-router sites: the second parameter is an options object, and `this.status = options.status || 200` is exactly what made passing `200` look correct.

Each is a one-liner, and each is the same shape: **a value that is never read, or read only on a path no test reaches.** Type-checking a file is what turns those from "nobody noticed" into "does not compile".

### `node:` prefixes and mock-require

The first pass used `node:net` and `node:worker_threads` and **11 unit tests turned red** — `mock-require` keys on the literal specifier, so a spec that registers `"net"` never sees `require("node:net")`. The first fix was to drop the prefixes in the source; SonarCloud then asked for them back (S7772). The resolution is to register **both** names in the two specs, which keeps the source idiomatic and costs two lines of test.

**Rule:** before dropping a `node:` prefix to satisfy a spec, check whether the spec can register both names instead — the mock, not the source, is the thing that is behind.

### Other decisions

- **`Protocol` is generic over its configuration** (`Protocol<MqttConfig>`): `this.config` is `server.protocols.<name>`, a shape only the subclass knows. The lookup itself goes through `Reflect.get` — the key is a runtime protocol name, and indexing the typed config object with a `string` is an implicit `any` the fourth ratchet would have caught.
- **`Protocol.init`'s first parameter carries two shapes.** Every in-tree caller uses `protocol.init(entryPoint)` while the subclasses call `super.init(null, entryPoint)`; third-party protocols may still use the deprecated `(name, entryPoint)` form. `string | null | NetworkEntryPoint` keeps both rather than breaking either, and method parameter bivariance is what lets the subclasses declare the one-argument form.
- **Strict adoption is partial: 6 of 12.** The rest of the network layer is nullable-heavy by nature — `parentPort`, the optional `entryPoint`, a route tree read through `noUncheckedIndexedAccess` — and guarding it file by file here would be sprint 9's work done early, in the riskiest layer. `--candidates` is empty, which is what the DoD asks.
- `clientConnection.ts` became strict-clean **because of H1**: `isPlainObject` is a type guard now, so the two `JSONObject | null` assignments narrow on their own.

### The gate, in two rounds

`new_coverage` cleared on the first analysis (**85.3%**); the violations did not. **27 of them** — 1 Critical (S3776 on `logAccess`, complexity 28), 7 Major, 19 Minor — every one a pre-existing idiom re-scored by the rename. Resolved the same way as H1's: verbatim extraction for the complexity, mechanical rewrites for the rest (`readonly`, class fields, object spread, `startsWith`, optional chains, `??=`, a Set), and `NOSONAR` only where the deprecation has no usable replacement ([TD-20](../type-debt-register.md#td-20) / [#2688](https://github.com/kuzzleio/kuzzle/issues/2688)).

A second round left exactly one: an S6606 on the `(unknown)` fallback the extraction had just created — `user === null ? … : user` where `??` is both what Sonar asks for and the better behaviour, since a token with no `userId` at all used to log the string `"undefined"`.

Two of the six S1874 were **self-inflicted**: a `@deprecated` written for `Protocol.init`'s `name` parameter sat as a block tag, which deprecates the whole method — every `super.init(...)` then scored. *A `@deprecated` line in a JSDoc block is never about one parameter.*

## What was done (PR H3 — the plugin leaves)

3 files, 88 measurable lines: `pluginManifest`, `pluginRepository`, `privilegedContext`. The smallest block of the sprint, and **the last one that is a conversion**; H4, H5 and H6 all write specs before they rename anything.

### Being under the gate was the useful part

At **76.1%** the block was four covered lines short of 80%. Topping it up with four assertions would have cleared the gate and netted nothing, so both gaps were closed properly instead — and the result came back at **92.2%**.

- **`privilegedContext` had no spec at all.** The ADR's *"a file with no spec ships one"* rule, in its plain form.
- **`pluginManifest`'s Mocha spec was replaced, not duplicated.** It stubbed `AbstractManifest.load()` to a no-op and assigned `name` and `raw` by hand — so it never exercised the base class, and the file's real load path was untested while looking tested. The vitest version drives real `manifest.json` fixtures through the real base. The Mocha spec is deleted in the same commit: **mocha 151 → 150**, the first movement on that counter since the ADR opened.

**The generalisable part:** *a block that lands under the threshold is telling you which file is not really tested.* The gate's arithmetic pointed at the two files whose specs were thinnest, and the fix for both was a spec rather than a number.

### Typing decisions

- **`accessors.kuzzle` is now declared on `PluginContext`**, optional, documented as present only for a plugin declared `privileged`. `PrivilegedPluginContext` has assigned it since it existed and the public type never mentioned it — the third occurrence in this migration of *the type describing less than the class does*.
- **`PluginRepository`'s public methods take `JSONObject`**, not the id-bearing document. That is what the plugin-facing `Repository` contract passes, and a document being created legitimately has no `_id` yet. `ObjectRepository<TObject>`'s `_id` requirement is asserted at one point — the same point the runtime has always read `object._id`.
- **`delete()` accepts `string | PluginDocument`.** It overrides a base that takes the object; an override narrowed to the id alone is not a signature the base can satisfy. The union keeps both, and the callers still pass a string.
- **`pluginRepository.ts` is deliberately left out of strict.** Its `load()` resolves `null` for a missing user — documented behaviour — and that cannot be declared against `ObjectRepository<TObject>`'s `Promise<TObject>` without a double cast, which the conversion standard forbids. The reason sits next to the entry in `.migration/strict-adopted.txt`. **`ObjectRepository`'s type parameter cannot express a nullable load**; whoever revisits the base class should start there.

### The gate

`new_coverage` **92.2%**, and a single Major: S7746, `return Promise.resolve(null)` inside a `.catch()` where `return null` is the same value. Fixed.

## Validation

Run on the H1 branch, 2026-09-11:

- `npx tsc --noEmit` — clean
- `npm run ratchet` — five green (js **35**, mocha 151, any 205, implicit-any 461, cpd-exclusions 4)
- `npm run test:strict` — 117 adopted files pass; `--candidates` empty
- `.ci/scripts/docker-test.sh unit mocha` — **3030 passing**
- `.ci/scripts/docker-test.sh unit vitest` — **183 passing**
- `eslint` + `prettier` — clean
- SonarCloud on [#2722](https://github.com/kuzzleio/kuzzle/pull/2722): `new_coverage` **97.3%**, duplication 0.0%, all three ratings A, **0 violations** — green after the rounds above

Run on the H2 branch, 2026-09-11 (rebased on `2-dev` after H1 merged):

- `npx tsc --noEmit` — clean
- `npm run ratchet` — five green (js **23**, mocha 151, any 205, implicit-any **457**, cpd-exclusions 4)
- `npm run test:strict` — 123 adopted files pass; `--candidates` empty
- `.ci/scripts/docker-test.sh unit mocha` — **3030 passing**
- `.ci/scripts/docker-test.sh unit vitest` — **183 passing**
- `eslint` + `prettier` — clean
- SonarCloud on [#2723](https://github.com/kuzzleio/kuzzle/pull/2723): `new_coverage` **85.2%**, duplication 0.0%, all three ratings A, **0 violations**

Run on the H3 branch, 2026-09-11 (rebased on `2-dev` after H2 merged):

- `npx tsc --noEmit` — clean
- `npm run ratchet` — five green (js **20**, mocha **150**, any 205, implicit-any 457, cpd-exclusions 4)
- `npm run test:strict` — 125 adopted files pass; `--candidates` empty
- `.ci/scripts/docker-test.sh unit mocha` — **3027 passing** (3030 − the 3 replaced)
- `.ci/scripts/docker-test.sh unit vitest` — **189 passing** (183 + 6)
- `eslint` + `prettier` — clean
