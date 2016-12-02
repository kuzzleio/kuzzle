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
    rq,
    response,
    rc;

  before(() => {
    kuzzleStub = {
      config: {
        apiVersion: '1.0',
        httpRoutes: require('../../../../lib/config/httpRoutes')
      },
      pluginsManager: {
        routes: [
          {verb: 'get', url: 'foo/bar/baz', controller: 'foo', action: 'bar'}
        ]
      },
      funnel: {
        execute: function (r, c, cb) {
          response = new ResponseObject(r, {status: 1234});
          cb(null, response);
        }
      }
    };

    rc = new RouterController(kuzzleStub);
    rc.init();
  });

  beforeEach(() => {
    rq = {
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
    rq.url = `/api/${kuzzleStub.config.apiVersion}/ms/_getrange/someId/start/end`;
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('ms');
        should(response.action).be.eql('getrange');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register POST routes from the config/httpRoutes file', (done) => {
    rq.url = `/api/${kuzzleStub.config.apiVersion}/profiles/foobar`;
    rq.method = 'POST';
    rq.content = '{"profileId": "foobar"}';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('security');
        should(response.action).be.eql('updateProfile');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register PUT routes from the config/httpRoutes file', (done) => {
    rq.url = `/api/${kuzzleStub.config.apiVersion}/_updateSelf`;
    rq.method = 'PUT';
    rq.content = '{"foo": "bar"}';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('auth');
        should(response.action).be.eql('updateSelf');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register DELETE routes from the config/httpRoutes file', (done) => {
    rq.url = `/api/${kuzzleStub.config.apiVersion}/foobar`;
    rq.method = 'DELETE';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('admin');
        should(response.action).be.eql('deleteIndex');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the base route /_serverInfo', (done) => {
    rq.url = '/api/_serverInfo';
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('read');
        should(response.action).be.eql('serverInfo');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the swagger JSON auto-generator route', (done) => {
    rq.url = '/api/swagger.json';
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(200);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register the swagger YAML auto-generator route', (done) => {
    rq.url = '/api/swagger.yml';
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/yaml');
        should(result.status).be.eql(200);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should register plugins HTTP routes', (done) => {
    rq.url = `/api/${kuzzleStub.config.apiVersion}/_plugin/foo/bar/baz`;
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(response.controller).be.eql('foo');
        should(response.action).be.eql('bar');
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(1234);
        should(result.content).be.eql(JSON.stringify(response.toJson()));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should return a 404 if the requested route does not exist', (done) => {
    rq.url = `/api/${kuzzleStub.config.apiVersion}/foo/bar`;
    rq.method = 'GET';

    rc.router.route(rq, result => {
      try {
        should(result).be.instanceOf(HttpResponse);
        should(result.id).be.eql(rq.requestId);
        should(result.type).be.eql('application/json');
        should(result.status).be.eql(404);
        should(result.content).startWith('{"status":404,"error":{"message":"API URL not found: /api/1.0/foo/bar"');
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
});
