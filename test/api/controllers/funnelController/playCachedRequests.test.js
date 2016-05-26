var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.playCachedRequests', function () {
  var
    kuzzle,
    funnel,
    executeCalled,
    requestObject,
    context,
    callback,
    nextTickCalled,
    setTimeoutCalled,
    playCachedRequests;

  before(function (done) {
    context = {
      connection: {id: 'connectionid'},
      token: null
    };

    requestObject = new RequestObject({
      controller: 'foo',
      action: 'bar'
    });

    callback = () => {};

    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        FunnelController.__set__('setTimeout', function () {
          setTimeoutCalled = true;
        });

        FunnelController.__set__('process', {
          nextTick: () => { nextTickCalled = true; }
        });

        playCachedRequests = FunnelController.__get__('playCachedRequests');
        done();
      });
  });

  beforeEach(function () {
    executeCalled = false;
    nextTickCalled = false;
    setTimeoutCalled = false;

    funnel = new FunnelController(kuzzle);
    funnel.init();
    funnel.lastOverloadTime = 0;
    funnel.execute = function (r, c, cb) {
      executeCalled = true;

      should(r).be.eql(requestObject);
      should(c).be.eql(context);
      should(cb).be.eql(callback);
    };
  });

  describe('#returning to normal state', function () {
    it('should return to normal state if there is no more cached request to play', function (done) {
      this.timeout(500);

      kuzzle.once('log:info', msg => {
        should(funnel.overloaded).be.false();
        should(nextTickCalled).be.false();
        should(setTimeoutCalled).be.false();
        should(msg).startWith('End of overloaded state');
        done();
      });

      funnel.overloaded = true;
      playCachedRequests(kuzzle, funnel);
    });
  });
  
  it('should fire a log hook if the last one was fired more than 500ms ago', function (done) {
    this.timeout(500);

    kuzzle.once('log:info', msg => {
      should(funnel.overloaded).be.false();
      should(nextTickCalled).be.false();
      should(setTimeoutCalled).be.false();
      should(msg).startWith('End of overloaded state');
      done();
    });

    funnel.lastOverloadTime = Date.now() - 501;
    funnel.overloaded = true;
    playCachedRequests(kuzzle, funnel);
  });

  it('should not fire a log hook if the last one occured less than 500ms ago', function (done) {
    kuzzle.once('log:info', () => {
      done(new Error('Log hook fired unexpectedly'));
    });

    funnel.lastOverloadTime = Date.now() - 200;
    funnel.overloaded = true;
    playCachedRequests(kuzzle, funnel);

    setTimeout(() => {
      should(funnel.overloaded).be.false();
      should(nextTickCalled).be.false();
      should(setTimeoutCalled).be.false();
      kuzzle.removeAllListeners('log:info');
      done();
    }, 200);
  });

  describe('#replaying requests', function () {
    it('should do nothing if there is no room to replay request yet', function () {
      funnel.cachedRequests = 1;
      funnel.concurrentRequests = kuzzle.config.request.maxConcurrentRequests;
      playCachedRequests(kuzzle, funnel);

      should(nextTickCalled).be.false();
      should(setTimeoutCalled).be.true();
      should(executeCalled).be.false();
    });

    it('should resubmit a request and itself if there is room for a new request', function () {
      funnel.cachedRequests = 1;
      funnel.concurrentRequests = 0;
      funnel.requestsCache = [{requestObject, context, callback}];
      playCachedRequests(kuzzle, funnel);

      should(nextTickCalled).be.true();
      should(setTimeoutCalled).be.false();
      should(executeCalled).be.true();
    });
  });
});
