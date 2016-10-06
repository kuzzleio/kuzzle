/**
 * This component initializes
 */
var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  HttpServer = rewire('../../../../lib/api/core/entryPoints/http');

describe('Test: entryPoints/http', () => {
  var
    kuzzle,
    httpServer;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    httpServer = new HttpServer(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have property kuzzle and an init function on construct', () => {
    should(httpServer).have.property('kuzzle');
    should(httpServer.init).be.a.Function();
  });

  it('should call initHttpRouter and routeHttp on init and create the HTTP server', () => {
    var
      stubListen = sinon.spy(),
      spyCreateServer = sinon.stub().yields().returns({listen: stubListen});

    return HttpServer.__with__({
      http: {
        createServer: spyCreateServer
      }
    })(() => {
      return httpServer.init()
        .then(() => {
          should(kuzzle.router.initHttpRouter).be.calledOnce();
          should(spyCreateServer).be.calledOnce();
          should(kuzzle.router.routeHttp).be.calledOnce();
          should(stubListen).be.calledOnce();
          should(stubListen).be.calledWithExactly(kuzzle.config.server.http.port);
        });
    });
  });

  it('should use the port defined in the configuration if any', () => {
    var
      stubListen = sinon.spy(),
      spyCreateServer = sinon.stub().yields().returns({listen: stubListen});

    kuzzle.config.server.http.port = 999;

    return HttpServer.__with__({
      http: {
        createServer: spyCreateServer
      }
    })(() => {
      return httpServer.init()
        .then(() => {
          should(stubListen).calledOnce();
          should(stubListen).calledWithExactly(999);
        });
    });
  });

});
