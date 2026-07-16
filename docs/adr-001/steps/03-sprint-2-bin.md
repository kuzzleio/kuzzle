# Step 03 — Sprint 2: `bin/` cleanup (deprioritized)

**Status:** 🟦 Dead-code removal done (#2671); entrypoints deprioritized (2026-07-15)
**Date:** 2026-07-12 → deprioritized 2026-07-15
**PR(s):** #2671 (dead-code removal)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Clear the dead weight out of `bin/` and convert the real entrypoints, so the JS ratchet tracks only production code.

## What was done

- Removed dead code `bin/.upgrades/**` + `bin/.lib/colorOutput.js` (~12 files) via PR #2671 — unreferenced since 2023, no npm `bin` field. Deleted, not migrated.

## Deprioritized (2026-07-15)

Converting the real entrypoints (`copy-binaries.js`, `start-kuzzle-server`) is **deprioritized** — the effort focuses on the `lib/` layers (Sprint 4+) which unblock more value and carry the real typing risk. `bin/` (4 remaining JS files) is picked up later.

- `bin/plugins/available/*` are **test fixtures** loaded as JS at runtime by the functional tests → handled separately, with care (not part of the production ratchet).

## Local decisions / gotchas

- **The initial "bin/ = 17 files" count was misleading:** most of `bin/` was dead code or runtime fixtures, not real entrypoints. Consequently the warm-up (Sprint 1) is carried by `lib/util`, and the JS ratchet targets only production code (`lib/` + the real bin entrypoints).

## Validation

- Kuzzle still starts after the dead-code removal; startup + functional suites green.
