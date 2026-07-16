# Step 02 — Sprint 1: `lib/util` warm-up

**Status:** ✅ Done
**Date:** 2026-07-12 → 2026-07-14
**PR(s):** #2670 (first 5), #2674 (remaining 7)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Warm-up conversion of `lib/util` — 12 leaf, well-tested files with few dependencies. Exercises the conversion process and the tooling (ratchets, strict adoption) at low risk before touching `core` and `cluster`.

## What was done

- **PR #2670** — first 5 modules converted to TS: `safeObject`, `bytes`, `wildcard`, `memoize`, `extractFields`. JS baseline 111 → 106; strict adopted 46.
- **PR #2674** — remaining 7 converted: `debug`, `deprecate`, `promback`, `stackTrace`, `didYouMean`, `assertType`, `requestAssertions`. **`lib/util` is now 100% TS.** Counters after: js = 86, strict adopted = 51.

## Local decisions / gotchas

- **`rewire`/`__set__` specs need the compiled variable name preserved** — a module whose Mocha spec rewires a `require`d dependency (e.g. `didYouMean`) must use `import x = require("mod")`, **not** `import x from "mod"`, or the spec's `__set__` target disappears after compilation.
- **Typing a previously-`any` export can break inferring consumers** — make it **generic** (e.g. `Promback<T>`) and annotate the call sites, rather than reintroducing `any`.
- Standard conversion applied (`export =` for single exports, named exports for object modules; reuse `lib/types`).

## Validation

- `tsc --noEmit` + build green; unit tests green (7/7 at #2670, full suite after #2674). Run in Docker (`.ci/scripts/docker-test.sh unit mocha`) — the native `re2` binding can't load on host arm64.
