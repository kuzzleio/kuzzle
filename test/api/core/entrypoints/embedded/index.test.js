'use strict';

const
  Bluebird = require('bluebird'),
  {
    InternalError: KuzzleInternalError,
    ServiceUnavailableError
  } = require('kuzzle-common-objects').errors,
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  mockrequire = require('mock-require'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon');

describe('lib/core/api/core/entrypoints/embedded/index', () => {
  let
    kuzzle,
    httpMock,
    EntryPoint,
    entrypoint,
    winstonTransportConsole,
    winstonTransportFile,
    winstonTransportElasticsearch,
    winstonTransportSyslog;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    const initStub = function () { this.init = sinon.stub(); }; // eslint-disable-line no-invalid-this

    httpMock = {
      createServer: sinon.stub().returns({
        listen: sinon.spy()
      })
    };
    winstonTransportConsole = sinon.spy();
    winstonTransportElasticsearch = sinon.spy();
    winstonTransportFile = sinon.spy();
    winstonTransportSyslog = sinon.spy();

    mockrequire('../../../../../lib/api/core/entrypoints/embedded/protocols/http', initStub);
    mockrequire('../../../../../lib/api/core/entrypoints/embedded/protocols/websocket', initStub);
    mockrequire('../../../../../lib/api/core/entrypoints/embedded/protocols/socketio', initStub);

    mockrequire('http', httpMock);
    mockrequire('winston', {
      Logger: sinon.spy(),
      transports: {
        Console: winstonTransportConsole,
        File: winstonTransportFile
      }
    });
    mockrequire('winston-elasticsearch', winstonTransportElasticsearch);
    mockrequire('winston-syslog', winstonTransportSyslog);

    EntryPoint = mockrequire.reRequire('../../../../../lib/api/core/entrypoints/embedded');

    entrypoint = new EntryPoint(kuzzle);

    Object.defineProperty(entrypoint, 'log', {
      enumerable: true,
      value: {
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy()
      }
    });
  });

  afterEach(() => {
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
      kuzzle.funnel.execute = (request, cb) => cb(null, request);
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
      kuzzle.funnel.execute = (request, cb) => cb(error, request);

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
    it('should call proper methods in order', () => {
      entrypoint.initLogger = sinon.spy();
      entrypoint.loadMoreProtocols = sinon.stub().returns(Bluebird.resolve());

      return entrypoint.init()
        .then(() => {
          should(entrypoint.initLogger)
            .be.calledOnce();

          should(entrypoint.httpServer)
            .be.an.Object();
          should(httpMock.createServer)
            .be.calledOnce();
          should(httpMock.createServer.firstCall.returnValue.listen)
            .be.calledOnce()
            .be.calledWith(kuzzle.config.server.port, kuzzle.config.server.host);

          should(entrypoint.protocols.http.init)
            .be.calledOnce();
          should(entrypoint.protocols.websocket.init)
            .be.calledOnce();
          should(entrypoint.protocols.socketio.init)
            .be.calledOnce();

          should(entrypoint.loadMoreProtocols)
            .be.calledOnce();
        });
    });

    it('should log and reject if an error occured', () => {
      const error = new Error('test');

      entrypoint.loadMoreProtocols = sinon.stub().throws(error);

      return entrypoint.init()
        .then(() => {
          throw new Error('should not happen');
        })
        .catch(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledOnce()
            .be.calledWith('log:error', error);
        });
    });
  });

  describe('#initLogger', () => {
    it('should support all available transports', () => {
      entrypoint.config.logs.transports = [{
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
          silent: 'silent',
          colorize: 'colorize',
          timestamp: 'timestamp',
          json: 'json',
          stringify: 'stringify',
          prettyPrint: 'prettyPrint',
          depth: 'depth',
          showLevel: 'showLevel',
          humanReadableUnhandledException: 'humanReadableUnhandledException'
        });
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
        }],
        Rewired = rewire('../../../../../lib/api/core/entrypoints/embedded'),
        errorStub = sinon.stub();

      Rewired.__with__({
        console: {
          error: errorStub
        }
      })(() => {
        const rewiredProxy = new Rewired(kuzzle);

        rewiredProxy.config.logs.transports = [Object.assign({}, config)];
        rewiredProxy.config.logs.transports.push(Object.assign({}, config));

        rewiredProxy.config.logs.transports[0].transport = 'foobar';
        Object.assign(rewiredProxy.config.logs.transports[0], {
          index: 'index',
          indexPrefix: 'indexPrefix',
          indexSuffixPattern: 'indexSuffixPattern',
          messageType: 'messageType',
          ensureMappingTemplate: 'ensureMappingTemplate',
          mappingTemplate: 'mappingTemplate',
          flushInterval: 'flushInterval',
          clientOpts: 'clientOpts'
        });

        rewiredProxy.config.logs.transports[1].transport = 'syslog';
        Object.assign(rewiredProxy.config.logs.transports[1], {
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

        rewiredProxy.initLogger();

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
        should(errorStub).calledWith('Failed to initialize logger transport "foobar": unsupported transport. Skipped.');
      });
    });
  });

  describe('#joinChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.joinChannel('channel', 'connectionId');
      for (const protoKey of Object.keys(entrypoint.protocols)) {
        const protocol = entrypoint.protocols[protoKey];
        should(protocol.leaveChannel)
          .have.callCount(0);
      }
    });

    it('should call the connection protocol joinChannel method', () => {
      entrypoint.clients.connectionId = {
        protocol: 'protocol'
      };
      entrypoint.protocols.protocol = {
        joinChannel: sinon.spy()
      };

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.protocol.joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint.clients.connectionId = {protocol: 'protocol'};
      entrypoint.protocols.protocol = {
        joinChannel: sinon.stub().throws(error)
      };

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.protocol.joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.pluginsManager.trigger)
        .be.calledWith('log:error', '[join] protocol protocol failed: test');
    });
  });

  describe('#leaveChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.leaveChannel('channel', 'connectionId');
      for (const protoKey of Object.keys(entrypoint.protocols)) {
        const protocol = entrypoint.protocols[protoKey];
        should(protocol.leaveChannel)
          .have.callCount(0);
      }
    });

    it('should call the connection protocol leaveChannel method', () => {
      entrypoint.clients.connectionId = {protocol: 'protocol'};
      entrypoint.protocols.protocol = {
        leaveChannel: sinon.spy()
      };

      entrypoint.leaveChannel('channel', 'connectionId');
      should(entrypoint.protocols.protocol.leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint.clients.connectionId = {protocol: 'protocol'};
      entrypoint.protocols.protocol = {
        leaveChannel: sinon.stub().throws(error)
      };

      entrypoint.leaveChannel('channel', 'connectionId');
      should(entrypoint.protocols.protocol.leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.pluginsManager.trigger)
        .be.calledWith('log:error', '[leave channel] protocol protocol failed: test');
    });

  });

  describe('#loadMoreProtocols', () => {
    it('should load plugins as NodeJS modules and simple require-ables', () => {
      mockrequire('fs', {
        existsSync: sinon.stub().returns(true),
        readdirSync: sinon.stub().returns(['one', 'two']),
        statSync: sinon.stub().returns({isDirectory: () => true})
      });

      mockrequire.reRequire('../../../../../lib/api/core/entrypoints/embedded');
      const Rewired = rewire('../../../../../lib/api/core/entrypoints/embedded');

      const requireStub = sinon.stub().returns(function () {
        this.init = sinon.spy();
      });

      return Rewired.__with__({
        require: requireStub
      })(() => {
        const ep = new Rewired(kuzzle);

        ep.loadMoreProtocols();

        should(requireStub)
          .be.calledTwice();

      });
    });
  });

  describe('#newConnection', () => {
    it('should add the connection to the store and call kuzzle router', () => {
      const connection = {
        id: 'connectionId',
        protocol: 'protocol',
        headers: 'headers'
      };
      entrypoint.newConnection(connection);

      should(entrypoint.clients.connectionId)
        .eql(connection);

      should(kuzzle.router.newConnection)
        .be.calledOnce()
        .be.calledWithMatch(new RequestContext({
          connectionId: connection.id,
          protocol: connection.protocol,
          headers: connection.headers
        }));
    });
  });

  describe('#logAccess', () => {
    beforeEach(() => {
      entrypoint.logger = {
        info: sinon.spy()
      };
    });

    it('should trigger an warn log if no connection could be found', () => {
      entrypoint.logAccess(new Request({}, {connectionId: '-1'}));

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:warn', '[access log] No connection retrieved for connection id: -1\n' +
        'Most likely, the connection was closed before the response was received.');

      should(entrypoint.logger.info)
        .have.callCount(0);
    });

    it('should forward the params to the logger when using "logstash" format output', () => {
      const
        connection = {foo: 'bar' },
        request = new Request({foo: 'bar'}, {connectionId: 'connectionId'}),
        error = new KuzzleInternalError('test');

      error.status = 444;
      request.setError(error);

      entrypoint.clients.connectionId = connection;
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

      entrypoint.clients.connectionId = connection;
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
      entrypoint.clients.connectionId = connection;

      entrypoint.logAccess(request, extra);

      should(entrypoint.logger.info)
        .be.calledWithMatch(/^1\.1\.1\.1 - foo \[/);
    });

    it('should log a warning if the user could not be extracted from http headers', () => {
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
      entrypoint.clients.connectionId = connection;

      entrypoint.logAccess(request, extra);

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:warn', 'Unable to extract user from authorization header: Bearer invalid');
      should(entrypoint.logger.info)
        .be.calledOnce()
        .be.calledWithMatch(/^ip - - \[\d\d\/[A-Z][a-z]{2}\/\d{4}:\d\d:\d\d:\d\d [+-]\d{4}] "GET url HTTP\/1.0" 300 113 - -$/);
    });

    it('should log a warning if the user could not be extracted from jwt token', () => {
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
      entrypoint.clients.connectionId = connection;

      entrypoint.logAccess(request);

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:warn', 'Unable to extract user from jwt token: invalid');
    });
  });

  describe('#_broadcast', () => {
    it('should call underlying protocols and log errors', () => {
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = {
        one: {
          broadcast: sinon.spy()
        },
        two: {
          broadcast: sinon.spy()
        },
        three: {
          broadcast: sinon.stub().throws(error)
        }
      };

      entrypoint._broadcast('data');

      should(entrypoint.protocols.one.broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(entrypoint.protocols.two.broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:error');
    });
  });

  describe('#_notify', () => {
    it('should call underlying protocols and log errors', () => {
      entrypoint.clients.connectionId = {protocol: 'protocol'};
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = {
        protocol: {
          notify: sinon.stub()
        }
      };

      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(entrypoint.protocols.protocol.notify)
        .be.calledOnce()
        .be.calledWith({
          connectionId: 'connectionId',
          content: 'data'
        });

      entrypoint.protocols.protocol.notify.throws(error);
      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:error');
    });

  });
});
