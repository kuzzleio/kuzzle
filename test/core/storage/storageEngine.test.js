"use strict";

const should = require("should");
const mockRequire = require("mock-require");

const { PreconditionError } = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const ClientAdapterMock = require("../../mocks/clientAdapter.mock");

const { storeScopeEnum } = require("../../../lib/core/storage/storeScopeEnum");

describe("#core/storage/StorageEngine", () => {
  let StorageEngine;
  let storageEngine;

  before(() => {
    mockRequire("../../../lib/core/storage/clientAdapter", ClientAdapterMock);
    StorageEngine = mockRequire.reRequire(
      "../../../lib/core/storage/storageEngine",
    );
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    new KuzzleMock();

    storageEngine = new StorageEngine();
  });

  describe("#constructor", () => {
    it("should instantiate a client adapter per storage scope", () => {
      should(storageEngine.public).instanceOf(ClientAdapterMock);
      should(storageEngine.public.scope).eql(storeScopeEnum.PUBLIC);

      should(storageEngine.private).instanceOf(ClientAdapterMock);
      should(storageEngine.private.scope).eql(storeScopeEnum.PRIVATE);
    });
  });

  describe("#init", () => {
    it("should throw if a private index and a public one share the same name", async () => {
      storageEngine.public.cache.listIndexes.resolves(["foo", "bar", "ohnoes"]);
      storageEngine.private.cache.listIndexes.resolves([
        "baz",
        "ohnoes",
        "qux",
      ]);

      should(storageEngine.init()).rejectedWith(PreconditionError, {
        id: "services.storage.index_already_exists",
      });
      should(storageEngine.public.init).calledOnce();
      should(storageEngine.private.init).calledOnce();
    });
  });
});
