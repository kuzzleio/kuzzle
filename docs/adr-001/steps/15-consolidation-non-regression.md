# Step 15 — consolidation: non-regression, breaking-change audit, then beta

**Status:** 🟦 In progress — opened 2026-09-25; phases A, B, C and the fixes done; beta next · **PR(s):** phase C measurement [#2901](https://github.com/kuzzleio/kuzzle/pull/2901) (draft, not for merge) · **Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Prove, before anything ships, that the migrated server **behaves exactly as the last release did**, and that every difference is known, intended and documented.

The Definition of Done closed on 2026-09-24 with every box ticked, but it is a statement about the **code** (TypeScript, one runner, `strict`), not about what a user observes. Between `v2.56.0` (2026-06-23, the last release) and `2-dev` there are **472 non-merge commits** (127 `fix`, 17 `feat`, 27 `refactor`) touching **288 files** of the shipped surface (`lib/`, `bin/`, `index.ts`, `package.json`, the sample config), +21 043 / −13 633 lines. The migration rule was _no behaviour change in a conversion_, and each PR stated why it was not breaking — but that is 150-odd separate claims, each checked against its own diff, and nobody has checked their sum.

## Decisions taken when announcing the step (2026-09-25)

- **Baseline: `v2.56.0`.** Every comparison below is `v2.56.0` against the `2-dev` head the step freezes on.
- **"Breaking" means runtime _and_ typings.** The HTTP / WebSocket / MQTT API, the `Backend` and plugin SDK, the configuration, the CLI, the error codes, the published package's contents **and the `.d.ts` exported from `index.ts`**. A TypeScript application or plugin that compiled against `v2.56.0` and no longer compiles counts as broken — the `strict` flip rewrote many public types, which is where the risk is highest.
- **The beta waits for the analysis.** Finish the open follow-ups, then this step, then the beta — not in parallel.
- **The beta does not become a release until the step is at 100%**: every finding resolved (fixed, or accepted and documented), and the comparison against `v2.56.0` in real projects done.

## Plan

### Phase A — inventory the observable surface, on both versions

One diff per surface, each producing a list of differences — not a verdict.

| Surface | How it is compared |
| --- | --- |
| Public typings | Build both versions; diff the emitted `.d.ts` reachable from `index.ts`; compile a consumer fixture (a `Backend` application and a plugin using the documented API) against both |
| Published package | `npm pack` both; diff the file list, `package.json` (`main`, `types`, `bin`, `files`, `engines`, dependency ranges) |
| API routes and actions | Diff the HTTP route table and the controller/action list |
| Error codes | Diff the error-code catalogue (`lib/kerror/codes`): ids, codes, statuses, messages — a removed or renumbered code is a breaking change for any client that switches on it |
| Configuration | Diff the defaults and `.kuzzlerc.sample.jsonc`, and **what the config checker now rejects** that `v2.56.0` accepted |
| CLI | Diff the options `bin/start-kuzzle-server` parses and what each does |
| Events and hooks | Diff the event names and payloads plugins can listen to or pipe |

### Phase B — classify every behaviour change the commits made on purpose

Walk the `fix` and `feat` commits since `v2.56.0` and list each change a user could observe. Each gets a class (**intended / accidental**, **breaking / non-breaking**) and a destination (changelog, migration note, fix). Known entries to start from, all already stated in their PRs or the register:

- `Kuzzle.id` is set (it read `undefined` everywhere): the redis client name, the cluster ID card and every realtime notification's `node` go from absent to the node's name (K5, [#2803](https://github.com/kuzzleio/kuzzle/pull/2803)).
- An internal error raised by a native controller is no longer reported as `plugin.runtime.unexpected_error` ([TD-21](../type-debt-register.md#td-21) / [TD-27](../type-debt-register.md#td-27)).
- The six `start-kuzzle-server` options work again ([TD-84](../type-debt-register.md#td-84)).
- An evicted cluster node exits with code 1 instead of 0, and a node that loses a sync message recovers it instead of leaving ([#2896](https://github.com/kuzzleio/kuzzle/pull/2896)).
- Two `invalid_openapi_schema` error codes removed from the catalogue — raised by nothing, but documented ([TD-77](../type-debt-register.md#td-77)); two realtime subscriptions that collided on one channel now get their own ([TD-74](../type-debt-register.md#td-74)); two config checker messages reworded ([TD-79](../type-debt-register.md#td-79)).

⚠️ The commit log is not a reliable trigger for semantic-release's major bump: one commit says `BREAKING-ish:`, which the parser ignores. The version the beta gets must come from this inventory, not from the commit messages.

### Phase C — run the old tests against the new code

The strongest non-regression check available: `v2.56.0`'s **functional suites** (`features/`, `features-legacy/`) run unchanged against a `2-dev` build. A scenario that passed on `v2.56.0` and fails now is a regression, or an intended change Phase B must already list. The unit suites cannot be reused this way — the Mocha specs were coupled to internals the migration rewrote — which is why this phase is functional only.

### Phase D — beta, and the comparison in real projects

Once A–C are resolved: merge `2-dev` into `beta`, which publishes an npm prerelease through semantic-release. Then run the same projects on `v2.56.0` and on the beta side by side, to measure behaviour and performance on real workloads rather than on the suites. The list of projects is to be given when this phase starts.

## Exit criteria

- [x] Every Phase A diff read, and each difference listed in Phase B's inventory.
- [x] Every accidental breaking change fixed on `2-dev` (inventory §1, §2); every intended one documented ([release notes draft](../step-15-release-notes.md)).
- [x] `v2.56.0`'s functional suites pass against `2-dev`, or each failure is an inventoried intended change. _Passed on `0855cd70f` ([#2901](https://github.com/kuzzleio/kuzzle/pull/2901)) and again on `26c6b96a7`, with every fix in ([#2924](https://github.com/kuzzleio/kuzzle/pull/2924)): all 30 functional jobs, the 6 monkey jobs, build-and-run. Re-run it if `lib/` changes before the beta is cut._
- [ ] Beta published, and the side-by-side comparison in real projects done.
- [ ] Nothing left open in the inventory — only then does the beta become a release.

## What was done

### Phases A, B and C — 2026-09-25

Run on two frozen, built trees: `v2.56.0` and `2-dev` at `0855cd70f`. Phase A was split per surface (typings, package, API and events, error codes, config / CLI / cluster / storage), Phase B worked from the 207 commits that touch shipped code, as an independent cross-check. The raw reports are frozen in [`../step-15-audit/`](../step-15-audit/); **the living list is [`../step-15-inventory.md`](../step-15-inventory.md)** — read that, not the reports.

- **Nothing public was removed or renamed** (exports, routes, actions, events, error ids).
- **Phase C passed**: v2.56.0's functional suites and test application, byte for byte, green against `2-dev` on all 30 functional jobs and the 6 monkey jobs ([#2901](https://github.com/kuzzleio/kuzzle/pull/2901)).
- **And it was not enough**: the audit found **11 accidental regressions to fix** (inventory §1), two of them confirmed by hand — F-01 (`not_found` → `unexpected_not_found` on every missing document) and F-02 (`document:export` rejects an array `sort`) — and **the typings break TypeScript consumers** (§2: 11 new errors with `strict: false`, 35 with `strict: true`, on a fixture written from the docs). Five decisions are the maintainer's (§3).

### The fixes — 2026-09-25

Every inventory item in §1 (eleven accidental regressions), §2 (the typings) and §3 (D-3, D-4) is fixed and merged, in 19 PRs: [#2903](https://github.com/kuzzleio/kuzzle/pull/2903)–[#2919](https://github.com/kuzzleio/kuzzle/pull/2919), [#2921](https://github.com/kuzzleio/kuzzle/pull/2921), [#2922](https://github.com/kuzzleio/kuzzle/pull/2922), plus the docs in [#2902](https://github.com/kuzzleio/kuzzle/pull/2902) and [#2920](https://github.com/kuzzleio/kuzzle/pull/2920). Each behaviour fix ships a spec verified to fail without it; F-01 and the dump suffix also got a functional scenario. F-03 and F-04, found by static analysis, were measured before being fixed (1–3 % of cluster joins failed at the default heartbeat; a retransmit slower than ~4 s evicted a healthy peer). D-2 and D-5 are documented, not changed, by the maintainer's decision.

Two things this pass added that outlive it: **the typings gate** (`tests/typings/`, run by `npm run typecheck:typings` in the `build` job) — the check whose absence let step 12 break every TypeScript consumer without a single red job; and **the functional scenarios that pin error ids**, the blind spot phase C exposed.

### What the phases found about the method

- **A green functional suite is not a non-regression proof.** F-01 changes the error id of every missing-document answer, and none of the 30 green jobs noticed: the scenarios assert the status, not the id. _A suite only protects what it asserts_ — Phase C bounds the regressions, it does not exclude them.
- **The fixture that hid F-01 is the same shape as the bug.** The unit specs build ES errors as plain objects, where `body` is an own property that a spread copies; the real client's `ResponseError` has it as a prototype getter. _A fixture that is structurally easier than the real value tests the fixture._
- **"Not breaking" was checked per PR and failed in sum.** 15 PR bodies are contradicted by their own diff (Phase B). Each claim was written against its author's idea of the surface — mostly the runtime API — while the step-12 PRs changed the exported types that external TypeScript consumers compile against, and no PR had such a consumer to compile.
