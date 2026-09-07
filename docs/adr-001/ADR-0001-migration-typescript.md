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

- [ ] `0` `.js` files in `lib/` and `bin/` (excluding generated files).
- [ ] `strict: true` in the main `tsconfig.json`; `allowJs` removed.
- [ ] `0` Mocha specs; vitest + TS the only unit runner; `mocha`/`should`/`rewire`/`c8` removed.
- [ ] Cucumber functional tests unchanged (already TS).

Why this over big-bang, pure-opportunistic, full-strict-now or coupled-tests: [step 00](steps/00-rejected-alternatives.md).

### Consequences

**Easier:** safe refactors (the compiler catches contract breaks) on today's untyped code; one language and one unit runner in the end; autocompletion/DX across the whole core.
**Harder / costlier:** durable CI discipline (three count ratchets + a strict scope to maintain); temporary coexistence of two runners and of strict/non-strict `.ts`; the big files (`httpwsProtocol`, `node`, `pluginsManager`) need special care and stronger review.

---

## Target architecture

Stable reference for *how* the migration is enforced and sequenced. How it was built: [step 01](steps/01-sprint-0-tooling.md).

### Enforcement — three count ratchets + progressive strict

- **Count ratchets** (`scripts/ratchet.sh <js|mocha|any>`, `npm run ratchet`): the counts of `.js` files, Mocha specs and explicit `any` may **only decrease**; a reduction updates its baseline in `.migration/` in the same PR.
- **Progressive strict** (`tsconfig.strict.json` + `scripts/strict-check.sh`, `npm run test:strict`): strict is enforced on the growing file list `.migration/strict-adopted.txt` by **filtering tsc output** — *not* via `include`, since tsc pulls the entire import graph into the program. The list grows to cover all of `lib/`, then `strict: true` flips globally and this machinery is removed.
- The **`no-explicit-any`** ratchet exists because explicit `any` is **invisible** to `strict` (see step 01).

### Conversion standards (per file)

- Rename `.js` → `.ts`; fix imports/exports (`export`/`import`, or `export =` for a single export, per the existing CommonJS shape).
- **Forbidden in a conversion:** unjustified implicit `any`, `@ts-ignore`/`@ts-nocheck` without a comment + ticket, `!` (non-null assertion) to "make it pass". Prefer real typing or `unknown` + narrowing.
- Reuse and enrich `lib/types`; do not duplicate.
- One PR = one layer (or a coherent subset), small and reviewable, that **decrements the JS baseline**. No behaviour change in a conversion PR (structural refactors stay separate).

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

