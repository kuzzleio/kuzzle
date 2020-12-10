'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  {
    Request,
    errors: {
      BadRequestError,
      ServiceUnavailableError
    }
  } = require('kuzzle-common-objects'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.execute', () => {
  let
    now = Date.now(),
    clock,
    kuzzle,
    funnel,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.limits.requestsBufferWarningThreshold = -1;

    request = new Request({
      controller: 'foo',
      action: 'bar'
    }, {
      connection: {id: 'connectionid'},
      token: null
    });

    funnel = new FunnelController(kuzzle);
    funnel.controllers = new Map([
      ['foo', { bar: sinon.spy() } ]
    ]);

    funnel.checkRights = sinon.stub().returns(Bluebird.resolve(request));
    funnel.processRequest = sinon.stub().returnsArg(0);
    sinon.stub(funnel, '_playCachedRequests');
  });

  afterEach(() => {
    if (clock) {
      clock.restore();
    }
  });

  describe('#normal state', () => {
    it('should execute the request immediately if not overloaded', done => {
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

    it('should forward any error occurring during the request execution', done => {
      const error = new ServiceUnavailableError('test');
      funnel.checkRights.rejects(error);

      funnel.execute(request, (err, res) => {
        should(err).be.instanceOf(Error);
        should(res.status).be.exactly(503);
        should(res.error.message).be.exactly('test');
        should(funnel.processRequest.calledOnce).be.false();
        should(funnel.overloaded).be.false();
        done();
      });
    });
  });

  describe('#core:overload hook', () => {
    it('should fire the hook the first time Kuzzle is in overloaded state', () => {
      funnel.overloaded = true;
      funnel.requestsCacheQueue = Array(kuzzle.config.limits.requestsBufferWarningThreshold + 1);

      funnel.execute(request, () => {});

      should(kuzzle.emit)
        .be.calledOnce()
        .be.calledWith('core:overload');
    });

    it('should fire the hook if the last one was fired more than 500ms ago', () => {
      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;
      funnel.execute(request, () => {});

      should(kuzzle.emit)
        .be.calledOnce()
        .be.calledWith('core:overload');
    });

    it('should not fire the hook if one was fired less than 500ms ago', () => {
      clock = sinon.useFakeTimers(now);

      funnel.overloaded = true;
      funnel.lastWarningTime = now;

      setTimeout(() => funnel.execute(request, () => {}), 499);
      clock.tick(510);

      should(kuzzle.emit).have.callCount(0);

      clock.restore();
    });
  });

  describe('#overloaded state', () => {
    it('should enter overloaded state if the concurrentRequests property is reached', () => {
      const
        callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest).not.be.called();
      should(funnel.requestsCacheQueue.length).be.eql(1);
      should(funnel.requestsCacheQueue.shift()).eql(request.internalId);
      should(funnel.requestsCacheById[request.internalId]).eql(new (FunnelController.__get__('CacheItem'))('execute', request, callback));
      should(funnel._playCachedRequests).be.calledOnce();
    });

    it('should not execute a cached request', () => {
      const callback = sinon.spy();

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;

      funnel.execute(request, callback);

      should(callback)
        .have.callCount(0);

      should(funnel.processRequest)
        .have.callCount(0);
    });

    it('should not relaunch the request replayer background task if already in overloaded state', () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.overloaded = true;

      funnel.execute(request, callback);

      should(funnel.overloaded).be.true();
      should(funnel.processRequest).not.be.called();
      should(funnel.requestsCacheQueue.length).be.eql(1);
      should(funnel.requestsCacheQueue.shift()).be.eql(request.internalId);
      should(funnel.requestsCacheById[request.internalId]).match({request, callback});
      should(funnel._playCachedRequests).have.callCount(0);
    });

    it('should not play a cached request multiple times', () => {
      const callback = () => {};

      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests + 1;
      funnel.overloaded = true;

      for (let i = 0; i < 5; i++) {
        funnel.execute(request, callback);
      }

      should(funnel.requestsCacheQueue.length).eql(1);
    });

    it('should discard the request if the requestsBufferSize property is reached', done => {
      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.requestsCacheQueue = Array(kuzzle.config.limits.requestsBufferSize);
      funnel.overloaded = true;

      funnel.execute(request, (err, res) => {
        should(funnel.overloaded).be.true();
        should(funnel._playCachedRequests).have.callCount(0);
        should(funnel.processRequest).not.be.called();
        should(funnel.requestsCacheQueue.length).be.eql(kuzzle.config.limits.requestsBufferSize);
        should(err).be.instanceOf(ServiceUnavailableError);
        should(err.status).be.eql(503);
        should(res).be.instanceOf(Request);
        should(res.status).be.eql(503);
        done();
      });
    });

    it('should discard a request if the associated connection is no longer active', () => {
      const cb = sinon.stub();
      kuzzle.router.isConnectionAlive.returns(false);

      funnel.checkRights.throws(new Error('funnel.checkRights should not have been called'));

      should(funnel.execute(request, cb)).be.eql(0);
      should(funnel.checkRights).not.be.called();
      should(cb)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(BadRequestError));
      should(cb.firstCall.args[0].message).eql('Client connection dropped');
    });
  });

  describe('#playCachedRequests', () => {
    beforeEach(() => {
      funnel._playCachedRequests.restore();
    });

    it('should eventually play cached requests', (done) => {
      funnel.concurrentRequests = kuzzle.config.limits.concurrentRequests;
      funnel.execute(request, done);

      funnel.concurrentRequests = 0;
    });

    it('should play cached request in order', (done) => {
      const
        serialized = request.serialize(),
        secondRequest = new Request(Object.assign(serialized.data, {id: 'req-2'})),
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

});

