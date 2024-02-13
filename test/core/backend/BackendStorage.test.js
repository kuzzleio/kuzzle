"use strict";

const should = require("should");
const mockrequire = require("mock-require");

const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("Backend", () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire("../../../lib/kuzzle", KuzzleMock);

    ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));

    application = new Backend("black-mesa");
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe("StorageManager#StorageClient", () => {
    it("should allows to construct an ES StorageClient", async () => {
      await application.start();
      global.kuzzle.config.services.storageEngine.client.node =
        "http://es:9200";
      should(application.storage.StorageClient).be.a.Function();

      const client = new application.storage.StorageClient({ maxRetries: 42 });
      should(client.connectionPool.connections[0].url.toString()).be.eql(
        "http://es:9200/",
      );
      should(
        client.helpers[
          Object.getOwnPropertySymbols(client.helpers).find(
            (s) => s.description === "max retries",
          )
        ],
      ).be.eql(42);
    });
  });

  describe("StorageManager#storageClient", () => {
    it("should allows lazily access an ES Client", async () => {
      await application.start();

      global.kuzzle.config.services.storageEngine.client.node =
        "http://es:9200";
      should(application.storage._client).be.null();

      should(
        application.storage.storageClient.connectionPool.connections[0].url.toString(),
      ).be.eql("http://es:9200/");
    });
  });
});
