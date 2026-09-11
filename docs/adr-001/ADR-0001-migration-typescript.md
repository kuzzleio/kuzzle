# ADR-0001: Incremental migration from JavaScript to TypeScript

**Status:** Proposed
**Date:** 2026-07-12
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io), to be validated collectively
**Scope:** Production code (`lib/`, `bin/`, `index.ts`) and unit tests
**Related documents:** [type-debt register](type-debt-register.md) · step files under [`steps/`](steps/)

> Living hub (structure per the `kuzzle-adr` skill). The **Decision** and **Target architecture** are stable; **Cold start** and the **Step table** track live progress; the execution detail of each milestone lives in [`steps/`](steps/). To resume the effort in a fresh context, read **Cold start**.

---

## Decision

### Context

Kuzzle is a mature codebase (v2.56.0, Node ≥20 <25) whose TypeScript migration is **already underway but unfinished and uneven**. It is not *one* migration but **three intertwined efforts**, which is why it stalls (state at decision time, 2026-07-12):

| Axis | Starting state (2026-07-12) | Target |
|------|-----------------------------|--------|
| **1. Language** | ~50% of `lib/` still JS (94 `.js` files); `bin/` mostly JS | 100% `.ts` |
| **2. Unit-test runner** | 168 Mocha specs in JS under `test/`; vitest scaffolded but empty | vitest + TS |
| **3. Type strictness** | `strict` off; only `noUncheckedIndexedAccess` on | `strict: true` |

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

