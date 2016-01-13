/**
 * Test of the init() function of the notifier core component.
 * This function initializes the component at the start of Kuzzle.
 */
var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

describe('Test: notifier.init', function () {
  var
    kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should register to the notifier message queue at initialization', function () {
    var
      notifier,
      registeredToQueue = '';

    kuzzle.services.list.broker.listen = function (queue) {
      registeredToQueue = queue;
    };

    notifier = new Notifier(kuzzle);
    notifier.init(kuzzle);

    should(registeredToQueue).be.exactly(kuzzle.config.queues.coreNotifierTaskQueue);
  });
});
