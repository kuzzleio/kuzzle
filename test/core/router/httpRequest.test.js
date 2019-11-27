'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  RouterController = require('../../../lib/core/router'),
  { HttpMessage } = require('../../../lib/core/entrypoints/protocols/http');

describe('Test: routerController.httpRequest', () => {
  let
    kuzzleStub,
    /** @type Request */
    response,
    triggerSpy,
    httpRequest,
    routeController;

  before(() => {
    kuzzleStub = {
      config: {
        http: {
          routes: require('../../../lib/config/httpRoutes'),
          accessControlAllowOrigin: 'foobar',
          accessControlAllowMethods: 'GET,HEAD,PUT,POST,OPTIONS',
          accessControlAllowHeaders: 'headers'
        },
        server: {
          protocols: {
            http: {

            }
          }
        }
      },
      pipe: function (event, request) {
        triggerSpy(event, request);
        return Promise.resolve(request);
      },
      pluginsManager: {
        routes: [
          {verb: 'get', url: 'foo/bar/baz', controller: 'foo', action: 'bar'}
        ]
      },
      funnel: {
        execute: function (request, cb) {
          /** @type Request request */
          response = request;
          request.status = 1234;
          cb(null, request);
        }
      }
    };

    routeController = new RouterController(kuzzleStub);
    routeController.init();
  });

  beforeEach(() => {
    httpRequest = new HttpMessage(
      {id: 'requestId'},
      {url: '', method: '', headers: {}});
    triggerSpy = sinon.stub();
  });

  it('should register GET routes from the config/httpRoutes file', done => {
    httpRequest.url = '/ms/_getrange/someId?start=start&end=end';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('ms');
        should(response.input.action).be.eql('getrange');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.headers['Access-Control-Allow-Origin']).be.eql('foobar');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
        should(triggerSpy).be.calledOnce();
        should(triggerSpy.firstCall.args[0]).be.eql('http:get');
        should(triggerSpy.firstCall.args[1]).be.instanceOf(Request);
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

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('document');
        should(response.input.action).be.eql('count');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
        should(triggerSpy).be.calledOnce();
        should(triggerSpy.firstCall.args[0]).be.eql('http:post');
        should(triggerSpy.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register PUT routes from the config/httpRoutes file', (done) => {
    httpRequest.url = '/_updateSelf';
    httpRequest.method = 'PUT';
    httpRequest.addChunk('{"foo": "bar"}');

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('auth');
        should(response.input.action).be.eql('updateSelf');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
        should(triggerSpy).be.calledOnce();
        should(triggerSpy.firstCall.args[0]).be.eql('http:put');
        should(triggerSpy.firstCall.args[1]).be.instanceOf(Request);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register DELETE routes from the config/httpRoutes file', (done) => {
    httpRequest.url = '/foobar';
    httpRequest.method = 'DELETE';

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('index');
        should(response.input.action).be.eql('delete');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
        should(triggerSpy).be.calledOnce();
        should(triggerSpy.firstCall.args[0]).be.eql('http:delete');
        should(triggerSpy.firstCall.args[1]).be.instanceOf(Request);
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

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('server');
        should(response.input.action).be.eql('info');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the swagger JSON auto-generator route', (done) => {
    httpRequest.url = '/swagger.json';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, result => {
      try {
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(200);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the swagger YAML auto-generator route', (done) => {
    httpRequest.url = '/swagger.yml';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, result => {
      try {
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/yaml');
        should(result.response.status).be.eql(200);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register plugins HTTP routes', (done) => {
    httpRequest.url = '/_plugin/foo/bar/baz';
    httpRequest.method = 'GET';

    routeController.http.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('foo');
        should(response.input.action).be.eql('bar');
        should(result.response.requestId).be.eql(httpRequest.requestId);
        should(result.response.headers['content-type']).be.eql('application/json');
        should(result.response.status).be.eql(1234);
        should(result.response).be.exactly(response.response);
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
