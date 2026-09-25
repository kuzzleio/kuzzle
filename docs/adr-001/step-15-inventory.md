# Step 15 — consolidated inventory (v2.56.0 → 2-dev @ `0855cd70f`)

> Companion of [step 15](steps/15-consolidation-non-regression.md). **Living until the step closes**: every row ends fixed, accepted-and-documented, or rejected with a reason. The raw per-surface reports it consolidates are frozen in [`step-15-audit/`](step-15-audit/) — the IDs below (`T-`, `P-`, `R-`, `E-`, `C-`, `B-`) point into them.

## Verdict (2026-09-25)

- **Nothing public was removed or renamed** — no export, no route (298 → 299, additive), no controller action, none of the 412 event names, no error id except TD-77's two never-raised codes. `require("kuzzle")` gains two keys and loses none.
- **v2.56.0's functional suites pass unchanged against `2-dev`** — all 30 functional jobs (5 protocols × Node 20/22/24 × ES 7/8), the 6 cluster monkey jobs, and v2.56.0's own test application booted on `2-dev` ([#2901](https://github.com/kuzzleio/kuzzle/pull/2901), measurement only). ⚠️ **Those suites are blind to the worst regression found (F-01)**: they assert the 404, not the error id.
- **Not releasable as a minor today.** Under the rule adopted for this step (typings count), the exported types break TypeScript consumers: a consumer fixture written from the docs gets **11 new errors with `strict: false`, 35 with `strict: true`** ([A1](step-15-audit/A1-typings.md)). At runtime, **7 accidental breaking changes**, two of them confirmed by hand.
- Raw count: 207 commits touching shipped code reviewed, 103 observable changes, **77 intended / 26 accidental** ([B](step-15-audit/B-commit-inventory.md)). 15 PRs' "not breaking" paragraphs are contradicted by their diff.

## 1. Fix before the beta — accidental regressions

| # | What breaks | Source IDs | Status |
| --- | --- | --- | --- |
| **F-01** | A missing document on `document:get` / `delete` / `deleteFields` answers `services.storage.unexpected_not_found` (code 34) instead of `services.storage.not_found` (code 11). `formatESError` spreads the ES `ResponseError`, whose `body` is a prototype getter, so `body._index` is lost. **Confirmed by hand** with the real ES client class. Unit fixtures build plain objects and hide it. | C-01, B-58 (#2802) | ✅ [#2903](https://github.com/kuzzleio/kuzzle/pull/2903) |
| **F-02** | `document:export` rejects an array `sort` — the standard ES form, and the documented one — with `api.assert.invalid_type` (except over HTTP GET). v2.56.0 ignored `sort` entirely, so a request that worked now fails. **Confirmed by reading** (`getObjectFromBodyOrArgs` → `getBodyObject`). | B-02 (#2666) | ✅ [#2904](https://github.com/kuzzleio/kuzzle/pull/2904) |
| **F-03** | Cluster join: an existing node's `addNode()` waits up to 2 × `cluster.heartbeat` (4 s) before answering; the joiner gives up after a hard-coded 2 000 ms (`lib/cluster/command.ts`). Membership can end one-sided, including against a v2.56.0 node in a rolling upgrade. Static analysis — needs a runtime check. | C-03, B-43 (#2777, #2781) | ✅ real (1–3 % of joins at the default heartbeat, 3 in 5 at 5 s) — [#2913](https://github.com/kuzzleio/kuzzle/pull/2913) |
| **F-04** | Retransmit recovery pauses the subscriber up to `syncTimeout`; the heartbeat check meanwhile can evict a healthy peer. | B-103 (#2896) | ✅ real (a retransmit slower than ~4 s evicted a healthy peer) — [#2914](https://github.com/kuzzleio/kuzzle/pull/2914) |
| **F-05** | Dumps: the new 64-char suffix check rejects the funnel's own uncapped `handled-…` suffixes → the dump is lost in an unhandled rejection, which stops Kuzzle under `NODE_ENV=development` (only with `dump.enabled`). And `slice(0, negative)` deletes the oldest dump's core file when there are fewer dumps than `history.coredump`. The suffix error also has no id/code. | C-04, C-05, E-07 (#2665) | ✅ [#2909](https://github.com/kuzzleio/kuzzle/pull/2909) — the core-file deletion was a step-12 regression too |
| **F-06** | `accessors.execute(req, null)` rejects with `plugin.context.invalid_callback`; `null` meant "no callback". | B-82(a) (#2803) | ✅ [#2906](https://github.com/kuzzleio/kuzzle/pull/2906) |
| **F-07** | A function in the Redis config (e.g. `retryStrategy`, set from code) crashes startup: the config is copied with `structuredClone`. | C-19, B-07 (#2676) | ✅ [#2910](https://github.com/kuzzleio/kuzzle/pull/2910) |
| **F-08** | `kerror`: a class instance passed as the last placeholder is taken as the options object (`safeObject.isPlainObject` replaced lodash's) — literal `%s` in the message, value lost from `props`. Reaches plugins (`context.kerror`) and apps (`app.errors`). | E-01, B-72 | ✅ [#2916](https://github.com/kuzzleio/kuzzle/pull/2916) |
| **F-09** | Plugin `BaseType` subclasses using getters or prototype values break (fields now initialised in the constructor); a validation spec with a truthy non-boolean `strict` is no longer strict. | B-17 (#2722), B-63 (#2803) | ✅ [#2905](https://github.com/kuzzleio/kuzzle/pull/2905), [#2908](https://github.com/kuzzleio/kuzzle/pull/2908) |
| **F-10** | A `KuzzleError` thrown in the WebSocket `afterParsingPayload` pipe reaches the client as-is instead of `network.websocket.unexpected_error` (400); a non-Error thrown by a plugin is `util.inspect`-ed into the client message; a non-Error `{message}` pipe rejection prints `undefined`. | R-04, B-70, B-31 | ✅ all three restored — [#2915](https://github.com/kuzzleio/kuzzle/pull/2915) |
| **F-11** | Small crash-path changes: `ClusterNode.nodeId` throws before the handshake (a shutdown during init skips `dispose`); `Protocol.init("", entryPoint)` now crashes; a `then`-only thenable from a strategy `verify` is rejected. | B-77, B-23(c), B-29 | ✅ [#2911](https://github.com/kuzzleio/kuzzle/pull/2911) |

## 2. Typings — breaking under this step's rule

Every item is intended (step 12's strict flip or a TD fix), and none of those PRs checked an **external** consumer. [A1](step-15-audit/A1-typings.md) proposes a non-breaking fix for most of them.

| # | Change | Breaks | Source IDs | Proposed direction |
| --- | --- | --- | --- | --- |
| **TY-01** | `Plugin.context` / `Plugin.config` optional | `strict` — every plugin using `this.context.*`, the documented pattern | T-01 (#2800) | definite assignment (`context!: PluginContext`) — what the runtime guarantees after `init` |
| **TY-02** | `accessors.execute()` returns `Promise<KuzzleRequest> \| null` | `strict` — `await execute(r)` then a read | T-04 (#2803) | overloads: no callback → `Promise<KuzzleRequest>` |
| **TY-03** | `getIndex` / `getCollection` / `getId` overloads reject a non-literal option | **both modes** (TS2769) | T-03 | catch-all overload |
| **TY-04** | `EventGenericDocument*<T>` requires `T extends KDocumentContent` | **both modes** (TS2559 on any user content type) | T-07 | relax the constraint |
| **TY-05** | `KuzzleError.code` / `.id` possibly `undefined`; `.props` `unknown[] \| undefined`; constructors narrowed from `any` | `props` both modes, rest `strict` | T-05, T-06, E-10 | restore `string[]`; decide on the rest |
| **TY-06** | `getController()` / `getAction()` / `getUser()` / `pojo()` fields and `User._id` / `Token` fields nullable | `strict` | T-02, T-27 | decide: accurate types vs compatibility |
| **TY-07** | Each `PluginsConfiguration` entry possibly `undefined`; `Controller.name` / `definition` optional; config assignment shapes; `getHeader()` → `undefined`; `ObjectRepository` loads nullable | `strict` (mostly) | T-08 – T-12, T-16, T-26 | case by case |

## 3. Decisions for the maintainer

> **Answered 2026-09-25:** D-1 **no major** — so every §2 item must get a non-breaking fix, none may be "accepted"; D-2 **document**; D-3 **replace the library** (done in [#2912](https://github.com/kuzzleio/kuzzle/pull/2912): `redis-semaphore`, every production dependency now satisfies Node 20); D-4 **no-op with a warning** (done, [#2907](https://github.com/kuzzleio/kuzzle/pull/2907)); D-5 **document**.

- **D-1 — version.** Fix sections 1 and 2 to non-breaking and ship a minor, or accept some of section 2 and ship a major. semantic-release will cut a **minor** either way unless a commit says `BREAKING CHANGE` (none does; one says `BREAKING-ish:`, which it ignores).
- **D-2 — headers in logs (security).** HTTP connections now carry their real headers (they were always `{}`, TD-52). Side effect not recorded anywhere: `authorization` and `cookie` now reach the logstash access log and the `connection:new` / `connection:remove` hook payloads. Redact, or document. (R-02, B-33)
- **D-3 — Node 20.** New runtime dependency `redlock-universal@0.8.5` declares Node `>=22`; Kuzzle declares `>=20 <25`. Warning by default, `EBADENGINE` with `--engine-strict`. Raising `engines` is breaking, so it is ruled out by D-1. (P-01)
  - **Every** `redlock-universal` release declares `>=22` (0.3.0 → 0.8.5), so pinning older does not help. Upstream's changelog calls the bump "future-proofing"; the 0.8.5 bundle uses no Node-22-only API found by a search, and the unit suite runs its lock logic on Node 20 in CI (through its `MemoryAdapter`). No run against a real Redis on Node 20 yet.
  - **`withLock` has never been released** — it came with #2664, after v2.56.0, and no core code path uses it (it is exported for applications). Changing the library under it now costs no compatibility at all; after the release it would mean lock-format compatibility between versions.
  - Alternatives: **`redis-semaphore`** 5.8.0 (Node `>=14.17`, peer `ioredis ^5 || ^6`, maintained — last release 2026-09-10; `Mutex` with `lockTimeout`, `acquireAttemptsLimit`, `retryInterval`, auto-refresh and `onLockLost`, i.e. every feature `withLock` uses, plus a `RedlockMutex`); `@sesamecare-oss/redlock` 1.4.0 (Node `>=16`, ioredis `>=5`); `redlock` 5 is a beta untouched since 2022.
- **D-4 — `--enable-plugins`.** Now that the CLI options work (TD-84), this one crashes the published build at boot (`MODULE_NOT_FOUND`: `bin/plugins/` is not shipped); on v2.56.0 it was silently ignored. Make it a no-op with a warning, or fix the path. (P-02, C-06)
- **D-5 — API keys created before the upgrade** cannot be deleted by `key` / `fingerprint` (the new mapping is `dynamic: false`, nothing re-indexes). Re-index at startup, fall back to a scan, or document. (C-10, B-38)

## 4. Intended changes — changelog and migration notes

Nothing to fix, everything to write down. The beta's release notes are built from this list.

> **Drafted:** [step-15-release-notes.md](step-15-release-notes.md) — the user-facing text, by audience (operators, API clients, developers).

- **Multipart `maxFormFileSize` (default 1 MB) is enforced** — uploads larger than that get a 413 `network.http.file_too_large` even where `maxRequestSize` was raised (TD-52). Migration note. (R-01, B-32)
- **`Kuzzle.id` is set**: the node name appears in the redis client name, the cluster ID card, every realtime notification's `node`, **every API response's `node`** (absent before) and the **`X-Kuzzle-Node` header** (the literal string `"undefined"` before). The ADR listed only the first three. (C-07)
- **Cluster**: an evicted node exits 1 instead of staying up as a zombie — also on any sync-handler exception and ID-card worker error; lost sync messages are retransmitted (`cluster.retransmitBuffer`, new key). Rolling upgrade from v2.56.0 is wire-compatible (static analysis). (C-02, B-44, B-102)
- **Error ids a client may switch on**: native controller crash `plugin.runtime.unexpected_error` → `core.fatal.unexpected_error` (also seen by `request:onError` pipes); Redis disconnected → `services.cache.not_connected` **503** (was 500); ES rejected execution → `services.storage.too_many_operations`; missing body on document writes → `api.assert.body_required` 400 (was a 500); plugin SDK calls without user/token, unknown strategy/plugin, malformed WS frames → documented ids; TD-77's two codes removed. (E-02 – E-18)
- **CLI**: the six `start-kuzzle-server` options take effect (they were all ignored); `--help` / `--version` exit; a flag without a value exits 1. (C-06, TD-84)
- **Smaller**: `document:export` honours `sort`; API keys deletable by `key` / `fingerprint` (new `DELETE /users/:userId/api-keys` route — the HTTP form puts the clear key in the URL); logout cookie `authToken=` (was `authToken=null`); anonymous `auth:getCurrentUser` → `strategies: []` (was `[[]]`); realtime `users: "out"` subscriptions get their own channel (TD-74); `Protocol.entryPoint` is read-only for protocol plugins (R-05); HTTP streamed-response errors no longer crash the node (B-28); deep `require("kuzzle/dist/lib/…")` shapes changed for 4 modules, 2 files gone (P-03, P-04).

- **Introduced by the §1 fixes themselves**, each stated in its PR: the Redis config is copied with `cloneDeep`, where v2.56.0 used a JSON round-trip — a `Buffer` or `Infinity` in it now reaches ioredis as written instead of as `{type,data}` / `null` (F-07); a rejected dump suffix answers `api.assert.invalid_argument` (400) instead of an id-less `BadRequestError` (F-05); a thrown `null` gives "…: undefined" instead of crashing (F-10); before the handshake, a shutting-down node sends no `NodeShutdown` (it carried a null id on v2.56.0, which no peer could use — F-11).

## 5. Pre-existing — same on v2.56.0, not regressions

- Neither version loads on Node < 20.19 (`uuid@13` is ESM-only), despite `engines >=20.0.0`. (A2)
- `statistics.ts` wraps `services.stats` instead of `services.statistics`: with statistics disabled, `server:getStats` answers `core.fatal.unexpected_error`. (A4)
- `.kuzzlerc.sample.jsonc` and the defaults disagree in places (one new gap: the `fingerprint` mapping). (A5)

- `checkHeartbeat()` overwrites a subscriber's `BUFFERING` state during a slow handshake (found while fixing F-04). Same on v2.56.0.
- Before F-05, a failed dump (lock held, unwritable path) already surfaced as an unhandled rejection on v2.56.0; #2665 made it happen on almost every handled-error dump. Both are closed by [#2909](https://github.com/kuzzleio/kuzzle/pull/2909).

### A recurring CI instability

The functional scenario _"Create first admin then reset anonymous and default roles"_ failed its `After` hook with `Unauthorized` on `admin:loadSecurities`, on the **same cell** (`http`, Node 22, ES 8), on two unrelated PRs ([#2910](https://github.com/kuzzleio/kuzzle/pull/2910), [#2912](https://github.com/kuzzleio/kuzzle/pull/2912)) the same day; a rerun passed. Not caused by either change — but twice in one cell is a pattern, not noise. ⬜ To investigate before the beta: a flaky scenario is a scenario that cannot report a regression.

## 6. Not verified yet

Runtime checks the static audit could not make: F-03 and F-04 (a real cluster, including a mixed v2.56.0 / 2-dev one), D-2's headers in a real access log, D-5 on a real index, and the typings on TypeScript versions other than 5.4.5.
