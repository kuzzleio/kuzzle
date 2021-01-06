'use strict';

const root = '../../../..';

const mockrequire = require('mock-require');

const HttpFormDataStream = require('../../../../lib/core/network/service/httpFormDataStream');
const EntryPoint = require('../../../../lib/core/network/entryPoint');
const ClientConnection = require('../../../../lib/core/network/clientConnection');
const { HttpMessage } = require('../../../../lib/core/network/protocols/http');
const KuzzleMock = require('../../../../test/mocks/kuzzle.mock');
const should = require('should');
const sinon = require('sinon');
const { Writable } = require('stream');
const errorMatcher = require('../../../../test/util/errorMatcher');
const {
  Request,
  SizeLimitError,
  BadRequestError
} = require('../../../../index');

const kerror = require('../../../../lib/kerror').wrap('network', 'http');

describe('/lib/core/network/protocols/http', () => {
  const gunzipMock = sinon.stub();
  const inflateMock = sinon.stub();
  const identityMock = sinon.stub();
  const zlibstub = {
    gzip: sinon.stub(),
    deflate: sinon.stub(),
    createGunzip: sinon.stub().returns(gunzipMock),
    createInflate: sinon.stub().returns(inflateMock)
  };
  let HttpProtocol;
  let kuzzle;
  let entrypoint;
  let protocol;
  let response;

  before(() => {
    [gunzipMock, inflateMock, identityMock].forEach(m => {
      m.pipe = sinon.stub();
      m.on = sinon.stub();
      m.close = sinon.stub();
    });
    mockrequire('zlib', zlibstub);
    HttpProtocol = mockrequire
      .reRequire(`${root}/lib/core/network/protocols/http`)
      .HttpProtocol;
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

    entrypoint = new EntryPoint();
    sinon.stub(entrypoint, 'execute');
    sinon.stub(entrypoint, 'newConnection');
    sinon.stub(entrypoint, 'removeConnection');
    entrypoint.httpServer = {
      listen: sinon.spy(),
      on: sinon.spy()
    };
    entrypoint.logger = {
      info: sinon.stub()
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

      return should(
        protocol.init(entrypoint)
      ).be.rejectedWith('Invalid "maxRequestSize" parameter value: expected a numeric value');
    });

    it('should throw if an invalid maxFormFileSize parameter is set', () => {
      entrypoint.config.protocols.http.maxFormFileSize = 'invalid';

      return should(
        protocol.init(entrypoint)
      ).be.rejectedWith('Invalid HTTP "maxFormFileSize" parameter value: expected a numeric value');
    });

    it('should throw if an invalid maxEncodingLayers parameter is set', () => {
      entrypoint.config.protocols.http.maxEncodingLayers = 'invalid';

      return should(
        protocol.init(entrypoint)
      ).be.rejectedWith('Invalid HTTP "maxEncodingLayers" parameter value: expected a numeric value');
    });

    it('should throw if an invalid allowCompression parameter is set', () => {
      entrypoint.config.protocols.http.allowCompression = 'foobar';

      return should(
        protocol.init(entrypoint)
      ).be.rejectedWith('Invalid HTTP "allowCompression" parameter value: expected a boolean value');
    });

    it('should configure the zlib decoders', () => {
      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.decoders).have.keys('deflate', 'gzip', 'identity');
          should(protocol.decoders.get('gzip')).eql(zlibstub.createGunzip);
          should(protocol.decoders.get('deflate')).eql(zlibstub.createInflate);
          should(protocol.decoders.get('identity')).be.a.Function();
          should(protocol.decoders.get('identity')('foobar')).eql(null);
        });
    });

    it('should set decoders with throwables if compression is disabled', () => {
      entrypoint.config.protocols.http.allowCompression = false;

      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.decoders).have.keys('deflate', 'gzip', 'identity');
          should(protocol.decoders.get('gzip')).Function().and.not.eql(gunzipMock);
          should(protocol.decoders.get('deflate')).Function().and.not.eql(inflateMock);
          should(protocol.decoders.get('identity')).be.a.Function();
          should(() => protocol.decoders.get('gzip')()).throw(BadRequestError, {
            id: 'network.http.compression_disabled'
          });
          should(() => protocol.decoders.get('deflate')()).throw(BadRequestError, {
            id: 'network.http.compression_disabled'
          });
          should(protocol.decoders.get('identity')('foobar')).eql(null);
        });
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

        return protocol.init(entrypoint)
          .then(() => {
            onRequest = protocol.server.on.firstCall.args[1];

            protocol._replyWithError = sinon.spy();
            protocol._sendRequest = sinon.spy();
          });
      });

      it('should complain if the request is too big', () => {
        request.headers['content-length'] = Infinity;

        onRequest(request, response);

        should(request.resume).be.calledOnce();

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(
            { path: request.url, url: request.url, method: request.method },
            response,
            {message: 'Maximum HTTP request size exceeded.'});
      });

      it('should handle json content', done => {
        request.headers['content-type'] = 'application/json charset=utf-8';

        protocol._sendRequest = (connection, resp, payload) => {
          try {
            should(connection).be.instanceOf(ClientConnection);
            should(payload.raw).eql('{"chunk":"chunk"}');
            should(payload.content).eql({chunk: 'chunk'});
            done();
          }
          catch(e) {
            done(e);
          }
        };

        onRequest(request, response);

        should(request.pipe)
          .calledOnce()
          .calledWith(sinon.match.instanceOf(Writable));

        const writable = request.pipe.firstCall.args[0];

        writable.write('{"chunk":');
        writable.write('"chun');
        writable.write('k"}');
        writable.emit('finish');
      });

      it('should handle compressed content', () => {
        request.headers['content-encoding'] = 'gzip';

        onRequest(request, response);

        should(request.pipe).calledOnce().calledWith(gunzipMock);
        should(gunzipMock.pipe).calledOnce().calledWith(sinon.match.instanceOf(Writable));
        should(protocol.decoders.get('identity')).not.called();
        should(protocol.decoders.get('deflate')).not.called();

        should(protocol.decoders.get('gzip')).calledOnce();
        should(gunzipMock.on).calledOnce().calledWith('error');
      });

      it('should reject if there are more compression layers than the configured limit', () => {
        protocol.maxEncodingLayers = 3;
        request.headers['content-encoding'] = 'identity, identity, identity, identity';

        onRequest(request, response);
        should(request.pipe).not.called();
        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(
            { path: request.url, url: request.url, method: request.method },
            response,
            {message: 'Too many encodings.'});
      });

      it('should reject if an unknown compression algorithm is provided', () => {
        request.headers['content-encoding'] = 'foobar';

        onRequest(request, response);

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(
            { path: request.url, url: request.url, method: request.method },
            response,
            {message: 'Unsupported compression algorithm "foobar".'});
      });

      it('should handle chain pipes properly to match multi-layered compression', () => {
        protocol.maxEncodingLayers = 5;
        protocol.decoders.set('identity', sinon.stub().returns(identityMock));
        request.headers['content-encoding'] = 'gzip, deflate, iDeNtItY, DEFlate, GzIp';

        onRequest(request, response);
        should(request.pipe).calledOnce();
        should(protocol.decoders.get('gzip')).calledTwice();
        should(protocol.decoders.get('deflate')).calledTwice();
        should(protocol.decoders.get('identity')).calledOnce();

        // testing the pipe chain
        should(request.pipe).calledWith(gunzipMock);
        should(gunzipMock.pipe.firstCall).calledWith(inflateMock);
        should(inflateMock.pipe.firstCall).calledWith(identityMock);
        should(identityMock.pipe.firstCall).calledWith(inflateMock);
        should(inflateMock.pipe.secondCall).calledWith(gunzipMock);
        should(gunzipMock.pipe.secondCall).calledWith(sinon.match.instanceOf(Writable));
      });

      it('should handle valid x-www-form-urlencoded request', done => {
        protocol._sendRequest = (connection, resp, payload) => {
          try {
            should(connection).instanceOf(ClientConnection);
            should(payload.content).be.eql({foo: 'bar', baz: '1234'});
            done();
          }
          catch (e) {
            done(e);
          }
        };

        request.headers['content-type'] = 'application/x-www-form-urlencoded';

        onRequest(request, response);

        should(request.pipe)
          .calledOnce()
          .calledWith(sinon.match.instanceOf(HttpFormDataStream));

        const writable = request.pipe.firstCall.args[0];

        writable.write('foo=bar&baz=1234');
        writable.emit('finish');
      });

      it('should handle valid multipart/form-data request', done => {
        protocol._sendRequest = (connection, resp, payload) => {
          should(connection).instanceOf(ClientConnection);
          should(payload.content).match({
            foo: 'bar',
            baz: {
              filename: 'test-multipart.txt',
              mimetype: 'text/plain',
              file: 'WU9MTwoKCg=='
            }
          });
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
        should(gunzipMock.pipe)
          .calledOnce()
          .calledWith(sinon.match.instanceOf(Writable));
        const writable = gunzipMock.pipe.firstCall.args[0];

        sinon.spy(writable, 'removeAllListeners');
        sinon.spy(writable, 'end');

        should(request.on).calledOnce().calledWith('error', sinon.match.func);
        const errorHandler = request.on.firstCall.args[1];

        writable.on('error', error => {
          try {
            should(error)
              .instanceOf(SizeLimitError)
              .match({message: 'Maximum HTTP request size exceeded.'});

            // called automatically when a pipe rejects a callback, but not
            // by our mock obviously
            errorHandler(error);

            should(request.unpipe).calledOnce();
            should(request.removeAllListeners).calledOnce();
            // should-sinon is outdated, so we cannot use it with calledAfter :-(
            should(request.removeAllListeners.calledAfter(request.unpipe))
              .be.true();
            should(request.resume).calledOnce();
            should(request.resume.calledAfter(request.removeAllListeners))
              .be.true();
            should(writable.removeAllListeners).calledOnce();
            should(writable.end).calledOnce();
            should(writable.end.calledAfter(writable.removeAllListeners))
              .be.true();

            // pipes should be closed manually
            should(gunzipMock.close).calledOnce();

            should(protocol._replyWithError)
              .be.calledWithMatch(
                { path: request.url, url: request.url, method: request.method },
                response,
                { message: 'Maximum HTTP request size exceeded.' });
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
          .be.calledWithMatch(
            { path: request.url, url: request.url, method: request.method },
            response,
            {
              id: 'network.http.unexpected_error',
              message: 'Caught an unexpected HTTP error: Unsupported content type: foo/bar'
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

        should(request.emit.firstCall.args[1].id).be.eql('network.http.file_too_large');
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
        return protocol.init(entrypoint);
      });

      it('should call kuzzle http router and send the client the response back', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        should(kuzzle.router.http.route).be.calledWith(payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult(
          'content',
          {
            status: 444,
            headers: { 'x-foo': 'bar' }
          });

        cb(result);

        should(response.writeHead)
          .be.calledOnce()
          .be.calledWithMatch(444, { 'x-foo': 'bar' });

        const expected = {
          action: null,
          collection: null,
          controller: null,
          error: null,
          index: null,
          requestId: 'requestId',
          result: 'content',
          status: 444,
          volatile: null,
        };

        should(response.end)
          .be.calledOnce()
          .be.calledWith(Buffer.from(JSON.stringify(expected, undefined, 2)));
      });

      it('should remove error stack traces if not in development', () => {
        const nodeEnv = process.env.NODE_ENV;

        for (const env of ['production', '', 'development']) {
          process.env.NODE_ENV = env;

          protocol._sendRequest({id: 'connectionId'}, response, payload);

          should(kuzzle.router.http.route).be.calledWith(payload);

          const
            cb = kuzzle.router.http.route.firstCall.args[1],
            result = new Request({});

          result.setError(kerror.get('unexpected_error', 'foobar'));

          cb(result);

          should(result.response.getHeader('Content-Length'))
            .eql(String(response.end.firstCall.args[0].length));

          should(response.writeHead)
            .be.calledOnce()
            .be.calledWithMatch(400, result.response.headers);

          const matcher = errorMatcher.fromMessage(
            'network',
            'http',
            'unexpected_error',
            'foobar');

          should(response.end)
            .be.calledOnce()
            .be.calledWith(sinon.match(matcher));

          response.writeHead.resetHistory();
          response.end.resetHistory();
        }

        process.env.NODE_ENV = nodeEnv;
      });

      it('should output buffer raw result', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          content = Buffer.from('test'),
          result = new Request({});

        result.setResult(content, {
          raw: true,
          status: 444
        });

        cb(result);

        // Buffer.from(content) !== content
        const sent = response.end.firstCall.args[0];

        should(content.toString()).eql(sent.toString());

        should(result.response.getHeader('Content-Length'))
          .eql(String(sent.length));
      });

      it('should output a stringified buffer as a raw buffer result', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          content = JSON.parse(JSON.stringify(Buffer.from('test'))),
          result = new Request({});

        result.setResult(content, {
          raw: true,
          status: 444
        });

        cb(result);

        const sent = response.end.firstCall.args[0];

        should(sent).be.an.instanceof(Buffer);
        should(sent.toString()).eql('test');

        should(result.response.getHeader('Content-Length'))
          .eql(String(sent.length));
      });

      it('should output serialized JS objects marked as raw', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult([{foo: 'bar'}], {
          raw: true
        });

        cb(result);

        const expected = Buffer.from(JSON.stringify([{foo: 'bar'}]));

        should(response.end).be.calledWith(expected);
        should(result.response.getHeader('Content-Length'))
          .eql(String(expected.length));
      });

      it('should output scalar content as-is if marked as raw', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {
          raw: true
        });

        cb(result);

        const expected = Buffer.from('content');

        should(response.end)
          .be.calledOnce()
          .be.calledWithExactly(expected);

        should(result.response.getHeader('Content-Length'))
          .eql(String(expected.length));
      });

      it('should send a 0-length-content response if marked as raw and content is null', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);
        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult(null, {
          raw : true
        });

        cb(result);

        should(response.end).be.calledWith(Buffer.from(''));
        should(result.response.getHeader('Content-Length')).eql('0');
      });

      it('should compress the outgoing message with deflate if asked to', () => {
        payload.headers = {'accept-encoding': 'identity, foo, bar, identity, qux, deflate, baz'};
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'deflate');
        should(zlibstub.deflate).calledOnce();
        should(zlibstub.gzip).not.called();
      });

      it('should compress the outgoing message with gzip if asked to', () => {
        payload.headers = {
          'accept-encoding': 'identity, foo, bar, identity, qux, gzip, baz'
        };
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
      });

      it('should not compress if no suitable algorithm is found within the accept-encoding list', () => {
        payload.headers = {
          'accept-encoding': 'identity, foo, bar, identity, qux, baz'
        };
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {});

        cb(result);

        should(response.setHeader).not.calledWith(
          'Content-Encoding',
          sinon.match.string);
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).not.called();
      });

      it('should prefer gzip over deflate if both algorithm are accepted', () => {
        payload.headers = {
          'accept-encoding': 'deflate,deflate,DEFLATE,dEfLaTe, GZiP, DEFLATE,deflate'
        };
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {});

        cb(result);

        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
      });

      it('should reply with an error if compressing fails', () => {
        const error = new Error('foobar');

        payload.headers = {'accept-encoding': 'gzip'};
        zlibstub.gzip.yields(error);
        sinon.stub(protocol, '_replyWithError');
        protocol._sendRequest({id: 'connectionId'}, response, payload);

        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          result = new Request({});

        result.setResult('content', {});

        cb(result);

        should(protocol._replyWithError)
          .be.calledOnce()
          .be.calledWithMatch(
            {id: 'connectionId'},
            response,
            {id: 'network.http.unexpected_error'});

        should(response.setHeader).calledWith('Content-Encoding', 'gzip');
        should(zlibstub.deflate).not.called();
        should(zlibstub.gzip).calledOnce();
      });

      it('should overwrite the content-length even if one was set', () => {
        protocol._sendRequest({id: 'connectionId'}, response, payload);
        const
          cb = kuzzle.router.http.route.firstCall.args[1],
          request = new Request({}),
          result = 'foobar';

        request.setResult(result, {
          raw : true
        });

        request.response.setHeader(
          'Content-Length',
          'one does not simply set a content length');

        cb(request);

        should(response.end).be.calledWith(Buffer.from(result));
        should(request.response.getHeader('Content-Length'))
          .eql(String(result.length));
      });
    });
  });

  describe('#_replyWithError', () => {
    beforeEach(() => {
      entrypoint.logAccess = sinon.spy();
      return protocol.init(entrypoint);
    });

    it('should log the access and reply with error', () => {
      const
        connectionId = 'connectionId',
        payload = new HttpMessage({id: 'connectionId'}, {}),
        nodeEnv = process.env.NODE_ENV;

      for (const env of ['production', '', 'development']) {
        process.env.NODE_ENV = env;

        const
          kerr = kerror.get('unexpected_error', 'foobar'),
          matcher = errorMatcher.fromError(kerr),
          expected = (new Request(payload, {connectionId, error: kerr})).serialize();

        // likely to be different, and we do not care about it
        delete expected.data.timestamp;

        protocol._replyWithError(payload, response, new Error('foobar'));

        should(entrypoint.logAccess).be.calledOnce();
        should(entrypoint.logAccess.firstCall.args[0].serialize())
          .match(expected);

        should(response.end)
          .calledOnce()
          .calledWith(sinon.match(matcher));

        should(response.writeHead)
          .be.calledOnce()
          .be.calledWith(
            kerr.status,
            {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods' : 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type,Access-Control-Allow-Headers,Authorization,X-Requested-With,Content-Length,Content-Encoding,X-Kuzzle-Volatile',
              'Content-Length': String(response.end.firstCall.args[0].length)
            });

        entrypoint.logAccess.resetHistory();
        response.writeHead.resetHistory();
        response.end.resetHistory();
      }

      process.env.NODE_ENV = nodeEnv;
    });

    it('should remove pending request from clients', () => {
      const error = new Error('test');
      error.status = 'status';

      protocol._replyWithError(
        new HttpMessage({id: 'connectionId'}, {}),
        response,
        error);

      should(entrypoint.removeConnection).calledOnce().calledWith('connectionId');
    });
  });

  describe('#_createWritableStream', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should throw if Content-Type HTTP header is invalid', () => {
      const request = { headers: { 'content-type': 'application/toto'}};
      try {
        protocol._createWritableStream(request, {});
      } catch (e) {
        should(e).be.instanceOf(BadRequestError);
        should(e.id).be.equals('network.http.unexpected_error');
      }
    });
  });
});
