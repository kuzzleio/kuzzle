'use strict';

const zlib = require('zlib');

const sinon = require('sinon');
const should = require('should');
const mockRequire = require('mock-require');

const { KuzzleRequest } = require('../../../../lib/api/request');
const { BadRequestError } = require('../../../../lib/kerror/errors');
const HttpMessage = require('../../../../lib/core/network/protocols/httpMessage');
const ClientConnection = require('../../../../lib/core/network/clientConnection');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const uWSMock = require('../../../mocks/uWS.mock');
const EntryPointMock = require('../../../mocks/entrypoint.mock');

describe('core/network/protocols/http', () => {
  let HttpWs;
  let kuzzle;
  let entryPoint;
  let httpWs;

  before(() => {
    mockRequire('uWebSockets.js', uWSMock);
    HttpWs = mockRequire.reRequire('../../../../lib/core/network/protocols/http+websocket');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entryPoint = new EntryPointMock({
      maxRequestSize: '1MB',
      port: 7512,
      protocols: {
        http: {
          allowCompression: true,
          enabled: true,
          maxEncodingLayers: 3,
          maxFormFileSize: '1MB'
        },
        websocket: {
          enabled: true,
          idleTimeout: 60000,
          compression: false,
          rateLimit: 0,
        }
      }
    });

    httpWs = new HttpWs();
  });

  afterEach(() => {
    clearInterval(httpWs.nowInterval);
  });

  describe('http configuration & initialization', () => {
    it('should disable http if no configuration can be found', async () => {
      entryPoint.config.protocols.http = undefined;
      kuzzle.log.warn.resetHistory();

      await should(httpWs.init(entryPoint));

      should(httpWs.server.any).not.called();
      should(kuzzle.log.warn).calledWith('[http] no configuration found for http: disabling it');
    });

    it('should throw if "enabled" is not a boolean', async () => {
      for (const bad of [null, undefined, 'true', 123, 0, [], {}] ) {
        entryPoint.config.protocols.http.enabled = bad;

        await should(httpWs.init(entryPoint)).rejectedWith(`[http] "enabled" parameter: invalid value "${bad}" (boolean expected)`);
      }
    });

    it('should throw if "allowCompression" is not a boolean', async () => {
      for (const bad of [null, undefined, 'true', 123, 0, [], {}] ) {
        entryPoint.config.protocols.http.allowCompression = bad;

        await should(httpWs.init(entryPoint)).rejectedWith(`[http] "allowCompression" parameter: invalid value "${bad}" (boolean expected)`);
      }
    });

    it('should throw if "maxEncodingLayers" holds an invalid value', async () => {
      for (const bad of [null, undefined, '1', 0, true, [], {}]) {
        entryPoint.config.protocols.http.maxEncodingLayers = bad;

        await should(httpWs.init(entryPoint)).rejectedWith(`[http] "maxEncodingLayers" parameter: invalid value "${bad}" (integer >= 1 expected)`);
      }
    });

    it('should throw if "maxFormFileSize" holds an invalid value', async () => {
      for (const bad of [null, undefined, -1, true, [], {}, 'foobar']) {
        entryPoint.config.protocols.http.maxFormFileSize = bad;

        await should(httpWs.init(entryPoint)).rejectedWith(`[http] "maxFormFileSize" parameter: cannot parse "${bad}"`);
      }
    });
  });

  describe('http errors (not request ones)', () => {
    let connection;
    let message;

    beforeEach(async () => {
      await httpWs.init(entryPoint);

      connection = new ClientConnection('http', ['1.2.3.4'], 'foo');
      const req = new uWSMock.MockHttpRequest();
      message = new HttpMessage(connection, req);
    });

    it('should send an error with the right headers', () => {
      const error = new BadRequestError('ohnoes', 'foo.bar');
      const response = new uWSMock.MockHttpResponse();

      httpWs.httpSendError(message, response, error);

      should(response.cork).calledOnce();
      should(response.cork.calledBefore(response.writeStatus)).be.true();

      should(response.writeStatus).calledOnce().calledWith(Buffer.from('400'));
      should(response.writeStatus.calledBefore(response.writeHeader)).be.true();

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Headers'),
        Buffer.from(kuzzle.config.http.accessControlAllowHeaders));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Methods'),
        Buffer.from(kuzzle.config.http.accessControlAllowMethods));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Origin'),
        Buffer.from(kuzzle.config.http.accessControlAllowOrigin));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Content-Type'),
        Buffer.from('application/json'));

      should(response.writeHeader.calledBefore(response.end));

      should(response.end).calledOnce();
      should(JSON.parse(response.end.firstCall.args[0].toString())).match({
        id: 'foo.bar',
        status: 400,
      });

      should(entryPoint.removeConnection).calledOnce().calledWith(connection.id);
    });

    it('should wrap non Kuzzle errors', () => {
      const error = new Error('ohnoes');
      const response = new uWSMock.MockHttpResponse();

      httpWs.httpSendError(message, response, error);
      should(response.end).calledOnce();
      should(JSON.parse(response.end.firstCall.args[0].toString())).match({
        id: 'network.http.unexpected_error',
        message: /ohnoes/,
        status: 400,
      });
    });

    it('should discard the error if the client connection is aborted', () => {
      const response = new uWSMock.MockHttpResponse();

      response.aborted = true;

      httpWs.httpSendError(message, response, new Error('ohnoes'));

      should(entryPoint.removeConnection).calledOnce().calledWith(connection.id);
      should(response.cork).not.called();
      should(response.writeStatus).not.called();
      should(response.writeHeader).not.called();
      should(response.end).not.called();
    });
  });

  describe('message reception', () => {
    beforeEach(async () => {
      await httpWs.init(entryPoint);
      sinon.stub(httpWs, 'httpSendError');
    });

    it('should reject requests that are too large', () => {
      httpWs.maxRequestSize = 1024;
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-length': 1025,
      });

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.request_too_large',
        });
    });

    it('should reject requests with unhandled content types', () => {
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-type': 'oh/noes',
      });

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.unsupported_content',
        });
    });

    it('should reject requests with unhandled charsets', () => {
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-type': 'application/json; charset=utf-82',
      });

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.unsupported_charset',
        });
    });

    it('should reject huge requests lying about their content-length', () => {
      httpWs.maxRequestSize = 8;
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-length': 7,
      });

      httpWs.server._httpResponse._onData(Buffer.from('{"ahah":"i am a h4ck3r"}'));

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.request_too_large',
        });
    });

    it('should reject requests with too many encoding layers', () => {
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-encoding': 'gzip,gzip,gzip,gzip,gzip,gzip,gzip',
      });

      httpWs.server._httpResponse._onData(Buffer.from('foobar'), true);

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.too_many_encodings',
        });
    });

    it('should reject requests with an unhandled content encoding', () => {
      httpWs.server._httpOnMessage('get', '/', '', {
        'content-encoding': 'lol',
      });

      httpWs.server._httpResponse._onData(Buffer.from('foobar'), true);

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.unsupported_compression',
        });
    });

    it('should reject requests when failing to uncompress the payload', done => {
      httpWs.httpSendError.callsFake((message, response, error) => {
        try {
          should(entryPoint.newConnection).not.called();
          should(global.kuzzle.router.http.route).not.called();
          should(error.code).eql('Z_DATA_ERROR');
          done();
        }
        catch (e) {
          done(e);
        }
      });

      httpWs.server._httpOnMessage('get', '/', '', {
        'content-encoding': 'gzip',
      });

      httpWs.server._httpResponse._onData(Buffer.from('foobar'), true);
    });

    it('should be able to decode a compressed payload', done => {
      sinon
        .stub(httpWs, 'httpProcessRequest')
        .callsFake((response, message) => {
          try {
            should(message.content).match({ foo: 'bar' });
            done();
          }
          catch (e) {
            done(e);
          }
        });

      httpWs.server._httpOnMessage('get', '/', '', {
        'content-encoding': 'gzip,deflate,identity',
      });

      let payload = Buffer.from('{"foo":"bar"}');
      payload = zlib.gzipSync(payload);
      payload = zlib.deflateSync(payload);

      httpWs.server._httpResponse._onData(payload, true);
    });

    it('should be able to handle data submitted in chunks', () => {
      sinon.stub(httpWs, 'httpProcessRequest');

      httpWs.server._httpOnMessage('get', '/', '', {});

      httpWs.server._httpResponse._onData(Buffer.from('{"fo'), false);
      httpWs.server._httpResponse._onData(Buffer.from('o":'), false);
      httpWs.server._httpResponse._onData(Buffer.from('"ba'), false);
      httpWs.server._httpResponse._onData(Buffer.from('r"}'), true);

      should(httpWs.httpProcessRequest).calledOnce().calledWithMatch(
        httpWs.server._httpResponse,
        { content: { foo: 'bar' } });
    });

    it('should be able to handle requests without a payload', () => {
      sinon.stub(httpWs, 'httpProcessRequest');

      httpWs.server._httpOnMessage('get', '/', '', {});

      httpWs.server._httpResponse._onData(Buffer.from(''), true);

      should(httpWs.httpProcessRequest).calledOnce().calledWithMatch(
        httpWs.server._httpResponse,
        { content: null });
    });

    it('should reject malformed JSON content', () => {
      httpWs.server._httpOnMessage('get', '/', '', {});

      httpWs.server._httpResponse._onData(Buffer.from('{lol}'), true);

      should(entryPoint.newConnection).not.called();
      should(global.kuzzle.router.http.route).not.called();
      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.body_parse_failed',
        });
    });

    it('should be able to handle multipart/form-data requests', () => {
      sinon.stub(httpWs, 'httpProcessRequest');

      httpWs.server._httpOnMessage('get', '/', '', {
        'content-type': 'multipart/form-data; boundary=foo',
      });

      httpWs.server._httpResponse._onData(
        Buffer.from('--foo\r\nContent-Disposition: form-data; name="t"\r\n\r\nvalue\r\n--foo\r\nContent-Disposition: form-data; name="f"; filename="filename"\r\nContent-Type: application/octet-stream\r\n\r\nfoobar\r\n--foo--'),
        true);

      should(httpWs.httpProcessRequest).calledOnce().calledWithMatch(
        httpWs.server._httpResponse,
        {
          content: {
            f: {
              encoding: 'application/octet-stream',
              file: 'Zm9vYmFy',
              filename: 'filename',
            },
            t: 'value'
          }
        });
    });

    it('should reject multipart/form-data requests with too large files', () => {
      httpWs.maxFormFileSize = 2;

      httpWs.server._httpOnMessage('get', '/', '', {
        'content-type': 'multipart/form-data; boundary=foo',
      });

      httpWs.server._httpResponse._onData(
        Buffer.from('--foo\r\nContent-Disposition: form-data; name="f"; filename="filename"\r\nContent-Type: application/octet-stream\r\n\r\nfoobar\r\n--foo--'),
        true);

      should(httpWs.httpSendError).calledOnce().calledWithMatch(
        sinon.match.object,
        httpWs.server._httpResponse,
        {
          id: 'network.http.file_too_large',
        });
    });


    it('should be able to handle application/x-www-form-urlencoded requests', () => {
      sinon.stub(httpWs, 'httpProcessRequest');

      httpWs.server._httpOnMessage('get', '/', '', {
        'content-type': 'application/x-www-form-urlencoded',
      });

      httpWs.server._httpResponse._onData(Buffer.from('foo=bar&baz=qux'), true);

      should(httpWs.httpProcessRequest).calledOnce().calledWithMatch(
        httpWs.server._httpResponse,
        {
          content: {
            baz: 'qux',
            foo: 'bar',
          }
        });
    });

    it('should forward a well-formed request to the router', () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData(Buffer.from('{"controller":"foo","action":"bar"}'), true);

      should(entryPoint.newConnection).calledOnce();

      const response = httpWs.server._httpResponse;

      should(response.cork).calledOnce();
      should(response.cork.calledBefore(response.writeStatus)).be.true();

      should(response.writeStatus).calledOnce().calledWithMatch(Buffer.from('200'));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Headers'),
        Buffer.from(kuzzle.config.http.accessControlAllowHeaders));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Methods'),
        Buffer.from(kuzzle.config.http.accessControlAllowMethods));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Access-Control-Allow-Origin'),
        Buffer.from(kuzzle.config.http.accessControlAllowOrigin));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Content-Type'),
        Buffer.from('application/json'));

      should(response.writeHeader).calledWithMatch(
        Buffer.from('Content-Encoding'),
        Buffer.from('identity'));

      should(response.writeHeader.calledBefore(response.tryEnd));

      should(response.tryEnd).calledOnce();
      should(JSON.parse(response.tryEnd.firstCall.args[0].toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(entryPoint.removeConnection).calledOnce();
    });

    it('should compress the response with gzip if asked to', async () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {
        'accept-encoding': 'gzip',
      });
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;

      // the response is processed in background tasks, need to wait for it
      // to finish
      for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      should(response.tryEnd).calledOnce();

      let payload = response.tryEnd.firstCall.args[0];
      payload = zlib.gunzipSync(payload);

      should(JSON.parse(payload.toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(response.writeHeader)
        .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('gzip'));
    });

    it('should compress the response with deflate if asked to', async () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {
        'accept-encoding': 'deflate',
      });
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;

      // the response is processed in background tasks, need to wait for it
      // to finish
      for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      should(response.tryEnd).calledOnce();

      let payload = response.tryEnd.firstCall.args[0];
      payload = zlib.inflateSync(payload);

      should(JSON.parse(payload.toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(response.writeHeader)
        .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('deflate'));
    });

    it('should choose to compress the response with gzip if multiple algorithms are possible', async () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {
        'accept-encoding': 'deflate, deflate, deflate, identity, gzip, deflate',
      });
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;

      // the response is processed in background tasks, need to wait for it
      // to finish
      for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      should(response.tryEnd).calledOnce();

      let payload = response.tryEnd.firstCall.args[0];
      payload = zlib.gunzipSync(payload);

      should(JSON.parse(payload.toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(response.writeHeader)
        .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('gzip'));
    });

    it('should comply to the provided algorithm priorities provided in the headers', async () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {
        'accept-encoding': 'deflate;q=0.8, gzip;q=0.25, *=0',
      });
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;

      // the response is processed in background tasks, need to wait for it
      // to finish
      for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      should(response.tryEnd).calledOnce();

      let payload = response.tryEnd.firstCall.args[0];
      payload = zlib.inflateSync(payload);

      should(JSON.parse(payload.toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(response.writeHeader)
        .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('deflate'));
    });

    it('should fall back to not compressing if no suitable algorithm is found', async () => {
      const result = new KuzzleRequest({});
      result.setResult('yo');
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {
        'accept-encoding': 'br;q=0.8, compress;q=0.25',
      });
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;

      // the response is processed in background tasks, need to wait for it
      // to finish
      for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      should(response.tryEnd).calledOnce();

      should(JSON.parse(response.tryEnd.firstCall.args[0].toString())).match({
        error: null,
        result: 'yo',
        status: 200,
      });

      should(response.writeHeader)
        .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('identity'));
    });

    it('should fall back to not compressing if the payload could not be compressed with gzip', async () => {
      mockRequire('zlib', {
        gzip: sinon.stub().yields(new Error('foo')),
      });
      HttpWs = mockRequire.reRequire('../../../../lib/core/network/protocols/http+websocket');
      httpWs = new HttpWs();
      await httpWs.init(entryPoint);

      try {
        const result = new KuzzleRequest({});
        result.setResult('yo');
        kuzzle.router.http.route.yields(result);

        httpWs.server._httpOnMessage('get', '/', '', {
          'accept-encoding': 'gzip',
        });
        httpWs.server._httpResponse._onData('', true);

        const response = httpWs.server._httpResponse;

        // the response is processed in background tasks, need to wait for it
        // to finish
        for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        should(response.tryEnd).calledOnce();

        should(JSON.parse(response.tryEnd.firstCall.args[0].toString())).match({
          error: null,
          result: 'yo',
          status: 200,
        });

        should(response.writeHeader)
          .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('identity'));
      }
      finally {
        mockRequire.stop('zlib');
        HttpWs = mockRequire.reRequire('../../../../lib/core/network/protocols/http+websocket');
      }
    });

    it('should fall back to not compressing if the payload could not be compressed with deflate', async () => {
      mockRequire('zlib', {
        deflate: sinon.stub().yields(new Error('foo')),
      });
      HttpWs = mockRequire.reRequire('../../../../lib/core/network/protocols/http+websocket');
      httpWs = new HttpWs();
      await httpWs.init(entryPoint);

      try {
        const result = new KuzzleRequest({});
        result.setResult('yo');
        kuzzle.router.http.route.yields(result);

        httpWs.server._httpOnMessage('get', '/', '', {
          'accept-encoding': 'deflate',
        });
        httpWs.server._httpResponse._onData('', true);

        const response = httpWs.server._httpResponse;

        // the response is processed in background tasks, need to wait for it
        // to finish
        for (let i = 0; !response.tryEnd.calledOnce && i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        should(response.tryEnd).calledOnce();

        should(JSON.parse(response.tryEnd.firstCall.args[0].toString())).match({
          error: null,
          result: 'yo',
          status: 200,
        });

        should(response.writeHeader)
          .calledWithMatch(Buffer.from('Content-Encoding'), Buffer.from('identity'));
      }
      finally {
        mockRequire.stop('zlib');
        HttpWs = mockRequire.reRequire('../../../../lib/core/network/protocols/http+websocket');
      }
    });

    it('should not wrap a raw response to a standard Kuzzle Response object', () => {
      const result = new KuzzleRequest({});
      result.setResult('yo', { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString()).eql('yo');
    });

    it('should be able to handle empty raw responses', () => {
      const result = new KuzzleRequest({});
      result.setResult(null, { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString()).eql('');
    });

    it('should be able to handle JSON objects as raw responses', () => {
      const result = new KuzzleRequest({});
      result.setResult({foo: 'bar'}, { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString()).eql('{"foo":"bar"}');
    });

    it('should be able to handle Buffer objects as raw responses', () => {
      const result = new KuzzleRequest({});
      result.setResult(Buffer.from('foobar'), { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString()).eql('foobar');
    });

    it('should be able to handle stringified Buffer objects as raw responses', () => {
      const result = new KuzzleRequest({});
      result.setResult(JSON.stringify(Buffer.from('foobar')), { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString())
        .eql(JSON.stringify(Buffer.from('foobar')));
    });

    it('should be able to handle scalars as raw responses', () => {
      const result = new KuzzleRequest({});
      result.setResult(123.45, { raw: true });
      kuzzle.router.http.route.yields(result);

      httpWs.server._httpOnMessage('get', '/', '', {});
      httpWs.server._httpResponse._onData('', true);

      const response = httpWs.server._httpResponse;
      should(response.tryEnd).calledOnce();

      should(response.tryEnd.firstCall.args[0].toString()).eql('123.45');
    });
  });
});
