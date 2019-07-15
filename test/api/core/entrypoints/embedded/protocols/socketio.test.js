const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  EntryPoint = require('../../../../../../lib/api/core/entrypoints/embedded'),
  KuzzleMock = require('../../../../../mocks/kuzzle.mock');

describe('/lib/api/core/entrypoints/embedded/protocols/socketio', () => {
  let
    kuzzle,
    entrypoint,
    SocketIoProtocol,
    protocol,
    socketEmitStub;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoint = new EntryPoint(kuzzle);

    socketEmitStub = sinon.spy();

    const SockerIoMock = () => ({
      on: sinon.spy(),
      set: sinon.spy(),
      to: sinon.stub().returns({emit: socketEmitStub})
    });

    mockrequire('socket.io', SockerIoMock);
    SocketIoProtocol = mockrequire.reRequire('../../../../../../lib/api/core/entrypoints/embedded/protocols/socketio');

    protocol = new SocketIoProtocol();
  });

  describe('#init', () => {
    it ('should do nothing if the protocol is disabled', () => {
      entrypoint.config.protocols.socketio.enabled = false;

      return protocol.init(entrypoint)
        .then(enabled => {
          should(enabled).be.false();
          should(protocol.io).be.null();
        });
    });

    it('should create the socket and attach events', () => {
      protocol.onConnection = sinon.spy();
      protocol.onServerError = sinon.spy();

      return protocol.init(entrypoint)
        .then(() => {

          should(protocol.io.set).be.calledOnce();
          should(protocol.io.on).be.calledTwice();
          {
            const onConnectionH = protocol.io.on.firstCall.args[1];
            onConnectionH('test');
            should(protocol.onConnection)
              .be.calledOnce()
              .be.calledWith('test');
          }

          {
            const onErrorH = protocol.io.on.secondCall.args[1];
            onErrorH('test');
            should(protocol.onServerError)
              .be.calledOnce()
              .be.calledWith('test');
          }
        });
    });
  });

  describe('#onServerError', () => {
    it('should just log the error', () => {
      const error = new Error('test');

      return protocol.init(entrypoint)
        .then(() => {
          protocol.onServerError(error);

          should(kuzzle.log.error).calledOnce();
          should(kuzzle.log.error.firstCall.args[0])
            .startWith('[socketio] An error has occured');
        });
    });
  });

  describe('#onConnection', () => {
    let
      socket;

    beforeEach(() => {
      socket = {
        handshake: {
          address: 'ip',
          headers: {
            'x-forwarded-for': '1.1.1.1,2.2.2.2'
          }
        },
        on: sinon.spy()
      };

      entrypoint.newConnection = sinon.spy();

      return protocol.init(entrypoint)
        .then(() => {
          protocol.onClientDisconnection = sinon.spy();
          protocol.onClientMessage = sinon.spy();
        });
    });

    it('should register the new connection', () => {
      protocol.onConnection(socket);

      should(entrypoint.newConnection)
        .be.calledOnce();

      const connection = entrypoint.newConnection.firstCall.args[0];

      {
        const onDisconnectH = socket.on.firstCall.args[1];

        onDisconnectH('test');
        should(protocol.onClientDisconnection)
          .be.calledWith(connection.id);
      }

      {
        const onErrorH = socket.on.secondCall.args[1];

        onErrorH('error');
        should(protocol.onClientDisconnection)
          .be.calledTwice();
      }

      {
        const onKuzzleH = socket.on.thirdCall.args[1];

        onKuzzleH('message');
        should(protocol.onClientMessage)
          .be.calledWith(socket, connection, 'message');
      }
    });
  });

  describe('#onClientDisconnection', () => {
    it('should delete the connection', () => {
      entrypoint.clients.connectionId = {};

      return protocol.init(entrypoint)
        .then(() => {
          protocol.sockets = {
            connectionId: {}
          };

          protocol.onClientDisconnection('connectionId');
          should(protocol.sockets)
            .be.empty();
          should(entrypoint.clients)
            .be.empty();
        });
    });
  });

  describe('#onClientMessage', () => {
    let
      connection,
      socket;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'socketio'
      };
      socket = {

      };
      entrypoint.execute = sinon.spy();

      return protocol.init(entrypoint)
        .then(() => {
          protocol.sockets = {
            connectionId: {}
          };
        });
    });

    it('should do nothing if the connection is unknown', () => {
      protocol.onClientMessage(socket, {id: 'foo'}, 'data');

      should(entrypoint.execute)
        .have.callCount(0);
    });

    it('should pass the message to the entry point', () => {
      const data = {
        foo: 'bar'
      };

      protocol.onClientMessage(socket, connection, data);

      should(entrypoint.execute)
        .be.calledOnce();

      const request = entrypoint.execute.firstCall.args[0];

      should(request.serialize())
        .match({
          data: {
            foo: 'bar'
          },
          options: {
            connection
          }
        });

      const cb = entrypoint.execute.firstCall.args[1];
      const response = {
        content: 'test',
        requestId: 'requestId'
      };
      cb(response);

      should(socketEmitStub)
        .be.calledWith('requestId', 'test');
    });
  });

  describe('#broadcast', () => {
    it('should emit to all channels', () => {
      return protocol.init(entrypoint)
        .then(() => {
          const data = {
            channels: [
              'ch1',
              'ch2',
              'ch4',
              'ch6'
            ],
            payload: 'test'
          };

          protocol.broadcast(data);

          should(socketEmitStub)
            .be.calledWith('ch1', 'test')
            .be.calledWith('ch2', 'test')
            .be.calledWith('ch4', 'test')
            .be.calledWith('ch6', 'test');
        });
    });
  });

  describe('#notify', () => {
    it('should emit to the connection channel(s)', () => {
      protocol.sockets = {
        connectionId: {
          emit: socketEmitStub
        }
      };

      protocol.notify({
        connectionId: 'connectionId',
        channels: ['ch1', 'ch3', 'ch4'],
        payload: 'test'
      });

      should(socketEmitStub)
        .be.calledWith('ch1', 'test')
        .be.calledWith('ch3', 'test')
        .be.calledWith('ch4', 'test');
    });
  });

  describe('#joinChannel', () => {
    it('should call socket io join', () => {
      protocol.sockets = {
        connectionId: {
          join: sinon.spy()
        }
      };

      protocol.joinChannel('channel', 'connectionId');
      should(protocol.sockets.connectionId.join)
        .be.calledWith('channel');
    });
  });

  describe('#leaveChannel', () => {
    it('should call socket io leave', () => {
      protocol.sockets = {
        connectionId: {
          leave: sinon.spy()
        }
      };

      protocol.leaveChannel('channel', 'connectionId');
      should(protocol.sockets.connectionId.leave)
        .be.calledWith('channel');
    });
  });

  describe('#disconnect', () => {
    it('should call socket io disconnect', () => {
      protocol.sockets = {
        connectionId: {
          disconnect: sinon.spy()
        }
      };
      protocol.disconnect('connectionId');
      should(protocol.sockets.connectionId.disconnect)
        .be.calledOnce();
    });
  });


});
