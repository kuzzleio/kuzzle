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

  // TD-27 (#2703): `_wrapError` sits downstream of the error pipes, so what
  // reaches it comes from plugin code whatever the request's controller is.
  // A controller's own error is normalized upstream, by `_wrapControllerError`.
  it("wraps a pipe error as a plugin error even on a native controller", () => {
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
    ).rejectedWith(PluginImplementationError, {
      id: "plugin.runtime.unexpected_error",
    });
  });

  it("leaves a KuzzleError raised by a pipe alone", () => {
    const originalError = new BadRequestError("original error"),
      pipeError = new BadRequestError("raised by the pipe"),
      request = new Request({ controller: "document", action: "fail" });

    funnel.controllers.set("document", {});

    kuzzle.pipe.onFirstCall().rejects(originalError);
    kuzzle.pipe.onSecondCall().callsFake(() =>
      Promise.resolve().then(() => {
        throw pipeError;
      }),
    );

    return should(
      funnel.handleProcessRequestError(request, request, originalError),
    ).rejectedWith(BadRequestError, { message: "raised by the pipe" });
  });
});
