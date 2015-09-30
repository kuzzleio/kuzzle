var
  should = require('should'),
  _ = require('lodash'),
  q = require('q'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  WLoader = require('../../lib/workers/index');

describe('Testing: workers loader', function () {
  var
    kuzzle,
    loader,
    workersList = [];

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        Object.keys(kuzzle.config.workers).forEach(function (workerGroup) {
          kuzzle.config.workers[workerGroup].forEach(function (worker) {
            workersList.push(worker);
          });
        });

        workersList = _.uniq(workersList);

        loader = new WLoader(kuzzle);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  beforeEach(function () {
    loader.list = {};
  });

  it('should have an init() function', function () {
    should(loader.init).be.a.Function();
  });

  it('should initialize a list of loaded workers when starting', function () {
    loader.init();

    should(Object.keys(loader.list).length).be.exactly(workersList.length);
    should(Object.keys(loader.list)).match(workersList);
  });

  it('should not load a worker multiple times', function () {
    var
      saved = kuzzle.config.workers;

    kuzzle.config.workers = {
      foo: ['write'],
      bar: ['write', 'write'],
      baz: ['write']
    };

    loader.init();
    kuzzle.config.workers = saved;

    should(Object.keys(loader.list).length).be.exactly(workersList.length);
    should(Object.keys(loader.list)).match(workersList);
  });

  it('should be reentrant', function () {
    loader.init();
    loader.init();
    loader.init();

    should(Object.keys(loader.list).length).be.exactly(workersList.length);
    should(Object.keys(loader.list)).match(workersList);
  });

  it('should raise an error and continue if a worker cannot be loaded', function () {
    var
      saved = kuzzle.config.workers,
      error = false;

    kuzzle.config.workers = {
      foo: ['foo', 'write', 'bar']
    };

    kuzzle.once('log:error', function () {
      error = true;
    });

    loader.init();
    kuzzle.config.workers = saved;

    should(Object.keys(loader.list).length).be.exactly(workersList.length);
    should(Object.keys(loader.list)).match(workersList);
    should(error).be.true();
  });
});
