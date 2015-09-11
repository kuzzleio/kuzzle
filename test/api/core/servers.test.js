/**
 * This component initializes
 */
var
  should = require('should'),
  captainsLog = require('captains-log'),
  http = require('http'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  Servers = rewire('../../../lib/api/core/servers');

require('should-promised');

describe('Test: responseListener', function () {
  var
    kuzzle,
    port = 6667,
    httpServer = false,
    websocketServer = false,
    mqServer = false,
    restRedirected = false;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.router.initRouterHttp = function () { httpServer = true; };
        kuzzle.router.routeWebsocket = function () { websocketServer = true; };
        kuzzle.router.routeMQListener = function () { mqServer = true; };
        kuzzle.router.routeHttp = function () { restRedirected = true; };
        done();
      });
  });

  it('should register all three servers at initialization', function () {
    Servers.initAll(kuzzle, { port: port });
    kuzzle.io.emit('connection', {});

    should(httpServer).be.true();
    should(websocketServer).be.true();
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
