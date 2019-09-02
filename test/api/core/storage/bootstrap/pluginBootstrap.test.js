const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = require('../../../lib/services/bootstrap/pluginBootstrap');

xdescribe('PluginBoostrap', () => {
  let
    kuzzle,
    pluginBootstrap,
    engine,
    collections;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    engine = kuzzle.internalEngine;
    engine.index = '%someIndex';

    pluginBootstrap = new Bootstrap('pluginName', kuzzle, engine);

    collections = {
      liaa: { properties: {} },
      mehry: { properties: {} },
    };
  });

  describe('#_boostrapSequence', () => {
    beforeEach(() => {
      pluginBootstrap._createCollections = sinon.stub().resolves();
      pluginBootstrap._unlock = sinon.stub().resolves();
    });

    it('should call the initialization methods and then unlock the lock', async () => {
      await pluginBootstrap._boostrapSequence(collections);

      sinon.assert.callOrder(
        pluginBootstrap._createCollections,
        kuzzle.indexCache.add
      );

      should(kuzzle.indexCache.add.callCount).be.eql(2);
    });
  });
});
