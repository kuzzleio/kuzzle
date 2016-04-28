var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  ServiceUnavailableError = require.main.require('lib/api/core/errors/serviceUnavailableError'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.execute', () => {
  var
    kuzzle,
    funnel,
    processRequestCalled,
    requestObject,
    context,
    requestReplayed;

  before(function (callback) {
    context = {
      connection: {id: 'connectionid'},
      token: null
    };

    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        FunnelController.__set__('processRequest', (kuzzle, controllers, requestObject, context) => {
          processRequestCalled = true;

          if (requestObject.errorMe) {
            return q.reject(new Error('errored on purpose'));
          }

          return q(new ResponseObject(requestObject));
        });

        FunnelController.__set__('playCachedRequests', function () {
          requestReplayed = true;
        });

        callback();
      });
  });

  beforeEach(() => {
    processRequestCalled = false;
    requestReplayed = false;

    requestObject = new RequestObject({
      controller: 'foo',
      action: 'bar'
    });

    funnel = new FunnelController(kuzzle);
    funnel.init();
  });

  describe('#normal state', function () {
    it('should execute the request immediately if not overloaded', done => {
      funnel.execute(requestObject, context, (err, res) => {
        try {
          should(err).be.null();
          should(res.status).be.exactly(200);
          should(res).be.instanceOf(ResponseObject);
          should(processRequestCalled).be.true();
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should forward any error occuring during the request execution', done => {
      requestObject.errorMe = true;

      funnel.execute(requestObject, context, (err, res) => {
        try {
          should(err).be.instanceOf(Error);
          should(res.status).be.exactly(500);
          should(res.error.message).be.exactly('errored on purpose');
          should(processRequestCalled).be.true();
          should(funnel.overloaded).be.false();
          should(requestReplayed).be.false();
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

  describe('#server:overload hook', function () {
    it('should fire the hook the first time Kuzzle is in overloaded state', done => {
      this.timeout(500);

      kuzzle.once('server:overload', function () {
        done();
      });

      funnel.overloaded = true;
      funnel.execute(requestObject, context, () => {
      });
    });

    it('should fire the hook if the last one was fired more than 500ms ago', done => {
      this.timeout(500);

      kuzzle.once('server:overload', function () {
        done();
      });

      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;
      funnel.execute(requestObject, context, () => {});
    });

    it('should not fire the hook if one was fired less than 500ms ago', done => {
      var listener = function () {
        done(new Error('server:overload hook fired unexpectedly'));
      };

      kuzzle.once('server:overload', listener);

      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 200;
      funnel.execute(requestObject, context, () => {});
      setTimeout(() => {
        kuzzle.off('server:overload', listener);
        done();
      }, 200);
    });
  });

  describe('#overloaded state', function () {
    it('should enter overloaded state if the maxConcurrentRequests property is reached', done => {
      var callback = () => {
        done(new Error('Request executed. It should have been queued instead'));
      };

      funnel.concurrentRequests = kuzzle.config.request.maxConcurrentRequests;

      funnel.execute(requestObject, context, callback);

      setTimeout(() => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.true();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(1);
        should(funnel.requestsCache[0]).match({requestObject, context, callback});
        done();
      }, 100);
    });

    it('should not relaunch the request replayer background task if already in overloaded state', done => {
      var callback = () => {
        done(new Error('Request executed. It should have been queued instead'));
      };

      funnel.concurrentRequests = kuzzle.config.request.maxConcurrentRequests;
      funnel.overloaded = true;

      funnel.execute(requestObject, context, callback);

      setTimeout(() => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.false();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(1);
        should(funnel.requestsCache[0]).match({requestObject, context, callback});
        done();
      }, 100);
    });

    it('should discard the request if the maxRetainedRequests property is reached', done => {
      this.timeout(500);

      funnel.concurrentRequests = kuzzle.config.request.maxConcurrentRequests;
      funnel.cachedRequests = kuzzle.config.request.maxRetainedRequests;
      funnel.overloaded = true;

      funnel.execute(requestObject, context, (err, res) => {
        should(funnel.overloaded).be.true();
        should(requestReplayed).be.false();
        should(processRequestCalled).be.false();
        should(funnel.cachedRequests).be.eql(kuzzle.config.request.maxRetainedRequests);
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

