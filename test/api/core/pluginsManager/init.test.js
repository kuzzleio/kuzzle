var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pluginsManager = new PluginsManager(kuzzle);
    pluginsManager.packages = kuzzle.pluginsManager.packages;
  });

  it('should load plugins at init', () => {
    var spy = sinon.spy();

    return PluginsManager.__with__({
      loadPlugins: spy
    })(() => {
      pluginsManager.init();
      should(spy)
        .be.calledOnce();
    });
  });
});
