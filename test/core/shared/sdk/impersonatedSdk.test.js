"use strict";

const should = require("should");
const sinon = require("sinon");
const mockrequire = require("mock-require");
const rewire = require("rewire");

describe("ImpersonatedSDK", () => {
  let ImpersonatedSdk;
  let impersonatedSdk;
  const impersonatedUserId = "alyx";

  const fakeNativeControllers = {
    DocumentController: sinon.stub().resolves(),
    MemoryStorageController: sinon.stub().resolves(),
  };

  const fakeInjectedSdk = {
    document: sinon.spy,
    ms: sinon.spy,
    query: sinon.stub().resolves(),
  };

  beforeEach(() => {
    mockrequire("../../../../lib/api/controllers", {
      ...fakeNativeControllers,
    });

    mockrequire.reRequire("../../../../lib/core/shared/sdk/impersonatedSdk");
    ImpersonatedSdk = rewire("../../../../lib/core/shared/sdk/impersonatedSdk");
    ImpersonatedSdk.__set__({
      global: {
        app: {
          sdk: fakeInjectedSdk,
        },
      },
    });

    impersonatedSdk = new ImpersonatedSdk(impersonatedUserId);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe("#constructor", () => {
    it("should correctly wrap native controllers", () => {
      mockrequire("../../../../lib/api/controllers", {
        ...fakeNativeControllers,
      });

      mockrequire.reRequire("../../../../lib/core/shared/sdk/impersonatedSdk");

      impersonatedSdk = new ImpersonatedSdk(impersonatedUserId);

      should(impersonatedSdk.kuid).be.eql(impersonatedUserId);
      should(impersonatedSdk).have.ownProperty("document");
      should(impersonatedSdk).have.ownProperty("ms");
    });

    it("should only wrap supported sdk actions", () => {
      mockrequire("../../../../lib/api/controllers", {
        ...fakeNativeControllers,
        BadController: sinon.spy(),
      });

      mockrequire.reRequire("../../../../lib/core/shared/sdk/impersonatedSdk");
      ImpersonatedSdk = rewire(
        "../../../../lib/core/shared/sdk/impersonatedSdk",
      );

      impersonatedSdk = new ImpersonatedSdk(impersonatedUserId);
      should(impersonatedSdk).have.ownProperty("document");
      should(impersonatedSdk).not.have.ownProperty("bad");
    });
  });

  describe("#query", () => {
    it("should call the global sdk and add a __kuid__ to the request", async () => {
      const fakeRequest = { controller: "document", action: "create" };

      await impersonatedSdk.query(fakeRequest);

      should(fakeInjectedSdk.query).be.calledWith({
        ...fakeRequest,
        __kuid__: impersonatedUserId,
        __checkRights__: false,
      });
    });

    it("should call the global sdk and add __kuid__ and __checkRights__ to the request", async () => {
      const fakeRequest = { controller: "document", action: "create" };

      impersonatedSdk = new ImpersonatedSdk(impersonatedUserId, {
        checkRights: true,
      });
      await impersonatedSdk.query(fakeRequest);

      should(fakeInjectedSdk.query).be.calledWith({
        ...fakeRequest,
        __kuid__: impersonatedUserId,
        __checkRights__: true,
      });
    });
  });
});
