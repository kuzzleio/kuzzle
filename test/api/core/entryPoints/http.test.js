/**
 * This component initializes
 */
var
  should = require('should'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  HttpServer = require.main.require('lib/api/core/entryPoints/http');

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

  it('should have property kuzzle, params and a function init on construct', function () {
    var httpServer = new HttpServer(kuzzle, {httpPort: httpPort});

    should(httpServer).have.property('kuzzle');
    should(httpServer).have.property('params');
    should(httpServer.init).be.a.Function();
  });

  it('should call initRouterHttp and routeHttp on init and create the HTTP server', function () {
    var
      httpServer = new HttpServer(kuzzle, {httpPort: httpPort}),
      spyInitRouterHttp = sandbox.stub(kuzzle.router, 'initRouterHttp'),
      spyRouteHttp = sandbox.stub(kuzzle.router, 'routeHttp'),
      stubListen = sandbox.stub(),
      spyCreateServer = sandbox.stub(httpServer.http, 'createServer', function (cb) {
        cb();
        return {listen: stubListen};
      });

    httpServer.init();

    should(spyInitRouterHttp.calledOnce).be.true();
    should(spyRouteHttp.calledOnce).be.true();
    should(spyCreateServer.calledOnce).be.true();
    should(stubListen.calledWith(httpPort)).be.true();
  });
});
