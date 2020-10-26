'use strict';

const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const httpsRoutes = require('../../../../lib/config/httpRoutes');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const Router = require('../../../../lib/core/network/httpRouter');
const { HttpMessage } = require('../../../../lib/core/network/protocols/http');
const {
  Request,
  InternalError
} = require('kuzzle-common-objects');

describe('core/network/httpRouter', () => {
  let
    router,
    handler,
    kuzzleMock,
    rq;

  beforeEach(() => {
    kuzzleMock = new KuzzleMock();
    router = new Router(kuzzleMock);
    handler = sinon.stub().yields();
    rq = new HttpMessage(
      { id: 'requestId' },
      { url: '', method: '', headers: {} });
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#adding routes', () => {
    it('should add a GET route when asked to', () => {
      router.get('/foo/bar', handler);
      should(router.routes.GET.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a POST route when asked to', () => {
      router.post('/foo/bar', handler);
      should(router.routes.POST.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a PUT route when asked to', () => {
      router.put('/foo/bar', handler);
      should(router.routes.PUT.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a PATCH route when asked to', () => {
      router.patch('/foo/bar', handler);
      should(router.routes.PATCH.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a DELETE route when asked to', () => {
      router.delete('/foo/bar', handler);
      should(router.routes.DELETE.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a HEAD route when asked to', () => {
      router.head('/foo/bar', handler);
      should(router.routes.HEAD.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should raise an internal error when trying to add a duplicate', () => {
      router.post('/foo/bar', handler);

      should(function () { router.post('/foo/bar', handler); })
        .throw(InternalError, { id: 'network.http.duplicate_url' });
      should(function () { router.post('/foo/bar/', handler); })
        .throw(InternalError, { id: 'network.http.duplicate_url' });
    });
  });

  describe('#default headers', () => {
    it('should define appropriate default HTTP headers', () => {
      should(router.defaultHeaders).eql({
        'content-type': 'application/json',
        'Accept-Encoding': 'gzip,deflate,identity',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile'
      });
    });

    it('should update the list of accepted compression algorithms if compression is disabled', () => {
      kuzzleMock.config.server.protocols.http.allowCompression = false;
      router = new Router(kuzzleMock);

      should(router.defaultHeaders).eql({
        'content-type': 'application/json',
        'Accept-Encoding': 'identity',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile'
      });
    });

    it('should take the value of the CORS headers from the config file, if set', () => {
      kuzzleMock.config.http.accessControlAllowOrigin = 'foobar';
      kuzzleMock.config.http.accessControlAllowMethods = 'METHOD';
      kuzzleMock.config.http.accessControlAllowHeaders = 'headers';

      router = new Router(kuzzleMock);

      should(router.defaultHeaders).eql({
        'content-type': 'application/json',
        'Accept-Encoding': 'gzip,deflate,identity',
        'Access-Control-Allow-Origin': 'foobar',
        'Access-Control-Allow-Methods': 'METHOD',
        'Access-Control-Allow-Headers': 'headers'
      });
    });
  });

  describe('#routing requests', () => {
    it('should invoke the registered handler on a known route', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();
          should(handler.firstCall.args[0]).be.instanceOf(Request);
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should init request.context with the right values', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.headers.foo = 'bar';
      rq.headers.Authorization = 'Bearer jwtFoobar';
      rq.headers['X-Kuzzle-Volatile'] = '{"modifiedBy": "John Doe", "reason": "foobar"}';
      rq.method = 'POST';

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const apiRequest = handler.firstCall.args[0];

          should(apiRequest).be.instanceOf(Request);
          should(apiRequest.context.connection.protocol).be.exactly('http');
          should(apiRequest.context.connection.id).be.exactly('requestId');
          should(apiRequest.context.connection.misc.headers).be.eql({
            foo: 'bar',
            Authorization: 'Bearer jwtFoobar',
            'X-Kuzzle-Volatile': '{"modifiedBy": "John Doe", "reason": "foobar"}'
          });
          should(apiRequest.context.connection.misc.verb).eql('POST');
          should(apiRequest.input.jwt).be.exactly('jwtFoobar');
          should(apiRequest.input.volatile).be.eql({
            modifiedBy: 'John Doe',
            reason: 'foobar'
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should properly handle querystrings (w/o url trailing slash)', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar?foo=bar';
      rq.method = 'POST';

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const payload = handler.firstCall.args[0];
          should(payload).be.instanceOf(Request);
          should(payload.input.args.foo).eql('bar');

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should properly handle querystrings (w/ url trailing slash)', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar/?foo=bar';
      rq.method = 'POST';

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const payload = handler.firstCall.args[0];
          should(payload).be.instanceOf(Request);
          should(payload.input.args.foo).eql('bar');

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should amend the request object if a body is found in the content', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const apiRequest = handler.firstCall.args[0];

          should(apiRequest.id).match(rq.requestId);
          should(apiRequest.input.body).match({ foo: 'bar' });
          should(apiRequest.input.headers['content-type']).eql('application/json');
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return dynamic values for parametric routes', done => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const apiRequest = handler.firstCall.args[0];

          should(apiRequest.id).match(rq.requestId);
          should(apiRequest.input.body).match({ foo: 'bar' });
          should(apiRequest.input.headers['content-type']).eql('application/json');
          should(apiRequest.input.args.bar).eql('hello');
          should(apiRequest.input.args.baz).eql('world');
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should unnescape dynamic values for parametric routes', done => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/%25world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=utf-8';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, () => {
        try {
          should(handler).be.calledOnce();

          const apiRequest = handler.firstCall.args[0];

          should(apiRequest.id).match(rq.requestId);
          should(apiRequest.input.body).match({ foo: 'bar' });
          should(apiRequest.input.headers['content-type']).eql('application/json; charset=utf-8');
          should(apiRequest.input.args.bar).eql('hello');
          should(apiRequest.input.args.baz).eql('%world');
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should trigger an event when handling an OPTIONS HTTP method', done => {
      rq.url = '/';
      rq.method = 'OPTIONS';
      rq.headers = {
        'content-type': 'application/json',
        foo: 'bar'
      };

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 200,
            requestId: rq.requestId,
            content: {
              error: null,
              requestId: 'requestId',
              result: {}
            },
            headers: router.defaultHeaders
          });

          should(result.input.headers).match(rq.headers);
          should(kuzzleMock.pipe)
            .be.calledOnce()
            .be.calledWith('http:options', sinon.match.instanceOf(Request));
          should(kuzzleMock.pipe.firstCall.args[1].input.headers.foo).eql('bar');

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should register a default / route with the HEAD verb', done => {
      rq.url = '/';
      rq.method = 'HEAD';
      rq.headers = {
        'content-type': 'application/json',
        foo: 'bar'
      };

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 200,
            requestId: rq.requestId,
            content: {
              error: null,
              requestId: 'requestId',
              result: {}
            },
            headers: router.defaultHeaders
          });

          should(result.input.headers).match(rq.headers);
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if the HTTP method is unknown', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'FOOBAR';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, result => {
        try {
          should(handler).have.callCount(0);

          should(result.response.toJSON())
            .match({
              raw: false,
              status: 400,
              requestId: rq.requestId,
              content: {
                error: {
                  status: 400,
                  id: 'network.http.unsupported_verb'
                },
                requestId: 'requestId',
                result: null
              },
              headers: router.defaultHeaders
            });
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if unable to parse the incoming JSON content', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{bad JSON syntax}');

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).be.match({
            raw: false,
            status: 400,
            requestId: rq.requestId,
            content: {
              error: {
                status: 400,
                id: 'network.http.body_parse_failed'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if unable to parse x-kuzzle-volatile header', done => {
      router.get('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'GET';
      rq.headers['content-type'] = 'application/json';
      rq.headers['x-kuzzle-volatile'] = '{bad JSON syntax}';

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).be.match({
            raw: false,
            status: 400,
            requestId: rq.requestId,
            content: {
              error: {
                status: 400,
                id: 'network.http.volatile_parse_failed'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if the content-type is not JSON', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/foobar';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 400,
            requestId: rq.requestId,
            content: {
              error: {
                status: 400,
                id: 'network.http.unsupported_content'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should send an error if the charset is not utf-8', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=iso8859-1';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 400,
            requestId: rq.requestId,
            content: {
              error: {
                status: 400,
                id: 'network.http.unsupported_charset'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if the route does not exist', done => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 404,
            requestId: rq.requestId,
            content: {
              error: {
                status: 404,
                id: 'network.http.url_not_found'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should return an error if an exception is thrown', done => {
      const routeHandlerStub = class {
        get request() {
          throw new InternalError('HTTP internal exception.');
        }
      };

      mockrequire(
        '../../../../lib/core/network/httpRouter/routeHandler',
        routeHandlerStub);

      mockrequire.reRequire('../../../../lib/core/network/httpRouter/routePart');

      const MockRouter = mockrequire.reRequire('../../../../lib/core/network/httpRouter');

      router = new MockRouter(kuzzleMock);

      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/json';
      rq.addChunk('{"foo": "bar"}');

      router.route(rq, result => {
        try {
          should(handler).not.be.called();

          should(result.response.toJSON()).match({
            raw: false,
            status: 500,
            requestId: rq.requestId,
            content: {
              error: {
                status: 500,
                message: 'HTTP internal exception.'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });

          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should ensure that deprecated routes have the correct properties', () => {
      const deprecatedRoutes = httpsRoutes.filter(route => route.deprecated);

      for (const route of deprecatedRoutes) {
        const { deprecated } = route;
        should(deprecated).have.property('since');
        should(deprecated).have.property('message');
      }
    });
  });
});
