/**
 * L5d — the eleven index- and collection-lifecycle blocks: `createIndex`,
 * `createCollection`, `getMapping`, `updateCollection`, `updateMapping`,
 * `updateSettings`, `updateSearchIndex`, `truncateCollection`, `import`,
 * `_createHiddenCollection` and `_checkMappings`.
 *
 * The largest group of the five by line count and the plainest by content:
 * every ES 7 ↔ ES 8 divergence in it was already in the
 * {@link ESEnvelope} table before the slice started, bar one — the
 * `wait_for_active_shards` a single-node cluster asks for, `"1"` against `1`.
 *
 * Two things are stubbed here that are not stubbed elsewhere:
 *
 * - **The `Mutex`.** `createCollection` and `_createHiddenCollection` each
 *   take one, and a real one asks the cache bus in a retry loop. It is not
 *   the subject; the cases assert that it is taken and released.
 * - **The seams these actions stand on** — `hasCollection`,
 *   `deleteCollection`, `_getAvailableIndice`, `_getIndice` — each of which
 *   has its own block in `inventory.ts` (L5a). Everything below them is the
 *   real client stub.
 */
import { describe, expect, it, vi } from "vitest";

import { Mutex } from "../../../../lib/util/mutex";

import type { ESHarness } from "./harness";

const index = "nyc-open-data";
const collection = "yellow-taxi";
const alias = "@&nyc-open-data.yellow-taxi";
const indice = "&nyc-open-data.yellow-taxi";

