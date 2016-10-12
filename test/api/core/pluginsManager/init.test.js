var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    pluginsManager;

  before(() => {
    kuzzle = new Kuzzle();
    pluginsManager = new PluginsManager(kuzzle);
  });

  it('should load plugins at init', () => {
    var loadPluginsStub = sinon.stub();

    return PluginsManager.__with__({
      getPluginsList: () => {
        return Promise.resolve({
          plugin1: {foo: 'bar'},
          plugin2: {foo: 'baz'}
        });
      },
      loadPlugins: loadPluginsStub
    })(() => {
      return pluginsManager.init()
        .then(() => {
          should(loadPluginsStub.called).be.true();
          should(pluginsManager.plugins).match({ plugin1: { foo: 'bar' }, plugin2: { foo: 'baz' } });
        });
    });
  });

  it('should discard a plugin if it fails to load', () => {
    return PluginsManager.__with__({
      getPluginsList: () => {
        return Promise.resolve({
          plugin1: {foo: 'bar'},
          plugin2: {foo: 'baz'}
        });
      }
    })(() => {
      return pluginsManager.init()
        .then(() => {
          should(pluginsManager.plugins).match({});
        });
    });
  });
});
