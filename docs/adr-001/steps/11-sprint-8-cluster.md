# Step 11 — Sprint 8: `lib/cluster`, the last conversion sprint

**Status:** 🟦 Open · **Opened:** 2026-09-16 · **PR(s):** — · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the six remaining `.js` files under `lib/` — all of them in `lib/cluster` — taking the `js` ratchet from **11 to 5** (the 5 `bin/` entries are the floor, see [step 03](03-sprint-2-bin.md)). After this sprint no production JavaScript is left to convert, and [step 12](../ADR-0001-migration-typescript.md#step-table) can flip `strict` and drop `allowJs`.

Two things make this sprint different from the seven before it:

1. **It is the last chance to apply the strict-count DoD** ([TD-54](../type-debt-register.md#td-54), decided 2026-09-16). Sprints 6 and 7 left 246 strict errors across their six largest files and nobody was asked for the number. `pr-preflight.sh` now asks.
2. **[TD-33](../type-debt-register.md#td-33)'s cause lives in this layer.** The files that decide membership are exactly the ones the compiler has never read, and the last two sprints each surfaced a real defect by typing one (`maxFormFileSize` never assigned; a `Promise` the declaration said was not one).

## Scope, measured 2026-09-16

`lib/cluster` is **2 843 lines of JavaScript across 6 files**, plus 882 lines already in TypeScript. Coverage is SonarQube's `(covered lines + covered conditions) / (lines + conditions)`, recomputed on `2-dev` after [TD-50](../type-debt-register.md#td-50)'s merge fix — **not** the line-only figures this ADR quoted before 2026-09-15.

| File | Lines | Coverage | Gate (≥ 80%) |
|---|---:|---:|---|
| `index.js` | 24 | 100.0% | ✅ |
| `node.js` | 1 212 | 98.9% | ✅ |
| `subscriber.js` | 793 | 98.5% | ✅ |
| `publisher.js` | 386 | 98.5% | ✅ |
| `workers/IDCardRenewer.js` | 144 | 73.1% | ❌ spec effort |
| `command.js` | 284 | 41.5% | ❌ spec effort |
| **total JS** | **2 843** | **—** | |
| `state.ts` (already TS) | 468 | 99.6% | ✅ |
| `idCardHandler.ts` (already TS) | 414 | 92.2% | ✅ |
| **aggregate `lib/cluster`** | | **93.0%** | |

> ⚠️ The hub previously carried **6 files, 1 544 lines, 88.9%**, and `command.js` at **16.9%**. All three were wrong at the time of writing or have since moved — `command.js` is at 41.5%. Re-measure before planning; the command is in *Key commands* below.

Strict, over the two files already converted: `idCardHandler.ts` **7** errors, `state.ts` **4**. Neither is in `.migration/strict-adopted.txt`.

## Slices

Conversions and spec efforts stay in **separate PRs** — that is [step 09](09-sprint-6-core-ii.md)'s lesson, paid for once already.

| # | Content | Lines | Why this grouping |
|---|---|---:|---|
| **J0** | Spec effort: `command.js` (41.5%) and `workers/IDCardRenewer.js` (73.1%) | 428 | Both are under the 80% gate, so converting them first fails CI on a coverage number that has nothing to do with the conversion. Specs first, in JS against the current files, then J3 converts them with the gate already green. |
| **J1** | `index.js` + `publisher.js` | 410 | The two leaves. `index.js` is 24 lines; `publisher.js` is the layer's write side and is gate-safe. |
| **J2** | `subscriber.js` | 793 | Holds [TD-58](../type-debt-register.md#td-58)'s fixed counter. The read side of the same protocol as J1 — convert it next while the shapes are fresh. |
| **J3** | `node.js` + the two files J0 covered | 1 640 | `node.js` is the membership logic and the largest file in the sprint. |
| **J4** | Adoption sweep: `state.ts`, `idCardHandler.ts` and whatever J1–J3 left, into `strict-adopted.txt` | — | 11 known errors on the two existing TS files, plus 4 of [TD-62](../type-debt-register.md#td-62)'s `null` declarations in `idCardHandler.ts`. |

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this sprint adds:

- **Report the strict count.** `bash scripts/strict-check.sh --count <converted files>`; either adopt them, or state per file how many errors remain **and which are guards the runtime can reach**. Those are a bug list, not a typing chore. `pr-preflight.sh` prints the numbers and will warn if the PR converts a file it does not adopt.
- **Anything the compiler flags about membership is a TD, not a cast.** This layer is where [TD-33](../type-debt-register.md#td-33) lives; a diagnostic here is evidence, and the two previous sprints show what silencing one costs.
- Run the impacted specs **in Docker** (`.ci/scripts/docker-test.sh unit mocha` / `unit vitest`) — the native `re2` binding cannot load on host arm64.

## Risks

- **TD-33 will interleave with this sprint's own CI** — it already has, on this step's own PR ([#2767](https://github.com/kuzzleio/kuzzle/pull/2767), a docs-only change, four ES 8 jobs down). Two attributable occurrences now exist, and together they say: *one node's publisher drops exactly **one** message at formation, right after the handshakes complete, and every node that reads it self-evicts.* **Look at `publisher.js`, not at the membership logic** — and not at one node's configuration either: the seventh occurrence's culprit was `kuzzle_node_prod`, the eighth's was `kuzzle_node_2`, with `prod` among its victims. Two further leads from the eighth: it was **4-for-4 on ES 8 while every ES 7 variant passed**, and a node that has already self-evicted goes on to print *"Kuzzle is ready"* 2.5 s later — so `Node.init()`'s wait is satisfied by a node that has left the cluster. Both diagnostics that made any of this readable — [TD-58](../type-debt-register.md#td-58)'s counter and [TD-59](../type-debt-register.md#td-59)'s single node id — landed before this sprint opened, on purpose.
- **`node.js` at 1 212 lines will re-score as new code** in SonarCloud, so pre-existing S3776/S2004 smells in it become blocking. Gate-driven refactors are in scope under the usual two conditions (verbatim extraction + an equivalence note), and note what [step 09](09-sprint-6-core-ii.md) learned: lifting a function out *whole* **moves** its cognitive complexity rather than reducing it.
- **`command.js` is the process-boundary file.** Its 41.5% is not an oversight — it forks workers — so J0 should establish what is worth asserting before assuming the number can reach 80%. If it cannot, the honest move is `.migration/coverage-exempt.txt` with the reason on the line, which is what that file is for ([TD-42](../type-debt-register.md#td-42)).

## Key commands

```bash
# Re-measure coverage the way the gate does (line + branch, merged):
docker compose -f docker-compose.yml run --rm --no-deps node \
  bash -lc "npm run test:unit:mocha:coverage"
# then read coverage/mocha/lcov.info — (LH+BRH)/(LF+BRF) per file.

bash scripts/strict-check.sh --count lib/cluster/node.ts   # the number the DoD wants
bash scripts/strict-check.sh --count                       # every unadopted file, ranked
npm run ratchet                                            # js must drop; no counter may rise
```
