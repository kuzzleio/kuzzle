/**
 * This component initializes
 */
var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  MqServer = require.main.require('lib/api/core/entryPoints/mq');

describe('Test: entryPoints/http', function () {
  var
    kuzzle,
    httpPort = 6667;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have property kuzzle and a function init on construct', function () {
    var mqServer = new MqServer(kuzzle);

    should(mqServer).have.property('kuzzle');
    should(mqServer.init).be.a.Function();
  });

  it('should call routeMQListener on init', function () {
    var
      mqServer = new MqServer(kuzzle),
      spyRouteMQListener = sandbox.stub(kuzzle.router, 'routeMQListener');

    mqServer.init();

    should(spyRouteMQListener.calledOnce).be.true();
  });
});
