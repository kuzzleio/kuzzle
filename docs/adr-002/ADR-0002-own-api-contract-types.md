# ADR-0002: Kuzzle owns its API contract types

**Status:** Accepted (2026-09-25)
**Date:** 2026-09-25
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io)
**Scope:** the public TypeScript surface of the `kuzzle` package (`index.ts` → `dist/index.d.ts`), and its relationship with `kuzzle-sdk` (`sdk-javascript`)
**Related documents:** [ADR-0001](../adr-001/ADR-0001-migration-typescript.md) (its step 15 found the typings gate this ADR relies on) · type-debt register entries [TD-07](../adr-001/type-debt-register.md#td-07), [TD-09](../adr-001/type-debt-register.md#td-09), [TD-10](../adr-001/type-debt-register.md#td-10) · step files under [`steps/`](steps/)

> Living hub (structure per the `kuzzle-adr` skill). To resume, read **Cold start**.

---

## Decision

### Context

Measured on `2-dev` and on v2.56.0 (identical on both — nothing here is a regression of ADR-0001):

- **`index.ts` ends in `export * from "kuzzle-sdk"`.** 139 of the package's 274 public exports are the SDK's: 66 type aliases, 46 interfaces, 2 enums and **25 classes — the client runtime**: `Kuzzle`, `WebSocket`, `Http`, the nine controllers, and the SDK's `User`, `Profile`, `Role`, `Document` and search-result classes. No name collides with Kuzzle's own, so nothing is dropped; everything the SDK adds in a minor lands in Kuzzle's API unannounced.
- **The server's API contract is defined by one of its clients.** The types describing Kuzzle's own API — `JSONObject`, `KDocument`, `ApiKey`, `Mappings`, `Notification`, `RequestPayload` / `ResponsePayload`, `ProfilePolicy`, `RoleRightsDefinition`, `HttpRoutes` — live in `sdk-javascript/src/types`. `lib/` imports `JSONObject` from the SDK in 88 files, and the emitted `.d.ts` depend on it (76 imports of `JSONObject`, 11 of other SDK types).
- **The exported names mislead.** Verified with a consumer written the way a developer would:
  - `import { User } from "kuzzle"` is the SDK's **client** `User`, not the type of `request.context.user` (TS2739). The server model is not exported at all.
  - the exported `Token` (`lib/types/Token`) is not the type of `request.context.token` (`lib/model/security/token`) — TS2741. Two `Token`s, diverged ([TD-07](../adr-001/type-debt-register.md#td-07)).
- **Kuzzle's public API varies with the installed SDK** (`kuzzle-sdk: >=7.17.1 <8.0.0`, a `dependency`): an SDK minor silently changes it; an SDK major would force a Kuzzle major. An application that also uses the SDK as a client, at another version, gets two copies, whose classes with private members do not assign to each other _(risk, not verified)_.
- `JSONObject` is `Record<PropertyKey, any>` — an `any` in nearly every public signature, which a `strict` build does not see ([TD-09](../adr-001/type-debt-register.md#td-09), [TD-10](../adr-001/type-debt-register.md#td-10): two more local `JSONObject`s in the ES7 / ES8 storage types).

### Decision

**The server owns the types of its API; the SDK consumes them.** Because the SDK cannot depend on the server (Node-only, native modules; the SDK also runs in browsers), the shared contract ends in a **third, types-only, dependency-free package** both depend on. Getting there without a breaking change, in four steps:

1. **Freeze the leak** — replace `export * from "kuzzle-sdk"` with an explicit list of exactly today's 139 names, pinned by the typings gate, and mark the re-exported **client transport** (`Kuzzle`, `WebSocket`, `Http`, `KuzzleAbstractProtocol`) `@deprecated` with a pointer to `kuzzle-sdk` — not the controllers and result classes, which are what `app.sdk.*` answers with ([step 01](steps/01-freeze-sdk-reexport.md)). Same names, same types: not breaking.
2. **Kuzzle owns its types** — its own `JSONObject` (structurally identical, so interchangeable) instead of the SDK's, in `lib/` and in the emitted `.d.ts`; the server models behind `request.context` exported under unambiguous names (**`KuzzleUser`**, **`KuzzleToken`**); the two `Token`s reconciled. Additions and an identical swap: not breaking.
3. **A shared contract package** — the API contract types move from `sdk-javascript/src/types` into a types-only package that both `kuzzle` and `kuzzle-sdk` depend on and re-export under the same names. Cross-repo; not breaking if the names are kept.
4. **Next major only** — stop re-exporting the SDK's client runtime from `kuzzle`, prepared by step 1's deprecations.

### Consequences

- Steps 1–2 land before the beta ADR-0001 step 15 prepares; step 3 needs an SDK release and its own planning; step 4 waits for a major, which the maintainer has ruled out for now.
- The typings gate (`tests/typings/`, from ADR-0001 step 15) becomes the enforcement of this ADR: the export list and the new names are asserted there.

---

## Cold start

**Where we are (2026-09-25):** steps 01 ([#2927](https://github.com/kuzzleio/kuzzle/pull/2927)) and 02 ([#2928](https://github.com/kuzzleio/kuzzle/pull/2928)) are merged into `2-dev`. Kuzzle re-exports the SDK by an explicit list, owns its `JSONObject`, and exports `KuzzleUser` / `KuzzleToken`. The two `Token`s stay apart: the exported interface declares a `connectionId` no runtime token has ever carried (TD-07) — the proposed `@deprecated` on it awaits the maintainer.

**Why it mattered:** steps 01–02 were to land **before the beta** that [ADR-0001 step 15](../adr-001/steps/15-consolidation-non-regression.md) prepares — the maintainer's decision. When they merge: add what a user sees (four `@deprecated` client-transport re-exports; new `KuzzleUser` / `KuzzleToken`; Kuzzle's own `JSONObject`) to [step 15's release notes draft](../adr-001/step-15-release-notes.md), and re-run step 15's phase C if `lib/` changed.

**Next action:** the maintainer's answer on `Token.connectionId`; then plan step 03 (package name and home, a `kuzzle-sdk` release — see open points; its scope list is in [step 02](steps/02-kuzzle-owns-its-types.md)).

**Conventions** (same as ADR-0001): base branch `2-dev`; non-breaking only; unit tests in Docker; Claude cannot merge — it hands the maintainer `!` commands (a stacked PR merges through `gh api -X PUT repos/kuzzleio/kuzzle/pulls/<n>/merge-async -f merge_method=merge`). The typings gate is `npm run typecheck:typings` (`tests/typings/`); `tests/typings/consumer/sdkReexports.ts` pins the 139 re-exported names.

---

## Step table

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 01 | Freeze the SDK re-export: explicit list, client transport `@deprecated` | ✅ Done 2026-09-25 | [#2927](https://github.com/kuzzleio/kuzzle/pull/2927) | [detail](steps/01-freeze-sdk-reexport.md) |
| 02 | Kuzzle owns its types: `JSONObject`, `KuzzleUser`, `KuzzleToken`, one `Token` | ✅ Done 2026-09-25 — the two `Token`s left apart (TD-07, see open points) | [#2928](https://github.com/kuzzleio/kuzzle/pull/2928) | [detail](steps/02-kuzzle-owns-its-types.md) |
| 03 | Shared types-only contract package, consumed by `kuzzle` and `kuzzle-sdk` | ⬜ To do | — | — |
| 04 | Next major: drop the client-runtime re-exports | ⬜ To do (next major) | — | — |

---

## Decision register

- **2026-09-25** — **The server owns its API contract; a types-only package carries it to the SDK.** The maintainer's position ("types should come from kuzzle, the SDK should only build on them") taken as the principle; the third package is the only way to honour it, since the SDK cannot depend on the server.
- **2026-09-25** — **Not breaking until a major.** Steps 1–3 keep every name and type a v2.56.0 consumer could import; step 4 is deferred to the next major.
- **2026-09-25** — **Names for the server models:** `KuzzleUser`, `KuzzleToken` (`User` and `Token` are taken — the first by the SDK's client class, the second by the existing interface).
- **2026-09-25** — **The two `Token`s stay two (TD-07).** The runtime token never carries the exported interface's `connectionId: string | null`, and no non-breaking change can remove or loosen it; `KuzzleToken` names the real one, the interface is documented as not being it ([step 02](steps/02-kuzzle-owns-its-types.md#local-decisions)).

- **2026-09-25** — **TD-07: the two `Token`s stay apart; `Token.connectionId` is `@deprecated`.** No runtime token has ever carried `connectionId` (the token manager keeps the connection links), so declaring it on the model would be false and removing it from the interface would break strict consumers. It is deprecated, with a pointer to `request.context.connection.id`, and goes in step 04.

---

## Open points

- Step 3's package name and home (`@kuzzleio/types`? its own repo, or a workspace in `sdk-javascript`?). (Step 02 already folded the ES storage types' local `JSONObject`s into Kuzzle's own.)
- Whether to mark the `Token` interface's `connectionId` `@deprecated` — it describes nothing Kuzzle produces ([step 02](steps/02-kuzzle-owns-its-types.md#local-decisions)).
- Whether `JSONObject` should stay `any`-valued in step 2 (identical, non-breaking) or gain a stricter sibling type for new code.

## References

- [ADR-0001 step 15 inventory](../adr-001/step-15-inventory.md) — where the typings gate and the no-major rule come from.
- `kuzzle-adr` skill — hub + steps structure.
