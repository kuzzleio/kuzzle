const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  IndexStorage = require('../../../../../lib/api/core/storage/indexStorage'),
  PluginIndexBootstrap = require('../../../../../lib/api/core/storage/bootstrap/pluginIndexBootstrap');

describe('PluginBoostrap', () => {
  let
    kuzzle,
    pluginName,
    pluginIndexName,
    pluginIndexStorage,
    pluginIndexBootstrap,
    collections;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    pluginName = 'test-plugin';
    pluginIndexName = 'plugin:test-plugin';

    pluginIndexStorage = new IndexStorage(
      kuzzle,
      pluginIndexName,
      kuzzle.services.internalStorage);

    pluginIndexBootstrap = new PluginIndexBootstrap(
      kuzzle,
      pluginName,
      pluginIndexStorage);

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
    it('should create collection with the indexStorage', async () => {
      pluginIndexBootstrap.indexStorage.createCollection = sinon.stub().resolves();

      await pluginIndexBootstrap._createCollections(collections);

      should(pluginIndexBootstrap.indexStorage.createCollection)
        .be.calledTwice();

      const firstCallArgs = pluginIndexBootstrap.indexStorage.createCollection
        .getCall(0).args;
      should(...firstCallArgs)
        .match('liia', { properties: { name: { type: 'keyword' } } });

      const secondCallArgs = pluginIndexBootstrap.indexStorage.createCollection
        .getCall(1).args;
      should(...secondCallArgs)
        .match('mehry', { properties: { name: { type: 'text' } } });
    });
  });
});
