# Step 04 — Sprint 3: models & services

**Status:** ✅ Done
**Date:** 2026-07-15
**PR(s):** #2676
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert `lib/model` and `lib/service` — leaves covered by both unit and functional tests — to TypeScript. Taken before Sprint 4 (`lib/api`) because the API layer builds on models and services.

## What was done

- **`lib/model`** (3 files): `baseModel`, `apiKey`, `rights` → TS.
- **`lib/service`** (4 files): `service`, `redis`, `esWrapper` 7 + `esWrapper` 8 → TS.
- **Both layers are now 100% TS.** JS baseline 86 → 79; `any` count unchanged (200). All conversions use `export =`.

## Local decisions / gotchas

- **One documented `@ts-expect-error`** for `ApiKey.load`'s static-signature divergence — no `@ts-ignore`, no `any` reintroduced.
- **`esWrapper.ts` stays duplicated per Elasticsearch major** (`storage/7` / `storage/8` are version-specific adapters). Deduplicating them is an explicit non-goal of the migration; the pair is Sonar `cpd`-excluded (`sonar-project.properties`).

## Validation

- `tsc` clean; **full Mocha suite (3025) green in Docker** (`.ci/scripts/docker-test.sh unit mocha`). Sprint 2 (`bin/`) deprioritized in the same session.
