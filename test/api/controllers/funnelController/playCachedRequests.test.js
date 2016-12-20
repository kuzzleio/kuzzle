var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.playCachedRequests', () => {
  var
    kuzzle,
    funnel,
    executeCalled,
    request,
    callback,
    setTimeoutCalled,
    playCachedRequests;

  before(() => {
    request = new Request({
      controller: 'foo',
      action: 'bar'
    }, {
      connection: {id: 'connectionid'},
      token: null
    });

    callback = () => {};

    kuzzle = new Kuzzle();
    FunnelController.__set__('setTimeout', () => {
      setTimeoutCalled = true;
    });

    playCachedRequests = FunnelController.__get__('playCachedRequests');
  });

  beforeEach(() => {
    executeCalled = false;
    setTimeoutCalled = false;

    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        funnel = new FunnelController(kuzzle);
        funnel.init();
        funnel.lastOverloadTime = 0;
        funnel.overloadWarned = true;
        sandbox.stub(funnel, 'execute', (req, cb) => {
          executeCalled = true;

          should(req).be.eql(request);
          should(cb).be.eql(callback);
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#returning to normal state', () => {
    it('should return to normal state if there is no more cached request to play', function (done) {
      this.timeout(500);

      kuzzle.once('log:info', msg => {
        should(funnel.overloaded).be.false();
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
      should(setTimeoutCalled).be.false();
      kuzzle.removeAllListeners('log:info');
      done();
    }, 200);
  });

  describe('#replaying requests', () => {
    it('should do nothing if there is no room to replay request yet', () => {
      funnel.cachedItems = 1;
      funnel.concurrentRequests = kuzzle.config.server.maxConcurrentRequests;
      playCachedRequests(kuzzle, funnel);

      should(setTimeoutCalled).be.true();
      should(executeCalled).be.false();
    });

    it('should resubmit a request and end the overload state if there is no cached request left', () => {
      funnel.cachedItems = 1;
      funnel.concurrentRequests = 0;
      funnel.overloaded = true;
      funnel.requestsCache = [{request, callback}];
      playCachedRequests(kuzzle, funnel);

      should(setTimeoutCalled).be.false();
      should(executeCalled).be.true();
      should(funnel.overloaded).be.false();
    });
  });
});
