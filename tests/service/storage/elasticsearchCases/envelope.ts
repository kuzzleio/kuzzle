/**
 * The whole ES 7 ↔ ES 8 wire delta, in one place.
 *
 * ## Why this file exists
 *
 * `test/service/storage/elasticsearch-7.test.js` and `-8.test.js` are 6 293
 * and 6 138 lines and hold the same 54 action blocks, in the same order, with
 * the same names. Measured per block on non-blank lines, **4.6% of them
 * diverge** — 499 lines out of 5 392 — and 11 of the 54 blocks are
 * byte-identical.
 *
 * Every one of those divergences is the transport, not the behaviour:
 *
 * | | ES 7 | ES 8 |
 * | --- | --- | --- |
 * | response | `{ body: payload }` | `payload` |
 * | request payload | `body: { … }` | `…` at the root |
 * | document body | `body: { … }` | `document: { … }` |
 * | total-hits flag | `trackTotalHits` | `track_total_hits` |
 * | `_source` filter | `"true"` | `true` |
 *
 * ## Why it is a table rather than a helper
 *
 * The obvious move — after [L1b4](../../../../docs/adr-001/steps/13-sprint-10-test-closure.md#the-es-twins-one-body-two-mirrors-no-duplication)'s
 * four-line `esWrapper` mirrors — is to hide the difference behind a helper
 * and share the cases. But the envelope *is* what distinguishes ES 7 from
 * ES 8: hide it and the suite stops asserting the one thing these two
 * subjects do not agree on.
 *
 * So the cases are shared and the delta is a **value they read**, named and
 * collected here. A reader sees the entire ES 7/ES 8 difference on one screen
 * instead of diffing 205 hunks across 12 431 lines, and each version's spec
 * still pins its own wire format — because the table is what the assertion
 * runs through, not something the assertion skips.
 *
 * Two independent ports were the alternative and are ruled out: 95% copy in
 * front of SonarCloud, and [TD-23](../../../../docs/adr-001/type-debt-register.md#td-23)
 * says `sonar.cpd.exclusions` may only shrink.
 */
import type { JSONObject } from "kuzzle-sdk";

export interface ESEnvelope {
  readonly version: "7" | "8";

  /**
   * What the client answers for a given payload. ES 7's transport wraps every
   * response in `body`; ES 8's returns it flat.
   */
  respond<T>(payload: T): T | { body: T };

  /**
   * How a request payload is carried. ES 7 nests it under `body`; ES 8 puts
   * it at the root.
   *
   * ⚠️ Named `searchRequest` in L5a, when `search` was the only case in sight.
   * L5b found the same nesting on `count`'s filter and on `update`'s
   * `doc`/`upsert` pair, so it is the general rule and not a search one.
   */
  request(payload: JSONObject): JSONObject;

  /**
   * How a single document's content is carried in a write request. ES 7 calls
   * it `body`, ES 8 calls it `document`.
   */
  documentRequest(document: JSONObject): JSONObject;

  /**
   * The flag that asks for an exact hit total. Renamed to snake_case in the
   * ES 8 client.
   */
  readonly trackTotalHits: "trackTotalHits" | "track_total_hits";

  /**
   * The value `_source` takes when a spec asks for the whole source. The ES 7
   * client accepted the string; ES 8 takes the boolean.
   */
  readonly sourceEnabled: "true" | true;
}

export const ES7_ENVELOPE: ESEnvelope = {
  version: "7",
  respond: (payload) => ({ body: payload }),
  request: (payload) => ({ body: payload }),
  documentRequest: (document) => ({ body: document }),
  trackTotalHits: "trackTotalHits",
  sourceEnabled: "true",
};

export const ES8_ENVELOPE: ESEnvelope = {
  version: "8",
  respond: (payload) => payload,
  request: (payload) => ({ ...payload }),
  documentRequest: (document) => ({ document }),
  trackTotalHits: "track_total_hits",
  sourceEnabled: true,
};

export const ENVELOPES: Record<"7" | "8", ESEnvelope> = {
  7: ES7_ENVELOPE,
  8: ES8_ENVELOPE,
};
