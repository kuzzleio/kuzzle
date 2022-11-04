"use strict";

const should = require("should");
const mockRequire = require("mock-require");

const { PreconditionError } = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const ClientAdapterMock = require("../../mocks/clientAdapter.mock");

const { StorageEngine } = require("../../../lib/core/storage/storageEngine");
const VirtualIndexMock = require("../../mocks/virtualIndex.mock");

const { ScopeEnum } = require("../../../lib/core/storage/storeScopeEnum");

describe("#core/storage/StorageEngine", () => {
  let storageEngine;

  let initClientAdaptersSave = StorageEngine.initClientAdapters;

  afterEach(() => {
    StorageEngine.initClientAdapters = initClientAdaptersSave;
  });

  before(() => {
    StorageEngine.createVirtualIndex = function () {
      return new VirtualIndexMock();
    };
    StorageEngine.initClientAdapters = function (scopeEnumValue, virtualIndex) {
      return new ClientAdapterMock(scopeEnumValue, virtualIndex);
    };

    storageEngine = new StorageEngine();

    return storageEngine.init();
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    new KuzzleMock();

    StorageEngine.initClientAdapters = function (scopeEnumValue, virtualIndex) {
      return new ClientAdapterMock(scopeEnumValue, virtualIndex);
    };

    storageEngine = new StorageEngine(new VirtualIndexMock());
  });

  describe("#constructor", () => {
    it("should instantiate a client adapter per storage scope", () => {
      should(storageEngine.public).instanceOf(ClientAdapterMock);
      should(storageEngine.public.scope).eql(ScopeEnum.PUBLIC);

      should(storageEngine.private).instanceOf(ClientAdapterMock);
      should(storageEngine.private.scope).eql(ScopeEnum.PRIVATE);
    });
  });

  describe("#init", () => {
    it("should initialize client adapters", async () => {
      await storageEngine.init();

      should(storageEngine.public.init).calledOnce();
      should(storageEngine.private.init).calledOnce();
    });

    it("should throw if a private index and a public one share the same name", async () => {
      storageEngine.public.cache.listIndexes.returns(["foo", "bar", "ohnoes"]);
      storageEngine.private.cache.listIndexes.returns(["baz", "ohnoes", "qux"]);

      return should(storageEngine.init()).rejectedWith(PreconditionError, {
        id: "services.storage.index_already_exists",
      });
    });
  });
});
