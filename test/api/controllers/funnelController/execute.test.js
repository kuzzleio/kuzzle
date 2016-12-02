var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  Kuzzle = require('../../../../lib/api/kuzzle'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.execute', () => {
  var
    kuzzle,
    funnel,
    processRequestCalled,
    requestObject,
    userContext,
    requestReplayed;

  before(() => {
    userContext = {
      connection: {id: 'connectionid'},
      token: null
    };

    kuzzle = new Kuzzle();
    kuzzle.config.server.warnRetainedRequestsLimit = -1;

    FunnelController.__set__('processRequest', (funnelKuzzle, controllers, funnelRequest) => {
      processRequestCalled = true;

      if (funnelRequest.errorMe) {
        return Promise.reject(new Error('errored on purpose'));
      }

      // TODO something about it
      return Promise.resolve({
        responseObject: funnelRequest,
        userContext: userContext
      });
    });

    FunnelController.__set__('playCachedRequests', () => {
      requestReplayed = true;
    });
  });

  beforeEach(() => {
    processRequestCalled = false;
    requestReplayed = false;

    requestObject = new Request({
      controller: 'foo',
      action: 'bar'
    });

    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        funnel = new FunnelController(kuzzle);
        funnel.init();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#normal state', () => {
    it('should execute the request immediately if not overloaded', done => {
      funnel.execute(requestObject, userContext, (err, res) => {
        try {
          should(err).be.null();
          should(res.status).be.exactly(200);
          should(res).be.instanceOf(ResponseObject);
          should(processRequestCalled).be.true();
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('should forward any error occuring during the request execution', done => {
      requestObject.errorMe = true;

      funnel.execute(requestObject, userContext, (err, res) => {
        try {
          should(err).be.instanceOf(Error);
          should(res.status).be.exactly(500);
          should(res.error.message).be.exactly('errored on purpose');
          should(processRequestCalled).be.true();
          should(funnel.overloaded).be.false();
          should(requestReplayed).be.false();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  describe('#server:overload hook', () => {
    it('should fire the hook the first time Kuzzle is in overloaded state', /** @this {Mocha} */ function (done) {
      this.timeout(500);

      kuzzle.once('server:overload', () => {
        done();
      });

      funnel.overloaded = true;
      funnel.execute(requestObject, userContext, () => {
      });
    });

    it('should fire the hook if the last one was fired more than 500ms ago', /** @this {Mocha} */ function (done) {
      this.timeout(500);

      kuzzle.once('server:overload', () => {
        done();
      });

      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;
      funnel.execute(requestObject, userContext, () => {});
    });

    it('should not fire the hook if one was fired less than 500ms ago', done => {
      var listener = () => {
        done(new Error('server:overload hook fired unexpectedly'));
      };

      kuzzle.once('server:overload', listener);

      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 200;
      funnel.execute(requestObject, userContext, () => {});
      setTimeout(() => {
        kuzzle.off('server:overload', listener);
        done();
      }, 200);
    });
  });

  describe('#overloaded state', () => {
    it('should enter overloaded state if the maxConcurrentRequests property is reached', done => {
      var callback = () => {
        done(new Error('Request executed. It should have been queued instead'));
      };

      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;

      funnel.execute(requestObject, userContext, callback);

      setTimeout(() => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.true();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(1);
        should(funnel.requestsCache[0]).match({requestObject, userContext, callback});
        done();
      }, 100);
    });

    it('should not relaunch the request replayer background task if already in overloaded state', done => {
      var callback = () => {
        done(new Error('Request executed. It should have been queued instead'));
      };

      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;
      funnel.overloaded = true;

      funnel.execute(requestObject, userContext, callback);

      setTimeout(() => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.false();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(1);
        should(funnel.requestsCache[0]).match({requestObject, userContext, callback});
        done();
      }, 100);
    });

    it('should discard the request if the maxRetainedRequests property is reached', /** @this {Mocha} */ function (done) {
      this.timeout(500);

      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;
      funnel.cachedRequests = kuzzle.config.server.maxRetainedRequests;
      funnel.overloaded = true;

      funnel.execute(requestObject, userContext, (err, res) => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.false();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(kuzzle.config.server.maxRetainedRequests);
        should(funnel.requestsCache).be.empty();
        should(err).be.instanceOf(ServiceUnavailableError);
        should(err.status).be.eql(503);
        should(res).be.instanceOf(ResponseObject);
        should(res.status).be.eql(503);
        done();
      });
    });
  });
});