- [ ] `0` `.js` files in `lib/` and `bin/` (excluding generated files **and the 3 plugin fixtures under `bin/plugins/available/**`** — see the register, 2026-09-09: the `js` ratchet's floor is therefore `3`, not `0`). *`bin/copy-binaries.js` was long miscounted as a 4th fixture; it is build tooling, and it was converted rather than exempted ([#2713](https://github.com/kuzzleio/kuzzle/pull/2713)), which brings `bin/` to its floor.*
- [ ] `strict: true` in the main `tsconfig.json`; `allowJs` removed.
- [ ] `0` Mocha specs; vitest + TS the only unit runner; `mocha`/`should`/`rewire`/`c8` removed.
- [ ] Cucumber functional tests unchanged (already TS).

Why this over big-bang, pure-opportunistic, full-strict-now or coupled-tests: [step 00](steps/00-rejected-alternatives.md).

### Consequences

**Easier:** safe refactors (the compiler catches contract breaks) on today's untyped code; one language and one unit runner in the end; autocompletion/DX across the whole core.
**Harder / costlier:** durable CI discipline (four count ratchets, a set ratchet, and a strict scope to maintain); temporary coexistence of two runners and of strict/non-strict `.ts`; the big files (`httpwsProtocol`, `node`, `pluginsManager`) need special care and stronger review.

---

## Target architecture

Stable reference for *how* the migration is enforced and sequenced. How it was built: [step 01](steps/01-sprint-0-tooling.md).

### Enforcement — five ratchets + progressive strict

- **Count ratchets** (`scripts/ratchet.sh <js|mocha|any|implicit-any>`, `npm run ratchet`): the counts of `.js` files, Mocha specs, written `any` and inferred (implicit) `any` may **only decrease**; a reduction updates its baseline in `.migration/` in the same PR.
- **Progressive strict** (`tsconfig.strict.json` + `scripts/strict-check.sh`, `npm run test:strict`): strict is enforced on the growing file list `.migration/strict-adopted.txt` by **filtering tsc output** — *not* via `include`, since tsc pulls the entire import graph into the program. The list grows to cover all of `lib/`, then `strict: true` flips globally and this machinery is removed.
- The **written-`any`** ratchet (`any`) exists because explicit `any` is **invisible** to `strict` (see step 01). It counts `: any`, `as any` **and `as unknown as`** — the escape hatch a conversion reaches for once `: any` is forbidden.
- The **implicit-`any`** ratchet (`implicit-any`, `tsconfig.implicit.json`) counts the `TS7xxx` diagnostics over `lib/` + `index.ts` under `noImplicitAny`. It exists because the written-`any` ratchet charges **nothing** for an un-annotated parameter: without it, renaming a file without typing anything scores a perfect zero (see [step 06](steps/06-hardening-mid-course.md)).
- The **`cpd-exclusions`** ratchet (added 2026-09-11, [TD-23](type-debt-register.md#td-23)) guards `sonar.cpd.exclusions`, the escape hatch a conversion uses when a rename re-scores pre-existing duplication as new code. It is the only one that compares a **set** rather than a count — a count would let a PR swap an entry out for a new one — and it fails on any addition. Baseline: `.migration/cpd-exclusions.txt`.

### Conversion standards (per file)

- Rename `.js` → `.ts`; fix imports/exports (`export`/`import`, or `export =` for a single export, per the existing CommonJS shape).
- **Forbidden in a conversion:** unjustified implicit `any`, `@ts-ignore`/`@ts-nocheck` without a comment + ticket, `!` (non-null assertion) to "make it pass". Prefer real typing or `unknown` + narrowing.
- Reuse and enrich `lib/types`; do not duplicate.
- One PR = one layer (or a coherent subset), small and reviewable, that **decrements the JS baseline**.
- **If the converted file passes strict, adopt it** into `.migration/strict-adopted.txt` in the same PR — part of the PR's definition of done. `npm run test:strict -- --candidates` lists what is clean but unadopted, and `pr-preflight` warns about it. Deferring adoption is what turns sprint 9 into a wall.
- **A file with no unit spec ships one** (vitest + TS) in its conversion PR: converting untested code is converting blind, and it is the only mechanism that makes the mocha counter fall.
- **No behaviour change in a conversion PR.** Structural refactors stay separate — *except* the behaviour-preserving ones the SonarCloud new-code gate forces (a rename re-scores the whole file as new code, so pre-existing S2004/S3776 smells must be cleared in-PR). Those are **in scope**, under two conditions: the extraction is **verbatim**, and the step file carries an **equivalence note** stating why behaviour is preserved. See [step 06](steps/06-hardening-mid-course.md) for why the rule is written this way rather than broken every sprint.

### Sequencing (leaves → core)

| Sprint | Target | Risk |
|--------|--------|------|
| 0 | Tooling & prerequisites (ratchets, strict, `kuzzle-sdk` pin) | Low |
| 1 | `lib/util` (warm-up) | Low |
| 2 | `bin/` cleanup + real entrypoints | Low/med |
| 3 | `lib/model`, `lib/service` | Low/med |
| 4 | `lib/api` (controllers, `funnel`) | Medium |
| 5 | `lib/core` I — storage, security, realtime | Med/high |
| 6 | `lib/core` II — validation, plugin, network/protocols | **High** |
| 7 | `lib/cluster` (`node`, `subscriber`) | **High** |
| 8 | `lib/kuzzle`, `index` | Medium |
| 9 | Final strict flip; remove `allowJs` | Medium |
| 10 | Test closure — legacy Mocha → vitest, remove Mocha | Spread out |

> Sprints 5–7 run **under the cucumber functional-test net** — the main guarantee against core regressions. The real `strictNullChecks` cost falls on the big JS files (`funnel`, `httpwsProtocol`, `node`, `validation`), not the already-migrated TS; the low `any` count of `lib/cluster` is misleading (un-converted JS, not clean code). Budget sprints 4, 6 and 7 accordingly.

### Tests

Mocha frozen and running as-is; new tests in vitest + TS; legacy specs migrated progressively (mocha ratchet). **Closure (sprint 10):** at mocha = 0, remove `mocha`, `.mocharc`, `should`, `should-sinon`, `rewire`, `c8` and the `test:unit:mocha` command. The vitest spec location is still an open point (below).

---

## Cold start

> Living section (maintained by the `wrapup` skill). **Read this to resume** in a fresh context.

**Where we are (2026-09-11):** the foundation is in place (ADR, register, **5** CI ratchets, progressive strict, ESLint). **Sprint 1 done** (`lib/util` 100% TS), **Sprint 3 done** (`lib/model` + `lib/service` 100% TS) and **Sprint 4 done** — `lib/api` is **100% TypeScript**, all six PRs merged into `2-dev` (A [#2679](https://github.com/kuzzleio/kuzzle/pull/2679), B [#2680](https://github.com/kuzzleio/kuzzle/pull/2680), C [#2681](https://github.com/kuzzleio/kuzzle/pull/2681), D [#2682](https://github.com/kuzzleio/kuzzle/pull/2682), E1 [#2685](https://github.com/kuzzleio/kuzzle/pull/2685), E2 [#2686](https://github.com/kuzzleio/kuzzle/pull/2686)). **js baseline 111 → 66** since the ADR opened.

**[Step 06 — mid-course hardening](steps/06-hardening-mid-course.md) is done** (F1 [#2689](https://github.com/kuzzleio/kuzzle/pull/2689), F2 [#2693](https://github.com/kuzzleio/kuzzle/pull/2693), F3 [#2694](https://github.com/kuzzleio/kuzzle/pull/2694), all merged into `2-dev` 2026-09-09). A review of the 30 converted files found the code clean on the letter of the standard but the *machinery* blind: implicit `any` uncounted, one un-annotated default parameter costing 137 strict errors, 48 strict-clean files unadopted, and **no coverage measured on `.ts` at all**. All four are now fixed and enforced.

**[Step 07 — Sprint 5 (`lib/core` I)](steps/07-sprint-5-core-i.md) is done and frozen** (G1 [#2695](https://github.com/kuzzleio/kuzzle/pull/2695), G2 [#2696](https://github.com/kuzzleio/kuzzle/pull/2696), G3 [#2698](https://github.com/kuzzleio/kuzzle/pull/2698), all merged into `2-dev`). 16 files, 3 801 LOC — `lib/core/{cache,realtime,security,shared,storage}` hold no `.js`; **js 66 → 50**. The sprint was sequenced by measured coverage rather than by layer alone, because the gate is armed (`new_coverage ≥ 80%`), and it settled two things the rest of the migration depends on: a rename makes the **whole** file new code for coverage, and `.ci/scripts/prepare-coverage.ts` is what lets a vitest-owned file be credited at all.

**[Step 08 — the type-debt backlog](steps/08-type-debt-backlog.md) is open**, run as a **parallel track** to the sprints: small single-purpose PRs burning down the register's tracked findings. Four closed on 2026-09-09 — TD-26 ([#2699](https://github.com/kuzzleio/kuzzle/pull/2699)), TD-21 ([#2700](https://github.com/kuzzleio/kuzzle/pull/2700)), TD-23 ([#2701](https://github.com/kuzzleio/kuzzle/pull/2701), the first CPD exclusion removed) and TD-22 ([#2702](https://github.com/kuzzleio/kuzzle/pull/2702), implicit-any 518 → 464). A **review of the five merged PRs on 2026-09-10** confirmed the direction and filed five follow-ups — [#2703](https://github.com/kuzzleio/kuzzle/issues/2703) (TD-21's fix is scoped to a shared funnel and drops the error `id`), [#2704](https://github.com/kuzzleio/kuzzle/issues/2704) (`memoryStorageController`'s class-wide index signature), [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) (`bin/copy-binaries.js` is not a fixture), [#2706](https://github.com/kuzzleio/kuzzle/issues/2706) (TD-23's helper signatures), [#2707](https://github.com/kuzzleio/kuzzle/issues/2707) (nothing charges for `@ts-ignore`) — **all five now landed** as TD-27 ([#2709](https://github.com/kuzzleio/kuzzle/pull/2709)), TD-28 ([#2710](https://github.com/kuzzleio/kuzzle/pull/2710)), TD-31 ([#2711](https://github.com/kuzzleio/kuzzle/pull/2711)), TD-29 ([#2712](https://github.com/kuzzleio/kuzzle/pull/2712)), TD-30 ([#2713](https://github.com/kuzzleio/kuzzle/pull/2713)), plus TD-32 ([#2716](https://github.com/kuzzleio/kuzzle/pull/2716)).

A **second review, of those seven merged PRs, on 2026-09-10** found four defects they had introduced — a `npm run build` broken off Linux, a duplicated JSDoc block, a `_hash` overload declaring the wrong return type, and the `as any` that overload was meant to remove — filed as TD-34/TD-35 and fixed in the same pass; the missing guard that would have caught the first one is now a CI step (`.ci/scripts/check-build-payload.sh`). A **third review, of that follow-up pass itself**, found the guard was placed one build too early — `npm publish` re-runs `prepublishOnly` → `build`, which deletes the `dist/` the workflow step had just verified — and that it checked six hand-written paths rather than `package.json`'s `files` list, leaving the **error-code catalogue** (`dist/lib/**/*.json`) ungated: [TD-36](type-debt-register.md#td-36) and [TD-37](type-debt-register.md#td-37), both fixed. ⚠️ **`Closes #NNN` does not fire on `2-dev`** (GitHub only resolves it on `master`), so closing the issues is part of `wrapup`, not of merging.

**[Step 09 — Sprint 6 (`lib/core` II)](steps/09-sprint-6-core-ii.md) is open** (2026-09-11). 34 `.js` files, 8 195 LOC — validation 15 · network 14 · plugin 5. Sequenced by measured coverage per step 07's rule, and the measurement itself produced the step's first finding: **the raw `c8` report is not the number the gate sees**. `prepare-coverage.ts` drops blank and comment-only lines in *both* directions, so normalisation is not a free uplift — repo-wide it moves coverage 84.4% → 80.2%, and it puts three files (`pluginManifest` 80.4 → 59.3, `privilegedContext` 90.7 → 66.7, `router` 81.6 → 79.3) on the other side of the threshold. Planned as six PRs: **H1–H3 are conversions** (26 gate-safe files, aggregate 94.3%), **H4–H6 are spec efforts with a rename at the end** — `validation.js` (36.2%), `plugin`+`pluginsManager` (54.9%), `entryPoint`+`httpwsProtocol` (60.4%) — needing roughly **+900 covered lines** between them.

**Counters** (baselines in `.migration/`, re-verified on the H1 branch 2026-09-11): **js = 35**, **mocha = 151**, **any = 205**, **implicit-any = 461**; **strict adopted = 117** *(`--candidates` empty)*. H1 took js 49 → 35 and strict 102 → 117. The `any` metric includes `as unknown as`; it dropped 208 → 207 when TD-21 removed the cast its guard needed, then 207 → 205 when TD-34 typed `profileRepository`'s `_hash` patch site. implicit-any reached **461** with TD-28's third `Reflect.set` site (`core/shared/store.ts`). **Coverage is measured again on `.ts`** — `.ci/scripts/prepare-coverage.ts` normalises both reports and gives each file a single owning runner. Unit tests: 3030 Mocha + **183 vitest** (was 7). A **fifth ratchet**, `cpd-exclusions`, was added 2026-09-11 ([TD-23](type-debt-register.md#td-23)); its baseline is the 4 files currently excluded from CPD.
**Remaining JS by layer** (35 = 32 `lib/` + 3 `bin/`): `core` **20** (validation 1 — `validation.js`, H4 · network 14 · plugin 5) · `api` **0** · `kuzzle` 6 · `cluster` 6 · `bin` **3**, all plugin **fixtures** under `bin/plugins/available/**`, i.e. the floor — reached by [#2713](https://github.com/kuzzleio/kuzzle/pull/2713).

**Doc location (2026-07-15):** the ADR and its register moved from `adrs/` to `docs/adr-001/` (`git mv`, history preserved; references updated). ADRs now live under `docs/adr-<n>/`.

**Next actions:**

0. **All of the review follow-ups have landed.** [#2717](https://github.com/kuzzleio/kuzzle/pull/2717) (TD-34/TD-35) and [#2718](https://github.com/kuzzleio/kuzzle/pull/2718) (TD-36/TD-37) are merged into `2-dev`; [#2705](https://github.com/kuzzleio/kuzzle/issues/2705) was closed by hand on 2026-09-11 (`bin/copy-binaries.js` converted, not exempted — the `js` floor is 3). Nothing from the three review passes is outstanding.
1. **Sprint 6 — `lib/core` II is open: [step 09](steps/09-sprint-6-core-ii.md).** The step file carries the measured, gate-facing coverage of all 34 files and the six-PR plan built from it. **H1 is done** ([#2722](https://github.com/kuzzleio/kuzzle/pull/2722), `validation/types/*` + `baseType`, 14 files) — `lib/core/validation` holds one `.js` left, `validation.js` itself (H4). **Next is H2** (`network` minus `entryPoint`/`httpwsProtocol`, 12 files, 88.3%), then **H3** (the three `plugin` leaves, 76.1% — a conversion plus four lines of test). H4–H6 are spec efforts and should not be started as conversions.
2. **[Step 08 — type-debt backlog](steps/08-type-debt-backlog.md), in parallel.** [#2691](https://github.com/kuzzleio/kuzzle/issues/2691) (TD-23) is **closed** — the CPD exclusion list is now a ratchet, which was the part that prose could not do. Remaining: **TD-20, now split** — [#2688](https://github.com/kuzzleio/kuzzle/issues/2688) keeps the `setResult` half, blocked on the fact that its documented replacement (`response.configure`) cannot set a result at all, so it needs an API-shape decision before any code; [#2721](https://github.com/kuzzleio/kuzzle/issues/2721) carries the `getArrayLegacy` half, a breaking HTTP API change scheduled for the next major behind a deprecation cycle. [#2715](https://github.com/kuzzleio/kuzzle/issues/2715) (TD-33) is **mostly fixed** — readiness gate and `fail-fast: false` done; the `admin:resetDatabase` cross-node visibility race is the piece still open. TD-25 (`@types/debug` is wrong) has no issue — it is a note against repeating an experiment.
3. Then Sprints 7→8 (`lib/cluster`, `lib/kuzzle`), then 9 (final strict flip) & 10 (Mocha → vitest).
4. **Per PR:** convert one layer, keep `npx tsc --noEmit` green, `npm run ratchet` (js must drop, neither `any` counter may rise), decrement `.migration/js-baseline.txt`, **adopt the file into strict if it is clean**, **ship a vitest spec if it had none**, and run the impacted unit tests **in Docker** (`.ci/scripts/docker-test.sh unit mocha` — the native `re2` binding cannot load on host arm64). After merging into `2-dev`, **close the linked issues by hand**: `Closes #NNN` only fires on `master`.

> **Conversion gotchas (learned Sprint 1):** a file whose Mocha spec uses `rewire`/`__set__` on a required module (e.g. `didYouMean`) must keep the compiled variable name — use `import x = require("mod")`, not `import x from "mod"`. Typing a previously-`any` export (e.g. `Promback`) can break inferring consumers: make it **generic** (`Promback<T>`) and annotate the call sites rather than reintroducing `any`.

> **Coverage measurement (learned step 07, PR G3):** the two unit runners disagree on what a measurable line is — `c8` (wrapping Mocha) reports **every line of a loaded file**, comments included, because it maps the compiled output back onto the source; vitest's v8 provider reports only statements. Sonar unions both, so c8's inflated set dominates and **a file tested only in vitest cannot pass the 80% gate**. `.ci/scripts/prepare-coverage.ts` runs before the scan: it drops non-executable lines from both reports, then gives each file a single owner (the runner whose spec targets it, `tests/` mirror convention), never handing over a file vitest measures worse. Reproduce the CI numbers with the four commands in `CONTRIBUTING.md` › *How coverage is measured*.

> **Unit-test gotchas (learned step 07):** (1) **`import x = require(...)` is unloadable under vitest** — it emits a real `require()` vite cannot resolve, so any spec importing that module dies on `Cannot find module`. Use a **default import**, which type-checks against `export =` under `esModuleInterop` and works in both worlds. (2) **Convert, then write the spec** — never the reverse: vite cannot resolve a still-`.js` module's CommonJS `require` graph. (3) `vi.mock` factories are hoisted above the module body, so anything they close over must come from `vi.hoisted`. (4) A local mocha ∪ vitest coverage estimate is **not** a usable proxy for `new_coverage`: the two providers instrument different line sets (comments, braces), so a naive union under-reports. Read the number off the PR's SonarCloud analysis.

> **Unit-test gotchas (learned step 06):** (1) `vitest.config.ts` must **not** set `test.root` — coverage paths resolve against it, which sends the lcov to the wrong directory *and* caps the instrumented scope to the spec tree, so `lib/` is never measured (the vitest report was empty for as long as the runner existed). Select specs with `include` instead. (2) In a spec, a module exported with `export =` needs a **default import** (`import bytes from "…"`); `import bytes = require("…")` type-checks but does not resolve at runtime under vite. (3) A converted file **absent from the coverage report is more likely dead than untested** — check for callers first (`lib/util/wildcard.ts` had none).

> **Conversion gotchas (learned Sprint 4):** (1) the right import form depends on the **target's** export shape, not on a repo-wide convention — a barrel shipping `export = { … }` cannot be reached by a named ES import (`TS2497`; use `import x = require(…)` + destructuring), while a still-`.js` module cannot be reached by `import x = require(…)` (use a default import under `esModuleInterop`). (2) `git mv` matters: adding the `.ts` while leaving the `.js` tracked breaks nothing locally (every consumer uses the extensionless specifier) but **fails the js ratchet in CI** — run `npm run ratchet:js` before pushing. (3) Converting a **hub** file costs more than its own LOC: giving its collections a real element type newly type-checks every consumer (PR E2's `Map<string, NativeController>` cascaded into `serverController` and `realtimeController`).

**Key commands:**

```bash
npm run ratchet                     # js / mocha / any / implicit-any / cpd-exclusions
npm run test:strict                 # strict on adopted files (102)
npm run test:strict -- --candidates # clean files not yet adopted (currently empty)
npm run ratchet:js -- --update      # after a reduction: update the baseline
npx tsc --noEmit                    # full type-check; npm run build = tsc + copy-binaries
.ci/scripts/pr-preflight.sh         # lint + error-codes + ratchets/strict + 2 reminders
```

**Conversion convention:** `export =` for a single export, named exports for an object module; never `any` / `@ts-ignore` / `!` to "make it pass"; reuse `lib/types`; adopt the file into strict if clean; ship a vitest spec if it had none. Full standards in *Target architecture › Conversion standards*.

---

## Step table

The spine. One row per unit of work; `Detail` links to the frozen/living step file.

| # | Step | Status | PR(s) | Detail |
|----|------|--------|-------|--------|
| 00 | Rejected alternatives (decision rationale) | 🧊 Archive | — | [detail](steps/00-rejected-alternatives.md) |
| 01 | Sprint 0 — tooling & foundations (ratchets, strict, `kuzzle-sdk` pin) | ✅ Done | #2668, #2669 | [detail](steps/01-sprint-0-tooling.md) |
| 02 | Sprint 1 — `lib/util` warm-up (100% TS) | ✅ Done | #2670, #2674 | [detail](steps/02-sprint-1-util.md) |
| 03 | Sprint 2 — `bin/` cleanup (entrypoints deprioritized) | 🟦 Paused | #2671 | [detail](steps/03-sprint-2-bin.md) |
| 04 | Sprint 3 — models & services (100% TS) | ✅ Done | #2676 | [detail](steps/04-sprint-3-model-service.md) |
| 05 | Sprint 4 — `lib/api` (controllers, `funnel`) — **100% TS** | ✅ Done | #2679 A · #2680 B · #2681 C · #2682 D · #2685 E1 · #2686 E2 | [detail](steps/05-sprint-4-api.md) |
| 06 | Mid-course hardening (enforcement before `lib/core`) | ✅ Done | #2689 F1 · #2693 F2 · #2694 F3 | [detail](steps/06-hardening-mid-course.md) |
| 07 | Sprint 5 — core I (storage, security, realtime, cache, shared) — **100% TS** | ✅ Done | [#2695](https://github.com/kuzzleio/kuzzle/pull/2695) G1 · [#2696](https://github.com/kuzzleio/kuzzle/pull/2696) G2 · [#2698](https://github.com/kuzzleio/kuzzle/pull/2698) G3 | [detail](steps/07-sprint-5-core-i.md) |
| 08 | Type-debt backlog, worked in parallel with the sprints | 🟦 In progress | TD-26 [#2699](https://github.com/kuzzleio/kuzzle/pull/2699) · TD-21 [#2700](https://github.com/kuzzleio/kuzzle/pull/2700) · TD-23 [#2701](https://github.com/kuzzleio/kuzzle/pull/2701) · TD-22 [#2702](https://github.com/kuzzleio/kuzzle/pull/2702) · TD-27 [#2709](https://github.com/kuzzleio/kuzzle/pull/2709) · TD-28 [#2710](https://github.com/kuzzleio/kuzzle/pull/2710) · TD-31 [#2711](https://github.com/kuzzleio/kuzzle/pull/2711) · TD-29 [#2712](https://github.com/kuzzleio/kuzzle/pull/2712) · TD-30 [#2713](https://github.com/kuzzleio/kuzzle/pull/2713) · TD-32 [#2716](https://github.com/kuzzleio/kuzzle/pull/2716) · TD-34/35 + TD-36/37 [#2717](https://github.com/kuzzleio/kuzzle/pull/2717) | [detail](steps/08-type-debt-backlog.md) |
| 09 | Sprint 6 — core II (validation, plugin, network) | 🟦 In progress | [#2722](https://github.com/kuzzleio/kuzzle/pull/2722) H1 | [detail](steps/09-sprint-6-core-ii.md) |
| 10 | Sprint 7 — `lib/cluster` | ⬜ To do | — | — |
| 11 | Sprint 8 — `lib/kuzzle`, `index` | ⬜ To do | — | — |
| 12 | Sprint 9 — final strict flip, remove `allowJs` | ⬜ To do | — | — |
| 13 | Sprint 10 — test closure (Mocha → vitest) | ⬜ To do | — | — |

---

## Decision register

Canonical "what we decided", one line each. Links point to the step that details it.

- **2026-07-12** — Migrate **incrementally** (CI ratchet + per-layer sprints, leaves → core); reject big-bang and pure-opportunistic. → [00](steps/00-rejected-alternatives.md)
- **2026-07-12** — Treat the migration as **three decoupled-but-coordinated axes** (language priority · progressive strict · frozen Mocha). → [00](steps/00-rejected-alternatives.md)
- **2026-07-12** — Adopt `strict` **file-by-file**, enforced by **filtering tsc output** (not tsconfig `include`, which pulls the whole graph); flip global `strict: true` only at the end. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — **Freeze** the 168 Mocha specs; every new unit test in **vitest + TS**; migrate legacy progressively under a mocha-count ratchet. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — Add a **3rd ratchet on explicit `any`** (invisible to `noImplicitAny`/`strictNullChecks`); re-enable `@typescript-eslint/no-explicit-any` as `warn`. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-12** — **Bound the `kuzzle-sdk` pin** (`>=7.17.1 <8`) + snapshot the root-exported surface; keep the intentional `export * from "kuzzle-sdk"` re-export. → [01](steps/01-sprint-0-tooling.md)
- **2026-07-15** — **Deprioritize Sprint 2** (`bin/` entrypoints); only the dead-code removal (#2671) shipped, the rest waits behind the `lib/` layers. → [03](steps/03-sprint-2-bin.md)
- **2026-07-15** — **Relocate ADRs** from `adrs/` to `docs/adr-001/`; the repo convention is now `docs/adr-<n>/`.
- **2026-07-17** — **Split Sprint 4 into 3 PRs** (A: clean controllers + helpers · B: big controllers + server · C: `funnel`/`httpRoutes`/barrel), leaves → dispatch. → [05](steps/05-sprint-4-api.md)
- **2026-07-17** — **PR A** (#2679): 6 `lib/api` files → TS (`export =`, no new `any`); js baseline 79 → 73. `documentExtractor` split out to PR B — a `.js`→`.ts` rename makes SonarCloud score the whole file as new code, and its pre-existing deprecated-API calls (`setResult` options / `getArrayLegacy`) then fail the `0 New Issues` gate. Companion JSDoc fix in `validation.js` (DOM `Request` → `KuzzleRequest`). → [05](steps/05-sprint-4-api.md)
- **2026-07-20** — **PR C** (#2681): `memoryStorageController` → TS (`export =`, no new `any`); js 72 → 71. First converted controller whose Mocha spec drives `rewire` — kept `mapping`/helpers as top-level bindings + `export =` (no `__esModule` wrapper) so `__get__`/`__set__` resolve on the compiled CJS. Pre-existing intra-file duplication (the `mapping` table + repeated arg-extraction closures) CPD-excluded. → [05](steps/05-sprint-4-api.md)
- **2026-07-21** — **PR D** (#2682): `serverController` + `documentExtractor` → TS (`export =`, no new `any`, 0 logic change); js 71 → 69. The planned "migrate off `setResult`/`getArrayLegacy`" proved **behaviour-changing** (`response.configure` can't set the result and forces status 200; `getArray` throws where legacy `getArrayLegacy` `split(",")`s) → **kept the deprecated calls with `// NOSONAR`** and deferred the real (breaking) migration to a dedicated PR ([TD-20](type-debt-register.md)). Cross-layer type fixes: `kuzzle.statistics` `private`→`public`; `config.version` modelled (TD-18, partial). → [05](steps/05-sprint-4-api.md)
- **2026-09-07** — **PR E1** (#2685, `chore/ts-migration-sprint4-api-routes`): `httpRoutes` + `controllers/index` → TS (`export =`, no new `any`, 0 logic change); js 69 → 67, `lib/api` down to `funnel.js` alone. **Standardized every native controller on `export =`**: `adminController`, `authController` and `securityController` were still `export default class`, whose `__esModule` + `exports.default` shape forced the `new XController.default()` workaround in `funnel.js` and in 10 spec call sites — all removed. `httpRoutes` gets a module-local `KuzzleHttpRoute` interface (`url?` because the trailing loop derives it from `path`). `default.config.ts` had to drop the `.js` extension from its import: node10 module resolution does **not** substitute `.ts` for a `.js` specifier. `HttpConfiguration.routes` deliberately left `any` — typing it cascades into already-converted files. → [05](steps/05-sprint-4-api.md)
- **2026-09-07** — **PR E2** (#2686, `chore/ts-migration-sprint4-funnel`): `funnel` → TS (`export =`, no new `any`, 0 logic change); js 67 → 66 — **`lib/api` is 100% TypeScript, Sprint 4 converted**. `PendingRequest` + the module helpers kept as top-level bindings so `execute.test.js`'s `rewire(…).__get__("PendingRequest")` still resolves; the `export =` barrel imported via `import apiControllers = require("./controllers")` + destructuring (a named ES import cannot target `export =`). Typing `this.controllers` as `Map<string, NativeController>` **cascaded** into `serverController._buildApiDefinition` (`_actions` is a `Set`, not `string[]`) and `realtimeController.validate` — both fixed type-only. **[TD-18](type-debt-register.md) closed** (`internal.allowAllOrigins` modelled); `HttpConfiguration.accessControlAllowOrigin` widened to `string | string[] | RegExp[]` to match what `config/index.ts` actually produces. **[TD-21](type-debt-register.md) opened**: `_wrapError` passes the *request* to `isNativeController(name)`, so the guard is always false and every non-`KuzzleError` is wrapped as a plugin error — a latent bug the conversion **preserved** (two specs assert it). → [05](steps/05-sprint-4-api.md)

- **2026-09-09** — **Sprint 4 closed** (#2686 merged): `lib/api` is 100% TypeScript; js baseline 111 → 66 since the ADR opened. → [05](steps/05-sprint-4-api.md)
- **2026-09-09** — **Mid-course review of the 30 converted files** → open [step 06](steps/06-hardening-mid-course.md) and **harden the enforcement before `lib/core`**. Governing rule: *a review finding ends as a ratchet, an adopted-list entry or a GitHub issue — never as prose alone.* → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — Add a **4th ratchet on implicit `any`** (`TS7xxx` under `noImplicitAny`, baseline 520) and widen the written-`any` ratchet to `as unknown as` (200 → 208, a broadened metric and not a regression). Rationale: the written-`any` ratchet charges nothing for an un-annotated parameter, so it cannot tell a conversion from a rename. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Strict adoption becomes part of a conversion PR's DoD** when the file is clean (46 → 94 adopted; `--candidates` emptied), enforced by a `pr-preflight` reminder. Fixed `strict-check.sh`, whose unanchored path match let a bare `index.ts` entry capture every `lib/**/index.ts` error. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **A conversion PR ships a vitest spec for a file that had none.** 30 files were converted with 0 tests written, 6 of them with no spec at all; deferring every spec to sprint 10 leaves conversions unnetted. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Gate-driven, behaviour-preserving refactors are IN scope for a conversion PR** (verbatim extraction + an equivalence note in the step file). A rename re-scores the whole file as new code, so the SonarCloud gate forces them; the previous absolute "structural refactors stay separate" was being broken every sprint in silence. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **Restoring `.ts` coverage (PR F2) gates the start of Sprint 5.** `sonar.coverage.exclusions=**/*.ts` means every conversion removes its file from the coverage gate; converting the 50 files of `lib/core` under a vacuous gate is not acceptable. → [06](steps/06-hardening-mid-course.md)
- **2026-09-09** — **The plugin fixtures under `bin/plugins/available/**` are out of the Definition of Done**: `functional-test-plugin` and `kuzzle-plugin-cluster` are **fixtures**, not product code. "0 `.js` in `bin/`" targets `bin/` proper. → [03](steps/03-sprint-2-bin.md) ⚠️ **Corrected 2026-09-10:** the entry said "the 4 remaining", but only **3** are fixtures — `bin/copy-binaries.js` is build tooling, so the `js` floor is **3**, and that file is still in scope ([#2705](https://github.com/kuzzleio/kuzzle/issues/2705)).

- **2026-09-09** — **Sprint 5 closed** ([#2698](https://github.com/kuzzleio/kuzzle/pull/2698) merged): `lib/core`'s storage, security, realtime, cache and shared layers are 100% TypeScript; js 66 → 50. → [07](steps/07-sprint-5-core-i.md)
- **2026-09-09** — **A file is measured by the runner that owns its spec.** `c8` and vitest's v8 provider instrument different line sets and Sonar unions them, so c8's inflated set (every line of a loaded file, comments included) made a vitest-tested file unable to clear the 80% gate. `.ci/scripts/prepare-coverage.ts` drops non-executable lines from both reports, then hands each file to one runner — never one vitest measures worse. → [07](steps/07-sprint-5-core-i.md)
- **2026-09-09** — **The type-debt register is burned down as a parallel track**, not inside the sprints: small single-purpose PRs, one finding each. Opened [step 08](steps/08-type-debt-backlog.md); TD-21, TD-22, TD-23 (partial) and TD-26 closed the same day. → [08](steps/08-type-debt-backlog.md)
- **2026-09-09** — **`sonar.cpd.exclusions` shrinks for the first time**: `documentController.ts` deduped (`_mFetch` / `_writeDocument`, verbatim extraction + equivalence note) and removed from the list. 4 entries left, of which 3 are declared irreducible. → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **Post-sprint review of the five merged PRs**: direction confirmed, five follow-ups filed ([#2703](https://github.com/kuzzleio/kuzzle/issues/2703)–[#2707](https://github.com/kuzzleio/kuzzle/issues/2707)). Two rules come out of it: **a guard belongs at the error's source, not on a shared funnel** (TD-21 changed plugin-pipe behaviour it never meant to touch), and **an error reaching a client must keep a documented `id`/`code`** — letting one through unwrapped hands it to `setError`, which builds an `InternalError` with neither. → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **`bin/copy-binaries.js` is converted, not exempted**, and run through `tsx` from the source tree (`npx tsx ./bin/copy-binaries.ts`) rather than as compiled output from `dist/` — the script's own `__dirname` is what resolves the repository root, and `tsx` is already how the repo runs `.ci/scripts/prepare-coverage.ts`. `bin/` reaches its floor of 3 fixtures. → [08](steps/08-type-debt-backlog.md)
- **2026-09-10** — **Closing an issue is part of `wrapup`, not of merging**: GitHub resolves `Closes #NNN` only on the default branch (`master`), so PRs merged into `2-dev` leave their issues open. → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **An exclusion list is a ratchet or it is debt.** `sonar.cpd.exclusions` gains a **fifth ratchet** (`cpd-exclusions`, baseline `.migration/cpd-exclusions.txt`). It is the first one that compares a **set** rather than a count: a count would let a PR swap an entry out for a new one, which is exactly the move the rule forbids. The rule itself had been written in `sonar-project.properties` since step 06 and enforced nothing — the ADR's own governing rule is that a finding ends as a ratchet, an adopted-list entry or an issue, **never as prose alone**. → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A readiness probe must exercise the thing the caller depends on.** `bin/wait-kuzzle` resolved on the SDK's `connected` event — proof the transport listens, not that the cluster has quorum. It now sends a real request and treats any answer other than `api.process.not_enough_nodes` as ready: `funnel.throttle()` is the single gate every request passes, so with `minimumNodes=3` a node that answers *is* a node in quorum — no credentials and no `cluster:status` call needed. → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **The SDK's auto-reconnect cannot be used as a first-connection retry.** `WebSocketProtocol.onclose` forwards to `clientNetworkError()` — the only thing that schedules a retry — solely `if (this.wasConnected)`. A socket accepted then closed before the first successful connection (a published Docker port whose container is still booting) matches no branch: `connect()` neither resolves nor rejects, and nothing retries. Any readiness probe built on the SDK must own its retry loop. → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **A `@deprecated` tag that names a replacement must be checked against the replacement.** Both of TD-20's deprecations point at APIs that cannot do the job — `response.configure()` takes no result, and `getArray` rejects the comma-separated strings `getArrayLegacy` accepts — so for two sprints the tags have produced `NOSONAR` markers instead of migrations. → [08](steps/08-type-debt-backlog.md)
- **2026-09-11** — **Plan a sprint on the normalised coverage report, never on raw `c8`.** `prepare-coverage.ts` drops blank and comment-only lines in *both* directions, so normalisation is not a free uplift (repo-wide 84.4% → 80.2%). On sprint 6's 34 candidates it moves three files across the 80% threshold — planning off the raw report would have shipped them as gate-safe conversions. → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A boolean validator every caller follows with a property read is an undeclared type guard.** `BaseType.checkAllowedProperties` and `safeObject.isPlainObject` both proved their argument was a plain object and then returned `boolean`, so each caller had to cast to use what had just been proven. Declaring the predicate (`o is Record<string, unknown>`) removed every cast in H1 at no runtime cost. → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A `hasOwnProperty` in validation code is load-bearing.** Rewriting it as a truthiness test reads better and is what TS narrows on, but the two differ exactly on the malformed specifications those methods exist to reject: four Mocha specs pin `{ range: undefined }` and `{ range: { min: undefined } }` as throwing. Use `has()` for presence, and `!== undefined` only where TS genuinely needs the narrowing. → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **A per-type options shape needs a generic base class, not one wide interface.** `range` means `{ min?: number }` to `numeric` and `{ min?: Moment | "NOW" }` to `date`; a union makes every comparison a type error. `BaseType<TOptions>` carries the shape, and method parameter bivariance keeps every subclass assignable to the bare `BaseType` the type registry stores. → [09](steps/09-sprint-6-core-ii.md)
- **2026-09-11** — **Sprint 6 opened** ([step 09](steps/09-sprint-6-core-ii.md)): 34 files, 8 195 LOC, six PRs — three conversions on the 26 gate-safe files (aggregate 94.3%) and three spec-efforts-then-rename on `validation.js`, `plugin`+`pluginsManager` and `entryPoint`+`httpwsProtocol`. → [09](steps/09-sprint-6-core-ii.md)

---

## Open points

- **Validate this ADR** with the core team (status Proposed → Accepted).
- ~~**vitest spec location**~~ — **settled (2026-09-09, step 06 PR F3):** `tests/` mirrors the source tree, discovery `tests/**/*.{test,spec}.ts`, recorded in `CONTRIBUTING.md` › *Where unit tests live*.
- **Strict flag order** — revisit (per-flag vs per-file) based on the pain actually observed.
- **Own `JSONObject` server-side** (`lib/types/JSONObject.ts`) and codemod the ~44 `from "kuzzle-sdk"` type imports; remove the 2 local storage redefinitions — during the `lib/types` sprint. (Register: TD-09 / TD-10.)
- **Closure** — remove `allowJs`, Mocha and the legacy config once the counters reach zero (a closing ADR if warranted).

---

## References

- **Companion:** [type-debt register](type-debt-register.md) — detailed, tracked findings of the 2026-07-12 audit (the ADR sets the strategy; the register tracks the execution).
- **Steps:** [`steps/`](steps/) — one file per milestone; `00` archives the rejected alternatives, `01`–`07` cover the sprints delivered, `08` is the parallel type-debt track (open).
- **Process tooling:** the `kuzzle-adr` skill (this hub + steps structure) and the `wrapup` skill (keeps this document live).
- ADRs live under `docs/adr-<n>/` — distinct from `doc/` (reserved for the Kuzzle documentation tool).
