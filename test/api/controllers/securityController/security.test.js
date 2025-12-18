"use strict";

const rewire = require("rewire");
const sinon = require("sinon");
const should = require("should");

const KuzzleMock = require("../../../mocks/kuzzle.mock");
const {
  NativeController,
} = require("../../../../lib/api/controllers/baseController");
const SecurityController = rewire(
  "../../../../lib/api/controllers/securityController",
);
const {
  Request,
  BadRequestError,
  PartialError,
  SizeLimitError,
} = require("../../../../index");
const kerror = require("../../../../lib/kerror");

describe("/api/controllers/securityController", () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    sinon.spy(kerror, "get");
    securityController = new SecurityController.default();
    request = new Request({ controller: "security" });
  });

  afterEach(() => {
    kerror.get.restore();
  });

  describe("#constructor", () => {
    it("should inherit the base constructor", () => {
      should(new SecurityController.default()).instanceOf(NativeController);
    });
  });

  describe("#refresh", () => {
    it("should refresh the allowed collections", async () => {
      for (const collection of ["users", "roles", "profiles"]) {
        request.input.args.collection = collection;

        const response = await securityController.refresh(request);

        should(response).be.null();
        should(kuzzle.ask).calledWith(
          "core:storage:private:collection:refresh",
          kuzzle.internalIndex.index,
          collection,
        );
      }
    });

    it("should raise an error with unknown collection", async () => {
      request.input.args.collection = "frontend-security";

      await should(securityController.refresh(request)).rejectedWith({
        id: "api.assert.unexpected_argument",
      });

      should(
        kuzzle.ask.withArgs("core:storage:private:collection:refresh"),
      ).not.be.called();
    });
  });

  describe("#mDelete", () => {
    let deleteStub;

    beforeEach(() => {
      deleteStub = kuzzle.ask
        .withArgs(sinon.match.string, sinon.match.string, sinon.match.object)
        .resolves();
      request.input.body = { ids: ["foo", "bar", "baz"] };
    });

    it("should reject if the request has no body", () => {
      request.input.body = null;

      return should(securityController._mDelete("type", request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.body_required" },
      );
    });

    it("should fail if the request has no ids to delete", () => {
      request.input.body = {};

      return should(securityController._mDelete("type", request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.missing_argument" },
      );
    });

    it("should fail if ids is not an array", () => {
      request.input.body = { ids: {} };

      return should(securityController._mDelete("type", request)).rejectedWith(
        BadRequestError,
        { id: "api.assert.invalid_type" },
      );
    });

    it("should throw an error if the number of documents to get exceeds server configuration", () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      return should(securityController._mDelete("type", request)).rejectedWith(
        SizeLimitError,
        {
          id: "services.storage.write_limit_exceeded",
        },
      );
    });

    it("should return the input ids if everything went fine", async () => {
      for (const type of ["role", "profile", "user"]) {
        let ids = await securityController._mDelete(type, request);

        should(ids).match(request.input.body.ids);

        for (const id of ids) {
          should(deleteStub).calledWithMatch(
            `core:security:${type}:delete`,
            id,
            { refresh: "wait_for" },
          );
        }
      }
    });

    it("should handle request options", async () => {
      request.input.args.refresh = false;

      for (const type of ["role", "profile", "user"]) {
        let ids = await securityController._mDelete(type, request);

        should(ids).match(request.input.body.ids);

        for (const id of ids) {
          should(deleteStub).calledWithMatch(
            `core:security:${type}:delete`,
            id,
            { refresh: "false" },
          );
        }
      }
    });

    it("should set a partial error if something went wrong", async () => {
      const error = new Error("test");

      // Overwrite the kuzzle.ask stub with generic matchers.
      // We need to reject on only 1 argument to test partial errors, and there
      // is a bug with sinon.withArgs and generic matchers, that forces us to
      // detail every parameter sequences we need to stub:
      // https://github.com/sinonjs/sinon/issues/1572
      securityController.ask = sinon.stub();

      securityController.ask
        .withArgs("core:security:profile:delete", "foo", sinon.match.object)
        .resolves();
      securityController.ask
        .withArgs("core:security:profile:delete", "bar", sinon.match.object)
        .rejects(error);
      securityController.ask
        .withArgs("core:security:profile:delete", "baz", sinon.match.object)
        .resolves();

      const ids = await securityController._mDelete("profile", request);

      should(ids).match(["foo", "baz"]);
      should(request.error).be.an.instanceOf(PartialError);
      should(request.error.id).eql("services.storage.incomplete_delete");
      should(request.error.errors).be.an.Array().and.have.length(1);
      should(request.error.errors[0]).eql(error);
    });
  });
});
