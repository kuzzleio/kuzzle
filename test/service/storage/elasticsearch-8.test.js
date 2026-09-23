"use strict";

const should = require("should");
const sinon = require("sinon");
const mockRequire = require("mock-require");

const { BadRequestError } = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const ESClientMock = require("../../mocks/service/elasticsearchClient.mock");

const { storeScopeEnum } = require("../../../lib/core/storage/storeScopeEnum");
const { Mutex } = require("../../../lib/util/mutex");

describe("Test: ElasticSearch service", () => {
  let kuzzle;
  let index;
  let collection;
  let alias;
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
