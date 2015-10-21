/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

require('should-promised');

describe('Test: notifier.notify', function () {
  var
    kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    return kuzzle.start(params, {dummy: true});
  });

  it('should do nothing when no rooms to notify are provided', function () {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: function() { didSomething++; }
    })(function () {
      notifier = new Notifier(kuzzle);
      notifier.notify(null, {}, {});
      notifier.notify([], {}, {});
      notifier.notify(undefined, {}, {});
    });

    should(didSomething).be.exactly(0);
  });

  it('should be able to notify when only one room is provided', function () {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: function() { didSomething++; }
    })(function () {
      notifier = new Notifier(kuzzle);
      notifier.notify('foobar', {}, {});
    });

    should(didSomething).be.exactly(1);
  });

  it('should be able to notify when multiple rooms are provided', function () {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: function () { didSomething++; }
    })(function () {
      notifier = new Notifier(kuzzle);
      notifier.notify(['foo', 'bar', 'baz'], {}, {});
    });

    should(didSomething).be.exactly(3);
  });
});