export function describeLifecycle(harness: ESHarness) {
  /**
   * `createCollection` and `_createHiddenCollection` serialise themselves on
   * a Mutex whose real implementation polls the cache bus until it wins. The
   * lock is not what these cases are about — that it is taken and released
   * is, so both halves are spies rather than no-ops.
   */
  const stubMutex = () => ({
    lock: vi.spyOn(Mutex.prototype, "lock").mockResolvedValue(undefined),
    unlock: vi.spyOn(Mutex.prototype, "unlock").mockResolvedValue(undefined),
  });

  /**
   * How many nodes `cat.nodes` reports, which is the only thing
   * `_getWaitForActiveShards` reads: one node asks for one active shard, more
   * than one asks for `all`. The twins stubbed the method; arming the client
   * instead lets the case state the rule.
   */
  const armNodeCount = (nodes: number) =>
    harness.clientStub.cat.nodes.mockResolvedValue(
      harness.envelope.respond(new Array(nodes).fill({})),
    );

  describe("#createIndex", () => {
    const armExistingAliases = (aliases: string[]) =>
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond(aliases.map((name) => ({ alias: name }))),
      );

    it("creates the index's hidden collection, which is what makes it exist", async () => {
      armExistingAliases([alias, "@%nepali.liia"]);
      const hidden = vi
        .spyOn(harness.client, "_createHiddenCollection")
        .mockResolvedValue(undefined);

      expect(await harness.client.createIndex("lfiduras")).toBeNull();

      expect(hidden).toHaveBeenCalledWith("lfiduras");
    });

    /*
     * The error names the kind of index that is in the way, read off the
     * alias's prefix — `%` private, `&` public. `nepali` is only known here
     * through `@%nepali.liia`, so it is reported as private.
     */
    it("refuses an index name an alias already claims, naming its kind", async () => {
      armExistingAliases([alias, "@%nepali.liia"]);

      await expect(harness.client.createIndex("nepali")).rejects.toMatchObject({
        id: "services.storage.index_already_exists",
        message: expect.stringContaining("private"),
      });

      await expect(
        harness.client.createIndex("nyc-open-data"),
      ).rejects.toMatchObject({
        id: "services.storage.index_already_exists",
        message: expect.stringContaining("public"),
      });
    });

    it("refuses an invalid index name", async () => {
      vi.spyOn(harness.client, "isIndexNameValid").mockReturnValue(false);

      await expect(harness.client.createIndex("foobar")).rejects.toMatchObject({
        id: "services.storage.invalid_index_name",
      });

      expect(harness.clientStub.cat.aliases).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.cat.aliases.mockRejectedValue(harness.esClientError);

      await expect(harness.client.createIndex(index)).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#createCollection", () => {
    const arm = () => {
      stubMutex();
      armNodeCount(1);

      harness.clientStub.indices.create.mockResolvedValue(
        harness.envelope.respond({}),
      );

      vi.spyOn(harness.client, "hasCollection").mockResolvedValue(false);
      vi.spyOn(harness.client, "_hasHiddenCollection").mockResolvedValue(false);
      vi.spyOn(harness.client, "deleteCollection").mockResolvedValue(undefined);
      vi.spyOn(harness.client, "_getAvailableIndice").mockResolvedValue(indice);
    };

    /** The `indices.create` payload, whichever side of `body` it lives on. */
    const created = () => harness.sent(harness.clientStub.indices.create);

    const createdBody = () => {
      const sent = created();

      return harness.envelope.version === "7" ? sent.body : sent;
    };

    it("creates the indice, its alias, and the mappings merged with the common ones", async () => {
      arm();

      const result = await harness.client.createCollection(index, collection, {
        mappings: { properties: { city: { type: "keyword" } } },
        settings: { index: { blocks: { write: true } } },
      });

      expect(harness.client.hasCollection).toHaveBeenCalledWith(
        index,
        collection,
      );

      expect(created()).toMatchObject({
        index: indice,
        wait_for_active_shards: harness.envelope.singleShard,
      });

      expect(createdBody()).toMatchObject({
        aliases: { [alias]: {} },
        mappings: {
          dynamic: harness.config.commonMapping.dynamic,
          _meta: harness.config.commonMapping._meta,
          properties: { city: { type: "keyword" } },
        },
        settings: { index: { blocks: { write: true } } },
      });

      /* The action answers nothing at all — `null`, not the created index. */
      expect(result).toBeNull();
      expect(harness.client.deleteCollection).not.toHaveBeenCalled();
    });

    /*
     * An index exists because it holds `_kuzzle_keep` and nothing else. The
     * first real collection makes the placeholder pointless, so it goes —
     * under the lock, because two nodes may be here at once.
     */
    it("drops the index's placeholder collection once a real one arrives", async () => {
      arm();
      const mutex = stubMutex();
      harness.client._hasHiddenCollection.mockResolvedValue(true);

      await harness.client.createCollection(index, collection, {});

      expect(mutex.lock).toHaveBeenCalled();
      expect(mutex.unlock).toHaveBeenCalled();
      expect(harness.client._hasHiddenCollection).toHaveBeenCalledWith(index);
      expect(harness.client.deleteCollection).toHaveBeenCalledWith(
        index,
        "_kuzzle_keep",
      );
    });

    it("takes the caller's `dynamic` and `_meta` over the common ones", async () => {
      arm();

      await harness.client.createCollection(index, collection, {
        mappings: { dynamic: "true", _meta: { some: "meta" } },
      });

      expect(createdBody().mappings).toMatchObject({
        dynamic: "true",
        _meta: { some: "meta" },
        properties: harness.config.commonMapping.properties,
      });
    });

    /*
     * ⚠️ The merge is one-way: Kuzzle's own mapping wins over the caller's for
     * every field it declares, and the caller only gets to add. `gordon` is
     * declared `text` by the common mapping and `keyword` by the caller, and
     * comes out `text`.
     */
    it("never lets a caller redefine a field Kuzzle's common mapping declares", async () => {
      arm();
      harness.config.commonMapping = {
        dynamic: "false",
        properties: {
          gordon: { type: "text" },
          _kuzzle_info: {
            properties: {
              author: { type: "text" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
              updater: { type: "keyword" },
            },
          },
        },
      };

      await harness.client.createCollection(index, collection, {
        mappings: {
          properties: {
            gordon: { type: "keyword" },
            freeman: { type: "keyword" },
            _kuzzle_info: { properties: { author: { type: "keyword" } } },
          },
        },
      });

      expect(createdBody().mappings).toEqual({
        _meta: undefined,
        dynamic: "false",
        properties: {
          gordon: { type: "text" },
          freeman: { type: "keyword" },
          _kuzzle_info: {
            properties: {
              author: { type: "text" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
              updater: { type: "keyword" },
            },
          },
        },
      });
    });

    it("updates the collection instead when it is already there", async () => {
      arm();
      harness.client.hasCollection.mockResolvedValue(true);
      const update = vi
        .spyOn(harness.client, "updateCollection")
        .mockResolvedValue({});

      await harness.client.createCollection(index, collection, {
        mappings: { properties: { city: { type: "keyword" } } },
        settings: { index: { blocks: { write: true } } },
      });

      expect(update).toHaveBeenCalledWith(index, collection, {
        mappings: { properties: { city: { type: "keyword" } } },
        settings: { index: { blocks: { write: true } } },
      });
      expect(harness.clientStub.indices.create).not.toHaveBeenCalled();
    });

    describe("settings", () => {
      const defaults = { number_of_replicas: 42, number_of_shards: 66 };

      it("falls back to the configured defaults when none are given", async () => {
        arm();
        harness.config.defaultSettings = { ...defaults };

        await harness.client.createCollection(index, collection);

        expect(createdBody().settings).toEqual(defaults);
      });

      it("takes the caller's settings over them", async () => {
        arm();
        harness.config.defaultSettings = { ...defaults };

        await harness.client.createCollection(index, collection, {
          settings: { number_of_replicas: 1, number_of_shards: 2 },
        });

        expect(createdBody().settings).toEqual({
          number_of_replicas: 1,
          number_of_shards: 2,
        });
      });

      /* Field by field, not all-or-nothing. */
      it("completes a partial one from the defaults", async () => {
        arm();
        harness.config.defaultSettings = { ...defaults };

        await harness.client.createCollection(index, collection, {
          settings: { number_of_replicas: 1 },
        });

        expect(createdBody().settings).toEqual({
          number_of_replicas: 1,
          number_of_shards: 66,
        });
      });
    });

    it("waits for every shard when the cluster has more than one node", async () => {
      arm();
      armNodeCount(3);

      await harness.client.createCollection(index, collection);

      expect(created().wait_for_active_shards).toBe("all");
    });

    describe("mapping validation", () => {
      it("refuses a misspelled mapping property, and suggests the right one", async () => {
        arm();
        const mappings = {
          dinamic: "false",
          properties: { freeman: { type: "keyword" } },
        };

        global.NODE_ENV = "development";
        await expect(
          harness.client.createCollection(index, collection, { mappings }),
        ).rejects.toMatchObject({
          id: "services.storage.invalid_mapping",
          message:
            'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
        });

        /* The suggestion is a development affordance: production says less. */
        global.NODE_ENV = "production";
        await expect(
          harness.client.createCollection(index, collection, { mappings }),
        ).rejects.toMatchObject({
          message: 'Invalid mapping property "mappings.dinamic".',
        });
      });

      it("coerces a boolean `dynamic` to its string, and refuses anything else", async () => {
        arm();
        const checkMappings = vi.spyOn(harness.client, "_checkMappings");

        await harness.client.createCollection(index, collection, {
          mappings: { dynamic: true },
        });

        expect(checkMappings).toHaveBeenCalledWith(
          expect.objectContaining({ dynamic: "true" }),
        );

        await expect(
          harness.client.createCollection(index, collection, {
            mappings: { dynamic: null },
          }),
        ).rejects.toMatchObject({
          id: "services.storage.invalid_mapping",
          message: /Dynamic property value should be a string./,
        });

        await expect(
          harness.client.createCollection(index, collection, {
            mappings: {
              properties: {
                user: { properties: { metadata: { dynamic: "notTooMuch" } } },
              },
            },
          }),
        ).rejects.toMatchObject({
          id: "services.storage.invalid_mapping",
          message: /Incorrect dynamic property value/,
        });
      });
    });

    it("refuses an invalid index or collection name", async () => {
      arm();
      const validIndex = vi.spyOn(harness.client, "isIndexNameValid");

      validIndex.mockReturnValue(false);
      await expect(
        harness.client.createCollection("foo", "bar"),
      ).rejects.toMatchObject({ id: "services.storage.invalid_index_name" });

      validIndex.mockReturnValue(true);
      vi.spyOn(harness.client, "isCollectionNameValid").mockReturnValue(false);
      await expect(
        harness.client.createCollection("foo", "bar"),
      ).rejects.toMatchObject({
        id: "services.storage.invalid_collection_name",
      });
    });

    /*
     * `hasCollection` said no and `indices.create` says it exists: another
     * node created it in between. Swallowed, because the caller asked for the
     * collection to exist and it does.
     */
    it("survives a race with another node creating the same collection", async () => {
      arm();
      const raced: Error & { meta?: unknown } = new Error("foo");

      raced.meta = {
        body: { error: { type: "resource_already_exists_exception" } },
      };
      harness.clientStub.indices.create.mockRejectedValue(raced);

      await expect(
        harness.client.createCollection(index, collection, {
          mappings: { properties: { city: { type: "keyword" } } },
        }),
      ).resolves.toBeNull();

      expect(harness.esWrapper.formatESError).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      arm();
      harness.clientStub.indices.create.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.createCollection(index, collection, {
          mappings: { properties: { city: { type: "keyword" } } },
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#getMapping", () => {
    const arm = () => {
      vi.spyOn(harness.client, "_getIndice").mockResolvedValue(indice);

      harness.clientStub.indices.getMapping.mockResolvedValue(
        harness.envelope.respond({
          [indice]: {
            mappings: {
              dynamic: true,
              _meta: { lang: "npl" },
              properties: {
                city: { type: "keyword" },
                _kuzzle_info: { properties: { author: { type: "keyword" } } },
              },
            },
          },
        }),
      );
    };

    /*
     * Asked of the *indice*, not the alias: a mapping is a property of the
     * concrete index, and the answer is keyed by its name.
     */
    it("answers the collection's mapping without Kuzzle's own fields", async () => {
      arm();

      expect(await harness.client.getMapping(index, collection)).toEqual({
        dynamic: true,
        _meta: { lang: "npl" },
        properties: { city: { type: "keyword" } },
      });

      expect(harness.sent(harness.clientStub.indices.getMapping)).toMatchObject(
        { index: indice },
      );
    });

    it("keeps them when asked to", async () => {
      arm();

      expect(
        await harness.client.getMapping(index, collection, {
          includeKuzzleMeta: true,
        }),
      ).toEqual({
        dynamic: true,
        _meta: { lang: "npl" },
        properties: {
          city: { type: "keyword" },
          _kuzzle_info: { properties: { author: { type: "keyword" } } },
        },
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      arm();
      harness.clientStub.indices.getMapping.mockRejectedValue(
        harness.esClientError,
      );

      await expect(harness.client.getMapping(index, collection)).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#updateCollection", () => {
    const settings = { index: { blocks: { write: true } } };
    const mappings = { properties: { city: { type: "keyword" } } };

    const arm = (existingDynamic: unknown = "false") => {
      vi.spyOn(harness.client, "_getIndice").mockResolvedValue(indice);

      harness.clientStub.indices.getSettings.mockResolvedValue(
        harness.envelope.respond({
          [indice]: {
            settings: {
              index: {
                creation_date: harness.timestamp,
                provided_name: "hello_world",
                uuid: "some-u-u-i-d",
                version: { no: 4242 },
                blocks: { write: false },
              },
            },
          },
        }),
      );

      vi.spyOn(harness.client, "getMapping").mockResolvedValue({
        dynamic: existingDynamic,
        properties: { city: { type: "keyword" } },
      });

      return {
        updateMapping: vi
          .spyOn(harness.client, "updateMapping")
          .mockResolvedValue(undefined),
        updateSettings: vi
          .spyOn(harness.client, "updateSettings")
          .mockResolvedValue(undefined),
        updateSearchIndex: vi
          .spyOn(harness.client, "updateSearchIndex")
          .mockResolvedValue(undefined),
      };
    };

    it("forwards the settings and the mappings, and touches nothing else", async () => {
      const spies = arm();

      await harness.client.updateCollection(index, collection, {
        mappings,
        settings,
      });

      expect(spies.updateSettings).toHaveBeenCalledWith(
        index,
        collection,
        settings,
      );
      expect(spies.updateMapping).toHaveBeenCalledWith(
        index,
        collection,
        mappings,
      );
      expect(spies.updateSearchIndex).not.toHaveBeenCalled();
    });

    /*
     * A field that stops being `dynamic: false` starts being indexed, and the
     * documents already written have to be re-indexed for a search to find
     * them. That is what `updateSearchIndex` is for, and it only runs on that
     * transition.
     */
    it("re-indexes the collection when a field's `dynamic` opens up", async () => {
      const spies = arm();

      harness.client.getMapping.mockResolvedValue({
        properties: { content: { dynamic: "false" } },
      });

      await harness.client.updateCollection(index, collection, {
        mappings: { properties: { content: { dynamic: true } } },
      });

      expect(spies.updateSearchIndex).toHaveBeenCalledTimes(1);
    });

    /*
     * The settings are written first, so a mapping that then fails would
     * leave the collection half-updated. The old settings are read before
     * anything is written, precisely so they can be put back.
     */
    it("puts the old settings back when the mapping update fails", async () => {
      const spies = arm("true");

      const failure = new Error("the mapping was refused");

      spies.updateMapping.mockRejectedValue(failure);

      await expect(
        harness.client.updateCollection(index, collection, {
          mappings,
          settings,
        }),
      ).rejects.toBe(failure);

      expect(harness.clientStub.indices.getSettings).toHaveBeenCalled();
      expect(spies.updateMapping).toHaveBeenCalledTimes(1);
      expect(spies.updateSettings).toHaveBeenCalledTimes(2);
      expect(spies.updateSettings.mock.calls[1]).toEqual([
        index,
        collection,
        { index: { blocks: { write: false } } },
      ]);
    });
  });

  describe("#updateMapping", () => {
    const existing = {
      dynamic: "strict",
      _meta: { meta: "data" },
      properties: {
        city: { type: "keyword" },
        _kuzzle_info: { properties: { author: { type: "keyword" } } },
      },
    };

    const arm = (mapping: Record<string, unknown> = existing) =>
      vi.spyOn(harness.client, "getMapping").mockResolvedValue(mapping);

    /*
     * What goes out is the *new* properties alone, under the collection's
     * existing `dynamic` and `_meta`; what comes back is the whole mapping,
     * old and new merged. Two different objects, and the twins asserted both.
     */
    it("sends the new properties and answers the merged mapping", async () => {
      arm();

      const result = await harness.client.updateMapping(index, collection, {
        properties: { name: { type: "keyword" } },
      });

      expect(harness.sent(harness.clientStub.indices.putMapping)).toMatchObject(
        {
          index: alias,
          ...harness.envelope.request({
            dynamic: "strict",
            _meta: { meta: "data" },
            properties: { name: { type: "keyword" } },
          }),
        },
      );

      expect(result).toMatchObject({
        dynamic: "strict",
        _meta: { meta: "data" },
        properties: {
          city: { type: "keyword" },
          name: { type: "keyword" },
          _kuzzle_info: { properties: { author: { type: "keyword" } } },
        },
      });
    });

    /* `properties` merge; `dynamic` and `_meta` are replaced outright. */
    it("replaces `dynamic` and `_meta` rather than merging them", async () => {
      arm({ dynamic: "true", _meta: { some: "meta" } });

      const result = await harness.client.updateMapping(index, collection, {
        dynamic: "false",
        _meta: { other: "meta" },
      });

      expect(harness.sent(harness.clientStub.indices.putMapping)).toMatchObject(
        {
          index: alias,
          ...harness.envelope.request({
            dynamic: "false",
            _meta: { other: "meta" },
          }),
        },
      );

      expect(result).toMatchObject({
        dynamic: "false",
        _meta: { other: "meta" },
      });
    });

    it("refuses a misspelled mapping property", async () => {
      arm();

      global.NODE_ENV = "development";
      await expect(
        harness.client.updateMapping(index, collection, {
          dinamic: "false",
          properties: { freeman: { type: "keyword" } },
        }),
      ).rejects.toMatchObject({
        id: "services.storage.invalid_mapping",
        message:
          'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
      });

      expect(harness.clientStub.indices.putMapping).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      arm();
      harness.clientStub.indices.putMapping.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.updateMapping(index, collection, {
          properties: { name: { type: "keyword" } },
        }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#updateSettings", () => {
    const newSettings = { index: { blocks: { write: true } } };

    /*
     * ⚠️ `body:` on **both** versions, and it is not a mistake in the port.
     * Every other ES 8 call site moved its payload to the root; this one
     * still wraps it, so the envelope is deliberately not used here — using
     * it would have made the case pass while asserting something the subject
     * does not do.
     */
    it("writes the settings on the alias and answers nothing", async () => {
      expect(
        await harness.client.updateSettings(index, collection, newSettings),
      ).toBeNull();

      expect(
        harness.sent(harness.clientStub.indices.putSettings),
      ).toMatchObject({ index: alias, body: newSettings });
    });

    /*
     * Some settings — the analyzers above all — are static: Elasticsearch
     * refuses them on an open index. The subject does not look at which ones
     * were asked for, it closes and reopens **every time**, and the `open` is
     * in a `finally` so a failed write still reopens the index. The twins
     * named this case "when changing the analyzers", which reads as a
     * condition the subject does not have.
     */
    it("always closes the index around the write, and reopens it after", async () => {
      await harness.client.updateSettings(index, collection, newSettings);

      expect(harness.sent(harness.clientStub.indices.close)).toMatchObject({
        index: alias,
      });
      expect(harness.sent(harness.clientStub.indices.open)).toMatchObject({
        index: alias,
      });
    });

    it("reopens the index even when the write fails", async () => {
      harness.clientStub.indices.putSettings.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.updateSettings(index, collection, newSettings),
      ).rejects.toBe(harness.esClientError);

      expect(harness.clientStub.indices.open).toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.indices.putSettings.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.updateSettings(index, collection, newSettings),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#updateSearchIndex", () => {
    /*
     * An empty update-by-query: it rewrites every document through the
     * current mapping and nothing else. `wait_for_completion: false` because
     * a large collection would outlive any request timeout, and
     * `conflicts: "proceed"` because two nodes may start it at once.
     */
    it("re-indexes the whole collection in the background", async () => {
      await harness.client.updateSearchIndex(index, collection);

      expect(harness.sent(harness.clientStub.updateByQuery)).toMatchObject({
        index: alias,
        conflicts: "proceed",
        refresh: true,
        wait_for_completion: false,
        ...harness.envelope.request({}),
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.updateByQuery.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.updateSearchIndex(index, collection),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#truncateCollection", () => {
    const analysis = {
      analyzers: { custom_analyzer: { type: "simple" } },
    };

    const arm = () => {
      armNodeCount(1);
      vi.spyOn(harness.client, "_getIndice").mockResolvedValue(indice);
      vi.spyOn(harness.client, "getMapping").mockResolvedValue({
        dynamic: "false",
        properties: { name: { type: "keyword" } },
      });

      harness.clientStub.indices.getSettings.mockResolvedValue(
        harness.envelope.respond({ [indice]: { settings: { analysis } } }),
      );
    };

    /*
     * There is no "delete every document" in Elasticsearch that is not a
     * query: truncating is dropping the indice and building it again, which
     * is why the mapping and the settings are read *first*.
     */
    it("drops the indice and rebuilds it with the same mapping and settings", async () => {
      arm();

      expect(
        await harness.client.truncateCollection(index, collection),
      ).toBeNull();

      /* With Kuzzle's own fields, or the rebuilt collection would lose them. */
      expect(harness.client.getMapping).toHaveBeenCalledWith(
        index,
        collection,
        {
          includeKuzzleMeta: true,
        },
      );
      expect(harness.sent(harness.clientStub.indices.delete)).toMatchObject({
        index: indice,
      });

      const sent = harness.sent(harness.clientStub.indices.create);
      const body = harness.envelope.version === "7" ? sent.body : sent;

      expect(sent).toMatchObject({
        index: indice,
        wait_for_active_shards: harness.envelope.singleShard,
      });
      expect(body).toMatchObject({
        aliases: { [alias]: {} },
        mappings: {
          dynamic: "false",
          properties: { name: { type: "keyword" } },
        },
        settings: { analysis },
      });
    });

    it("waits for every shard when the cluster has more than one node", async () => {
      arm();
      armNodeCount(3);

      await harness.client.truncateCollection(index, collection);

      expect(
        harness.sent(harness.clientStub.indices.create).wait_for_active_shards,
      ).toBe("all");
    });

    it("rejects through the wrapper when the client fails", async () => {
      arm();
      harness.clientStub.indices.delete.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.truncateCollection(index, collection),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#import", () => {
    /**
     * A bulk body as a caller writes it: an action line, then the document it
     * applies to. A factory, because the subject stamps `_kuzzle_info` **onto
     * these very objects** — see the `_mExecute` note in `queries.ts`.
     */
    const documents = () => [
      { index: { _id: 1, _index: "overwrite-me" } },
      { firstName: "foo" },

      { index: { _id: 2, _type: "delete-me" } },
      { firstName: "bar" },

      { update: { _id: 3 } },
      { doc: { firstName: "foobar" } },

      { delete: { _id: 4 } },
    ];

    /**
     * The same body once the subject is done with it: every action pinned to
     * the collection's alias, every written document stamped, and `_type` —
     * a mapping type, removed from Elasticsearch in 7 — dropped.
     */
    const expected = ({
      userId = null,
      refresh,
      timeout,
    }: {
      userId?: string | null;
      refresh?: string;
      timeout?: string;
    } = {}) => ({
      refresh,
      timeout,
      [harness.envelope.bulkOperations]: [
        { index: { _id: 1, _index: alias } },
        {
          firstName: "foo",
          _kuzzle_info: {
            author: userId,
            createdAt: harness.timestamp,
            updatedAt: null,
            updater: null,
          },
        },

        { index: { _id: 2, _index: alias, _type: undefined } },
        {
          firstName: "bar",
          _kuzzle_info: {
            author: userId,
            createdAt: harness.timestamp,
            updatedAt: null,
            updater: null,
          },
        },

        { update: { _id: 3, _index: alias } },
        {
          doc: {
            firstName: "foobar",
            _kuzzle_info: {
              updatedAt: harness.timestamp,
              updater: userId,
            },
          },
        },

        { delete: { _id: 4, _index: alias } },
      ],
    });

    const armBulk = (payload: Record<string, unknown>) =>
      harness.clientStub.bulk.mockResolvedValue(
        harness.envelope.respond(payload),
      );

    const fourSucceeded = {
      errors: false,
      items: [
        { index: { status: 201, _id: 1, toto: 42 } },
        { index: { status: 201, _id: 2, toto: 42 } },
        { update: { status: 200, _id: 3, toto: 42 } },
        { delete: { status: 200, _id: 4, toto: 42 } },
      ],
    };

    it("stamps every written document and pins every action to the alias", async () => {
      armBulk(fourSucceeded);

      const result = await harness.client.import(
        index,
        collection,
        documents(),
      );

      expect(harness.sent(harness.clientStub.bulk)).toMatchObject(expected());

      /* The client's extra keys are dropped: only status and id come back. */
      expect(result).toMatchObject({
        items: [
          { index: { status: 201, _id: 1 } },
          { index: { status: 201, _id: 2 } },
          { update: { status: 200, _id: 3 } },
          { delete: { status: 200, _id: 4 } },
        ],
        errors: [],
      });
    });

    it("carries refresh, timeout and the user who asked", async () => {
      armBulk(fourSucceeded);

      await harness.client.import(index, collection, documents(), {
        refresh: "wait_for",
        timeout: "10m",
        userId: "aschen",
      });

      expect(harness.sent(harness.clientStub.bulk)).toMatchObject(
        expected({ refresh: "wait_for", timeout: "10m", userId: "aschen" }),
      );
    });

    it("splits the answer into what went through and what did not", async () => {
      armBulk({
        errors: true,
        items: [
          { index: { status: 201, _id: 1, toto: 42 } },
          { index: { status: 201, _id: 2, toto: 42 } },
          {
            update: {
              status: 404,
              _id: 42,
              error: { type: "not_found", reason: "not found", toto: 42 },
            },
          },
          {
            delete: {
              status: 404,
              _id: 21,
              error: { type: "not_found", reason: "not found", toto: 42 },
            },
          },
        ],
      });

      const result = await harness.client.import(
        index,
        collection,
        documents(),
      );

      expect(result).toMatchObject({
        items: [
          { index: { status: 201, _id: 1 } },
          { index: { status: 201, _id: 2 } },
        ],
        errors: [
          {
            update: {
              status: 404,
              _id: 42,
              error: { type: "not_found", reason: "not found" },
            },
          },
          {
            delete: {
              status: 404,
              _id: 21,
              error: { type: "not_found", reason: "not found" },
            },
          },
        ],
      });
    });

    it("skips an answer row that carries no action", async () => {
      armBulk({
        errors: false,
        items: [{}, { index: { status: 201, _id: 1 } }],
      });

      expect(
        await harness.client.import(index, collection, documents()),
      ).toMatchObject({
        errors: [],
        items: [{ index: { status: 201, _id: 1 } }],
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.bulk.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.import(index, collection, documents()),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#_createHiddenCollection", () => {
    const hiddenIndice = "&nisantasi._kuzzle_keep";
    const hiddenAlias = `@${hiddenIndice}`;

    const arm = () => {
      armNodeCount(1);
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond([]),
      );
      harness.clientStub.indices.create.mockResolvedValue(
        harness.envelope.respond({}),
      );
      vi.spyOn(harness.client, "_getAvailableIndice").mockResolvedValue(
        hiddenIndice,
      );

      return stubMutex();
    };

    const createdBody = () => {
      const sent = harness.sent(harness.clientStub.indices.create);

      return harness.envelope.version === "7" ? sent.body : sent;
    };

    /*
     * An index with no collection does not exist as far as Elasticsearch is
     * concerned. `_kuzzle_keep` is the placeholder that makes an empty index
     * real, and it is created under a lock because several nodes may be
     * creating the same index at once.
     */
    it("creates the placeholder collection that makes an empty index exist", async () => {
      const mutex = arm();

      await harness.client._createHiddenCollection("nisantasi");

      expect(harness.sent(harness.clientStub.indices.create)).toMatchObject({
        index: hiddenIndice,
        wait_for_active_shards: harness.envelope.singleShard,
      });
      expect(createdBody()).toMatchObject({
        aliases: { [hiddenAlias]: {} },
        settings: { number_of_shards: 1, number_of_replicas: 1 },
      });

      expect(mutex.lock).toHaveBeenCalled();
      expect(mutex.unlock).toHaveBeenCalled();
    });

    it("does nothing when the placeholder is already there", async () => {
      arm();
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond([{ alias: hiddenAlias }]),
      );

      await harness.client._createHiddenCollection("nisantasi");

      expect(harness.clientStub.indices.create).not.toHaveBeenCalled();
    });

    it("takes its shard counts from the configured defaults", async () => {
      arm();
      harness.config.defaultSettings = {
        number_of_shards: 42,
        number_of_replicas: 42,
      };

      await harness.client._createHiddenCollection("nisantasi");

      expect(createdBody().settings).toMatchObject({
        number_of_shards: 42,
        number_of_replicas: 42,
      });
    });

    it("waits for every shard when the cluster has more than one node", async () => {
      arm();
      armNodeCount(3);

      await harness.client._createHiddenCollection("nisantasi");

      expect(
        harness.sent(harness.clientStub.indices.create).wait_for_active_shards,
      ).toBe("all");
    });

    it("releases the lock even when the client fails", async () => {
      const mutex = arm();
      harness.clientStub.indices.create.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client._createHiddenCollection("nisantasi"),
      ).rejects.toBe(harness.esClientError);

      expect(mutex.unlock).toHaveBeenCalled();
    });
  });

  describe("#_checkMappings", () => {
    const check = (mapping: Record<string, unknown>) => () =>
      harness.client._checkMappings(mapping);

    /*
     * The allowed set is small — `properties`, `dynamic`, `_meta`,
     * `dynamic_templates`, `type` under a property — and anything else is a
     * typo the caller would otherwise only notice as a field that never gets
     * indexed. Hence the suggestion.
     */
    it("refuses a property that is not one of the few it allows", () => {
      global.NODE_ENV = "development";

      expect(check({ properties: {}, dinamic: "false" })).toThrow(
        expect.objectContaining({
          id: "services.storage.invalid_mapping",
          message:
            'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
        }),
      );

      /* `type` is allowed on a property, not at the root. */
      expect(check({ type: "nested", properties: {} })).toThrow(
        expect.objectContaining({
          message: 'Invalid mapping property "mappings.type".',
        }),
      );
    });

    it("names the full path of a nested one", () => {
      const mapping = {
        dynamic: "false",
        properties: {
          name: { type: "keyword" },
          car: {
            dinamic: "false",
            properties: { brand: { type: "keyword" } },
          },
        },
      };

      global.NODE_ENV = "development";
      expect(check(mapping)).toThrow(
        expect.objectContaining({
          message:
            'Invalid mapping property "mappings.properties.car.dinamic". Did you mean "dynamic"?',
        }),
      );

      global.NODE_ENV = "production";
      expect(check(mapping)).toThrow(
        expect.objectContaining({
          message:
            'Invalid mapping property "mappings.properties.car.dinamic".',
        }),
      );
    });

    it("accepts a mapping that only uses what it allows", () => {
      expect(
        check({
          dynamic: "false",
          properties: {
            name: { type: "keyword" },
            car: {
              dynamic: "false",
              dynamic_templates: {},
              type: "nested",
              properties: { brand: { type: "keyword" } },
            },
          },
        }),
      ).not.toThrow();
    });
  });
}
