var
  should = require('should'),
  rewire = require('rewire'),
  rc = require('rc'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  CleanAndPrepare = rewire('../../lib/services/cleanAndPrepare');

describe('Testing: Clean and Prepare service', function () {
  var
    kuzzle,
    cleanAndPrepare,
    cleanAndPrepareCallback = CleanAndPrepare.__get__('onListenCB'),
    room,
    cleanDbDone = false,
    prepareDbDone = false,
    addedMessage;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        cleanAndPrepare = new CleanAndPrepare(kuzzle);

        kuzzle.services.list.broker.add = function (destination, message) {
          room = destination;
          addedMessage = message;
        };

        kuzzle.cleanDb = function() {cleanDbDone = true; return q();};
        kuzzle.prepareDb = function() {prepareDbDone = true; return q();};

        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  beforeEach(function () {
    room = '';
    addedMessage = {};
  });

  it('should have init function', function () {
    should(kuzzle.services.list.cleanAndPrepare.init).be.Function();
  });

  it('should register to the remote actions queues when initializing', function () {
    var
      expectedQueues = [
        kuzzle.config.queues.cleanAndPrepareQueue + '-' + process.pid,
        kuzzle.config.queues.cleanAndPrepareQueue
      ],
      registeredQueues = [];

    kuzzle.services.list.broker.listen = function (queue) {
      registeredQueues.push(queue);
    };

    cleanAndPrepare.init();

    should(registeredQueues.length).be.exactly(2);
    should(registeredQueues.sort()).match(expectedQueues.sort());
  });

  it('should ignore actions sent without an id', function () {
    var
      ret;

    ret = cleanAndPrepareCallback({});

    should(ret).be.false();
    should(room).be.exactly('');
  });

  it('should ignore actions sent without an id', function () {
    var
      ret,
      params = rc('kuzzle');
      params._ = ['likeAvirgin', 'all'];

    kuzzle.cleanAndPrepare(params);
    setTimeout(() => {
      should(cleanDbDone).be.true();
      should(prepareDb).be.true();
      done();
    }, 1000);

  });
});
