'use strict';

const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  Router = require('../../../../lib/api/core/httpRouter'),
  Request = require('kuzzle-common-objects').Request;

describe('core/httpRouter', () => {
  let
    router,
    handler,
    kuzzleMock,
    rq;

  beforeEach(() => {
    kuzzleMock = new KuzzleMock();
    router = new Router(kuzzleMock);
    handler = sinon.stub();
    rq = {
      requestId: 'requestId',
      url: '',
      method: '',
      headers: {},
      content: ''
    };
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
      should(function () { router.post('/foo/bar', handler); }).throw(InternalError);
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
    it('should invoke the registered handler on a known route', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';

      router.route(rq, () => {
        should(handler).be.calledOnce();
        should(handler.firstCall.args[0]).be.instanceOf(Request);
      });
    });

    it('should init request.context with the good values', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.headers.foo = 'bar';
      rq.headers.Authorization = 'Bearer jwtFoobar';
      rq.headers['X-Kuzzle-Volatile'] = '{"modifiedBy": "John Doe", "reason": "foobar"}';
      rq.method = 'POST';

      router.route(rq, () => {
        should(handler).be.calledOnce();
        should(handler.firstCall.args[0]).be.instanceOf(Request);
        should(handler.firstCall.args[0].context.protocol).be.exactly('http');
        should(handler.firstCall.args[0].context.connectionId).be.exactly('requestId');
        should(handler.firstCall.args[0].input.headers).be.eql({
          foo: 'bar',
          Authorization: 'Bearer jwtFoobar',
          'X-Kuzzle-Volatile': '{"modifiedBy": "John Doe", "reason": "foobar"}'});
        should(handler.firstCall.args[0].input.jwt).be.exactly('jwtFoobar');
        should(handler.firstCall.args[0].input.volatile).be.eql({modifiedBy: 'John Doe', reason: 'foobar'});
      });
    });

    it('should amend the request object if a body is found in the content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, () => {
        should(handler).be.calledOnce();
        should(handler.firstCall.args[0].id).match(rq.requestId);
        should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
        should(handler.firstCall.args[0].input.headers['content-type']).eql('application/json');
      });
    });

    it('should return dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, () => {
        should(handler).be.calledOnce();
        should(handler.firstCall.args[0].id).match(rq.requestId);
        should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
        should(handler.firstCall.args[0].input.headers['content-type']).eql('application/json');
        should(handler.firstCall.args[0].input.args.bar).eql('hello');
        should(handler.firstCall.args[0].input.args.baz).eql('world');
      });
    });

    it('should unnescape dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/%25world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=utf-8';
      rq.content = '{"foo": "bar"}';

      router.route(rq, () => {
        should(handler).be.calledOnce();
        should(handler.firstCall.args[0].id).match(rq.requestId);
        should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
        should(handler.firstCall.args[0].input.headers['content-type']).eql('application/json; charset=utf-8');
        should(handler.firstCall.args[0].input.args.bar).eql('hello');
        should(handler.firstCall.args[0].input.args.baz).eql('%world');
      });
    });

    it('should trigger an event when handling an OPTIONS HTTP method', () => {
      rq.url = '/';
      rq.method = 'OPTIONS';
      rq.headers = {
        'content-type': 'application/json',
        foo: 'bar'
      };

      router.route(rq, result => {
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
        should(kuzzleMock.pipe).be.calledOnce();
        should(kuzzleMock.pipe).be.calledWith('http:options', sinon.match.instanceOf(Request));
        should(kuzzleMock.pipe.firstCall.args[1].input.headers.foo).eql('bar');
      });
    });

    it('should register a default / route with the HEAD verb', () => {
      rq.url = '/';
      rq.method = 'HEAD';
      rq.headers = {
        'content-type': 'application/json',
        foo: 'bar'
      };

      router.route(rq, result => {
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
      });
    });

    it('should return an error if the HTTP method is unknown', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'FOOBAR';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, result => {
        should(handler).have.callCount(0);

        should(result.response.toJSON())
          .match({
            raw: false,
            status: 400,
            requestId: rq.requestId,
            content: {
              error: {
                status: 400,
                message: 'Unrecognized HTTP method FOOBAR'
              },
              requestId: 'requestId',
              result: null
            },
            headers: router.defaultHeaders
          });
      });
    });

    it('should return an error if unable to parse the incoming JSON content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{bad JSON syntax}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).be.match({
          raw: false,
          status: 400,
          requestId: rq.requestId,
          content: {
            error: {
              status: 400,
              message: 'Unable to convert HTTP body to JSON'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });

    it('should return an error if unable to parse x-kuzzle-volatile header', () => {
      router.get('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'GET';
      rq.headers['content-type'] = 'application/json';
      rq.headers['x-kuzzle-volatile'] = '{bad JSON syntax}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).be.match({
          raw: false,
          status: 400,
          requestId: rq.requestId,
          content: {
            error: {
              status: 400,
              message: 'Unable to convert HTTP x-kuzzle-volatile header to JSON'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });

    it('should return an error if the content-type is not JSON', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/foobar';
      rq.content = '{"foo": "bar"}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).match({
          raw: false,
          status: 400,
          requestId: rq.requestId,
          content: {
            error: {
              status: 400,
              message: 'Invalid request content-type. Expected "application/json", got: "application/foobar"'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });

    it('should send an error if the charset is not utf-8', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=iso8859-1';
      rq.content = '{"foo": "bar"}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).match({
          raw: false,
          status: 400,
          requestId: rq.requestId,
          content: {
            error: {
              status: 400,
              message: 'Invalid request charset. Expected "utf-8", got: "iso8859-1"'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });

    it('should return an error if the route does not exist', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).match({
          raw: false,
          status: 404,
          requestId: rq.requestId,
          content: {
            error: {
              status: 404,
              message: 'API URL not found: /foo/bar'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });

    it('should return an error if an exception is thrown', () => {
      const routeHandlerStub = function () {
        this.getRequest = sinon.stub().throws(new InternalError('HTTP internal exception'));
      };

      mockrequire('../../../../lib/api/core/httpRouter/routeHandler', routeHandlerStub);
      mockrequire.reRequire('../../../../lib/api/core/httpRouter/routePart');
      const MockRouter = mockrequire.reRequire('../../../../lib/api/core/httpRouter');

      router = new MockRouter(kuzzleMock);

      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, result => {
        should(handler).not.be.called();

        should(result.response.toJSON()).match({
          raw: false,
          status: 500,
          requestId: rq.requestId,
          content: {
            error: {
              status: 500,
              message: 'HTTP internal exception'
            },
            requestId: 'requestId',
            result: null
          },
          headers: router.defaultHeaders
        });
      });
    });
  });
});
