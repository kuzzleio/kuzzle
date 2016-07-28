var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    loadPlugins,
    loadPluginsCalled,
    pluginsManager;

  before(() => {
    kuzzle = new KuzzleServer();
    pluginsManager = new PluginsManager(kuzzle);
    loadPlugins = PluginsManager.__set__('loadPlugins', plugins => {
      loadPluginsCalled = true;
    });
  });

  it('should load plugins at init', () => {
    loadPluginsCalled = false;
    return PluginsManager.__with__({
      getPluginsList: (kuzzle, isServer) => {
        return Promise.resolve({
          plugin1: {foo: 'bar'},
          plugin2: {foo: 'baz'}
        });
      }
    })(() => {
      return pluginsManager.init()
        .then(() => {
          should(loadPluginsCalled).be.true();
          should(pluginsManager.plugins).match({ plugin1: { foo: 'bar' }, plugin2: { foo: 'baz' } });
        });
    });
  });
});