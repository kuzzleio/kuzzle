# Step 02 — Kuzzle owns its types

**Status:** 🟦 In progress · **Opened:** 2026-09-25 · **PR(s):** this one · **Hub:** [ADR-0002](../ADR-0002-own-api-contract-types.md)

## Goal

Stop defining Kuzzle's own signatures with the client SDK's `JSONObject`, and give the server models behind `request.context` a public name — without changing a single name or type a consumer can import today.

## What was done

- **`lib/types/JSONObject.ts`**: Kuzzle's `JSONObject`, declared exactly as kuzzle-sdk 7.17.1 declares its own (`Record<PropertyKey, any>`), so a value of one is a value of the other, both ways. The **89** files of `lib/` that imported `JSONObject` from `"kuzzle-sdk"` now import it from there (`import type`; the other SDK names they imported are untouched). `index.ts` exports Kuzzle's (through `lib/types`) and no longer re-exports the SDK's: the name `JSONObject` is still exported from `"kuzzle"` (`sdkReexports.ts` still compiles). The emitted `.d.ts` no longer import `JSONObject` from the SDK — what remains of `"kuzzle-sdk"` in `dist/**/*.d.ts` is `index.ts`'s re-export list, the contract types `KDocument`, `KDocumentContent`, `BaseRequest`, `RequestPayload`, `ResponsePayload` and `Notification` (in `EventGenericDocument`, `embeddedSdk`, `impersonatedSdk`, `funnelProtocol` — step 03's scope), and the client runtime `EmbeddedSDK` is built on (`Kuzzle`, `KuzzleEventEmitter`, `RealtimeController`, `ScopeOption`, `UserOption`).
- **TD-10 folded**: the local `interface JSONObject { [key: string]: any }` of `lib/types/storage/{7,8}/Elasticsearch.ts` is replaced by a re-export of Kuzzle's, under the same name. Assignable both ways to what it replaces; the two modules are not reachable from `dist/index.d.ts` (traced), so only a deep import could see the change — and the one thing it loses is declaration merging into a storage-internal interface.
- **`KuzzleUser` and `KuzzleToken`**, type-only exports from `index.ts` of `lib/model/security/user`'s `User` and `lib/model/security/token`'s `Token`: the types of `request.context.user` / `request.getUser()` and of `request.context.token`. JSDoc on both, and on the SDK's re-exported `User` ("… which is `KuzzleUser`").
- **TD-07 documented, not reconciled** — see Local decisions. JSDoc on the `Token` interface (not the type of `request.context.token`: that is `KuzzleToken`) and on its `connectionId` (never set on a token Kuzzle builds).
- **Gate**: `tests/typings/consumer/ownTypes.ts` — a `JSONObject` from `"kuzzle"` and one from `"kuzzle-sdk"` assigned to each other both ways (single values and arrays); `const u: KuzzleUser = request.context.user!; const t: KuzzleToken = request.context.token!;` with their members read; and every member of the `Token` interface but `connectionId` read from a `KuzzleToken` at the interface's type. Both strict modes. Checked it bites: renaming the `KuzzleUser` export or widening the model's `ttl` to `number | null` fails it.

## Local decisions

- **`Token` stays unreconciled with the runtime token (TD-07).** Compared member by member, `KuzzleToken` (the model class) has everything the exported `Token` interface declares, at a compatible type (`type` is `"apiKey" | "authToken"` where the interface says `string`; `singleUse` is extra, allowed by the interface's index signature) — **except `connectionId: string | null`**, which is why `const t: Token = request.context.token!` fails (TS2741). And that member is **absent at runtime**, on v2.56.0 as on `2-dev`: the `Token` constructor copies seven named fields and nothing else, the token manager's `ManagedToken` adds `connectionIds: Set<string>` and `idx`, and the links from connections to tokens live in the manager's `tokensByConnection` map — no code path sets `connectionId` on a token. Every non-breaking way out is ruled out:
  - declaring `connectionId` on the model (or `implements Token`) would state a member the object does not carry;
  - making it optional on the interface changes its read type to `string | null | undefined`, which breaks `const c: string | null = token.connectionId` under `strict`;
  - removing it is breaking.

  So the interface keeps every member with its v2.56.0 type, `KuzzleToken` is the name for the real token, and the gap is a **finding**: the exported `Token.connectionId` describes nothing Kuzzle produces. Marking it `@deprecated` (non-breaking) would be the next honest step; left to the maintainer, since it is a change of the public contract's message rather than of its types.

- **`KuzzleUser` / `KuzzleToken` are type-only.** They are what a request carries, not something a plugin constructs or tests with `instanceof`; exporting the classes as values would add runtime surface this step does not need.
- **The `any` ratchet went down, not up**: 185 → 183. The new `JSONObject` does not match its patterns (`Record<PropertyKey, any>` is neither `: any` nor `as any`), and the two folded storage interfaces each had a `[key: string]: any` line. Baseline updated. The new line carries an `eslint-disable-next-line @typescript-eslint/no-explicit-any` with its reason (the SDK's exact type, kept interchangeable), so the lint warning count does not rise either. And it is the first entry of `.migration/coverage-exempt.txt`: a type-only file, no executable line for the per-file coverage gate to see.

## For step 03 — Kuzzle types that duplicate an SDK contract type

Listed, not changed:

| Kuzzle                                                                            | SDK                                                              | Relation                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `RoleDefinition` (`lib/types/RoleDefinition.ts`)                                  | `RoleRightsDefinition`                                           | same shape                                                                                     |
| `ProfileDefinition.policies`, `Policy` / `PolicyRestrictions` (`lib/types/`)      | `ProfilePolicy`                                                  | diverged: the SDK types `restrictedTo` as a one-element tuple, `Policy` requires `collections` |
| `KuzzleDocument` (`lib/types/KuzzleDocument.ts`)                                  | `KDocument<KDocumentContentGeneric>`                             | subset                                                                                         |
| `KuzzleInfo` (`lib/types/storage/{7,8}/Elasticsearch.ts`)                         | `KDocumentKuzzleInfo`                                            | diverged: `author` is `string \| null` here, `string` in the SDK                               |
| `StoreCollectionDefinition.mappings: JSONObject` (`lib/types/shared/`)            | `CollectionMappings`                                             | Kuzzle's is untyped                                                                            |
| `ApiRoute` (`lib/types/ApiRoute.ts`)                                              | `HttpRoutes`                                                     | same information, other layout (list vs controller → action map)                               |
| `RealtimeScope`, `RealtimeUsers` (`lib/types/realtime/`)                          | `ScopeOption`, `UserOption` enums                                | same values, union vs enum                                                                     |
| notification classes (`lib/core/realtime/notification/{document,user,server}.ts`) | `DocumentNotification`, `UserNotification`, `ServerNotification` | server-side producers of the SDK's shapes                                                      |
| `RequestInput` / `RequestResponse` / `KuzzleRequest.pojo()` (`lib/api/request/`)  | `RequestPayload`, `ResponsePayload`, `BaseRequest`               | server-side producers of the SDK's shapes                                                      |
| `ApiKey` model (`lib/model/storage/apiKey.ts`)                                    | `ApiKey`                                                         | server model vs contract                                                                       |
| `KImportResult` / `KMExecuteResult` / `KImportError` (`lib/types/storage/{7,8}/`) | `mCreateResponse` & co. (`mResponses`)                           | related (the storage layer's view of the same results)                                         |
| `GetCurrentUserResponse` (`lib/types/controllers/authController.type.ts`)         | the SDK's `auth.getCurrentUser` result                           | related                                                                                        |

## Validation

Build (strict) green · `typecheck:typings` green (both modes) · `typecheck:tests` 0 · lint 0 errors · ratchets: `any` 185 → 183, others unchanged · unit suite in Docker 159 files / 3 898 tests green.
