/**
 * L5b — the eight single-document actions: `get`, `count`, `create`,
 * `createOrReplace`, `update`, `upsert`, `replace`, `delete`.
 *
 * Every one of the Mocha twins' assertions here was `calledWithMatch`, a
 * *partial* match — the idiom [L3f](../../../../docs/adr-001/steps/13-sprint-10-test-closure.md#calledwithmatch-is-partial-and-five-things-were-hiding-in-the-gap)
 * showed is where behaviour hides. These cases assert the **whole** request
 * the subject sends, through {@link ESHarness.sent}, so the `_kuzzle_info`
 * stamping each action does is stated rather than sampled. Doing that
 * immediately showed that `create`, `createOrReplace` and `replace` answer
 * `_source: esRequest.body` — the document they *sent*, stamp included — and
 * not what Elasticsearch echoed back.
 *
 * ⚠️ **Filed, not fixed** (this is a porting slice): `esRequest.body = content`
 * followed by `esRequest.body._kuzzle_info = …` writes the stamp onto the
 * **caller's own object**, so a caller's document comes back mutated.
 */
import { describe, expect, it } from "vitest";

import type { ESHarness } from "./harness";

const index = "nyc-open-data";
const collection = "yellow-taxi";
const alias = "@&nyc-open-data.yellow-taxi";

