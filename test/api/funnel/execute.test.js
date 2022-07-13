"use strict";

const should = require("should");
const sinon = require("sinon");
const rewire = require("rewire");

const {
  Request,
  BadRequestError,
  ServiceUnavailableError,
  TooManyRequestsError,
} = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");

const FunnelController = rewire("../../../lib/api/funnel");
const kuzzleStateEnum = require("../../../lib/kuzzle/kuzzleStateEnum");
const { UnauthorizedError } = require("../../../lib/kerror/errors");

describe("funnelController.execute", () => {
  let now = Date.now();
  let clock;
  let kuzzle;
  let funnel;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.config.limits.requestsBufferWarningThreshold = -1;
    kuzzle.ask
      .withArgs("core:security:user:anonymous:get")
      .resolves({ _id: "-1" });

    request = new Request(
      {
        controller: "foo",
        action: "bar",
      },
      {
        connection: { id: "connectionid" },
        token: null,
      }
    );

    funnel = new FunnelController();
    funnel.controllers = new Map([["foo", { bar: sinon.spy() }]]);

    funnel.checkRights = sinon.stub().resolves(request);
    funnel.processRequest = sinon.stub().returnsArg(0);
    sinon.stub(funnel.rateLimiter, "isAllowed").resolves(true);
    sinon.stub(funnel, "_playPendingRequests");
  });

  afterEach(() => {
    if (clock) {
      clock.restore();
    }
  });

  describe("#normal state", () => {
    it("should execute the request immediately if not overloaded", (done) => {
      funnel.execute(request, (err, res) => {
        try {
          should(err).be.null();
          // 102 is the default status of a request, it should be 200 when
          // coming out from the execute
          should(res.status).be.exactly(102);
          should(res).be.instanceOf(Request);
          should(funnel.processRequest).be.calledOnce();
          should(funnel.processRequest.calledOnce).be.true();
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should forward any error occurring during the request execution", (done) => {
      const error = new ServiceUnavailableError("test");
      funnel.checkRights.rejects(error);

      funnel.execute(request, (err, res) => {
        try {
          should(err).be.instanceOf(Error);
          should(res.status).be.exactly(503);
          should(res.error.message).be.exactly("test");
          should(funnel.processRequest.calledOnce).be.false();
          should(funnel.overloaded).be.false();
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should immediately reject requests without a controller", (done) => {
      request = new Request(
        { action: "bar" },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );

      funnel.execute(request, (err, res) => {
        try {
          should(err).be.instanceOf(BadRequestError);
          should(err.id).eql("api.assert.missing_argument");
          should(err.message).eql('Missing argument "controller".');
          should(res).eql(request);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should immediately reject requests without an action", (done) => {
      request = new Request(
        { controller: "foo" },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );

      funnel.execute(request, (err, res) => {
        try {
          should(err).be.instanceOf(BadRequestError);
          should(err.id).eql("api.assert.missing_argument");
          should(err.message).eql('Missing argument "action".');
          should(res).eql(request);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should immediately reject requests with index, collection and targets", (done) => {
      request = new Request(
        {
          controller: "foo",
          action: "bar",
          index: "index",
          collection: "collection",
          targets: [{ index: "index", collections: ["collection"] }],
        },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );

      funnel.execute(request, (err, res) => {
        try {
          should(err).be.instanceOf(BadRequestError);
          should(err.id).eql("api.assert.mutually_exclusive");
          should(res).eql(request);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should immediately reject requests with an unauthorized origin", (done) => {
      request = new Request(
        { controller: "foo", action: "bar" },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );
      request.input.headers = {
        origin: "foobar",
      };

      funnel._isOriginAuthorized = sinon.stub().returns(false);

      funnel.execute(request, (err, res) => {
        try {
          should(funnel._isOriginAuthorized).be.calledWith("foobar");
          should(err).be.instanceOf(UnauthorizedError);
          should(err.id).eql("api.process.unauthorized_origin");
          should(err.message).eql('The origin "foobar" is not authorized.');
          should(res).eql(request);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should not reject requests with an authorized origin", (done) => {
      request = new Request(
        { controller: "foo", action: "bar" },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );
      request.input.headers = {
        origin: "foo",
      };

      funnel._isOriginAuthorized = sinon.stub().returns(true);

      funnel.execute(request, (err) => {
        try {
          should(funnel._isOriginAuthorized).be.calledWith("foo");
          should(err).be.null();
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should not reject requests with a missing origin", (done) => {
      kuzzle.config.http = {
        accessControlAllowOrigin: ["foo"],
      };

      request = new Request(
        { controller: "foo", action: "bar" },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );
      request.input.headers = {};

      funnel.execute(request, (err) => {
        try {
          should(err).be.null();
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should reject requests exceeding the rate limit", (done) => {
      funnel.rateLimiter.isAllowed.resolves(false);

      funnel.execute(request, (err, res) => {
        try {
          should(res).eql(request);
          should(err).be.instanceOf(TooManyRequestsError);
          should(err.id).eql("api.process.too_many_requests");
          should(funnel.processRequest).not.called();
          should(funnel.overloaded).be.false();
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should reject limit of requests per second has been exceeded for this user.", (done) => {
      funnel.rateLimiter.isAllowed.resolves(false);

      request = new Request(
        {
          controller: "auth",
          action: "login",
        },
        {
          connection: { id: "connectionid" },
          token: null,
        }
      );
      funnel.execute(request, (err, res) => {
        try {
          should(res).eql(request);
          should(err).be.instanceOf(TooManyRequestsError);
          should(err.id).eql("api.process.too_many_logins_requests");
          should(funnel.processRequest).not.called();
          should(funnel.overloaded).be.false();
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("should run the request in asyncStore.run context and set the request in async storage", (done) => {
      funnel.execute(request, (err, res) => {
        try {
          should(err).be.null();
          should(res).be.instanceOf(Request);
          should(kuzzle.asyncStore.run).be.calledOnce();
          should(kuzzle.pipe).be.calledWithMatch(
            "request:beforeExecution",
            request
          );
          should(kuzzle.asyncStore.set).be.calledWith("REQUEST", request);

          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  describe("#core:overload hook", () => {
    it("should fire the hook the first time Kuzzle is in overloaded state", () => {
      funnel.overloaded = true;
      funnel.pendingRequestsQueue = Array(
        kuzzle.config.limits.requestsBufferWarningThreshold + 1
      );

      funnel.execute(request, () => {});

      should(kuzzle.emit).be.calledOnce().be.calledWith("core:overload");
    });

    it("should fire the hook if the last one was fired more than 500ms ago", () => {
      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;
      funnel.execute(request, () => {});

      should(kuzzle.emit).be.calledOnce().be.calledWith("core:overload");
    });

    it("should not fire the hook if one was fired less than 500ms ago", () => {
      clock = sinon.useFakeTimers(now);

      funnel.overloaded = true;
      funnel.lastWarningTime = now;

      setTimeout(() => funnel.execute(request, () => {}), 499);
      clock.tick(510);

      should(kuzzle.emit).have.callCount(0);
    });
  });

  describe("#overloaded state", () => {
    it("should enter overloaded state if the concurrentRequests property is reached", () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest).not.be.called();
      should(funnel.pendingRequestsQueue.length).be.eql(1);
      should(funnel.pendingRequestsQueue.shift()).eql(request.internalId);
      should(funnel.pendingRequestsById.get(request.internalId)).be.instanceOf(
        FunnelController.__get__("PendingRequest")
      );
      should(funnel.pendingRequestsById.get(request.internalId).request).be.eql(
        request
      );
      should(funnel._playPendingRequests).be.calledOnce();
    });

    it("should not execute a cached request", () => {
      const callback = sinon.spy();

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;

      funnel.execute(request, callback);

      should(callback).have.callCount(0);

      should(funnel.processRequest).have.callCount(0);
    });

    it("should not relaunch the request replayer background task if already in overloaded state", () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.overloaded = true;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest).not.be.called();
      should(funnel.pendingRequestsQueue.length).be.eql(1);
      should(funnel.pendingRequestsQueue.shift()).be.eql(request.internalId);
      should(funnel.pendingRequestsById.get(request.internalId)).have.property(
        "request",
        request
      );
      should(funnel.pendingRequestsById.get(request.internalId)).have.property(
        "fn"
      );
      should(
        funnel.pendingRequestsById.get(request.internalId).fn
      ).is.not.null();
      should(funnel.pendingRequestsById.get(request.internalId)).have.property(
        "context"
      );
      should(
        funnel.pendingRequestsById.get(request.internalId).contex
      ).is.not.null();
      should(funnel._playPendingRequests).have.callCount(0);
    });

    it("should not play a cached request multiple times", () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests + 1;
      funnel.overloaded = true;

      for (let i = 0; i < 5; i++) {
        funnel.execute(request, callback);
      }

      should(funnel.pendingRequestsQueue.length).eql(1);
    });

    it("should discard the request if the requestsBufferSize property is reached", (done) => {
      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.pendingRequestsQueue = Array(
        kuzzle.config.limits.requestsBufferSize
      );
      funnel.overloaded = true;

      funnel.execute(request, (err, res) => {
        should(funnel.overloaded).be.true();
        should(funnel._playPendingRequests).have.callCount(0);
        should(funnel.processRequest).not.be.called();
        should(funnel.pendingRequestsQueue.length).be.eql(
          kuzzle.config.limits.requestsBufferSize
        );
        should(err).be.instanceOf(ServiceUnavailableError);
        should(err.status).be.eql(503);
        should(res).be.instanceOf(Request);
        should(res.status).be.eql(503);
        done();
      });
    });

    it("should discard a request if the associated connection is no longer active", () => {
      const cb = sinon.stub();
      kuzzle.router.isConnectionAlive.returns(false);

      funnel.checkRights.throws(
        new Error("funnel.checkRights should not have been called")
      );

      should(funnel.execute(request, cb)).be.eql(0);
      should(funnel.checkRights).not.be.called();
      should(cb)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(BadRequestError));
      should(cb.firstCall.args[0].message).eql("Client connection dropped");
    });
  });

  describe("#playCachedRequests", () => {
    beforeEach(() => {
      funnel._playPendingRequests.restore();
    });

    it("should eventually play cached requests", (done) => {
      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.execute(request, done);

      funnel.concurrentRequests = 0;
    });

    it("should play pending requests in order", (done) => {
      const serialized = request.serialize(),
        secondRequest = new Request(
          Object.assign(serialized.data, { id: "req-2" })
        ),
        firstCallback = sinon.spy(),
        secondCallback = () => {
          should(firstCallback).be.calledOnce();
          should(funnel.overloaded).be.false();
          done();
        };

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.execute(request, firstCallback);
      funnel.execute(secondRequest, secondCallback);

      funnel.concurrentRequests = 0;
    });
  });

  describe("#kuzzle:shutdown", () => {
    it("should reject any new request after the kuzzle:shutdown event has been triggered", async () => {
      funnel.controllers.clear();
      sinon.stub(funnel.rateLimiter, "init");

      await funnel.init();

      kuzzle.state = kuzzleStateEnum.SHUTTING_DOWN;

      await new Promise((resolve, reject) => {
        funnel.execute(request, (err, res) => {
          try {
            should(err).be.instanceOf(ServiceUnavailableError);
            should(res.status).be.exactly(503);
            should(err.id).be.eql("api.process.shutting_down");
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });

  describe("#_isOriginAuthorized", () => {
    it("should be true when config.internal.allowAllOrigins is true", () => {
      kuzzle.config.internal = {
        allowAllOrigins: true,
      };

      should(funnel._isOriginAuthorized("foo")).be.true();
    });

    it("should be false when the origin is not included in config.http.accessControlAllowOrigin", () => {
      kuzzle.config.internal = {
        allowAllOrigins: false,
      };

      kuzzle.config.http.accessControlAllowOrigin = ["foo", "bar"];
      kuzzle.config.http.accessControlAllowOriginUseRegExp = false;

      should(funnel._isOriginAuthorized("foobar")).be.false();
    });

    it("should be true when the origin is included in config.http.accessControlAllowOrigin", () => {
      kuzzle.config.internal = {
        allowAllOrigins: false,
      };

      kuzzle.config.http.accessControlAllowOrigin = ["foo", "bar"];
      kuzzle.config.http.accessControlAllowOriginUseRegExp = false;

      should(funnel._isOriginAuthorized("bar")).be.true();
    });

    it("should be false when the origin does not match any regular expressions pattern in config.http.accessControlAllowOrigin", () => {
      kuzzle.config.internal = {
        allowAllOrigins: false,
      };

      kuzzle.config.http.accessControlAllowOrigin = [/bar/, /foo(bar)?/];
      kuzzle.config.http.accessControlAllowOriginUseRegExp = true;

      should(funnel._isOriginAuthorized("baz")).be.false();
    });

    it("should be true when the origin does match a regular expressions pattern in config.http.accessControlAllowOrigin", () => {
      kuzzle.config.internal = {
        allowAllOrigins: false,
      };

      kuzzle.config.http.accessControlAllowOrigin = [/bar/, /foo(bar)?/];
      kuzzle.config.http.accessControlAllowOriginUseRegExp = true;

      should(funnel._isOriginAuthorized("foobar")).be.true();
    });
  });
});
