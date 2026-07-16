---
name: wrapup
description: Finish-and-land ritual for a change in the kuzzle repo — update living docs (README / CONTRIBUTING / the governing ADR) + memory + the associated PR description, run the full local validation (lint, error-codes, migration ratchets & strict, unit tests, build), make logical commits, push, WAIT for the real SonarCloud quality gate and iterate until green, and leave the state cold-start-ready for a fresh context. Use when the user says "wrapup", "wrap up", "wrap up the session", "/wrapup", "finalise", "land it", or when a slice/task is functionally done and needs to be documented, validated, committed, pushed and gate-verified.
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
- **The governing ADR** — if the change belongs to a documented decision record (e.g. `docs/adr-001/ADR-0001-migration-typescript.md`), update it in the SAME pass: the **step table** (statuses / PRs), the **Cold start** block, the **Decision register** if a decision was made, open points closed/opened. The ADR is the source of truth; a change that outruns its ADR is not done. Convert relative dates to absolute. For the ADR's **structure** (hub + per-step files, frozen on close, central decision register), follow the `kuzzle-adr` skill.
- **Memory** (`.../memory/`): update the project memory file with what was non-obvious — new gotchas, decisions, current state, next step. Refresh the `MEMORY.md` one-liner if a new fact file was created.
- **The associated PR description** — if the branch has an open PR (`gh pr view <PR>`), keep its body in sync with what actually landed: the overview, the tracking/step table (statuses), and any "delivered in this PR vs later" framing. Edit it with `gh pr edit <PR> --body-file …`. A PR whose description contradicts its commits misleads reviewers. Do this after the push so it reflects the real state.

## 1b. Cold-start readiness (verify a fresh context can resume)

Before considering the wrapup done, sanity-check that a brand-new session with **zero prior context** could pick the work up from the written record alone:

- The ADR's **Cold start** block names the branch, what is done/validated, the next step, and the key gotchas — updated to this session.
- The **memory** file states the current state and the concrete next action (absolute dates, not "today"/"yesterday").
- Anything you only "know" from this conversation (a live-validation result, a deferred decision, a trigger for a deferred item) is written down somewhere durable — not left implicit.

If a fresh reader would be missing something to continue, add it now. This is the difference between "code landed" and "effort resumable".

## 2. Validate BEFORE committing (repo gates — non-negotiable)

Run the checks CI will run, so nothing is stale. After the LAST code/test edit:

1. **Lint + error-codes** — the two gates that most commonly fail a first push. Use the `pr-preflight` skill (`.ci/scripts/pr-preflight.sh`): `npm run test:lint` + the error-codes doc diff. If `lib/kerror/codes/*.json` changed, regenerate with `npm run doc-error-codes` and commit `doc/2/api/errors/error-codes/`.
2. **Migration ratchets & strict** (the `migration-ratchets` CI job): `npm run ratchet` (js / mocha / any — a count may only decrease) **and** `npm run test:strict` (strict on adopted files). If a conversion reduced a count, update its baseline in the SAME PR (`npm run ratchet:<js|mocha|any> -- --update`), and add any newly-clean file to `.migration/strict-adopted.txt`.
3. **Unit tests** — mocha **and** vitest. Locally via the `docker-tests` skill (`.ci/scripts/docker-test.sh unit vitest` / `… unit mocha`) or `npm run test:unit:*`. Run in Docker — the native `re2` binding can't load on host arm64.
4. **Build** — `npm run build` (tsc + copy-binaries) catches type/emit errors.
5. Touched the big flows (network, cluster, controllers)? Run the relevant **functional** suite via `docker-tests` (`.ci/scripts/docker-test.sh functional http` / `websocket`).

> **Sonar coverage note (kuzzle-specific):** SonarCloud coverage comes from **mocha only** (`npm run test:unit:mocha:coverage` → `coverage/lcov.info`), and `.ts` / `.vue` are coverage-excluded (`sonar-project.properties`). New **`.js`** code therefore needs mocha coverage to satisfy the new-code gate; new **`.ts`** code is coverage-excluded. `coverage/` is gitignored — CI regenerates it, there is nothing to commit.

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

## 6. Report honestly

State plainly what landed, what is green, and what is deferred (with the trigger for picking it up). Do not overclaim: if a residual bug or skipped step remains, name it. Update the task list / memory to match reality.
