var
  should = require('should'),
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  IPCBroker = rewire('../../../lib/services/internalbroker');

require('should-promised');

/*
Tests the Internal Broker implementation
General broker capabilities are tested in the ../broker.test.js test file.
 */
describe('Test: Internal Broker service ', function () {
  var
    kuzzle,
    brokerServer,
    brokerClient;

  before(function () {
    kuzzle = {
      config: {
        broker: {
          host: 'localhost',
          port: '6666'
        }
      }
    };

    kuzzle.log = new captainsLog({level: 'silent'});
    brokerServer = new IPCBroker(kuzzle, { isServer: true });
    brokerClient = new IPCBroker(kuzzle, { isServer: false });
  });

  after(function () {
    brokerServer.close();
    brokerClient.close();
  });

  it('should spawn a web socket server when invoked with server=true', function (done) {
    brokerServer.init()
      .then(function () {
        should(brokerServer.isServer).be.true();
        should(brokerServer.server).not.be.null();
        done();
      })
      .catch(function (e) {
        done(e);
      });
  });

  it('should not try to spawn a server when one is already running', function () {
    return should(brokerServer.init()).be.rejected();
  });

  it('should be able to connect over TCP/IP', function () {
    var clientConnect = IPCBroker.__get__('clientConnect');

    return brokerClient.init()
      .then(function () {
        return clientConnect.call(brokerClient);
      })
      .then(function () {
        should(brokerClient.client.socket).not.be.null();
        should(brokerClient.client.state).be.exactly('connected');
        return should(brokerClient.client.connected.promise).be.fulfilled();
      });
  });

  it('should automatically reconnect when the socket closes', function (done) {
    brokerClient.client.retryInterval = 10;
    brokerClient.client.socket._socket.destroy();

    setTimeout(function () {
      try {
        should(brokerClient.client.socket).be.null();
        should(brokerClient.client.connected).be.null();
        should(brokerClient.client.state).not.be.equal('connected');
      }
      catch (e) {
        done(e);
      }

      setTimeout(function () {
        try {
          should(brokerClient.client.socket).not.be.null();
          should(brokerClient.client.state).be.exactly('connected');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 100);
    }, 0);
  });

  it('should automatically reconnect when the socket crashes', function (done) {
    brokerClient.client.retryInterval = 10;
    brokerClient.client.socket.emit('error', new Error('ECONNRESET'));

    setTimeout(function () {
      try {
        should(brokerClient.client.socket).be.null();
        should(brokerClient.client.connected).be.null();
        should(brokerClient.client.state).not.be.equal('connected');
      }
      catch (e) {
        done(e);
      }

      setTimeout(function () {
        try {
          should(brokerClient.client.socket).not.be.null();
          should(brokerClient.client.state).be.exactly('connected');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 100);
    }, 0);
  });

  it('should register only 1 listener on multiple subscriptions', function () {
    var
      addListener = IPCBroker.__get__('addListener'),
      room = 'foo',
      fakeListener = function () {};

    addListener.call(brokerServer, room, fakeListener, brokerServer.uuid);
    addListener.call(brokerServer, room, fakeListener, brokerServer.uuid);
    addListener.call(brokerServer, room, fakeListener, brokerServer.uuid);

    should.exist(brokerServer.rooms[room]);
    should(brokerServer.rooms[room].listeners.length).be.exactly(1);
    delete brokerServer.rooms.foo;
  });

  it('should only accept callbacks or sockets listeners', function (done) {
    var room = 'listen-test';
    try {
      brokerServer.listen(room, null);
      brokerServer.listen(room, { _socket: 'foobar' });
      brokerClient.listen(room, 'foobar');
      brokerClient.listen(room, [ 'One', 'cannot', 'simply', 'walk', 'into', 'Mordor']);

      should.not.exist(brokerServer.rooms[room]);
      should.not.exist(brokerClient.rooms[room]);
      done();
    }
    catch (e) {
      done(e);
    }
  });

  it('should handle client disconnections properly', function (done) {
    var
      room = 'unit-test-disconnection-room',
      messages = 0,
      listen = function () { messages++; };

    brokerClient.listen(room, listen);

    setTimeout(function () {
      try {
        should(brokerServer.rooms[room].listeners.length).be.exactly(1);
        brokerClient.close();

        setTimeout(function () {
          try {
            brokerServer.add(room, 'foobar');
            should.not.exist(brokerServer.rooms[room]);
            should(messages).be.exactly(0);
            done();
          }
          catch (e) {
            done(e);
          }
        }, 20);
      }
      catch (e) {
        done(e);
      }
    }, 20);
  });

  it('should re-register listening requests when reconnecting to the server', function (done) {
    var
      room1 = 'unit-test-register-again',
      room2 = 'unit-test-register-again-listenOnce',
      listenCB = function () { },
      listenOnceCB = function () { };

    brokerClient.client.retryInterval = 1;
    brokerClient.listen(room1, listenCB);
    brokerClient.listenOnce(room2, listenOnceCB);

    setTimeout(function () {
      delete brokerServer.rooms[room1];
      delete brokerServer.rooms[room2];

      brokerClient.client.socket.emit('error', new Error('ECONNRESET'));

      setTimeout(function () {
        try {
          should.exist(brokerServer.rooms[room1]);
          should.exist(brokerServer.rooms[room2]);

          should(brokerServer.rooms[room1].listeners[0].destroyOnUse).be.undefined();
          should(brokerServer.rooms[room2].listeners[0].destroyOnUse).be.true();
          done();
        }
        catch (e) {
          done(e);
        }
      }, 100);
    }, 20);
  });
});
