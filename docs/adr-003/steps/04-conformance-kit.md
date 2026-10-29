# Step 04 — The conformance kit

**Status:** 🟦 In progress · **Opened:** 2026-10-29 · **PR:** — · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

A driver author proves their driver works with Kuzzle without reading Kuzzle's code: `kuzzle` ships a conformance
kit, a test suite the driver's repository runs against its real engine (decision 12). It covers the mandatory core and
each capability group the driver declares, and skips the others. Kuzzle runs the same kit against its built-in ES7 /
ES8 drivers, which proves the kit itself. In the functional suite (cucumber), the scenarios needing a capability are
tagged, so the suite can run against a driver that does not declare it.

## Design choices (to settle)

- **Packaging:** the kit must not make `vitest` a runtime dependency of `kuzzle`, nor load it when Kuzzle starts.
- **Where Kuzzle runs it:** the unit suite mocks the engine; the kit needs a real ES7 / ES8.
- **Capability tags:** which tag names, and how a run excludes the capabilities its driver lacks.
- **Cross-repo loop** (hub open point): how a contract change is tested against drivers living in other repositories.

## What was done

_Nothing yet._

## Local decisions / gotchas

## Validation
