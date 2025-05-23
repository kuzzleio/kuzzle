"use strict";

const should = require("should");
const sinon = require("sinon");
const ms = require("ms");
const mockRequire = require("mock-require");

const {
  BadRequestError,
  MultipleErrorsError,
  PreconditionError,
  SizeLimitError,
} = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const ESClientMock = require("../../mocks/service/elasticsearchClient.mock");

const { storeScopeEnum } = require("../../../lib/core/storage/storeScopeEnum");
const { Mutex } = require("../../../lib/util/mutex");

describe("Test: ElasticSearch service", () => {
  let kuzzle;
  let index;
  let collection;
  let alias;
  let indice;
  let elasticsearch;
  let timestamp;
  let esClientError;
  let ES;

  before(() => {
    ES = mockRequire.reRequire(
      "../../../lib/service/storage/Elasticsearch",
    ).Elasticsearch;
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    kuzzle.config.services.storageEngine.majorVersion = "8";

    index = "nyc-open-data";
    collection = "yellow-taxi";
    alias = "@&nyc-open-data.yellow-taxi";
    indice = "&nyc-open-data.yellow-taxi";
    timestamp = Date.now();

    esClientError = new Error("es client fail");

    elasticsearch = new ES(kuzzle.config.services.storageEngine);
    elasticsearch.client._client = new ESClientMock("8.0.0");

    await elasticsearch.init();

    elasticsearch.client._esWrapper = {
      reject: sinon.spy((error) => Promise.reject(error)),
      formatESError: sinon.spy((error) => error),
    };

    sinon.stub(Date, "now").returns(timestamp);

    sinon.stub(Mutex.prototype, "lock").resolves();
    sinon.stub(Mutex.prototype, "unlock").resolves();
  });

  afterEach(() => {
    Date.now.restore();
  });

  describe("#constructor", () => {
    it("should initialize properties", () => {
      const esInternal = new ES(
        kuzzle.config.services.storageEngine,
        storeScopeEnum.PRIVATE,
      );

      sinon.stub(esInternal.client, "waitForElasticsearch").resolves();
      esInternal.client._client = new ESClientMock("8.0.0");

      should(elasticsearch.config).be.exactly(
        kuzzle.config.services.storageEngine,
      );
      should(elasticsearch.client._indexPrefix).be.eql("&");
      should(esInternal.client._indexPrefix).be.eql("%");
    });
  });

  describe("#init", () => {
    it("should initialize properly", () => {
      const promise = elasticsearch.init();

      return should(promise)
        .be.fulfilledWith()
        .then(() => {
          should(elasticsearch.client._client).not.be.null();
          should(elasticsearch.client._esWrapper).not.be.null();
          should(elasticsearch.client.esVersion).not.be.null();
        });
    });
  });

  describe("#stats", () => {
    beforeEach(() => {
      elasticsearch.client._client.indices.stats.resolves({
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
          ".geoip_databases": {
            /* This index natively do not return anything on index:stats call */
          },
        },
      });
      sinon
        .stub(elasticsearch.client, "_getAliasFromIndice")
        .callsFake((indiceArg) => [`@${indiceArg}`]);
    });

    afterEach(() => {
      elasticsearch.client._getAliasFromIndice.restore();
    });

    it("should only request required stats from underlying client", async () => {
      const esRequest = {
        metric: ["docs", "store"],
      };

      await elasticsearch.client.stats();

      should(elasticsearch.client._client.indices.stats)
        .calledOnce()
        .calledWithMatch(esRequest);
    });

    it("should as default ignore private and hidden indices", async () => {
      const result = await elasticsearch.client.stats();

      should(result).be.match({
        size: 20,
        indexes: [
          {
            name: "test-index",
            size: 20,
            collections: [
              {
                name: "test-collection",
                documentCount: 2,
                size: 20,
              },
            ],
          },
        ],
      });
    });
  });

  describe("#scroll", () => {
    it("should be able to scroll an old search", async () => {
      const cacheStub = kuzzle.ask.withArgs("core:cache:internal:get").resolves(
        JSON.stringify({
          fetched: 1,
          targets: [
            {
              index: "foo",
              collections: ["foo"],
            },
            {
              index: "bar",
              collections: ["bar"],
            },
          ],
        }),
      );

      elasticsearch.client._client.scroll.resolves({
        _scroll_id: "azerty",
        hits: {
          hits: [
            { _index: "&foo.foo", _id: "foo", _source: {} },
            { _index: "&bar.bar", _id: "bar", _source: {} },
          ],
          total: { value: 1000 },
        },
      });

      elasticsearch.client._getAliasFromIndice = sinon.stub();
      elasticsearch.client._getAliasFromIndice
        .withArgs("&foo.foo")
        .returns(["@&foo.foo"]);
      elasticsearch.client._getAliasFromIndice
        .withArgs("&bar.bar")
        .returns(["@&bar.bar"]);

      const result = await elasticsearch.client.scroll("i-am-scroll-id", {
        scrollTTL: "10s",
      });

      should(cacheStub).calledOnce();

      const redisKey = cacheStub.firstCall.args[1];

      // 3:
      //   the redis key stub returns "1" (1 result fetched so far) +
      //   the 2 results contained in the stubbed result of _client.scroll
      // 10: scrollTTL of 10s
      should(kuzzle.ask).calledWith(
        "core:cache:internal:store",
        redisKey,
        JSON.stringify({
          fetched: 3,
          targets: [
            {
              index: "foo",
              collections: ["foo"],
            },
            {
              index: "bar",
              collections: ["bar"],
            },
          ],
        }),
        { ttl: 10000 },
      );

      should(elasticsearch.client._client.clearScroll).not.called();

      should(
        elasticsearch.client._client.scroll.firstCall.args[0],
      ).be.deepEqual({
        scroll: "10s",
        scroll_id: "i-am-scroll-id",
      });

      should(result).be.match({
        aggregations: undefined,
        hits: [
          {
            _id: "foo",
            _source: {},
            index: "foo",
            collection: "foo",
          },
          {
            _id: "bar",
            _source: {},
            index: "bar",
            collection: "bar",
          },
        ],
        remaining: 997,
        scrollId: "azerty",
        total: 1000,
      });
    });

    it("should clear a scroll upon fetching its last page of results", async () => {
      const cacheStub = kuzzle.ask.withArgs("core:cache:internal:get").resolves(
        JSON.stringify({
          fetched: 998,
          targets: [
            {
              index: "foo",
              collections: ["foo"],
            },
            {
              index: "bar",
              collections: ["bar"],
            },
          ],
        }),
      );

      elasticsearch.client._client.scroll.resolves({
        hits: {
          hits: [
            { _index: "&foo.foo", _id: "foo", _source: {} },
            { _index: "&bar.bar", _id: "bar", _source: {} },
          ],
          total: { value: 1000 },
        },
        _scroll_id: "azerty",
      });

      elasticsearch.client._getAliasFromIndice = sinon.stub();
      elasticsearch.client._getAliasFromIndice
        .withArgs("&foo.foo")
        .returns(["@&foo.foo"]);
      elasticsearch.client._getAliasFromIndice
        .withArgs("&bar.bar")
        .returns(["@&bar.bar"]);

      const result = await elasticsearch.client.scroll("i-am-scroll-id", {
        scrollTTL: "10s",
      });

      should(cacheStub).be.calledOnce();

      const redisKey = cacheStub.firstCall.args[1];

      should(kuzzle.ask).not.calledWith("core:cache:internal:store");
      should(kuzzle.ask).calledWith("core:cache:internal:del", redisKey);

      should(elasticsearch.client._client.clearScroll)
        .calledOnce()
        .calledWithMatch({ scroll_id: "azerty" });

      should(
        elasticsearch.client._client.scroll.firstCall.args[0],
      ).be.deepEqual({
        scroll: "10s",
        scroll_id: "i-am-scroll-id",
      });

      should(result).be.match({
        aggregations: undefined,
        hits: [
          {
            _id: "foo",
            _source: {},
            index: "foo",
            collection: "foo",
          },
          {
            _id: "bar",
            _source: {},
            index: "bar",
            collection: "bar",
          },
        ],
        remaining: 0,
        scrollId: "azerty",
        total: 1000,
      });
    });

    it("should reject promise if a scroll fails", async () => {
      elasticsearch.client._client.scroll.rejects(esClientError);

      kuzzle.ask.withArgs("core:cache:internal:get").resolves("1");

      await should(elasticsearch.client.scroll("i-am-scroll-id")).be.rejected();

      should(elasticsearch.client._esWrapper.formatESError).calledWith(
        esClientError,
      );
    });

    it("should reject if the scrollId does not exists in Kuzzle cache", async () => {
      kuzzle.ask.withArgs("core:cache:internal:get").resolves(null);

      await should(
        elasticsearch.client.scroll("i-am-scroll-id"),
      ).be.rejectedWith({
        id: "services.storage.unknown_scroll_id",
      });

      should(elasticsearch.client._client.scroll).not.be.called();
    });

    it("should reject if the scroll duration is too great", async () => {
      elasticsearch.client._config.maxScrollDuration = "21m";

      await should(
        elasticsearch.client.scroll("i-am-scroll-id", { scrollTTL: "42m" }),
      ).be.rejectedWith({ id: "services.storage.scroll_duration_too_great" });

      should(elasticsearch.client._client.scroll).not.be.called();
    });

    it("should default an explicitly null scrollTTL argument", async () => {
      const cacheStub = kuzzle.ask
        .withArgs("core:cache:internal:get", sinon.match.string)
        .resolves(
          JSON.stringify({
            fetched: 1,
            index,
            collection,
          }),
        );

      elasticsearch.client._client.scroll.resolves({
        hits: { hits: [], total: { value: 1000 } },
        _scroll_id: "azerty",
      });

      await elasticsearch.client.scroll("scroll-id", { scrollTTL: null });

      should(cacheStub).calledOnce();
      should(kuzzle.ask).calledWith(
        "core:cache:internal:store",
        sinon.match.string,
        JSON.stringify({
          fetched: 1,
          index,
          collection,
        }),
        sinon.match.object,
      );

      should(
        elasticsearch.client._client.scroll.firstCall.args[0],
      ).be.deepEqual({
        scroll: elasticsearch.config.defaults.scrollTTL,
        scroll_id: "scroll-id",
      });
    });
  });

  describe("#search", () => {
    let searchBody;

    beforeEach(() => {
      searchBody = {};
    });

    it("should join multi indexes and collections when specified with targets", async () => {
      elasticsearch.client._client.search.rejects(new Error()); // Skip rest of the execution

      try {
        await elasticsearch.client.search({
          targets: [
            {
              index: "nyc-open-data",
              collections: ["yellow-taxi", "red-taxi"],
            },
            {
              index: "nyc-close-data",
              collections: ["green-taxi", "blue-taxi"],
            },
          ],
          searchBody,
        });
      } catch (error) {
        // Catch error since we throw to skip the rest of the execution
      } finally {
        should(elasticsearch.client._client.search.firstCall.args[0]).match({
          index:
            "@&nyc-open-data.yellow-taxi,@&nyc-open-data.red-taxi,@&nyc-close-data.green-taxi,@&nyc-close-data.blue-taxi",
          query: { match_all: {} },
          from: undefined,
          size: undefined,
          scroll: undefined,
          track_total_hits: true,
        });
      }
    });

    it("should be able to search documents", async () => {
      elasticsearch.client._client.search.resolves({
        ...searchBody,
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
                      {
                        _id: "nestedLiia",
                        _source: { city: "Kathmandu" },
                      },
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
      });

      elasticsearch.client._getAliasFromIndice = sinon.stub();
      elasticsearch.client._getAliasFromIndice
        .withArgs(indice)
        .returns([alias]);

      const result = await elasticsearch.client.search({
        index,
        collection,
        searchBody,
      });

      should(elasticsearch.client._client.search.firstCall.args[0]).match({
        index: alias,
        query: { match_all: {} },
        from: undefined,
        size: undefined,
        scroll: undefined,
        track_total_hits: true,
      });

      should(kuzzle.ask).calledWith(
        "core:cache:internal:store",
        sinon.match.string,
        JSON.stringify({
          collection,
          fetched: 1,
          index,
        }),
        { ttl: ms(elasticsearch.config.defaults.scrollTTL) },
      );

      should(result).match({
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
                {
                  _id: "nestedLiia",
                  _source: { city: "Kathmandu" },
                },
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

    it("should be able to search with from/size and scroll arguments", async () => {
      elasticsearch.client._client.search.resolves({
        hits: { hits: [], total: { value: 0 } },
        _scroll_id: "i-am-scroll-id",
      });

      await elasticsearch.client.search(
        { index, collection, searchBody },
        { from: 0, scroll: "30s", size: 1 },
      );

      should(elasticsearch.client._client.search.firstCall.args[0]).match({
        ...searchBody,
        from: 0,
        index: alias,
        scroll: "30s",
        size: 1,
        track_total_hits: true,
      });

      should(kuzzle.ask).calledWith(
        "core:cache:internal:store",
        sinon.match.string,
        JSON.stringify({
          collection,
          fetched: 0,
          index,
        }),
        { ttl: 30000 },
      );
    });

    it("should be able to search on ES alias with invalid collection name", async () => {
      elasticsearch.client._client.search.resolves({
        hits: { hits: [], total: { value: 0 } },
      });

      await elasticsearch.client.search({
        index: "main",
        collection: "kuzzleData",
        searchBody,
      });

      should(elasticsearch.client._client.search.firstCall.args[0]).match({
        ...searchBody,
        index: "@&main.kuzzleData",
        track_total_hits: true,
      });
    });

    it("should return a rejected promise if a search fails", async () => {
      elasticsearch.client._client.search.rejects(esClientError);

      await should(
        elasticsearch.client.search({ index, collection, searchBody }),
      ).be.rejected();

      should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
        esClientError,
      );
    });

    it("should return a rejected promise if an unhautorized property is in the query", () => {
      searchBody = {
        not_authorized: 42,
        query: {},
      };

      return should(
        elasticsearch.client.search({ index, collection, searchBody }),
      ).be.rejectedWith({ id: "services.storage.invalid_search_query" });
    });

    it("should not save the scrollId in the cache if not present in response", async () => {
      elasticsearch.client._client.search.resolves({
        hits: { hits: [], total: { value: 0 } },
      });

      await elasticsearch.client.search({ index, collection, searchBody: {} });

      should(kuzzle.ask).not.calledWith("core:cache:internal:store");
    });

    it("should return a rejected promise if the scroll duration is too great", async () => {
      elasticsearch.client._config.maxScrollDuration = "21m";

      const promise = elasticsearch.client.search(
        { index, collection, searchBody },
        { scroll: "42m" },
      );

      await should(promise).be.rejectedWith({
        id: "services.storage.scroll_duration_too_great",
      });

      should(elasticsearch.client._client.search).not.be.called();
    });
  });

  describe("#get", () => {
    it("should allow getting a single document", () => {
      elasticsearch.client._client.get.resolves({
        _id: "liia",
        _source: { city: "Kathmandu" },
        _version: 1,
      });

      const promise = elasticsearch.client.get(index, collection, "liia");

      return promise.then((result) => {
        should(elasticsearch.client._client.get).be.calledWithMatch({
          index: alias,
          id: "liia",
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should reject requests when the user search for a document with id _search", () => {
      const promise = elasticsearch.client.get(index, collection, "_search");

      return should(promise).be.rejectedWith({
        id: "services.storage.search_as_an_id",
      });
    });

    it("should return a rejected promise if a get fails", () => {
      elasticsearch.client._client.get.rejects(esClientError);

      const promise = elasticsearch.client.get(index, collection, "liia");

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#mGet", () => {
    it("should allow getting multiples documents", () => {
      elasticsearch.client._client.mget.resolves({
        docs: [
          {
            _id: "liia",
            found: true,
            _source: { city: "Kathmandu" },
            _version: 1,
          },
          { _id: "mhery", found: false },
        ],
      });

      const promise = elasticsearch.client.mGet(index, collection, [
        "liia",
        "mhery",
      ]);

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          docs: [
            { _id: "liia", _index: alias },
            { _id: "mhery", _index: alias },
          ],
        });

        should(result).match({
          items: [{ _id: "liia", _source: { city: "Kathmandu" }, _version: 1 }],
          errors: ["mhery"],
        });
      });
    });

    it("should return a rejected promise if client.mget fails", () => {
      elasticsearch.client._client.mget.rejects(esClientError);

      const promise = elasticsearch.client.mGet(index, collection, ["liia"]);

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#mExists", () => {
    it("should allow getting multiples existing documents", () => {
      elasticsearch.client._client.mget.resolves({
        docs: [
          { _id: "foo", found: true },
          { _id: "bar", found: false },
        ],
      });

      const promise = elasticsearch.client.mExists(index, collection, [
        "foo",
        "bar",
      ]);

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          docs: [{ _id: "foo" }, { _id: "bar" }],
          index: alias,
        });

        should(result).match({
          items: ["foo"],
          errors: ["bar"],
        });
      });
    });

    it("should return a rejected promise if client.mget fails", () => {
      elasticsearch.client._client.mget.rejects(esClientError);

      const promise = elasticsearch.client.mExists(index, collection, ["foo"]);

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#count", () => {
    it("should allow counting documents using a provided filter", () => {
      const filter = {
        query: {
          match_all: {},
        },
      };
      elasticsearch.client._client.count.resolves({
        count: 42,
      });

      const promise = elasticsearch.client.count(index, collection, filter);

      return promise.then((result) => {
        should(elasticsearch.client._client.count).be.calledWithMatch({
          ...filter,
          index: alias,
        });

        should(result).be.eql(42);
      });
    });

    it("should return a rejected promise if count fails", () => {
      elasticsearch.client._client.count.rejects(esClientError);

      const promise = elasticsearch.client.count(index, collection);

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#create", () => {
    it("should allow creating document an ID is provided", () => {
      elasticsearch.client._client.index.resolves({
        _id: "liia",
        _version: 1,
        _source: { city: "Kathmandu" },
      });

      const promise = elasticsearch.client.create(
        index,
        collection,
        { city: "Kathmandu" },
        { id: "liia", refresh: "wait_for", userId: "aschen" },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              author: "aschen",
              createdAt: timestamp,
            },
          },
          id: "liia",
          refresh: "wait_for",
          op_type: "create",
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should create a document when no ID is provided", () => {
      elasticsearch.client._client.index.resolves({
        _id: "mehry",
        _version: 1,
        _source: { city: "Panipokari" },
      });

      const promise = elasticsearch.client.create(index, collection, {
        city: "Panipokari",
      });

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          document: {
            city: "Panipokari",
            _kuzzle_info: {
              author: null,
            },
          },
          op_type: "index",
        });

        should(result).match({
          _id: "mehry",
          _version: 1,
          _source: { city: "Panipokari" },
        });
      });
    });
  });

  describe("#createOrReplace", () => {
    beforeEach(() => {
      elasticsearch.client._client.index.resolves({
        _id: "liia",
        _version: 1,
        _source: { city: "Kathmandu" },
        result: "created",
      });
    });

    it("should support createOrReplace capability", () => {
      const promise = elasticsearch.client.createOrReplace(
        index,
        collection,
        "liia",
        { city: "Kathmandu" },
        { refresh: "wait_for", userId: "aschen" },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              author: "aschen",
              createdAt: timestamp,
              updatedAt: timestamp,
              updater: "aschen",
            },
          },
          id: "liia",
          refresh: "wait_for",
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
          created: true,
        });
      });
    });

    it("should not inject meta if specified", () => {
      const promise = elasticsearch.client.createOrReplace(
        index,
        collection,
        "liia",
        { city: "Kathmandu" },
        { injectKuzzleMeta: false },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          document: {
            city: "Kathmandu",
            _kuzzle_info: undefined,
          },
          id: "liia",
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
          created: true,
        });
      });
    });

    it("should return a rejected promise if client.index fails", () => {
      elasticsearch.client._client.index.rejects(esClientError);

      const promise = elasticsearch.client.createOrReplace(
        index,
        collection,
        "liia",
        {
          city: "Kathmandu",
        },
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#update", () => {
    beforeEach(() => {
      elasticsearch.client._client.update.resolves({
        _id: "liia",
        _version: 1,
        get: {
          _source: { city: "Panipokari" },
        },
      });
    });

    it("should allow to update a document", () => {
      const promise = elasticsearch.client.update(index, collection, "liia", {
        city: "Panipokari",
      });

      return promise.then((result) => {
        should(elasticsearch.client._client.update).be.calledWithMatch({
          index: alias,
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: null,
            },
          },
          id: "liia",
          refresh: undefined,
          retry_on_conflict:
            elasticsearch.config.defaults.onUpdateConflictRetries,
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: {
            city: "Panipokari",
          },
        });
      });
    });

    it("should handle optional configurations", () => {
      const promise = elasticsearch.client.update(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "aschen", retryOnConflict: 42 },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.update).be.calledWithMatch({
          index: alias,
          doc: {
            city: "Panipokari",
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: "aschen",
            },
          },
          id: "liia",
          refresh: "wait_for",
          _source: true,
          retry_on_conflict: 42,
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: {
            city: "Panipokari",
          },
        });
      });
    });

    it("should return a rejected promise if client.update fails", () => {
      elasticsearch.client._client.update.rejects(esClientError);

      const promise = elasticsearch.client.update(index, collection, "liia", {
        city: "Kathmandu",
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should default an explicitly null retryOnConflict", async () => {
      await elasticsearch.client.update(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "oh noes", retryOnConflict: null },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: "oh noes",
          },
        },
        id: "liia",
        refresh: "wait_for",
        _source: true,
        retry_on_conflict:
          elasticsearch.config.defaults.onUpdateConflictRetries,
      });
    });
  });

  describe("#upsert", () => {
    beforeEach(() => {
      elasticsearch.client._client.update.resolves({
        _id: "liia",
        _version: 2,
        result: "updated",
        get: {
          _source: { city: "Panipokari" },
        },
      });
    });

    it("should allow to upsert a document", async () => {
      const result = await elasticsearch.client.upsert(
        index,
        collection,
        "liia",
        {
          city: "Panipokari",
        },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: null,
          },
        },
        upsert: {
          _kuzzle_info: {
            author: null,
            createdAt: timestamp,
          },
        },
        id: "liia",
        refresh: undefined,
        retry_on_conflict:
          elasticsearch.config.defaults.onUpdateConflictRetries,
      });

      should(result).match({
        _id: "liia",
        _version: 2,
        _source: {
          city: "Panipokari",
        },
        created: false,
      });
    });

    it("should handle default values for upserted documents", async () => {
      const result = await elasticsearch.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        {
          defaultValues: { oh: "noes" },
        },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: null,
          },
        },
        upsert: {
          oh: "noes",
          _kuzzle_info: {
            author: null,
            createdAt: timestamp,
          },
        },
        id: "liia",
        refresh: undefined,
        retry_on_conflict:
          elasticsearch.config.defaults.onUpdateConflictRetries,
      });

      should(result).match({
        _id: "liia",
        _version: 2,
        _source: {
          city: "Panipokari",
        },
        created: false,
      });
    });

    it('should return the right "_created" result on a document creation', async () => {
      elasticsearch.client._client.update.resolves({
        _id: "liia",
        _version: 1,
        result: "created",
        get: {
          _source: { city: "Panipokari" },
        },
      });

      const result = await elasticsearch.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        {
          defaultValues: { oh: "noes" },
        },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: null,
          },
        },
        upsert: {
          oh: "noes",
          _kuzzle_info: {
            author: null,
            createdAt: timestamp,
          },
        },
        id: "liia",
        refresh: undefined,
        retry_on_conflict:
          elasticsearch.config.defaults.onUpdateConflictRetries,
      });

      should(result).match({
        _id: "liia",
        _version: 1,
        _source: {
          city: "Panipokari",
        },
        created: true,
      });
    });

    it("should handle optional configurations", async () => {
      const result = await elasticsearch.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "aschen", retryOnConflict: 42 },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: "aschen",
          },
        },
        upsert: {
          _kuzzle_info: {
            author: "aschen",
            createdAt: timestamp,
          },
        },
        id: "liia",
        refresh: "wait_for",
        _source: true,
        retry_on_conflict: 42,
      });

      should(result).match({
        _id: "liia",
        _version: 2,
        _source: {
          city: "Panipokari",
        },
        created: false,
      });
    });

    it("should return a rejected promise if client.upsert fails", async () => {
      elasticsearch.client._client.update.rejects(esClientError);

      await should(
        elasticsearch.client.upsert(index, collection, "liia", {
          city: "Kathmandu",
        }),
      ).rejected();

      should(elasticsearch.client._esWrapper.formatESError).calledWith(
        esClientError,
      );
    });

    it("should default an explicitly null retryOnConflict", async () => {
      await elasticsearch.client.upsert(
        index,
        collection,
        "liia",
        { city: "Panipokari" },
        { refresh: "wait_for", userId: "oh noes", retryOnConflict: null },
      );

      should(elasticsearch.client._client.update).be.calledWithMatch({
        index: alias,
        doc: {
          city: "Panipokari",
          _kuzzle_info: {
            updatedAt: timestamp,
            updater: "oh noes",
          },
        },
        upsert: {
          _kuzzle_info: {
            author: "oh noes",
            createdAt: timestamp,
          },
        },
        id: "liia",
        refresh: "wait_for",
        _source: true,
        retry_on_conflict:
          elasticsearch.config.defaults.onUpdateConflictRetries,
      });
    });
  });

  describe("#replace", () => {
    beforeEach(() => {
      elasticsearch.client._client.index.resolves({
        _id: "liia",
        _version: 1,
        _source: { city: "Kathmandu" },
      });
      elasticsearch.client._client.exists.resolves(true);
    });

    it("should support replace capability", () => {
      const promise = elasticsearch.client.replace(index, collection, "liia", {
        city: "Kathmandu",
      });

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          id: "liia",
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
              updatedAt: timestamp,
              updater: null,
            },
          },
          refresh: undefined,
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should accept additional options", () => {
      const promise = elasticsearch.client.replace(
        index,
        collection,
        "liia",
        { city: "Kathmandu" },
        { refresh: "wait_for", userId: "aschen" },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          id: "liia",
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              author: "aschen",
              createdAt: timestamp,
              updatedAt: timestamp,
              updater: "aschen",
            },
          },
          refresh: "wait_for",
        });

        should(result).match({
          _id: "liia",
          _version: 1,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should throw a NotFoundError Exception if document already exists", () => {
      elasticsearch.client._client.exists.resolves(false);

      const promise = elasticsearch.client.replace(index, collection, "liia", {
        city: "Kathmandu",
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(
            elasticsearch.client._esWrapper.formatESError,
          ).be.calledWithMatch({
            id: "services.storage.not_found",
          });
          should(elasticsearch.client._client.index).not.be.called();
        });
    });

    it("should return a rejected promise if client.index fails", () => {
      elasticsearch.client._client.index.rejects(esClientError);

      const promise = elasticsearch.client.replace(index, collection, "liia", {
        city: "Kathmandu",
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#delete", () => {
    beforeEach(() => {
      elasticsearch.client._client.delete.resolves({
        body: {
          _id: "liia",
        },
      });
    });

    it("should allow to delete a document", () => {
      const promise = elasticsearch.client.delete(index, collection, "liia");

      return promise.then((result) => {
        should(elasticsearch.client._client.delete).be.calledWithMatch({
          index: alias,
          id: "liia",
          refresh: undefined,
        });

        should(result).be.null();
      });
    });

    it("should allow additional options", () => {
      const promise = elasticsearch.client.delete(index, collection, "liia", {
        refresh: "wait_for",
      });

      return promise.then((result) => {
        should(elasticsearch.client._client.delete).be.calledWithMatch({
          index: alias,
          id: "liia",
          refresh: "wait_for",
        });

        should(result).be.null();
      });
    });

    it("should return a rejected promise if client.delete fails", () => {
      elasticsearch.client._client.delete.rejects(esClientError);

      const promise = elasticsearch.client.delete(index, collection, "liia");

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#updateByQuery", () => {
    beforeEach(() => {
      sinon.stub(elasticsearch.client, "_getAllDocumentsFromQuery").resolves([
        { _id: "_id1", _source: { name: "Ok" } },
        { _id: "_id2", _source: { name: "Ok" } },
      ]);

      sinon.stub(elasticsearch.client, "mUpdate").resolves({
        items: [
          {
            _id: "_id1",
            _source: { name: "bar" },
            status: 200,
          },
          {
            _id: "_id2",
            _source: { name: "bar" },
            status: 200,
          },
        ],
        errors: [],
      });

      elasticsearch.client._client.indices.refresh.resolves({
        _shards: 1,
      });
    });

    const documents = [
      {
        _id: "_id1",
        _source: undefined,
        body: {
          name: "bar",
        },
      },
      {
        _id: "_id2",
        _source: undefined,
        body: {
          name: "bar",
        },
      },
    ];

    it("should have updateByQuery capability", () => {
      const promise = elasticsearch.client.updateByQuery(
        index,
        collection,
        { filter: { term: { name: "Ok" } } },
        { name: "bar" },
      );

      return promise.then((result) => {
        should(elasticsearch.client.mUpdate).be.calledWithMatch(
          index,
          collection,
          documents,
          { refresh: undefined },
        );

        should(result).match({
          successes: [
            {
              _id: "_id1",
              _source: { name: "bar" },
              status: 200,
            },
            {
              _id: "_id2",
              _source: { name: "bar" },
              status: 200,
            },
          ],
          errors: [],
        });
      });
    });

    it("should allow additional options", async () => {
      const result = await elasticsearch.client.updateByQuery(
        index,
        collection,
        { filter: "term" },
        { name: "bar" },
        { refresh: "wait_for", size: 3, userId: "aschen" },
      );

      should(elasticsearch.client._getAllDocumentsFromQuery).be.calledWithMatch(
        {
          index: alias,
          query: { filter: "term" },
          scroll: "5s",
          size: 3,
        },
      );

      should(elasticsearch.client.mUpdate).be.calledWithMatch(
        index,
        collection,
        documents,
        {
          refresh: "wait_for",
          userId: "aschen",
        },
      );

      should(result).match({
        successes: [
          { _id: "_id1", _source: { name: "bar" }, status: 200 },
          { _id: "_id2", _source: { name: "bar" }, status: 200 },
        ],
        errors: [],
      });
    });

    it("should reject if the number of impacted documents exceeds the configured limit", () => {
      elasticsearch.client._getAllDocumentsFromQuery.restore();

      elasticsearch.client._client.search.resolves({
        hits: {
          hits: [],
          total: {
            value: 99999,
          },
        },
        _scroll_id: "foobar",
      });

      kuzzle.config.limits.documentsFetchCount = 2;

      return should(
        elasticsearch.client.updateByQuery(index, collection, {}, {}),
      ).rejectedWith(SizeLimitError, {
        id: "services.storage.write_limit_exceeded",
      });
    });
  });

  describe("#bulkUpdateByQuery", () => {
    let query;
    let changes;
    let request;

    beforeEach(() => {
      query = {
        match: { foo: "bar" },
      };
      changes = {
        bar: "foo",
      };

      request = {
        query,
        script: {
          params: { bar: "foo" },
          source: "ctx._source.bar = params['bar'];",
        },
        index: alias,
        refresh: false,
      };

      elasticsearch.client._client.updateByQuery.resolves({
        total: 42,
        updated: 42,
        failures: [],
      });
    });

    it("should have updateByQuery capabilities", async () => {
      const result = await elasticsearch.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        changes,
      );

      should(elasticsearch.client._client.updateByQuery).be.calledWithMatch(
        request,
      );

      should(result).match({
        updated: 42,
      });
    });

    it("should allow additonnal option", async () => {
      request.refresh = "wait_for";

      await elasticsearch.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        changes,
        {
          refresh: "wait_for",
        },
      );

      should(elasticsearch.client._client.updateByQuery).be.calledWithMatch(
        request,
      );
    });

    it("should reject if client.updateByQuery fails", () => {
      elasticsearch.client._client.updateByQuery.rejects(esClientError);

      const promise = elasticsearch.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        changes,
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should reject if some failures occur", () => {
      elasticsearch.client._client.updateByQuery.resolves({
        total: 3,
        updated: 2,
        failures: [{ shardId: 42, reason: "error", foo: "bar" }],
      });

      const promise = elasticsearch.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        changes,
      );

      return should(promise).be.rejectedWith(MultipleErrorsError, {
        id: "services.storage.incomplete_update",
        message:
          "2 documents were successfully updated before an error occured",
      });
    });

    it("should not generate a script if there are no changes", async () => {
      const requestWithoutChanges = {
        query,
        index: alias,
        refresh: false,
      };

      await elasticsearch.client.bulkUpdateByQuery(
        index,
        collection,
        query,
        {},
      );

      should(elasticsearch.client._client.updateByQuery).be.calledWithMatch(
        requestWithoutChanges,
      );
    });
  });

  describe("#deleteByQuery", () => {
    beforeEach(() => {
      sinon.stub(elasticsearch.client, "_getAllDocumentsFromQuery").resolves([
        { _id: "_id1", _source: "_source1" },
        { _id: "_id2", _source: "_source2" },
      ]);

      elasticsearch.client._client.deleteByQuery.resolves({
        total: 2,
        deleted: 1,
        failures: [
          {
            id: "_id2",
            cause: {
              reason: "error",
            },
            foo: "bar",
          },
        ],
      });
    });

    it("should have deleteByQuery capability", async () => {
      const result = await elasticsearch.client.deleteByQuery(
        index,
        collection,
        {
          filter: "term",
        },
      );

      should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
        index: alias,
        query: { filter: "term" },
        scroll: "5s",
        from: undefined,
        max_docs: 1000,
        refresh: undefined,
      });

      should(elasticsearch.client._getAllDocumentsFromQuery).be.calledWithMatch(
        {
          index: alias,
          query: { filter: "term" },
          scroll: "5s",
          from: undefined,
          size: 1000,
          refresh: undefined,
        },
      );

      should(result).match({
        documents: [
          { _id: "_id1", _source: "_source1" },
          { _id: "_id2", _source: "_source2" },
        ],
        total: 2,
        deleted: 1,
        failures: [{ id: "_id2", reason: "error" }],
      });
    });

    it("should allow additional options", async () => {
      const result = await elasticsearch.client.deleteByQuery(
        index,
        collection,
        { filter: "term" },
        { refresh: "wait_for", from: 1, size: 3 },
      );

      should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
        index: alias,
        query: { filter: "term" },
        max_docs: 3,
        refresh: true,
      });

      should(result).match({
        total: 2,
        deleted: 1,
        failures: [{ id: "_id2", reason: "error" }],
      });
    });

    it("should not fetch documents if fetch=false", async () => {
      const result = await elasticsearch.client.deleteByQuery(
        index,
        collection,
        { filter: "term" },
        { fetch: false },
      );

      should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
        index: alias,
        query: { filter: "term" },
        scroll: "5s",
        from: undefined,
        max_docs: 1000,
        refresh: undefined,
      });

      should(elasticsearch.client._getAllDocumentsFromQuery).not.be.called();

      should(result).match({
        documents: [],
        total: 2,
        deleted: 1,
        failures: [{ id: "_id2", reason: "error" }],
      });
    });

    it("should rejects if client.deleteByQuery fails", () => {
      elasticsearch.client._client.deleteByQuery.rejects(esClientError);

      const promise = elasticsearch.client.deleteByQuery(index, collection, {
        filter: "term",
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should reject if the query is empty", () => {
      const promise = elasticsearch.client.deleteByQuery(
        index,
        collection,
        "not an object",
      );

      return should(promise).be.rejectedWith({
        id: "services.storage.missing_argument",
      });
    });

    it("should reject if the number of impacted documents exceeds the configured limit", () => {
      elasticsearch.client._getAllDocumentsFromQuery.restore();

      elasticsearch.client._client.search.resolves({
        hits: {
          hits: [],
          total: {
            value: 99999,
          },
        },
        _scroll_id: "foobar",
      });

      kuzzle.config.limits.documentsFetchCount = 2;

      return should(
        elasticsearch.client.deleteByQuery(index, collection, {}),
      ).rejectedWith(SizeLimitError, {
        id: "services.storage.write_limit_exceeded",
      });
    });
  });

  describe("#deleteFields", () => {
    beforeEach(() => {
      elasticsearch.client._client.get.resolves({
        _id: "liia",
        _version: 1,
        _source: { city: "Kathmandu", useless: "somevalue" },
      });

      elasticsearch.client._client.index.resolves({
        _id: "liia",
        _version: 2,
      });
    });

    it("should support field removal capability", () => {
      const promise = elasticsearch.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.get).be.calledWithMatch({
          index: alias,
          id: "liia",
        });

        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          id: "liia",
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: null,
            },
          },
          refresh: undefined,
        });

        should(result).match({
          _id: "liia",
          _version: 2,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should accept additional options", () => {
      const promise = elasticsearch.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
        { refresh: "wait_for", userId: "aschen" },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.get).be.calledWithMatch({
          index: alias,
          id: "liia",
        });

        should(elasticsearch.client._client.index).be.calledWithMatch({
          index: alias,
          id: "liia",
          document: {
            city: "Kathmandu",
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: "aschen",
            },
          },
          refresh: "wait_for",
        });

        should(result).match({
          _id: "liia",
          _version: 2,
          _source: { city: "Kathmandu" },
        });
      });
    });

    it("should throw a NotFoundError Exception if document does not exists", () => {
      elasticsearch.client._client.get.rejects(esClientError);

      const promise = elasticsearch.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
          should(elasticsearch.client._client.index).not.be.called();
        });
    });

    it("should return a rejected promise if client.index fails", () => {
      elasticsearch.client._client.index.rejects(esClientError);

      const promise = elasticsearch.client.deleteFields(
        index,
        collection,
        "liia",
        ["useless"],
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#mExecute", () => {
    it("should call the callback method with each batch returned by ES", async () => {
      const hits1 = {
        hits: [21, 42, 84],
        total: {
          value: 5,
        },
      };
      const hits2 = {
        hits: [168, 336],
        total: {
          value: 5,
        },
      };
      const callbackStub = sinon
        .stub()
        .onCall(0)
        .resolves(1)
        .onCall(1)
        .resolves(2);

      elasticsearch.client._client.search.resolves({
        hits: hits1,
        _scroll_id: "scroll-id",
      });

      elasticsearch.client._client.scroll.resolves({
        hits: hits2,
        _scroll_id: "scroll-id",
      });

      const result = await elasticsearch.client.mExecute(
        index,
        collection,
        { match: 21 },
        callbackStub,
      );

      should(result).match([1, 2]);

      should(elasticsearch.client._client.search.firstCall.args[0]).match({
        index: alias,
        query: { match: 21 },
        scroll: "5s",
        from: 0,
        size: 10,
      });

      should(callbackStub).be.calledTwice();
      should(callbackStub.getCall(0).args[0]).be.eql(hits1.hits);
      should(callbackStub.getCall(1).args[0]).be.eql(hits2.hits);
    });

    it("should reject if the query is empty", () => {
      const promise = elasticsearch.client.mExecute(
        index,
        collection,
        "not an object",
        () => {},
      );

      return should(promise).be.rejectedWith({
        id: "services.storage.missing_argument",
      });
    });
  });

  describe("#createIndex", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: alias },
        { alias: "@%nepali.liia" },
      ]);
      sinon.stub(elasticsearch.client, "_createHiddenCollection").resolves();
    });

    afterEach(() => {
      elasticsearch.client._createHiddenCollection.restore();
    });

    it("should resolve and create a hidden collection if the index does not exist", async () => {
      await elasticsearch.client.createIndex("lfiduras");

      should(elasticsearch.client._createHiddenCollection).be.calledWithMatch(
        "lfiduras",
      );
    });

    it("should reject if the index already exists", () => {
      return should(elasticsearch.client.createIndex("nepali")).be.rejectedWith(
        PreconditionError,
        { id: "services.storage.index_already_exists" },
      );
    });

    it("should return a rejected promise if client.cat.indices fails", () => {
      elasticsearch.client._client.cat.aliases.rejects(esClientError);

      const promise = elasticsearch.client.createIndex(index, collection, {
        filter: "term",
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should reject if the index name is invalid", () => {
      sinon.stub(elasticsearch.client, "isIndexNameValid").returns(false);

      return should(elasticsearch.client.createIndex("foobar")).rejectedWith(
        BadRequestError,
        { id: "services.storage.invalid_index_name" },
      );
    });
  });

  describe("#createCollection", () => {
    let _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch.client._checkMappings;

      elasticsearch.client._client.indices.create.resolves({});
      elasticsearch.client.hasCollection = sinon.stub().resolves(false);
      elasticsearch.client._checkMappings = sinon.stub().resolves();

      sinon.stub(elasticsearch.client, "_createHiddenCollection").resolves();
      sinon.stub(elasticsearch.client, "_hasHiddenCollection").resolves(false);
      sinon.stub(elasticsearch.client, "deleteCollection").resolves();
      sinon.stub(elasticsearch.client, "_getAvailableIndice").resolves(indice);
      sinon.stub(elasticsearch.client, "_getWaitForActiveShards").returns(1);
    });

    afterEach(() => {
      elasticsearch.client._getAvailableIndice.restore();
    });

    it("should allow creating a new collection and inject commonMappings", async () => {
      const settings = { index: { blocks: { write: true } } };
      const mappings = { properties: { city: { type: "keyword" } } };

      const result = await elasticsearch.client.createCollection(
        index,
        collection,
        {
          mappings,
          settings,
        },
      );

      should(elasticsearch.client.hasCollection).be.calledWith(
        index,
        collection,
      );
      should(elasticsearch.client._checkMappings).be.calledWithMatch({
        properties: mappings.properties,
      });
      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: indice,
        aliases: { [alias]: {} },
        mappings: {
          dynamic: elasticsearch.config.commonMapping.dynamic,
          _meta: elasticsearch.config.commonMapping._meta,
          properties: mappings.properties,
        },
        settings: { index: { blocks: { write: true } } },
      });

      should(result).be.null();
      should(elasticsearch.client.deleteCollection).not.be.called();
    });

    it("should delete the hidden collection if present", async () => {
      elasticsearch.client._hasHiddenCollection.resolves(true);

      await elasticsearch.client.createCollection(index, collection, {});

      should(Mutex.prototype.lock).be.called();
      should(Mutex.prototype.unlock).be.called();
      should(elasticsearch.client._hasHiddenCollection).be.calledWith(index);
      should(elasticsearch.client.deleteCollection).be.calledWith(
        index,
        "_kuzzle_keep",
      );
    });

    it("should allow to set dynamic and _meta fields", async () => {
      const mappings = { dynamic: "true", _meta: { some: "meta" } };

      const result = await elasticsearch.client.createCollection(
        index,
        collection,
        {
          mappings,
        },
      );

      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: indice,
        aliases: { [alias]: {} },
        mappings: {
          dynamic: "true",
          _meta: { some: "meta" },
          properties: elasticsearch.config.commonMapping.properties,
        },
      });

      should(result).be.null();
    });

    it("should return a rejected promise if client.indices.create fails", () => {
      elasticsearch.client._client.indices.create.rejects(esClientError);

      const promise = elasticsearch.client.createCollection(index, collection, {
        mappings: { properties: { city: { type: "keyword" } } },
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should not reject when a race condition occur between exists and create methods", () => {
      const esReject = new Error("foo");

      esReject.meta = {
        body: {
          error: {
            type: "resource_already_exists_exception",
          },
        },
      };

      elasticsearch.client._client.indices.create.rejects(esReject);

      const promise = elasticsearch.client.createCollection(index, collection, {
        mappings: { properties: { city: { type: "keyword" } } },
      });

      return should(promise)
        .be.fulfilled()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).not.be.called();
        });
    });

    it("should reject with BadRequestError on wrong mapping", async () => {
      elasticsearch.client._checkMappings = _checkMappings;

      const mappings = {
        dinamic: "false",
        properties: {
          freeman: { type: "keyword" },
        },
      };

      global.NODE_ENV = "development";
      await should(
        elasticsearch.client.createCollection(index, collection, { mappings }),
      ).be.rejectedWith({
        message:
          'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
        id: "services.storage.invalid_mapping",
      });

      global.NODE_ENV = "production";
      await should(
        elasticsearch.client.createCollection(index, collection, { mappings }),
      ).be.rejectedWith({
        message: 'Invalid mapping property "mappings.dinamic".',
        id: "services.storage.invalid_mapping",
      });
    });

    it("should reject when an incorrect dynamic property value is provided", async () => {
      const mappings1 = {
        dynamic: null,
      };
      const mappings2 = {
        properties: {
          user: {
            properties: {
              metadata: {
                dynamic: "notTooMuch",
              },
            },
          },
        },
      };
      const mappings3 = {
        dynamic: true,
      };

      await elasticsearch.client.createCollection(index, collection, {
        mappings: mappings3,
      });

      should(elasticsearch.client._checkMappings).be.calledWithMatch({
        dynamic: "true",
      });

      await should(
        elasticsearch.client.createCollection(index, collection, {
          mappings: mappings1,
        }),
      ).be.rejectedWith({
        message: /Dynamic property value should be a string./,
        id: "services.storage.invalid_mapping",
      });

      await should(
        elasticsearch.client.createCollection(index, collection, {
          mappings: mappings2,
        }),
      ).be.rejectedWith({
        message: /Incorrect dynamic property value/,
        id: "services.storage.invalid_mapping",
      });
    });

    it("should call updateCollection if the collection already exists", async () => {
      const settings = { index: { blocks: { write: true } } };
      const mappings = { properties: { city: { type: "keyword" } } };
      elasticsearch.client.hasCollection.resolves(true);
      sinon.stub(elasticsearch.client, "updateCollection").resolves({});

      await elasticsearch.client.createCollection(index, collection, {
        mappings,
        settings,
      });

      should(elasticsearch.client.hasCollection).be.calledWith(
        index,
        collection,
      );
      should(elasticsearch.client.updateCollection).be.calledWithMatch(
        index,
        collection,
        {
          settings: { index: { blocks: { write: true } } },
          mappings: { properties: { city: { type: "keyword" } } },
        },
      );
    });

    it("should not overwrite kuzzle commonMapping", async () => {
      elasticsearch.config.commonMapping = {
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
      const mappings = {
        properties: {
          gordon: { type: "keyword" },
          freeman: { type: "keyword" },
          _kuzzle_info: {
            properties: {
              author: { type: "keyword" },
            },
          },
        },
      };

      await elasticsearch.client.createCollection(index, collection, {
        mappings,
      });

      const esReq =
          elasticsearch.client._client.indices.create.firstCall.args[0],
        expectedMapping = {
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
        };

      should(esReq.mappings).eql(expectedMapping);
    });

    it("should reject if the index name is invalid", () => {
      sinon.stub(elasticsearch.client, "isIndexNameValid").returns(false);

      return should(
        elasticsearch.client.createCollection("foo", "bar"),
      ).rejectedWith(BadRequestError, {
        id: "services.storage.invalid_index_name",
      });
    });

    it("should reject if the collection name is invalid", () => {
      sinon.stub(elasticsearch.client, "isCollectionNameValid").returns(false);

      return should(
        elasticsearch.client.createCollection("foo", "bar"),
      ).rejectedWith(BadRequestError, {
        id: "services.storage.invalid_collection_name",
      });
    });

    it("should use defaultSettings if none are provided", async () => {
      elasticsearch.config.defaultSettings = {
        number_of_replicas: 42,
        number_of_shards: 66,
      };

      await elasticsearch.client.createCollection(index, collection);

      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];
      should(esReq.settings).eql(elasticsearch.config.defaultSettings);
    });

    it("should use provided settings if provided", async () => {
      elasticsearch.config.defaultSettings = {
        number_of_replicas: 42,
        number_of_shards: 66,
      };

      const settings = {
        number_of_replicas: 1,
        number_of_shards: 2,
      };

      await elasticsearch.client.createCollection(index, collection, {
        settings,
      });

      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];
      should(esReq.settings).eql(settings);
    });

    it("should use partially provided settings", async () => {
      elasticsearch.config.defaultSettings = {
        number_of_replicas: 42,
        number_of_shards: 66,
      };

      const settings = {
        number_of_replicas: 1,
      };

      await elasticsearch.client.createCollection(index, collection, {
        settings,
      });

      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];

      should(esReq.settings).eql({
        number_of_replicas: 1,
        number_of_shards: 66,
      });
    });

    it("should wait for all shards to being active when using an Elasticsearch cluster", async () => {
      elasticsearch.client._getWaitForActiveShards = sinon
        .stub()
        .returns("all");
      await elasticsearch.client.createCollection(index, collection);

      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];

      should(esReq.wait_for_active_shards).eql("all");
    });

    it("should only wait for one shard to being active when using a single node", async () => {
      elasticsearch.client._getWaitForActiveShards = sinon.stub().returns("1");
      await elasticsearch.client.createCollection(index, collection);

      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];

      should(esReq.wait_for_active_shards).eql("1");
    });
  });

  describe("#getMapping", () => {
    beforeEach(() => {
      elasticsearch.client._client.indices.getMapping.resolves({
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
      });

      elasticsearch.client._esWrapper.getMapping = sinon
        .stub()
        .resolves({ foo: "bar" });
      sinon.stub(elasticsearch.client, "_getIndice").resolves(indice);
    });

    afterEach(() => {
      elasticsearch.client._getIndice.restore();
    });

    it("should have getMapping capabilities", () => {
      const promise = elasticsearch.client.getMapping(index, collection);

      return promise.then((result) => {
        should(
          elasticsearch.client._client.indices.getMapping,
        ).be.calledWithMatch({
          index: indice,
        });

        should(result).match({
          dynamic: true,
          _meta: { lang: "npl" },
          properties: {
            city: { type: "keyword" },
          },
        });
      });
    });

    it("should include kuzzleMeta if specified", () => {
      const promise = elasticsearch.client.getMapping(index, collection, {
        includeKuzzleMeta: true,
      });

      return promise.then((result) => {
        should(
          elasticsearch.client._client.indices.getMapping,
        ).be.calledWithMatch({
          index: indice,
        });

        should(result).match({
          dynamic: true,
          _meta: { lang: "npl" },
          properties: {
            city: { type: "keyword" },
            _kuzzle_info: { properties: { author: { type: "keyword" } } },
          },
        });
      });
    });

    it("should return a rejected promise if client.cat.indices fails", () => {
      elasticsearch.client._client.indices.getMapping.rejects(esClientError);

      const promise = elasticsearch.client.getMapping(index, collection);

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#updateCollection", () => {
    let oldSettings, settings, mappings;

    beforeEach(() => {
      oldSettings = {
        [indice]: {
          settings: {
            index: {
              creation_date: Date.now(),
              provided_name: "hello_world",
              uuid: "some-u-u-i-d",
              version: { no: 4242 },
              blocks: { write: false },
            },
          },
        },
      };
      settings = { index: { blocks: { write: true } } };
      mappings = { properties: { city: { type: "keyword" } } };

      elasticsearch.client._client.indices.getSettings.resolves(oldSettings);
      elasticsearch.client.updateMapping = sinon.stub().resolves();
      elasticsearch.client.updateSettings = sinon.stub().resolves();
      elasticsearch.client.updateSearchIndex = sinon.stub().resolves();
      sinon.stub(elasticsearch.client, "_getIndice").resolves(indice);
    });

    afterEach(() => {
      elasticsearch.client._getIndice.restore();
    });

    it("should call updateSettings, updateMapping", async () => {
      elasticsearch.client.getMapping = sinon.stub().resolves({
        dynamic: "true",
        properties: { city: { type: "keyword" }, dynamic: "false" },
      });
      await elasticsearch.client.updateCollection(index, collection, {
        mappings,
        settings,
      });

      should(elasticsearch.client.updateSettings).be.calledWith(
        index,
        collection,
        settings,
      );
      should(elasticsearch.client.updateMapping).be.calledWith(
        index,
        collection,
        mappings,
      );
    });

    it("should call updateSettings and updateMapping", async () => {
      elasticsearch.client.getMapping = sinon.stub().resolves({
        dynamic: "false",
        properties: { city: { type: "keyword" } },
      });
      await elasticsearch.client.updateCollection(index, collection, {
        mappings,
        settings,
      });

      should(elasticsearch.client.updateSettings).be.calledWith(
        index,
        collection,
        settings,
      );
      should(elasticsearch.client.updateMapping).be.calledWith(
        index,
        collection,
        mappings,
      );
      should(elasticsearch.client.updateSearchIndex).not.be.called();
    });

    it("should revert settings if updateMapping fail", () => {
      elasticsearch.client.getMapping = sinon.stub().resolves({
        dynamic: "true",
        properties: { city: { type: "keyword" } },
      });
      elasticsearch.client.updateMapping.rejects();

      const promise = elasticsearch.client.updateCollection(index, collection, {
        mappings,
        settings,
      });

      return should(promise)
        .be.rejected()
        .then(() => {
          should(
            elasticsearch.client._client.indices.getSettings,
          ).be.calledWithMatch({
            index: indice,
          });
          should(elasticsearch.client.updateSettings).be.calledTwice();
          should(elasticsearch.client.updateMapping).be.calledOnce();
          should(elasticsearch.client.updateSettings.getCall(1).args).be.eql([
            index,
            collection,
            { index: { blocks: { write: false } } },
          ]);
        });
    });

    it("should calls updateSearchIndex if dynamic change from false to true", async () => {
      elasticsearch.client.getMapping = sinon.stub().resolves({
        properties: {
          content: {
            dynamic: "false",
          },
        },
      });
      const newMappings = {
        properties: {
          content: {
            dynamic: true,
          },
        },
      };

      await elasticsearch.client.updateCollection(index, collection, {
        mappings: newMappings,
      });

      should(elasticsearch.client.updateSearchIndex).be.calledOnce();
    });
  });

  describe("#updateMapping", () => {
    let newMapping, existingMapping, _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch.client._checkMappings;

      newMapping = {
        properties: {
          name: { type: "keyword" },
        },
      };

      existingMapping = {
        dynamic: "strict",
        _meta: { meta: "data" },
        properties: {
          city: { type: "keyword" },
          _kuzzle_info: {
            properties: {
              author: { type: "keyword" },
            },
          },
        },
      };

      elasticsearch.client.getMapping = sinon.stub().resolves(existingMapping);
      elasticsearch.client._client.indices.putMapping.resolves({});
      elasticsearch.client._checkMappings = sinon.stub().resolves();
    });

    it("should have mapping capabilities", () => {
      const promise = elasticsearch.client.updateMapping(
        index,
        collection,
        newMapping,
      );

      return promise.then((result) => {
        should(
          elasticsearch.client._client.indices.putMapping,
        ).be.calledWithMatch({
          index: alias,
          dynamic: "strict",
          _meta: { meta: "data" },
          properties: {
            name: { type: "keyword" },
          },
        });

        should(result).match({
          dynamic: "strict",
          _meta: { meta: "data" },
          properties: {
            city: { type: "keyword" },
            name: { type: "keyword" },
            _kuzzle_info: {
              properties: {
                author: { type: "keyword" },
              },
            },
          },
        });
      });
    });

    it("should reject with BadRequestError on wrong mapping", async () => {
      elasticsearch.client._checkMappings = _checkMappings;
      newMapping = {
        dinamic: "false",
        properties: {
          freeman: { type: "keyword" },
        },
      };

      global.NODE_ENV = "development";
      await should(
        elasticsearch.client.updateMapping(index, collection, newMapping),
      ).be.rejectedWith({
        message:
          'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
        id: "services.storage.invalid_mapping",
      });

      global.NODE_ENV = "production";
      await should(
        elasticsearch.client.updateMapping(index, collection, newMapping),
      ).be.rejectedWith({
        message: 'Invalid mapping property "mappings.dinamic".',
        id: "services.storage.invalid_mapping",
      });
    });

    it("should replace dynamic and _meta", () => {
      existingMapping = {
        dynamic: "true",
        _meta: { some: "meta" },
      };
      newMapping = {
        dynamic: "false",
        _meta: { other: "meta" },
      };

      const promise = elasticsearch.client.updateMapping(
        index,
        collection,
        newMapping,
      );

      return promise.then((result) => {
        should(
          elasticsearch.client._client.indices.putMapping,
        ).be.calledWithMatch({
          index: alias,
          dynamic: "false",
          _meta: { other: "meta" },
        });

        should(result).match({
          dynamic: "false",
          _meta: { other: "meta" },
        });
      });
    });

    it("should return a rejected promise if client.cat.indices fails", () => {
      elasticsearch.client._client.indices.putMapping.rejects(esClientError);

      const promise = elasticsearch.client.updateMapping(
        index,
        collection,
        newMapping,
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#updateSettings", () => {
    let newSettings;

    beforeEach(() => {
      newSettings = {
        index: {
          blocks: {
            write: true,
          },
        },
      };
    });

    it("should allow to change indice settings", async () => {
      const result = await elasticsearch.client.updateSettings(
        index,
        collection,
        newSettings,
      );

      should(
        elasticsearch.client._client.indices.putSettings,
      ).be.calledWithMatch({
        index: alias,
        body: {
          index: {
            blocks: {
              write: true,
            },
          },
        },
      });

      should(result).be.null();
    });

    it("should close then open the index when changing the analyzers", async () => {
      newSettings.analysis = {
        analyzer: { customer_analyzers: {} },
      };

      await elasticsearch.client.updateSettings(index, collection, newSettings);

      should(elasticsearch.client._client.indices.close).be.calledWithMatch({
        index: alias,
      });
      should(elasticsearch.client._client.indices.open).be.calledWithMatch({
        index: alias,
      });
    });

    it("should return a rejected promise if client.cat.putSettings fails", () => {
      elasticsearch.client._client.indices.putSettings.rejects(esClientError);

      const promise = elasticsearch.client.updateSettings(
        index,
        collection,
        newSettings,
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#updateSearchIndex", () => {
    it("should call updateByQuery", async () => {
      elasticsearch.client._client.updateByQuery = sinon.stub().resolves();

      await elasticsearch.client.updateSearchIndex(index, collection);

      should(elasticsearch.client._client.updateByQuery).be.calledWithMatch({
        conflicts: "proceed",
        index: alias,
        refresh: true,
        wait_for_completion: false,
      });
    });
  });

  describe("#truncateCollection", () => {
    let existingMapping;

    beforeEach(() => {
      existingMapping = {
        dynamic: "false",
        properties: {
          name: { type: "keyword" },
        },
      };

      elasticsearch.client.getMapping = sinon.stub().resolves(existingMapping);

      elasticsearch.client._client.indices.getSettings.resolves({
        "&nyc-open-data.yellow-taxi": {
          settings: {
            analysis: {
              analyzers: {
                custom_analyzer: {
                  type: "simple",
                },
              },
            },
          },
        },
      });
      sinon.stub(elasticsearch.client, "_getIndice").resolves(indice);
      sinon.stub(elasticsearch.client, "_getWaitForActiveShards").resolves(1);
    });

    afterEach(() => {
      elasticsearch.client._getIndice.restore();
    });

    it("should delete and then create the collection with the same mapping", async () => {
      const result = await elasticsearch.client.truncateCollection(
        index,
        collection,
      );

      should(elasticsearch.client.getMapping).be.calledWith(index, collection);
      should(elasticsearch.client._client.indices.delete).be.calledWithMatch({
        index: indice,
      });
      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: indice,
        aliases: { [alias]: {} },
        mappings: {
          dynamic: "false",
          properties: {
            name: { type: "keyword" },
          },
        },
        settings: {
          analysis: {
            analyzers: {
              custom_analyzer: {
                type: "simple",
              },
            },
          },
        },
      });
      should(
        elasticsearch.client._client.indices.getSettings,
      ).be.calledWithMatch({
        index: indice,
      });
      should(result).be.null();
    });

    it("should return a rejected promise if client fails", () => {
      elasticsearch.client._client.indices.delete.rejects(esClientError);

      const promise = elasticsearch.client.truncateCollection(
        index,
        collection,
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });

    it("should wait for all shards to be active when using an Elasticsearch cluster", async () => {
      elasticsearch.client._getWaitForActiveShards = sinon
        .stub()
        .resolves("all");

      await elasticsearch.client.truncateCollection(index, collection);
      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];

      should(esReq.wait_for_active_shards).eql("all");
    });

    it("should only wait for the primary shard to be active when using a single node", async () => {
      elasticsearch.client._getWaitForActiveShards = sinon.stub().resolves("1");

      await elasticsearch.client.truncateCollection(index, collection);
      const esReq =
        elasticsearch.client._client.indices.create.firstCall.args[0];

      should(esReq.wait_for_active_shards).eql("1");
    });
  });

  describe("#import", () => {
    let getExpectedEsRequest;
    let bulkReturnError;
    let documents;
    let bulkReturn;

    beforeEach(() => {
      getExpectedEsRequest = ({ userId = null, refresh, timeout } = {}) => ({
        operations: [
          { index: { _id: 1, _index: alias } },
          {
            firstName: "foo",
            _kuzzle_info: {
              author: userId,
              createdAt: timestamp,
              updater: null,
              updatedAt: null,
            },
          },

          { index: { _id: 2, _index: alias, _type: undefined } },
          {
            firstName: "bar",
            _kuzzle_info: {
              author: userId,
              createdAt: timestamp,
              updater: null,
              updatedAt: null,
            },
          },

          { update: { _id: 3, _index: alias } },
          {
            doc: {
              firstName: "foobar",
              _kuzzle_info: {
                updater: userId,
                updatedAt: timestamp,
              },
            },
          },

          { delete: { _id: 4, _index: alias } },
        ],
        refresh,
        timeout,
      });

      bulkReturn = {
        items: [
          { index: { status: 201, _id: 1, toto: 42 } },
          { index: { status: 201, _id: 2, toto: 42 } },
          { update: { status: 200, _id: 3, toto: 42 } },
          { delete: { status: 200, _id: 4, toto: 42 } },
        ],
        errors: false,
      };

      bulkReturnError = {
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
        errors: true,
      };

      documents = [
        { index: { _id: 1, _index: "overwrite-me" } },
        { firstName: "foo" },

        { index: { _id: 2, _type: "delete-me" } },
        { firstName: "bar" },

        { update: { _id: 3 } },
        { doc: { firstName: "foobar" } },

        { delete: { _id: 4 } },
      ];

      elasticsearch.client._client.bulk.resolves(bulkReturn);
    });

    it("should support bulk data import", () => {
      documents = [
        { index: { _id: 1 } },
        { firstName: "foo" },

        { index: { _id: 2, _type: undefined } },
        { firstName: "bar" },

        { update: { _id: 3 } },
        { doc: { firstName: "foobar" } },

        { delete: { _id: 4 } },
      ];

      const promise = elasticsearch.client.import(index, collection, documents);

      return promise.then((result) => {
        should(elasticsearch.client._client.bulk).be.calledWithMatch(
          getExpectedEsRequest(),
        );

        should(result).match({
          items: [
            { index: { status: 201, _id: 1 } },
            { index: { status: 201, _id: 2 } },
            { update: { status: 200, _id: 3 } },
            { delete: { status: 200, _id: 4 } },
          ],
          errors: [],
        });
      });
    });

    it("should inject additional options to esRequest", () => {
      const promise = elasticsearch.client.import(
        index,
        collection,
        documents,
        {
          refresh: "wait_for",
          timeout: "10m",
          userId: "aschen",
        },
      );

      return promise.then(() => {
        should(elasticsearch.client._client.bulk).be.calledWithMatch(
          getExpectedEsRequest({
            refresh: "wait_for",
            timeout: "10m",
            userId: "aschen",
          }),
        );
      });
    });

    it('should populate "errors" array for bulk data import with some errors', () => {
      elasticsearch.client._client.bulk.resolves(bulkReturnError);

      const promise = elasticsearch.client.import(index, collection, documents);

      return promise.then((result) => {
        should(result).match({
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
    });

    it("should return a rejected promise if client fails", () => {
      elasticsearch.client._client.bulk.rejects(esClientError);

      const promise = elasticsearch.client.import(index, collection, documents);

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#listCollections", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@&nepali.mehry" },
        { alias: "@&nepali.liia" },
        { alias: "@&nyc-open-data.taxi" },
        { alias: "@&nepali._kuzzle_keep" },
      ]);
    });

    it("should allow listing all available collections", () => {
      const promise = elasticsearch.client.listCollections("nepali");

      return promise.then((result) => {
        should(result).match(["mehry", "liia"]);
      });
    });

    it("should not list unauthorized collections", () => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@%nepali.mehry" },
        { alias: "@%nepali.liia" },
        { alias: "@%nyc-open-data.taxi" },
      ]);

      const promise = elasticsearch.client.listCollections("nepali");

      return promise.then((result) => {
        should(result).match([]);
      });
    });

    it("should return a rejected promise if client fails", async () => {
      elasticsearch.client._client.cat.aliases.rejects(esClientError);

      await should(elasticsearch.client.listCollections(index)).be.rejected();

      should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
        esClientError,
      );
    });
  });

  describe("#listIndexes", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@&nepali.mehry" },
        { alias: "@&nepali.liia" },
        { alias: "@&nyc-open-data.taxi" },
      ]);
    });

    it("should allow listing all available indexes", () => {
      const promise = elasticsearch.client.listIndexes();

      return promise.then((result) => {
        should(elasticsearch.client._client.cat.aliases).be.calledWithMatch({
          format: "json",
        });

        should(result).match(["nepali", "nyc-open-data"]);
      });
    });

    it("should not list unauthorized indexes", () => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@%nepali.mehry" },
        { alias: "@%nepali.liia" },
        { alias: "@%nyc-open-data.taxi" },
        { alias: "@&vietnam.lfiduras" },
      ]);

      const promise = elasticsearch.client.listIndexes();

      return promise.then((result) => {
        should(result).match(["vietnam"]);
      });
    });

    it("should return a rejected promise if client fails", async () => {
      elasticsearch.client._client.cat.aliases.rejects(esClientError);

      await should(elasticsearch.client.listIndexes()).be.rejected();

      should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
        esClientError,
      );
    });
  });

  describe("#listAliases", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { index: "&nepalu.mehry", alias: "@&nepali.mehry" },
        { index: "&nepali.lia", alias: "@&nepali.liia" },
        { index: "&nyc-open-data.taxi", alias: "@&nyc-open-data.taxi" },
      ]);
    });

    it("should allow listing all available aliases", async () => {
      const result = await elasticsearch.client.listAliases();

      should(elasticsearch.client._client.cat.aliases).be.calledWithMatch({
        format: "json",
      });

      should(result).match([
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
    });

    it("should not list unauthorized aliases", async () => {
      elasticsearch.client._client.cat.aliases.resolves([
        { index: "%nepalu.mehry", alias: "@%nepali.mehry" },
        { index: "%nepali.lia", alias: "@%nepali.liia" },
        { index: "%nyc-open-data.taxi", alias: "@%nyc-open-data.taxi" },
        { index: "&vietnam.lfiduras", alias: "@&vietnam.lfiduras" },
      ]);

      const result = await elasticsearch.client.listAliases();

      should(result).match([
        {
          alias: "@&vietnam.lfiduras",
          index: "vietnam",
          collection: "lfiduras",
          indice: "&vietnam.lfiduras",
        },
      ]);
    });

    it("should return a rejected promise if client fails", async () => {
      elasticsearch.client._client.cat.aliases.rejects(esClientError);

      await should(elasticsearch.client.listAliases()).be.rejected();

      should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
        esClientError,
      );
    });
  });

  describe("#deleteIndexes", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@&nepali.mehry", index: "&nepali.mehry" },
        { alias: "@&nepali.liia", index: "&nepali.liia" },
        { alias: "@&do-not.delete", index: "&do-not.delete" },
        { alias: "@&nyc-open-data.taxi", index: "&nyc-open-data.taxi" },
      ]);
    });

    it("should allow to deletes multiple indexes", () => {
      const promise = elasticsearch.client.deleteIndexes([
        "nepali",
        "nyc-open-data",
      ]);

      return promise.then((result) => {
        should(elasticsearch.client._client.indices.delete).be.calledWithMatch({
          index: ["&nepali.mehry", "&nepali.liia", "&nyc-open-data.taxi"],
        });

        should(result).match(["nepali", "nyc-open-data"]);
      });
    });

    it("should not delete unauthorized indexes", () => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@&nepali.mehry", index: "&nepali.mehry" },
        { alias: "@&nepali.liia", index: "&nepali.liia" },
        { alias: "@&do-not.delete", index: "&do-not.delete" },
        { alias: "@%nyc-open-data.taxi", index: "%nyc-open-data.taxi" },
      ]);

      const promise = elasticsearch.client.deleteIndexes([
        "nepali",
        "nyc-open-data",
      ]);

      return promise.then((result) => {
        should(elasticsearch.client._client.indices.delete).be.calledWithMatch({
          index: ["&nepali.mehry", "&nepali.liia"],
        });

        should(result).match(["nepali"]);
      });
    });

    it("should return a rejected promise if client fails", async () => {
      elasticsearch.client._client.cat.aliases.rejects(esClientError);

      await should(elasticsearch.client.listIndexes()).be.rejected();
      should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
        esClientError,
      );
    });
  });

  describe("#deleteIndex", () => {
    it("should call deleteIndexes", () => {
      elasticsearch.client.deleteIndexes = sinon.stub().resolves();

      const promise = elasticsearch.client.deleteIndex("nepali");

      return promise.then((result) => {
        should(elasticsearch.client.deleteIndexes).be.calledWith(["nepali"]);

        should(result).be.null();
      });
    });
  });

  describe("#deleteCollection", () => {
    beforeEach(() => {
      sinon.stub(elasticsearch.client, "_createHiddenCollection").resolves();
      sinon.stub(elasticsearch.client, "_getIndice").resolves(indice);
      sinon
        .stub(elasticsearch.client, "_checkIfAliasExists")
        .resolves(undefined);
    });

    afterEach(() => {
      elasticsearch.client._getIndice.restore();
    });

    it("should allow to delete a collection", async () => {
      const result = await elasticsearch.client.deleteCollection(
        index,
        collection,
      );

      should(elasticsearch.client._client.indices.delete).be.calledWithMatch({
        index: indice,
      });

      should(result).be.null();

      should(elasticsearch.client._createHiddenCollection).be.called();
    });

    it("should create the hidden collection if the index is empty", async () => {
      await elasticsearch.client.deleteCollection(index, collection);

      should(elasticsearch.client._createHiddenCollection).be.called();
    });

    it("should delete the remaining alias if it still exists", async () => {
      elasticsearch.client._checkIfAliasExists.resolves(["myalias"]);
      elasticsearch.client._client.indices.deleteAlias = sinon
        .stub()
        .resolves();

      await elasticsearch.client.deleteCollection(index, collection);

      should(elasticsearch.client._client.indices.deleteAlias).be.called();
    });
  });

  describe("#refreshCollection", () => {
    it("should send a valid request to es client", () => {
      elasticsearch.client._client.indices.refresh.resolves({
        _shards: "shards",
      });

      const promise = elasticsearch.client.refreshCollection(index, collection);

      return promise.then((result) => {
        should(elasticsearch.client._client.indices.refresh).be.calledWithMatch(
          {
            index: alias,
          },
        );

        should(result).match({
          _shards: "shards",
        });
      });
    });

    it("should return a rejected promise if client fails", async () => {
      elasticsearch.client._client.indices.refresh.rejects(esClientError);

      await should(
        elasticsearch.client.refreshCollection(index, collection),
      ).rejected();

      should(elasticsearch.client._esWrapper.formatESError).calledWith(
        esClientError,
      );
    });
  });

  describe("#exists", () => {
    it("should have document exists capability", () => {
      elasticsearch.client._client.exists.resolves(true);

      const promise = elasticsearch.client.exists(index, collection, "liia");

      return promise.then((result) => {
        should(elasticsearch.client._client.exists).be.calledWithMatch({
          index: alias,
          id: "liia",
        });

        should(result).be.eql(true);
      });
    });

    it("should return a rejected promise if client fails", () => {
      elasticsearch.client._client.exists.rejects(esClientError);

      const promise = elasticsearch.client.exists(index, collection, "liia");

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#hasIndex", () => {
    it("should call list indexes and return true if index exists", () => {
      elasticsearch.client.listIndexes = sinon
        .stub()
        .resolves(["nepali", "nyc-open-data"]);

      const promise = elasticsearch.client.hasIndex("nepali");

      return promise.then((result) => {
        should(elasticsearch.client.listIndexes).be.called();

        should(result).be.eql(true);
      });
    });

    it("should call list indexes and return false if index does not exists", () => {
      elasticsearch.client.listIndexes = sinon
        .stub()
        .resolves(["nepali", "nyc-open-data"]);

      const promise = elasticsearch.client.hasIndex("vietnam");

      return promise.then((result) => {
        should(elasticsearch.client.listIndexes).be.called();

        should(result).be.eql(false);
      });
    });
  });

  describe("#hasCollection", () => {
    it("should call list collections and return true if collection exists", () => {
      elasticsearch.client.listCollections = sinon
        .stub()
        .resolves(["liia", "mehry"]);

      const promise = elasticsearch.client.hasCollection("nepali", "liia");

      return promise.then((result) => {
        should(elasticsearch.client.listCollections).be.called();

        should(result).be.eql(true);
      });
    });

    it("should call list collections and return false if collection does not exists", () => {
      elasticsearch.client.listCollections = sinon
        .stub()
        .resolves(["liia", "mehry"]);

      const promise = elasticsearch.client.hasCollection("nepali", "lfiduras");

      return promise.then((result) => {
        should(elasticsearch.client.listCollections).be.called();

        should(result).be.eql(false);
      });
    });
  });

  describe("#mCreate", () => {
    let kuzzleMeta, mExecuteResult, documentsWithIds, documentsWithoutIds;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null,
        },
      };

      documentsWithIds = [
        { body: { city: "Kathmandu" } },
        { _id: "liia", body: { city: "Ho Chi Minh City" } },
      ];

      documentsWithoutIds = [
        { body: { city: "Kathmandu" } },
        { body: { city: "Ho Chi Minh City" } },
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it("should do a mGet request if we need to get some documents", () => {
      elasticsearch.client._client.mget.resolves({
        docs: [],
      });

      const promise = elasticsearch.client.mCreate(
        index,
        collection,
        documentsWithIds,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          index: alias,
          docs: [{ _id: "liia", _source: false }],
        });

        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _index: alias } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should reject already existing documents", () => {
      elasticsearch.client._client.mget.resolves({
        docs: [{ _id: "liia", found: true }],
      });

      const promise = elasticsearch.client.mCreate(
        index,
        collection,
        documentsWithIds,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          index: alias,
          docs: [{ _id: "liia", _source: false }],
        });

        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [{ _source: { city: "Kathmandu", ...kuzzleMeta } }];
        const rejected = [
          {
            document: {
              _id: "liia",
              body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
            },
            reason: "document already exists",
            status: 400,
          },
        ];

        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          rejected,
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should not do a mGet request if we didn't need to get some documents", () => {
      const promise = elasticsearch.client.mCreate(
        index,
        collection,
        documentsWithoutIds,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).not.be.called();

        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _index: alias } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should allow additional options", () => {
      kuzzleMeta._kuzzle_info.author = "aschen";
      const promise = elasticsearch.client.mCreate(
        index,
        collection,
        documentsWithoutIds,
        { refresh: "wait_for", timeout: "10m", userId: "aschen" },
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).not.be.called();

        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _index: alias } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
          refresh: "wait_for",
          timeout: "10m",
        };
        const toImport = [
          { _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });
  });

  describe("#mCreateOrReplace", () => {
    let kuzzleMeta, mExecuteResult, documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null,
        },
      };

      documents = [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { _id: "liia", body: { city: "Ho Chi Minh City" } },
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it("should call _mExecute with formated documents and source flag", async () => {
      const promise = elasticsearch.client.mCreateOrReplace(
        index,
        collection,
        documents,
        { source: false },
      );

      const result = await promise;

      const esRequest = {
        index: alias,
        operations: [
          { index: { _index: alias, _id: "mehry" } },
          { city: "Kathmandu", ...kuzzleMeta },
          { index: { _index: alias, _id: "liia" } },
          { city: "Ho Chi Minh City", ...kuzzleMeta },
        ],
        refresh: undefined,
        timeout: undefined,
      };
      const toImport = [
        { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
        { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
      ];
      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        [],
        { source: false },
      );

      should(result).match(mExecuteResult);
    });

    it("should call _mExecute with formated documents", () => {
      const promise = elasticsearch.client.mCreateOrReplace(
        index,
        collection,
        documents,
      );

      return promise.then((result) => {
        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias, _id: "mehry" } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _index: alias, _id: "liia" } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should allow additional options", () => {
      kuzzleMeta._kuzzle_info.author = "aschen";

      const promise = elasticsearch.client.mCreateOrReplace(
        index,
        collection,
        documents,
        { refresh: "wait_for", timeout: "10m", userId: "aschen" },
      );

      return promise.then((result) => {
        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias, _id: "mehry" } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _index: alias, _id: "liia" } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
          refresh: "wait_for",
          timeout: "10m",
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should not inject kuzzle meta when specified", () => {
      const promise = elasticsearch.client.mCreateOrReplace(
        index,
        collection,
        documents,
        { injectKuzzleMeta: false },
      );

      return promise.then((result) => {
        const esRequest = {
          index: alias,
          operations: [
            { index: { _index: alias, _id: "mehry" } },
            { city: "Kathmandu" },
            { index: { _index: alias, _id: "liia" } },
            { city: "Ho Chi Minh City" },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu" } },
          { _id: "liia", _source: { city: "Ho Chi Minh City" } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it('should forward the "limits" option to mExecute', async () => {
      await elasticsearch.client.mCreateOrReplace(
        index,
        collection,
        documents,
        {
          limits: false,
        },
      );

      const options = elasticsearch.client._mExecute.getCall(0).args[3];
      should(options.limits).be.false();
    });
  });

  describe("#mUpdate", () => {
    let kuzzleMeta, mExecuteResult, documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          updater: null,
          updatedAt: timestamp,
        },
      };

      documents = [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { _id: "liia", body: { city: "Ho Chi Minh City" } },
      ];

      mExecuteResult = {
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu" },
            get: { _source: { age: 26, city: "Kathmandu" } },
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City" },
            get: { _source: { age: 29, city: "Ho Chi Minh City" } },
          },
        ],
        errors: [],
      };

      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it("should call _mExecute with formated documents", () => {
      const promise = elasticsearch.client.mUpdate(
        index,
        collection,
        documents,
      );

      return promise.then((result) => {
        const esRequest = {
          index: alias,
          operations: [
            {
              update: {
                _index: alias,
                _id: "mehry",
                retry_on_conflict:
                  elasticsearch.config.defaults.onUpdateConflictRetries,
              },
            },
            { doc: { city: "Kathmandu", ...kuzzleMeta }, _source: true },
            {
              update: {
                _index: alias,
                _id: "liia",
                retry_on_conflict:
                  elasticsearch.config.defaults.onUpdateConflictRetries,
              },
            },
            { doc: { city: "Ho Chi Minh City", ...kuzzleMeta }, _source: true },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match({
          items: [
            {
              _id: "mehry",
              _source: { city: "Kathmandu", age: 26 },
            },
            {
              _id: "liia",
              _source: { city: "Ho Chi Minh City", age: 29 },
            },
          ],
          errors: [],
        });
      });
    });

    it("should allow additional options", () => {
      kuzzleMeta._kuzzle_info.updater = "aschen";

      const promise = elasticsearch.client.mUpdate(
        index,
        collection,
        documents,
        {
          refresh: "wait_for",
          retryOnConflict: 2,
          timeout: "10m",
          userId: "aschen",
        },
      );

      return promise.then(() => {
        const esRequest = {
          index: alias,
          operations: [
            { update: { _index: alias, _id: "mehry", retry_on_conflict: 2 } },
            { doc: { city: "Kathmandu", ...kuzzleMeta }, _source: true },
            { update: { _index: alias, _id: "liia", retry_on_conflict: 2 } },
            { doc: { city: "Ho Chi Minh City", ...kuzzleMeta }, _source: true },
          ],
          refresh: "wait_for",
          timeout: "10m",
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );
      });
    });

    it("should add documents without ID to rejected documents", () => {
      documents = [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { body: { city: "Ho Chi Minh City" } },
      ];

      const promise = elasticsearch.client.mUpdate(
        index,
        collection,
        documents,
      );

      return promise.then(() => {
        const esRequest = {
          index: alias,
          operations: [
            {
              update: {
                _index: alias,
                _id: "mehry",
                retry_on_conflict:
                  elasticsearch.config.defaults.onUpdateConflictRetries,
              },
            },
            { doc: { city: "Kathmandu", ...kuzzleMeta }, _source: true },
          ],
          refresh: undefined,
          timeout: undefined,
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
        ];
        const rejected = [
          {
            document: {
              _id: undefined,
              body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
            },
            reason: "document _id must be a string",
            status: 400,
          },
        ];

        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          rejected,
        );
      });
    });
  });

  describe("#mUpsert", () => {
    let documents;
    let kuzzleUpdateMeta;
    let kuzzleCreateMeta;
    let esRequest;
    let toImport;
    let mExecuteResult;

    beforeEach(() => {
      documents = [
        { _id: "mehry", changes: { city: "Kathmandu" } },
        { _id: "liia", changes: { city: "Ho Chi Minh City" } },
      ];

      kuzzleUpdateMeta = {
        _kuzzle_info: {
          updater: null,
          updatedAt: timestamp,
        },
      };
      kuzzleCreateMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
        },
      };

      esRequest = {
        operations: [
          {
            update: {
              _index: alias,
              _id: "mehry",
              _source: true,
              retry_on_conflict:
                elasticsearch.config.defaults.onUpdateConflictRetries,
            },
          },
          {
            doc: { city: "Kathmandu", ...kuzzleUpdateMeta },
            upsert: { city: "Kathmandu", ...kuzzleCreateMeta },
          },
          {
            update: {
              _index: alias,
              _id: "liia",
              _source: true,
              retry_on_conflict:
                elasticsearch.config.defaults.onUpdateConflictRetries,
            },
          },
          {
            doc: { city: "Ho Chi Minh City", ...kuzzleUpdateMeta },
            upsert: { city: "Ho Chi Minh City", ...kuzzleCreateMeta },
          },
        ],
        refresh: undefined,
        timeout: undefined,
      };

      toImport = [
        {
          _id: "mehry",
          _source: {
            changes: { city: "Kathmandu", ...kuzzleUpdateMeta },
            default: { city: "Kathmandu", ...kuzzleCreateMeta },
          },
        },
        {
          _id: "liia",
          _source: {
            changes: { city: "Ho Chi Minh City", ...kuzzleUpdateMeta },
            default: { city: "Ho Chi Minh City", ...kuzzleCreateMeta },
          },
        },
      ];

      mExecuteResult = {
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu" },
            created: false,
            result: "updated",
            get: { _source: { age: 26, city: "Kathmandu" } },
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City" },
            created: false,
            result: "updated",
            get: { _source: { age: 29, city: "Ho Chi Minh City" } },
          },
        ],
        errors: [],
      };

      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it("should call _mExecute with formated documents", async () => {
      const result = await elasticsearch.client.mUpsert(
        index,
        collection,
        documents,
      );

      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        [],
      );

      should(result).match({
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu", age: 26 },
            created: false,
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City", age: 29 },
            created: false,
          },
        ],
        errors: [],
      });
    });

    it("should handle default values for upserted documents", async () => {
      documents[1].default = { country: "Vietnam" };
      esRequest.operations[3].upsert.country = "Vietnam";
      toImport[1]._source.default.country = "Vietnam";

      const result = await elasticsearch.client.mUpsert(
        index,
        collection,
        documents,
      );

      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        [],
      );

      should(result).match({
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu", age: 26 },
            created: false,
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City", age: 29 },
            created: false,
          },
        ],
        errors: [],
      });
    });

    it("should allow additional options", async () => {
      kuzzleUpdateMeta._kuzzle_info.updater = "aschen";
      kuzzleCreateMeta._kuzzle_info.author = "aschen";
      esRequest.operations[0].update.retry_on_conflict = 42;
      esRequest.operations[2].update.retry_on_conflict = 42;
      esRequest.refresh = "wait_for";
      esRequest.timeout = "10m";

      await elasticsearch.client.mUpsert(index, collection, documents, {
        refresh: "wait_for",
        retryOnConflict: 42,
        timeout: "10m",
        userId: "aschen",
      });

      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        [],
      );
    });

    it("should add documents without ID to rejected documents", async () => {
      documents[1] = { changes: { city: "Ho Chi Minh City" } };
      esRequest.operations = esRequest.operations.slice(0, 2);
      toImport = toImport.slice(0, 1);
      const rejected = [
        {
          document: { changes: { city: "Ho Chi Minh City" } },
          reason: "document _id must be a string",
          status: 400,
        },
      ];

      await elasticsearch.client.mUpsert(index, collection, documents);

      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        rejected,
      );
    });

    it('should return the right "_created" result on a document creation', async () => {
      mExecuteResult.items[1].result = "created";
      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);

      const result = await elasticsearch.client.mUpsert(
        index,
        collection,
        documents,
      );

      should(elasticsearch.client._mExecute).be.calledWithMatch(
        esRequest,
        toImport,
        [],
      );

      should(result).match({
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu", age: 26 },
            created: false,
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City", age: 29 },
            created: true,
          },
        ],
        errors: [],
      });
    });
  });

  describe("#mReplace", () => {
    let kuzzleMeta, mExecuteResult, documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null,
        },
      };

      documents = [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { _id: "liia", body: { city: "Ho Chi Minh City" } },
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch.client._mExecute = sinon.stub().resolves(mExecuteResult);

      elasticsearch.client._client.mget.resolves({
        docs: [
          { _id: "mehry", found: true },
          { _id: "liia", found: true },
        ],
      });
    });

    it("should get documents and then format them for _mExecute", () => {
      const promise = elasticsearch.client.mReplace(
        index,
        collection,
        documents,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          index: alias,
          docs: [
            { _id: "mehry", _source: false },
            { _id: "liia", _source: false },
          ],
        });

        const esRequest = {
          refresh: undefined,
          timeout: undefined,
          operations: [
            { index: { _id: "mehry", _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _id: "liia", _index: alias } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should add not found documents to rejected", () => {
      elasticsearch.client._client.mget.resolves({
        docs: [
          { _id: "mehry", found: true },
          { _id: "liia", found: false },
        ],
      });

      const promise = elasticsearch.client.mReplace(
        index,
        collection,
        documents,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          index: alias,
          docs: [
            { _id: "mehry", _source: false },
            { _id: "liia", _source: false },
          ],
        });

        const esRequest = {
          refresh: undefined,
          timeout: undefined,
          operations: [
            { index: { _id: "mehry", _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
          ],
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
        ];
        const rejected = [
          {
            document: {
              _id: "liia",
              body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
            },
            reason: "document not found",
            status: 404,
          },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          rejected,
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should add documents without an ID to rejected", () => {
      documents = [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { body: { city: "Ho Chi Minh City" } },
      ];
      elasticsearch.client._client.mget.resolves({
        docs: [{ _id: "mehry", found: true }],
      });

      const promise = elasticsearch.client.mReplace(
        index,
        collection,
        documents,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.mget).be.calledWithMatch({
          index: alias,
          docs: [{ _id: "mehry", _source: false }],
        });

        const esRequest = {
          refresh: undefined,
          timeout: undefined,
          operations: [
            { index: { _id: "mehry", _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
          ],
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
        ];
        const rejected = [
          {
            document: { body: { city: "Ho Chi Minh City" } },
            reason: "document _id must be a string",
            status: 400,
          },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          rejected,
        );

        should(result).match(mExecuteResult);
      });
    });

    it("should allow additional options", () => {
      kuzzleMeta._kuzzle_info.author = "aschen";

      const promise = elasticsearch.client.mReplace(
        index,
        collection,
        documents,
        {
          refresh: "wait_for",
          timeout: "10m",
          userId: "aschen",
        },
      );

      return promise.then((result) => {
        const esRequest = {
          refresh: "wait_for",
          timeout: "10m",
          operations: [
            { index: { _id: "mehry", _index: alias } },
            { city: "Kathmandu", ...kuzzleMeta },
            { index: { _id: "liia", _index: alias } },
            { city: "Ho Chi Minh City", ...kuzzleMeta },
          ],
        };
        const toImport = [
          { _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", ...kuzzleMeta } },
        ];
        should(elasticsearch.client._mExecute).be.calledWithMatch(
          esRequest,
          toImport,
          [],
        );

        should(result).match(mExecuteResult);
      });
    });
  });

  describe("#mDelete", () => {
    let documentIds;

    beforeEach(() => {
      documentIds = ["mehry", "liia"];

      elasticsearch.client._getAllDocumentsFromQuery = sinon.stub().resolves([
        { _id: "mehry", _source: { city: "Kathmandu" } },
        { _id: "liia", _source: { city: "Ho Chi Minh City" } },
      ]);

      elasticsearch.client._client.deleteByQuery.resolves({
        total: 2,
        deleted: 2,
        failures: [],
      });

      elasticsearch.client._client.indices.refresh.resolves({
        _shards: 1,
      });

      elasticsearch.client.mGet = sinon.stub().resolves({
        items: [
          { _id: "mehry", _source: { city: "Kathmandu" } },
          { _id: "liia", _source: { city: "Ho Chi Minh City" } },
        ],
      });
    });

    it("should allow to delete multiple documents with deleteByQuery", async () => {
      const result = await elasticsearch.client.mDelete(
        index,
        collection,
        documentIds,
      );

      should(elasticsearch.client._client.indices.refresh).be.calledWith({
        index: `@&${index}.${collection}`,
      });

      should(elasticsearch.client.mGet).be.calledWithMatch(index, collection, [
        "mehry",
        "liia",
      ]);

      should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
        index: alias,
        query: { ids: { values: ["mehry", "liia"] } },
        scroll: "5s",
      });

      should(result).match({
        documents: [
          { _id: "mehry", _source: { city: "Kathmandu" } },
          { _id: "liia", _source: { city: "Ho Chi Minh City" } },
        ],
        errors: [],
      });
    });

    it("should add non existing documents to rejected", () => {
      elasticsearch.client.mGet = sinon.stub().resolves({
        items: [{ _id: "mehry", _source: { city: "Kathmandu" } }],
      });

      const promise = elasticsearch.client.mDelete(
        index,
        collection,
        documentIds,
      );

      return promise.then((result) => {
        should(elasticsearch.client.mGet).be.calledWithMatch(
          index,
          collection,
          ["mehry", "liia"],
        );

        should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
          index: alias,
          query: { ids: { values: ["mehry"] } },
          scroll: "5s",
        });

        should(result).match({
          documents: [{ _id: "mehry", _source: { city: "Kathmandu" } }],
          errors: [{ _id: "liia", reason: "document not found", status: 404 }],
        });
      });
    });

    it("should add document with ID non string to rejected", () => {
      elasticsearch.client.mGet = sinon.stub().resolves({
        items: [{ _id: "mehry", _source: { city: "Kathmandu" } }],
      });

      const promise = elasticsearch.client.mDelete(index, collection, [
        "mehry",
        42,
      ]);

      return promise.then((result) => {
        should(elasticsearch.client.mGet).be.calledWithMatch(
          index,
          collection,
          ["mehry"],
        );

        should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
          index: alias,
          query: { ids: { values: ["mehry"] } },
          scroll: "5s",
        });

        should(result).match({
          documents: [{ _id: "mehry", _source: { city: "Kathmandu" } }],
          errors: [
            { _id: 42, reason: "document _id must be a string", status: 400 },
          ],
        });
      });
    });

    it("should allow additional options", () => {
      const promise = elasticsearch.client.mDelete(
        index,
        collection,
        documentIds,
        {
          refresh: "wait_for",
        },
      );

      return promise.then(() => {
        should(elasticsearch.client._client.deleteByQuery).be.calledWithMatch({
          index: alias,
          query: { ids: { values: ["mehry", "liia"] } },
          scroll: "5s",
          refresh: true,
        });
      });
    });
  });

  describe("_mExecute", () => {
    let esRequest, documents, partialErrors;

    beforeEach(() => {
      esRequest = {
        refresh: undefined,
        operations: [
          { index: { _index: alias, _id: "liia" } },
          { city: "Kathmandu" },
          { update: { _index: alias, _id: "mehry" } },
          { doc: { city: "Kathmandu" } },
        ],
      };

      documents = [
        { _id: "liia", _source: { city: "Kathmandu" } },
        { _id: "mehry", _source: { city: "Ho Chi Minh City" } },
      ];

      partialErrors = [
        {
          document: { body: { some: "document" } },
          status: 400,
          reason: "some reason",
        },
      ];

      elasticsearch.client._client.bulk.resolves({
        items: [
          {
            index: {
              _id: "liia",
              status: 201,
              _version: 1,
              result: "created",
              created: true,
              foo: "bar",
            },
          },
          {
            index: {
              _id: "mehry",
              status: 400,
              error: { reason: "bad request" },
              bar: "foo",
            },
          },
        ],
      });
    });

    it("should call client.bulk and separate success from errors", () => {
      const promise = elasticsearch.client._mExecute(
        esRequest,
        documents,
        partialErrors,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.bulk).be.calledWithMatch(esRequest);

        const expectedResult = [
          {
            _id: "liia",
            _source: { city: "Kathmandu" },
            status: 201,
            _version: 1,
            created: true,
            result: "created",
          },
        ];
        const expectedErrors = [
          {
            document: { body: { some: "document" } },
            status: 400,
            reason: "some reason",
          },
          {
            document: { _id: "mehry", _source: { city: "Ho Chi Minh City" } },
            status: 400,
            reason: "bad request",
          },
        ];
        should(result).match({
          items: expectedResult,
          errors: expectedErrors,
        });
      });
    });

    it("should not call bulk if there is no documents", () => {
      const promise = elasticsearch.client._mExecute(
        esRequest,
        [],
        partialErrors,
      );

      return promise.then((result) => {
        should(elasticsearch.client._client.bulk).not.be.called();

        const expectedErrors = [
          {
            document: { body: { some: "document" } },
            reason: "some reason",
          },
        ];
        should(result).match({
          items: [],
          errors: expectedErrors,
        });
      });
    });

    it("should reject if limit document reached", () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch.client._mExecute(
        esRequest,
        documents,
        partialErrors,
      );

      return should(promise).be.rejectedWith({
        id: "services.storage.write_limit_exceeded",
      });
    });

    it('should not reject if the documents limit is reached but the "limits" option is false', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch.client._mExecute(
        esRequest,
        documents,
        partialErrors,
        { limits: false },
      );

      return should(promise).be.fulfilled();
    });

    it("should return a rejected promise if client fails", () => {
      elasticsearch.client._client.bulk.rejects(esClientError);

      const promise = elasticsearch.client._mExecute(
        esRequest,
        documents,
        partialErrors,
      );

      return should(promise)
        .be.rejected()
        .then(() => {
          should(elasticsearch.client._esWrapper.formatESError).be.calledWith(
            esClientError,
          );
        });
    });
  });

  describe("#_extractMDocuments", () => {
    it("should add documents without body in rejected array", () => {
      const documents = [
        { _id: "liia", body: { city: "Kathmandu" } },
        { _id: "no-body" },
      ];
      const kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null,
        },
      };

      const { rejected, extractedDocuments } =
        elasticsearch.client._extractMDocuments(documents, kuzzleMeta);

      should(rejected).match([
        {
          document: { _id: "no-body" },
          reason: "document body must be an object",
        },
      ]);

      should(extractedDocuments).match([
        {
          _id: "liia",
          _source: { city: "Kathmandu" },
        },
      ]);
    });
  });

  describe("#isIndexNameValid", () => {
    it("should allow a valid index name", () => {
      should(elasticsearch.client.isIndexNameValid("foobar")).be.true();
    });

    it("should not allow empty index names", () => {
      should(elasticsearch.client.isIndexNameValid("")).be.false();
    });

    it("should not allow uppercase chars", () => {
      should(elasticsearch.client.isIndexNameValid("bAr")).be.false();
    });

    it("should not allow index names that are too long", () => {
      return should(
        elasticsearch.client.isIndexNameValid("Ӣ".repeat(64)),
      ).be.false();
    });

    it("should not allow forbidden chars in the name", () => {
      const forbidden = '\\/*?"<>| \t\r\n,#:%.&';

      for (let i = 0; i < forbidden.length; i++) {
        const name = `foo${forbidden[i]}bar`;

        should(elasticsearch.client.isIndexNameValid(name)).be.false();
      }
    });
  });

  describe("#isCollectionNameValid", () => {
    it("should allow a valid collection name", () => {
      should(elasticsearch.client.isCollectionNameValid("foobar")).be.true();
    });

    it("should not allow empty collection names", () => {
      should(elasticsearch.client.isCollectionNameValid("")).be.false();
    });

    it("should not allow uppercase chars", () => {
      should(elasticsearch.client.isCollectionNameValid("bAr")).be.false();
    });

    it("should not allow collection names that are too long", () => {
      return should(
        elasticsearch.client.isCollectionNameValid("Ӣ".repeat(64)),
      ).be.false();
    });

    it("should not allow forbidden chars in the name", () => {
      const forbidden = '\\/*?"<>| \t\r\n,#:%.&';

      for (let i = 0; i < forbidden.length; i++) {
        const name = `foo${forbidden[i]}bar`;

        should(elasticsearch.client.isCollectionNameValid(name)).be.false();
      }
    });
  });

  describe("#getSchema", () => {
    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: "@&nepali.mehry" },
        { alias: "@&nepali._kuzzle_keep" },
        { alias: "@&istanbul._kuzzle_keep" },
      ]);
    });

    it("should returns the DB schema without hidden collections", async () => {
      const schema = await elasticsearch.client.getSchema();
      should(schema).be.eql({
        nepali: ["mehry"],
        istanbul: [],
      });
    });
  });

  describe("#_createHiddenCollection", () => {
    const hiddenIndice = "&nisantasi._kuzzle_keep";
    const hiddenAlias = `@${hiddenIndice}`;

    beforeEach(() => {
      elasticsearch.client._client.cat.aliases.resolves([]);

      sinon
        .stub(elasticsearch.client, "_getAvailableIndice")
        .resolves(hiddenIndice);
      sinon.stub(elasticsearch.client, "_getWaitForActiveShards").returns(1);
    });

    afterEach(() => {
      elasticsearch.client._getAvailableIndice.restore();
    });

    it("creates the hidden collection", async () => {
      elasticsearch.client._client.indices.create.resolves({});

      await elasticsearch.client._createHiddenCollection("nisantasi");

      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: hiddenIndice,
        aliases: { [hiddenAlias]: {} },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
      });
      should(Mutex.prototype.lock).be.called();
      should(Mutex.prototype.unlock).be.called();
    });

    it("does not create the hidden collection if it already exists", async () => {
      elasticsearch.client._client.cat.aliases.resolves([
        { alias: hiddenAlias },
      ]);

      await elasticsearch.client._createHiddenCollection("nisantasi");

      should(elasticsearch.client._client.indices.create).not.be.called();
    });

    it("does create hidden collection based on global settings", async () => {
      elasticsearch.client._client.indices.create.resolves({});
      elasticsearch.config.defaultSettings = {
        number_of_shards: 42,
        number_of_replicas: 42,
      };

      await elasticsearch.client._createHiddenCollection("nisantasi");

      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: hiddenIndice,
        aliases: { [hiddenAlias]: {} },
        settings: {
          number_of_shards: 42,
          number_of_replicas: 42,
        },
      });
      should(Mutex.prototype.lock).be.called();
      should(Mutex.prototype.unlock).be.called();
    });

    it("should wait for all shards to being active when using an Elasticsearch cluster", async () => {
      elasticsearch.client._client.indices.create.resolves({});
      elasticsearch.client._getWaitForActiveShards = sinon
        .stub()
        .returns("all");
      await elasticsearch.client._createHiddenCollection("nisantasi");

      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: hiddenIndice,
        aliases: { [hiddenAlias]: {} },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
        wait_for_active_shards: "all",
      });
    });

    it("should wait for only one shard to being active when using a single node Elasticsearch cluster", async () => {
      elasticsearch.client._client.indices.create.resolves({});
      elasticsearch.client._getWaitForActiveShards = sinon.stub().returns(1);
      await elasticsearch.client._createHiddenCollection("nisantasi");

      should(elasticsearch.client._client.indices.create).be.calledWithMatch({
        index: hiddenIndice,
        aliases: { [hiddenAlias]: {} },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
        wait_for_active_shards: 1,
      });
    });
  });

  describe("#_checkMappings", () => {
    it("should throw when a property is incorrect", () => {
      const mapping2 = {
        type: "nested",
        properties: {},
      };
      const mapping = {
        properties: {},
        dinamic: "false",
      };

      global.NODE_ENV = "development";
      should(() => elasticsearch.client._checkMappings(mapping)).throw({
        message:
          'Invalid mapping property "mappings.dinamic". Did you mean "dynamic"?',
        id: "services.storage.invalid_mapping",
      });

      should(() => elasticsearch.client._checkMappings(mapping2)).throw({
        message: 'Invalid mapping property "mappings.type".',
        id: "services.storage.invalid_mapping",
      });
    });

    it("should throw when a nested property is incorrect", () => {
      const mapping = {
        dynamic: "false",
        properties: {
          name: { type: "keyword" },
          car: {
            dinamic: "false",
            properties: {
              brand: { type: "keyword" },
            },
          },
        },
      };

      global.NODE_ENV = "development";
      should(() => elasticsearch.client._checkMappings(mapping)).throw({
        message:
          'Invalid mapping property "mappings.properties.car.dinamic". Did you mean "dynamic"?',
        id: "services.storage.invalid_mapping",
      });

      global.NODE_ENV = "production";
      should(() => elasticsearch.client._checkMappings(mapping)).throw({
        message: 'Invalid mapping property "mappings.properties.car.dinamic".',
        id: "services.storage.invalid_mapping",
      });
    });

    it("should return null if no properties are incorrect", () => {
      const mapping = {
        dynamic: "false",
        properties: {
          name: { type: "keyword" },
          car: {
            dynamic: "false",
            dynamic_templates: {},
            type: "nested",
            properties: {
              brand: { type: "keyword" },
            },
          },
        },
      };

      should(() => elasticsearch.client._checkMappings(mapping)).not.throw();
    });
  });

  describe("Collection emulation utils", () => {
    let internalES;
    let publicES;

    beforeEach(async () => {
      publicES = new ES(kuzzle.config.services.storageEngine);
      internalES = new ES(
        kuzzle.config.services.storageEngine,
        storeScopeEnum.PRIVATE,
      );

      sinon.stub(publicES.client, "waitForElasticsearch").resolves();
      sinon.stub(internalES.client, "waitForElasticsearch").resolves();
      publicES.client._client = new ESClientMock("8.0.0");
      internalES.client._client = new ESClientMock("8.0.0");

      await publicES.init();
      await internalES.init();
    });

    describe("#_getAlias", () => {
      it("return alias name for a collection", () => {
        const publicAlias = publicES.client._getAlias("nepali", "liia");
        const internalAlias = internalES.client._getAlias("nepali", "mehry");

        should(publicAlias).be.eql("@&nepali.liia");
        should(internalAlias).be.eql("@%nepali.mehry");
      });
    });

    describe("#_getIndice", () => {
      let publicBody;
      let privateBody;

      it("return the indice name associated to an alias (index+collection)", async () => {
        publicBody = [
          { alias: "@&nepali.liia", index: "&nepali.lia", filter: 0 },
        ];
        privateBody = [
          { alias: "@%nepali.mehry", index: "%nepalu.mehry", filter: 0 },
        ];
        publicES.client._client.cat.aliases.resolves(publicBody);
        internalES.client._client.cat.aliases.resolves(privateBody);

        const publicIndice = await publicES.client._getIndice("nepali", "liia");
        const internalIndice = await internalES.client._getIndice(
          "nepali",
          "mehry",
        );

        should(publicIndice).be.eql("&nepali.lia");
        should(internalIndice).be.eql("%nepalu.mehry");
      });

      it("throw if there is no indice associated with the alias", async () => {
        publicES.client._client.cat.aliases.resolves([]);
        internalES.client._client.cat.aliases.resolves([]);

        await should(
          publicES.client._getIndice("nepali", "liia"),
        ).be.rejectedWith({
          id: "services.storage.unknown_index_collection",
        });

        await should(
          internalES.client._getIndice("nepali", "mehry"),
        ).be.rejectedWith({
          id: "services.storage.unknown_index_collection",
        });
      });

      it("throw if there is more than one indice associated with the alias", async () => {
        publicBody = [
          { alias: "@&nepali.liia", index: "&nepali.lia", filter: 0 },
          { alias: "@&nepali.liia", index: "&nepali.liia", filter: 0 },
        ];
        privateBody = [
          { alias: "@%nepali.mehry", index: "%nepalu.mehry", filter: 0 },
          { alias: "@%nepali.mehry", index: "%nepali.mehry", filter: 0 },
        ];
        publicES.client._client.cat.aliases.resolves(publicBody);
        internalES.client._client.cat.aliases.resolves(privateBody);

        await should(
          publicES.client._getIndice("nepali", "liia"),
        ).be.rejectedWith({
          id: "services.storage.multiple_indice_alias",
        });

        await should(
          internalES.client._getIndice("nepali", "mehry"),
        ).be.rejectedWith({
          id: "services.storage.multiple_indice_alias",
        });
      });
    });

    describe("#_getAvailableIndice", () => {
      it("return simple indice whenever it is possible", async () => {
        publicES.client._client.indices.exists.resolves(false);
        internalES.client._client.indices.exists.resolves(false);

        const publicIndice = await publicES.client._getAvailableIndice(
          "nepali",
          "liia",
        );
        const internalIndice = await internalES.client._getAvailableIndice(
          "nepali",
          "_kuzzle_keep",
        );

        should(publicIndice).be.eql("&nepali.liia");
        should(internalIndice).be.eql("%nepali._kuzzle_keep");
      });

      it("return a suffixed indice if necessary (indice already taken)", async () => {
        publicES.client._client.indices.exists
          .onFirstCall()
          .resolves(true)
          .resolves(false);
        internalES.client._client.indices.exists
          .onFirstCall()
          .resolves(true)
          .resolves(false);

        const publicIndice = await publicES.client._getAvailableIndice(
          "nepali",
          "liia",
        );
        const internalIndice = await internalES.client._getAvailableIndice(
          "nepali",
          "mehry",
        );

        should(publicIndice).match(new RegExp("&nepali.liia\\.\\d+"));
        should(internalIndice).match(new RegExp("%nepali.mehry\\.\\d+"));
      });

      it("return a truncated and suffixed indice if necessary (indice + suffix too long)", async () => {
        const longIndex =
          "averyveryverylongindexwhichhasexactlythemaximumlengthacceptedofonehundredandtwentysixcharactersandthatiswaytoolongdontyouthink";
        const longCollection =
          "averyverylongcollectionwhichhasexactlythemaximumlengthacceptedofonehundredandtwentysixcharactersandthatswaytoolongdontyouthink";
        publicES.client._client.indices.exists
          .onFirstCall()
          .resolves(true)
          .resolves(false);
        internalES.client._client.indices.exists
          .onFirstCall()
          .resolves(true)
          .resolves(false);

        const publicIndice = await publicES.client._getAvailableIndice(
          longIndex,
          longCollection,
        );
        const internalIndice = await internalES.client._getAvailableIndice(
          longIndex,
          longCollection,
        );

        const publicIndiceCaptureSuffix = new RegExp(`(\\d+)`).exec(
          publicIndice,
        )[0].length;
        const internalIndiceCaptureSuffix = new RegExp(`(\\d+)`).exec(
          internalIndice,
        )[0].length;

        should(publicIndice).match(
          new RegExp(
            `&${longIndex}.${longCollection.substr(0, longCollection.length - publicIndiceCaptureSuffix)}\\.\\d+`,
          ),
        );
        should(internalIndice).match(
          new RegExp(
            `%${longIndex}.${longCollection.substr(0, longCollection.length - internalIndiceCaptureSuffix)}\\.\\d+`,
          ),
        );

        // The indice should be truncated just enough, not more not less
        should(publicIndice).match(
          (value) => Buffer.from(value).length === 255,
        );
        should(internalIndice).match(
          (value) => Buffer.from(value).length === 255,
        );
      });
    });

    describe("#_getAliasFromIndice", () => {
      let publicBody;
      let privateBody;

      it("return the list of alias associated with an indice", async () => {
        publicBody = {
          ["&nepali.lia"]: {
            aliases: {
              ["@&nepali.liia"]: {},
            },
          },
        };
        privateBody = {
          ["%nepalu.mehry"]: {
            aliases: {
              ["@%nepali.mehry"]: {},
            },
          },
        };
        publicES.client._client.indices.getAlias.resolves(publicBody);
        internalES.client._client.indices.getAlias.resolves(privateBody);

        const publicIndice =
          await publicES.client._getAliasFromIndice("&nepali.lia");
        const internalIndice =
          await internalES.client._getAliasFromIndice("%nepalu.mehry");

        should(publicIndice).be.eql(["@&nepali.liia"]);
        should(internalIndice).be.eql(["@%nepali.mehry"]);
      });

      it("throw if there is no alias associated with the indice", async () => {
        publicBody = {
          ["&nepali.lia"]: {
            aliases: {},
          },
        };
        privateBody = {
          ["%nepalu.mehry"]: {
            aliases: {},
          },
        };
        publicES.client._client.indices.getAlias.resolves(publicBody);
        internalES.client._client.indices.getAlias.resolves(privateBody);

        await should(
          publicES.client._getAliasFromIndice("&nepali.lia"),
        ).be.rejectedWith({ id: "services.storage.unknown_index_collection" });

        await should(
          internalES.client._getAliasFromIndice("%nepalu.mehry"),
        ).be.rejectedWith({ id: "services.storage.unknown_index_collection" });
      });

      it("should not throw if there is more than one alias associated with the indice", async () => {
        publicBody = {
          ["&nepali.lia"]: {
            aliases: {
              ["@&nepali.liia"]: {},
              ["@&nepali.lia"]: {},
            },
          },
        };
        privateBody = {
          ["%nepalu.mehry"]: {
            aliases: {
              ["@%nepali.mehry"]: {},
              ["@%nepalu.mehry"]: {},
            },
          },
        };
        publicES.client._client.indices.getAlias.resolves(publicBody);
        internalES.client._client.indices.getAlias.resolves(privateBody);

        await should(
          publicES.client._getAliasFromIndice("&nepali.lia"),
        ).not.be.rejectedWith({ id: "services.storage.multiple_indice_alias" });

        await should(
          internalES.client._getAliasFromIndice("%nepalu.mehry"),
        ).not.be.rejectedWith({ id: "services.storage.multiple_indice_alias" });
      });

      it('should not throw if there is more than one alias associated with the indice but the aliases are not prefixed with "@"', async () => {
        publicBody = {
          ["&nepali.lia"]: {
            aliases: {
              ["@&nepali.liia"]: {},
              ["&nepali.lia"]: {},
            },
          },
        };
        privateBody = {
          ["%nepalu.mehry"]: {
            aliases: {
              ["@%nepali.mehry"]: {},
              ["%nepalu.mehry"]: {},
            },
          },
        };
        publicES.client._client.indices.getAlias.resolves(publicBody);
        internalES.client._client.indices.getAlias.resolves(privateBody);

        await should(
          publicES.client._getAliasFromIndice("&nepali.lia"),
        ).not.be.rejectedWith({ id: "services.storage.multiple_indice_alias" });

        await should(
          internalES.client._getAliasFromIndice("%nepalu.mehry"),
        ).not.be.rejectedWith({ id: "services.storage.multiple_indice_alias" });
      });
    });

    describe("#_getWaitForActiveShards", () => {
      it("should return all if an Elasticsearch cluster is used", async () => {
        elasticsearch.client._client.cat.nodes = sinon
          .stub()
          .resolves(["node1", "node2"]);

        const waitForActiveShards =
          await elasticsearch.client._getWaitForActiveShards();

        should(waitForActiveShards).be.eql("all");
      });

      it("should return 1 if a single node Elasticsearch cluster is used", async () => {
        elasticsearch.client._client.cat.nodes = sinon
          .stub()
          .resolves(["node1"]);

        const waitForActiveShards =
          await elasticsearch.client._getWaitForActiveShards();

        should(waitForActiveShards).be.eql(1);
      });
    });

    describe("#generateMissingAliases", () => {
      const indicesBody = [
        { index: "&nepali.liia", status: "open" },
        { index: "%nepali.liia", status: "open" },
        { index: "&nepali.mehry", status: "open" },
        { index: "%nepali.mehry", status: "open" },
      ];
      let aliasesList = [
        {
          alias: "@&nepali.lia",
          index: "nepali",
          collection: "lia",
          indice: "&nepali.liia",
        },
      ];

      beforeEach(() => {
        publicES.client._client.indices.updateAliases.resolves();
        internalES.client._client.indices.updateAliases.resolves();

        publicES.client._client.cat.indices.resolves(indicesBody);
        internalES.client._client.cat.indices.resolves(indicesBody);

        sinon.stub(publicES.client, "listAliases").resolves(aliasesList);
        sinon.stub(internalES.client, "listAliases").resolves(aliasesList);
      });

      afterEach(() => {
        publicES.client.listAliases.restore();
        internalES.client.listAliases.restore();
      });

      it("Find indices without associated aliases and create some accordingly", async () => {
        await publicES.client.generateMissingAliases();
        await internalES.client.generateMissingAliases();

        should(publicES.client._client.indices.updateAliases).be.calledWith({
          body: {
            actions: [
              { add: { alias: "@&nepali.mehry", index: "&nepali.mehry" } },
            ],
          },
        });
        should(internalES.client._client.indices.updateAliases).be.calledWith({
          body: {
            actions: [
              { add: { alias: "@%nepali.liia", index: "%nepali.liia" } },
              { add: { alias: "@%nepali.mehry", index: "%nepali.mehry" } },
            ],
          },
        });
      });

      it("do nothing when every indice is associated with an alias", async () => {
        aliasesList = [
          {
            alias: "@&nepali.lia",
            index: "nepali",
            collection: "lia",
            indice: "&nepali.liia",
          },
          {
            alias: "@%nepali.lia",
            index: "nepali",
            collection: "lia",
            indice: "%nepali.liia",
          },
          {
            alias: "@&nepalu.mehry",
            index: "nepalu",
            collection: "mehry",
            indice: "&nepali.mehry",
          },
          {
            alias: "@%nepalu.mehry",
            index: "nepalu",
            collection: "mehry",
            indice: "%nepali.mehry",
          },
        ];

        publicES.client.listAliases.resolves(aliasesList);
        internalES.client.listAliases.resolves(aliasesList);

        await publicES.client.generateMissingAliases();
        await internalES.client.generateMissingAliases();

        should(publicES.client._client.indices.updateAliases).not.be.called();
        should(internalES.client._client.indices.updateAliases).not.be.called();
      });
    });

    describe("#_extractIndex", () => {
      it("extract the index from alias", () => {
        const publicIndex = publicES.client._extractIndex("@&nepali.liia");
        const internalIndex = internalES.client._extractIndex("@%nepali.liia");

        should(publicIndex).be.eql("nepali");
        should(internalIndex).be.eql("nepali");
      });
    });

    describe("#_extractCollection", () => {
      it("extract the collection from alias", () => {
        const publicCollection =
          publicES.client._extractCollection("@&nepali.liia");
        const publicCollection2 =
          publicES.client._extractCollection("@&vietnam.lfiduras");
        const publicCollection3 =
          publicES.client._extractCollection("@&vietnam.l");
        const publicCollection4 = publicES.client._extractCollection(
          "@&vietnam.iamaverylongcollectionnamebecauseiworthit",
        );
        const internalCollection =
          internalES.client._extractCollection("@%nepali.liia");

        should(publicCollection).be.eql("liia");
        should(publicCollection2).be.eql("lfiduras");
        should(publicCollection3).be.eql("l");
        should(publicCollection4).be.eql(
          "iamaverylongcollectionnamebecauseiworthit",
        );
        should(internalCollection).be.eql("liia");
      });
    });

    describe("#_extractSchema", () => {
      it("should extract the list of indexes and their collections", () => {
        const aliases = [
          "@%nepali.liia",
          "@%nepali.mehry",

          "@&nepali.panipokari",
          "@&nepali._kuzzle_keep",
          "@&vietnam.lfiduras",
          "@&vietnam._kuzzle_keep",
        ];

        const publicSchema = publicES.client._extractSchema(aliases);
        const internalSchema = internalES.client._extractSchema(aliases);

        should(internalSchema).be.eql({
          nepali: ["liia", "mehry"],
        });
        should(publicSchema).be.eql({
          nepali: ["panipokari"],
          vietnam: ["lfiduras"],
        });
      });

      it("should include hidden collection with the option", () => {
        const aliases = [
          "@%nepali.liia",
          "@%nepali.mehry",

          "@&nepali.panipokari",
          "@&nepali._kuzzle_keep",
          "@&vietnam.lfiduras",
          "@&vietnam._kuzzle_keep",
        ];

        const publicSchema = publicES.client._extractSchema(aliases, {
          includeHidden: true,
        });
        const internalSchema = internalES.client._extractSchema(aliases, {
          includeHidden: true,
        });

        should(internalSchema).be.eql({
          nepali: ["liia", "mehry"],
        });
        should(publicSchema).be.eql({
          nepali: ["panipokari", "_kuzzle_keep"],
          vietnam: ["lfiduras", "_kuzzle_keep"],
        });
      });
    });

    describe("#_sanitizeSearchBody", () => {
      let searchBody;

      it("should return the same query if all top level keywords are valid", () => {
        searchBody = {};
        for (const key of publicES.client.searchBodyKeys) {
          searchBody[key] = { foo: "bar" };
        }

        const result = publicES.client._sanitizeSearchBody(
          Object.assign({}, searchBody),
        );

        should(result).be.deepEqual(searchBody);
      });

      it("should throw if any top level keyword is not in the white list", () => {
        searchBody = {
          unknown: {},
        };

        should(() => publicES.client._sanitizeSearchBody(searchBody)).throw(
          BadRequestError,
          { id: "services.storage.invalid_search_query" },
        );
      });

      it("should throw if any script keyword is found in the query (even deeply nested)", () => {
        searchBody = {
          query: {
            bool: {
              filter: [
                {
                  script: {
                    script: {
                      inline:
                        "doc[message.keyword].value.length() > params.length",
                      params: {
                        length: 25,
                      },
                    },
                  },
                },
              ],
            },
          },
        };

        should(() => publicES.client._sanitizeSearchBody(searchBody)).throw(
          BadRequestError,
          { id: "services.storage.invalid_query_keyword" },
        );
      });

      it("should turn empty queries into match_all queries", () => {
        searchBody = {
          query: {},
        };

        const result = publicES.client._sanitizeSearchBody(searchBody);

        should(result).be.deepEqual({ query: { match_all: {} } });
      });
    });

    describe("#_scriptCheck", () => {
      it("should allows stored-scripts", () => {
        const searchParams = {
          query: {
            match: {
              script: {
                id: "count-documents",
                params: {
                  length: 25,
                },
              },
            },
          },
        };

        should(() => publicES.client._scriptCheck(searchParams)).not.throw();
      });

      it("should not throw when there is not a single script", () => {
        const searchParams = { foo: "bar" };

        should(() => publicES.client._scriptCheck(searchParams)).not.throw();
      });

      it("should throw if any script is found in the query", () => {
        let searchParams = {
          query: {
            match: {
              script: {
                inline: "doc[message.keyword].value.length() > params.length",
                params: {
                  length: 25,
                },
              },
            },
          },
        };

        should(() => publicES.client._sanitizeSearchBody(searchParams)).throw(
          BadRequestError,
          { id: "services.storage.invalid_query_keyword" },
        );

        searchParams = {
          query: {
            match: {
              script: {
                source: "doc[message.keyword].value.length() > params.length",
                params: {
                  length: 25,
                },
              },
            },
          },
        };

        should(() => publicES.client._sanitizeSearchBody(searchParams)).throw(
          BadRequestError,
          { id: "services.storage.invalid_query_keyword" },
        );
      });

      it("should throw if any deeply nested script keyword is found in the query", () => {
        const searchParams = {
          query: {
            bool: {
              filter: [
                {
                  script: {
                    script: {
                      inline:
                        "doc[message.keyword].value.length() > params.length",
                      params: {
                        length: 25,
                      },
                    },
                  },
                },
              ],
            },
          },
        };

        should(() => publicES.client._sanitizeSearchBody(searchParams)).throw(
          BadRequestError,
          { id: "services.storage.invalid_query_keyword" },
        );
      });
    });
  });
});
