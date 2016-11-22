'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  HttpResponse = require.main.require('lib/api/core/entryPoints/httpResponse'),
  Router = require.main.require('lib/api/core/httpRouter');

describe('core/httpRouter', () => {
  let
    router,
    handler,
    callback,
    rq;

  beforeEach(() => {
    router = new Router();
    handler = sinon.stub();
    callback = sinon.stub();
    rq = {
      requestId: 'requestId',
      url: '',
      method: '',
      headers: {},
      content: ''
    };
  });

  describe('#adding routes', () => {
    it('should add a POST route when asked to', () => {
      router.post('/foo/bar', handler);
      should(router.routes.POST.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a GET route when asked to', () => {
      router.get('/foo/bar', handler);
      should(router.routes.GET.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a PUT route when asked to', () => {
      router.put('/foo/bar', handler);
      should(router.routes.PUT.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a DELETE route when asked to', () => {
      router.delete('/foo/bar', handler);
      should(router.routes.DELETE.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should raise an internal error when trying to add a duplicate', () => {
      router.post('/foo/bar', handler);
      should(function () { router.post('/foo/bar', handler); }).throw(InternalError);
    });
  });

  describe('#routing requests', () => {
    it('should invoke the registered handler on a known route', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).match({
        requestId: rq.requestId,
        headers: rq.headers,
        data: {
          body: {}
        }
      });
    });

    it('should amend the request object if a body is found in the content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).match({
        requestId: rq.requestId,
        headers: rq.headers,
        data: {
          id: 'foobar',
          body: {
            foo: 'bar'
          }
        }
      });
    });

    it('should replace the request object body if a body is not found in the content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).match({
        requestId: rq.requestId,
        headers: rq.headers,
        data: {
          body: {
            foo: 'bar'
          }
        }
      });
    });

    it('should return dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).match({
        requestId: rq.requestId,
        headers: rq.headers,
        data: {
          body: {
            foo: 'bar',
            bar: 'hello',
            baz: 'world'
          }
        }
      });
    });

    it('should unnescape dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/%25world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=utf-8';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).match({
        requestId: rq.requestId,
        headers: rq.headers,
        data: {
          body: {
            foo: 'bar',
            bar: 'hello',
            baz: '%world'
          }
        }
      });
    });

    it('should return an error if the HTTP method is unknown', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'FOOBAR';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        type: 'application/json',
        status: 400
      });
      should(callback.firstCall.args[0].content).startWith('{"status":400,"error":{"message":"Unrecognized HTTP method FOOBAR"');
    });

    it('should return an error if unable to parse the incoming JSON content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        type: 'application/json',
        status: 400
      });
      should(callback.firstCall.args[0].content).startWith('{"status":400,"error":{"message":"Unable to convert HTTP body to JSON');
    });

    it('should return an error if the content-type is not JSON', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/foobar';
      rq.content = '{"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        type: 'application/json',
        status: 400
      });
      should(callback.firstCall.args[0].content).startWith('{"status":400,"error":{"message":"Invalid request content-type');
    });

    it('should send an error if the charset is not utf-8', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=iso8859-1';
      rq.content = '{"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        type: 'application/json',
        status: 400
      });
      should(callback.firstCall.args[0].content).startWith('{"status":400,"error":{"message":"Invalid request charset');
    });

    it('should return an error if the route does not exist', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/foobar';
      rq.content = '{"id": "foobar", "body": {"foo": "bar"}}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        type: 'application/json',
        status: 404
      });
      should(callback.firstCall.args[0].content).startWith('{"status":404,"error":{"message":"API URL not found');
    });
  });
});
