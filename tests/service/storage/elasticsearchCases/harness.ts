/**
 * The fixture every `elasticsearch` case group is built on.
 *
 * The subject is `lib/service/storage/Elasticsearch.ts` — a dispatcher that
 * reads `config.majorVersion` and delegates everything to `ES7` or `ES8`. So
 * the two Mocha twins are not two specs: they are the same spec run with one
 * config value changed, which is why the cases below are shared and the
 * version arrives as a parameter.
 *
 * What is *not* shared is the wire format, which is stated in
 * {@link ESEnvelope} and read by the cases rather than hidden from them.
 */
import { afterEach, beforeEach, expect, vi } from "vitest";

import { loadConfig } from "../../../../lib/config";
import { Elasticsearch } from "../../../../lib/service/storage/Elasticsearch";
import { storeScopeEnum } from "../../../../lib/core/storage/storeScopeEnum";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";
import {
  stubESClient,
  type ESClientStub,
} from "../../../mocks/elasticsearchClient";
import { ENVELOPES, type ESEnvelope } from "./envelope";

export type ESVersion = "7" | "8";

/** The `_esWrapper` the subject reaches for on every client rejection. */
export interface ESWrapperStub {
  reject: ReturnType<typeof vi.fn>;
  formatESError: ReturnType<typeof vi.fn>;
}

export interface ESHarness {
  /** The dispatcher. Every case drives `harness.es.client`, the real ES7/ES8. */
  es: Elasticsearch;
  /** Shorthand for `es.client` — what all 54 action blocks actually call. */
  client: any;
  clientStub: ESClientStub;
  esWrapper: ESWrapperStub;
  envelope: ESEnvelope;
  /** The rejection every "if client fails" case arms and then asserts on. */
  esClientError: Error;
  /**
   * Frozen for the duration of a case: every write stamps `_kuzzle_info`
   * with `Date.now()`, and an assertion on the whole request has to name it.
   */
  timestamp: number;
  /**
   * The single request a client stub was given. Fails the case if the stub
   * was called any number of times other than once, so an assertion on the
   * request also states that exactly one was sent.
   */
  sent: (stub: { mock: { calls: unknown[][] } }) => any;
  /** Builds a second instance — `#constructor` is the only case that needs one. */
  build: (scope?: storeScopeEnum) => Elasticsearch;
  config: any;
  /**
   * `global.kuzzle.ask`. Every scroll-bearing action keeps its cursor in the
   * internal cache through this bus, so the cases both arm it and assert on
   * it. Armed per case rather than here: what a scroll answers *is* the case.
   */
  ask: ReturnType<typeof vi.fn>;
  /**
   * `global.kuzzle.config.limits`, the real defaults. `deleteByQuery`,
   * `updateByQuery` and `_mExecute` all read it, and the cases that pin a
   * limit write it here.
   */
  limits: any;
}

/**
 * Installs the fixture for the surrounding `describe` and answers a handle
 * whose fields are replaced on every `beforeEach`.
 */
export function setupElasticsearch(version: ESVersion): ESHarness {
  const envelope = ENVELOPES[version];

  const harness = { envelope } as ESHarness;

  beforeEach(async () => {
    /*
     * `ES7`'s constructor runs `_loadMsConfig`, which asserts that
     * `maxScrollDuration` and `defaults.scrollTTL` are present and parseable.
     * The route table in L3d's `router` port is the precedent: when the real
     * config is what the subject reads, inventing a fixture would be testing
     * the invention. Cloned because `loadConfig()` answers a singleton and
     * `majorVersion` is written on it.
     */
    const config = structuredClone(loadConfig());

    config.services.storageEngine.majorVersion = version;
    harness.config = config.services.storageEngine;
    harness.limits = config.limits;

    harness.ask = vi.fn(async () => undefined);

    /*
     * `hash` is the real Kuzzle's, reduced to what the subject uses it for:
     * a scroll id turned into a cache key. The cases never assert the digest,
     * only that the key a `store` used is the key the matching `del` deletes,
     * so an identity is enough and a stable one keeps the failure readable.
     */
    stubKuzzle({ ask: harness.ask, config, hash: (value: unknown) => value });

    harness.timestamp = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(harness.timestamp);

    harness.esClientError = new Error("es client fail");

    harness.sent = (stub) => {
      expect(stub.mock.calls).toHaveLength(1);

      return stub.mock.calls[0][0];
    };

    harness.build = (scope = storeScopeEnum.PUBLIC) => {
      const built = new Elasticsearch(harness.config, scope);

      /*
       * ⚠️ Assigning `_client` before `init()` is not a shortcut, it is the
       * only way in: `_initSequence` builds a **real** `Client` from
       * `config.client` and then waits for a live cluster. Its first line is
       * `if (this._client) { return; }`, so a preset client is what makes the
       * sequence a no-op.
       */
      built.client._client = stubESClient();

      return built;
    };

    harness.es = harness.build();
    harness.clientStub = harness.es.client._client;
    harness.client = harness.es.client;

    await harness.es.init();

    /*
     * `_initSequence` returned early (see above), so the real wrapper was
     * never built. Both halves are spied: `reject` re-rejects so a caller's
     * `await` still throws, and `formatESError` passes the error through so
     * the "if client fails" cases can assert on the identity they armed.
     */
    harness.esWrapper = {
      reject: vi.fn((error: unknown) => Promise.reject(error)),
      formatESError: vi.fn((error: unknown) => error),
    };
    harness.client._esWrapper = harness.esWrapper;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreKuzzle();
  });

  return harness;
}