**Where we are (2026-09-07):** the foundation is in place (ADR, register, 3 CI ratchets, progressive strict, ESLint). **Sprint 1 done** (`lib/util` 100% TS) and **Sprint 3 done** (`lib/model` + `lib/service` 100% TS, PR #2676), both merged into `2-dev`. **Sprint 4 in progress:** PR A (6 clean `lib/api` controllers + `rateLimiter`, [#2679](https://github.com/kuzzleio/kuzzle/pull/2679)), PR B (`documentController`, [#2680](https://github.com/kuzzleio/kuzzle/pull/2680)) PR C (`memoryStorageController`, [#2681](https://github.com/kuzzleio/kuzzle/pull/2681)) and PR D (`serverController` + `documentExtractor`, [#2682](https://github.com/kuzzleio/kuzzle/pull/2682)) are all **merged into `2-dev`** (A/B 2026-07-17, C/D 2026-07-21); js 79→69. **PR E1** (`httpRoutes` + `controllers/index` barrel + removal of the `new XController.default()` workaround, branch `chore/ts-migration-sprint4-api-routes`) is **open** — js 69→67. Remaining in `lib/api`: **`funnel.js` only** (PR E2). The migration advances one layer-PR at a time off `2-dev`.

**Counters** (baselines in `.migration/`, incl. PR E1): **js = 67**, **mocha = 151**, **any = 200**; **strict adopted = 46**.
**Remaining JS by layer** (67 = 63 `lib/` + 4 `bin/`): `core` 50 · `api` 1 · `kuzzle` 6 · `cluster` 6 · `bin` 4.

**Doc location (2026-07-15):** the ADR and its register moved from `adrs/` to `docs/adr-001/` (`git mv`, history preserved; references updated). ADRs now live under `docs/adr-<n>/`.

**Next actions:**

1. **Sprint 4 — `lib/api` (in progress, [step 05](steps/05-sprint-4-api.md)):** PR A ([#2679](https://github.com/kuzzleio/kuzzle/pull/2679)), PR B ([#2680](https://github.com/kuzzleio/kuzzle/pull/2680), `documentController`), PR C ([#2681](https://github.com/kuzzleio/kuzzle/pull/2681), `memoryStorageController`) and PR D ([#2682](https://github.com/kuzzleio/kuzzle/pull/2682), `serverController` + `documentExtractor`) **merged** — js 79→69. **Open:** PR E1 = `httpRoutes` + `controllers/index` barrel (`chore/ts-migration-sprint4-api-routes`) — `export =` throughout; `adminController`/`authController`/`securityController` switched off `export default`, which removes the `new XController.default()` workaround in `funnel.js` and 10 spec call sites; js 69→67. **Next:** PR E2 = `funnel.js`, the last JS file in `lib/api` (its spec drives `rewire(...).__get__("PendingRequest")`). *(Sprint 2 — real `bin/` entrypoints — stays deprioritized, see [step 03](steps/03-sprint-2-bin.md).)*
2. Then Sprints 5→7 (`lib/core`, `lib/cluster` — the hard files, under cucumber), Sprint 8 (`lib/kuzzle`), then 9 (final strict) & 10 (Mocha → vitest).
3. Per PR: convert one layer, keep `npx tsc --noEmit` green, `npm run ratchet` (js must drop, any must not rise), decrement `.migration/js-baseline.txt`, run the impacted unit tests **in Docker** (`.ci/scripts/docker-test.sh unit mocha` — native `re2` binding can't load on host arm64).

> **Conversion gotchas (learned Sprint 1):** a file whose Mocha spec uses `rewire`/`__set__` on a required module (e.g. `didYouMean`) must keep the compiled variable name — use `import x = require("mod")`, not `import x from "mod"`. Typing a previously-`any` export (e.g. `Promback`) can break inferring consumers: make it **generic** (`Promback<T>`) and annotate the call sites rather than reintroducing `any`.

**Key commands:**

```bash
npm run ratchet                     # js / mocha / any (must not increase)
npm run test:strict                 # strict on adopted files
npm run test:strict -- --candidates # clean files not yet adopted
npm run ratchet:js -- --update      # after a reduction: update the baseline
npx tsc --noEmit                    # full type-check; npm run build = tsc + copy-binaries
```

**Conversion convention:** `export =` for a single export, named exports for an object module; never `any` / `@ts-ignore` / `!` to "make it pass"; reuse `lib/types`. Full standards in *Target architecture › Conversion standards*.

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
| 05 | Sprint 4 — `lib/api` (controllers, `funnel`) | 🟦 In progress | #2679 A✅ · #2680 B✅ · #2681 C✅ · #2682 D✅ · E1 | [detail](steps/05-sprint-4-api.md) |
| 06 | Sprint 5 — core I (storage, security, realtime) | ⬜ To do | — | — |
| 07 | Sprint 6 — core II (validation, plugin, network) | ⬜ To do | — | — |
| 08 | Sprint 7 — `lib/cluster` | ⬜ To do | — | — |
| 09 | Sprint 8 — `lib/kuzzle`, `index` | ⬜ To do | — | — |
| 10 | Sprint 9 — final strict flip, remove `allowJs` | ⬜ To do | — | — |
| 11 | Sprint 10 — test closure (Mocha → vitest) | ⬜ To do | — | — |

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
- **2026-09-07** — **PR E1** (`chore/ts-migration-sprint4-api-routes`): `httpRoutes` + `controllers/index` → TS (`export =`, no new `any`, 0 logic change); js 69 → 67, `lib/api` down to `funnel.js` alone. **Standardized every native controller on `export =`**: `adminController`, `authController` and `securityController` were still `export default class`, whose `__esModule` + `exports.default` shape forced the `new XController.default()` workaround in `funnel.js` and in 10 spec call sites — all removed. `httpRoutes` gets a module-local `KuzzleHttpRoute` interface (`url?` because the trailing loop derives it from `path`). `default.config.ts` had to drop the `.js` extension from its import: node10 module resolution does **not** substitute `.ts` for a `.js` specifier. `HttpConfiguration.routes` deliberately left `any` — typing it cascades into already-converted files. → [05](steps/05-sprint-4-api.md)

---

## Open points

- **Validate this ADR** with the core team (status Proposed → Accepted).
- **vitest spec location** — `tests/` mirror vs co-location `lib/**/*.spec.ts` — decide and record in `CONTRIBUTING.md`.
- **Strict flag order** — revisit (per-flag vs per-file) based on the pain actually observed.
- **Own `JSONObject` server-side** (`lib/types/JSONObject.ts`) and codemod the ~44 `from "kuzzle-sdk"` type imports; remove the 2 local storage redefinitions — during the `lib/types` sprint. (Register: TD-09 / TD-10.)
- **Closure** — remove `allowJs`, Mocha and the legacy config once the counters reach zero (a closing ADR if warranted).

---

## References

- **Companion:** [type-debt register](type-debt-register.md) — detailed, tracked findings of the 2026-07-12 audit (the ADR sets the strategy; the register tracks the execution).
- **Steps:** [`steps/`](steps/) — one file per milestone; `00` archives the rejected alternatives, `01`–`05` cover the sprints delivered/under way.
- **Process tooling:** the `kuzzle-adr` skill (this hub + steps structure) and the `wrapup` skill (keeps this document live).
- ADRs live under `docs/adr-<n>/` — distinct from `doc/` (reserved for the Kuzzle documentation tool).
