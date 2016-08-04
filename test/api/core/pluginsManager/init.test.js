var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    loadPluginsCalled,
    pluginsManager;

  before(() => {
    kuzzle = new Kuzzle();
    pluginsManager = new PluginsManager(kuzzle);
    PluginsManager.__set__('loadPlugins', () => {
      loadPluginsCalled = true;
    });
  });

  it('should load plugins at init', () => {
    loadPluginsCalled = false;
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
          should(loadPluginsCalled).be.true();
          should(pluginsManager.plugins).match({ plugin1: { foo: 'bar' }, plugin2: { foo: 'baz' } });
        });
    });
  });
});