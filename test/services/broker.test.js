var
  should = require('should'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Testing: Internal broker service', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should be able to emit and to listen to messages', function () {
    var
      room = 'unit-test-listen-room',
      testMessage = 'foobar',
      messagesReceived = 0;

    kuzzle.services.list.broker.listen(room, function (msg) {
      should(msg).be.exactly(testMessage);
      messagesReceived++;
    });

    kuzzle.services.list.broker.add(room, testMessage);
    kuzzle.services.list.broker.add(room, testMessage);
    kuzzle.services.list.broker.add(room, testMessage);

    setTimeout(function () {
      should(messagesReceived).be.exactly(3);
    }, 200);
  });

  it('should support listenOnce() capabilities', function () {
    var
      room = 'unit-test-listenOnce-room',
      testMessage = 'foobar',
      messagesReceived = 0;

    kuzzle.services.list.broker.listenOnce(room, function (msg) {
      should(msg).be.exactly(testMessage);
      messagesReceived++;
    });

    kuzzle.services.list.broker.add(room, testMessage);
    kuzzle.services.list.broker.add(room, testMessage);
    kuzzle.services.list.broker.add(room, testMessage);

    setTimeout(function () {
      should(messagesReceived).be.exactly(1);
    }, 200);
  });

  it('should send a message to only one of the registered listeners', function () {
    var
      room = 'unit-test-broadcast-room',
      testMessage = 'foobar',
      messagesReceived = 0,
      listen = function (msg) {
        should(msg).be.exactly(testMessage);
        messagesReceived++;
      };

    kuzzle.services.list.broker.listen(room, listen);
    kuzzle.services.list.broker.listen(room, listen);
    kuzzle.services.list.broker.listen(room, listen);

    kuzzle.services.list.broker.add(room, testMessage);

    setTimeout(function () {
      should(messagesReceived).be.exactly(1);
    }, 200);
  });
});
