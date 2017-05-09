const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Circularlist = require('easy-circular-list');

describe('CLI Action: shutdown', () => {
  let
    kuzzle,
    pm2Mock,
    PluginsManager,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    pm2Mock = {
      delete: sinon.stub(),
      list: sinon.stub().yields(null, [])
    };

    mockrequire('pm2', pm2Mock);
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');
    PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

    PluginsManager.__set__({
      console: {
        log: sinon.stub()
      },
      setTimeout: sinon.spy(function (...args) { setImmediate(args[0]); })
    });

    pluginsManager = new PluginsManager(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should do nothing if no workers are registered', () => {
    pluginsManager.workers = {};

    return pluginsManager.shutdownWorkers()
      .then(() => {
        should(pm2Mock.delete).not.be.called();
      });
  });

  it('should delete registered workers correctly', () => {
    pluginsManager.workers = {
      foo: {
        pmIds: new Circularlist(['foo', 'bar', 'baz'])
      },
      bar: {
        pmIds: new Circularlist(['qux'])
      }
    };

    return pluginsManager.shutdownWorkers()
      .then(() => {
        should(pm2Mock.delete.callCount).be.eql(4);

        should(pm2Mock.delete).calledWith('foo');
        should(pm2Mock.delete).calledWith('bar');
        should(pm2Mock.delete).calledWith('baz');
        should(pm2Mock.delete).calledWith('qux');

        should(pluginsManager.workers).be.empty();
      });
  });

  it('should wait for worker plugins to shut down before resolving the promise', done => {
    pm2Mock.list.yields(null, [{pm_id: 'foo'}, {pm_id: 'bar'}]);

    pluginsManager.workers = {
      foo: {
        pmIds: new Circularlist(['foo'])
      }
    };

    const promise = pluginsManager.shutdownWorkers();

    setTimeout(() => {
      should(promise.isFulfilled()).be.false();

      pm2Mock.list.yields(null, [{pm_id: 'bar'}]);

      setTimeout(() => {
        should(promise.isFulfilled()).be.true();
        done();
      }, 100);
    }, 100);
  });

  it('should resolve immediately if unable to get the process list from PM2', () => {
    pm2Mock.list.yields(new Error('foobar'), [{pm_id: 'foo'}, {pm_id: 'bar'}]);

    pluginsManager.workers = {
      foo: {
        pmIds: new Circularlist(['foo'])
      }
    };

    return should(pluginsManager.shutdownWorkers()).fulfilled();
  });
});
