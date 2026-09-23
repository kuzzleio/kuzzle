"use strict";

const should = require("should");
const sinon = require("sinon");
const mockRequire = require("mock-require");

const { BadRequestError, PreconditionError } = require("../../../index");
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

    it("should answer an empty result without calling ES on an empty id list", async () => {
      const result = await elasticsearch.client.mGet(index, collection, []);

      should(result).eql({ errors: [], items: [] });
      should(elasticsearch.client._client.mget).not.be.called();
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

    it("should answer an empty result without calling ES on an empty id list", async () => {
      const result = await elasticsearch.client.mExists(index, collection, []);

      should(result).eql({ errors: [], items: [] });
      should(elasticsearch.client._client.mget).not.be.called();
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

    it("should skip an answer row that carries no action", () => {
      elasticsearch.client._client.bulk.resolves({
        errors: false,
        items: [{}, { index: { status: 201, _id: 1 } }],
      });

      return elasticsearch.client
        .import(index, collection, documents)
        .then((result) => {
          should(result).match({
            errors: [],
            items: [{ index: { status: 201, _id: 1 } }],
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

    it("should reject a document the mget answer is too short to cover", () => {
      // An answer shorter than the request used to reach `"error" in doc` on
      // an undefined entry, which throws.
      elasticsearch.client._client.mget.resolves({
        docs: [{ _id: "mehry", found: true }],
      });

      return elasticsearch.client
        .mReplace(index, collection, documents)
        .then(() => {
          should(elasticsearch.client._mExecute).be.calledWithMatch(
            {
              operations: [
                { index: { _id: "mehry", _index: alias } },
                { city: "Kathmandu", ...kuzzleMeta },
              ],
            },
            [{ _id: "mehry", _source: { city: "Kathmandu", ...kuzzleMeta } }],
            [
              {
                document: {
                  _id: "liia",
                  body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
                },
                reason: "document not found",
                status: 404,
              },
            ],
          );
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
