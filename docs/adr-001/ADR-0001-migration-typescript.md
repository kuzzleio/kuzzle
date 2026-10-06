# ADR-0001: Incremental migration from JavaScript to TypeScript

**Status:** **Closed — implemented (2026-09-24), frozen 2026-10-06.** All four Definition-of-Done boxes are ticked. The two follow-on steps are closed too: [step 15](steps/15-consolidation-non-regression.md) shipped as `2.57.0` (2026-09-30), and [step 08](steps/08-type-debt-backlog.md) handed its remaining findings to [#2968](https://github.com/kuzzleio/kuzzle/issues/2968). The full status line it replaced is in the [journal](journal.md#the-hub-as-it-stood-on-2026-10-06-when-the-adr-was-frozen).
**Date:** 2026-07-12 → implemented 2026-09-24
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io), to be validated collectively
**Scope:** Production code (`lib/`, `bin/`, `index.ts`) and unit tests
**Related documents:** [type-debt register](type-debt-register.md) · [lessons](lessons.md) · [journal](journal.md) · step files under [`steps/`](steps/)

> Living hub (structure per the `kuzzle-adr` skill). The **Decision** and **Target architecture** are stable; **Cold start** and the **Step table** track live progress; the execution detail of each milestone lives in [`steps/`](steps/). To resume the effort in a fresh context, read **Cold start**.

---

## Decision

### Context

Kuzzle is a mature codebase (v2.56.0, Node ≥20 <25) whose TypeScript migration is **already underway but unfinished and uneven**. It is not _one_ migration but **three intertwined efforts**, which is why it stalls (state at decision time, 2026-07-12):

| Axis                    | Starting state (2026-07-12)                                      | Target         |
| ----------------------- | ---------------------------------------------------------------- | -------------- |
| **1. Language**         | ~50% of `lib/` still JS (94 `.js` files); `bin/` mostly JS       | 100% `.ts`     |
| **2. Unit-test runner** | 168 Mocha specs in JS under `test/`; vitest scaffolded but empty | vitest + TS    |
| **3. Type strictness**  | `strict` off; only `noUncheckedIndexedAccess` on                 | `strict: true` |

Forces at play:

- **Clean interop** — `allowJs: true` + **0 hard `require('./x.js')`** in existing TS, so file-by-file conversion does not break import chains.
- **Safety net** — cucumber functional tests are already 100% TS and cover the critical paths, protecting refactors of the big files.
- **The remaining JS files are the hardest** — the largest, most critical files are still JS (`httpRoutes` 1554 LOC, `httpwsProtocol` 1254, `pluginsManager` 1244, `node` 1203, `validation` 1180, `documentController` 1165, `funnel` 1143) → the core must come **last**, under the functional-test net.
- **Double test debt** — the language axis is blocked by the runner question: converting a Mocha test to `.ts` without moving it to vitest only shifts the debt.
- **Why now** — a durable hybrid costs more than either extreme (double tooling, false-safety partial typing, confusing onboarding), and the un-migrated files are exactly the riskiest.

Full baseline figures: [step 01, Appendix A](steps/01-sprint-0-tooling.md). Options weighed and rejected: [step 00](steps/00-rejected-alternatives.md).

### Decision

Adopt an **incremental migration, driven by a CI ratchet, sequenced by architectural layer**, handling the three axes in a **decoupled but coordinated** way:

1. **Language (JS → TS)** — top priority. Every `.js` in `lib/` and `bin/` becomes `.ts`. A CI ratchet forbids any new `.js` (the count may only decrease). Organised in per-layer sprints, leaves → core, plus the boy-scout rule (convert what you touch).
2. **Strictness (progressive)** — the target is `strict: true`, but it does **not** block the language axis. Strict is adopted file-by-file; a second ratchet keeps the adopted scope from regressing.
3. **Unit tests (decoupled)** — the 168 Mocha specs are **frozen**; every new test is vitest + TS; legacy specs migrate progressively under a mocha-count ratchet; Mocha is removed once the count reaches zero.

