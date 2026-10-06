---
name: kuzzle-adr
description: Structure, split and maintain Architecture Decision Records (ADR) in the kuzzle repo — a hub file (decision + cold-start + step table + central decision register) plus one file per milestone/step under docs/adr-<n>/steps/, frozen once shipped. Use when creating a new ADR, splitting or shrinking a large ADR, opening/closing a step, or when wrapup must update an ADR's structure. Reference implementation: docs/adr-003/.
---

# Kuzzle — ADR structure

An ADR in this repo is **not** a frozen one-shot decision record: it is a **living document** that tracks an effort end to end. Left unstructured it fuses three documents of different natures and bloats every session. This skill keeps them separated.

**Reference implementation:** [`docs/adr-003/`](../../../docs/adr-003/ADR-0003-storage-drivers.md). Match its shape. ADR-0001 is the historical first one, frozen: it shows the structure at scale, not the size to aim for.

## The three natures to separate

| Nature | Volume | Life | Where |
| --- | --- | --- | --- |
| **Architecture decision** (context / decision / consequences) | short | stable | **hub** |
| **Cold-start** (current state, next action) | tiny | living | **hub** |
| **Execution trace** (what was done, local decisions, gotchas, PRs) | large, grows every session | living while the step is open, **frozen** after | **one file per step** |

**Golden rule:** the *living surface* = the hub + the open step file(s). Everything else is archive. A cold-start or a `wrapup` only re-reads those two.

## Layout & naming

```
docs/adr-<n>/
  ADR-000X-<slug>.md           ← the HUB (the only file read in full)
  <companion>.md               ← companion docs / assets (relative links)
  steps/
    00-<slug>.md               ← one step = one file
    01-<slug>.md
    ...
```

