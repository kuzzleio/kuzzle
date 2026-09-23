/**
 * L5e (2/2) — the `Collection emulation utils` block: the name arithmetic
 * Kuzzle's index/collection model is built on, plus the search-body guards.
 *
 * Elasticsearch has no collections. Kuzzle emulates them by putting every
 * `index`/`collection` pair in its own **indice** named `&index.collection`
 * (`%` when the store is private) and pointing an **alias** `@&index.collection`
 * at it. Everything here is that translation, in both directions, and it is
 * the one group where the two scopes matter — so, like the twins, each case
 * drives a public and a private instance side by side.
 */
import { describe, expect, it } from "vitest";

import { storeScopeEnum } from "../../../../lib/core/storage/storeScopeEnum";

import type { ESHarness } from "./harness";

export function describeInternals(harness: ESHarness) {
  /**
   * A public and a private client, built from the same config. The scope is
   * one character in every name below, and pairing the two in each case is
   * what states which one.
   */
  const scopes = () => {
    const publicES = harness.build(storeScopeEnum.PUBLIC);
    const privateES = harness.build(storeScopeEnum.PRIVATE);

    return {
      public: publicES.client,
      private: privateES.client,
    };
  };

  describe("#_getAlias", () => {
    it("names an alias from the scope, the index and the collection", () => {
      const { public: publicES, private: privateES } = scopes();

      expect(publicES._getAlias("nepali", "liia")).toBe("@&nepali.liia");
      expect(privateES._getAlias("nepali", "mehry")).toBe("@%nepali.mehry");
    });
  });

  describe("#_getIndice", () => {
    /*
     * The indice an alias points at is *not* derivable from the alias: a
     * collection created twice under the same name gets a suffixed indice, so
     * the mapping has to be asked for.
     */
    it("asks the cluster which indice an alias points at", async () => {
      const { public: publicES, private: privateES } = scopes();

      publicES._client.cat.aliases.mockResolvedValue(
        harness.envelope.respond([
          { alias: "@&nepali.liia", index: "&nepali.lia", filter: 0 },
        ]),
      );
      privateES._client.cat.aliases.mockResolvedValue(
        harness.envelope.respond([
          { alias: "@%nepali.mehry", index: "%nepalu.mehry", filter: 0 },
        ]),
      );

      expect(await publicES._getIndice("nepali", "liia")).toBe("&nepali.lia");
      expect(await privateES._getIndice("nepali", "mehry")).toBe(
        "%nepalu.mehry",
      );
    });

    it("refuses an alias nothing answers for", async () => {
      const { public: publicES, private: privateES } = scopes();

      for (const client of [publicES, privateES]) {
        client._client.cat.aliases.mockResolvedValue(
          harness.envelope.respond([]),
        );
      }

      await expect(publicES._getIndice("nepali", "liia")).rejects.toMatchObject(
        { id: "services.storage.unknown_index_collection" },
      );
      await expect(
        privateES._getIndice("nepali", "mehry"),
      ).rejects.toMatchObject({
        id: "services.storage.unknown_index_collection",
      });
    });

    /* One alias, two indices, is a cluster Kuzzle cannot reason about. */
    it("refuses an alias that answers for more than one indice", async () => {
      const { public: publicES, private: privateES } = scopes();

      publicES._client.cat.aliases.mockResolvedValue(
        harness.envelope.respond([
          { alias: "@&nepali.liia", index: "&nepali.lia", filter: 0 },
          { alias: "@&nepali.liia", index: "&nepali.liia", filter: 0 },
        ]),
      );
      privateES._client.cat.aliases.mockResolvedValue(
        harness.envelope.respond([
          { alias: "@%nepali.mehry", index: "%nepalu.mehry", filter: 0 },
          { alias: "@%nepali.mehry", index: "%nepali.mehry", filter: 0 },
        ]),
      );

      await expect(publicES._getIndice("nepali", "liia")).rejects.toMatchObject(
        { id: "services.storage.multiple_indice_alias" },
      );
      await expect(
        privateES._getIndice("nepali", "mehry"),
      ).rejects.toMatchObject({ id: "services.storage.multiple_indice_alias" });
    });
  });

  describe("#_getAvailableIndice", () => {
    it("takes the plain name when nothing holds it", async () => {
      const { public: publicES, private: privateES } = scopes();

      for (const client of [publicES, privateES]) {
        client._client.indices.exists.mockResolvedValue(
          harness.envelope.respond(false),
        );
      }

      expect(await publicES._getAvailableIndice("nepali", "liia")).toBe(
        "&nepali.liia",
      );
      expect(
        await privateES._getAvailableIndice("nepali", "_kuzzle_keep"),
      ).toBe("%nepali._kuzzle_keep");
    });

    /*
     * A collection deleted and created again may find its indice still there
     * — Elasticsearch deletes lazily — so a numeric suffix is added until one
     * is free.
     */
    it("suffixes the name when the plain one is taken", async () => {
      const { public: publicES, private: privateES } = scopes();

      for (const client of [publicES, privateES]) {
        client._client.indices.exists
          .mockResolvedValue(harness.envelope.respond(false))
          .mockResolvedValueOnce(harness.envelope.respond(true));
      }

      expect(await publicES._getAvailableIndice("nepali", "liia")).toMatch(
        /^&nepali\.liia\.\d+$/,
      );
      expect(await privateES._getAvailableIndice("nepali", "mehry")).toMatch(
        /^%nepali\.mehry\.\d+$/,
      );
    });

    /*
     * ⚠️ An indice name is capped at 255 **bytes**, and the suffix has to fit
     * inside that cap rather than push past it — so the collection half is
     * truncated by exactly the suffix's length, no more.
     */
    it("truncates the name by exactly the suffix's length to stay under the cap", async () => {
      const { public: publicES, private: privateES } = scopes();

      const longIndex =
        "averyveryverylongindexwhichhasexactlythemaximumlengthacceptedofonehundredandtwentysixcharactersandthatiswaytoolongdontyouthink";
      const longCollection =
        "averyverylongcollectionwhichhasexactlythemaximumlengthacceptedofonehundredandtwentysixcharactersandthatswaytoolongdontyouthink";

      for (const client of [publicES, privateES]) {
        client._client.indices.exists
          .mockResolvedValue(harness.envelope.respond(false))
          .mockResolvedValueOnce(harness.envelope.respond(true));
      }

      for (const [prefix, client] of [
        ["&", publicES],
        ["%", privateES],
      ] as const) {
        const indice = await client._getAvailableIndice(
          longIndex,
          longCollection,
        );
        const suffixLength = /(\d+)/.exec(indice)![0].length;

        expect(indice).toMatch(
          new RegExp(
            `^\\${prefix}${longIndex}\\.${longCollection.slice(
              0,
              longCollection.length - suffixLength,
            )}\\.\\d+$`,
          ),
        );
        expect(Buffer.from(indice)).toHaveLength(255);
      }
    });
  });

  describe("#_getAliasFromIndice", () => {
    const armAliases = (client: any, indice: string, aliases: string[]) =>
      client._client.indices.getAlias.mockResolvedValue(
        harness.envelope.respond({
          [indice]: {
            aliases: Object.fromEntries(aliases.map((name) => [name, {}])),
          },
        }),
      );

    it("answers the aliases an indice is known by", async () => {
      const { public: publicES, private: privateES } = scopes();

      armAliases(publicES, "&nepali.lia", ["@&nepali.liia"]);
      armAliases(privateES, "%nepalu.mehry", ["@%nepali.mehry"]);

      expect(await publicES._getAliasFromIndice("&nepali.lia")).toEqual([
        "@&nepali.liia",
      ]);
      expect(await privateES._getAliasFromIndice("%nepalu.mehry")).toEqual([
        "@%nepali.mehry",
      ]);
    });

    it("refuses an indice no alias points at", async () => {
      const { public: publicES, private: privateES } = scopes();

      armAliases(publicES, "&nepali.lia", []);
      armAliases(privateES, "%nepalu.mehry", []);

      await expect(
        publicES._getAliasFromIndice("&nepali.lia"),
      ).rejects.toMatchObject({
        id: "services.storage.unknown_index_collection",
      });
      await expect(
        privateES._getAliasFromIndice("%nepalu.mehry"),
      ).rejects.toMatchObject({
        id: "services.storage.unknown_index_collection",
      });
    });

    /*
     * Several aliases on one indice is allowed — a user may add their own —
     * and so is an alias that is not one of Kuzzle's, which is why only the
     * `@`-prefixed ones are counted.
     */
    it("accepts an indice several aliases point at, Kuzzle's or not", async () => {
      const { public: publicES, private: privateES } = scopes();

      armAliases(publicES, "&nepali.lia", ["@&nepali.liia", "@&nepali.lia"]);
      armAliases(privateES, "%nepalu.mehry", [
        "@%nepali.mehry",
        "%nepalu.mehry",
      ]);

      await expect(
        publicES._getAliasFromIndice("&nepali.lia"),
      ).resolves.toHaveLength(2);
      await expect(
        privateES._getAliasFromIndice("%nepalu.mehry"),
      ).resolves.toEqual(["@%nepali.mehry"]);
    });
  });

  describe("#_getWaitForActiveShards", () => {
    it("asks for every shard on a cluster, and one on a single node", async () => {
      harness.clientStub.cat.nodes.mockResolvedValue(
        harness.envelope.respond(["node1", "node2"]),
      );
      expect(await harness.client._getWaitForActiveShards()).toBe("all");

      harness.clientStub.cat.nodes.mockResolvedValue(
        harness.envelope.respond(["node1"]),
      );
      expect(await harness.client._getWaitForActiveShards()).toBe(
        harness.envelope.singleShard,
      );
    });
  });

  describe("#generateMissingAliases", () => {
    const indices = [
      { index: "&nepali.liia", status: "open" },
      { index: "%nepali.liia", status: "open" },
      { index: "&nepali.mehry", status: "open" },
      { index: "%nepali.mehry", status: "open" },
    ];

    const arm = (client: any, aliases: unknown[]) => {
      client._client.cat.indices.mockResolvedValue(
        harness.envelope.respond(indices),
      );
      client._client.indices.updateAliases.mockResolvedValue(
        harness.envelope.respond({}),
      );
      client.listAliases = () => Promise.resolve(aliases);
    };

    /*
     * Aliases became mandatory in 2.14.0; an instance older than that has
     * indices with none. This runs at startup and gives each one the alias
     * its own name implies — and only for indices of its own scope.
     */
    it("gives an alias to every indice of its scope that has none", async () => {
      const { public: publicES, private: privateES } = scopes();
      const known = [
        {
          alias: "@&nepali.lia",
          index: "nepali",
          collection: "lia",
          indice: "&nepali.liia",
        },
      ];

      arm(publicES, known);
      arm(privateES, known);

      await publicES.generateMissingAliases();
      await privateES.generateMissingAliases();

      /* ⚠️ `body` on both versions — like `updateSettings`, one of the two ES 8
       * call sites that never moved its payload to the root. */
      expect(publicES._client.indices.updateAliases).toHaveBeenCalledWith({
        body: {
          actions: [
            { add: { alias: "@&nepali.mehry", index: "&nepali.mehry" } },
          ],
        },
      });
      expect(privateES._client.indices.updateAliases).toHaveBeenCalledWith({
        body: {
          actions: [
            { add: { alias: "@%nepali.liia", index: "%nepali.liia" } },
            { add: { alias: "@%nepali.mehry", index: "%nepali.mehry" } },
          ],
        },
      });
    });

    it("asks for nothing when every indice already has one", async () => {
      const { public: publicES, private: privateES } = scopes();
      const all = [
        { alias: "@&nepali.lia", indice: "&nepali.liia" },
        { alias: "@%nepali.lia", indice: "%nepali.liia" },
        { alias: "@&nepalu.mehry", indice: "&nepali.mehry" },
        { alias: "@%nepalu.mehry", indice: "%nepali.mehry" },
      ];

      arm(publicES, all);
      arm(privateES, all);

      await publicES.generateMissingAliases();
      await privateES.generateMissingAliases();

      expect(publicES._client.indices.updateAliases).not.toHaveBeenCalled();
      expect(privateES._client.indices.updateAliases).not.toHaveBeenCalled();
    });
  });

  describe("#_extractIndex / #_extractCollection", () => {
    it("reads the index and the collection back out of an alias", () => {
      const { public: publicES, private: privateES } = scopes();

      expect(publicES._extractIndex("@&nepali.liia")).toBe("nepali");
      expect(privateES._extractIndex("@%nepali.liia")).toBe("nepali");

      /* Whatever its length, and whatever the scope. */
      expect(publicES._extractCollection("@&nepali.liia")).toBe("liia");
      expect(publicES._extractCollection("@&vietnam.l")).toBe("l");
      expect(
        publicES._extractCollection(
          "@&vietnam.iamaverylongcollectionnamebecauseiworthit",
        ),
      ).toBe("iamaverylongcollectionnamebecauseiworthit");
      expect(privateES._extractCollection("@%nepali.liia")).toBe("liia");
    });
  });

  describe("#_extractSchema", () => {
    const aliases = [
      "@%nepali.liia",
      "@%nepali.mehry",

      "@&nepali.panipokari",
      "@&nepali._kuzzle_keep",
      "@&vietnam.lfiduras",
      "@&vietnam._kuzzle_keep",
    ];

    /*
     * A client only ever sees its own scope's aliases, and the placeholder
     * collection is not one a caller asked for — so neither shows up.
     */
    it("groups a scope's collections by index, without the placeholders", () => {
      const { public: publicES, private: privateES } = scopes();

      expect(publicES._extractSchema(aliases)).toEqual({
        nepali: ["panipokari"],
        vietnam: ["lfiduras"],
      });
      expect(privateES._extractSchema(aliases)).toEqual({
        nepali: ["liia", "mehry"],
      });
    });

    it("keeps the placeholders when asked to", () => {
      const { public: publicES } = scopes();

      expect(publicES._extractSchema(aliases, { includeHidden: true })).toEqual(
        {
          nepali: ["panipokari", "_kuzzle_keep"],
          vietnam: ["lfiduras", "_kuzzle_keep"],
        },
      );
    });
  });

  describe("#_sanitizeSearchBody", () => {
    it("passes through every top-level keyword it allows", () => {
      const searchBody: Record<string, unknown> = {};

      for (const key of harness.client.searchBodyKeys) {
        searchBody[key] = { foo: "bar" };
      }

      expect(harness.client._sanitizeSearchBody({ ...searchBody })).toEqual(
        searchBody,
      );
    });

    it("refuses a keyword it does not know", () => {
      expect(() => harness.client._sanitizeSearchBody({ unknown: {} })).toThrow(
        expect.objectContaining({
          id: "services.storage.invalid_search_query",
        }),
      );
    });

    /*
     * An inline script is code execution on the cluster, so it is refused
     * however deeply it is buried — the walk is the point, not the top-level
     * check above.
     */
    it("refuses an inline script buried anywhere in the query", () => {
      expect(() =>
        harness.client._sanitizeSearchBody({
          query: {
            bool: {
              filter: [
                {
                  script: {
                    script: {
                      inline:
                        "doc[message.keyword].value.length() > params.length",
                      params: { length: 25 },
                    },
                  },
                },
              ],
            },
          },
        }),
      ).toThrow(
        expect.objectContaining({
          id: "services.storage.invalid_query_keyword",
        }),
      );
    });

    /* An empty query is not "no filter": Elasticsearch wants it spelled out. */
    it("turns an empty query into a match-all one", () => {
      expect(harness.client._sanitizeSearchBody({ query: {} })).toEqual({
        query: { match_all: {} },
      });
    });
  });

  describe("#_scriptCheck", () => {
    /*
     * A *stored* script is one an administrator put on the cluster, named by
     * id — nothing the caller wrote — so it is allowed where `inline` and
     * `source` are not.
     */
    it("allows a stored script, and refuses an inline or a source one", () => {
      expect(() =>
        harness.client._scriptCheck({
          query: {
            match: {
              script: { id: "count-documents", params: { length: 25 } },
            },
          },
        }),
      ).not.toThrow();

      for (const key of ["inline", "source"]) {
        expect(() =>
          harness.client._sanitizeSearchBody({
            query: {
              match: {
                script: {
                  [key]: "doc[message.keyword].value.length() > params.length",
                  params: { length: 25 },
                },
              },
            },
          }),
        ).toThrow(
          expect.objectContaining({
            id: "services.storage.invalid_query_keyword",
          }),
        );
      }
    });

    it("says nothing about a query that holds no script at all", () => {
      expect(() => harness.client._scriptCheck({ foo: "bar" })).not.toThrow();
    });
  });
}
