---
name: pr-preflight
description: Run the local checks most likely to fail in CI before pushing or opening a PR on this repo — lint, error-codes documentation sync, and a test/doc coverage reminder. Use when the user asks if a PR/change is ready, wants to check before pushing, or asks to run the same checks as CI locally.
---

# PR Preflight

Runs `.ci/scripts/pr-preflight.sh`, which mirrors the two CI gates that most
commonly fail on a first push, plus a lightweight coverage reminder:

```bash
.ci/scripts/pr-preflight.sh
```

1. **Lint** — `npm run test:lint`, same as the `lint` job in
   `.github/workflows/pull_request.workflow.yaml`.
2. **Error codes documentation** — regenerates `doc/2/api/errors/error-codes/`
   into a temp dir via `npm run doc-error-codes` and diffs it against the
   committed docs, same as the `error-codes-check` job. Any `lib/kerror/codes/*.json`
   change without a regenerated doc fails here, before CI. Fix with:
   `npm run doc-error-codes`, then commit the updated `doc/2/api/errors/error-codes/`.
3. **Test/doc coverage reminder** — a heuristic (not a hard gate): warns if
   `lib/` files changed (against `origin/master`, or working-tree diff if that's
   unavailable) with no matching change under `test/`, `tests/`, `features/`
   or `features-legacy/`. CONTRIBUTING.md is explicit that untested or
   undocumented pull requests won't be accepted — this just flags the
   omission before a human reviewer does.

Requires local Node.js/npm (same prerequisite as `npm run test:lint`) — this
does not run in Docker, matching how lint and the error-codes check run
directly on the CI runner rather than in a container.

Exit code is non-zero if lint or the error-codes check fails; the coverage
reminder never fails the run on its own.
