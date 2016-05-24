var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  Broker;



describe('Testing: broker service', function () {
  var
    kuzzle,
    brokerServer,
    brokerClient1,
    brokerClient2,
    brokerClient3;


  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        Broker = rewire('../../lib/services/' + kuzzle.config.services.broker);
        kuzzle.config.broker.port = 6666;
        brokerServer = new Broker(kuzzle, { isServer: true });
        return brokerServer.init(kuzzle.config, true);
      })
      .then(function () {
        brokerClient1 = new Broker(kuzzle, { isServer: false });
        return brokerClient1.init(kuzzle.config, false);
      })
      .then(function () {
        brokerClient2 = new Broker(kuzzle, { isServer: false });
        return brokerClient2.init(kuzzle.config, false);
      })
      .then(function () {
        brokerClient3 = new Broker(kuzzle, { isServer: false });
        return brokerClient3.init(kuzzle.config, false);
      })
      .then(function () {
        done();
      })
      .catch(function (e) {
        done(e);
      });
  });

  after(function() {
    brokerClient1.close();
    brokerClient2.close();
    brokerClient3.close();
    brokerServer.close();
  });

  it('should be able to emit and to listen to messages', function (done) {
    var
      room = 'unit-test-listen-room',
      testMessage = 'foobar',
      messagesReceived = 0;

    brokerServer.listen(room, function (msg) {
      should(msg).be.exactly(testMessage);
      messagesReceived++;
    });

    setTimeout(function () {
      brokerServer.send(room, testMessage);
      brokerClient1.send(room, testMessage);
      brokerClient2.send(room, testMessage);
      brokerClient3.send(room, testMessage);
    }, 20);

    setTimeout(function () {
      try {
        should(messagesReceived).be.exactly(3);
        done();
      }
      catch (e) {
        done(e);
      }
    }, 50);
  });

  it('should allow to unsubscribe from a room', () => {

  });

  it('should send a message to only one of the registered listeners', function (done) {
    var
      room = 'unit-test-dispatch-room',
      testMessage = 'foobar',
      messagesReceived = 0,
      listen = function (msg) {
        should(msg).be.exactly(testMessage);
        messagesReceived++;
      };

    brokerClient1.listen(room, listen);
    brokerClient2.listen(room, listen);
    brokerClient3.listen(room, listen);

    setTimeout(function () {
      brokerServer.send(room, testMessage);
    }, 20);

    setTimeout(function () {
      try {
        should(messagesReceived).be.exactly(1);
        done();
      }
      catch (e) {
        done(e);
      }
    }, 50);
  });

  it('should be able to broadcast a message to all listeners', function (done) {
    var
      room = 'unit-test-broadcast-room',
      testMessage = 'foobar',
      messagesReceived = 0,
      listen = function (msg) {
        should(msg).be.exactly(testMessage);
        messagesReceived++;
      };

    brokerServer.listen(room, listen);
    brokerClient1.listen(room, listen);
    brokerClient2.listen(room, listen);

    setTimeout(function () {
      brokerServer.broadcast(room, testMessage);
      brokerClient1.broadcast(room, testMessage);
    }, 20);

    setTimeout(function () {
      try {
        should(messagesReceived).be.exactly(4);
        done();
      }
      catch (e) {
        done(e);
      }
    }, 50);
  });

  it('should wait for a listener to connect to a given room', function (done) {
    var ret = brokerServer.waitForClients('foo');
    this.timeout(300);

    setTimeout(() => {
      should(ret.inspect().state).be.eql('pending');
      // rooms[idx] is a Circular list object
      brokerServer.handler.rooms.foo = { remove: () => {}, getSize: () => 0 };

      ret.then(() => done()).catch(err => done(err));
    }, 100);
  });
});
