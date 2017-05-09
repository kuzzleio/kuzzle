const
  mockrequire = require('mock-require'),
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
      delete: sinon.stub()
    };

    mockrequire('pm2', pm2Mock);
    PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

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
});
