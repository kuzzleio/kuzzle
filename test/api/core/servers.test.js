/**
 * This component initializes
 */
var
  should = require('should'),
  http = require('http'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Servers = rewire('../../../lib/api/core/servers');

describe('Test: core/servers', function () {
  var
    kuzzle,
    port = 6667,
    httpServer = false,
    mqServer = false,
    restRedirected = false;

  before(function (done) {
    this.timeout(200);
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.router.initRouterHttp = function () { httpServer = true; };
        kuzzle.router.routeMQListener = function () { mqServer = true; };
        kuzzle.router.routeHttp = function () { restRedirected = true; };
        Servers.initAll(kuzzle, { httpPort: port });
        done();
      });
  });

  it('should register all three servers at initialization', function () {
    should(httpServer).be.true();
    should(mqServer).be.true();
  });

  it('should redirect REST requests to the router controller', function (done) {
    http.get('http://localhost:' + port + '/api');

    setTimeout(function () {
      should(restRedirected).be.true();
      done();
    }, 20);
  });
});