- **Location**: ADRs live under `docs/adr-<n>/` — distinct from `doc/` (reserved for the Kuzzle documentation tool). The folder is zero-padded (`docs/adr-001/`); the hub file keeps the historical `ADR-000X-<slug>.md` name.
- **ADR number**: by order of *record* creation, never renumbered (never break #PR / memory / commit refs). A decision may carry a higher number than one it chronologically precedes — note it in the hub when so.
- **Step files**: two-digit numeric prefix (`00-`, `01-`, …) = reading order; short kebab-case slug. Any domain numbering (a sprint number, a phase) lives in the **slug**, never in the prefix. `00-` typically archives a rejected approach (the ADR's "rejected alternatives").
- **Assets / companions**: descriptive name (not prefixed by `ADR-000X`), always referenced by **relative link** from the file that renders them.

## The HUB — `ADR-000X-<slug>.md`

In order:

1. **Title + meta**: `# ADR-000X: <title>`, then `**Status:**`, `**Date:**`, `**Deciders:**`, `**Related documents:**`.
2. **Decision**: Context → Decision → Consequences. Short. This is the actual ADR.
3. **Target architecture** *(optional)*: schema + stable reference description (not a journal).
4. **Cold start**: current state in a few bullets + an explicit **next action**.
5. **Step table** — the spine. One row per step with a link to its file:

   | # | Step | Status | PR(s) | Detail |
   | --- | --- | --- | --- | --- |
   | 01 | … | ✅ Done | #NNN | [detail](steps/01-….md) |

6. **Decision register**: **dated** list, one line per decision — the canonical "what we decided" view. Each line may link to the step file that details it.
7. **Open points** + **References**.

Alongside the hub, an ADR that runs long enough to accumulate review findings keeps a **lessons index** (`lessons.md`):
one row per *generalisable part*, with its source finding and **what enforces it** — a gate, a line in the standards a
contributor reads, or nothing. The last column is the point: a lesson that stays prose gets broken again, so the
un-enforced rows are read as the backlog of what to gate next. Each ADR keeps its own; `docs/adr-001/lessons.md` is the
example, frozen with its ADR (its "What to gate next" list is carried by [#2968](https://github.com/kuzzleio/kuzzle/issues/2968)).

The hub **never** holds a step's detailed narrative nor a session-by-session journal — that lives in the step files.

### Structured extract — `docs/adr-state.json`

The hub is the narrative source of truth, but it is expensive to read. Each ADR's **current** state is mirrored in [`docs/adr-state.json`](../../../docs/adr-state.json), which feeds the digest injected at every session start (`SessionStart` hook → `node .ci/scripts/adr-state.ts --digest`, ~200 tokens). Update it in the same pass as the hub: a stale entry silently misleads every future session. It holds **state, never history**; `node .ci/scripts/adr-state.ts --check` (CI job `adr-state`) enforces:

| Field | Content | Limit |
| --- | --- | --- |
| `snapshot`, `latestVersion` | date of the last state change; npm `latest` | — |
| `adrs[].id`, `hub`, `title` | number, hub path, the hub's title | `title` ≤ 80 |
| `adrs[].status` | `proposed` · `accepted` · `active` (a step is open) · `closed` · `abandoned`; closed/abandoned must match the hub's `**Status:**` | enum |
| `adrs[].statusLabel` | emoji + short label | ≤ 40 |
| `adrs[].openStep` | path of **the** open step, or `null`; its `**Status:**` must be open (⬜/🟦); required when `active` | — |
| `adrs[].nextAction` | **one** imperative action, or `null` — never what was just done | ≤ 300, one line |
| `adrs[].blockers[]` | a gate and what lifts it | ≤ 4 × 200 |
| `adrs[].openPoints[]` | the open points that matter; **no ✅ / struck-through entry**: what is done is told in the hub or the step, then removed here | ≤ 6 × 200 |

Whole file ≤ 8 KB, digest ≤ 2 500 chars. If something does not fit, it belongs in the hub, not in abbreviations. **Public repository:** private projects (client comparisons, private plugins) never go in this file.

## Budgets — what keeps this structure from regrowing

ADR-0001's hub was compacted on 2026-09-18 and was back at 116 KB nine days later: every pass appended a dated report and nothing bounded it. Now [`docs/doc-budgets.json`](../../../docs/doc-budgets.json) does, checked by `node .ci/scripts/check-doc-budgets.ts` on every PR (job `doc-budgets`, blocking), by `pr-preflight`, and by a non-blocking `PostToolUse` hook (`.claude/settings.json`) right after an edit. Roles: `living` (re-read at every resume → bounded), `archive` (write-once → exempt, but flagged when it grows in a PR), `exempt` (generated, legal, or the product docs under `doc/`).

| File | Budget | When it overflows |
| --- | --- | --- |
| hub `ADR-000X-*.md` | 40 KB | move step narrative to its file; evict a journal already written **verbatim** to `journal.md` with a pointer |
| **open** step (`⬜`/`🟦`) | 60 KB | **sub-split** (below) |
| other ADR annexes (`docs/adr-<n>/*.md`) | 40 KB | evict what is settled to `journal.md` or the frozen step that produced it |
| closed step (`✅`/`🧊`/`🚫`), `journal*.md`, **every file of a Closed/Abandoned ADR** | exempt (archive) | never reopened, never fed |

A budget is raised only by a reasoned edit of `doc-budgets.json` (say why in the commit), never to let a journal through. Do not compress into abbreviations either: if it does not fit, it belongs somewhere else.

**Sub-split rule.** When an open step nears 60 KB, keep `steps/NN-<slug>.md` as the step's chapeau (goal, status, a table of its parts with links, local decisions) and move each part's narrative to `steps/NN-<slug>/<part>.md`, each with its own `**Status:**` line. A part that is done is frozen like any step and stops counting.

The `**Status:**` line of a step file (first lines) is **machine-read**: its first emoji decides open (`⬜`, `🟦` → bounded) or closed (`✅`, `🧊`, `🚫` → archive). Keep the emoji first; put the detail after it.

## A STEP file — `steps/NN-<slug>.md`

Granularity: **one milestone/step = one file**, grouping its sub-tasks. Sub-split (one file per sub-step) **only** when a step gets heavy (e.g. several parts with a prod migration).

Content: **Title + status + dates + PR(s)** (+ back-link to the hub) · **Goal** · **What was done** · **Local decisions / gotchas** (the one-line version bubbles up to the hub register) · **Validation**.

## Step lifecycle

1. **Open**: create `steps/NN-<slug>.md` when the step **starts**; add its row to the hub table (`⬜ To do` / `🟦 In progress`).
2. **During**: only the step file and the hub's cold-start move.
3. **Close** (done / in prod): **freeze** the step file (archive — do not reopen). Update only its hub-table row (✅ + PR), the cold-start, and the hub register if a structural decision came out.

## Closing an ADR

When the last step closes, **freeze the whole ADR**: hub status `Closed`, every step ✅/🧊/🚫, a cold start that says there is nothing to resume. A step must not outlive its ADR as a "parallel track": what is still open goes to a GitHub issue (with the corrections the frozen files would need), and the step closes with a pointer to it. Rewrite the cold start, the register and the open points to their final, short form, and evict the long versions **verbatim** to the ADR's `journal.md` (write-once archive; only heading levels change). Reference: ADR-0001, frozen 2026-10-06, with remainder in [#2968](https://github.com/kuzzleio/kuzzle/issues/2968).

## Normalized statuses

- **ADR (hub)**: `Proposed` · `Accepted` · `Accepted — implemented` · `Closed` · `Abandoned`.
- **Step (table row)**: `⬜ To do` · `🟦 In progress` · `✅ Done` · `🧊 Frozen/Archive` · `🚫 Abandoned`.

## When applying to an existing large ADR

Keep the decision + cold-start + register in the hub; move each milestone's narrative into a `steps/NN-*.md`; freeze the closed ones; normalize the multiple overlapping decompositions (phases / sprints / steps) into **one** step spine in the hub table. Do it with `git mv` / edits that preserve history; keep historical "touched files" paths and dated journal entries as-is (do not rewrite past logs). Repoint any inbound reference that cited a now-dissolved section (e.g. a `§6.2`) to the step file or stable hub section that replaced it.

## Language

Prose in **English** — the repo is English-only (source code, comments, docs including ADRs, commit messages and pull requests; see `CONTRIBUTING.md`). This skill file, like the repo's other skills, is in English too.
