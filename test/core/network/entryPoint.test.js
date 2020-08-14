'use strict';

const root = '../../../';

const path = require('path');

const rewire = require('rewire');
const should = require('should');
const sinon = require('sinon');
const Bluebird = require('bluebird');
const mockrequire = require('mock-require');
const {
  Request,
  models: { RequestContext },
  errors: {
    InternalError: KuzzleInternalError,
    ServiceUnavailableError,
    PluginImplementationError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require(`${root}/test/mocks/kuzzle.mock`);
const EventEmitter = require('eventemitter3');

class FakeProtocol {
  constructor (name) {
    this.name = name;
    this.joinChannel = sinon.stub();
    this.leaveChannel = sinon.stub();
  }
}

class FakeHttpProtocol extends FakeProtocol {
  constructor () { super('http'); }
}

class FakeWebSocketProtocol extends FakeProtocol {
  constructor () { super('websocket'); }
}

class FakeMqttProtocol extends FakeProtocol {
  constructor () { super('mqtt'); }
}

class FakeInternalProtocol extends FakeProtocol {
  constructor () { super('internal'); }
}

describe('lib/core/core/network/entryPoint', () => {
  let kuzzle;
  let HttpMock;
  let WebSocketMock;
  let MqttMock;
  let InternalMock;
  let httpMock;
  let httpEventEmitter;
  let EntryPoint;
  let entrypoint;
  let winstonTransportConsole;
  let winstonTransportFile;
  let winstonTransportElasticsearch;
  let winstonTransportSyslog;
  let winstonFormatMock = {
    simple: sinon.stub().returns('format.simple'),
    json: sinon.stub().returns('format.json'),
    colorize: sinon.stub().returns('format.colorize'),
    timestamp: sinon.stub().returns('format.timestamp'),
    prettyPrint: sinon.stub().returns('format.prettyPrint')
  };

  before(() => {
    sinon.usingPromise(Bluebird);
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    HttpMock = FakeHttpProtocol;
    WebSocketMock = FakeWebSocketProtocol;
    MqttMock = FakeMqttProtocol;
    InternalMock = FakeInternalProtocol;

    httpEventEmitter = new EventEmitter();
    sinon.spy(httpEventEmitter, 'on');
    httpEventEmitter.listen = sinon.spy();

    httpMock = {
      createServer: sinon.stub().returns(httpEventEmitter)
    };

    winstonTransportConsole = sinon.spy();
    winstonTransportElasticsearch = sinon.spy();
    winstonTransportFile = sinon.spy();
    winstonTransportSyslog = sinon.spy();

    const network = `${root}/lib/core/network`;
    mockrequire(`${network}/protocols/http`, { HttpProtocol: HttpMock});
    mockrequire(`${network}/protocols/websocket`, WebSocketMock);
    mockrequire(`${network}/protocols/mqtt`, MqttMock);
    mockrequire(`${network}/protocols/internal`, InternalMock);

    mockrequire('http', httpMock);
    mockrequire('winston', {
      createLogger: sinon.stub(),
      transports: {
        Console: winstonTransportConsole,
        File: winstonTransportFile
      },
      format: winstonFormatMock
    });
    mockrequire('winston-elasticsearch', winstonTransportElasticsearch);
    mockrequire('winston-syslog', winstonTransportSyslog);

    // Bluebird.map forces a different context, preventing rewire to mock
    // "require"
    mockrequire('bluebird', {
      map: (arr, fn) => Promise.all(arr.map(e => {
        let result;
        try {
          result = fn(e);
        } catch (err) {
          return Promise.reject(err);
        }
        return result;
      })),
      resolve: sinon.stub().resolves(),
      timeout: sinon.stub().resolves(),
      catch: sinon.stub().resolves(),
      then: sinon.stub().resolves(),
      all: Bluebird.all
    });

    EntryPoint = mockrequire.reRequire(`${network}/entryPoint`);

    entrypoint = new EntryPoint(kuzzle);

    Object.defineProperty(entrypoint, 'logger', {
      enumerable: true,
      value: {
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy()
      }
    });

    for (const Class of [HttpMock, WebSocketMock, MqttMock, InternalMock]) {
      Class.prototype.init = sinon.stub().resolves(true);
    }

  });

  afterEach(() => {
    mockrequire.stopAll();
    for (const stub of ['prettyPrint', 'simple', 'json', 'colorize', 'timestamp']) {
      winstonFormatMock[stub].resetHistory();
    }
  });

  after(() => {
    mockrequire.stopAll();
  });

  describe('#dispatch', () => {
    it('should call _notify', () => {
      const data = {foo: 'bar'};

      entrypoint._notify = sinon.spy();
      entrypoint.dispatch('notify', data);

      should(entrypoint._notify)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('should call _broadcast', () => {
      const data = {foo: 'bar'};

      entrypoint._broadcast = sinon.spy();
      entrypoint.dispatch('broadcast', data);

      should(entrypoint._broadcast)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('should throw if the event is unknown', () => {
      return should(() => entrypoint.dispatch('foo', {}))
        .throw(KuzzleInternalError);
    });
  });

  describe('#execute', () => {
    it('should call the funnel and log the response', (done) => {
      kuzzle.funnel.execute.callsFake((request, cb) => cb(null, request));
      entrypoint.logAccess = sinon.spy();

      const request = new Request({});
      request.setResult({
        foo: 'bar'
      });

      entrypoint.execute(request, response => {
        should(entrypoint.logAccess)
          .be.calledOnce()
          .be.calledWith(request);

        should(response)
          .be.eql(request.response.toJSON());

        done();
      });
    });

    it('should try to return an error if one received without any response', (done) => {
      const error = new KuzzleInternalError('test');
      kuzzle.funnel.execute.callsFake((request, cb) => cb(error, request));

      const request = new Request({});
      entrypoint.execute(request, response => {
        should(response.content.error)
          .be.eql(error);

        done();
      });
    });

    it('should refuse incoming requests if shutting down', (done) => {
      entrypoint.dispatch('shutdown');

      const request = new Request({});
      entrypoint.execute(request, response => {
        should(response.status).eql(503);
        should(response.content.error)
          .be.an.instanceof(ServiceUnavailableError);

        done();
      });
    });
  });

  describe('#init', () => {
    it('should init the internal protocol', async () => {
      await entrypoint.init();

      should(entrypoint.protocols.get('internal').init).be.calledOnce();
    });
  });

  describe('#startListening', () => {
    beforeEach(async () => {
      await entrypoint.init();
      process.nextTick(() => httpEventEmitter.emit('listening'));
    });

    it('should call proper methods in order', async () => {
      entrypoint.initLogger = sinon.spy();
      entrypoint.loadMoreProtocols = sinon.stub().resolves();
      kuzzle.config.server.port = -42;

      await entrypoint.startListening();

      should(entrypoint.initLogger).be.calledOnce();

      should(entrypoint.httpServer).be.an.Object();
      should(httpMock.createServer).be.calledOnce();
      should(httpMock.createServer.firstCall.returnValue.listen)
        .be.calledOnce()
        .be.calledWith(kuzzle.config.server.port, kuzzle.config.server.host);

      should(entrypoint.protocols.get('http').init).be.calledOnce();
      should(entrypoint.protocols.get('websocket').init).be.calledOnce();
      should(entrypoint.protocols.get('mqtt').init).be.calledOnce();
      should(entrypoint.loadMoreProtocols).be.calledOnce();
      should(Array.from(entrypoint.protocols.keys())).be.length(4);
    });

    it('should not load disabled protocols', () => {
      MqttMock.prototype.init = sinon.stub().resolves(false);

      return entrypoint.startListening()
        .then(() => {
          should(entrypoint.protocols.get('http').init).be.calledOnce();
          should(entrypoint.protocols.get('websocket').init).be.calledOnce();
          should(entrypoint.protocols.get('internal').init).be.calledTwice();
          should(Array.from(entrypoint.protocols.keys())).be.length(3);
          should(entrypoint.protocols.get('mqtt')).be.undefined();
        });
    });

    it('should reject if the provided port is not an integer', () => {
      kuzzle.config.server.port = 'foobar';
      return should(entrypoint.startListening())
        .rejectedWith(KuzzleInternalError, {
          id: 'network.entrypoint.invalid_port',
          message: 'Invalid network port number: foobar.',
        });
    });

    it('should reject if an error occurs when loading protocols', () => {
      const error = new Error('test');

      sinon.stub(entrypoint, 'loadMoreProtocols').throws(error);

      return should(entrypoint.startListening()).rejectedWith(error);
    });
  });

  describe('#initLogger', () => {
    it('should support all available transports', () => {

      entrypoint.config.logs.transports = [{
        level: 'level',
        silent: true,
        colorize: true,
        timestamp: true,
        prettyPrint: true,
        depth: 'depth',
        format: 'simple'
      }];
      for (let i = 0; i < 3; i++) {
        entrypoint.config.logs.transports.push(Object.assign({}, entrypoint.config.logs.access));
      }

      entrypoint.config.logs.transports[0].transport = 'console';
      entrypoint.config.logs.transports[0].humanReadableUnhandledException = 'humanReadableUnhandledException';

      entrypoint.config.logs.transports[1].transport = 'file';
      Object.assign(entrypoint.config.logs.transports[1], {
        filename: 'filename',
        maxSize: 'maxSize',
        maxFiles: 'maxFiles',
        eol: 'eol',
        logstash: 'logstash',
        tailable: 'tailable',
        maxRetries: 'maxRetries',
        zippedArchive: 'zippedArchive'
      });

      entrypoint.config.logs.transports[2].transport = 'elasticsearch';
      Object.assign(entrypoint.config.logs.transports[2], {
        index: 'index',
        indexPrefix: 'indexPrefix',
        indexSuffixPattern: 'indexSuffixPattern',
        messageType: 'messageType',
        ensureMappingTemplate: 'ensureMappingTemplate',
        mappingTemplate: 'mappingTemplate',
        flushInterval: 'flushInterval',
        clientOpts: 'clientOpts'
      });

      entrypoint.config.logs.transports[3].transport = 'syslog';
      Object.assign(entrypoint.config.logs.transports[3], {
        host: 'host',
        port: 'port',
        protocol: 'protocol',
        path: 'path',
        pid: 'pid',
        facility: 'facility',
        localhost: 'localhost',
        type: 'type',
        app_name: 'app_name',
        eol: 'eol'
      });

      entrypoint.initLogger();

      should(winstonTransportConsole)
        .be.calledOnce()
        .be.calledWithMatch({
          level: 'level',
          silent: true,
          colorize: 'format.colorize',
          timestamp: 'format.timestamp',
          prettyPrint: 'format.prettyPrint',
          depth: 'depth',
          format: 'format.simple',
          humanReadableUnhandledException: 'humanReadableUnhandledException',
          stderrLevels: ['error', 'debug']
        });

      should(winstonFormatMock.colorize).calledOnce();
      should(winstonFormatMock.timestamp).calledOnce();
      should(winstonFormatMock.prettyPrint).calledOnce();
      should(winstonFormatMock.simple).calledOnce();
      // default format, so it should be called 3 times
      // (we used the "simple" format for the 1st transport)
      should(winstonFormatMock.json.callCount).be.eql(3);
    });

    it('should ignore badly configured transports', () => {
      const
        config = [{
          level: 'level',
          silent: 'silent',
          colorize: 'colorize',
          timestamp: 'timestamp',
          json: 'json',
          stringify: 'stringify',
          prettyPrint: 'prettyPrint',
          depth: 'depth',
          showLevel: 'showLevel'
        }];

      entrypoint.config.logs.transports = [Object.assign({}, config)];
      entrypoint.config.logs.transports.push(Object.assign({}, config));

      entrypoint.config.logs.transports[0].transport = 'foobar';
      Object.assign(entrypoint.config.logs.transports[0], {
        index: 'index',
        indexPrefix: 'indexPrefix',
        indexSuffixPattern: 'indexSuffixPattern',
        messageType: 'messageType',
        ensureMappingTemplate: 'ensureMappingTemplate',
        mappingTemplate: 'mappingTemplate',
        flushInterval: 'flushInterval',
        clientOpts: 'clientOpts'
      });

      entrypoint.config.logs.transports[1].transport = 'syslog';
      Object.assign(entrypoint.config.logs.transports[1], {
        host: 'host',
        port: 'port',
        protocol: 'protocol',
        path: 'path',
        pid: 'pid',
        facility: 'facility',
        localhost: 'localhost',
        type: 'type',
        app_name: 'app_name',
        eol: 'eol'
      });

      entrypoint.initLogger();

      should(winstonTransportSyslog)
        .be.calledOnce()
        .be.calledWithMatch({
          host: 'host',
          port: 'port',
          protocol: 'protocol',
          path: 'path',
          pid: 'pid',
          facility: 'facility',
          localhost: 'localhost',
          type: 'type',
          app_name: 'app_name',
          eol: 'eol'
        });
      should(kuzzle.log.error)
        .calledWith('Failed to initialize logger transport "foobar": unsupported transport. Skipped.');
    });
  });

  describe('#joinChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.joinChannel('channel', 'connectionId');

      for (const protocol of entrypoint.protocols.values()) {
        should(protocol.joinChannel).not.be.called();
      }
    });

    it('should call the connection protocol joinChannel method', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        joinChannel: sinon.spy()
      });

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.get('protocol').joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        joinChannel: sinon.stub().throws(error)
      });

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.get('protocol').joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.log.error)
        .be.calledWith('[join] protocol protocol failed: test');
    });
  });

  describe('#leaveChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.leaveChannel('channel', 'connectionId');

      for (const protocol of entrypoint.protocols.values()) {
        should(protocol.leaveChannel).not.be.called();
      }
    });

    it('should call the connection protocol leaveChannel method', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        leaveChannel: sinon.spy()
      });

      entrypoint.leaveChannel('channel', 'connectionId');

      should(entrypoint.protocols.get('protocol').leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        leaveChannel: sinon.stub().throws(error)
      });

      entrypoint.leaveChannel('channel', 'connectionId');

      should(entrypoint.protocols.get('protocol').leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.log.error)
        .be.calledWith('[leave channel] protocol protocol failed: test');
    });

  });

  describe('#loadMoreProtocols', () => {
    const protocolDir = path.join(__dirname, `${root}/protocols/enabled`);
    const entryPointDir = `${root}/lib/core/network/entryPoint`;

    it('should load plugins as Node.js modules', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['one', 'two']),
        statSync: sinon.stub().returns({isDirectory: () => true})
      });

      mockrequire(path.join(protocolDir, 'one/manifest.json'), { name: 'foo', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire(path.join(protocolDir, 'two/manifest.json'), { name: 'bar', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const requireStub = sinon.stub().returns(function () {
        this.init = sinon.spy();
      });

      return Rewired.__with__({ require: requireStub })(() => {
        const ep = new Rewired(kuzzle);
        return ep.loadMoreProtocols();
      })
        .then(() => should(requireStub).be.calledTwice());
    });

    it('should throw if there is no manifest.json file', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['protocol']),
        statSync: sinon.stub().returns({isDirectory: () => true})
      });

      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const
        requireStub = sinon.stub().returns(function () {
          this.init = sinon.spy();
        });

      return should(Rewired.__with__({ require: requireStub })(() => {
        const ep = new Rewired(kuzzle);
        return ep.loadMoreProtocols();
      })).rejectedWith(PluginImplementationError, {
        id: 'plugin.manifest.cannot_load'
      });
    });

    it('should log and reject if an error occured', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['protocol']),
        statSync: sinon.stub().returns({isDirectory: () => true})
      });

      mockrequire(
        path.join(protocolDir, 'protocol/manifest.json'),
        { name: 'foo', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const requireStub = sinon.stub().returns(function () {
        this.init = sinon.stub().throws(Error('test'));
      });

      return Rewired.__with__({
        require: requireStub
      })(() => {
        const ep = new Rewired(kuzzle);

        return should(ep.loadMoreProtocols()).be.rejectedWith('test');
      });
    });
  });

  describe('#newConnection', () => {
    let connection;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'protocol',
        headers: 'headers'
      };
    });

    it('should add the connection to the store and call kuzzle router', () => {
      entrypoint.newConnection(connection);

      should(entrypoint._clients).have.value('connectionId', connection);

      should(kuzzle.router.newConnection)
        .be.calledOnce()
        .be.calledWithMatch(new RequestContext({connection}));
    });

    it('should dispatch connection:new event', () => {
      entrypoint.newConnection(connection);

      should(kuzzle.emit).be.calledWithMatch('connection:new', connection);
    });
  });

  describe('#removeConnection', () => {
    let connection;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'protocol',
        headers: 'headers'
      };

      entrypoint._clients.set(connection.id, connection);
    });

    it('should remove the connection from the store and call kuzzle router', () => {
      entrypoint.removeConnection(connection.id);

      should(kuzzle.router.removeConnection)
        .be.calledOnce()
        .be.calledWithMatch(new RequestContext({ connection }));
      should(entrypoint._clients).not.have.keys(connection.id);
    });

    it('should dispatch connection:remove event', () => {
      entrypoint.removeConnection(connection.id);

      should(kuzzle.emit).be.calledWithMatch(
        'connection:remove',
        {
          id: 'connectionId',
          protocol: 'protocol',
          headers: 'headers'
        });
    });
  });

  describe('#logAccess', () => {
    beforeEach(() => {
      entrypoint.logger = {
        info: sinon.spy()
      };
      entrypoint.anonymousUserId = '-1';
    });

    it('should use the request context if the connection has dropped', () => {
      const request = new Request(
        {controller: 'controller', action: 'action'},
        {
          connectionId: '-1',
          token: { userId: '-1' },
          protocol: 'foobar'
        });

      entrypoint.logAccess(request);

      should(entrypoint.logger.info)
        .calledOnce()
        .calledWithMatch(/^- - \(anonymous\) \[.*?\] "DO \/controller\/action FOOBAR" \d{3} \d{3} - -$/);
    });

    it('should forward the params to the logger when using "logstash" format output', () => {
      const
        connection = {foo: 'bar' },
        request = new Request({foo: 'bar'}, {connectionId: 'connectionId'}),
        error = new KuzzleInternalError('test');

      error.status = 444;
      request.setError(error);

      entrypoint._clients.set('connectionId', connection);
      entrypoint.config.logs.accessLogFormat = 'logstash';

      entrypoint.logAccess(request);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch({
          connection,
          request: request.input,
          extra: null,
          error: error,
          status: 444
        });
    });

    it('should output combined logs from an http request', () => {
      const
        connection = {
          protocol: 'HTTP/1.1',
          headers: {
            authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJhZG1pbiIsImlhdCI6MTQ4MjE3MDQwNywiZXhwIjoxNDgyMTg0ODA3fQ.SmLTFuIPsVuA8Pgpf9XONW2RtxcHjQffthNZ5Er4L4s',
            referer: 'http://referer.com',
            'user-agent': 'user agent'
          },
          ips: ['1.1.1.1', '2.2.2.2']
        },
        extra = {
          url: 'url',
          method: 'METHOD'
        },
        request = new Request({
          index: 'index',
          collection: 'collection'
        }, {
          connectionId: 'connectionId'
        });

      request.status = 444;

      entrypoint._clients.set('connectionId', connection);
      entrypoint.config.logs.accessLogFormat = 'combined';
      entrypoint.config.logs.accessLogIpOffset = 1;

      entrypoint.logAccess(request, extra);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^1\.1\.1\.1 - admin \[\d\d\/[A-Z][a-z]{2}\/\d{4}:\d\d:\d\d:\d\d [+-]\d{4}] "METHOD url HTTP\/1\.1" 444 283 "http:\/\/referer.com" "user agent"$/);
    });

    it('should extract the user from Basic auth header', () => {
      const
        connection = {
          protocol: 'HTTP/1.0',
          headers: {
            authorization: 'Zm9vOmJhcg==' // base64('foo:bar')
          },
          ips: ['1.1.1.1']
        },
        extra = {
          url: 'url',
          method: 'GET'
        },
        request = new Request({}, {connectionId: 'connectionId'}),
        result = {
          raw: true,
          content: 'test'
        };

      request.setResult({foo: 'bar'}, result);

      entrypoint.config.logs.accessLogFormat = 'combined';
      entrypoint._clients.set('connectionId', connection);

      entrypoint.logAccess(request, extra);

      should(entrypoint.logger.info)
        .be.calledWithMatch(/^1\.1\.1\.1 - foo \[/);
    });

    it('should extract the user from a JWT', () => {
      const
        connection = {
          protocol: 'websocket',
          headers: {
          },
          ips: ['ip']
        },
        request = new Request({
          controller: 'controller',
          action: 'action',
          jwt: 'token.eyJfaWQiOiJmb28ifQ==' // base64("{'_id':'foo'}")
        }, {connection});

      entrypoint.logAccess(request);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^ip - foo \[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}] "DO \/controller\/action WEBSOCKET" \d+ \d+ - -$/);
    });

    it('should handle the case of a user that cannot be extracted from http headers', () => {
      const
        connection = {
          protocol: 'HTTP/1.0',
          headers: {
            authorization: 'Bearer invalid'
          },
          ips: ['ip']
        },
        extra = {
          url: 'url',
          method: 'GET'
        },
        request = new Request({}, {connectionId: 'connectionId'}),
        result = {
          raw: true,
          status: 300,
          content: 'test'
        };

      request.setResult({foo: 'bar'}, result);

      entrypoint.config.logs.accessLogFormat = 'combined';
      entrypoint._clients.set('connectionId', connection);

      entrypoint.logAccess(request, extra);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^ip - - \[\d\d\/[A-Z][a-z]{2}\/\d{4}:\d\d:\d\d:\d\d [+-]\d{4}] "GET url HTTP\/1.0" 300 113 - -$/);
    });

    it('should handle the case of a user that cannot be extracted from a jwt', () => {
      const
        connection = {
          protocol: 'websocket',
          headers: {},
          ips: ['ip']
        },
        request = new Request({
          timestamp: 'timestamp',
          requestId: 'requestId',
          jwt: 'invalid',
          controller: 'controller',
          action: 'action',
          index: 'index',
          collection: 'collection',
          _id: 'id',
          foo: 'bar'
        }, {
          connectionId: 'connectionId'
        }),
        result = {
          raw: true,
          content: 'test'
        };

      request.setResult({foo: 'bar'}, result);

      entrypoint.config.logs.accessLogFormat = 'combined';
      entrypoint._clients.set('connectionId', connection);

      entrypoint.logAccess(request);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^ip - - \[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}] "DO \/controller\/action\/index\/collection\/id\?timestamp=timestamp&requestId=requestId&foo=bar WEBSOCKET" 200 86 - -$/);
    });

    it('should use the already verified user from the request, if available', () => {
      const request = new Request({
        controller: 'controller',
        action: 'action',
        index: 'index',
        collection: 'collection'
      }, {
        token: {
          userId: 'foobar'
        },
        connection: {
          protocol: 'websocket',
          headers: {},
          ips: ['ip']
        }
      });

      entrypoint.logAccess(request);

      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^ip - foobar \[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}] "DO \/controller\/action\/index\/collection WEBSOCKET" 102 295 - -$/);
    });
  });

  describe('#_broadcast', () => {
    it('should call underlying protocols and log errors', () => {
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = new Map([
        ['one', {
          broadcast: sinon.spy()
        }],
        ['two', {
          broadcast: sinon.spy()
        }],
        ['three', {
          broadcast: sinon.stub().throws(error)
        }]
      ]);

      entrypoint._broadcast('data');

      should(entrypoint.protocols.get('one').broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(entrypoint.protocols.get('two').broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(kuzzle.log.error).be.calledOnce();
    });
  });

  describe('#_notify', () => {
    it('should call underlying protocols and log errors', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = new Map([
        ['protocol', {
          notify: sinon.stub()
        }]
      ]);

      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(entrypoint.protocols.get('protocol').notify)
        .be.calledOnce()
        .be.calledWith({
          connectionId: 'connectionId',
          content: 'data'
        });

      entrypoint.protocols.get('protocol').notify.throws(error);
      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(kuzzle.log.error).be.calledOnce();
    });
  });
});
