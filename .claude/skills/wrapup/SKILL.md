---
name: wrapup
description: Finish-and-land ritual for a change in the kuzzle repo — update living docs (README / CONTRIBUTING / the governing ADR) + memory + the associated PR description, run the full local validation (lint, error-codes, migration ratchets & test type-check, unit tests, build), make logical commits, push, WAIT for the real SonarCloud quality gate and iterate until green, and leave the state cold-start-ready for a fresh context. Use when the user says "wrapup", "wrap up", "wrap up the session", "/wrapup", "finalise", "land it", or when a slice/task is functionally done and needs to be documented, validated, committed, pushed and gate-verified. Also before a release PR (2-dev → beta, beta → master): it writes the plain-language changelog page, the upgrade notes and the Towards Kuzzle 3 page (section 5b).
---

# Wrapup

The ritual to *land* a change once it works: leave the docs true, the branch pushed, and the quality gate green — not just the code written. Do the steps in order; do not skip the gate wait.

## 0. Take stock

- `git status` + `git diff --stat` — know exactly what changed and why.
- Identify the working branch and its base (`git branch --show-current`, `git log --oneline <base>..HEAD`) and any open PR (`gh pr list --head <branch>`).
- If a task list exists, reconcile it (mark done / add follow-ups).
- Decide the **logical commits** up front: separate concerns (feature vs fix vs docs vs style/format vs tooling). A repo-wide reformat is always its own commit.

## 1. Update the living docs

- **`README.md` / `CONTRIBUTING.md`** — keep them true to the code when the change touches user-facing behavior, setup, commands, or a contributor rule (a new lint/test gate, a migration constraint, a naming convention…). If nothing user-facing changed, say so and move on.
- **The governing ADR** — if the change belongs to a documented decision record (e.g. `docs/adr-003/ADR-0003-storage-drivers.md`), update it in the SAME pass: the **step table** (statuses / PRs), the **Cold start** block, the **Decision register** if a decision was made, open points closed/opened. The ADR is the source of truth; a change that outruns its ADR is not done. Convert relative dates to absolute. If the change came out of a review finding that carries a *generalisable part*, add its row to the governing ADR's **lessons index** (its `lessons.md`, created on the first such finding; ADR-0001's is frozen) with what enforces it — prose is the default and prose is how a finding recurs. For the ADR's **structure** (hub + per-step files, frozen on close, central decision register), follow the `kuzzle-adr` skill.
- **Where the session's narrative goes** — what was done, proofs of runs, local decisions and gotchas → the **open step file**. A structural decision → **one line** in the hub register. The hub's cold start is **rewritten** to the current state, never appended to. Then `node .ci/scripts/check-doc-budgets.ts` (also run by `pr-preflight` and the `doc-budgets` CI job): if a living file overflows, move the content where the message says — never raise a budget in `docs/doc-budgets.json` to let a journal through.
- **Memory** (`.../memory/`): update the project memory file with what was non-obvious — new gotchas, decisions, current state, next step. Refresh the `MEMORY.md` one-liner if a new fact file was created.
- **The associated PR description** — if the branch has an open PR (`gh pr view <PR>`), keep its body in sync with what actually landed: the overview, the tracking/step table (statuses), and any "delivered in this PR vs later" framing. Edit it with `gh pr edit <PR> --body-file …`. A PR whose description contradicts its commits misleads reviewers. Do this after the push so it reflects the real state.

## 1b. Cold-start readiness (verify a fresh context can resume)

Before considering the wrapup done, sanity-check that a brand-new session with **zero prior context** could pick the work up from the written record alone:

- The ADR's **Cold start** block names the branch, what is done/validated, the next step, and the key gotchas — updated to this session.
- **`docs/adr-state.json`** reflects it, if any ADR state changed (step opened/closed, next action, blocker lifted, release): **replace** the fields, never append; then `node .ci/scripts/adr-state.ts --check` and read `--digest` as a fresh session would (schema: `kuzzle-adr` skill).
- The **memory** file states the current state and the concrete next action (absolute dates, not "today"/"yesterday").
- Anything you only "know" from this conversation (a live-validation result, a deferred decision, a trigger for a deferred item) is written down somewhere durable — not left implicit.

If a fresh reader would be missing something to continue, add it now. This is the difference between "code landed" and "effort resumable".

## 2. Validate BEFORE committing (repo gates — non-negotiable)

Run the checks CI will run, so nothing is stale. After the LAST code/test edit:

1. **Lint + error-codes** — the two gates that most commonly fail a first push. Use the `pr-preflight` skill (`.ci/scripts/pr-preflight.sh`): `npm run test:lint` + the error-codes doc diff. If `lib/kerror/codes/*.json` changed, regenerate with `npm run doc-error-codes` and commit `doc/2/api/errors/error-codes/`.
2. **Migration ratchets & test type-check** (the `migration-ratchets` CI job): `npm run ratchet` (js / any / casts / cpd-exclusions — a count may only decrease) **and** `npm run typecheck:tests` (`tsconfig.tests.json`, which is what the build no longer compiles). If a conversion reduced a count, update its baseline in the SAME PR (`npm run ratchet:<js|any|casts> -- --update`). There is no strict step: `strict` is on in `tsconfig.json` since step 12 (K6), so strict errors in `lib/` fail the build at 4.
3. **Unit tests** — vitest, the only unit runner since ADR-0001 step 13 (Mocha and its apparatus are deleted). Locally via the `docker-tests` skill (`.ci/scripts/docker-test.sh unit`) or `npm run test:unit:vitest`. Run in Docker — the native `re2` binding can't load on host arm64.
4. **Build** — `npm run build` (tsc + copy-binaries) catches type/emit errors, and since step 12 it IS the strict type-check of `lib/` + `index.ts` + `bin/`.
5. Touched the big flows (network, cluster, controllers)? Run the relevant **functional** suite via `docker-tests` (`.ci/scripts/docker-test.sh functional http` / `websocket`).

