'use strict';

const
  Bluebird = require('bluebird'),
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  should = require('should'),
  WS = require('uws'),
  CircularList = require('easy-circular-list'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  WSClientMock = require('../../mocks/services/ws.mock'),
  WSServerMock = require('../../mocks/services/ws.server.mock'),
  BrokerFactory = rewire('../../../lib/services/broker'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  WSBrokerClient = require('../../../lib/services/broker/wsBrokerClient'),
  WSBrokerClientRewire = rewire('../../../lib/services/broker/wsBrokerClient'),
  WSBrokerServer = require('../../../lib/services/broker/wsBrokerServer');

describe('Test: Internal broker', () => {
  let
    WSBrokerServerRewire = rewire('../../../lib/services/broker/wsBrokerServer'),
    clock,
    server,
    kuzzle;

  before(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.services.internalBroker = {
      host: 'host',
      port: 'port',
      retryInterval: 1000
    };

    clock = sinon.useFakeTimers(Date.now());
  });

  beforeEach(() =>{
    kuzzle.pluginsManager.trigger = sinon.stub();
    sandbox.restore();
  });

  after(() => {
    clock.restore();
    mockrequire.stopAll();
  });

  describe('Internal broker general constructor', () => {
    it('should return a Broker', () => {
      const InternalBroker = new BrokerFactory('internalBroker', false, false);
      should(InternalBroker).be.Function();
    });
  });

  describe('Internal broker constructor', () => {
    it('should fail if no config match the broker type', () => {
      const FakeBroker = new BrokerFactory('fakeBroker');
      should((() => {new FakeBroker(kuzzle, {isServer: true});})).throw(Error);
    });
  });

  describe('Internal broker', () => {
    let client;

    beforeEach(() => {
      const InternalBroker = new BrokerFactory('internalBroker');
      /** @type InternalBroker */
      server = new InternalBroker(kuzzle, undefined, kuzzle.config.services.internalBroker);
      server.ws = cb => {
        server.wss = new WSServerMock();
        cb();
      };

      /** @type InternalBroker */
      client = new InternalBroker(kuzzle, {client: true}, kuzzle.config.services.internalBroker);
      client.ws = () => new WSClientMock(server.wss);

      return Bluebird.all([
        server.init(),
        client.init()
      ]);
    });

    it('should instantiate a broker', () => {
      should(client).be.an.instanceOf(WSBrokerClient);
      should(server).be.an.instanceOf(WSBrokerServer);
    });

    it('should return a rejected promise when calling waitForClients on a client handler', () => {
      return should(client.waitForClients()).be.rejectedWith(InternalError);
    });

  });

  describe('Client', () => {
    let client;

    beforeEach(() => {
      server = new WSBrokerServer('internalBroker', kuzzle.config.services.internalBroker, kuzzle.pluginsManager);
      server.ws = cb => {
        server.wss = new WSServerMock();
        cb();
      };

      client = new WSBrokerClient('internalBroker', kuzzle.config.services.internalBroker, kuzzle.pluginsManager, true);
      client.ws = () => new WSClientMock(server.wss);
    });

    describe('#constructor', () => {
      it('should throw if no valid configuration is given', () => {
        return should(() => new WSBrokerClient('broker', {}))
          .throw(InternalError, {message: 'No endpoint configuration given to connect. Please provide "host".'});
      });

      it('should connect to a TCP host', () => {
        client = new WSBrokerClient('broker', {host: 'host', port: 'port'});
        should(client.server).match({
          address: 'ws://host:port',
          transport: 'tcp'
        });
      });
    });

    describe('#ws', () => {
      it('should construct a WS client', () => {
        const WSStub = sandbox.stub();

        mockrequire('uws', WSStub);
        mockrequire.reRequire('../../../lib/services/broker/wsBrokerClient');

        const WSClient = rewire('../../../lib/services/broker/wsBrokerClient');
        client = new WSClient('broker', {host: 'localhost', port: 4242});

        client.ws();

        should(WSStub)
          .be.calledOnce()
          .be.calledWith('ws://localhost:4242', {perMessageDeflate: false});

        mockrequire.stopAll();
      });
    });

    describe('#init', () => {
      it('should attach events', () => {
        return server.init()
          .then(() => client.init())
          .then(response => {
            should(response).be.an.instanceOf(WSClientMock);

            // callbacks initiated by the client
            should(client.client.socket.on.firstCall).be.calledWith('message');
            should(client.client.socket.on.secondCall).be.calledWith('open');
            should(client.client.socket.on.thirdCall).be.calledWith('close');
            should(client.client.socket.on.getCall(3)).be.calledWith('error');

            // callbacks initiated by the server
            should(client.client.socket.on.getCall(4)).be.calledWith('message');
            should(client.client.socket.on.getCall(5)).be.calledWith('close');
            should(client.client.socket.on.getCall(6)).be.calledWith('error');

            // triggers
            should(kuzzle.pluginsManager.trigger.callCount).be.exactly(1);
            should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('internalBroker:connected', client.server.address);
          });
      });

      it ('should return the current promise if already called', () => {
        let beforeInitOnCalls;

        return Bluebird.all([server.init(), client.init()])
          .then(() => {
            beforeInitOnCalls = client.client.socket.on.callCount;
            return client.init();
          })
          .then(() => should(client.client.socket.on.callCount).be.exactly(beforeInitOnCalls));
      });

      it('should wait for the broker server until the connection is established', (done) => {
        let errorCount = 0;

        sinon.spy(client, '_connect');

        client.onErrorHandlers.push(() => {
          errorCount++;
        });

        // we init the client before the server.
        // The promise is resolved once the server is up and the connection is established
        // That means: there will be a timeout if the client is not able to retry the connection.
        client.init()
          .then(response => {
            should(response).be.an.instanceOf(WSClientMock);
            should(client._connect.callCount).be.exactly(2);
            should(errorCount).be.exactly(1);
            done();
          })
          .catch(err => done(err));

        server.init()
          .then(() => {
            clock.tick(kuzzle.config.services.internalBroker.retryInterval); // should trigger a new client.init() call
          });
      });
    });

    describe('#listen & #unsubscribe', () => {
      it('should only store the handler if the client is not connected', () => {
        const cb = sinon.stub();

        client.listen('room', cb);

        should(client.handlers).be.eql({
          room: [cb]
        });

        client.unsubscribe('room');

        should(client.handlers).be.eql({});

        should(client.client.socket).be.null();
      });

      it('should only store the handler if the client is connecting', (done) => {
        const cb = sinon.stub();

        should(client.client.socket).be.null();

        server.init()
          .then(() => client.init())
          .then(() => {
            // force socket to be in connecting state
            client.client.socket.readyState = WS.CONNECTING;

            client.listen('room', cb);
            should(client.handlers).be.eql({
              room: [cb]
            });

            should(client.client.socket).not.be.null();
            should(client.client.socket.send.callCount).be.eql(0);

            client.unsubscribe('room');
            should(client.handlers).be.eql({});

            should(client.client.socket).not.be.null();
            should(client.client.socket.send.callCount).be.eql(0);

            done();
          })
          .catch(err => done(err));
      });

      it('should store the handler and notify the server if the client is connected', (done) => {
        const cb = sinon.stub();

        should(client.client.socket).be.null();

        server.init()
          .then(() => client.init())
          .then(() => {
            // force socket to be in opened state
            client.client.socket.readyState = WS.OPEN;

            client.listen('room', cb);

            should(client.handlers).be.eql({
              room: [cb]
            });

            should(client.client.socket).not.be.null();

            should(client.client.socket.send.firstCall).be.calledWith(JSON.stringify({
              action: 'listen',
              room: 'room'
            }));

            client.unsubscribe('room');

            should(client.handlers).be.eql({});

            should(client.client.socket.send.secondCall).be.calledWith(JSON.stringify({
              action: 'unsubscribe',
              room: 'room'
            }));

            done();
          })
          .catch(err => done(err));
      });
    });

    describe('#close', () => {
      beforeEach(() => Bluebird.all([server.init(),client.init()]));

      it('should close the socket if it was open', () => {
        const socket = client.client.socket;

        socket.readyState = WS.OPEN;

        client.close();

        should(socket.close).be.calledOnce();
        should(client.client.socket).be.null();
      });

      it('should reset the promise', () => {
        should(client.client.connected.promise.isFulfilled()).be.eql(true);

        client.close();

        should(client.client.connected.promise.isFulfilled()).be.eql(false);
        should(client.client.socket).be.null();
      });
    });

    describe('#send & broadcast', () => {
      beforeEach(() => Bluebird.all([server.init(),client.init()]));

      it('should log an error if no client socket is set', () => {
        client = {
          client: {},
          eventName: 'test',
          pluginsManager: {
            trigger: sinon.spy()
          }
        };

        WSBrokerClientRewire.__get__('emit')(client);

        should(client.pluginsManager.trigger)
          .be.calledOnce()
          .be.calledWith('log:error', 'No socket for broker test');
      });

      it('`send` should send properly envelopped data', () => {
        const
          data = {foo: 'bar'},
          socket = client.client.socket;

        client.send('room', data);

        should(socket.send).be.calledOnce();
        should(socket.send).be.calledWith(JSON.stringify({
          room: 'room',
          data: data,
          action: 'send'
        }));
      });

      it('`broadcast` should send properly envelopped data', () => {
        const
          data = {foo: 'bar'},
          socket = client.client.socket;

        client.broadcast('room', data);

        should(socket.send).be.calledOnce();
        should(socket.send).be.calledWith(JSON.stringify({
          room: 'room',
          data: data,
          action: 'broadcast'
        }));
      });

    });

    describe('#events', () => {
      beforeEach(() => {
        client.onConnectHandlers = [];
        client.onCloseHandlers = [];
        client.onErrorHandlers = [];

        return Bluebird.all([server.init(), client.init()]);
      });

      it('on open, should re-register if some callbacks were attached', () => {
        const
          newClient = new WSBrokerClient('internalBroker', kuzzle.config.services.internalBroker, kuzzle.pluginsManager),
          cb = sinon.stub();

        newClient.ws = () => new WSClientMock(server.wss);
        newClient.handlers = {
          room: [ cb ]
        };
        newClient.onConnectHandlers = [sinon.spy()];

        return newClient.init()
          .then(() => {
            const socket = newClient.client.socket;

            should(socket.send).be.calledOnce();
            should(socket.send).be.calledWith(JSON.stringify({
              room: 'room',
              action: 'listen'
            }));
            should(newClient.onConnectHandlers[0]).be.calledOnce();
          });
      });

      it('on open, should trigger a warning if the client was already connected', () => {
        const
          socket = client.client.socket;

        socket.emit('open', 1);

        should(client.pluginsManager.trigger).be.calledWith('log:warn', '[internalBroker] Node is connected while it was previously already.');
      });

      it('on close event should try to reconnect', () => {
        const socket = client.client.socket;

        sinon.spy(client, 'retryConnection');

        socket.emit('close', 1);

        should(client.retryConnection).be.calledOnce();
      });

      it('on close should try reconnecting if :close was not explicitly called', () => {
        const
          retrySpy = sandbox.spy(client, 'retryConnection'),
          closeSpy = sandbox.spy(client, 'close'),
          socket = client.client.socket;

        client.onCloseHandlers.push(sinon.spy());

        // calling multiple times to check only one retry is issued
        socket.emit('close', 1);
        socket.emit('close', 1);
        socket.emit('close', 1);

        clock.tick(20000);

        should(socket.__events.close[0]).be.calledThrice();

        should(closeSpy).be.calledOnce();
        should(retrySpy).be.calledOnce();
        should(client.onCloseHandlers[0]).be.calledOnce();
      });

      it('on error should set the client state to retrying and retry to connect', () => {
        const
          retrySpy = sandbox.spy(client, 'retryConnection'),
          closeSpy = sandbox.spy(client, 'close'),
          socket = client.client.socket;

        client.onErrorHandlers.push(sinon.spy());

        // calling multiple times to check only one retry is issued
        socket.emit('error', new Error('test'));
        socket.emit('error', new Error('test'));
        socket.emit('error', new Error('test'));

        clock.tick(20000);

        should(socket.__events.error[0]).be.calledThrice();

        should(closeSpy).be.calledOnce();
        should(retrySpy).be.calledOnce();
        should(client.onErrorHandlers[0]).be.calledOnce();
      });
    });

    describe('#ping/pong keep-alive', () => {
      beforeEach(() => {
        client.onConnectHandlers = [];
        client.onCloseHandlers = [];
        client.onErrorHandlers = [];

        client.ws = () => new WSClientMock();

        return Bluebird.all([server.init()]);
      });

      it('should clear ping timeout and interval once connected', done => {
        let clientConnected = client.init();
        let socket = client.client.socket;
        let fakePongListener = function fakePongListener() {};

        client._pingRequestIntervalId = 'fakeIntervalId';
        client._pingRequestTimeoutId = 'fakeTimeoutId';
        socket.on('pong', fakePongListener);

        socket.emit('open', 1);

        clientConnected
          .then(() => {
            let pongListeners = socket.listeners('pong');

            should(pongListeners.length)
              .be.equal(1, 'previous pong handler must not be stacked with new one');

            should(pongListeners[0])
              .be.not.eql(fakePongListener, 'previous pong handler must be cleared, but still present');

            should(client._pingRequestIntervalId)
              .be.not.equal('fakeIntervalId', 'old ping interval id should be erased');

            should(client._pingRequestTimeoutId)
              .be.not.equal('fakeTimeoutId', 'old ping timeout id should be erased');

            done();
          })
          .catch(err => done(err));
      });

      it('should send ping request to server once connected', done => {
        let clientConnected = client.init();
        let socket = client.client.socket;

        socket.emit('open', 1);

        clientConnected
          .then(() => {
            should(socket.ping)
              .be.calledOnce();

            should(client._pingRequestTimeoutId)
              .be.not.equal(null, 'ping response timeout should be registered');

            should(client._pingRequestIntervalId)
              .be.equal(null, 'ping interval should not be registered until pong result has come');

            done();
          })
          .catch(err => done(err));
      });

      it('should clear ping timeout once pong is received', done => {
        let clientConnected = client.init();
        let socket = client.client.socket;

        socket.emit('open', 1);

        clientConnected
          .then(() => {
            should(socket.ping)
              .be.calledOnce();

            should(client._pingRequestTimeoutId)
              .be.not.equal(null, 'ping response timeout should be registered');

            socket.emit('pong', 1);

            should(client._pingRequestTimeoutId)
              .be.equal(null, 'ping response timeout should be cleared due to pong response');

            done();
          })
          .catch(err => done(err));
      });

      it('should delay new ping request once pong is received', () => {
        let clientConnected = client.init();
        let socket = client.client.socket;

        socket.emit('open', 1);

        return clientConnected
          .then(() => {
            should(socket.ping)
              .be.calledOnce();

            should(client._pingRequestIntervalId)
              .be.equal(null, 'ping interval should not be registered until pong is received');

            socket.emit('pong', 1);

            should(client._pingRequestIntervalId)
              .be.not.equal(null, 'ping interval should be registered due to pong response');

            clock.tick(60001);

            should(socket.ping).be.calledTwice();

            return null;
          });
      });

      it('should retry to connect if pong response timed out', () => {
        let clientConnected = client.init();
        let socket = client.client.socket;

        sandbox.spy(client, 'retryConnection');

        socket.emit('open', 1);

        socket.readyState = WS.OPEN;

        return clientConnected
          .then(() => {
            should(socket.ping)
              .be.calledOnce();

            should(client._pingRequestTimeoutId)
              .be.not.equal(null, 'ping response timeout should be registered');

            clock.tick(501);

            should(client.retryConnection)
              .be.calledOnce();

            return null;
          });
      });

      it('should clear ping timeout and interval if socket received an error', () => {
        let clientConnected = client.init();
        let socket = client.client.socket;
        let fakePongListener = function fakePongListener() {};
        let pongListeners;

        client._pingRequestIntervalId = 'fakeIntervalId';
        client._pingRequestTimeoutId = 'fakeTimeoutId';
        socket.on('pong', fakePongListener);

        socket.emit('open', 1);

        return clientConnected
          .then(() => {
            socket.emit('error', new Error('test errors'));

            pongListeners = socket.listeners('pong');

            should(pongListeners.length)
              .be.equal(0, 'previous pong handler must be cleared');

            should(client._pingRequestIntervalId)
              .be.equal(null, 'old ping interval id should be cleared');

            should(client._pingRequestTimeoutId)
              .be.equal(null, 'old ping timeout id should be cleared');

            return null;
          });
      });

      it('should clear ping timeout and interval if socket got disconnected', () => {
        let clientConnected = client.init();
        let socket = client.client.socket;
        let fakePongListener = function fakePongListener() {};
        let pongListeners;

        client._pingRequestIntervalId = 'fakeIntervalId';
        client._pingRequestTimeoutId = 'fakeTimeoutId';
        socket.on('pong', fakePongListener);

        socket.emit('open', 1);

        return clientConnected
          .then(() => {
            socket.emit('close', 1);

            pongListeners = socket.listeners('pong');

            should(pongListeners.length)
              .be.equal(0, 'previous pong handler must be cleared');

            should(client._pingRequestIntervalId)
              .be.equal(null, 'old ping interval id should be cleared');

            should(client._pingRequestTimeoutId)
              .be.equal(null, 'old ping timeout id should be cleared');

            return null;
          });
      });
    });
  });

  describe('Server', () => {
    let
      client1,
      client2,
      client3,
      ws;

    beforeEach(() => {
      /** @type InternalBroker */
      server = new WSBrokerServerRewire('internalBroker', {}, kuzzle.pluginsManager);
      ws = server.ws;
      server.ws = cb => {
        server.wss = new WSServerMock();
        cb();
      };
      server.onErrorHandlers = [];

      client1 = new WSBrokerClient('internalBroker', {host: 'host', port: 42}, kuzzle.pluginsManager);
      client2 = new WSBrokerClient('internalBroker', {host: 'host', port: 42}, kuzzle.pluginsManager);
      client3 = new WSBrokerClient('internalBroker', {host: 'host', port: 42}, kuzzle.pluginsManager);
      client1.ws = client2.ws = client3.ws = () => new WSClientMock(server.wss);

      return Bluebird.all([
        server.init(),
        client1.init(),
        client2.init(),
        client3.init()
      ]);
    });

    describe('#ws', () => {
      let fsStub;

      beforeEach(() => {
        fsStub = {
          existsSync: sinon.stub().returns(true),
          unlinkSync: sinon.stub()
        };

        mockrequire('fs', fsStub);

        mockrequire('http', {
          createServer: sinon.stub().returns({
            listen: sinon.stub(),
            on: sinon.spy()
          })
        });

        mockrequire('net', {
          connect: sinon.stub().returns({
            on: sinon.spy()
          })
        });

        mockrequire('uws', {
          Server: sinon.spy(WSServerMock)
        });

        mockrequire.reRequire('../../../lib/services/broker/wsBrokerServer');
        WSBrokerServerRewire = rewire('../../../lib/services/broker/wsBrokerServer');
      });

      it('should trigger an error if no valid connection option is given', () => {
        return should(() => {
          ws.call(server, () => {});
        })
          .throw(InternalError, {message: 'Invalid configuration provided for internalBroker. "port" must be provided.'});
      });

      it('should create a TCP host:port based Websocket server', () => {
        const cb = sinon.spy();

        server = new WSBrokerServerRewire('broker', {host: 'host', port: 'port'}, kuzzle.pluginsManager);
        server.ws(cb);

        should(WSBrokerServerRewire.__get__('http.createServer'))
          .be.calledOnce();

        const httpServer = WSBrokerServerRewire.__get__('http.createServer').firstCall.returnValue;

        should(httpServer.listen)
          .be.calledOnce()
          .be.calledWith('port', 'host');

        httpServer.listen.firstCall.args[2]();

        should(WSBrokerServerRewire.__get__('WS'))
          .be.calledOnce()
          .be.calledWith({ server: httpServer }, {perMessageDeflate: false});

        should(cb)
          .be.calledOnce();
      });

      it('should create a TCP port based Websocket server', () => {
        const cb = sinon.spy();

        server = new WSBrokerServerRewire('broker', {port: 'port'}, kuzzle.pluginsManager);
        server.ws(cb);

        const httpServer = WSBrokerServerRewire.__get__('http.createServer').firstCall.returnValue;

        should(httpServer.listen)
          .be.calledOnce()
          .be.calledWith('port');
        should(httpServer.listen.firstCall.args)
          .have.length(2);
      });
    });

    describe('#init', () => {
      it('should resolve and warn if the broker is disabled', () => {
        server.isDisabled = true;

        return server.init()
          .then(() => {
            should(server.pluginsManager.trigger)
              .be.calledWith('log:warn', 'Internal broker disabled by configuration');
          });
      });

      it('should reject the promise if already started', () => {
        return should(server.init()).be.rejectedWith(InternalError);
      });

      it('should attach some callbacks', () => {
        const socket = server.wss;

        // 1st listener is injected in the mock to emit the 'open' event
        should(socket.on).be.calledThrice();
        should(socket.on.secondCall).be.calledWith('connection');
        should(socket.on.thirdCall).be.calledWith('error');
      });

    });

    describe('#broadcast', () => {
      it('should do nothing if the room is not defined', () => {
        should(server.broadcast('idontexist')).be.exactly(-1);
      });

      it('should send the message to all subscribers but the emitter', () => {
        server.rooms = {
          test: new CircularList([
            client1.client.socket,
            client2.client.socket,
            client3.client.socket
          ])
        };

        const response = server.broadcast('test', {foo: 'bar'}, client2.client.socket);

        should(response).be.exactly(2);
      });

      it('should trigger the plugin manager if an error occured', () => {
        const error = new Error();

        server.rooms = {
          test: new CircularList([ client1.client.socket ])
        };
        client1.client.socket.send = sinon.stub().throws(error);

        const response = server.broadcast('test', {foo: 'bar'}, client2.client.socket);

        should(response).be.exactly(0);
        should(kuzzle.pluginsManager.trigger.lastCall).be.calledWith('log:error', error);
      });

    });

    describe('#send', () => {
      it('should do nothing if the room does not exist', () => {
        return should(server.send('idontexist')).be.null();
      });

      it('should do nothing is the emitter is the only client', () => {
        server.rooms = {
          test: new CircularList([ client1.client.socket ])
        };

        const response = server.send('test', {foo: 'bar'}, client1.client.socket);

        should(response).be.null();
      });

      it('should send data to one of the other clients', () => {
        server.rooms = {
          test: new CircularList([
            client1.client.socket,
            client2.client.socket,
            client3.client.socket
          ])
        };


        const response = server.send('test', {foo: 'bar'}, client1.client.socket);

        should(response).be.exactly(client2.client.socket);
        should(client2.client.socket.send).be.calledOnce();
        should(client2.client.socket.send).be.calledWith(JSON.stringify({
          room: 'test',
          data: { foo: 'bar' }
        }));

        should(client1.client.socket.send).callCount(0);
        should(client3.client.socket.send).callCount(0);
      });

    });

    describe('#dispatch', () => {

      it('should do nothing if the room does not exist', () => {
        should(server.dispatch('idontexist')).be.exactly(-1);
      });

      it('should call the handlers attached to the room', () => {
        const
          data = { foo: 'bar' },
          stub1 = sinon.stub(),
          stub2 = sinon.stub(),
          stub3 = sinon.stub(),
          stub4 = sinon.stub();

        server.handlers = {
          test1: [ stub1 ],
          test2: [ stub2, stub3 ],
          test3: [ stub4 ]
        };

        should(server.dispatch('test1', data)).be.exactly(1);
        should(stub1).be.calledOnce();
        should(stub1).be.calledWith(data);
        should(stub2).callCount(0);
        should(stub3).callCount(0);
        should(stub4).callCount(0);

        should(server.dispatch('test2', data)).be.exactly(2);
        should(stub2).be.calledOnce();
        should(stub2).be.calledWith(data);
        should(stub3).be.calledOnce();
        should(stub3).be.calledWith(data);
        should(stub4).callCount(0);
      });

    });

    describe('#listen', () => {

      it('should attach the given callback to the proper room', () => {
        const cb = {};

        server.listen('test', cb);

        should(server.handlers).be.eql({
          test: [cb]
        });
      });

    });

    describe('#waitForClients', () => {

      it('should return a fulfilled promise if some clients are already connected to the room', () => {
        server.rooms = { test: true };

        return should(server.waitForClients('test')).be.fulfilled();
      });

      it('should never resolve unless a client connects', () => {
        const response = server.waitForClients('test');

        // wait 30m
        clock.tick(1000 * 1800);
        should(response.isPending()).be.true();

        server.rooms = { test: true };
        clock.tick(200);

        return should(response).be.fulfilled();
      });
    });

    describe('#unsubscribe', () => {
      it('should remove the events attached to a room', () => {
        server.handlers = {
          test: [ 1, 5 ],
          test2: [ 3 ]
        };

        server.unsubscribe('test');

        should(server.handlers).eql({
          test2: [3]
        });
      });

    });

    describe('#close', () => {
      it('should close the underlying socket', () => {
        const socket = server.wss;

        server.close();

        should(server.wss).be.null();
        should(socket.close).be.calledOnce();
      });

    });

    describe('#socket', () => {
      it('is just a getter', () => {
        const result = server.socket();

        should(result).be.exactly(server.wss);
      });
    });

    describe('#removeClient', () => {
      it('should close the client connection and clean up the rooms', () => {
        const
          clientSocket = new WSClientMock(server.wss),
          removeClient = WSBrokerServerRewire.__get__('removeClient');

        server.rooms = {
          test: new CircularList([clientSocket])
        };
        server.onCloseHandlers = [sinon.spy()];

        removeClient(server, clientSocket);

        should(server.rooms).be.eql({ });
        should(server.rooms).be.empty();

        should(server.onCloseHandlers[0])
          .be.calledOnce()
          .be.calledWith('test');
      });

    });

    describe('#events', () => {
      it('client listen', () => {
        const
          serverSocket = server.wss,
          clientSocket = new WSClientMock(serverSocket);

        serverSocket.emit('connection', clientSocket);

        clientSocket.emit('message', JSON.stringify({
          action: 'listen',
          room: 'test'
        }));

        should(server.rooms).be.eql({
          test: new CircularList([clientSocket])
        });
      });

      it('client unsubscribe', () => {
        const
          serverSocket = server.wss,
          clientSocket = new WSClientMock(serverSocket);

        server.rooms = {
          test: new CircularList([ clientSocket ])
        };

        serverSocket.emit('connection', clientSocket);

        clientSocket.emit('message', JSON.stringify({
          action: 'unsubscribe',
          room: 'test'
        }));

        should(server.rooms).be.eql({});
      });

      it('client send', () => {
        const
          serverSocket = server.wss,
          clientSocket = new WSClientMock(serverSocket),
          dispatchSpy = sandbox.spy(server, 'dispatch'),
          sendSpy = sandbox.spy(server, 'send');

        serverSocket.emit('connection', clientSocket);

        clientSocket.emit('message', JSON.stringify({
          action: 'send',
          room: 'test',
          data: {foo: 'bar'}
        }));

        should(dispatchSpy).be.calledOnce();
        should(dispatchSpy).be.calledWith('test', {foo: 'bar'});
        should(sendSpy).be.calledOnce();
        should(sendSpy).be.calledWith('test', {foo: 'bar'}, clientSocket);
      });

      it('client broadcast', () => {
        const
          serverSocket = server.wss,
          clientSocket = new WSClientMock(serverSocket),
          dispatchSpy = sandbox.spy(server, 'dispatch'),
          broadcastSpy = sandbox.spy(server, 'broadcast');


        serverSocket.emit('connection', clientSocket);

        clientSocket.emit('message', JSON.stringify({
          action: 'broadcast',
          room: 'test',
          data: {foo: 'bar'}
        }));

        should(dispatchSpy).be.calledOnce();
        should(dispatchSpy).be.calledWith('test', {foo: 'bar'});
        should(broadcastSpy).be.calledOnce();
        should(broadcastSpy).be.calledWith('test', {foo: 'bar'}, clientSocket);
      });

      it('client close', () => {
        const
          serverSocket = server.wss,
          clientSocket = new WSClientMock(serverSocket),
          removeClientSpy = sinon.spy();

        serverSocket.emit('connection', clientSocket);

        WSBrokerServerRewire.__with__('removeClient', removeClientSpy)(() => {
          clientSocket.emit('close', 1, 'test');

          should(removeClientSpy).be.calledOnce();
          should(removeClientSpy).be.calledWith(server, clientSocket);

          should(kuzzle.pluginsManager.trigger.lastCall).be.calledWith('log:info', 'client disconnected [1] test');
        });
      });

      it('server error', () => {
        const
          serverSocket = server.wss,
          error = new Error();

        server.onErrorHandlers.push(sinon.spy());

        serverSocket.emit('error', error);

        should(server.pluginsManager.trigger).have.callCount(4);
        should(server.pluginsManager.trigger.lastCall).be.calledWith('log:error');
        should(server.onErrorHandlers[0]).be.calledOnce();
      });
    });
  });
});
