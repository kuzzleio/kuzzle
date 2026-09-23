/**
 * L5c — the eight query-wide actions: `scroll`, `search`, `updateByQuery`,
 * `bulkUpdateByQuery`, `deleteByQuery`, `deleteFields`, `mExecute` and
 * `_mExecute`.
 *
 * These are the actions that carry a **cursor**: a scroll id kept in the
 * internal cache, refreshed while pages remain and deleted on the last one.
 * The Mocha twins reached it through the whole-application mock; here it is
 * {@link ESHarness.ask}, armed per case, so what a scroll remembers between
 * two calls is written in the case that depends on it.
 *
 * `_mExecute` was declared **twice** in each twin — `#_mExecute` and, 2 400
 * lines later, `_mExecute` — with overlapping fixtures and one contradiction
 * between them. The two are merged here into one group; see
 * {@link describeQueries} below.
 */
import ms from "ms";
import { describe, expect, it, vi } from "vitest";

import type { ESHarness } from "./harness";

const index = "nyc-open-data";
const collection = "yellow-taxi";
const alias = "@&nyc-open-data.yellow-taxi";
const indice = "&nyc-open-data.yellow-taxi";

/**
 * The key a scroll's cursor is kept under. The subject builds it as
 * `"_docscroll_" + global.kuzzle.hash(scrollId)`, and the harness's `hash` is
 * the identity — see there for why.
 */
const cacheKey = (scrollId: string) => `_docscroll_${scrollId}`;

