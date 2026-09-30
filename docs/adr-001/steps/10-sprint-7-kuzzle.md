# Step 10 — Sprint 7: `lib/kuzzle` (bootstrap, vault, dumps, event runner)

**Status:** ✅ Done — 2026-09-15 → 2026-09-16, frozen
**Date:** 2026-09-15 → 2026-09-16
**PR(s):** I1 [#2752](https://github.com/kuzzleio/kuzzle/pull/2752) · I2 [#2753](https://github.com/kuzzleio/kuzzle/pull/2753)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the six `.js` files left under `lib/kuzzle`. 882 LOC — the smallest sprint since `lib/util`, and the first with **no spec effort in it at all**.

| File | LOC | Spec |
|------|----:|------|
| `dumpGenerator.js` | 274 | `test/kuzzle/dumpGenerator.test.js` |
| `internalIndexHandler.js` | 234 | `test/kuzzle/internalIndexHandler.test.js` |
| `event/pipeRunner.js` | 144 | `test/kuzzle/event/pipeRunner.test.js` |
| `event/waterfall.js` | 101 | `test/kuzzle/event/waterfall.test.js` |
| `vault.js` | 89 | `test/kuzzle/vault.test.js` |
| `kuzzleStateEnum.js` | 40 | — (covered through its importers) |

After this step the only `.js` left under `lib/` is `lib/cluster` (sprint 8).

## Sequencing: this sprint is sequenced by nothing, and that is the finding

Every sprint since [step 07](07-sprint-5-core-i.md) has been ordered by **measured, gate-facing coverage**, because a `.js` → `.ts` rename re-scores the whole file as new code and the gate wants `new_coverage ≥ 80%`. Measured on `2-dev` after sprint 6 merged:

| File | Lines (normalised) | Line % | **Sonar %** | Gate |
|------|-------------------:|-------:|------------:|------|
| `internalIndexHandler.js` | 170 | 100.0% | **100.0%** | ✅ |
| `kuzzleStateEnum.js` | 8 | 100.0% | **100.0%** | ✅ |
| `event/pipeRunner.js` | 71 | 100.0% | **100.0%** | ✅ |
| `event/waterfall.js` | 50 | 100.0% | **100.0%** | ✅ |
| `dumpGenerator.js` | 205 | 93.2% | **91.5%** | ✅ |
| `vault.js` | 46 | 100.0% | **88.7%** | ✅ |

550 measurable lines, aggregate **95.9%**, and **no file is within 8 points of the threshold**. There is nothing to sequence: any order works, so the split below is by coupling rather than by risk.

⚠️ **The two percentages are not the same measurement, and only the second one is the gate's.** SonarQube's `coverage` is `(covered_lines + covered_conditions) / (lines_to_cover + conditions_to_cover)` — it folds **branch** coverage into the same ratio. Every figure this migration has quoted so far has been line-only, which is the same number whenever branch coverage tracks line coverage, and diverges when it does not: `vault.js` is **100% of lines and 1 of 7 branches** — a single `load()` call in the whole suite, walking one path through six `assert`s — so the gate sees 88.7%, not 100%. It still clears, and so does everything else here, but the aggregate this sprint is planned against is **95.9%**.

### Why this layer and not `lib/cluster`

The hub planned sprint 7 as `lib/cluster` and sprint 8 as `lib/kuzzle`. The measurement inverts that:

| Layer | Files | Lines | Aggregate | Below gate |
|-------|------:|------:|----------:|------------|
| `lib/kuzzle` | 6 | 550 | 95.9% | — |
| `lib/cluster` | 6 | 1 544 | 88.9% | `command.js` **16.9%** (needs ≈ +101 covered lines) · `workers/IDCardRenewer.js` **71.3%** (≈ +10) |

`lib/cluster` holds the **only two spec efforts left in the repo**, and `command.js` is the largest single one the migration has faced outside sprint 6's original plan. Doing `lib/kuzzle` first keeps the two kinds of work apart — six plain conversions here, then a sprint that is mostly about writing tests — which is the split step 09 proved is worth making explicit: its H4/H5/H6 block was sized as a spec effort and turned out to be plain conversions once [TD-50](../type-debt-register.md#td-50) was fixed, and the mixed framing cost a re-plan mid-sprint.

## Plan

Two PRs, split where the module graph splits.

### I1 — the leaves (4 files, 374 LOC)

`kuzzleStateEnum.js` · `vault.js` · `event/waterfall.js` · `event/pipeRunner.js`

Four modules with four different export shapes, which is most of the conversion work:

- **`kuzzleStateEnum`** is `module.exports = Object.freeze({…})`. A frozen object of numeric states, read by `kuzzle.ts` — a `const` object plus a derived union type, not a TS `enum` (the repo has none, and an `enum` emits a runtime object the frozen one already is).
- **`vault`** is `module.exports = { load }` — a named-export object, the one shape that converts to plain `export function` with no `export =`.
- **`waterfall`** is `module.exports = waterfall` with two module-private helpers and a `WaterfallContext` class. The callback chain is the typing problem: `waterfallCB` is invoked with `(err, res)` from arbitrary plugin code.
- **`pipeRunner`** is `module.exports = PipeRunner`, depends on `waterfall`, and holds a `Denque` of `PipeChain`. It converts after `waterfall`, in the same PR.

### I2 — the two classes (2 files, 508 LOC)

`internalIndexHandler.js` · `dumpGenerator.js`

- **`InternalIndexHandler extends Store`** — `lib/core/shared/store.ts` is already TypeScript, so this is the first file in the sprint where the base class constrains the subclass rather than the other way round. Expect the same category of finding as H6's `implements NetworkEntryPoint`: members the JavaScript read that the declared base does not have.
- **`DumpGenerator`** is the one file under 100% on lines (93.2%, 91.5% to the gate). It shells out to `dumpme`, walks the filesystem and gzips — the uncovered lines are the error paths, and they stay uncovered; it clears the gate with room.

Both have Mocha specs. Per the standing rule, **convert first, then touch the spec** — and only to follow the source (`node:fs` specifiers, per step 09's H5/H6 equivalence notes).

## Expected counters

`js` **17 → 11** · `strict` **131 → 137** (all six are expected to adopt; `--candidates` will confirm) · `mocha` unchanged at **149** unless a spec is replaced rather than kept · `any` and `implicit-any` must not rise.

> **What actually happened to `strict`: 131 → 135, not 137.** The four leaves adopted; the two classes did not, and not for anything in them — they read `global.kuzzle.config`, which is `Partial<…>`, so every section is `undefined` under `strictNullChecks`. That is [TD-53](../type-debt-register.md#td-53), filed by I2.

## What was done (PR I1 — the four leaves)

4 files, 374 LOC. **js 17 → 13**, strict **131 → 135**. No counter moved in the
wrong direction; `any`, `implicit-any` and `casts` are untouched.

### Four export shapes, four answers

| file | JavaScript | TypeScript |
| --- | --- | --- |
| `kuzzleStateEnum` | `module.exports = Object.freeze({…})` + a `@typedef` | a frozen `const` **and** a same-named `type` derived from it, both carried by one `export =` |
| `vault` | `module.exports = { load }` | `export = { load }` — the one shape that is an object rather than a class |
| `waterfall` | `module.exports = waterfall` | `export = waterfall` |
| `pipeRunner` | `module.exports = PipeRunner` | `export = PipeRunner` |

**`kuzzleStateEnum` is the one worth explaining.** `kuzzle.ts` writes both
`kuzzleStateEnum.RUNNING` and `get state(): kuzzleStateEnum` — a value and a
type under one name, which the JavaScript supported through a `@typedef` and
TypeScript supports through declaration merging. Not a TS `enum`: an `enum`
emits an ordinary, mutable object, and the export has been frozen since 2022.

The derived type turned out to be **narrower than the `@typedef` claimed**.
`Object.freeze` over a fresh object literal keeps literal types, so
`(typeof kuzzleStateEnum)[keyof typeof kuzzleStateEnum]` is `1 | 2 | 3 | 4`,
not the `number` the JSDoc said — and `Kuzzle._state`, declared `number`, stopped
being assignable to its own getter. It is now `kuzzleStateEnum`, which is what it
has always held.

### Two declared types that did not describe what they carried

Same category as [TD-40](../type-debt-register.md#td-40)/[TD-41](../type-debt-register.md#td-41), fixed where the defect is:

- **`StartOptions.secretsFile` and `StartOptions.vaultKey` were `JSONObject`.**
  One is a **path**, the other a **key**; `Backend` holds both as `string?`, and
  `vault.load` passes the first to `fs.existsSync`. Now `string`.
- **`Kuzzle._state: number`**, above.

### `noUncheckedIndexedAccess` removed two invariants rather than asserting them

The repo compiles with `noUncheckedIndexedAccess`, so every indexed read is
`T | undefined`, and both files had a bounds check standing one call away from
the read it justified:

1. `WaterfallContext` had `hasNext()` and then `this.chain[this.index - 1](…)`.
   One lookup now answers both questions — `shift()` returns the step or
   `undefined` — so there is no invariant left to take on trust.
2. `PipeRunner._runNext` had `buffer.isEmpty()` and then `buffer.shift()`.
   `shift()` on an empty `Denque` returns `undefined` and mutates nothing, so
   the two forms agree and only one of them needs a guard.

Neither is a cast, which is the point: the [`casts`](../type-debt-register.md#td-43)
ratchet prices the alternative.

### Equivalence note

1. **A pipe's error is `unknown`, not `Error`.** A step is arbitrary plugin code
   and can call its callback with anything; `WaterfallCallback` and
   `PipeCallback` now say so. The behaviour is unchanged — the JavaScript read
   `error.message` off whatever arrived, which is `undefined` for a non-`Error`,
   and `toKuzzleError` preserves exactly that. Improving it is a behaviour
   change and not this PR's.
2. **`_runNext` checks `running >= maxConcurrent` before touching the buffer**,
   where the original checked `isEmpty()` first. The order matters only in that
   the original never shifted while saturated — and neither does this one.
3. **The `no-invalid-this` suppressions stay.** The declared `this` parameters
   are what make the accesses type-check, but the rule that fires is ESLint's
   **core** `no-invalid-this`, which predates `this` parameters and cannot see
   the declaration. Swapping it for the `@typescript-eslint` version is a
   repo-wide lint change, not a conversion.

### The `vault` spec was testing nothing, and the conversion is what said so

`test/kuzzle/vault.test.js` broke on the rename, with `ReferenceError: fs is not
defined` from `rewire`'s `__set__`: the JavaScript had a module-scope `fs`, and
`import fs from "fs"` compiles to `fs_1`. Reading it to fix the name showed the
test had never asserted anything:

- the body was an `async` callback handed to `__with__(…)(…)` and **never
  awaited**, so every assertion inside it ran detached;
- it called `new Vault(…)` on a module that exports `{ load }`, which throws
  `not a constructor` — swallowed into an unhandled rejection;
- `vaultArgs` was declared, never assigned, and then asserted to `eql([…])`;
- one expected value was `"the spoon does not exists"` for an input of
  `"the spoon does not exist"`.

It is replaced by five tests that call `load()` and assert the three `assert`
messages, the undecrypted-vault case and the env-key path, stubbing
`fs.existsSync` with sinon instead of rewiring the module. **Mocha 3026 → 3030
tests**, the spec-file count unchanged at 149.

This also explains the file's coverage, which the plan above quoted as 100% of
lines and **1 of 7 branches**: `load()` ran once in the whole suite, from
somewhere else entirely, down a single path. The line figure was true and
useless, and the branch figure was the tell — the same shape as
[TD-50](../type-debt-register.md#td-50)'s "93% of branches next to 36% of lines",
read the other way round.

## What was done (PR I2 — the two classes)

2 files, 508 LOC, and **`lib/kuzzle` holds no JavaScript**. **js 13 → 11**, strict
unchanged at **135** (see TD-53 below). `any`, `implicit-any` and `casts` untouched.

### `Store` declared `logger` private, and its subclass has always replaced it

`InternalIndexHandler extends Store`, and its constructor ends with

```ts
this.logger = global.kuzzle.log.child("internalIndexHandler");
```

`Store.logger` was `private readonly`. JavaScript does not care — the assignment
just overwrote the field — but `private` is a claim that no one outside the class
writes it, and that claim was false for as long as this subclass has existed. It
is now `protected` and not `readonly`, with the reason on it. Same shape as H6's
`implements NetworkEntryPoint`: the base was describing itself, not its use.

### Two dead things in `dumpGenerator`

1. **A `Request` built and discarded on every dump.**

   ```js
   await global.kuzzle.statistics.getAllStats(
     new Request({ action: "getAllStats", controller: "statistics" }));
   ```

   `Statistics.getAllStats()` takes **no arguments** and forwards to `getStats()`
   with none. The compiler said `Expected 0 arguments, but got 1`; the argument
   is gone, and with it the `Request` import.

2. **`fs.rmdirSync(dir, { recursive: true })`.** `@types/node` no longer declares
   the option — it was deprecated in Node 14 and the docs say it will be removed.
   Checked on the runtime the CI actually uses before touching it: on **Node 24
   it still works**, printing `DEP0147`. So this is not the bug it looked like,
   and the fix is the documented replacement, `fs.rmSync`, which does the same
   thing without the warning.

### Two declarations rather than two casts

Neither `dumpme` nor `process.moduleLoadList` has types, and both are load-bearing here:

- `lib/types/dumpme.d.ts` — the module's whole API, read off its `index.js`: one
  default-exported function, both arguments optional.
- `lib/types/node-internals.d.ts` — `process.moduleLoadList`, real since v0.x and
  still on v24, undocumented, so `@types/node` does not carry it. `dumpGenerator`
  has always written it into `nodejs.json`.

Declaring them costs the `implicit-any` ratchet nothing and the `casts` ratchet
nothing. An `as` in each call site would have cost both.

Neither could be committed as written: `.gitignore` carried a blanket `*.d.ts`
with a single per-file exception for a `Global.d.ts` that is `Global.ts` now.
`outDir` is `dist/`, so tsc never emits into `lib/types` — anything matching
there is hand-written by definition, and the rule is now `!lib/types/*.d.ts`.

### ⚠️ Neither file could be adopted into strict — [TD-53](../type-debt-register.md#td-53)

Both convert cleanly and pass `tsc --noEmit`. Under `strict` they produce nine
errors between them, and **every one of them is the same error**:

```
dumpGenerator.ts(158,12):        'global.kuzzle.config.dump' is possibly 'undefined'.
internalIndexHandler.ts(93,7):   'global.kuzzle.config.services' is possibly 'undefined'.
internalIndexHandler.ts(216,13): Property 'authToken' does not exist on type 'SecurityConfiguration | undefined'.
```

`KuzzleConfiguration` is `Partial<IKuzzleConfiguration>`, because one type is
doing two jobs: describing what a user may write in a `.kuzzlerc`, where every
section is optional, *and* what `global.kuzzle.config` holds at runtime, which is
that file merged over the packaged defaults, where none of them is. The looser
job wins, everywhere.

The files stay out of `.migration/strict-adopted.txt` rather than carrying guards
for a condition that cannot happen. **The generalisable part:** the strict list
reads like a quality score per file, and these two are evidence it is partly a
score of *what a file happens to touch*.

> ⚠️ **Corrected 2026-09-16 — [TD-54](../type-debt-register.md#td-54),
> [#2757](https://github.com/kuzzleio/kuzzle/issues/2757).** Two things above are
> wrong. **"Nine errors between them, and every one of them is the same error"**:
> there are **17**, and 6 are not the config shape — two `unknown` catch bindings
> (`dumpGenerator.ts:81,83`), an unguarded `Array.prototype.shift()` result
> (`:247`), `corefiles[0]` passed as a `PathLike` (`:172`), an unguarded index
> (`:254`) and an overload mismatch (`internalIndexHandler.ts:203`). And the
> generalisation drawn from them does not survive the same measurement taken
> across sprints 6 and 7: **14 of 246** strict errors are the config shape. The
> strict list mostly *is* a quality score per file. These two files are the case
> where it is partly something else — not the proof that it generally is.

### Equivalence note

1. **`fs.rmSync` replaces `fs.rmdirSync(…, { recursive: true })`** — verified
   equivalent on the CI runtime before the change, not assumed from the types.
2. **Two `catch (e)` bindings are dropped** where the error was never read, each
   with the reason it is ignored: a best-effort core-file cleanup whose path is
   already in the warning, and an `accessSync` probe whose failure *is* the
   answer ("no history to clean").
3. **Three specs follow the source's `node:` specifiers.** `mock-require` matches
   the **specifier**, not the module, so `mockrequire("fs", …)` does not intercept
   `require("node:fs")`. Both spellings are now registered — the same adjustment
   H5 and H6 made, and the reason `test:unit:mocha` went red before it went green.
4. **`FsMock` gains an `rmSync` stub** and `dumpGenerator.test.js` counts it
   instead of `rmdirSync`, following (1).
