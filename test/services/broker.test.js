var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  rewire = require('rewire'),
  brokerServer,
  brokerClient1,
  brokerClient2,
  brokerClient3;

describe('Testing: Internal broker service', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.config.broker.port = 6666;
        brokerServer = rewire('../../lib/services/' + kuzzle.config.services.broker);
        return brokerServer.init(kuzzle.config, true);
      })
      .then(function () {
        brokerClient1 = rewire('../../lib/services/' + kuzzle.config.services.broker);
        return brokerClient1.init(kuzzle.config, false);
      })
      .then(function () {
        brokerClient2 = rewire('../../lib/services/' + kuzzle.config.services.broker);
        return brokerClient2.init(kuzzle.config, false);
      })
      .then(function () {
        brokerClient3 = rewire('../../lib/services/' + kuzzle.config.services.broker);
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
      brokerServer.add(room, testMessage);
      brokerClient1.add(room, testMessage);
      brokerClient2.add(room, testMessage);
      brokerClient3.add(room, testMessage);
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

  it('should support listenOnce() capabilities', function (done) {
    var
      room = 'unit-test-listenOnce-room',
      testMessage = 'foobar',
      messagesReceived = 0;

    brokerServer.listenOnce(room, function (msg) {
      should(msg).be.exactly(testMessage);
      messagesReceived++;
    });

    brokerClient1.listenOnce(room, function (msg) {
      should(msg).be.exactly(testMessage);
      messagesReceived++;
    });

    setTimeout(function () {
      brokerServer.add(room, testMessage);
      brokerClient1.add(room, testMessage);
      brokerClient2.add(room, testMessage);
      brokerClient3.add(room, testMessage);
    }, 20);

    setTimeout(function () {
      try {
        should(messagesReceived).be.exactly(2);
        done();
      }
      catch (e) {
        done(e);
      }
    }, 50);
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

    brokerServer.listen(room, listen);
    brokerClient1.listen(room, listen);
    brokerClient2.listen(room, listen);
    brokerClient3.listen(room, listen);

    setTimeout(function () {
      brokerServer.add(room, testMessage);
      brokerClient1.add(room, testMessage);
      brokerClient2.add(room, testMessage);
      brokerClient3.add(room, testMessage);
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
});
