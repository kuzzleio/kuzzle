'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  HttpResponse = require('../../../../lib/api/core/entryPoints/httpResponse'),
  RouterController = require('../../../../lib/api/controllers/routerController');

describe('Test: routerController.httpRequest', () => {
  let
    sandbox = sinon.sandbox.create(),
    kuzzleStub,
    /** @type Request */
    response,
    httpRequest,
    routeController;

  before(() => {
    kuzzleStub = {
      config: {
        http: {
          routes: require('../../../../lib/config/httpRoutes'),
          accessControlAllowOrigin: 'foobar'
        }
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
    httpRequest = {
      requestId: 'requestId',
      url: '',
      method: '',
      headers: {},
      content: ''
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register GET routes from the config/httpRoutes file', (done) => {
    httpRequest.url = '/ms/_getrange/someId/start/end';
    httpRequest.method = 'GET';

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('ms');
        should(response.input.action).be.eql('getrange');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.content.headers['Access-Control-Allow-Origin']).be.eql('foobar');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register POST routes from the config/httpRoutes file', (done) => {
    httpRequest.url = '/profiles/foobar';
    httpRequest.method = 'POST';
    httpRequest.content = '{"profileId": "foobar"}';

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('security');
        should(response.input.action).be.eql('updateProfile');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
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
    httpRequest.content = '{"foo": "bar"}';

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('auth');
        should(response.input.action).be.eql('updateSelf');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
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

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('index');
        should(response.input.action).be.eql('delete');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
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

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('server');
        should(response.input.action).be.eql('info');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
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

    routeController.router.route(httpRequest, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(200);
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

    routeController.router.route(httpRequest, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/yaml');
        should(result.status).be.eql(200);
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

    routeController.router.route(httpRequest, result => {
      try {
        should(response.input.controller).be.eql('foo');
        should(response.input.action).be.eql('bar');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.exactly(response.response);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should return a 404 if the requested route does not exist', (done) => {
    httpRequest.url = '/foo/bar';
    httpRequest.method = 'GET';

    routeController.router.route(httpRequest, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(httpRequest.requestId);
        should(result.content.headers['content-type']).be.eql('application/json');
        should(result.status).be.eql(404);
        should(JSON.stringify(result.content.error)).startWith('{"status":404,"message":"API URL not found: /foo/bar"');
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
});
