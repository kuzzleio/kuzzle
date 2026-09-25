# Step 01 — freeze the SDK re-export

**Status:** 🟦 In progress · **Opened:** 2026-09-25 · **PR(s):** this one · **Hub:** [ADR-0002](../ADR-0002-own-api-contract-types.md)

## Goal

Stop the SDK's future additions from entering Kuzzle's public API unannounced, without changing a single name or type a consumer can import today.

## What was done

- `index.ts`: `export * from "kuzzle-sdk"` → an explicit list of the **139** names it used to re-export — `export { … }` for the 27 runtime values (classes and enums), `export type { … }` for the 112 types. Measured before and after: the type-level export set of `dist/index.d.ts` is identical, and the 27 runtime keys of `require("kuzzle-sdk")` are exactly the 27 values listed.
- **`@deprecated` on the client transport only**: `Kuzzle`, `WebSocket`, `Http`, `KuzzleAbstractProtocol`, each pointing at `kuzzle-sdk` (and, for `Kuzzle`, at `app.sdk`). TypeScript 5.4 keeps the tag through a re-export specifier into the emitted `.d.ts` (checked), so editors strike them through.
- **Not deprecated, on purpose**: the controllers, `User` / `Profile` / `Role` / `Document`, the search-result classes and the `ScopeOption` / `UserOption` enums are what `app.sdk.*` answers with or takes — server-side types too. `User`, `Profile` and `Role` got a one-line JSDoc instead, saying they are the SDK's client-side representations (`User` is not `request.context.user`; step 02 names that one).
- **Gates**: `tests/typings/consumer/sdkReexports.ts` re-exports all 139 names from `"kuzzle"`, so `npm run typecheck:typings` fails if one goes missing (checked by renaming one); `tests/index.test.ts` asserts every runtime key of `kuzzle-sdk` is re-exported as the same object.

## Local decisions

- The deprecation set is smaller than the ADR first sketched ("the client runtime"): only what is useless server-side is deprecated. Deprecating a type `app.sdk` returns would push users towards a second import of the SDK — exactly the duplication risk the ADR's context names.

## Validation

Build (strict) green · `typecheck:typings` green · `typecheck:tests` 0 · lint 0 errors · unit suite in Docker 159 files / 3 898 tests green.
