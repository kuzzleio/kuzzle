/**
 * Test of the init() function of the notifier core component.
 * This function initializes the component at the start of Kuzzle.
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

require('should-promised');

describe('Test: notifier.init', function () {
  var
    kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
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