> **Sonar coverage note (kuzzle-specific):** SonarCloud coverage comes from **vitest** (`npm run test:unit:vitest` → `coverage/vitest/lcov.info`), normalised by `.ci/scripts/prepare-coverage.ts` before the scan. Only `**/*.vue` is coverage-excluded — the blanket `**/*.ts` exclusion this note used to describe was what made every JS→TS conversion leave the gate, and it was removed by TD-24. `coverage/` is gitignored — CI regenerates it, there is nothing to commit.

Never commit if tests fail. If something is skipped, say so.

## 3. Commit & push

- Commit in the logical units decided in step 0. Clear messages; end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Nothing pushed yet and history is messy? Amend/reorder while it is still local — never rewrite pushed history.
- **Safety:** if the working branch is a protected/shared branch (`master`, `2-dev`, a release branch), do NOT push directly — open a PR from a dedicated branch instead, or ask first. Push the feature branch and confirm the ref moved.

## 4. Wait for the REAL Sonar gate (do not stop early)

- The GitHub **`sonarqube` build job** passing ≠ gate passed — the scan action exits 0 on upload. The real verdict is the **SonarCloud analysis check** that SonarCloud posts on the PR (evaluated on SonarCloud, not on the runner). Identify its exact name once with `gh pr checks <PR>`.
- Poll until every check resolves (not just until the build job is green):
  ```sh
  for i in $(seq 1 20); do
    out=$(gh pr checks <PR>); echo "$out" | grep -qi pending || { echo "$out"; break; }; sleep 20
  done
  ```

## 5. Iterate if the gate fails

- Get the failing conditions + the exact issues:
  ```sh
  SHA=$(git rev-parse HEAD)
  CRID=$(gh api "repos/kuzzleio/kuzzle/commits/$SHA/check-runs?per_page=100" \
    --jq '.check_runs[] | select(.name|test("Sonar")) | .id')
  gh api "repos/kuzzleio/kuzzle/check-runs/$CRID/annotations"   # file:line:message
  ```
  (`output.summary` of that check-run lists the failed gate conditions, e.g. "1 New Minor Issue".)
- **Gotcha — reformatting expands "new code":** touching a file (a repo-wide Prettier pass, a rename) marks its lines as *new code* for Sonar, so pre-existing smells/duplication in it are re-evaluated against the strict new-code gate. Expect and fix these, or scope the reformat to avoid dragging legacy in.
- Fix, re-validate (step 2), commit, push, and **go back to step 4**. Repeat until the SonarCloud check is green. Wrapup is not done until it is.

## 5b. Release wrapup (2-dev → beta, and beta → master)

When the change being landed is a **release PR** (2-dev → beta for a new beta, beta → master for a stable), the public docs must tell users what the release changes *before* the PR is opened. Last tag: `git describe --tags --abbrev=0 origin/beta` (or `origin/master` for a stable); changes: `git log --no-merges <last-tag>..origin/2-dev`, keeping `feat` / `fix` / `perf` and dropping what users never see (CI, tests, refactors, ADRs, skills, lint, ratchets).

1. **Changelog page** `doc/2/guides/changelog/<major>-<minor>/index.md` (e.g. `2-60`): create it on the first beta of a minor, update it on each later beta. Plain words, written for an operator or a plugin developer, never commit titles. Fixed sections: *In short* (2–3 sentences), *What you need to do* (or "Nothing."), *What's new*, *What's fixed* (grouped by theme), *Under the hood* (dependencies) if any. First line: `**Status:** in beta since <date of beta.1>` on a beta, `**Released:** <date>` + GitHub release link on the stable. Sidebar `order` = `(100 - minor) * 10`, so the newest minor comes first, and the branch `index.md` redirects to the newest page. Link to the upgrade notes for the details, and to the reference pages of new APIs.
2. **Upgrade notes** `doc/2/guides/upgrade-notes/from-<previous minor>/`: every user-visible change since the last tag has its paragraph (what you can observe, **Action** when there is one). The changelog says *what* changed; the upgrade notes say *what to check*. Both must agree.
3. **Towards Kuzzle 3** `doc/2/guides/kuzzle-3/index.md`: `git diff <last-tag> origin/2-dev -- docs/v3-breaking-changes.md`; every row added with a user-facing replacement gets its line in the matching table there (deprecated thing → what to use instead). Candidates stay under "Still under discussion".
4. Run `pr-preflight`, open the docs PR to `2-dev`, merge it **before** the release PR so the release carries its own notes.

## 6. Report honestly

State plainly what landed, what is green, and what is deferred (with the trigger for picking it up). Do not overclaim: if a residual bug or skipped step remains, name it. Update the task list / memory to match reality.
