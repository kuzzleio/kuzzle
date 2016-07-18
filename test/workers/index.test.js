var
  should = require('should'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  WLoader = require('../../lib/workers/index'),
  sinon = require('sinon');

describe('Testing: workers loader', function () {
  var
    kuzzle,
    loader,
    workersList = [];

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        Object.keys(kuzzle.config.workers).forEach(function (workerGroup) {
          kuzzle.config.workers[workerGroup].forEach(function (worker) {
            workersList.push(worker);
          });
        });

        kuzzle.services.list.broker.listen = sinon.stub();
        kuzzle.services.init = sinon.stub().resolves();
        workersList = _.uniq(workersList);

        loader = new WLoader(kuzzle);
      });
  });

  beforeEach(function () {
    loader.list = {};
  });

  it('should have an init() function', function () {
    should(loader.init).be.a.Function();
  });

  it('should initialize a list of loaded workers when starting', function () {
    return loader.init()
      .then(() => {
        should(Object.keys(loader.list).length).be.exactly(workersList.length);
        should(Object.keys(loader.list)).match(workersList);
      });
  });

  it('should not load a worker multiple times', function () {
    var
      saved = kuzzle.config.workers;

    kuzzle.config.workers = {
      foo: ['write'],
      bar: ['write', 'write'],
      baz: ['write']
    };

    return loader.init()
      .then(() => {
        kuzzle.config.workers = saved;

        should(Object.keys(loader.list).length).be.exactly(workersList.length);
        should(Object.keys(loader.list)).match(workersList);
      });
  });

  it('should be reentrant', function () {
    return Promise.all([loader.init(), loader.init(), loader.init()])
      .then(() => {
        should(Object.keys(loader.list).length).be.exactly(workersList.length);
        should(Object.keys(loader.list)).match(workersList);
      });
  });

  it('should raise an error if a worker cannot be loaded', function () {
    kuzzle.config.workers = {
      foo: ['foo', 'write', 'bar']
    };

    return should(loader.init()).be.rejected();
  });
});
