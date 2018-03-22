const
  EntryPoint = require('../../../../../../lib/api/core/entrypoints/embedded'),
  HttpProtocol = require('../../../../../../lib/api/core/entrypoints/embedded/protocols/http'),
  KuzzleMock = require('../../../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleError = require('kuzzle-common-objects').errors.KuzzleError,
  should = require('should'),
  sinon = require('sinon');

describe('/lib/api/core/entrypoints/embedded/protocols/http', () => {
  let
    kuzzle,
    entrypoint,
    protocol,
    response;

  beforeEach(() => {
    response = {
      end: sinon.spy(),
      setHeader: sinon.spy(),
      writeHead: sinon.spy()
    };

    kuzzle = new KuzzleMock();

    entrypoint = new EntryPoint(kuzzle);
    entrypoint.execute = sinon.spy();
    entrypoint.newConnection = sinon.spy();
    entrypoint.httpServer = {
      listen: sinon.spy(),
      on: sinon.spy()
    };

    protocol = new HttpProtocol();
  });

  describe('#init', () => {
    it('should throw if an invalid maxRequestSize is given', () => {
      entrypoint.config.maxRequestSize = 'invalid';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid "maxRequestSize" parameter');
    });

    it('should throw if an invalid maxFormFileSize is given', () => {
      entrypoint.config.protocols.http.maxFormFileSize = 'invalid';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid HTTP "maxFormFileSize" parameter');
    });

    describe('#onRequest', () => {
      let
        multipart,
        onRequest,
        request;

      beforeEach(() => {
        multipart = [
          '-----------------------------165748628625109734809700179',
          'Content-Disposition: form-data; name="foo"',
          '',
          'bar',
          '-----------------------------165748628625109734809700179',
          'Content-Disposition: form-data; name="baz"; filename="test-multipart.txt"',
          'Content-Type: text/plain',
          '',
          'YOLO\n\n\n',
          '-----------------------------165748628625109734809700179--'
        ].join('\r\n');

        request = {
          headers: {
            'x-forwarded-for': '2.2.2.2',
            'x-foo': 'bar'
          },
          httpVersion: '1.1',
          method: 'method',
          on: sinon.spy(),
          removeAllListeners: sinon.stub().returnsThis(),
          resume: sinon.stub().returnsThis(),
          socket: {
            remoteAddress: '1.1.1.1'
          },
          url: 'url',
        };

        protocol.init(entrypoint);
        onRequest = protocol.server.on.firstCall.args[1];

        protocol._replyWithError = sinon.spy();
        protocol._sendRequest = sinon.spy();
      });

      it('should complain if the request is too big', () => {
        request.headers['content-length'] = Infinity;

        onRequest(request, response);

        should(request.resume).be.calledOnce();

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(/^[0-9a-w-]+$/, {
            url: request.url,
            method: request.method
          },
          response,
          {message: 'Error: maximum HTTP request size exceeded'});

      });

      it('should handle json content', done => {
        request.headers['content-type'] = 'application/json charset=utf-8';

        protocol._sendRequest = (connectionId, resp, payload) => {
          should(payload.content)
            .eql('chunk1chunk2chunk3');

          done();
        };

        onRequest(request, response);

        const dataCb = request.on.firstCall.args[1];
        const endCb = request.on.secondCall.args[1];

        dataCb('chunk1');
        dataCb('chunk2');
        dataCb('chunk3');
        endCb();

      });

      it('should handle valid x-www-form-urlencoded request', done => {
        protocol._sendRequest = (connectionId, resp, payload) => {
          should(payload.content).be.empty('');
          should(payload.json.foo).be.exactly('bar');
          should(payload.json.baz).be.exactly('1234');
          done();
        };

        request.headers['content-type'] = 'application/x-www-form-urlencoded';

        onRequest(request, response);

        const dataCB = request.on.firstCall.args[1];
        dataCB('foo=bar&baz=1234');

        const endCB = request.on.lastCall.args[1];
        endCB();
      });

      it('should handle valid multipart/form-data request', done => {
        protocol._sendRequest = (connectionId, resp, payload) => {
          should(payload.content).be.empty('');
          should(payload.json.foo).be.exactly('bar');
          should(payload.json.baz.filename).be.exactly('test-multipart.txt');
          should(payload.json.baz.mimetype).be.exactly('text/plain');
          should(payload.json.baz.file).be.exactly('WU9MTwoKCg==');
          done();
        };

        request.headers['content-type'] = 'multipart/form-data; boundary=---------------------------165748628625109734809700179';

        onRequest(request, response);

        let dataCB = request.on.firstCall.args[1];
        dataCB(multipart);

        let endCB = request.on.lastCall.args[1];
        endCB();
      });

      it('should reply with error if the actual data sent exceeds the maxRequestSize', () => {
        protocol.maxRequestSize = 2;
        onRequest(request, response);

        const dataCB = request.on.firstCall.args[1];

        dataCB('a slightly too big chunk');
        should(request.removeAllListeners).be.calledTwice();

        should(protocol._replyWithError)
          .be.calledWithMatch(/^[0-9a-z-]+$/, {
            url: request.url,
            method: request.method
          },
          response,
          {
            message: 'Error: maximum HTTP request size exceeded'
          });
      });

      it('should reply with error if the content type is unsupported', () => {
        request.headers['content-type'] = 'foo/bar';

        onRequest(request, response);

        should(request.resume).be.calledOnce();
        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(/^[0-9a-w-]+$/, {
            url: request.url,
            method: request.method
          },
          response,
          {
            message: 'Unsupported content type: foo/bar'
          });
      });

      it('should reply with error if the binary file size sent exceeds the maxFormFileSize', () => {
        protocol.maxFormFileSize = 2;
        request.headers['content-type'] = 'multipart/form-data; boundary=---------------------------165748628625109734809700179';
        onRequest(request, response);

        const dataCB = request.on.firstCall.args[1];

        dataCB(multipart);

        should(request.removeAllListeners).be.calledTwice();
        should(protocol._replyWithError)
          .be.calledWithMatch(/^[0-9a-z-]+$/,
            {
              url: request.url,
              method: request.method
            },
            response,
            {
              message: 'Error: maximum HTTP file size exceeded'
            });
      });
    });

    describe('#_sendRequest', () => {
      let payload;

      beforeEach(() => {
        payload = {
          requestId: 'requestId',
          url: 'url?pretty',
          json: {
            some: 'value'
          }
        };
        protocol.init(entrypoint);
      });

      it('should call kuzzle http router and send the client the response back', () => {
        protocol._sendRequest('connectionId', response, payload);

        should(kuzzle.router.http.route)
          .be.calledWith(payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];
        const result = new Request({});
        result.setResult('content', {
          status: 444,
          headers: {
            'x-foo': 'bar'
          }
        });

        cb(result);

        should(response.setHeader)
          .be.calledOnce()
          .be.calledWith('x-foo', 'bar');

        should(response.writeHead)
          .be.calledOnce()
          .be.calledWith(444);

        const expected = {
          requestId: 'requestId',
          status: 444,
          error: null,
          controller: null,
          action: null,
          collection: null,
          index: null,
          volatile: null,
          result: 'content'
        };

        should(response.end)
          .be.calledOnce()
          .be.calledWith(JSON.stringify(expected, undefined, 2));
      });

      it('should output buffer raw result', () => {
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];
        const content = Buffer.from('test');
        const result = new Request({});
        result.setResult(content, {
          raw: true,
          status: 444
        });

        cb(result);

        // Buffer.from(content) !== content
        const sent = response.end.firstCall.args[0];

        should(content.toString())
          .eql(sent.toString());
      });

      it('should output a stringified buffer as a raw buffer result', () => {
        protocol._sendRequest('connectionId', response, payload);
        const cb = kuzzle.router.http.route.firstCall.args[1];

        const content = JSON.parse(JSON.stringify(Buffer.from('test')));
        const result = new Request({});
        result.setResult(content, {
          raw: true,
          status: 444
        });

        cb(result);

        const sent = response.end.firstCall.args[0];

        should(sent)
          .be.an.instanceof(Buffer);
        should(sent.toString())
          .eql('test');
      });

      it('should output serialized JS objects marked as raw', () => {
        protocol._sendRequest('connectionId', response, payload);
        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult([{foo: 'bar'}], {
          raw: true
        });

        cb(result);

        should(response.end)
          .be.calledWith(JSON.stringify([{foo: 'bar'}]));
      });

      it('should output scalar content as-is if marked as raw', () => {
        protocol._sendRequest('connectionId', response, payload);
        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {
          raw: true
        });

        cb(result);

        should(response.end)
          .be.calledOnce()
          .be.calledWithExactly('content');
      });

    });

  });

  describe('#_replyWithError', () => {
    beforeEach(() => {
      entrypoint.logAccess = sinon.spy();
      protocol.init(entrypoint);
    });

    it('should log the access and reply with error', () => {
      const 
        error = new KuzzleError('test'),
        connectionId = 'connectionId',
        payload = {requestId: 'foobar'};
      error.status = 123;

      const rq = new Request(payload, {connectionId, error});
      protocol._replyWithError(connectionId, payload, response, error);

      should(entrypoint.logAccess)
        .be.calledOnce()
        .be.calledWithMatch(rq, {});

      should(entrypoint.logAccess.firstCall.args[0].context.connectionId).be.eql(connectionId);
      should(entrypoint.logAccess.firstCall.args[0].status).be.eql(123);
      should(entrypoint.logAccess.firstCall.args[0].error).be.eql(error);

      should(response.writeHead)
        .be.calledOnce()
        .be.calledWith(123, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods' : 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        });
    });

    it('should remove pending request from clients', () => {
      const error = new Error('test');
      error.status = 'status';

      entrypoint.clients.connectionId = {};

      protocol._replyWithError('connectionId', {}, response, error);

      should(entrypoint.clients)
        .be.empty();
    });
  });

});
