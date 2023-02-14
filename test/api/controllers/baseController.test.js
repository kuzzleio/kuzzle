"use strict";

const should = require("should");
const sinon = require("sinon");

const { BadRequestError } = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const {
  NativeController,
} = require("../../../lib/api/controllers/baseController");

describe("#base/native controller", () => {
  let kuzzle;
  let actions;
  let nativeController;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    actions = ["speak", "fight"];

    request = {
      input: {},
    };

    nativeController = new NativeController(actions);
  });

  it("should initialize its actions list from the constructor", () => {
    nativeController.privateAction = () => {};

    should(nativeController._isAction("speak")).be.true();
    should(nativeController._isAction("fight")).be.true();
    should(nativeController._isAction("privateAction")).be.false();
  });

  describe("translateKoncorde", () => {
    let koncordeFilters;

    beforeEach(() => {
      koncordeFilters = {
        equals: { name: "Melis" },
      };

      kuzzle.ask.withArgs("core:storage:public:translate").resolves({
        term: { name: "Melis" },
      });
    });

    it("should translate the filter before passing it to the storage engine", async () => {
      const esQuery = await nativeController.translateKoncorde(koncordeFilters);

      should(kuzzle.ask).be.calledWith("core:storage:public:translate", {
        equals: { name: "Melis" },
      });

      should(esQuery).be.eql({ term: { name: "Melis" } });
    });

    it("should reject if the query is not an object", () => {
      koncordeFilters = "not an object";

      return should(
        nativeController.translateKoncorde(koncordeFilters)
      ).rejectedWith(BadRequestError, { id: "api.assert.invalid_type" });
    });

    it("should reject when translation fail", () => {
      const error = new Error("message");
      error.keyword = { type: "operator", name: "n0t" };

      kuzzle.ask.withArgs("core:storage:public:translate").rejects(error);

      return should(
        nativeController.translateKoncorde(koncordeFilters)
      ).rejectedWith(BadRequestError, {
        id: "api.assert.koncorde_restricted_keyword",
      });
    });

    it("should return an empty object if the filters are empty", async () => {
      const esQuery = await nativeController.translateKoncorde({});

      should(kuzzle.ask).not.be.called();

      should(esQuery).be.eql({});
    });
  });

  describe("#assertTargetsAreValid", () => {
    it("should reject if a target index is missing", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([{ collections: "foo" }]);
        })()
      ).rejectedWith(BadRequestError, { id: "api.assert.missing_argument" });
    });

    it("should reject if target collections are missing", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([{ index: "index" }]);
        })()
      ).rejectedWith(BadRequestError, { id: "api.assert.missing_argument" });
    });

    it("should reject if target collections are empty", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([
            { index: "index", collections: [] },
          ]);
        })()
      ).rejectedWith(BadRequestError, { id: "api.assert.empty_argument" });
    });

    it("should not reject if target collections are empty and empty collections are allowed", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid(
            [{ index: "index", collections: [] }],
            { emptyCollectionsAllowed: true }
          );
        })()
      ).not.be.rejectedWith(BadRequestError, {
        id: "api.assert.empty_argument",
      });
    });

    it("should not reject if target collections are missing and empty collections are allowed", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([{ index: "index" }], {
            emptyCollectionsAllowed: true,
          });
        })()
      ).not.be.rejectedWith(BadRequestError, {
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if target field collections is not an array", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([
            { index: "index", collections: "" },
          ]);
        })()
      ).rejectedWith(BadRequestError, { id: "api.assert.invalid_type" });
    });

    it("should reject if one of the collections is not a string", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([
            { index: "index", collections: [42] },
          ]);
        })()
      ).rejectedWith(BadRequestError, { id: "api.assert.invalid_type" });
    });

    it("should reject if one of a collection has multi targets characters", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([
            { index: "index", collections: ["a,b"] },
          ]);
        })()
      ).rejectedWith({ id: "services.storage.invalid_target_format" });
    });

    it("should reject if the index has multi targets characters", () => {
      should(
        (async () => {
          nativeController.assertTargetsAreValid([
            { index: "index,bar", collections: ["foo"] },
          ]);
        })()
      ).rejectedWith({ id: "services.storage.invalid_target_format" });
    });
  });

  describe("#assertBodyHasNotAttributes", () => {
    beforeEach(() => {
      request.input.body = {
        invalid: "42",
      };
    });

    it("should throw", () => {
      should(() => {
        nativeController.assertBodyHasNotAttributes(request, ["invalid"]);
      }).throw({ id: "api.assert.forbidden_argument" });
    });
  });

  describe("#assertIsStrategyRegistered", () => {
    it("should throw", () => {
      kuzzle.pluginsManager.listStrategies = sinon
        .stub()
        .returns(["local", "oauth"]);

      should(() => {
        nativeController.assertIsStrategyRegistered("glob");
      }).throw({ id: "security.credentials.unknown_strategy" });
    });
  });

  describe("#assertNotExceedMaxFetch", () => {
    it("should throw", () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => {
        nativeController.assertNotExceedMaxFetch(3);
      }).throw({ id: "services.storage.get_limit_exceeded" });
    });
  });
});