export function describeQueries(harness: ESHarness) {
  /** What the internal cache answers for the cursor of a running scroll. */
  const armCursor = (cursor: unknown) =>
    harness.ask.mockImplementation(async (event: string) =>
      event === "core:cache:internal:get" ? JSON.stringify(cursor) : undefined,
    );

  const askedWith = (event: string) =>
    harness.ask.mock.calls.filter((call) => call[0] === event);

  describe("#scroll", () => {
    /** Two hits from two different collections, as a multi-target scroll. */
    const twoTargets = {
      _scroll_id: "azerty",
      hits: {
        hits: [
          { _index: "&foo.foo", _id: "foo", _source: {} },
          { _index: "&bar.bar", _id: "bar", _source: {} },
        ],
        total: { value: 1000 },
      },
    };

    const targets = [
      { index: "foo", collections: ["foo"] },
      { index: "bar", collections: ["bar"] },
    ];

    /**
     * `_formatSearchResult` maps each hit's *indice* back to an index and a
     * collection through the alias it answers. The real lookup asks the
     * cluster, which is not what these cases are about.
     */
    const armAliasLookup = () =>
      vi
        .spyOn(harness.client, "_getAliasFromIndice")
        .mockImplementation((asked: string) => [`@${asked}`]);

    it("advances the cursor and maps each hit back to its collection", async () => {
      armCursor({ fetched: 1, targets });
      armAliasLookup();
      harness.clientStub.scroll.mockResolvedValue(
        harness.envelope.respond(twoTargets),
      );

      const result = await harness.client.scroll("i-am-scroll-id", {
        scrollTTL: "10s",
      });

      expect(harness.sent(harness.clientStub.scroll)).toEqual({
        scroll: "10s",
        scroll_id: "i-am-scroll-id",
      });

      /*
       * 1 already fetched + the 2 hits above. The cursor is written back
       * under the same key it was read from, with the scroll's own TTL.
       */
      expect(harness.ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        cacheKey("i-am-scroll-id"),
        JSON.stringify({ fetched: 3, targets }),
        { ttl: 10000 },
      );
      expect(harness.clientStub.clearScroll).not.toHaveBeenCalled();

      expect(result).toMatchObject({
        aggregations: undefined,
        hits: [
          { _id: "foo", _source: {}, index: "foo", collection: "foo" },
          { _id: "bar", _source: {}, index: "bar", collection: "bar" },
        ],
        remaining: 997,
        scrollId: "azerty",
        total: 1000,
      });
    });

    it("deletes the cursor and clears the scroll on the last page", async () => {
      armCursor({ fetched: 998, targets });
      armAliasLookup();
      harness.clientStub.scroll.mockResolvedValue(
        harness.envelope.respond(twoTargets),
      );

      const result = await harness.client.scroll("i-am-scroll-id", {
        scrollTTL: "10s",
      });

      expect(askedWith("core:cache:internal:store")).toHaveLength(0);
      expect(harness.ask).toHaveBeenCalledWith(
        "core:cache:internal:del",
        cacheKey("i-am-scroll-id"),
      );
      expect(harness.sent(harness.clientStub.clearScroll)).toMatchObject({
        scroll_id: "azerty",
      });

      expect(result).toMatchObject({ remaining: 0, total: 1000 });
    });

    it("defaults an explicitly null scrollTTL to the configured one", async () => {
      armCursor({ fetched: 1, index, collection });
      harness.clientStub.scroll.mockResolvedValue(
        harness.envelope.respond({
          hits: { hits: [], total: { value: 1000 } },
          _scroll_id: "azerty",
        }),
      );

      await harness.client.scroll("scroll-id", { scrollTTL: null });

      expect(harness.sent(harness.clientStub.scroll)).toEqual({
        scroll: harness.config.defaults.scrollTTL,
        scroll_id: "scroll-id",
      });
    });

    it("refuses a scroll id the cache has never heard of", async () => {
      harness.ask.mockResolvedValue(null);

      await expect(
        harness.client.scroll("i-am-scroll-id"),
      ).rejects.toMatchObject({ id: "services.storage.unknown_scroll_id" });

      expect(harness.clientStub.scroll).not.toHaveBeenCalled();
    });

    /*
     * ⚠️ The twins set `maxScrollDuration` on the config **after** the subject
     * was built — ES 7's on the dispatcher, ES 8's on the client — and the
     * subject reads `this.maxScrollDuration`, resolved once in the
     * constructor by `_loadMsConfig`. So the assignment was inert in both:
     * the case passed against the real default of `1m`, and would have passed
     * just the same with the line deleted. It is deleted here, and the
     * configurability it meant to state is a case of its own below.
     */
    it("refuses a scroll longer than the configured maximum", async () => {
      await expect(
        harness.client.scroll("i-am-scroll-id", { scrollTTL: "42m" }),
      ).rejects.toMatchObject({
        id: "services.storage.scroll_duration_too_great",
      });

      expect(harness.clientStub.scroll).not.toHaveBeenCalled();
    });

    it("reads that maximum from the config it was built with", async () => {
      harness.config.maxScrollDuration = "1h";

      const built = harness.build();

      /*
       * Past the guard now, and stopped by the *next* thing instead — the
       * cursor the cache does not hold. That is the whole assertion: the
       * limit moved because the config moved.
       */
      await expect(
        built.client.scroll("i-am-scroll-id", { scrollTTL: "42m" }),
      ).rejects.toMatchObject({ id: "services.storage.unknown_scroll_id" });
    });

    it("rejects through the wrapper when the client fails", async () => {
      armCursor({ fetched: 1, index, collection });
      harness.clientStub.scroll.mockRejectedValue(harness.esClientError);

      await expect(harness.client.scroll("i-am-scroll-id")).rejects.toBe(
        harness.esClientError,
      );

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#search", () => {
    const emptyPage = {
      hits: { hits: [], total: { value: 0 } },
      _scroll_id: "i-am-scroll-id",
    };

    it("searches one collection, stores the cursor and formats the hits", async () => {
      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond({
          aggregations: { some: "aggregs" },
          hits: {
            hits: [
              {
                _id: "liia",
                _index: indice,
                _source: { country: "Nepal" },
                _score: 42,
                highlight: "highlight",
                inner_hits: {
                  inner_name: {
                    hits: {
                      hits: [
                        { _id: "nestedLiia", _source: { city: "Kathmandu" } },
                      ],
                    },
                  },
                },
                other: "thing",
              },
            ],
            total: { value: 1 },
          },
          suggest: { some: "suggest" },
          _scroll_id: "i-am-scroll-id",
        }),
      );

      vi.spyOn(harness.client, "_getAliasFromIndice").mockReturnValue([alias]);

      const result = await harness.client.search({
        index,
        collection,
        searchBody: {},
      });

      expect(harness.sent(harness.clientStub.search)).toEqual({
        index: alias,
        from: undefined,
        size: undefined,
        scroll: undefined,
        [harness.envelope.trackTotalHits]: true,
        ...harness.envelope.request({ query: { match_all: {} } }),
      });

      expect(harness.ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        cacheKey("i-am-scroll-id"),
        JSON.stringify({ collection, fetched: 1, index }),
        { ttl: ms(harness.config.defaults.scrollTTL) },
      );

      /*
       * `other: "thing"` is dropped and `inner_hits` is flattened from the
       * client's `{ hits: { hits: [...] } }` to the array a caller reads.
       */
      expect(result).toMatchObject({
        aggregations: { some: "aggregs" },
        hits: [
          {
            index,
            collection,
            _id: "liia",
            _source: { country: "Nepal" },
            _score: 42,
            highlight: "highlight",
            inner_hits: {
              inner_name: [
                { _id: "nestedLiia", _source: { city: "Kathmandu" } },
              ],
            },
          },
        ],
        remaining: 0,
        suggest: { some: "suggest" },
        scrollId: "i-am-scroll-id",
        total: 1,
      });
    });

    it("joins every index/collection pair of a multi-target search", async () => {
      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond(emptyPage),
      );

      await harness.client.search({
        targets: [
          { index: "nyc-open-data", collections: ["yellow-taxi", "red-taxi"] },
          { index: "nyc-close-data", collections: ["green-taxi", "blue-taxi"] },
        ],
        searchBody: {},
      });

      expect(harness.sent(harness.clientStub.search)).toMatchObject({
        index:
          "@&nyc-open-data.yellow-taxi,@&nyc-open-data.red-taxi,@&nyc-close-data.green-taxi,@&nyc-close-data.blue-taxi",
      });
    });

    it("refuses a search that names neither an index nor targets", async () => {
      await expect(
        harness.client.search({ searchBody: {} }),
      ).rejects.toMatchObject({ id: "services.storage.missing_argument" });

      expect(harness.clientStub.search).not.toHaveBeenCalled();
    });

    it("carries from, size and scroll, and gives the cursor the scroll's TTL", async () => {
      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond(emptyPage),
      );

      await harness.client.search(
        { index, collection, searchBody: {} },
        { from: 0, scroll: "30s", size: 1 },
      );

      expect(harness.sent(harness.clientStub.search)).toMatchObject({
        index: alias,
        from: 0,
        scroll: "30s",
        size: 1,
        [harness.envelope.trackTotalHits]: true,
      });

      expect(harness.ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        cacheKey("i-am-scroll-id"),
        JSON.stringify({ collection, fetched: 0, index }),
        { ttl: 30000 },
      );
    });

    it("searches a collection whose name is not a valid ES index name", async () => {
      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond({ hits: { hits: [], total: { value: 0 } } }),
      );

      await harness.client.search({
        index: "main",
        collection: "kuzzleData",
        searchBody: {},
      });

      expect(harness.sent(harness.clientStub.search)).toMatchObject({
        index: "@&main.kuzzleData",
      });
    });

    it("stores no cursor when the answer carries no scroll id", async () => {
      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond({ hits: { hits: [], total: { value: 0 } } }),
      );

      await harness.client.search({ index, collection, searchBody: {} });

      expect(askedWith("core:cache:internal:store")).toHaveLength(0);
    });

    it("refuses a search body holding an unauthorized property", async () => {
      await expect(
        harness.client.search({
          index,
          collection,
          searchBody: { not_authorized: 42, query: {} },
        }),
      ).rejects.toMatchObject({ id: "services.storage.invalid_search_query" });

      expect(harness.clientStub.search).not.toHaveBeenCalled();
    });

    it("refuses a scroll longer than the configured maximum", async () => {
      await expect(
        harness.client.search(
          { index, collection, searchBody: {} },
          { scroll: "42m" },
        ),
      ).rejects.toMatchObject({
        id: "services.storage.scroll_duration_too_great",
      });

      expect(harness.clientStub.search).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.search.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.search({ index, collection, searchBody: {} }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#updateByQuery", () => {
    /**
     * The action is a fetch followed by an `mUpdate`, and both halves are the
     * subject's own methods. Stubbing them is what the twins did and what
     * keeps this group about the *joining*: which documents are handed over,
     * with which options, and what comes back.
     */
    const armFetchAndUpdate = () => {
      vi.spyOn(harness.client, "_getAllDocumentsFromQuery").mockResolvedValue([
        { _id: "_id1", _source: { name: "Ok" } },
        { _id: "_id2", _source: { name: "Ok" } },
      ]);

      vi.spyOn(harness.client, "mUpdate").mockResolvedValue({
        items: [
          { _id: "_id1", _source: { name: "bar" }, status: 200 },
          { _id: "_id2", _source: { name: "bar" }, status: 200 },
        ],
        errors: [],
      });
    };

    /** Each fetched document, rewritten into what `mUpdate` takes. */
    const handedOver = [
      { _id: "_id1", _source: undefined, body: { name: "bar" } },
      { _id: "_id2", _source: undefined, body: { name: "bar" } },
    ];

    it("updates every document the query matched", async () => {
      armFetchAndUpdate();

      const result = await harness.client.updateByQuery(
        index,
        collection,
        { filter: { term: { name: "Ok" } } },
        { name: "bar" },
      );

      expect(harness.client.mUpdate).toHaveBeenCalledWith(
        index,
        collection,
        handedOver,
        { refresh: undefined, userId: null },
      );

      expect(result).toEqual({
        successes: [
          { _id: "_id1", _source: { name: "bar" }, status: 200 },
          { _id: "_id2", _source: { name: "bar" }, status: 200 },
        ],
        errors: [],
      });
    });

    it("carries refresh, user and size", async () => {
      armFetchAndUpdate();

      await harness.client.updateByQuery(
        index,
        collection,
        { filter: "term" },
        { name: "bar" },
        { refresh: "wait_for", size: 3, userId: "aschen" },
      );

      expect(harness.client._getAllDocumentsFromQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          index: alias,
          scroll: "5s",
          size: 3,
          ...harness.envelope.request({ query: { filter: "term" } }),
        }),
      );

      expect(harness.client.mUpdate).toHaveBeenCalledWith(
        index,
        collection,
        handedOver,
        { refresh: "wait_for", userId: "aschen" },
      );
    });

    it("refuses to touch more documents than the configured limit", async () => {
      harness.limits.documentsFetchCount = 2;

      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond({
          hits: { hits: [], total: { value: 99999 } },
          _scroll_id: "foobar",
        }),
      );

      await expect(
        harness.client.updateByQuery(index, collection, {}, {}),
      ).rejects.toMatchObject({
        id: "services.storage.write_limit_exceeded",
      });
    });
  });

  describe("#bulkUpdateByQuery", () => {
    const query = { match: { foo: "bar" } };
    const changes = { bar: "foo" };

    /** The one request the action builds: the query plus a painless script. */
    const request = (refresh: unknown = false) => ({
      index: alias,
      refresh,
      ...harness.envelope.request({
        query,
        script: {
          params: { bar: "foo" },
          source: "ctx._source.bar = params['bar'];",
        },
      }),
    });

    const armUpdate = (payload: Record<string, unknown>) =>
      harness.clientStub.updateByQuery.mockResolvedValue(
        harness.envelope.respond(payload),
      );

    it("turns the changes into a script and answers the updated count", async () => {
      armUpdate({ total: 42, updated: 42, failures: [] });

      expect(
        await harness.client.bulkUpdateByQuery(
          index,
          collection,
          query,
          changes,
        ),
      ).toEqual({ updated: 42 });

      expect(harness.sent(harness.clientStub.updateByQuery)).toEqual(request());
    });

    it("carries refresh when given", async () => {
      armUpdate({ total: 42, updated: 42, failures: [] });

      await harness.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        changes,
        {
          refresh: "wait_for",
        },
      );

      expect(harness.sent(harness.clientStub.updateByQuery)).toEqual(
        request("wait_for"),
      );
    });

    it("sends no script at all when there is nothing to change", async () => {
      armUpdate({ total: 0, updated: 0, failures: [] });

      await harness.client.bulkUpdateByQuery(index, collection, query, {});

      expect(harness.sent(harness.clientStub.updateByQuery)).toEqual({
        index: alias,
        refresh: false,
        ...harness.envelope.request({ query }),
      });
    });

    /*
     * A partial failure is a *rejection* here, not a result with an `errors`
     * array: the caller is told how many went through before it happened, and
     * has no way to learn which ones.
     */
    it("rejects when some shards failed, naming the count that went through", async () => {
      armUpdate({
        total: 3,
        updated: 2,
        failures: [harness.envelope.queryFailure],
      });

      await expect(
        harness.client.bulkUpdateByQuery(index, collection, query, changes),
      ).rejects.toMatchObject({
        id: "services.storage.incomplete_update",
        message:
          "2 documents were successfully updated before an error occured",
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.updateByQuery.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.bulkUpdateByQuery(index, collection, query, changes),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#deleteByQuery", () => {
    const documents = [
      { _id: "_id1", _source: "_source1" },
      { _id: "_id2", _source: "_source2" },
    ];

    const armFetchAndDelete = () => {
      vi.spyOn(harness.client, "_getAllDocumentsFromQuery").mockResolvedValue(
        documents,
      );

      harness.clientStub.deleteByQuery.mockResolvedValue(
        harness.envelope.respond({
          total: 2,
          deleted: 1,
          failures: [harness.envelope.queryFailure],
        }),
      );
    };

    it("fetches the documents it is about to delete, then deletes them", async () => {
      armFetchAndDelete();

      const result = await harness.client.deleteByQuery(index, collection, {
        filter: "term",
      });

      expect(harness.sent(harness.clientStub.deleteByQuery)).toMatchObject({
        index: alias,
        scroll: "5s",
        [harness.envelope.deleteLimit]: 1000,
        refresh: undefined,
        ...harness.envelope.request({ query: { filter: "term" } }),
      });

      expect(harness.client._getAllDocumentsFromQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          index: alias,
          scroll: "5s",
          size: 1000,
          ...harness.envelope.request({ query: { filter: "term" } }),
        }),
      );

      /* A failure is reported, but the action still resolves. */
      expect(result).toEqual({
        documents,
        total: 2,
        deleted: 1,
        failures: [harness.envelope.reportedFailure],
      });
    });

    it("carries refresh and a document limit", async () => {
      armFetchAndDelete();

      await harness.client.deleteByQuery(
        index,
        collection,
        { filter: "term" },
        { refresh: "wait_for", from: 1, size: 3 },
      );

      expect(harness.sent(harness.clientStub.deleteByQuery)).toMatchObject({
        index: alias,
        [harness.envelope.deleteLimit]: 3,
        // `wait_for` is not a value `deleteByQuery` accepts: it becomes `true`.
        refresh: true,
      });
    });

    it("skips the fetch, and answers no documents, when asked not to", async () => {
      armFetchAndDelete();

      const result = await harness.client.deleteByQuery(
        index,
        collection,
        { filter: "term" },
        { fetch: false },
      );

      expect(harness.client._getAllDocumentsFromQuery).not.toHaveBeenCalled();
      expect(harness.clientStub.deleteByQuery).toHaveBeenCalled();

      expect(result).toMatchObject({ documents: [], total: 2, deleted: 1 });
    });

    it("refuses a query that is not an object", async () => {
      await expect(
        harness.client.deleteByQuery(index, collection, "not an object"),
      ).rejects.toMatchObject({ id: "services.storage.missing_argument" });

      expect(harness.clientStub.deleteByQuery).not.toHaveBeenCalled();
    });

    it("refuses to delete more documents than the configured limit", async () => {
      harness.limits.documentsFetchCount = 2;

      harness.clientStub.search.mockResolvedValue(
        harness.envelope.respond({
          hits: { hits: [], total: { value: 99999 } },
          _scroll_id: "foobar",
        }),
      );

      await expect(
        harness.client.deleteByQuery(index, collection, {}),
      ).rejects.toMatchObject({
        id: "services.storage.write_limit_exceeded",
      });
    });

    it("rejects through the wrapper when the client fails", async () => {
      vi.spyOn(harness.client, "_getAllDocumentsFromQuery").mockResolvedValue(
        documents,
      );
      harness.clientStub.deleteByQuery.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.deleteByQuery(index, collection, { filter: "term" }),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#deleteFields", () => {
    const armGetAndIndex = () => {
      harness.clientStub.get.mockResolvedValue(
        harness.envelope.respond({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu", useless: "somevalue" },
        }),
      );

      harness.clientStub.index.mockResolvedValue(
        harness.envelope.respond({ _id: "liia", _version: 2 }),
      );
    };

    it("re-indexes the document without the named fields", async () => {
      armGetAndIndex();

      const result = await harness.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
      );

      expect(harness.sent(harness.clientStub.get)).toMatchObject({
        index: alias,
        id: "liia",
      });

      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        index: alias,
        id: "liia",
        refresh: undefined,
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: { updatedAt: harness.timestamp, updater: null },
        }),
      });

      /*
       * The answer is the document the subject built, with `_version` from
       * what the client echoed — the same shape `create` and `replace` answer
       * (see L5b), here without the client having to echo a source at all.
       */
      expect(result).toMatchObject({
        _id: "liia",
        _version: 2,
        _source: { city: "Kathmandu" },
      });
    });

    it("carries refresh and stamps the user who asked", async () => {
      armGetAndIndex();

      await harness.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
        { refresh: "wait_for", userId: "aschen" },
      );

      expect(harness.sent(harness.clientStub.index)).toMatchObject({
        refresh: "wait_for",
        ...harness.envelope.documentRequest({
          city: "Kathmandu",
          _kuzzle_info: { updatedAt: harness.timestamp, updater: "aschen" },
        }),
      });
    });

    it("never writes when the document cannot be read", async () => {
      harness.clientStub.get.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.deleteFields(index, collection, "liia", ["useless"]),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
      expect(harness.clientStub.index).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the write fails", async () => {
      armGetAndIndex();
      harness.clientStub.index.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.deleteFields(index, collection, "liia", ["useless"]),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });

    /*
     * ⚠️ A **behaviour** divergence, not a transport one — the only one L5c
     * found, and the reason it is written as a branch rather than an envelope
     * entry. ES 8 checks that the answer carries a `_source` and raises
     * `not_found`; ES 7 walks straight into `_.has(undefined, field)` and then
     * assigns onto it, so the caller gets whatever `formatESError` makes of a
     * `TypeError` instead of the error the case names. Only the ES 8 twin had
     * a case for it.
     */
    it("refuses a document the client answered without a source", async () => {
      harness.clientStub.get.mockResolvedValue(
        harness.envelope.respond({ _id: "liia", _version: 1 }),
      );

      const rejection = expect(
        harness.client.deleteFields(index, collection, "liia", ["useless"]),
      ).rejects;

      if (harness.envelope.version === "8") {
        await rejection.toMatchObject({ id: "services.storage.not_found" });
      } else {
        await rejection.toThrow(TypeError);
      }

      expect(harness.clientStub.index).not.toHaveBeenCalled();
    });
  });

  describe("#mExecute", () => {
    it("hands each scrolled batch to the callback, and collects the answers", async () => {
      const firstPage = { hits: [21, 42, 84], total: { value: 5 } };
      const secondPage = { hits: [168, 336], total: { value: 5 } };

      const callback = vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      harness.envelope.answerScroll(harness.clientStub.search, {
        hits: firstPage,
        _scroll_id: "scroll-id",
      });
      harness.envelope.answerScroll(harness.clientStub.scroll, {
        hits: secondPage,
        _scroll_id: "scroll-id",
      });

      expect(
        await harness.client.mExecute(
          index,
          collection,
          { match: 21 },
          callback,
        ),
      ).toEqual([1, 2]);

      expect(harness.clientStub.search.mock.calls[0][0]).toMatchObject({
        index: alias,
        scroll: "5s",
        from: 0,
        size: 10,
        ...harness.envelope.request({ query: { match: 21 } }),
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0][0]).toEqual(firstPage.hits);
      expect(callback.mock.calls[1][0]).toEqual(secondPage.hits);
    });

    it("refuses a query that is not an object", async () => {
      await expect(
        harness.client.mExecute(index, collection, "not an object", () => {}),
      ).rejects.toMatchObject({ id: "services.storage.missing_argument" });

      expect(harness.clientStub.search).not.toHaveBeenCalled();
    });
  });

  /*
   * ⚠️ `_mExecute` was declared **twice** in each twin — `#_mExecute` near the
   * top and a second `_mExecute` 2 400 lines down — each with its own fixture
   * and neither mentioning the other. Together they made nine `it`s covering
   * seven distinct behaviours, and they disagreed on one: the first said a
   * bulk answer row with no matching document is *skipped*, the second said
   * an errored row is reported. Both are true, of different rows, which only
   * reading them side by side shows. One group here.
   */
  describe("#_mExecute", () => {
    /*
     * ⚠️ A **factory**, not a shared constant: `_extractMDocuments` rewrites
     * each document it is given in place — `_source` out, `body` in — so a
     * fixture declared once is a different thing by the second case that uses
     * it. The twins only ever handed it fresh literals, so neither said so.
     */
    const twoDocuments = () => [
      { _id: "liia", _source: { city: "Kathmandu" } },
      { _id: "mehry", _source: { city: "Ho Chi Minh City" } },
    ];

    /** An empty bulk request, in whichever field this client carries one. */
    const esRequest = () => ({
      index: alias,
      refresh: undefined,
      [harness.envelope.bulkOperations]: [],
    });

    const armBulk = (items: unknown[]) =>
      harness.clientStub.bulk.mockResolvedValue(
        harness.envelope.respond({ items }),
      );

    it("splits the bulk answer into successes and per-document errors", async () => {
      armBulk([
        { index: { _id: "liia", _version: 1, result: "created", status: 201 } },
        { index: { _id: "mehry", status: 404 } },
      ]);

      const result = await harness.client._mExecute(
        esRequest(),
        twoDocuments(),
      );

      expect(result.items).toMatchObject([
        {
          _id: "liia",
          _source: { city: "Kathmandu" },
          _version: 1,
          created: true,
          status: 201,
        },
      ]);

      /* A 404 has no `error.reason`, so the subject supplies the wording. */
      expect(result.errors).toMatchObject([
        {
          document: { _id: "mehry", body: { city: "Ho Chi Minh City" } },
          reason: "document not found",
          status: 404,
        },
      ]);
    });

    it("reports the reason Elasticsearch gave for any other rejection", async () => {
      armBulk([
        {
          index: {
            _id: "liia",
            error: { reason: "mapping is strict" },
            status: 400,
          },
        },
      ]);

      const result = await harness.client._mExecute(esRequest(), [
        twoDocuments()[0],
      ]);

      expect(result.items).toEqual([]);
      expect(result.errors).toMatchObject([
        {
          document: { _id: "liia", _source: { city: "Kathmandu" } },
          reason: "mapping is strict",
          status: 400,
        },
      ]);
    });

    it("skips an answer row that matches no document it sent", async () => {
      armBulk([
        { index: { _id: "liia", _version: 1, result: "created", status: 201 } },
        {},
        { index: { _id: "ghost", status: 201 } },
      ]);

      const result = await harness.client._mExecute(esRequest(), [
        twoDocuments()[0],
      ]);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ _id: "liia" });
      expect(result.errors).toEqual([]);
    });

    it("carries the errors it was handed, ahead of the ones it found", async () => {
      const handedIn = {
        document: { body: { some: "document" } },
        status: 400,
        reason: "some reason",
      };
      const partialErrors = [handedIn];

      armBulk([
        { index: { _id: "liia", _version: 1, result: "created", status: 201 } },
        {
          index: {
            _id: "mehry",
            status: 400,
            error: { reason: "bad request" },
          },
        },
      ]);

      const result = await harness.client._mExecute(
        esRequest(),
        twoDocuments(),
        partialErrors,
      );

      /*
       * A 404 is reported as `{ _id, body }` — the shape the `m*` callers
       * read back — and anything else as the document **whole**, `_source`
       * and all. Two shapes under one key, which only the two cases side by
       * side state.
       */
      const found = {
        document: { _id: "mehry", _source: { city: "Ho Chi Minh City" } },
        status: 400,
        reason: "bad request",
      };

      expect(result.errors).toMatchObject([handedIn, found]);

      /*
       * ⚠️ **Filed, not fixed** (this is a porting slice): `partialErrors` is
       * not read and copied, it is `push`ed onto — so the array a caller
       * handed in comes back holding the subject's own findings, and
       * `result.errors` *is* that same array. The port's first attempt wrote
       * the expectation as `[...partialErrors, found]` and failed with three
       * errors against two, which is how this surfaced. Same family as the
       * `_kuzzle_info` stamping [L5b](../../../../docs/adr-001/steps/13-sprint-10-test-closure.md#three-actions-answer-the-document-they-sent-not-the-one-es-echoed)
       * found: the subject writes on what it was lent.
       */
      expect(partialErrors).toBe(result.errors);
      expect(partialErrors).toHaveLength(2);
    });

    it("does not call the client when there is nothing to write", async () => {
      const result = await harness.client._mExecute(esRequest(), []);

      expect(harness.clientStub.bulk).not.toHaveBeenCalled();
      expect(result).toEqual({ errors: [], items: [] });
    });

    it("still answers the errors it was handed when there is nothing to write", async () => {
      const partialErrors = [
        {
          document: { body: { some: "document" } },
          status: 400,
          reason: "some reason",
        },
      ];

      const result = await harness.client._mExecute(
        esRequest(),
        [],
        partialErrors,
      );

      expect(harness.clientStub.bulk).not.toHaveBeenCalled();
      expect(result).toEqual({ errors: partialErrors, items: [] });
    });

    it("refuses to write more documents than the configured limit", async () => {
      harness.limits.documentsWriteCount = 1;

      await expect(
        harness.client._mExecute(esRequest(), twoDocuments()),
      ).rejects.toMatchObject({ id: "services.storage.write_limit_exceeded" });

      expect(harness.clientStub.bulk).not.toHaveBeenCalled();
    });

    it("writes past that limit when the caller opts out of it", async () => {
      harness.limits.documentsWriteCount = 1;
      armBulk([]);

      await expect(
        harness.client._mExecute(esRequest(), twoDocuments(), [], {
          limits: false,
        }),
      ).resolves.toMatchObject({ items: [] });
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.bulk.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client._mExecute(esRequest(), twoDocuments()),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });
}
