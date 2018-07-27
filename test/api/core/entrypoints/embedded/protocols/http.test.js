const
  mockrequire = require('mock-require'),
  HttpFormDataStream = require('../../../../../../lib/api/core/entrypoints/embedded/service/httpFormDataStream'),
  EntryPoint = require('../../../../../../lib/api/core/entrypoints/embedded'),
  KuzzleMock = require('../../../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  {
    KuzzleError,
    SizeLimitError,
    BadRequestError
  } = require('kuzzle-common-objects').errors,
  should = require('should'),
  sinon = require('sinon'),
  Writable = require('stream').Writable;

describe('/lib/api/core/entrypoints/embedded/protocols/http', () => {
  const
    gunzipMock = sinon.stub(),
    inflateMock = sinon.stub(),
    identityMock = sinon.stub(),
    zlibstub = {
      gzip: sinon.stub(),
      deflate: sinon.stub(),
      createGunzip: sinon.stub().returns(gunzipMock),
      createInflate: sinon.stub().returns(inflateMock)
    };
  let
    HttpProtocol,
    kuzzle,
    entrypoint,
    protocol,
    response;

  before(() => {
    [gunzipMock, inflateMock, identityMock].forEach(m => {
      m.pipe = sinon.stub();
      m.on = sinon.stub();
      m.close = sinon.stub();
    });
    mockrequire('zlib', zlibstub);
    HttpProtocol = mockrequire.reRequire('../../../../../../lib/api/core/entrypoints/embedded/protocols/http');
  });

  after(() => {
    mockrequire.stopAll();
  });

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

  afterEach(() => {
    Object.keys(zlibstub).forEach(s => zlibstub[s].resetHistory());
    [gunzipMock, inflateMock, identityMock].forEach(m => {
      m.resetHistory();
      ['pipe', 'on', 'close'].forEach(f => m[f].resetHistory());
    });
  });

  describe('#init', () => {
    it('should throw if an invalid maxRequestSize parameter is set', () => {
      entrypoint.config.maxRequestSize = 'invalid';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid "maxRequestSize" parameter value: expected a numeric value');
    });

    it('should throw if an invalid maxFormFileSize parameter is set', () => {
      entrypoint.config.protocols.http.maxFormFileSize = 'invalid';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid HTTP "maxFormFileSize" parameter value: expected a numeric value');
    });

    it('should throw if an invalid maxEncodingLayers parameter is set', () => {
      entrypoint.config.protocols.http.maxEncodingLayers = 'invalid';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid HTTP "maxEncodingLayers" parameter value: expected a numeric value');
    });

    it('should throw if an invalid allowCompression parameter is set', () => {
      entrypoint.config.protocols.http.allowCompression = 'foobar';

      return should(() => protocol.init(entrypoint))
        .throw('Invalid HTTP "allowCompression" parameter value: expected a boolean value');
    });

    it('should configure the zlib decoders', () => {
      protocol.init(entrypoint);

      should(Object.keys(protocol.decoders).sort()).eql(['deflate', 'gzip', 'identity']);
      should(protocol.decoders.gzip).eql(zlibstub.createGunzip);
      should(protocol.decoders.deflate).eql(zlibstub.createInflate);
      should(protocol.decoders.identity).be.a.Function();
      should(protocol.decoders.identity('foobar')).eql(null);
    });

    it('should set decoders with throwables if compression is disabled', () => {
      const message = 'Compression support is disabled';

      entrypoint.config.protocols.http.allowCompression = false;
      protocol.init(entrypoint);

      should(Object.keys(protocol.decoders).sort()).eql(['deflate', 'gzip', 'identity']);
      should(protocol.decoders.gzip).Function().and.not.eql(gunzipMock);
      should(protocol.decoders.deflate).Function().and.not.eql(inflateMock);
      should(protocol.decoders.identity).be.a.Function();

      should(() => protocol.decoders.gzip()).throw(BadRequestError, {message});
      should(() => protocol.decoders.deflate()).throw(BadRequestError, {message});
      should(protocol.decoders.identity('foobar')).eql(null);
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
          emit: sinon.spy(),
          pipe: sinon.spy(),
          unpipe: sinon.spy()
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
          {message: 'Maximum HTTP request size exceeded'});
      });

      it('should handle json content', done => {
        request.headers['content-type'] = 'application/json charset=utf-8';

        protocol._sendRequest = (connectionId, resp, payload) => {
          try {
            should(payload.content).eql('chunk1chunk2chunk3');
            done();
          }
          catch(e) {
            done(e);
          }
        };

        onRequest(request, response);

        should(request.pipe).calledOnce().calledWith(sinon.match.instanceOf(Writable));
        const writable = request.pipe.firstCall.args[0];

        writable.write('chunk1');
        writable.write('chunk2');
        writable.write('chunk3');
        writable.emit('finish');
      });

      it('should handle compressed content', () => {
        request.headers['content-encoding'] = 'gzip';

        onRequest(request, response);

        should(request.pipe).calledOnce().calledWith(gunzipMock);
        should(gunzipMock.pipe).calledOnce().calledWith(sinon.match.instanceOf(Writable));
        should(protocol.decoders.identity).not.called();
        should(protocol.decoders.deflate).not.called();

        should(protocol.decoders.gzip).calledOnce();
        should(gunzipMock.on).calledOnce().calledWith('error');
      });

      it('should reject if there are more compression layers than the configured limit', () => {
        protocol.maxEncodingLayers = 3;
        request.headers['content-encoding'] = 'identity, identity, identity, identity';

        onRequest(request, response);
        should(request.pipe).not.called();
        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(/^[0-9a-w-]+$/, {
            url: request.url,
            method: request.method
          },
          response,
          {message: 'Too many encodings'});
      });

      it('should reject if an unknown compression algorithm is provided', () => {
        request.headers['content-encoding'] = 'foobar';

        onRequest(request, response);

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(/^[0-9a-w-]+$/, {
            url: request.url,
            method: request.method
          },
          response,
          {message: 'Unsupported compression algorithm "foobar"'});
      });

      it('should handle chain pipes properly to match multi-layered compression', () => {
        protocol.maxEncodingLayers = 5;
        protocol.decoders.identity = sinon.stub().returns(identityMock);
        request.headers['content-encoding'] = 'gzip, deflate, iDeNtItY, DEFlate, GzIp';

        onRequest(request, response);
        should(request.pipe).calledOnce();
        should(protocol.decoders.gzip).calledTwice();
        should(protocol.decoders.deflate).calledTwice();
        should(protocol.decoders.identity).calledOnce();

        // testing the pipe chain
        should(request.pipe).calledWith(gunzipMock);
        should(gunzipMock.pipe.firstCall).calledWith(inflateMock);
        should(inflateMock.pipe.firstCall).calledWith(identityMock);
        should(identityMock.pipe.firstCall).calledWith(inflateMock);
        should(inflateMock.pipe.secondCall).calledWith(gunzipMock);
        should(gunzipMock.pipe.secondCall).calledWith(sinon.match.instanceOf(Writable));
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

        should(request.pipe).calledOnce().calledWith(sinon.match.instanceOf(HttpFormDataStream));
        const writable = request.pipe.firstCall.args[0];

        writable.write('foo=bar&baz=1234');
        writable.emit('finish');
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

        should(request.pipe).calledOnce().calledWith(sinon.match.instanceOf(HttpFormDataStream));
        const writable = request.pipe.firstCall.args[0];

        writable.write(multipart);
        writable.emit('finish');
      });

      it('should reply with error if the actual data sent exceeds the maxRequestSize', done => {
        protocol.maxRequestSize = 2;
        request.headers['content-encoding'] = 'gzip';
        onRequest(request, response);

        should(request.pipe).calledOnce().calledWith(gunzipMock);
        should(gunzipMock.pipe).calledOnce().calledWith(sinon.match.instanceOf(Writable));
        const writable = gunzipMock.pipe.firstCall.args[0];

        sinon.spy(writable, 'removeAllListeners');
        sinon.spy(writable, 'end');

        should(request.on).calledOnce().calledWith('error', sinon.match.func);
        const errorHandler = request.on.firstCall.args[1];

        writable.on('error', error => {
          try {
            should(error).instanceOf(SizeLimitError).match({message: 'Maximum HTTP request size exceeded'});

            // called automatically when a pipe rejects a callback, but not
            // by our mock obviously
            errorHandler(error);

            should(request.unpipe).calledOnce();
            should(request.removeAllListeners).calledOnce();
            // should-sinon is outdated, so we cannot use it with calledAfter :-(
            should(request.removeAllListeners.calledAfter(request.unpipe)).be.true();
            should(request.resume).calledOnce();
            should(request.resume.calledAfter(request.removeAllListeners)).be.true();
            should(writable.removeAllListeners).calledOnce();
            should(writable.end).calledOnce();
            should(writable.end.calledAfter(writable.removeAllListeners)).be.true();

            // pipes should be closed manually
            should(gunzipMock.close).calledOnce();

            should(protocol._replyWithError)
              .be.calledWithMatch(/^[0-9a-z-]+$/, {
                url: request.url,
                method: request.method
              },
              response,
              {
                message: 'Maximum HTTP request size exceeded'
              });
            done();
          } catch (e) {
            done(e);
          }
        });

        writable.write('a slightly too big chunk');
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

        should(request.pipe).calledOnce().calledWith(sinon.match.instanceOf(HttpFormDataStream));
        const writable = request.pipe.firstCall.args[0];

        sinon.spy(writable, 'removeAllListeners');
        sinon.spy(writable, 'end');

        should(request.on).calledOnce().calledWith('error', sinon.match.func);

        writable.write(multipart);

        should(request.emit)
          .calledOnce()
          .calledWith('error', sinon.match.instanceOf(SizeLimitError));

        should(request.emit.firstCall.args[1].message).be.eql('Maximum HTTP file size exceeded');
      });
    });

    describe('#_sendRequest', () => {
      let payload;

      beforeEach(() => {
        payload = {
          requestId: 'requestId',
          url: 'url?pretty',
          method: 'getpostput',
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
          .be.calledWith(Buffer.from(JSON.stringify(expected, undefined, 2)));
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
          .be.calledWith(Buffer.from(JSON.stringify([{foo: 'bar'}])));
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
          .be.calledWithExactly(Buffer.from('content'));
      });

      it('should compress the outgoing message with deflate if asked to', () => {
        payload.headers = {'accept-encoding': 'identity, foo, bar, identity, qux, deflate, baz'};
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'deflate');
        should(zlibstub.deflate).calledOnce();
        should(zlibstub.gzip).not.called();
      });

      it('should compress the outgoing message with gzip if asked to', () => {
        payload.headers = {'accept-encoding': 'identity, foo, bar, identity, qux, gzip, baz'};
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
      });

      it('should not compress if no suitable algorithm is found within the accept-encoding list', () => {
        payload.headers = {'accept-encoding': 'identity, foo, bar, identity, qux, baz'};
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {});

        cb(result);

        should(response.setHeader).not.calledWith('Content-Encoding', sinon.match.string);
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).not.called();
      });

      it('should prefer gzip over deflate if both algorithm are accepted', () => {
        payload.headers = {'accept-encoding': 'deflate,deflate,DEFLATE,dEfLaTe, GZiP, DEFLATE,deflate'};
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
      });

      it('should reply with an error if compressing fails', () => {
        payload.headers = {'accept-encoding': 'gzip'};
        zlibstub.gzip.yields(new Error('foobar'));
        sinon.stub(protocol, '_replyWithError');
        protocol._sendRequest('connectionId', response, payload);

        const cb = kuzzle.router.http.route.firstCall.args[1];

        const result = new Request({});
        result.setResult('content', {});

        cb(result);

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch('connectionId',
            payload,
            response,
            {message: 'foobar'});

        should(protocol._replyWithError.firstCall.args[3]).be.instanceOf(BadRequestError);
        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
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

      const expected = (new Request(payload, {connectionId, error})).serialize();

      // likely to be different, and we do not care about it
      delete expected.data.timestamp;

      protocol._replyWithError(connectionId, payload, response, error);

      should(entrypoint.logAccess).be.calledOnce();
      should(entrypoint.logAccess.firstCall.args[0].serialize()).match(expected);

      should(response.writeHead)
        .be.calledOnce()
        .be.calledWith(123, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods' : 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Length, Content-Encoding, X-Kuzzle-Volatile'
        });
    });

    it('should remove pending request from clients', () => {
      const error = new Error('test');
      error.status = 'status';

      entrypoint.clients.connectionId = {};

      protocol._replyWithError('connectionId', {}, response, error);

      should(entrypoint.clients).be.empty();
    });
  });
});
