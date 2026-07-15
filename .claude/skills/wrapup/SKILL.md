---
name: wrapup
description: End-of-session wrapup for a working branch — sync docs (README / CONTRIBUTING / ADRs) with the session's changes, maintain the governing ADR's progress table and cold-start section, then commit and push. Use when the user says "/wrapup", "wrap up", "wrap up the session", or wants to leave a branch in a documented, resumable state before stopping.
---

# Wrapup

Leave the current working branch in a clean, **documented and resumable** state at
the end of a work session. The goal: a teammate — or a fresh Claude with zero prior
context — can open the repo and continue without re-deriving anything.

Run the steps in order. Adapt to what the session actually changed; skip a step that
doesn't apply and say so explicitly rather than inventing content.

## 1. Take stock of the session

- Identify the working branch and its base: `git branch --show-current`, then
  `git log --oneline <base>..HEAD`.
- Review the real changes: `git diff --stat <base>...HEAD`, and any open PRs:
  `gh pr list --head <branch> --json number,title,baseRefName`.
- Note the follow-ups still open (deferred work, TODOs).

Everything below must reflect this **actual** state — never invent progress.

## 2. Sync the documentation

Update contributor/user docs so they match the code as it now stands. Judge which
are affected; typical targets:

- **CONTRIBUTING.md** — new rules, commands or workflows a contributor must follow
  (a new lint/test gate, a migration constraint, a naming convention…).
- **README.md** — only if user-facing behavior, setup or capabilities changed.
- Any other doc the change touches (architecture notes, runbooks, error tables).

Keep edits surgical and match the surrounding tone. If nothing user-facing changed,
say so and move on.

## 3. Maintain the governing ADR (if one exists)

If the work is governed by an ADR (e.g. `docs/adr-*/ADR-*.md`), keep two **living**
sections up to date:

### 3a. Progress table

A compact table of the effort's units of work with a status column
(⬜ to do · 🟦 in progress · ✅ done), linking the relevant commits/PRs. It must
answer "where are we?" at a glance.

### 3b. Cold-start section

A short **"Resume from here"** block written for a fresh context. Include:

- the current state in one short paragraph;
- the branch topology + open PRs (with numbers) and the recommended merge order;
- the next concrete actions;
- the key commands to run (build / test / lint / project-specific gates).

Someone starting cold should need only this section to pick the work back up.

## 4. Commit & push

- Commit the wrapup changes on the working branch with a clear `docs:` / `chore:`
  message.
- Push the branch.
- **Safety:** if the working branch is a protected/default branch (`master`,
  `main`, a shared release branch), do NOT push directly — ask first, or open a PR
  instead.

## 5. Report

Summarize what was updated and paste the cold-start pointer, so the user (and the
next session) can find it immediately.

---

> Reference implementation in this repo: `docs/adr-001/ADR-0001-migration-typescript.md`
> maintains exactly this pattern — a progress table and a "cold start" section —
> for the ongoing TypeScript migration.
