"use strict";

const should = require("should");

const { ExternalServiceError } = require("../../../index");
const ESClientMock = require("../../mocks/service/elasticsearchClient.mock");
const KuzzleMock = require("../../mocks/kuzzle.mock");

const ESWrapper = require("../../../lib/service/storage/esWrapper");

describe("Test: ElasticSearch Wrapper", () => {
  let kuzzle;
  const client = new ESClientMock();
  const esWrapper = new ESWrapper(client);

  beforeEach(() => {
    kuzzle = new KuzzleMock();
  });

  describe("#formatESError", () => {
    it("should convert any unknown error to a ExternalServiceError instance", () => {
      const error = new Error("test");
      error.meta = {
        statusCode: 420,
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.id).be.eql("services.storage.unexpected_error");
    });

    it("should handle version conflict errors", () => {
      const error = new Error(
        '[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }',
      );
      error.meta = {
        statusCode: 409,
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.id).be.eql("services.storage.too_many_changes");
    });

    it("should handle already existing document", () => {
      const error = new Error("");
      error.meta = {
        body: {
          error: {
            reason:
              "[liia]: version conflict, document already exists (current version [1])",
          },
        },
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.match({
        id: "services.storage.document_already_exists",
      });
    });

    it("should handle document not found", () => {
      const error = new Error("test");
      error.meta = { statusCode: 404 };
      error.body = {
        _index: "&nyc-open-data.yellow-taxi",
        found: false,
        _id: "mehry",
        error: {
          reason: "foo",
          "resource.id": "bar",
        },
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.match({
        message: 'Document "mehry" not found in "nyc-open-data":"yellow-taxi".',
        id: "services.storage.not_found",
      });
    });

    it("should handle unexpected not found", () => {
      const error = new Error("test");
      error.meta = { statusCode: 404 };
      error.body = {
        found: false,
        _id: "mehry",
        error: {
          reason: "foo",
          "resource.id": "bar",
        },
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.match({
        message: "test",
        id: "services.storage.unexpected_not_found",
      });
    });

    it("should handle unknown DSL keyword", () => {
      const error = new Error("");
      error.meta = {
        body: {
          error: {
            reason: "[and] query malformed, no start_object after query name",
          },
        },
      };

      should(esWrapper.formatESError(error)).be.match({
        id: "services.storage.unknown_query_keyword",
      });

      error.meta = {
        body: { error: { reason: "no [query] registered for [equals]" } },
      };

      should(esWrapper.formatESError(error)).be.match({
        id: "services.storage.unknown_query_keyword",
      });
    });

    describe("logging in production", () => {
      let nodeEnv;

      beforeEach(() => {
        nodeEnv = global.NODE_ENV;
        global.NODE_ENV = "production";
      });

      afterEach(() => {
        global.NODE_ENV = nodeEnv;
      });

      it("should emit the source error for easier support & debugging", () => {
        kuzzle.emit.resetHistory();

        const error = new Error("test");
        error.meta = {
          statusCode: 420,
          meta: {
            request: {
              oh: "noes",
            },
          },
        };

        esWrapper.formatESError(error);

        should(kuzzle.emit).be.calledWith("services:storage:error", {
          message: `Elasticsearch Client error: ${error.message}`,
          meta: error.meta,
          stack: error.stack,
        });
      });

      it("should be able to log errors without meta", () => {
        kuzzle.emit.resetHistory();

        const error = new Error("test");

        esWrapper.formatESError(error);

        should(kuzzle.emit).be.calledWith("services:storage:error", {
          message: `Elasticsearch Client error: ${error.message}`,
          meta: null,
          stack: error.stack,
        });
      });
    });
  });
});
