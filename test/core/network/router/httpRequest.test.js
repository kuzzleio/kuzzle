'use strict';

const should = require('should');

const { Request } = require('../../../../index');
const Router = require('../../../../lib/core/network/router');
const HttpMessage = require('../../../../lib/core/network/protocols/httpMessage');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const UWSHttpMessageMock = require('../../../mocks/uWS_http_request.mock');

describe('Test: router.httpRequest', () => {
  const connection = { id: 'requestId' };
  let kuzzle;
  let routeController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.pluginsManager.routes = [
      {verb: 'get', path: 'foo/bar/baz', controller: 'foo', action: 'bar'}
    ];

    kuzzle.funnel.execute.callsFake((request, callback) => {
      request.setResult({}, {status: 1234});
      callback(null, request);
    });

    kuzzle.config.http.accessControlAllowOrigin = 'foobar';

    routeController = new Router();
    routeController.init();
  });

  it('should register GET routes from the config/httpRoutes file', done => {
    const req = new UWSHttpMessageMock(
      'GET',
      '/ms/_getrange/someId?start=start&end=end');
    const httpMessage = new HttpMessage(connection, req);

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('ms');
        should(request.input.action).be.eql('getrange');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type'])
          .be.eql('application/json');
        should(request.response.headers['Access-Control-Allow-Origin'])
          .be.eql('foobar');
        should(request.response.status).be.eql(1234);
        should(kuzzle.pipe).be.calledOnce();
        should(kuzzle.pipe.firstCall.args[0]).be.eql('http:get');
        should(kuzzle.pipe.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register POST routes from the config/httpRoutes file', (done) => {
    const req = new UWSHttpMessageMock('post', '/my-index/my-collection/_count');
    const httpMessage = new HttpMessage(connection, req);
    httpMessage.content = { filter: 'foobar' };

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('document');
        should(request.input.action).be.eql('count');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type'])
          .be.eql('application/json');
        should(request.response.status).be.eql(1234);
        should(kuzzle.pipe).be.calledOnce();
        should(kuzzle.pipe.firstCall.args[0]).be.eql('http:post');
        should(kuzzle.pipe.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register PUT routes from the config/httpRoutes file', done => {
    const req = new UWSHttpMessageMock('put', '/_updateSelf');
    const httpMessage = new HttpMessage(connection, req);
    httpMessage.content = {foo: 'bar'};

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('auth');
        should(request.input.action).be.eql('updateSelf');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        should(kuzzle.pipe).be.calledOnce();
        should(kuzzle.pipe.firstCall.args[0]).be.eql('http:put');
        should(kuzzle.pipe.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register DELETE routes from the config/httpRoutes file', done => {
    const req = new UWSHttpMessageMock('delete', '/foobar');
    const httpMessage = new HttpMessage(connection, req);

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('index');
        should(request.input.action).be.eql('delete');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        should(kuzzle.pipe).be.calledOnce();
        should(kuzzle.pipe.firstCall.args[0]).be.eql('http:delete');
        should(kuzzle.pipe.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the base route /_serverInfo', done => {
    const req = new UWSHttpMessageMock('get', '/_serverInfo');
    const httpMessage = new HttpMessage(connection, req);

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('server');
        should(request.input.action).be.eql('info');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register plugins HTTP routes', done => {
    const req = new UWSHttpMessageMock('get', '/foo/bar/baz');
    const httpMessage = new HttpMessage(connection, req);

    routeController.http.route(httpMessage, request => {
      try {
        should(request.input.controller).be.eql('foo');
        should(request.input.action).be.eql('bar');
        should(request.response.requestId).be.eql(httpMessage.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should return a 404 if the requested route does not exist', done => {
    const req = new UWSHttpMessageMock('get', '/a/b/c/d');
    const httpMessage = new HttpMessage(connection, req);

    routeController.http.route(httpMessage, result => {
      try {
        should(result.response.requestId).be.eql(httpMessage.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(404);
        should(result.response.error.message).be.eql('API URL not found: /a/b/c/d.');
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
});
