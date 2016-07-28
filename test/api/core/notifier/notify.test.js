/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  rewire = require('rewire'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  Notifier = rewire('../../../../lib/api/core/notifier');

describe('Test: notifier.notify', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  it('should do nothing when no rooms to notify are provided', () => {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: () => { didSomething++; }
    })(() => {
      /** @type {Notifier} */
      notifier = new Notifier(kuzzle);
      notifier.notify(null, {}, {});
      notifier.notify([], {}, {});
      notifier.notify(undefined, {}, {});
    });

    should(didSomething).be.exactly(0);
  });

  it('should be able to notify when only one room is provided', () => {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: () => { didSomething++; }
    })(() => {
      /** @type {Notifier} */
      notifier = new Notifier(kuzzle);
      notifier.notify('foobar', {}, {});
    });

    should(didSomething).be.exactly(1);
  });

  it('should be able to notify when multiple rooms are provided', () => {
    var
      notifier,
      didSomething = 0;

    Notifier.__with__({
      send: () => { didSomething++; }
    })(() => {
      /** @type {Notifier} */
      notifier = new Notifier(kuzzle);
      notifier.notify(['foo', 'bar', 'baz'], {}, {});
    });

    should(didSomething).be.exactly(3);
  });
});