**Definition of Done:**

- [x] `0` JavaScript files in `lib/` and `bin/` (excluding generated files **and the 3 plugin fixtures under `bin/plugins/available/**`** — see the register, 2026-09-09: the `js` ratchet's floor is therefore `3`, not `0`). _`bin/copy-binaries.js` was long miscounted as a 4th fixture; it is build tooling, and it was converted rather than exempted ([#2713](https://github.com/kuzzleio/kuzzle/pull/2713))._ ⚠️ **Corrected 2026-09-11 ([TD-45](type-debt-register.md#td-45)):** `bin/start-kuzzle-server` and `bin/wait-kuzzle` are extensionless `#!/usr/bin/env node` scripts that `-name '*.js'` never matched, so they had never been counted. _(**Closed 2026-09-24, [step 03](steps/03-sprint-2-bin.md)** — both executables are TypeScript, `js` 5 → 3, the floor. Typing the first of them turned up [TD-84](type-debt-register.md#td-84): every command-line option of the published entrypoint was dead.)_
- [x] `strict: true` in the main `tsconfig.json`; `allowJs` removed. _(2026-09-21, [step 12](steps/12-sprint-9-strict-flip.md) K6 — `tsconfig.json` is production-only and strict; the specs moved to `tsconfig.tests.json`.)_
- [x] `0` Mocha specs; vitest + TS the only unit runner; `mocha`/`rewire`/`c8` removed. _(2026-09-24, [step 13](steps/13-sprint-10-test-closure.md) — L6h took the ratchet to 0, L7a deleted the apparatus: `.mocharc`, `test/`, `mocha`, `@types/mocha`, `mock-require`, `rewire`, `c8`, `should-sinon`, `sinon`, `build:tests` and the `mocha` ratchet itself.)_ ⚠️ **This line used to name `should` too, and that was wrong**: `should` is cucumber's assertion library in 17 files across `features/` and `features-legacy/`, and it outlives axis 2 — see [What L7a found](steps/13-sprint-10-test-closure.md#what-l7a-found). `sinon` did leave: zero `tests/` specs import it.
- [x] Cucumber functional tests unchanged (already TS). _Satisfied since the ADR opened — the suites were TypeScript already and no conversion touched them. Making them **strict** is [step 14](steps/14-test-program-strict.md), which this box does not ask for._

Why this over big-bang, pure-opportunistic, full-strict-now or coupled-tests: [step 00](steps/00-rejected-alternatives.md).

### Consequences

**Easier:** safe refactors (the compiler catches contract breaks) on today's untyped code; one language and one unit runner in the end; autocompletion/DX across the whole core.
**Harder / costlier:** durable CI discipline (four count ratchets, a set ratchet, and a strict scope to maintain); temporary coexistence of two runners and of strict/non-strict `.ts`; the big files (`httpwsProtocol`, `node`, `pluginsManager`) need special care and stronger review.

---

## Target architecture

Stable reference for _how_ the migration is enforced and sequenced. How it was built: [step 01](steps/01-sprint-0-tooling.md).

### Enforcement — five ratchets, and `strict` in the build

- **Count ratchets** (`scripts/ratchet.sh <js|any|casts>`, `npm run ratchet`): the counts of `.js` files, written `any` and type assertions may **only decrease**; a reduction updates its baseline in `.migration/` in the same PR. _Two have retired, each having done its job: `implicit-any` with the strict flip (`strict` subsumes `noImplicitAny`), and **`mocha`** with [step 13](#step-table)'s L7a — it counted `test/**/*.test.js`, reached 0, and the directory it counted no longer exists._
- **~~Progressive strict~~ → `strict: true` in `tsconfig.json` (2026-09-21).** For the eight sprints it took to get there, strict was enforced on a growing file list (`.migration/strict-adopted.txt`) by **filtering tsc output** — _not_ via `include`, since tsc pulls the entire import graph into the program. The list reached all of `lib/` and the machinery was deleted with [step 12](steps/12-sprint-9-strict-flip.md)'s K6. **`npm run build` is now the strict type-check**; `npm run typecheck:tests` covers the specs, which have their own non-strict program (`tsconfig.tests.json`) because `strict` applies to a program and not to a file.
- The **written-`any`** ratchet (`any`) exists because explicit `any` is **invisible** to `strict` (see step 01). It counts `: any`, `as any` **and `as unknown as`** — the escape hatch a conversion reaches for once `: any` is forbidden.
- The **implicit-`any`** ratchet (`implicit-any`, `tsconfig.implicit.json`) counts the `TS7xxx` diagnostics over `lib/` + `index.ts` under `noImplicitAny`. It exists because the written-`any` ratchet charges **nothing** for an un-annotated parameter: without it, renaming a file without typing anything scores a perfect zero (see [step 06](steps/06-hardening-mid-course.md)).
- The **`casts`** ratchet (added 2026-09-15, [TD-43](type-debt-register.md#td-43)) counts the **type assertions** in `lib/**/*.ts` — `x as T` and `<T>x` — because `as T` is the hatch the debt moves to once written `any` is ratcheted, and it is the worse of the two: `any` is permissive and visibly untyped, while a _wrong_ `as T` asserts a specific wrong type silently and every gate downstream believes it. `as const` is excluded (it can only narrow to what is already written); `as any`, `as unknown` and both halves of an `as unknown as T` / `as any as T` chain are excluded because the `any` ratchet already charges for them. It is the only ratchet that **parses** rather than greps — see `scripts/count-casts.ts`. Baseline: `.migration/casts-baseline.txt`.
- The **`cpd-exclusions`** ratchet (added 2026-09-11, [TD-23](type-debt-register.md#td-23)) guards `sonar.cpd.exclusions`, the escape hatch a conversion uses when a rename re-scores pre-existing duplication as new code. It is the only one that compares a **set** rather than a count — a count would let a PR swap an entry out for a new one — and it fails on any addition. Baseline: `.migration/cpd-exclusions.txt`.

### Conversion standards (per file)

- Rename `.js` → `.ts`; fix imports/exports (`export`/`import`, or `export =` for a single export, per the existing CommonJS shape).
- **Forbidden in a conversion:** unjustified implicit `any`, `@ts-ignore`/`@ts-nocheck` without a comment + ticket, `!` (non-null assertion) to "make it pass". Prefer real typing or `unknown` + narrowing.
- Reuse and enrich `lib/types`; do not duplicate.
- One PR = one layer (or a coherent subset), small and reviewable, that **decrements the JS baseline**.
- **~~Adopt / report~~ — superseded 2026-09-21 by the flip.** There is no adoption list and no count to report: `strict: true` is in `tsconfig.json`, so a file that does not pass strict does not build. The duty this replaced is worth keeping in view, because it is what the flip cost: for eight sprints a conversion either adopted its files into `.migration/strict-adopted.txt` or stated, per file, the count it left behind and **which of those errors are guards the runtime can reach** — a bug list, not a typing chore. Nothing asked for the second half until [TD-54](type-debt-register.md#td-54), and by then sprints 6 and 7 had left **246** errors across their six largest files, credited wholesale to [TD-53](type-debt-register.md#td-53), of which only 14 were. _A conversion that compiles is not a conversion that checks._
- **A file with no unit spec ships one** (vitest + TS) in its conversion PR: converting untested code is converting blind, and it is the only mechanism that makes the mocha counter fall.
- **No behaviour change in a conversion PR.** Structural refactors stay separate — _except_ the behaviour-preserving ones the SonarCloud new-code gate forces (a rename re-scores the whole file as new code, so pre-existing S2004/S3776 smells must be cleared in-PR). Those are **in scope**, under two conditions: the extraction is **verbatim**, and the step file carries an **equivalence note** stating why behaviour is preserved. See [step 06](steps/06-hardening-mid-course.md) for why the rule is written this way rather than broken every sprint.

### Sequencing (leaves → core)

| Sprint | Target                                                       | Risk       |
| ------ | ------------------------------------------------------------ | ---------- |
| 0      | Tooling & prerequisites (ratchets, strict, `kuzzle-sdk` pin) | Low        |
| 1      | `lib/util` (warm-up)                                         | Low        |
| 2      | `bin/` cleanup + real entrypoints                            | Low/med    |
| 3      | `lib/model`, `lib/service`                                   | Low/med    |
| 4      | `lib/api` (controllers, `funnel`)                            | Medium     |
| 5      | `lib/core` I — storage, security, realtime                   | Med/high   |
| 6      | `lib/core` II — validation, plugin, network/protocols        | **High**   |
| 7      | `lib/cluster` (`node`, `subscriber`)                         | **High**   |
| 8      | `lib/kuzzle`, `index`                                        | Medium     |
| 9      | Final strict flip; remove `allowJs`                          | Medium     |
| 10     | Test closure — legacy Mocha → vitest, remove Mocha           | Spread out |

> Sprints 5–7 run **under the cucumber functional-test net** — the main guarantee against core regressions. The real `strictNullChecks` cost falls on the big JS files (`funnel`, `httpwsProtocol`, `node`, `validation`), not the already-migrated TS; the low `any` count of `lib/cluster` is misleading (un-converted JS, not clean code). Budget sprints 4, 6 and 7 accordingly.
>
> ⚠️ **Sprints 7 and 8 were swapped on 2026-09-15** — `lib/kuzzle` first, `lib/cluster` last. This table is the plan as written on 2026-07-12 and is left as it was; the live order is the [step table](#step-table). The swap was decided on measured coverage: `lib/cluster` holds the only two spec efforts left in the repo, and keeping conversions and spec efforts in separate sprints is what step 09 paid to learn. `index` has since been dropped from sprint 8's target — `index.ts` was converted long before. → [decision register, 2026-09-15](#decision-register)

### Tests

Mocha frozen and running as-is; new tests in vitest + TS; legacy specs migrated progressively (mocha ratchet). **Closure (sprint 10): done** — [step 13](steps/13-sprint-10-test-closure.md) took the count 148 → 0 in seven slices and L7a removed `mocha`, `.mocharc`, `should-sinon`, `sinon`, `rewire`, `mock-require`, `c8`, `test/` and the `test:unit:mocha*` commands. ⚠️ **`should` was on this list and should not have been** — it is cucumber's assertion library as well, and it stays; see [What L7a found](steps/13-sprint-10-test-closure.md#what-l7a-found). The vitest spec location was settled: `tests/`, mirroring the source tree.

---

## Cold start

> Living section (maintained by the `wrapup` skill). **Read this to resume** in a fresh context.

**This ADR is closed and frozen (2026-10-06): there is nothing to resume.** Every step file is archive.

- The migration shipped in **`2.57.0`** (2026-09-30), after [step 15](steps/15-consolidation-non-regression.md)'s non-regression audit and five betas.
- The type-debt findings still open in the [register](type-debt-register.md) are tracked in [#2968](https://github.com/kuzzleio/kuzzle/issues/2968), not here.
- Breaking changes set aside for the next major: [`docs/v3-breaking-changes.md`](../v3-breaking-changes.md). The follow-up decision on the public types is [ADR-0002](../adr-002/ADR-0002-own-api-contract-types.md).
- The cold start this replaced (25 KB, as of 2026-09-27) is in the [journal](journal.md#the-hub-as-it-stood-on-2026-10-06-when-the-adr-was-frozen).

---

## Step table

The spine. One row per unit of work; `Detail` links to the step file. PR lists are cut to the first one (every step file has all of them); the full table is in the [journal](journal.md#the-hub-as-it-stood-on-2026-10-06-when-the-adr-was-frozen).

| #   | Step                                                                          | Status                              | PR(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Detail                                       |
| --- | ----------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 00 | Rejected alternatives (decision rationale) | 🧊 Archive | — | [detail](steps/00-rejected-alternatives.md) |
| 01 | Sprint 0 — tooling & foundations (ratchets, strict, `kuzzle-sdk` pin) | ✅ Done | #2668, #2669 | [detail](steps/01-sprint-0-tooling.md) |
| 02 | Sprint 1 — `lib/util` warm-up (100% TS) | ✅ Done | #2670, #2674 | [detail](steps/02-sprint-1-util.md) |
| 03 | Sprint 2 — `bin/`: dead code, then the two entrypoints | ✅ Done | #2671 · [#2872](https://github.com/kuzzleio/kuzzle/pull/2872) | [detail](steps/03-sprint-2-bin.md) |
| 04 | Sprint 3 — models & services (100% TS) | ✅ Done | #2676 | [detail](steps/04-sprint-3-model-service.md) |
| 05 | Sprint 4 — `lib/api` (controllers, `funnel`) — **100% TS** | ✅ Done | #2679 A · #2680 B · #2681 C · #2682 D · #2685 E1 · #2686 E2 | [detail](steps/05-sprint-4-api.md) |
| 06 | Mid-course hardening (enforcement before `lib/core`) | ✅ Done | #2689 F1 · #2693 F2 · #2694 F3 | [detail](steps/06-hardening-mid-course.md) |
| 07 | Sprint 5 — core I (storage, security, realtime, cache, shared) — **100% TS** | ✅ Done | [#2695](https://github.com/kuzzleio/kuzzle/pull/2695) G1 · … | [detail](steps/07-sprint-5-core-i.md) |
| 08 | Type-debt backlog, worked in parallel with the sprints | ✅ Done — closed 2026-10-06; the open findings moved to [#2968](https://github.com/kuzzleio/kuzzle/issues/2968) | TD-26 [#2699](https://github.com/kuzzleio/kuzzle/pull/2699) · … | [detail](steps/08-type-debt-backlog.md) |
| 09 | Sprint 6 — core II (validation, plugin, network) — **100% TS** | ✅ Done | [#2722](https://github.com/kuzzleio/kuzzle/pull/2722) H1 · … | [detail](steps/09-sprint-6-core-ii.md) |
| 10 | Sprint 7 — `lib/kuzzle` (bootstrap, vault, dumps, event runner) — **100% TS** | ✅ Done | [#2752](https://github.com/kuzzleio/kuzzle/pull/2752) I1 · [#2753](https://github.com/kuzzleio/kuzzle/pull/2753) I2 · … | [detail](steps/10-sprint-7-kuzzle.md) |
| 11 | Sprint 8 — `lib/cluster` (the last conversion sprint) — **100% TS** | ✅ Done | [#2772](https://github.com/kuzzleio/kuzzle/pull/2772) J0 · … | [detail](steps/11-sprint-8-cluster.md) |
| 12 | Sprint 9 — final strict flip, remove `allowJs` | ✅ Done | [#2799](https://github.com/kuzzleio/kuzzle/pull/2799) K0 · … | [detail](steps/12-sprint-9-strict-flip.md) |
| 13 | Sprint 10 — test closure (Mocha → vitest): 148 spec files, 64 295 lines | ✅ Done | **55 PRs**, L0–L7 — spine: [#2805](https://github.com/kuzzleio/kuzzle/pull/2805) L0 · … | [detail](steps/13-sprint-10-test-closure.md) |
| 14 | The test program under `strict` — 1 077 errors (1 448 with `noUncheckedIndexedAccess`) | ✅ Done | [#2867](https://github.com/kuzzleio/kuzzle/pull/2867) · … | [detail](steps/14-test-program-strict.md) |
| 15 | Consolidation — non-regression & breaking-change audit against `v2.56.0`, then beta | ✅ Done — `2.57.0` released 2026-09-30 | [#2901](https://github.com/kuzzleio/kuzzle/pull/2901) · … | [detail](steps/15-consolidation-non-regression.md) · [inventory](step-15-inventory.md) |

---

## Decision register

Canonical "what we decided", one line each; the full text of every entry is in the [journal](journal.md#the-hub-as-it-stood-on-2026-10-06-when-the-adr-was-frozen). Links point to the step that details it.

- **2026-09-24** — **[Step 14, M8](steps/14-test-program-strict.md#what-m8-found): `noUncheckedIndexedAccess` is on for `lib/` and off for the test program, by decision.**
- **2026-09-24** — **Step 13 is closed: the unit suite is one runner, and the plan that got there was wrong in the same direction five times.** → [13](steps/13-sprint-10-test-closure.md)
- **2026-09-24** — **The two `bin/` executables go into different programs, and the published path does not move.** → [03](steps/03-sprint-2-bin.md)
- **2026-09-24** — **`should` is not Mocha's, and the ADR's Definition of Done was wrong to list it.** → [13](steps/13-sprint-10-test-closure.md)
- **2026-09-24** — **The test program's strict debt is [step 14](steps/14-test-program-strict.md), not a step 13 slice, and step 13 authored a third of it.**
- **2026-09-24** — **A gate whose input set cannot be non-empty is indistinguishable from a deleted gate, except that it still looks like enforcement.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13, L1: c8 and vitest's v8 provider do not share a denominator, so their percentages cannot be compared.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13, L1: the axis a slice is cut on is a hypothesis, and this is the third time it was wrong.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13, L1: a word that means different things by type is where a codemod lies.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13, L0: a line count compares two texts; only coverage compares two tests.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13's perimeter is the unit suites; cucumber is not part of it.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 13 is sliced on what a spec mocks with, not on how big it is.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **A ratchet that counts files can be satisfied by deleting coverage, and this one nearly was.** → [13](steps/13-sprint-10-test-closure.md)

- **2026-09-21** — **Step 12, K6: `strict` is a property of a program, so the flip is a decision about `include`, not about a flag.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K6: a build-payload gate derived from `package.json`'s `files` cannot see a consumer that is not a package consumer.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K5: hoisting an indexed read out of its call site drops the receiver, and the hoist is exactly what strict asks for.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K4/K5: declaring what a name is finds defects that reading the code does not.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K4/K5: post-`init()` state is an accessor, not a nullable field dereferenced on faith.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K5: `request.context` and `request.input` are getters, so checking one of their properties never narrows the next read of it.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K4: a deferral written into a type is a decision with a trigger, and the trigger fires.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-21** — **Step 12, K4/K5: `satisfies` is the answer when a literal table is both checked and read back by key.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-20** — **Step 12, K3: a ratchet that can never be overridden is one that gets deleted the first time it is wrong.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-20** — **Step 12, K3: a narrowing that discards data is a behaviour change wearing a type's clothes.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-20** — **Step 12, K3: declaring an untyped module honestly is a defect-finding exercise, not paperwork.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-20** — **Step 12, K3: with near-identical twins, take one to zero before touching the other.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-19** — **Step 12, K2: a private-field convention the compiler cannot see is a typing blocker, and moving it is a public-API decision.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-19** — **Step 12, K1: a file's error count does not predict whether it can be fixed alone.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-07-12** — Migrate **incrementally** (CI ratchet + per-layer sprints, leaves → core); reject big-bang and pure-opportunistic. → [00](steps/00-rejected-alternatives.md)
- **2026-07-12** — Treat the migration as **three decoupled-but-coordinated axes** (language priority · progressive strict · frozen Mocha). → [00](steps/00-rejected-alternatives.md)
- **2026-07-12** — Adopt `strict` **file-by-file**, enforced by **filtering tsc output** (not tsconfig `include`, which pulls the whole graph); flip global `strict: true` only at the end. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — **Freeze** → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — Add a **3rd ratchet on explicit `any`** (invisible to `noImplicitAny`/`strictNullChecks`); re-enable `@typescript-eslint/no-explicit-any` as `warn`. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — **Bound the `kuzzle-sdk` pin** → [01](steps/01-sprint-0-tooling.md)
- **2026-07-15** — **Deprioritize Sprint 2** → [03](steps/03-sprint-2-bin.md)
- **2026-07-15** — **Relocate ADRs**
- **2026-07-17** — **Split Sprint 4 into 3 PRs** → [05](steps/05-sprint-4-api.md)
- **2026-07-17** — **PR A** → [05](steps/05-sprint-4-api.md)
- **2026-07-20** — **PR C** → [05](steps/05-sprint-4-api.md)
- **2026-07-21** — **PR D** → [05](steps/05-sprint-4-api.md)
- **2026-09-07** — **PR E1** → [05](steps/05-sprint-4-api.md)
- **2026-09-07** — **PR E2** → [05](steps/05-sprint-4-api.md)

- **2026-09-09** — **Sprint 4 closed** → [05](steps/05-sprint-4-api.md)
- **2026-09-09** — **Mid-course review of the 30 converted files** → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — Add a **4th ratchet on implicit `any`** (`TS7xxx` under `noImplicitAny`, baseline 520) and widen the written-`any` ratchet to `as unknown as` (200 → 208, a broadened metric and not a regression). Rationale: the written-`any` ratchet charges nothing for an un-annotated parameter, so it cannot tell a conversion from a rename. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Strict adoption becomes part of a conversion PR's DoD** → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **A conversion PR ships a vitest spec for a file that had none.** → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Gate-driven, behaviour-preserving refactors are IN scope for a conversion PR** → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Restoring `.ts` coverage (PR F2) gates the start of Sprint 5.** → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **The plugin fixtures under `bin/plugins/available/** → [03](steps/03-sprint-2-bin.md)

- **2026-09-09** — **Sprint 5 closed** → [07](steps/07-sprint-5-core-i.md)
- **2026-09-09** — **A file is measured by the runner that owns its spec.** → [07](steps/07-sprint-5-core-i.md)
- **2026-09-09** — **The type-debt register is burned down as a parallel track** → [08](steps/08-type-debt-backlog.md)
- **2026-09-09** — **`sonar.cpd.exclusions` shrinks for the first time** → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **Post-sprint review of the five merged PRs** → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **`bin/copy-binaries.js` is converted, not exempted** → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **Closing an issue is part of `wrapup`, not of merging** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **An exclusion list is a ratchet or it is debt.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A readiness probe must exercise the thing the caller depends on.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **The SDK's auto-reconnect cannot be used as a first-connection retry.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A `@deprecated` tag that names a replacement must be checked against the replacement.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **Plan a sprint on the normalised coverage report, never on raw `c8`.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A boolean validator every caller follows with a property read is an undeclared type guard.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A `hasOwnProperty` in validation code is load-bearing.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A per-type options shape needs a generic base class, not one wide interface.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A JSDoc type in an unconverted file is a name lookup in that file's scope, not a type.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A `@deprecated` line in a JSDoc block is never about one parameter.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **When a spec forces a non-idiomatic import, fix the spec.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A block that lands under the coverage threshold is naming the file that is not really tested.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **`ObjectRepository<TObject>` cannot express a nullable `load()`.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A dead parameter is worse than a removed one: it survives a conversion as a type.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **Fix the type where the defect is, not where it became visible.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A ratchet measures its predicate, not its label.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A check that reads its verdict out of another process's stdout must prove that process ran.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A job's `if:` is inherited by everything downstream of it.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A tool's scope is a glob written once, and the tree it names is the one being deprecated.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **An aggregate threshold prices the block and says nothing about its worst member.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **"No cast" is a proxy for "no unchecked claim", and a wrong type is the same claim made more quietly.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-14** — **A type-only import written as a value import is a runtime dependency, not a style preference.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-14** — **`lib/` does not import the package's own `index.ts`.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-14** — **A finding that counts its own instances has already chosen a predicate, and the predicate is the claim.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-15** — **A coverage number is the output of a merge, and a merge is a claim about what two measurements have in common.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-15** — **A ratchet that greps counts English.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **Sprint 6 opened** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-15** — **Sprint 6 closed** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-15** — **A gate-driven refactor is not done when the local checks pass.** → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-15** — **Sprint 7 is `lib/kuzzle`, not `lib/cluster`** → [10](steps/10-sprint-7-kuzzle.md)
- **2026-09-16** — **A conversion's definition of done must name the strict count it leaves behind.**
- **2026-09-17** — **Sprint 8 J1: converting a file found what six CI investigations had not.** → [11](steps/11-sprint-8-cluster.md)
- **2026-09-17** — **TD-65 and TD-67 fixed: TD-33's cluster half is closed.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-17** — **[TD-33](type-debt-register.md#td-33) closed ([#2715](https://github.com/kuzzleio/kuzzle/issues/2715)), after nine occurrences and five reviews.** → [08](steps/08-type-debt-backlog.md)
- **2026-09-18** — **Sprint 8 closed: `lib/` holds no JavaScript, and the language axis of this ADR is done.** → [11](steps/11-sprint-8-cluster.md)
- **2026-09-18** — **The strict-count DoD worked, and it is not enough.** → [12](steps/12-sprint-9-strict-flip.md)
- **2026-09-18** — **Step 12 opened on a measurement, and the measurement corrected the plan's own premise.** → [12](steps/12-sprint-9-strict-flip.md)
- **2026-09-18** — **`allowJs` is not blocked by the Mocha suite, contrary to what the step order assumed.** → [12](steps/12-sprint-9-strict-flip.md)
- **2026-09-18** — **[TD-71](type-debt-register.md#td-71): a ratchet's test is "did the tool run", never "is the count small".**
- **2026-09-18** — **[TD-72](type-debt-register.md#td-72): the local Docker unit runner was installing into the bind-mounted host tree**
- **2026-09-18** — **The hub's cold start is a cold start again.**

- **2026-09-18** — **Step 12, K0: one type serving two directions always resolves in favour of the looser one.** → [12](steps/12-sprint-9-strict-flip.md)

- **2026-09-25** — **#2785 decided and done: retransmit, then evict** → [08](steps/08-type-debt-backlog.md)
- **2026-09-25** — **TD-20 closed without a breaking change** → [08](steps/08-type-debt-backlog.md)
- **2026-09-25** — **Consolidation is a step of this ADR, and it gates the release** → [15](steps/15-consolidation-non-regression.md)

---

## Open points

None: the ADR is frozen. Remaining type debt → [#2968](https://github.com/kuzzleio/kuzzle/issues/2968); v3 deferrals → [`docs/v3-breaking-changes.md`](../v3-breaking-changes.md). The list as it stood is in the [journal](journal.md#the-hub-as-it-stood-on-2026-10-06-when-the-adr-was-frozen).

---

## References

- **Companion:** [lessons](lessons.md) — every _generalisable part_ recorded by this ADR, one line each, with what enforces it. The 📝 rows are the backlog of what to gate next; a review that files a finding adds its row.
- **Companion:** [type-debt register](type-debt-register.md) — detailed, tracked findings of the 2026-07-12 audit (the ADR sets the strategy; the register tracks the execution).
- **Companion:** [journal](journal.md) — the cold-start narrative the hub carried up to 2026-09-18, archived when the language axis closed. History, not state.
- **Steps:** [`steps/`](steps/) — one file per milestone; `00` archives the rejected alternatives, `01`–`07` and `09`–`11` cover the eight conversion sprints (all closed and frozen), `08` is the parallel type-debt track (closed, remainder in [#2968](https://github.com/kuzzleio/kuzzle/issues/2968)), `12`–`14` close the strictness and test axes, `15` is the consolidation phase (next).
- **Process tooling:** the `kuzzle-adr` skill (this hub + steps structure) and the `wrapup` skill (keeps this document live).
- ADRs live under `docs/adr-<n>/` — distinct from `doc/` (reserved for the Kuzzle documentation tool).
