# Step 11 — Sprint 8: `lib/cluster`, the last conversion sprint

**Status:** 🟦 Open · **Opened:** 2026-09-16 · **PR(s):** J0 [#2772](https://github.com/kuzzleio/kuzzle/pull/2772) ✅ · J1 [#2775](https://github.com/kuzzleio/kuzzle/pull/2775) · ← [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Convert the six remaining `.js` files under `lib/` — all of them in `lib/cluster` — taking the `js` ratchet from **11 to 5** (the 5 `bin/` entries are the floor, see [step 03](03-sprint-2-bin.md)). After this sprint no production JavaScript is left to convert, and [step 12](../ADR-0001-migration-typescript.md#step-table) can flip `strict` and drop `allowJs`.

Two things make this sprint different from the seven before it:

1. **It is the last chance to apply the strict-count DoD** ([TD-54](../type-debt-register.md#td-54), decided 2026-09-16). Sprints 6 and 7 left 246 strict errors across their six largest files and nobody was asked for the number. `pr-preflight.sh` now asks.
2. **[TD-33](../type-debt-register.md#td-33)'s cause lives in this layer.** The files that decide membership are exactly the ones the compiler has never read, and the last two sprints each surfaced a real defect by typing one (`maxFormFileSize` never assigned; a `Promise` the declaration said was not one).

## Scope, measured 2026-09-16

`lib/cluster` is **2 843 lines of JavaScript across 6 files**, plus 882 lines already in TypeScript. Coverage is SonarQube's `(covered lines + covered conditions) / (lines + conditions)`, recomputed on `2-dev` after [TD-50](../type-debt-register.md#td-50)'s merge fix — **not** the line-only figures this ADR quoted before 2026-09-15.

| File | Lines | Coverage | Gate (≥ 80%) |
|---|---:|---:|---|
| `index.js` | 24 | 100.0% | ✅ |
| `node.js` | 1 212 | 98.9% | ✅ |
| `subscriber.js` | 793 | 98.5% | ✅ |
| `publisher.js` | 386 | 98.5% | ✅ |
| `workers/IDCardRenewer.js` | 144 | 73.1% | ❌ spec effort |
| `command.js` | 284 | 41.5% | ❌ spec effort |
| **total JS** | **2 843** | **—** | |
| `state.ts` (already TS) | 468 | 99.6% | ✅ |
| `idCardHandler.ts` (already TS) | 414 | 92.2% | ✅ |
| **aggregate `lib/cluster`** | | **93.0%** | |

> ⚠️ The hub previously carried **6 files, 1 544 lines, 88.9%**, and `command.js` at **16.9%**. All three were wrong at the time of writing or have since moved — `command.js` is at 41.5%. Re-measure before planning; the command is in *Key commands* below.

Strict, over the two files already converted: `idCardHandler.ts` **7** errors, `state.ts` **4**. Neither is in `.migration/strict-adopted.txt`.

## Slices

Conversions and spec efforts stay in **separate PRs** — that is [step 09](09-sprint-6-core-ii.md)'s lesson, paid for once already.

| # | Content | Lines | Why this grouping |
|---|---|---:|---|
| **J0** ✅ | Spec effort: `command.js` (41.5% → **98.8%**) and `workers/IDCardRenewer.js` (73.1% → **85.4%**) | 428 | Both are under the 80% gate, so converting them first fails CI on a coverage number that has nothing to do with the conversion. Specs first, then J3 converts them with the gate already green. **Not "in JS" for both** — see *What J0 found about its own premise* below. |
| **J1** ✅ | `index.js` + `publisher.js` | 410 | The two leaves. `index.js` is 24 lines; `publisher.js` is the layer's write side and is gate-safe. **It also produced [TD-65](../type-debt-register.md#td-65)** — see *What J1 found* below. |
| **J2** | `subscriber.js` | 793 | Holds [TD-58](../type-debt-register.md#td-58)'s fixed counter. The read side of the same protocol as J1 — convert it next while the shapes are fresh. |
| **J3** | `node.js` + the two files J0 covered | 1 640 | `node.js` is the membership logic and the largest file in the sprint. |
| **J4** | Adoption sweep: `state.ts`, `idCardHandler.ts` and whatever J1–J3 left, into `strict-adopted.txt` | — | 11 known errors on the two existing TS files, plus 4 of [TD-62](../type-debt-register.md#td-62)'s `null` declarations in `idCardHandler.ts`. |

## Definition of done, per PR

The standing list is [ADR § Conversion standards](../ADR-0001-migration-typescript.md#conversion-standards-per-file). What this sprint adds:

- **Report the strict count.** `bash scripts/strict-check.sh --count <converted files>`; either adopt them, or state per file how many errors remain **and which are guards the runtime can reach**. Those are a bug list, not a typing chore. `pr-preflight.sh` prints the numbers and will warn if the PR converts a file it does not adopt.
- **Anything the compiler flags about membership is a TD, not a cast.** This layer is where [TD-33](../type-debt-register.md#td-33) lives; a diagnostic here is evidence, and the two previous sprints show what silencing one costs.
- Run the impacted specs **in Docker** (`.ci/scripts/docker-test.sh unit mocha` / `unit vitest`) — the native `re2` binding cannot load on host arm64.

## Risks

- **TD-33 will interleave with this sprint's own CI** — it already has, on this step's own PR ([#2767](https://github.com/kuzzleio/kuzzle/pull/2767), a docs-only change, four ES 8 jobs down). Two attributable occurrences now exist, and together they say: *one node's publisher drops exactly **one** message at formation, right after the handshakes complete, and every node that reads it self-evicts.* **Look at `publisher.js`, not at the membership logic** — and not at one node's configuration either: the seventh occurrence's culprit was `kuzzle_node_prod`, the eighth's was `kuzzle_node_2`, with `prod` among its victims. Two further leads from the eighth: it was **4-for-4 on ES 8 while every ES 7 variant passed**, and a node that has already self-evicted goes on to print *"Kuzzle is ready"* 2.5 s later — so `Node.init()`'s wait is satisfied by a node that has left the cluster. Both diagnostics that made any of this readable — [TD-58](../type-debt-register.md#td-58)'s counter and [TD-59](../type-debt-register.md#td-59)'s single node id — landed before this sprint opened, on purpose.
- **`node.js` at 1 212 lines will re-score as new code** in SonarCloud, so pre-existing S3776/S2004 smells in it become blocking. Gate-driven refactors are in scope under the usual two conditions (verbatim extraction + an equivalence note), and note what [step 09](09-sprint-6-core-ii.md) learned: lifting a function out *whole* **moves** its cognitive complexity rather than reducing it.
- **`command.js` is the process-boundary file.** Its 41.5% is not an oversight — it forks workers — so J0 should establish what is worth asserting before assuming the number can reach 80%. If it cannot, the honest move is `.migration/coverage-exempt.txt` with the reason on the line, which is what that file is for ([TD-42](../type-debt-register.md#td-42)).

## Key commands

```bash
# Re-measure coverage the way the gate does (line + branch, merged):
docker compose -f docker-compose.yml run --rm --no-deps node \
  bash -lc "npm run test:unit:mocha:coverage"
# then read coverage/mocha/lcov.info — (LH+BRH)/(LF+BRF) per file.

bash scripts/strict-check.sh --count lib/cluster/node.ts   # the number the DoD wants
bash scripts/strict-check.sh --count                       # every unadopted file, ranked
npm run ratchet                                            # js must drop; no counter may rise
```

---

## What J0 found about its own premise

The slice table said *"specs first, in JS against the current files"*. Half of that was wrong, and the other half was impossible for a different reason than the one assumed.

### `command.js` — the spec already existed and counted for nothing

`tests/cluster/command.test.ts` has existed, and passed, since before this sprint opened. It contributed **zero** to the gate: `prepare-coverage.ts`'s mirror convention resolved a spec's target as `lib/<path>.ts` or `lib/<path>/index.ts` and never tried `.js`, so `command.js` was not handed to the vitest report and its mocha record stood.

That is [TD-64](../type-debt-register.md#td-64) ([#2771](https://github.com/kuzzleio/kuzzle/issues/2771)), and it is this slice's own premise: **J0 exists to make specs count before a rename, and the pipeline only counted them after one.** Fixed by trying `.js` targets too — one file affected today.

It also corrects a number this step carried. `command.js` reads **41.5%** raw and **16.9%** normalised, and the gate sees the normalised figure; the ⚠️ note above recorded 41.5% as the correction to an earlier 16.9%, but those are the same mocha measurement before and after normalisation. Measured by the runner that owns its spec, the file is now **98.8%**.

So `command.js`'s specs are **vitest**, extended from 3 tests to 10: `init`, `dispose`, all three `listen` topics against a real server, `getFullState`'s success path and `broadcastHandshake`. The sockets are real — `zeromq` is reached through a CommonJS `require` that vitest cannot intercept, and this file *is* the request/response boundary, so a mocked socket would assert the shape of the mock.

### `workers/IDCardRenewer.js` — cannot have a vitest spec at all yet

It `require()`s `lib/service/cache/redis.ts`. That is [TD-49](../type-debt-register.md#td-49) exactly: a CommonJS `require` of a converted module leaves a runtime call Node's resolver cannot satisfy for a `.ts` path, and vitest fails to load the file before a single test runs. TD-49 fixed the 25 such imports *in `lib/`* by rewriting them as `import`; this one cannot be, because the importing file is still JavaScript.

**A not-yet-converted file can be specced in vitest only if its dependencies are still resolvable at runtime.** `command.js` qualifies (zeromq, protobufjs, bluebird — all real packages); `IDCardRenewer.js` does not. Its coverage therefore comes from its existing **mocha** spec, extended in place — no new `test/**/*.test.js` file, so the mocha ratchet is untouched at 149 — and it converts to vitest in J3, when the rename makes `import` available.

### And it found a defect, which is the point of the exercise

[TD-63](../type-debt-register.md#td-63) ([#2770](https://github.com/kuzzleio/kuzzle/issues/2770)): `IDCardRenewer` reports a redis connection failure to `this.parentPort`, which nothing ever assigns — the `worker_threads` API in a file spawned with `fork()`, where every other line uses `process.send`. The node is still evicted, by the parent's `close` handler, but with *"ID Card renewer worker closed unexpectedly"* instead of the redis error. Pinned by the spec, filed, and left for its own PR.

The tell was in the old spec: it set `idCardRenewer.parentPort = { postMessage: sinon.stub() }` by hand, exactly as `http.test.js` set `httpWs.maxFormFileSize = 2` for [TD-52](../type-debt-register.md#td-52).

---

## What J1 found

### `index.js` and `publisher.js` convert without a behaviour change

Both become `export =`, which preserves the CommonJS shape the package has always exported: `require("lib/cluster")` is still the `ClusterNode` class, `require("lib/cluster/publisher")` still `ClusterPublisher`. `bin/` and plugins `require()` these paths directly, so a default export would have been a breaking change disguised as a conversion. Verified against the build, not only the types.

The `js` ratchet drops **11 → 9**; no other counter moves; mocha stays at **3058** and vitest at **233**, the same numbers `2-dev` produces — the conversion adds and loses no test.

**Strict:** `index.ts` is adopted. `publisher.ts` leaves **2**, and both are the same kind:

| Line | Error | Reachable? |
|---|---|---|
| `send()`'s `this.protoroot.lookupType` | `TS2531: Object is possibly 'null'` | No — `init()` assigns `socket` then awaits `protobuf.load`, so the window exists, but `node.init()` awaits `publisher.init()` before any event that can call `send()` is registered. |
| `bufferSend()`'s `this.socket.send` | `TS2531: Object is possibly 'null'` | No — `dispose()` waits for `state === READY`, i.e. for the buffer to drain, before nulling the socket. |

Both express the same unstated fact: `socket` and `protoroot` are assigned together and only `init()` may do it. They become *checkable* rather than asserted in **J3**, when `node.js` is converted and the call order is expressed in types — so they are reported here rather than silenced with a `!`.

Two errors were fixed rather than reported: `noUncheckedIndexedAccess` on `bufferSend`'s index loop, replaced by a `for…of` over the same local snapshot (`_buffer` is never mutated in place — `this.buffer` is reassigned to a new array).

**And a JSDoc type was wrong**, which is [step 09](09-sprint-6-core-ii.md)'s lesson arriving on schedule: `bufferSend`'s `@param {Buffer} data` is protobuf's `finish()` output, a `Uint8Array`. It had said `Buffer` for as long as the file was JavaScript, and nothing could contradict it.

### TD-65 — the risk section said to look at `publisher.js`, and looking at it found the mechanism

This step's *Risks* said: *one node's publisher drops exactly one message at formation, and every node that reads it self-evicts — look at `publisher.js` as a file, not at one node's config.* Converting it made the reason legible, and it is not in `publisher.js` at all: it is in **which socket carries which fact**.

The publisher binds `PUB` on `ports.sync`; `command.js` binds on `ports.command`. `node.js`'s `handshake()` subscribes on the **sync** channel (step 1), then reads each node's `lastMessageId` over the **command** channel (step 2), then tells the subscriber to resume from it (step 4). ZeroMQ registers a subscription by sending it to the publisher, which does the filtering — so until it arrives, the remote `PUB` **silently drops** what it publishes. Nothing orders that arrival before the snapshot: they travel on different sockets.

Every message published between the snapshot and the subscription registering is therefore lost, and the subscriber has been told to expect the first of them. One heartbeat is usually all that fits in the window, which is why the count is always **1**, why any node can play the culprit, and why it is four-for-four on ES 8 in one run and absent in the next.

Filed as [TD-65](../type-debt-register.md#td-65) ([#2773](https://github.com/kuzzleio/kuzzle/issues/2773)), **not fixed here** — the fix changes cluster formation and gets its own PR. [TD-33](../type-debt-register.md#td-33)'s remaining half now has a named mechanism and an experiment that would confirm it.

### TD-66 — the DoD reminder was blind in the state it is run in

[TD-61](../type-debt-register.md#td-61)'s strict-count reminder printed `[OK] no .js -> .ts conversion in this branch` for this very slice, because it diffs `"$base_ref"...HEAD` — committed history only — while the coverage reminder ten lines above it unions the working tree and the index too. Committing the same tree made it fire correctly. [TD-66](../type-debt-register.md#td-66) ([#2774](https://github.com/kuzzleio/kuzzle/issues/2774)); [TD-60](../type-debt-register.md#td-60) was this same script reading the wrong base, this is it reading the wrong range.

### TD-67 — the CI failure on J1's own PR was the evidence TD-65 needed

`Functional tests (http, 24, 8)` failed on this PR, and the log is the first in nine TD-33 occurrences to connect the lost message to the failing assertion without inference:

```
14:01:46.507  node_1  Successfully completed the handshake with node knode-solid-peacock-99998
14:01:47.276  node_2  ERROR Node out-of-sync: 1 messages lost from node knode-solid-peacock-99998
14:01:47.280  node_1  WARN  Node "knode-wrathful-potamoi-85816" evicted. Reason: …1 messages lost…
14:02:19              ✖ Given an existing collection "nyc-open-data":"yellow-taxi"
                        Error: Index nyc-open-data does not exist
```

`kuzzle_node_2` **is** `knode-wrathful-potamoi-85816`, one message lost **0.8 s after a handshake** — the window [TD-65](../type-debt-register.md#td-65) describes.

And it **never shut down**: evicted from every peer at 14:01:47, it answered HTTP behind nginx for the next 33 seconds from state that had stopped advancing. `evictSelf` broadcasts `NodeEvicted` naming itself, and a ZeroMQ `PUB` does not loop back, so the `global.kuzzle.shutdown()` branch written for that case is unreachable by the one node that needs it. The gap is never resynced either, so the same drop re-reported nine times in five seconds.

**It reproduced on the next run, on the same variant with different actors** — node_1 as victim, `knode-jaded-prokofiev-65530` as source — which rules out a property of one container, and the second log is the sharper one: the gap is reported **2 ms before** the handshake with that node is declared successful. `node.js` calls `subscriber.sync(...)` **without awaiting it**, so the gap is found inside `sync()`'s buffer replay, against messages the subscriber had already captured. The earliest buffered message is `N+2` where the snapshot said `N` — [TD-65](../type-debt-register.md#td-65)'s prediction, observed. Two failures, both on `http, 24, 8`, every other ES 8 variant green: worth checking next occurrence rather than concluding from two.

Filed as [TD-67](../type-debt-register.md#td-67) ([#2776](https://github.com/kuzzleio/kuzzle/issues/2776)). **Neither is caused by this PR** — the conversion changes no runtime behaviour, and both files are byte-equivalent in what they execute. What J1 changed is that the layer is now readable.

### What SonarCloud charged for the rename

Two major violations, both rules that can only fire on TypeScript, on code the conversion did not write — the *Risks* section predicted this for `node.js` and it arrived on a 386-line file first:

- `S2933` — `node` is assigned once in the constructor → `readonly`.
- `S6661` — `Object.assign({ messageId }, data)` → `{ messageId, ...data }`. Equivalent: both copy `data`'s own enumerable properties over a fresh literal in the same order.

Worth carrying into J2 and J3: **budget for TS-only rules on every converted file**, not only for the pre-existing complexity smells the risk section named.
