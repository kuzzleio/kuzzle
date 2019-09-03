const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  IndexEngine = require('../../../../../lib/api/core/storage/indexEngine'),
  PluginIndexBootstrap = require('../../../../../lib/api/core/storage/bootstrap/pluginIndexBootstrap');

describe('PluginBoostrap', () => {
  let
    kuzzle,
    pluginName,
    pluginIndexName,
    pluginIndexEngine,
    pluginIndexBootstrap,
    collections;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    pluginName = 'test-plugin';
    pluginIndexName = 'plugin:test-plugin';

    pluginIndexEngine = new IndexEngine(
      kuzzle,
      pluginIndexName,
      kuzzle.services.internalStorage);

    pluginIndexBootstrap = new PluginIndexBootstrap(
      pluginName,
      kuzzle,
      pluginIndexEngine);

    collections = {
      liia: { properties: { name: { type: 'keyword' } } },
      mehry: { properties: { name: { type: 'text' } } },
    };
  });

  describe('#_boostrapSequence', () => {
    beforeEach(() => {
      pluginIndexBootstrap._createCollections = sinon.stub().resolves();
      pluginIndexBootstrap._unlock = sinon.stub().resolves();
    });

    it('should call the initialization methods', async () => {
      await pluginIndexBootstrap._boostrapSequence(collections);

      sinon.assert.callOrder(
        pluginIndexBootstrap._createCollections);
      should(pluginIndexBootstrap._createCollections)
        .be.calledWithMatch(collections);
    });
  });

  describe('#_createCollections', () => {
    it('should create collection with the indexEngine', async () => {
      pluginIndexBootstrap.indexEngine.createCollection = sinon.stub().resolves();

      await pluginIndexBootstrap._createCollections(collections);

      should(pluginIndexBootstrap.indexEngine.createCollection)
        .be.calledTwice();

      const firstCallArgs = pluginIndexBootstrap.indexEngine.createCollection
        .getCall(0).args;
      should(...firstCallArgs)
        .match('liia', { properties: { name: { type: 'keyword' } } });

      const secondCallArgs = pluginIndexBootstrap.indexEngine.createCollection
        .getCall(1).args;
      should(...secondCallArgs)
        .match('mehry', { properties: { name: { type: 'text' } } });
    });
  });
});