export function describeCrud(harness: ESHarness) {
  /** The retry count the subject falls back to, from the real config. */
  const defaultRetries = () => harness.config.defaults.onUpdateConflictRetries;

  describe("#get", () => {
    it("reads one document from the alias", async () => {
      harness.clientStub.get.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _source: { city: "Kathmandu" },
          _version: 1,
        }),
      );

      expect(await harness.client.get(index, collection, "liia")).toEqual({
        _id: "liia",
        _source: { city: "Kathmandu" },
        _version: 1,
      });

      expect(harness.sent(harness.clientStub.get)).toMatchObject({
        index: alias,
        id: "liia",
      });
    });

    /*
     * `_search` is a route, not an id: `GET /:index/:collection/_search` would
     * otherwise be read as a document fetch. The guard is in the subject, so
     * the client is never reached.
     */
    it("refuses `_search` as a document id, without asking the client", async () => {
      await expect(
        harness.client.get(index, collection, "_search"),
      ).rejects.toMatchObject({ id: "services.storage.search_as_an_id" });

      expect(harness.clientStub.get).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.get.mockRejectedValue(harness.esClientError);

      await expect(harness.client.get(index, collection, "liia")).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#count", () => {
    it("answers the count alone, not the client's envelope", async () => {
      const filter = { query: { match_all: {} } };

      harness.clientStub.count.mockResolvedValue(
        harness.envelope.respond({ count: 42 }),
      );

      expect(await harness.client.count(index, collection, filter)).toBe(42);

      expect(harness.sent(harness.clientStub.count)).toEqual({
        index: alias,
        ...harness.envelope.request(filter),
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.count.mockRejectedValue(harness.esClientError);

      await expect(harness.client.count(index, collection)).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#create", () => {
    it("creates under a given id, and refuses to overwrite", async () => {
      harness.clientStub.index.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _source: { city: "Kathmandu" },
          _version: 1,
        }),
      );

      expect(
        await harness.client.create(
          index,
          collection,
          { city: "Kathmandu" },
          { id: "liia", refresh: "wait_for", userId: "aschen" },
        ),
      ).toEqual({
        _id: "liia",
        /*
         * ⚠️ Not what the client answered. `_source` is `esRequest.body` —
         * the document that was *sent*, stamp included — so the caller sees
         * metadata Elasticsearch never echoed back. The Mocha twins asserted
         * this with a partial match and so never showed the `_kuzzle_info`
         * in it.
         */
        _source: {
          city: "Kathmandu",
          _kuzzle_info: {
            author: "aschen",
            createdAt: harness.timestamp,
            updatedAt: null,
            updater: null,
          },
        },
        _version: 1,
      });

      /*
       * `op_type: "create"` is what makes this fail on a collision rather
       * than replace — the one thing that distinguishes `create` from
       * `createOrReplace` on the wire.
       */
      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        index: alias,
        id: "liia",
        refresh: "wait_for",
        op_type: "create",
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: {
            author: "aschen",
            createdAt: harness.timestamp,
            updatedAt: null,
            updater: null,
          },
        }),
      });
    });

    it("lets Elasticsearch allocate the id when none is given", async () => {
      harness.clientStub.index.mockResolvedValue(
        harness.envelope.respond({
          _id: "mehry",
          _source: { city: "Panipokari" },
          _version: 1,
        }),
      );

      expect(
        await harness.client.create(index, collection, { city: "Panipokari" }),
      ).toEqual({
        _id: "mehry",
        _source: {
          city: "Panipokari",
          _kuzzle_info: {
            author: null,
            createdAt: harness.timestamp,
            updatedAt: null,
            updater: null,
          },
        },
        _version: 1,
      });

      const sent = harness.sent(harness.clientStub.index);

      /*
       * No id to send, so `op_type` drops back to the one that allocates one.
       * The `id` key is still on the request, holding `undefined` — the
       * subject builds the object with `id` in it either way and lets the
       * client drop it.
       */
      expect(sent).toMatchObject({ index: alias, op_type: "index" });
      expect(sent.id).toBeUndefined();
    });
  });

  describe("#createOrReplace", () => {
    const armIndex = () =>
      harness.clientStub.index.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _source: { city: "Kathmandu" },
          _version: 1,
          result: "created",
        }),
      );

    it("stamps both halves of `_kuzzle_info` at once", async () => {
      armIndex();

      /*
       * `create` stamps only the author half and `update` only the updater
       * half; this action writes a whole document, so it stamps both — and
       * `created` comes from the client's `result`, not from the request.
       */
      expect(
        await harness.client.createOrReplace(
          index,
          collection,
          "liia",
          { city: "Kathmandu" },
          { refresh: "wait_for", userId: "aschen" },
        ),
      ).toEqual({
        _id: "liia",
        _source: {
          city: "Kathmandu",
          _kuzzle_info: {
            author: "aschen",
            createdAt: harness.timestamp,
            updatedAt: harness.timestamp,
            updater: "aschen",
          },
        },
        _version: 1,
        created: true,
      });

      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        index: alias,
        id: "liia",
        refresh: "wait_for",
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: {
            author: "aschen",
            createdAt: harness.timestamp,
            updatedAt: harness.timestamp,
            updater: "aschen",
          },
        }),
      });
    });

    it("sends the body untouched when told not to inject metadata", async () => {
      armIndex();

      await harness.client.createOrReplace(
        index,
        collection,
        "liia",
        { city: "Kathmandu" },
        { injectKuzzleMeta: false },
      );

      /*
       * The Mocha twins asserted `_kuzzle_info: undefined` under a partial
       * match, which is satisfied by a body that has no such key *and* by one
       * that has it set to `undefined`. What the option means is that the key
       * is not there at all.
       */
      expect(harness.sent(harness.clientStub.index)).toMatchObject(
        harness.envelope.documentRequest({ city: "Kathmandu" }),
      );
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.index.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.createOrReplace(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#update", () => {
    const armUpdate = () =>
      harness.clientStub.update.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _version: 1,
          get: { _source: { city: "Panipokari" } },
        }),
      );

    it("sends a partial document and answers the merged one", async () => {
      armUpdate();

      /*
       * The `_source` the caller gets back is the client's `get._source` —
       * the *merged* document, not the changes that were sent.
       */
      expect(
        await harness.client.update(index, collection, "liia", {
          city: "Panipokari",
        }),
      ).toEqual({
        _id: "liia",
        _version: 1,
        _source: { city: "Panipokari" },
      });

      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        index: alias,
        id: "liia",
        retry_on_conflict: defaultRetries(),
        ...harness.envelope.request({
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: harness.timestamp,
              updater: null,
            },
          },
        }),
      });
    });

    it("carries refresh, user and retry count when given", async () => {
      armUpdate();

      await harness.client.update(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "aschen", retryOnConflict: 42 },
      );

      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        index: alias,
        id: "liia",
        refresh: "wait_for",
        _source: harness.envelope.sourceEnabled,
        retry_on_conflict: 42,
        ...harness.envelope.request({
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: harness.timestamp,
              updater: "aschen",
            },
          },
        }),
      });
    });

    /*
     * `retryOnConflict: null` is not `undefined`: a default parameter would
     * not apply, so the subject has to fall back explicitly. The case exists
     * because that fallback is easy to write as `?? ` and easy to lose.
     */
    it("falls back to the configured retry count on an explicit null", async () => {
      armUpdate();

      await harness.client.update(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "oh noes", retryOnConflict: null },
      );

      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        retry_on_conflict: defaultRetries(),
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.update.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.update(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#upsert", () => {
    const armUpsert = (result: string, version: number) =>
      harness.clientStub.update.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _version: version,
          result,
          get: { _source: { city: "Panipokari" } },
        }),
      );

    it("sends the changes as `doc` and the creation stamp as `upsert`", async () => {
      armUpsert("updated", 2);

      expect(
        await harness.client.upsert(index, collection, "liia", {
          city: "Panipokari",
        }),
      ).toEqual({
        _id: "liia",
        _version: 2,
        _source: { city: "Panipokari" },
        created: false,
      });

      /*
       * The two halves of `_kuzzle_info` go to two different places: the
       * updater half onto the document that already exists, the author half
       * onto the one Elasticsearch would create instead.
       */
      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        index: alias,
        id: "liia",
        retry_on_conflict: defaultRetries(),
        ...harness.envelope.request({
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: harness.timestamp,
              updater: null,
            },
          },
          upsert: {
            _kuzzle_info: {
              author: null,
              createdAt: harness.timestamp,
            },
          },
        }),
      });
    });

    it("merges default values into the creation branch only", async () => {
      armUpsert("updated", 2);

      await harness.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { defaultValues: { oh: "noes" } },
      );

      const sent = harness.sent(harness.clientStub.update);
      const payload = harness.envelope.version === "7" ? sent.body : sent;

      expect(payload.upsert).toMatchObject({ oh: "noes" });
      // The defaults are for a document that does not exist yet, so they must
      // not reach the partial update applied to one that does.
      expect(payload.doc).not.toHaveProperty("oh");
    });

    it("reports `created: true` when the client says it created one", async () => {
      armUpsert("created", 1);

      expect(
        await harness.client.upsert(
          index,
          collection,
          "liia",
          { city: "Panipokari" },
          { defaultValues: { oh: "noes" } },
        ),
      ).toEqual({
        _id: "liia",
        _version: 1,
        _source: { city: "Panipokari" },
        created: true,
      });
    });

    it("carries refresh, user and retry count when given", async () => {
      armUpsert("updated", 2);

      await harness.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "aschen", retryOnConflict: 42 },
      );

      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        refresh: "wait_for",
        _source: harness.envelope.sourceEnabled,
        retry_on_conflict: 42,
        ...harness.envelope.request({
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: harness.timestamp,
              updater: "aschen",
            },
          },
          upsert: {
            _kuzzle_info: {
              author: "aschen",
              createdAt: harness.timestamp,
            },
          },
        }),
      });
    });

    it("falls back to the configured retry count on an explicit null", async () => {
      armUpsert("updated", 2);

      await harness.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "oh noes", retryOnConflict: null },
      );

      expect(harness.sent(harness.clientStub.update)).toMatchObject({
        retry_on_conflict: defaultRetries(),
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.update.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.upsert(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#replace", () => {
    const armReplace = (exists = true) => {
      harness.clientStub.index.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _source: { city: "Kathmandu" },
          _version: 1,
        }),
      );
      harness.clientStub.exists.mockResolvedValue(
        harness.envelope.respond(exists),
      );
    };

    it("overwrites the whole document and stamps both halves", async () => {
      armReplace();

      expect(
        await harness.client.replace(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).toEqual({
        _id: "liia",
        _source: {
          city: "Kathmandu",
          _kuzzle_info: {
            author: null,
            createdAt: harness.timestamp,
            updatedAt: harness.timestamp,
            updater: null,
          },
        },
        _version: 1,
      });

      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        index: alias,
        id: "liia",
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: {
            author: null,
            createdAt: harness.timestamp,
            updatedAt: harness.timestamp,
            updater: null,
          },
        }),
      });
    });

    it("carries refresh and user when given", async () => {
      armReplace();

      await harness.client.replace(
        index,
        collection,
        "liia",
        { city: "Kathmandu" },
        { refresh: "wait_for", userId: "aschen" },
      );

      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        refresh: "wait_for",
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: {
            author: "aschen",
            createdAt: harness.timestamp,
            updatedAt: harness.timestamp,
            updater: "aschen",
          },
        }),
      });
    });

    /*
     * ⚠️ The Mocha twins named this one "should throw a NotFoundError
     * Exception if document already exists" — the opposite of what it sets up
     * and of what it asserts. `replace` refuses to *create*: it checks
     * existence first and stops there.
     */
    it("refuses to create a document that is not there", async () => {
      armReplace(false);

      await expect(
        harness.client.replace(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejects.toMatchObject({ id: "services.storage.not_found" });

      expect(harness.clientStub.index).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      armReplace();
      harness.clientStub.index.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.replace(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#delete", () => {
    const armDelete = () =>
      harness.clientStub.delete.mockResolvedValue(
        harness.envelope.respond({ _id: "liia" }),
      );

    it("deletes by id and answers null rather than the client's report", async () => {
      armDelete();

      expect(await harness.client.delete(index, collection, "liia")).toBeNull();

      expect(harness.sent(harness.clientStub.delete)).toMatchObject({
        index: alias,
        id: "liia",
      });
    });

    it("carries refresh when given", async () => {
      armDelete();

      await harness.client.delete(index, collection, "liia", {
        refresh: "wait_for",
      });

      expect(harness.sent(harness.clientStub.delete)).toMatchObject({
        index: alias,
        id: "liia",
        refresh: "wait_for",
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.delete.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.delete(index, collection, "liia"),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });
}
