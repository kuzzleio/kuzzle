'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ElasticsearchMock = require('../../mocks/elasticsearch.mock'),
  ClientAdapter = require('../../../lib/core/storage/clientAdapter');

describe('ClientAdapter', () => {
  let
    kuzzle,
    elasticsearch,
    indexCache,
    clientAdapter;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    elasticsearch = new ElasticsearchMock(
      kuzzle,
      kuzzle.config.services.storageEngine,
      'public');

    indexCache = {
      add: sinon.stub().returns(true),
      remove: sinon.stub().returns(true),
      exists: sinon.stub().returns(true),
      listIndexes: sinon.stub().resolves(),
      listCollections: sinon.stub().resolves()
    };

    clientAdapter = new ClientAdapter(elasticsearch, indexCache);
  });

  describe('assertIndexAndCollection methods', () => {
    it('should define methods', () => {
      for (const method of clientAdapter._assertIndexAndCollectionMethods) {
        should(clientAdapter[method]).be.a.Function();
      }
    });

    it('should use index cache to assert index/collection existence and call client method', async () => {
      const method = clientAdapter._assertIndexAndCollectionMethods[6];
      clientAdapter._client[method].resolves('ret');

      const ret = await clientAdapter[method](
        'index',
        'collection',
        'arg1',
        'arg2');

      should(ret).be.eql('ret');
      should(indexCache.exists).be.calledWithMatch({
        index: 'index',
        scope: 'public'
      });
      should(indexCache.exists).be.calledWithMatch({
        index: 'index',
        collection: 'collection',
        scope: 'public'
      });
      should(clientAdapter._client[method])
        .be.calledWith('index', 'collection', 'arg1', 'arg2');
    });
  });

  describe('raw methods', () => {
    it('should define methods', () => {
      for (const method of clientAdapter._rawMethods) {
        should(clientAdapter[method]).be.a.Function();
      }
    });

    it('should call client method', async () => {
      const method = clientAdapter._rawMethods[1];
      clientAdapter._client[method].resolves('ret');

      const ret = await clientAdapter[method](
        'index',
        'collection',
        'arg1',
        'arg2');

      should(ret).be.eql('ret');
      should(clientAdapter._client[method])
        .be.calledWith('index', 'collection', 'arg1', 'arg2');
    });
  });

  describe('#createIndex', () => {
    it('should call client method', async () => {
      clientAdapter._client.createIndex.resolves('ret');

      const ret = await clientAdapter.createIndex('index');

      should(ret).be.eql('ret');
      should(clientAdapter._client.createIndex).be.calledWith('index');
    });
  });

  describe('#createCollection', () => {
    it('should call client method and add collection to cache', async () => {
      clientAdapter._client.createCollection.resolves('ret');

      const ret = await clientAdapter.createCollection(
        'index',
        'collection',
        { dynamic: 'strict' });

      should(ret).be.eql('ret');
      should(clientAdapter._client.createCollection)
        .be.calledWith('index', 'collection', { dynamic: 'strict' });
      should(clientAdapter._indexCache.add).be.calledWithMatch({
        index: 'index',
        collection: 'collection',
        scope: 'public'
      });
    });
  });

  describe('#deleteIndex', () => {
    it('should call client method', async () => {
      clientAdapter._client.deleteIndex.resolves('ret');

      const ret = await clientAdapter.deleteIndex('index');

      should(ret).be.eql('ret');
      should(clientAdapter._client.deleteIndex).be.calledWith('index');
      should(indexCache.exists).be.calledWithMatch({
        index: 'index',
        scope: 'public'
      });
      should(indexCache.remove).be.calledWithMatch({
        index: 'index',
        scope: 'public'
      });
    });
  });

  describe('#deleteIndexes', () => {
    it('should call client method', async () => {
      clientAdapter._client.deleteIndexes.resolves('ret');

      const ret = await clientAdapter.deleteIndexes(['index1', 'index2']);

      should(ret).be.eql('ret');
      should(clientAdapter._client.deleteIndexes)
        .be.calledWith(['index1', 'index2']);
      should(indexCache.remove)
        .be.calledWithMatch({ index: 'index1', scope: 'public' })
        .be.calledWithMatch({ index: 'index2', scope: 'public' });
    });
  });

  describe('#deleteCollection', () => {
    it('should call client method', async () => {
      clientAdapter._client.deleteCollection.resolves('ret');

      const ret = await clientAdapter.deleteCollection('index', 'collection');

      should(ret).be.eql('ret');
      should(clientAdapter._client.deleteCollection)
        .be.calledWith('index', 'collection');
      should(indexCache.exists).be.calledWithMatch({
        index: 'index',
        collection: 'collection',
        scope: 'public'
      });
      should(indexCache.remove).be.calledWithMatch({
        index: 'index',
        collection: 'collection',
        scope: 'public'
      });
    });
  });

  describe('#collectionExists', () => {
    it('should call the index cache by default', async () => {
      await clientAdapter.collectionExists('index', 'collection');

      should(clientAdapter._indexCache.exists).be.calledWithMatch({
        index: 'index',
        collection: 'collection',
        scope: clientAdapter._client.scope
      });
    });

    it('should call the client if specified', async () => {
      await clientAdapter.collectionExists('index', 'collection', { fromCache: false });

      should(clientAdapter._client.collectionExists).be.calledWith('index', 'collection');
    });
  });

  describe('#indexExists', () => {
    it('should call the index cache by default', async () => {
      await clientAdapter.indexExists('index', 'index');

      should(clientAdapter._indexCache.exists).be.calledWithMatch({
        index: 'index',
        scope: clientAdapter._client.scope
      });
    });

    it('should call the client if specified', async () => {
      await clientAdapter.indexExists('index', { fromCache: false });

      should(clientAdapter._client.indexExists).be.calledWith('index');
    });
  });

  describe('#listCollections', () => {
    it('should call the index cache by default', async () => {
      await clientAdapter.listCollections('index');

      should(clientAdapter._indexCache.listCollections).be.calledWithMatch({
        index: 'index',
        scope: clientAdapter._client.scope
      });
    });

    it('should call the client if specified', async () => {
      await clientAdapter.listCollections('index', { fromCache: false });

      should(clientAdapter._client.listCollections).be.calledWith('index');
    });
  });

  describe('#listIndexes', () => {
    it('should call the index cache by default', async () => {
      await clientAdapter.listIndexes();

      should(clientAdapter._indexCache.listIndexes).be.calledWithMatch({
        scope: clientAdapter._client.scope
      });
    });

    it('should call the client if specified', async () => {
      await clientAdapter.listIndexes({ fromCache: false });

      should(clientAdapter._client.listIndexes).be.calledWith();
    });
  });
});
