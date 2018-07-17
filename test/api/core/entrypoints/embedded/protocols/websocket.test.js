const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  EntryPoint = require('../../../../../../lib/api/core/entrypoints/embedded'),
  KuzzleMock = require('../../../../../mocks/kuzzle.mock');

describe('/lib/api/core/entrypoints/embedded/protocols/websocket', () => {
  let
    kuzzle,
    entrypoint,
    WebSocketProtocol,
    WebSocketServer,
    protocol;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoint = new EntryPoint(kuzzle);

    WebSocketServer = sinon.spy(function () {
      this.on = sinon.spy();
    });
    mockrequire('uws', {
      Server: WebSocketServer
    });

    WebSocketProtocol = mockrequire.reRequire('../../../../../../lib/api/core/entrypoints/embedded/protocols/websocket');

    protocol = new WebSocketProtocol();
  });

  describe('#init', () => {
    it('should do nothing if the protocol is not enabled', () => {
      entrypoint.config.protocols.websocket.enabled = false;

      protocol.init(entrypoint);
      should(protocol.server).be.null();
    });

    it('should launch a websocket server and bind events to it', () => {
      protocol.onConnection = sinon.spy();
      protocol.onServerError = sinon.spy();

      protocol.init(entrypoint);

      should(protocol.entryPoint)
        .eql(entrypoint);

      should(WebSocketServer)
        .be.calledOnce();

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

  describe('#onServerError', () => {
    it('should forward the error to kuzzle logger', () => {
      protocol.init(entrypoint);
      protocol.onServerError('test');
      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:error', '[websocket] An error has occured "undefined":\nundefined');
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
        close: sinon.stub(),
        _socket: {
          remoteAddress: 'ip'
        }
      };

      request = {
        headers: {
          'X-Foo': 'bar',
          'x-forwarded-for': '1.1.1.1,2.2.2.2'
        }
      };

      protocol.init(entrypoint);
      protocol.entryPoint.newConnection = sinon.spy();
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
          protocol: protocol.protocol,
          ips: ['1.1.1.1', '2.2.2.2', 'ip'],
          headers: request.headers
        });

      const connection = protocol.entryPoint.newConnection.firstCall.args[0];
      should(protocol.connectionPool[connection.id])
        .match({
          alive: true,
          socket,
          channels: []
        });

      should(onClientSpy)
        .be.calledThrice()
        .be.calledWith('close')
        .be.calledWith('error')
        .be.calledWith('message');

      {
        const onCloseH = onClientSpy.firstCall.args[1];

        onCloseH('test');
        should(protocol.onClientDisconnection)
          .be.calledOnce()
          .be.calledWith(connection.id);
      }

      {
        const onErrorH = onClientSpy.secondCall.args[1];

        onErrorH('anotherone');
        should(protocol.onClientDisconnection)
          .be.calledTwice();
      }

      {
        const onMessageH = onClientSpy.thirdCall.args[1];

        onMessageH('test');
        should(protocol.onClientMessage)
          .be.calledOnce()
          .be.calledWith(connection, 'test');
      }
    });

  });

  describe('#onClientDisconnection', () => {
    beforeEach(() => {
      protocol.init(entrypoint);
      protocol.connectionPool = {
        connectionId: {
          id: 'connectionId',
          channels: ['c1', 'c2', 'c3']
        }
      };

      protocol.channels = {
        c1: {
          count: 3
        },
        c2: {
          count: 1
        },
        c3: {
          count: 2
        }
      };
    });

    it('should remove the client from its subscriptions', () => {
      entrypoint.clients.connectionId = {};
      protocol.onClientDisconnection('connectionId');

      should(entrypoint.clients)
        .be.empty();

      should(protocol.channels)
        .match({
          c1: {
            count: 2
          }
        });
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

      protocol.init(entrypoint);
      protocol.connectionPool = {
        connectionId: {
          id: 'connectionId'
        }
      };
      protocol._send = sinon.spy();
    });

    it('should do nothing if no data is given or if the connection is unknown', () => {
      protocol.onClientMessage({id: 'foo'});

      should(entrypoint.execute)
        .have.callCount(0);
    });

    it('should call entrypoint execute', () => {
      const data = JSON.stringify({foo: 'bar'});

      protocol.onClientMessage(connection, data);

      should(entrypoint.execute)
        .be.calledOnce();

      const request = entrypoint.execute.firstCall.args[0];
      const cb = entrypoint.execute.firstCall.args[1];

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

        should(result.content.room)
          .eql('test');

        should(protocol._send)
          .be.calledOnce()
          .be.calledWith(connection.id, JSON.stringify(result.content));
      }
    });

  });

  describe('#broadcast', () => {
    beforeEach(() => {
      protocol.init(entrypoint);
      protocol._send = sinon.spy();
    });

    it('should send the message to all clients registered to the message channels', () => {
      protocol.channels = {
        c1: {
          cx1: true,
          cx2: true,
          cx3: true
        },
        c2: {
          cx1: true,
          cx3: true
        },
        c3: {
          cx2: true,
          cx3: true,
          cx4: true
        }
      };

      const data = {
        channels: ['c1', 'c3', 'c4'],
        payload: {foo: 'bar'}
      };

      protocol.broadcast(data);

      should(protocol._send)
        .be.calledWith('cx1', JSON.stringify(Object.assign(data.payload, {room: 'c1'})))
        .be.calledWith('cx2', JSON.stringify(Object.assign(data.payload, {room: 'c1'})))
        .be.calledWith('cx3', JSON.stringify(Object.assign(data.payload, {room: 'c1'})))
        .be.calledWith('cx2', JSON.stringify(Object.assign(data.payload, {room: 'c3'})))
        .be.calledWith('cx3', JSON.stringify(Object.assign(data.payload, {room: 'c3'})))
        .be.calledWith('cx4', JSON.stringify(Object.assign(data.payload, {room: 'c3'})));
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
        .be.calledWith('connectionId', JSON.stringify(Object.assign({}, data.payload, {room: 'c1'})))
        .be.calledWith('connectionId', JSON.stringify(Object.assign({}, data.payload, {room: 'c3'})))
        .be.calledWith('connectionId', JSON.stringify(Object.assign({}, data.payload, {room: 'c4'})));
    });
  });

  describe('#joinChannel', () => {
    it('should do nothing if the connection is unknonwn', () => {
      protocol.joinChannel('channel', 'foo');

      should(protocol.channels)
        .be.empty();
    });

    it('should link the connection to the channel', () => {
      const connection = {
        id: 'connectionId',
        alive: true,
        channels: []
      };
      protocol.connectionPool[connection.id] = connection;

      protocol.joinChannel('channel', connection.id);

      should(protocol.channels)
        .match({
          channel: {
            connectionId: true,
            count: 1
          }
        });

      should(connection.channels)
        .eql(['channel']);
    });
  });

  describe('#leaveChannel', () => {
    beforeEach(() => {
      protocol.connectionPool = {
        connectionId: {
          alive: true,
          channels: ['foo', 'channel']
        }
      };
      protocol.channels = {
        channel: {
          count: 5,
          connectionId: true
        }
      };
    });

    it('should do nothing if the connection is unknonw', () => {
      protocol.leaveChannel('channel', 'foo');

      should(protocol.channels.channel.count)
        .eql(5);
    });

    it('should unsubscribe the client', () => {
      protocol.leaveChannel('channel', 'connectionId');

      should(protocol.channels.channel.count)
        .eql(4);
      should(protocol.connectionPool.connectionId.channels)
        .eql(['foo']);
    });

  });

  describe('#disconnect', () => {
    it('should close the connection', () => {
      protocol.connectionPool = {
        connectionId: {
          socket: {
            close: sinon.spy()
          }
        }
      };

      protocol.disconnect('connectionId', 'test');

      should(protocol.connectionPool.connectionId.socket.close)
        .be.calledWith(1011, 'test');
    });
  });

  describe('#_send', () => {
    it('should send the message', () => {
      protocol.connectionPool = {
        connectionId: {
          alive: true,
          socket: {
            OPEN: 'open',
            readyState: 'open',
            send: sinon.spy()
          }
        }
      };

      protocol._send('connectionId', 'test');
      should(protocol.connectionPool.connectionId.socket.send)
        .be.calledWith('test');
    });
  });

});
