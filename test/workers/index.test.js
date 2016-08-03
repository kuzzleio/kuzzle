var
  should = require('should'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  KuzzleWorker = require.main.require('lib/api/kuzzleWorker'),
  WLoader = require('../../lib/workers/index'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create();

describe('Testing: workers loader', () => {
  var
    kuzzle,
    loader,
    workersList = [];

  before(() => {
    kuzzle = new KuzzleWorker();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        Object.keys(kuzzle.config.workers).forEach(function (workerGroup) {
          kuzzle.config.workers[workerGroup].forEach(function (worker) {
            workersList.push(worker);
          });
        });

        kuzzle.services.list.broker.listen = sinon.stub();
        sandbox.stub(kuzzle.services, 'init').resolves();
        workersList = _.uniq(workersList);

        loader = new WLoader(kuzzle);
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have an init() function', () => {
    should(loader.init).be.a.Function();
  });

  it('should initialize a list of loaded workers when starting', () => {
    return loader.init()
      .then(() => {
        should(Object.keys(loader.list).length).be.exactly(workersList.length);
        should(Object.keys(loader.list)).match(workersList);
      });
  });

  it('should not load a worker multiple times', () => {
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

  it('should be reentrant', () => {
    return Promise.all([loader.init(), loader.init(), loader.init()])
      .then(() => {
        should(Object.keys(loader.list).length).be.exactly(workersList.length);
        should(Object.keys(loader.list)).match(workersList);
      });
  });

  it('should raise an error if a worker cannot be loaded', () => {
    kuzzle.config.workers = {
      foo: ['foo', 'write', 'bar']
    };

    return should(loader.init()).be.rejected();
  });
});
