var
  should = require('should'),
  q = require('q'),
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  internalbroker = rewire('../../../lib/services/internalbroker'),
  brokerClient =  rewire('../../../lib/services/internalbroker'),
  kuzzleConfig;

/*
Tests the Internal Broker implementation
General broker capabilities are tested in the ../broker.test.js test file.
 */
describe('Testing: Internal Broker service implementation', function () {
  before(function () {
    kuzzleConfig = {
      broker: {
        host: 'localhost',
        port: '6666'
      }
    };
  });

  it('should spawn a web socket server when invoked with server=true', function (done) {
    internalbroker.init(kuzzleConfig, true)
      .then(function () {
        internalbroker.isServer.should.be.true();
        internalbroker.server.should.not.be.null();
        done();
      })
      .catch(function (e) {
        done(e);
      });
  });

  it('should not try to spawn a server when one is already running', function () {
    internalbroker.init(kuzzleConfig, true).should.be.rejected;
  });

  it('should be able to connect over TCP/IP', function (done) {
    var clientConnect = brokerClient.__get__('clientConnect');

    brokerClient.init(kuzzleConfig, false)
      .then(function () {
        return clientConnect.call(brokerClient);
      })
      .then(function () {
        should(brokerClient.client.socket).not.be.null();
        brokerClient.client.connected.should.be.fullfilled;
        brokerClient.client.state.should.be.exactly('connected');
        done();
      })
      .catch(function (e) {
        done(e);
      });
  });

  it('should automatically reconnect when the socket closes', function (done) {
    brokerClient.client.retryInterval = 10;
    brokerClient.client.socket._socket.destroy();

    setTimeout(function () {
      try {
        should(brokerClient.client.socket).be.null();
        should(brokerClient.client.connected).be.null();
        brokerClient.client.state.should.not.be.equal('connected');
      }
      catch (e) {
        done(e);
      }

      setTimeout(function () {
        try {
          should(brokerClient.client.socket).not.be.null();
          (brokerClient.client.connected).should.be.fullfilled;
          brokerClient.client.state.should.be.exactly('connected');
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
        brokerClient.client.state.should.not.be.equal('connected');
      }
      catch (e) {
        done(e);
      }

      setTimeout(function () {
        try {
          should(brokerClient.client.socket).not.be.null();
          (brokerClient.client.connected).should.be.fullfilled;
          brokerClient.client.state.should.be.exactly('connected');
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
      addListener = internalbroker.__get__('addListener'),
      room = 'foo',
      fakeListener = function () {};

    addListener.call(internalbroker, room, fakeListener, internalbroker.uuid);
    addListener.call(internalbroker, room, fakeListener, internalbroker.uuid);
    addListener.call(internalbroker, room, fakeListener, internalbroker.uuid);

    should.exist(internalbroker.rooms[room]);
    should(internalbroker.rooms[room].listeners.length).be.exactly(1);
    delete internalbroker.rooms['foo'];
  });

  it('should only accept callbacks or sockets listeners', function (done) {
    var room = 'listen-test';
    try {
      internalbroker.listen(room, null);
      internalbroker.listen(room, { _socket: 'foobar' });
      brokerClient.listen(room, 'foobar');
      brokerClient.listen(room, [ 'One', 'cannot', 'simply', 'walk', 'into', 'Mordor']);

      should.not.exist(internalbroker.rooms[room]);
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
        should(internalbroker.rooms[room].listeners.length).be.exactly(1);
        brokerClient.close();

        setTimeout(function () {
          try {
            internalbroker.add(room, 'foobar');
            should.not.exist(internalbroker.rooms[room]);
            should(messages).be.exactly(0);
            done();
          }
          catch (e) {
            done(e);
          }
        }, 20);
      }
      catch (e) {
        console.log(internalbroker.rooms);
        done(e);
      }
    }, 20);
  });
});
