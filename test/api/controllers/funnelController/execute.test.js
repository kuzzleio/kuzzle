'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.execute', () => {
  let
    now = Date.now(),
    clock,
    kuzzle,
    funnel,
    request,
    reset;

  beforeEach(() => {
    reset = FunnelController.__set__({
      playCachedRequests: sinon.spy()
    });

    kuzzle = new KuzzleMock();
    kuzzle.config.server.warningRetainedRequestsLimit = -1;

    request = new Request({
      controller: 'foo',
      action: 'bar'
    }, {
      connection: {id: 'connectionid'},
      token: null
    });

    funnel = new FunnelController(kuzzle);
    funnel.controllers = {
      foo: {
        bar: sinon.spy()
      }
    };
    funnel.checkRights = sinon.stub().returns(Promise.resolve());
    funnel.processRequest = sinon.stub().returnsArg(0);
  });

  afterEach(() => {
    reset();
  });

  after(() => {
    if (clock) {
      clock.restore();
    }
  });

  describe('#normal state', () => {
    it('should execute the request immediately if not overloaded', done => {
      funnel.execute(request, (err, res) => {
        try {
          should(err).be.null();
          // 102 is the default status of a request, it should be 200 when coming out from the execute
          should(res.status).be.exactly(102);
          should(res).be.instanceOf(Request);
          should(funnel.processRequest)
            .be.calledOnce();
          should(funnel.processRequest.calledOnce).be.true();
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('should forward any error occurring during the request execution', done => {
      const error = new ServiceUnavailableError('test');
      funnel.checkRights = sinon.stub().returns(Promise.reject(error));

      funnel.execute(request, (err, res) => {
        should(err).be.instanceOf(Error);
        should(res.status).be.exactly(503);
        should(res.error.message).be.exactly('test');
        should(funnel.processRequest.calledOnce).be.false();
        should(funnel.overloaded).be.false();
        should(kuzzle.pluginsManager.trigger)
          .be.calledOnce()
          .be.calledWith('log:error', error);
        done();
      });
    });

    it('should forward the error stack in case a native error was thrown', done => {
      const error = new Error('test');

      funnel.checkRights.returns(Promise.reject(error));

      funnel.execute(request, () => {
        should(kuzzle.pluginsManager.trigger)
          .be.calledOnce()
          .be.calledWith('log:error', error.stack);
        done();

      });
    });
  });

  describe('#core:overload hook', () => {
    it('should fire the hook the first time Kuzzle is in overloaded state', /** @this {Mocha} */ () => {
      funnel.overloaded = true;

      funnel.execute(request, () => {});

      should(kuzzle.pluginsManager.trigger)
        .be.calledTwice()
        .be.calledWith('core:overload');
    });

    it('should fire the hook if the last one was fired more than 500ms ago', () => {
      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;
      funnel.execute(request, () => {});

      should(kuzzle.pluginsManager.trigger)
        .be.calledTwice()
        .be.calledWith('core:overload');
    });

    it('should not fire the hook if one was fired less than 500ms ago', () => {
      clock = sinon.useFakeTimers(now);

      funnel.overloaded = true;
      funnel.lastWarningTime = now;

      setTimeout(() => funnel.execute(request, () => {}), 499);
      clock.tick(510);

      should(kuzzle.pluginsManager.trigger)
        .have.callCount(0);
    });
  });

  describe('#overloaded state', () => {
    it('should enter overloaded state if the maxConcurrentRequests property is reached', () => {
      const
        callback = () => {};

      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest.called).be.false();
      should(funnel.cachedItems).be.eql(1);
      should(funnel.requestsCache.shift()).match({request, callback});
      should(FunnelController.__get__('playCachedRequests'))
        .be.calledOnce();
    });

    it('should not relaunch the request replayer background task if already in overloaded state', () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;
      funnel.overloaded = true;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest.called).be.false();
      should(funnel.cachedItems).be.eql(1);
      should(funnel.requestsCache.shift()).match({request, callback});
      should(FunnelController.__get__('playCachedRequests'))
        .have.callCount(0);
    });

    it('should discard the request if the maxRetainedRequests property is reached', (done) => {
      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;
      funnel.cachedItems = kuzzle.config.server.maxRetainedRequests;
      funnel.overloaded = true;

      funnel.execute(request, (err, res) => {
        should(funnel.overloaded).be.true();
        should(FunnelController.__get__('playCachedRequests'))
          .have.callCount(0);
        should(funnel.processRequest.called).be.false();
        should(funnel.cachedItems).be.eql(kuzzle.config.server.maxRetainedRequests);
        should(funnel.requestsCache.isEmpty()).be.true();
        should(err).be.instanceOf(ServiceUnavailableError);
        should(err.status).be.eql(503);
        should(res).be.instanceOf(Request);
        should(res.status).be.eql(503);
        done();
      });
    });
  });
});

