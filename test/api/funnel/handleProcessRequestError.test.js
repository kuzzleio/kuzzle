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
      })
    );

    const res = funnel.handleProcessRequestError(
      request,
      request,
      originalError
    );

    return should(res).rejectedWith(PluginImplementationError, {
      id: "plugin.runtime.unexpected_error",
    });
  });
});
