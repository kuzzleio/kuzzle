'use strict';

const should = require('should');
const { Request } = require('kuzzle-common-objects');
const Router = require('../../../../lib/core/network/router');
const { HttpMessage } = require('../../../../lib/core/network/protocols/http');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: router.httpRequest', () => {
  let kuzzle;
  let httpRequest;
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

    routeController = new Router(kuzzle);
    routeController.init();

    httpRequest = new HttpMessage(
      {id: 'requestId'},
      {url: '', method: '', headers: {}});
  });

  it('should register GET routes from the config/httpRoutes file', done => {
    httpRequest.url = '/ms/_getrange/someId?start=start&end=end';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('ms');
        should(request.input.action).be.eql('getrange');
        should(request.response.requestId).be.eql(httpRequest.requestId);
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
    httpRequest.url = '/my-index/my-collection/_count';
    httpRequest.method = 'POST';
    httpRequest.addChunk('{"filter": "foobar"}');

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('document');
        should(request.input.action).be.eql('count');
        should(request.response.requestId).be.eql(httpRequest.requestId);
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
    httpRequest.url = '/_updateSelf';
    httpRequest.method = 'PUT';
    httpRequest.addChunk('{"foo": "bar"}');

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('auth');
        should(request.input.action).be.eql('updateSelf');
        should(request.response.requestId).be.eql(httpRequest.requestId);
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
    httpRequest.url = '/foobar';
    httpRequest.method = 'DELETE';

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('index');
        should(request.input.action).be.eql('delete');
        should(request.response.requestId).be.eql(httpRequest.requestId);
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

  it('should register the base route /_serverInfo', (done) => {
    httpRequest.url = '/_serverInfo';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('server');
        should(request.input.action).be.eql('info');
        should(request.response.requestId).be.eql(httpRequest.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register plugins HTTP routes', (done) => {
    httpRequest.url = '/foo/bar/baz';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, request => {
      try {
        should(request.input.controller).be.eql('foo');
        should(request.input.action).be.eql('bar');
        should(request.response.requestId).be.eql(httpRequest.requestId);
        should(request.response.headers['content-type']).be.eql('application/json');
        should(request.response.status).be.eql(1234);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should return a 404 if the requested route does not exist', (done) => {
    httpRequest.url = '/a/b/c/d';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, result => {
      try {
        should(result.response.requestId).be.eql(httpRequest.requestId);
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
