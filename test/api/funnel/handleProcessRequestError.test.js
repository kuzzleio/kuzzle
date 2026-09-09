"use strict";

const should = require("should");

const FunnelController = require("../../../lib/api/funnel");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const {
  Request,
  BadRequestError,
  PluginImplementationError,
} = require("../../../index");

describe("funnel.processRequest", () => {
  let kuzzle, funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController();
  });

  it("allows plugin developer to set a new error on request:onError event", (done) => {
    const originalError = new BadRequestError("original error"),
      customError = new BadRequestError("custom error"),
      request = new Request({
        controller: "fakePlugin/controller",
        action: "fail",
      });

    kuzzle.pipe.onFirstCall().rejects(originalError);
    kuzzle.pipe.onSecondCall().callsFake((_, req) => {
      req.setError(customError);

      return Promise.resolve(req);
    });

    funnel
      .handleProcessRequestError(request, request, originalError)
      .then(() => done(new Error("Expected test to fail")))
      .catch((e) => {
        try {
          should(e).be.instanceOf(BadRequestError);
          should(e.message).be.eql("custom error");
          done();
        } catch (err) {
          done(err);
        }
      });
  });

  it("wraps plugin developer error in a PluginImplementationError", () => {
    const originalError = new BadRequestError("original error"),
      customError = new Error("custom error"),
      request = new Request({
        controller: "fakePlugin/controller",
        action: "fail",
      });

    kuzzle.pipe.onFirstCall().rejects(originalError);
    kuzzle.pipe.onSecondCall().callsFake(() =>
      Promise.resolve().then(() => {
        throw customError;
      }),
    );

    const res = funnel.handleProcessRequestError(
      request,
      request,
      originalError,
    );

    return should(res).rejectedWith(PluginImplementationError, {
      id: "plugin.runtime.unexpected_error",
    });
  });

  // TD-21 (#2687): `_wrapError` guards on the controller name. It used to be
  // handed the whole request, so the guard was always false and a native
  // controller's internal error reached the client as a plugin error.
  it("leaves a native controller error unwrapped", () => {
    const originalError = new BadRequestError("original error"),
      internalError = new TypeError("cannot read properties of undefined"),
      request = new Request({ controller: "document", action: "fail" });

    funnel.controllers.set("document", {});

    kuzzle.pipe.onFirstCall().rejects(originalError);
    kuzzle.pipe.onSecondCall().callsFake(() =>
      Promise.resolve().then(() => {
        throw internalError;
      }),
    );

    return should(
      funnel.handleProcessRequestError(request, request, originalError),
    ).rejectedWith(TypeError, {
      message: "cannot read properties of undefined",
    });
  });
});
