'use strict';

const root = '../../../..';

const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const { IncomingMessage } = require('http');
const EntryPoint = require(`${root}/lib/core/network/entryPoint`);
const KuzzleMock = require(`${root}/test/mocks/kuzzle.mock`);
const errorMatcher = require(`${root}/test/util/errorMatcher`);

describe('/lib/core/network/protocols/websocket', () => {
  let
    kuzzle,
    entrypoint,
    WebSocketProtocol,
    WebSocketServer,
    WebSocketSender,
    protocol;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoint = new EntryPoint();

    sinon.stub(entrypoint, 'newConnection');
    sinon.stub(entrypoint, 'removeConnection');

    WebSocketServer = sinon.spy(function () {
      this.on = sinon.spy();
    });

    WebSocketSender = {
      frame: sinon.stub().returnsArg(0)
    };

    mockrequire('ws', {
      Server: WebSocketServer,
      Sender: WebSocketSender
    });

    WebSocketProtocol = mockrequire.reRequire(`${root}/lib/core/network/protocols/websocket`);

    protocol = new WebSocketProtocol();
  });

  afterEach(() => {
    clearInterval(protocol.heartbeatInterval);
    clearInterval(protocol.idleSweepInterval);
    clearInterval(protocol.activityInterval);
    mockrequire.stopAll();
  });

  describe('#init', () => {
    it('should do nothing if the protocol is not enabled', () => {
      entrypoint.config.protocols.websocket.enabled = false;

      return protocol.init(entrypoint)
        .then(enabled => {
          should(protocol.server).be.null();
          should(enabled).be.false();
        });
    });

    it('should disable heartbeats if set to 0', () => {
      entrypoint.config.protocols.websocket.heartbeat = 0;

      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.heartbeatInterval).be.null();
        });
    });

    it('should launch a websocket server and bind events to it', () => {
      protocol.onConnection = sinon.spy();
      protocol.onServerError = sinon.spy();

      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.entryPoint).eql(entrypoint);
          should(protocol.heartbeatInterval).not.be.null();
          should(WebSocketServer).be.calledOnce();

          const server = WebSocketServer.firstCall.returnValue;
          should(server.on)
            .be.calledTwice()
            .be.calledWith('connection')
            .be.calledWith('error');

          const onConnectH = server.on.firstCall.args[1];
          onConnectH('test');
          should(protocol.onConnection)
            .be.calledOnce()
            .be.calledWith('test');

          const onErrorH = server.on.secondCall.args[1];
          onErrorH('test');
          should(protocol.onServerError)
            .be.calledOnce();
        });
    });
  });

  describe('#onServerError', () => {
    it('should forward the error to kuzzle logger', () => {
      return protocol.init(entrypoint)
        .then(() => {
          protocol.onServerError('test');
          should(kuzzle.log.error)
            .be.calledOnce()
            .be.calledWith('[websocket] An error has occured "undefined":\nundefined');
        });
    });
  });

  describe('#onConnection', () => {
    let
      socket,
      request,
      onClientSpy;

    beforeEach(() => {
      onClientSpy = sinon.spy();

      socket = {
        on: onClientSpy,
        close: sinon.stub()
      };

      request = new IncomingMessage();
      Object.assign(request, {
        socket: { remoteAddress: 'ip' },
        headers: { 'X-Foo': 'bar', 'x-forwarded-for': '1.1.1.1,2.2.2.2' }
      });

      return protocol.init(entrypoint)
        .then(() => {
          protocol.entryPoint.newConnection = sinon.spy();
        });
    });

    it('should do nothing if the request is for socketio', () => {
      request.url = '/socket.io/blah';
      protocol.onConnection(socket, request);

      should(protocol.entryPoint.newConnection).have.callCount(0);
    });

    it('should register the connection and attach events', () => {
      protocol.onClientDisconnection = sinon.spy();
      protocol.onClientMessage = sinon.spy();

      protocol.onConnection(socket, request);

      should(protocol.entryPoint.newConnection)
        .be.calledOnce()
        .be.calledWithMatch({
          protocol: protocol.name,
          ips: ['ip', '1.1.1.1', '2.2.2.2'],
          headers: request.headers
        });

      const
        connection = protocol.entryPoint.newConnection.firstCall.args[0],
        pooledConnection = protocol.connectionPool.get(connection.id);

      should(pooledConnection)
        .match({
          socket,
          alive: true,
          channels: new Set()
        });

      should(onClientSpy.callCount).eql(5);
      should(onClientSpy)
        .be.calledWith('close')
        .be.calledWith('error')
        .be.calledWith('message')
        .be.calledWith('ping')
        .be.calledWith('pong');

      {
        const onCloseH = onClientSpy.getCall(0).args[1];

        onCloseH('test');
        should(protocol.onClientDisconnection)
          .be.calledOnce()
          .be.calledWith(connection.id);
      }

      {
        const onErrorH = onClientSpy.getCall(1).args[1];

        onErrorH('anotherone');
        should(protocol.onClientDisconnection)
          .be.calledTwice();
      }

      {
        const onMessageH = onClientSpy.getCall(2).args[1];

        onMessageH('test');
        should(protocol.onClientMessage)
          .be.calledOnce()
          .be.calledWith(connection, 'test');
      }

      {
        const onPingH = onClientSpy.getCall(3).args[1];

        pooledConnection.alive = false;
        pooledConnection.lastActivity = -1;
        onPingH();
        should(pooledConnection.alive).be.true();
        should(pooledConnection.lastActivity).eql(protocol.activityTimestamp);
      }

      {
        const onPongH = onClientSpy.getCall(4).args[1];

        pooledConnection.alive = false;
        pooledConnection.lastActivity = -1;
        onPongH();
        should(pooledConnection.alive).be.true();
        should(pooledConnection.lastActivity).eql(protocol.activityTimestamp);
      }
    });

  });

  describe('#onClientDisconnection', () => {
    beforeEach(() => {
      return protocol.init(entrypoint)
        .then(() => {
          protocol.connectionPool = new Map([
            ['connectionId', {
              id: 'connectionId',
              channels: new Set(['c1', 'c2', 'c3'])
            }]
          ]);

          protocol.channels = new Map([
            ['c1', new Set(['foo', 'connectionId', 'bar'])],
            ['c2', new Set(['connectionId'])],
            ['c3', new Set(['connectionId'])]
          ]);
        });
    });

    it('should remove the client from its subscriptions', () => {
      protocol.onClientDisconnection('connectionId');
      should(entrypoint.removeConnection).calledOnce().calledWith('connectionId');

      should(protocol.channels).deepEqual(new Map([
        ['c1', new Set(['foo', 'bar'])]
      ]));
    });
  });

  describe('#onClientMessage', () => {
    let
      connection;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'websocket'
      };

      entrypoint.execute = sinon.spy();
      entrypoint.httpServer = {
        maxRequestSize: Infinity
      };

      return protocol.init(entrypoint)
        .then(() => {
          protocol.connectionPool = new Map([
            ['connectionId', { id: 'connectionId' } ]
          ]);
          protocol._send = sinon.spy();
        });
    });

    it('should do nothing if no data is given or if the connection is unknown', () => {
      protocol.onClientMessage({id: 'foo'});
      should(entrypoint.execute).have.callCount(0);
    });

    it('should handle invalid messages format', () => {
      const nodeEnv = global.NODE_ENV;
      // depending on NODE_ENV, errors can have a stacktrace or not
      ['development', '', 'production'].forEach(env => {
        global.NODE_ENV = env;

        protocol.onClientMessage(connection, 'ohnoes');

        const matcher = errorMatcher.fromMessage(
          'network',
          'websocket',
          'unexpected_error',
          'Unexpected token o in JSON at position 0');

        should(entrypoint.execute).not.be.called();
        should(protocol._send)
          .calledOnce()
          .calledWith(connection.id, sinon.match(matcher));

        protocol._send.resetHistory();
      });

      global.NODE_ENV = nodeEnv;
    });

    it('should call entrypoint execute', () => {
      const data = JSON.stringify({foo: 'bar'});

      protocol.onClientMessage(connection, data);

      should(entrypoint.execute).be.calledOnce();

      const [request, cb] = entrypoint.execute.firstCall.args;

      should(request.serialize())
        .match({
          data: {
            foo: 'bar'
          },
          options: {
            connection
          }
        });

      {
        const result = {
          requestId: 'test',
          content: {}
        };

        cb(result);

        should(result.content.room).eql('test');

        should(protocol._send)
          .be.calledOnce()
          .be.calledWith(connection.id, JSON.stringify(result.content));
      }
    });

    it('should send a custom pong message', () => {
      const data = JSON.stringify({p: 1});

      protocol.onClientMessage(connection, data);

      should(protocol._send)
        .be.calledOnce()
        .be.calledWith(connection.id, '{"p":1}');
    });
  });

  describe('#broadcast', () => {
    beforeEach(() => {
      return protocol.init(entrypoint)
        .then(() => {
          const socketMock = function () {
            return {
              _sender: {
                sendFrame: sinon.stub()
              }
            };
          };

          protocol.connectionPool = new Map([
            ['cx1', {alive: true, socket: new socketMock()}],
            ['cx2', {alive: true, socket: new socketMock()}],
            ['cx3', {alive: true, socket: new socketMock()}],
            ['cx4', {alive: true, socket: new socketMock()}],
          ]);

          protocol.channels = new Map([
            ['c1', new Set(['cx1', 'cx2', 'cx3'])],
            ['c2', new Set(['cx1', 'cx3'])],
            ['c3', new Set(['cx2', 'cx3', 'cx4'])]
          ]);

        });
    });

    it('should send the message to all clients registered to the message channels', () => {
      let frame;
      const data = {
        channels: ['c1', 'c3', 'c4'],
        payload: {foo: 'bar'}
      };

      protocol.broadcast(data);

      // channel: c1
      data.payload.room = 'c1';
      frame = Buffer.from(JSON.stringify(data.payload));

      for (const connId of ['cx1', 'cx2', 'cx3']) {
        should(protocol.connectionPool.get(connId).socket._sender.sendFrame)
          .calledWith(frame);
      }

      // channel: c3
      data.payload.room = 'c3';
      frame = Buffer.from(JSON.stringify(data.payload));

      for (const connId of ['cx2', 'cx3', 'cx4']) {
        should(protocol.connectionPool.get(connId).socket._sender.sendFrame)
          .calledWith(frame);
      }
    });

    it('should handle unicode payload', () => {
      const data = {
        channels: ['c1'],
        payload: { text: 'žluťoučký kůň' }
      };

      protocol.broadcast(data);

      data.payload.room = 'c1';
      const frame = Buffer.from(JSON.stringify(data.payload));

      for (const connId of ['cx1', 'cx2', 'cx3']) {
        should(protocol.connectionPool.get(connId).socket._sender.sendFrame)
          .calledWith(frame);
      }
    });
  });

  describe('#notify', () => {
    it('should send data to one client', () => {
      protocol._send = sinon.spy();

      const data = {
        connectionId: 'connectionId',
        channels: ['c1', 'c3', 'c4'],
        payload: {foo: 'bar'}
      };

      protocol.notify(data);

      should(protocol._send)
        .be.calledWith(
          'connectionId',
          JSON.stringify(Object.assign({}, data.payload, {room: 'c1'})))
        .be.calledWith(
          'connectionId',
          JSON.stringify(Object.assign({}, data.payload, {room: 'c3'})))
        .be.calledWith(
          'connectionId',
          JSON.stringify(Object.assign({}, data.payload, {room: 'c4'})));
    });
  });

  describe('#joinChannel', () => {
    it('should do nothing if the connection is unknonwn', () => {
      protocol.joinChannel('channel', 'foo');

      should(protocol.channels).be.empty();
    });

    it('should link the connection to a new channel', () => {
      const connection = {
        id: 'connectionId',
        alive: true,
        channels: new Set()
      };

      protocol.connectionPool.set(connection.id, connection);
      protocol.joinChannel('channel', connection.id);

      should(protocol.channels)
        .deepEqual(new Map([['channel', new Set(['connectionId'])]]));
      should(connection.channels).deepEqual(new Set(['channel']));
    });

    it('should add a connection to an existing channel', () => {
      const
        connection1 = {
          id: 'connectionId',
          alive: true,
          channels: new Set()
        },
        connection2 = {
          id: 'connectionId2',
          alive: true,
          channels: new Set(['foo'])
        };

      protocol.connectionPool.set(connection1.id, connection1);
      protocol.connectionPool.set(connection2.id, connection2);

      protocol.joinChannel('channel', connection1.id);
      protocol.joinChannel('channel', connection2.id);

      should(protocol.channels)
        .deepEqual(new Map([
          ['channel', new Set(['connectionId', 'connectionId2'])]
        ]));

      should(connection1.channels).deepEqual(new Set(['channel']));
      should(connection2.channels).deepEqual(new Set(['foo', 'channel']));
    });
  });

  describe('#leaveChannel', () => {
    beforeEach(() => {
      protocol.connectionPool = new Map([
        ['connectionId', {alive: true, channels: new Set(['foo', 'channel'])}]
      ]);

      protocol.channels = new Map([
        ['channel', new Set(['foo', 'bar', 'baz', 'connectionId', 'qux'])]
      ]);
    });

    it('should do nothing if the connection is unknonw', () => {
      protocol.leaveChannel('channel', 'unknown');

      should(protocol.channels.get('channel')).have.size(5);
    });

    it('should unsubscribe the client', () => {
      protocol.leaveChannel('channel', 'connectionId');

      should(protocol.channels.get('channel'))
        .have.size(4)
        .and.deepEqual(new Set(['foo', 'bar', 'baz', 'qux']));
      should(protocol.connectionPool.get('connectionId').channels)
        .deepEqual(new Set(['foo']));
    });

    it('should remove an unused channel entry', () => {
      protocol.channels = new Map([
        ['channel', new Set(['connectionId'])]
      ]);

      protocol.leaveChannel('channel', 'connectionId');

      should(protocol.channels.has('channel')).be.false();
      should(protocol.connectionPool.get('connectionId').channels)
        .deepEqual(new Set(['foo']));
    });
  });

  describe('#disconnect', () => {
    it('should close the connection', () => {
      protocol.connectionPool = new Map([
        ['connectionId', { socket: { close: sinon.spy() } } ]
      ]);

      protocol.disconnect('connectionId', 'test');

      should(protocol.connectionPool.get('connectionId').socket.close)
        .be.calledWith(1011, 'test');
    });
  });

  describe('#_send', () => {
    it('should send the message', () => {
      protocol.connectionPool = new Map([
        [
          'connectionId',
          {
            alive: true,
            socket: {
              OPEN: 'open',
              readyState: 'open',
              send: sinon.spy()
            }
          }
        ]
      ]);

      protocol._send('connectionId', 'test');
      should(protocol.connectionPool.get('connectionId').socket.send)
        .be.calledWith('test');
    });
  });

  describe('#Heartbeat', () => {
    it('should throw if the heartbeat value is not set to a valid value', () => {
      const
        values = [null, 'foo', {}, [], 3.14159, true, -42, undefined],
        promises = [];

      for (const heartbeat of values) {
        const
          ep = new EntryPoint(),
          wsp = new WebSocketProtocol();

        ep.config.protocols.websocket.heartbeat = heartbeat;
        promises.push(
          should(wsp.init(ep)).rejectedWith(
            {message: /WebSocket: invalid heartbeat value /})
            .then(() => {
              clearInterval(wsp.heartbeatInterval);
              clearInterval(wsp.idleSweepInterval);
              clearInterval(wsp.activityInterval);
            }));
      }

      return Promise.all(promises);
    });

    it('should start a heartbeat if asked to', () => {
      const
        clock = sinon.useFakeTimers(),
        heartbeatSpy = sinon.stub(protocol, '_doHeartbeat');

      entrypoint.config.protocols.websocket.heartbeat = 1000;

      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.heartbeatInterval).not.be.null();
          should(heartbeatSpy).not.be.called();

          clock.tick(1000);

          should(heartbeatSpy).be.calledOnce();

          clock.tick(1000);

          should(heartbeatSpy).be.calledTwice();

          clock.restore();
        });
    });

    it('should terminate dead sockets, and mark others as dead', () => {
      const Connection = function (alive, lastActivity) {
        return {
          alive,
          lastActivity,
          socket: {
            terminate: sinon.stub(),
            ping: sinon.stub()
          }
        };
      };

      protocol.connectionPool = new Map([
        ['ahAhAhAhStayinAliveStayinAlive', new Connection(true, 0)],
        ['dead', new Connection(false, 0)],
        ['ahAhAhAhStayinAliiiiiiiiive', new Connection(true, 0)],
        ['active', new Connection(true, Date.now())]
      ]);

      protocol.config.heartbeat = 1000;
      protocol._doHeartbeat();

      // inactive sockets are pinged
      for (const id of [
        'ahAhAhAhStayinAliveStayinAlive',
        'ahAhAhAhStayinAliiiiiiiiive'
      ]) {
        const connection = protocol.connectionPool.get(id);

        should(connection.alive).be.false();
        should(connection.socket.terminate).not.be.called();
        should(connection.socket.ping).be.calledOnce();
      }

      // dead sockets are terminated
      const deadConnection = protocol.connectionPool.get('dead');

      should(deadConnection.alive).be.false();
      should(deadConnection.socket.terminate).be.calledOnce();
      should(deadConnection.socket.ping).not.be.called();

      // active sockets are unaffected
      const activeConnection = protocol.connectionPool.get('active');

      should(activeConnection.alive).be.true();
      should(activeConnection.socket.terminate).not.be.called();
      should(activeConnection.socket.ping).not.be.called();
    });

    it('should mark a socket as dead if not available for PING', () => {
      const
        Connection = function (alive, lastActivity) {
          return {
            alive,
            lastActivity,
            socket: {
              OPEN: 'OPEN',
              readyState: 'OPEN',
              terminate: sinon.stub(),
              ping: sinon.stub()
            }
          };
        };

      protocol.connectionPool = new Map([
        ['ahAhAhAhStayinAliveStayinAlive', new Connection(true, 0)],
        ['I just met you, and this is cr...gargl', new Connection(true, 0)],
        ['ahAhAhAhStayinAliiiiiiiiive', new Connection(true, 0)]
      ]);

      const deadConnection = protocol.connectionPool.get('I just met you, and this is cr...gargl');
      deadConnection.socket.readyState = 'CLOSED';

      protocol.config.heartbeat = 1000;
      protocol._doHeartbeat();

      // inactive sockets are pinged
      for (const id of [
        'ahAhAhAhStayinAliveStayinAlive',
        'ahAhAhAhStayinAliiiiiiiiive'
      ]) {
        const connection = protocol.connectionPool.get(id);

        should(connection.alive).be.false();
        should(connection.socket.terminate).not.be.called();
        should(connection.socket.ping).be.calledOnce();
      }

      // dead sockets are terminated
      should(deadConnection.socket.ping).not.be.called();
      should(deadConnection.socket.terminate).be.calledOnce();
    });
  });

  describe('#IdleTimeout', () => {
    it('should throw if the idleTimeout value is not set to a valid value', () => {
      const
        values = [null, 'foo', {}, [], 3.14159, true, -42, undefined],
        promises = [];

      for (const idleTimeout of values) {
        const
          ep = new EntryPoint(),
          wsp = new WebSocketProtocol();

        ep.config.protocols.websocket.idleTimeout = idleTimeout;

        promises.push(
          should(wsp.init(ep)).rejectedWith(
            {message: /WebSocket: invalid idleTimeout value /})
            .then(() => {
              clearInterval(wsp.heartbeatInterval);
              clearInterval(wsp.idleSweepInterval);
              clearInterval(wsp.activityInterval);
            }));
      }

      return Promise.all(promises);
    });

    it('should start an idleTimeout sweep if asked to', () => {
      const
        clock = sinon.useFakeTimers(),
        idleTimeoutSpy = sinon.stub(protocol, '_sweepIdleSockets');

      entrypoint.config.protocols.websocket.idleTimeout = 1000;

      return protocol.init(entrypoint)
        .then(() => {
          should(protocol.idleTimeoutInterval).not.be.null();
          should(idleTimeoutSpy).not.be.called();

          clock.tick(protocol.config.idleTimeout);

          should(idleTimeoutSpy).be.calledOnce();

          clock.tick(protocol.config.idleTimeout);

          should(idleTimeoutSpy).be.calledTwice();

          clock.restore();
        })
        .catch(e => {
          clock.restore();
          throw e;
        });
    });

    it('should terminate inactive sockets', () => {
      const
        now = Date.now(),
        Connection = function (lastActivity) {
          return {
            lastActivity,
            socket: {
              terminate: sinon.stub()
            }
          };
        };

      protocol.config.idleTimeout = 1000;

      protocol.connectionPool = new Map([
        ['ahAhAhAhStayinAliveStayinAlive', new Connection(now)],
        ['dead', new Connection(now - protocol.config.idleTimeout - 1)],
        [
          'ahAhAhAhStayinAliiiiiiiiive',
          new Connection(now - protocol.config.idleTimeout + 100)
        ]
      ]);

      protocol._sweepIdleSockets();

      // active sockets are unaffected
      for (const id of [
        'ahAhAhAhStayinAliveStayinAlive',
        'ahAhAhAhStayinAliiiiiiiiive'
      ]) {
        should(protocol.connectionPool.get(id).socket.terminate).not.called();
      }

      // inactive sockets are terminated
      should(protocol.connectionPool.get('dead').socket.terminate).calledOnce();
    });
  });
});
