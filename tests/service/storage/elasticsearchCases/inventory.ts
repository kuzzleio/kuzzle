/**
 * L5a — the sixteen smallest of the 54 action blocks: how the service is
 * wired, what it knows exists, and what it will accept as a name.
 *
 * Eleven of these sixteen are **byte-identical between the two Mocha twins**,
 * which is why they are the group that proves the shape: if the shared cases
 * plus {@link ESEnvelope} cannot express the blocks that already agree, the
 * plan for the other 38 is wrong. The five that do differ —`#stats`,
 * `#listCollections`, `#listIndexes`, `#listAliases`, `#deleteIndexes`,
 * `#getSchema` — differ in exactly one way: ES 7 answers `{ body: … }` where
 * ES 8 answers the payload, which is `envelope.respond`.
 */
import { describe, expect, it, vi } from "vitest";

import { storeScopeEnum } from "../../../../lib/core/storage/storeScopeEnum";
import type { ESHarness } from "./harness";
import { aliasFromIndice } from "./harness";

const index = "nyc-open-data";
const collection = "yellow-taxi";
const alias = "@&nyc-open-data.yellow-taxi";
const indice = "&nyc-open-data.yellow-taxi";

export function describeInventory(harness: ESHarness) {
  describe("#constructor", () => {
    it("prefixes public indices with & and private ones with %", () => {
      const internal = harness.build(storeScopeEnum.PRIVATE);

      expect(harness.es.config).toBe(harness.config);
      expect(harness.client._indexPrefix).toBe("&");
      expect(internal.client._indexPrefix).toBe("%");
    });
  });

  describe("#init", () => {
    /*
     * ⚠️ The Mocha twins asserted three things here and **all three were
     * vacuous**:
     *
     *   should(elasticsearch.client._client).not.be.null();
     *   should(elasticsearch.client._esWrapper).not.be.null();
     *   should(elasticsearch.client.esVersion).not.be.null();
     *
     * The first two hold because the fixture assigned them, not because
     * `init()` did — `_initSequence` returns early whenever `_client` is
     * already set, which is how the fixture gets a stub in. The third reads a
     * property that **does not exist**: the field is `_esVersion`, so the
     * assertion ran against `undefined`, and `undefined` is not `null`. Had it
     * been spelled right it would have *failed*, because `_esVersion` is
     * `null` from the constructor and the early return never overwrites it.
     *
     * What `init()` actually does under this fixture is nothing, idempotently.
     * That is worth one test; the three above were worth none.
     */
    it("is a no-op once a client already exists", async () => {
      const client = harness.client._client;

      await expect(harness.es.init()).resolves.toBeUndefined();

      expect(harness.client._client).toBe(client);
      expect(harness.client._esVersion).toBeNull();
    });
  });

  describe("#stats", () => {
    const armStats = () => {
      harness.clientStub.indices.stats.mockResolvedValue(
        harness.envelope.respond({
          indices: {
            "%kuzzle.users": {
              total: { docs: { count: 1 }, store: { size_in_bytes: 10 } },
            },
            "&test-index._kuzzle_keep": {
              total: { docs: { count: 0 }, store: { size_in_bytes: 10 } },
            },
            "&test-index.test-collection": {
              total: { docs: { count: 2 }, store: { size_in_bytes: 20 } },
            },
            ".kibana": {
              total: { docs: { count: 2 }, store: { size_in_bytes: 42 } },
            },
            // This index natively returns nothing on an index:stats call.
            ".geoip_databases": {},
          },
        }),
      );

      vi.spyOn(harness.client, "_getAliasFromIndice").mockImplementation(
        aliasFromIndice,
      );
    };

    it("asks the client for the two metrics it reads, and no others", async () => {
      armStats();

      await harness.client.stats();

      expect(harness.clientStub.indices.stats).toHaveBeenCalledOnce();
      expect(harness.clientStub.indices.stats).toHaveBeenCalledWith(
        expect.objectContaining({ metric: ["docs", "store"] }),
      );
    });

    it("ignores private, hidden and non-Kuzzle indices", async () => {
      armStats();

      /*
       * Of the five indices above only `&test-index.test-collection` survives:
       * `%kuzzle.users` is private, `_kuzzle_keep` is the hidden collection,
       * and `.kibana` / `.geoip_databases` are not Kuzzle's at all. The
       * `size: 20` total is the assertion that says so — it counts one of the
       * five stores, not five.
       */
      expect(await harness.client.stats()).toMatchObject({
        size: 20,
        indexes: [
          {
            name: "test-index",
            size: 20,
            collections: [
              { name: "test-collection", documentCount: 2, size: 20 },
            ],
          },
        ],
      });
    });
  });

  describe("#listCollections", () => {
    const armAliases = (aliases: string[]) =>
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond(aliases.map((value) => ({ alias: value }))),
      );

    it("lists the collections of one index, hidden ones excluded", async () => {
      armAliases([
        "@&nepali.mehry",
        "@&nepali.liia",
        "@&nyc-open-data.taxi",
        "@&nepali._kuzzle_keep",
      ]);

      expect(await harness.client.listCollections("nepali")).toEqual([
        "mehry",
        "liia",
      ]);
    });

    it("does not list collections of a private index", async () => {
      armAliases(["@%nepali.mehry", "@%nepali.liia", "@%nyc-open-data.taxi"]);

      expect(await harness.client.listCollections("nepali")).toEqual([]);
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.cat.aliases.mockRejectedValue(harness.esClientError);

      await expect(harness.client.listCollections(index)).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#listIndexes", () => {
    const armAliases = (aliases: string[]) =>
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond(aliases.map((value) => ({ alias: value }))),
      );

    it("lists each index once, whatever its collection count", async () => {
      armAliases(["@&nepali.mehry", "@&nepali.liia", "@&nyc-open-data.taxi"]);

      expect(await harness.client.listIndexes()).toEqual([
        "nepali",
        "nyc-open-data",
      ]);

      expect(harness.clientStub.cat.aliases).toHaveBeenCalledWith(
        expect.objectContaining({ format: "json" }),
      );
    });

    it("does not list private indexes", async () => {
      armAliases([
        "@%nepali.mehry",
        "@%nepali.liia",
        "@%nyc-open-data.taxi",
        "@&vietnam.lfiduras",
      ]);

      expect(await harness.client.listIndexes()).toEqual(["vietnam"]);
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.cat.aliases.mockRejectedValue(harness.esClientError);

      await expect(harness.client.listIndexes()).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#listAliases", () => {
    const armAliases = (records: { index: string; alias: string }[]) =>
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond(records),
      );

    it("answers the alias, its index, its collection and its indice", async () => {
      /*
       * `&nepalu.mehry` is not a typo carried over by accident: the indice and
       * the alias deliberately disagree, which is what makes `indice` a field
       * worth answering rather than something a caller could derive.
       */
      armAliases([
        { index: "&nepalu.mehry", alias: "@&nepali.mehry" },
        { index: "&nepali.lia", alias: "@&nepali.liia" },
        { index: "&nyc-open-data.taxi", alias: "@&nyc-open-data.taxi" },
      ]);

      expect(await harness.client.listAliases()).toEqual([
        {
          alias: "@&nepali.mehry",
          index: "nepali",
          collection: "mehry",
          indice: "&nepalu.mehry",
        },
        {
          alias: "@&nepali.liia",
          index: "nepali",
          collection: "liia",
          indice: "&nepali.lia",
        },
        {
          alias: "@&nyc-open-data.taxi",
          index: "nyc-open-data",
          collection: "taxi",
          indice: "&nyc-open-data.taxi",
        },
      ]);

      expect(harness.clientStub.cat.aliases).toHaveBeenCalledWith(
        expect.objectContaining({ format: "json" }),
      );
    });

    it("does not list private aliases", async () => {
      armAliases([
        { index: "%nepalu.mehry", alias: "@%nepali.mehry" },
        { index: "%nepali.lia", alias: "@%nepali.liia" },
        { index: "%nyc-open-data.taxi", alias: "@%nyc-open-data.taxi" },
        { index: "&vietnam.lfiduras", alias: "@&vietnam.lfiduras" },
      ]);

      expect(await harness.client.listAliases()).toEqual([
        {
          alias: "@&vietnam.lfiduras",
          index: "vietnam",
          collection: "lfiduras",
          indice: "&vietnam.lfiduras",
        },
      ]);
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.cat.aliases.mockRejectedValue(harness.esClientError);

      await expect(harness.client.listAliases()).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#deleteIndexes", () => {
    const armAliases = (records: { index: string; alias: string }[]) =>
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond(records),
      );

    it("deletes every indice of the named indexes, and nothing else", async () => {
      armAliases([
        { alias: "@&nepali.mehry", index: "&nepali.mehry" },
        { alias: "@&nepali.liia", index: "&nepali.liia" },
        { alias: "@&do-not.delete", index: "&do-not.delete" },
        { alias: "@&nyc-open-data.taxi", index: "&nyc-open-data.taxi" },
      ]);

      expect(
        await harness.client.deleteIndexes(["nepali", "nyc-open-data"]),
      ).toEqual(["nepali", "nyc-open-data"]);

      expect(harness.clientStub.indices.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          index: ["&nepali.mehry", "&nepali.liia", "&nyc-open-data.taxi"],
        }),
      );
    });

    it("does not delete a private index that shares a name", async () => {
      armAliases([
        { alias: "@&nepali.mehry", index: "&nepali.mehry" },
        { alias: "@&nepali.liia", index: "&nepali.liia" },
        { alias: "@&do-not.delete", index: "&do-not.delete" },
        { alias: "@%nyc-open-data.taxi", index: "%nyc-open-data.taxi" },
      ]);

      expect(
        await harness.client.deleteIndexes(["nepali", "nyc-open-data"]),
      ).toEqual(["nepali"]);

      expect(harness.clientStub.indices.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          index: ["&nepali.mehry", "&nepali.liia"],
        }),
      );
    });

    /*
     * ⚠️ The Mocha twins' third case here called `listIndexes()`, not
     * `deleteIndexes()` — a copy-paste from the block above, so `#deleteIndexes`
     * had no failure path of its own. Pointed at the right subject; it passes,
     * because both read the same `cat.aliases`.
     */
    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.cat.aliases.mockRejectedValue(harness.esClientError);

      await expect(harness.client.deleteIndexes(["nepali"])).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#deleteIndex", () => {
    it("is deleteIndexes with one name, and answers null", async () => {
      const deleteIndexes = vi
        .spyOn(harness.client, "deleteIndexes")
        .mockResolvedValue(undefined);

      expect(await harness.client.deleteIndex("nepali")).toBeNull();

      expect(deleteIndexes).toHaveBeenCalledWith(["nepali"]);
    });
  });

  describe("#deleteCollection", () => {
    const armCollection = () => {
      vi.spyOn(harness.client, "_createHiddenCollection").mockResolvedValue(
        undefined,
      );
      vi.spyOn(harness.client, "_getIndice").mockResolvedValue(indice);

      return vi
        .spyOn(harness.client, "_checkIfAliasExists")
        .mockResolvedValue(undefined);
    };

    /*
     * ⚠️ The Mocha twins split this across two cases, and the second —
     * "should create the hidden collection if the index is empty" — asserted a
     * strict subset of the first while setting up nothing that made the index
     * empty. Its name described a condition it never created. Merged into one
     * case that states both halves of what deleting a collection does: the
     * indice goes, and the index is kept alive by the hidden collection.
     */
    it("deletes the indice and leaves the index alive behind it", async () => {
      armCollection();

      expect(
        await harness.client.deleteCollection(index, collection),
      ).toBeNull();

      expect(harness.clientStub.indices.delete).toHaveBeenCalledWith(
        expect.objectContaining({ index: indice }),
      );
      expect(harness.client._createHiddenCollection).toHaveBeenCalled();
    });

    it("deletes the alias too when one outlived the indice", async () => {
      armCollection().mockResolvedValue(["myalias"]);

      await harness.client.deleteCollection(index, collection);

      expect(harness.clientStub.indices.deleteAlias).toHaveBeenCalled();
    });
  });

  describe("#refreshCollection", () => {
    it("refreshes the alias and answers the shard report", async () => {
      harness.clientStub.indices.refresh.mockResolvedValue(
        harness.envelope.respond({ _shards: "shards" }),
      );

      expect(await harness.client.refreshCollection(index, collection)).toEqual(
        {
          _shards: "shards",
        },
      );

      expect(harness.clientStub.indices.refresh).toHaveBeenCalledWith(
        expect.objectContaining({ index: alias }),
      );
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.indices.refresh.mockRejectedValue(
        harness.esClientError,
      );

      await expect(
        harness.client.refreshCollection(index, collection),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#exists", () => {
    it("asks the client whether one document is in the alias", async () => {
      harness.clientStub.exists.mockResolvedValue(
        harness.envelope.respond(true),
      );

      expect(await harness.client.exists(index, collection, "liia")).toBe(true);

      expect(harness.clientStub.exists).toHaveBeenCalledWith(
        expect.objectContaining({ index: alias, id: "liia" }),
      );
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.exists.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.exists(index, collection, "liia"),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#hasIndex", () => {
    it.each([
      ["nepali", true],
      ["vietnam", false],
    ])("answers %s → %s from the index listing", async (name, expected) => {
      const listIndexes = vi
        .spyOn(harness.client, "listIndexes")
        .mockResolvedValue(["nepali", "nyc-open-data"]);

      expect(await harness.client.hasIndex(name)).toBe(expected);
      expect(listIndexes).toHaveBeenCalled();
    });
  });

  describe("#hasCollection", () => {
    it.each([
      ["liia", true],
      ["lfiduras", false],
    ])(
      "answers %s → %s from the collection listing",
      async (name, expected) => {
        const listCollections = vi
          .spyOn(harness.client, "listCollections")
          .mockResolvedValue(["liia", "mehry"]);

        expect(await harness.client.hasCollection("nepali", name)).toBe(
          expected,
        );
        expect(listCollections).toHaveBeenCalled();
      },
    );
  });

  /*
   * The two name validators are the one pair the block hash flags as
   * near-identical *within* a twin (29 lines each, same five cases). They stay
   * two blocks: they are two methods with two independent regexes, and merging
   * them would stop either from failing on its own.
   */
  describe.each([
    ["#isIndexNameValid", "isIndexNameValid"],
    ["#isCollectionNameValid", "isCollectionNameValid"],
  ])("%s", (_title, method) => {
    const validate = (name: string): boolean => harness.client[method](name);

    it("allows a lowercase ASCII name", () => {
      expect(validate("foobar")).toBe(true);
    });

    it("refuses an empty name", () => {
      expect(validate("")).toBe(false);
    });

    it("refuses uppercase characters", () => {
      expect(validate("bAr")).toBe(false);
    });

    it("refuses a name longer than the byte budget", () => {
      // "Ӣ" is two bytes, so 64 of them exceed the 128-byte limit.
      expect(validate("Ӣ".repeat(64))).toBe(false);
    });

    it.each([...'\\/*?"<>| \t\r\n,#:%.&'])(
      "refuses %j anywhere in the name",
      (forbidden) => {
        expect(validate(`foo${forbidden}bar`)).toBe(false);
      },
    );
  });

  describe("#getSchema", () => {
    it("answers every index, with its hidden collection left out", async () => {
      harness.clientStub.cat.aliases.mockResolvedValue(
        harness.envelope.respond([
          { alias: "@&nepali.mehry" },
          { alias: "@&nepali._kuzzle_keep" },
          { alias: "@&istanbul._kuzzle_keep" },
        ]),
      );

      /*
       * `istanbul` holds nothing but its hidden collection and still appears,
       * with an empty list: that is the difference between an index that is
       * empty and one that does not exist.
       */
      expect(await harness.client.getSchema()).toEqual({
        nepali: ["mehry"],
        istanbul: [],
      });
    });
  });
}
