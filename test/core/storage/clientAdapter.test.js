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

  describe('assertIndex methods', () => {
    it('should define methods', () => {
      for (const method of clientAdapter._assertIndexMethods) {
        should(clientAdapter[method]).be.a.Function();
      }
    });

    it('should use index cache to assert index existence and call client method', async () => {
      const method = clientAdapter._assertIndexMethods[0];
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
      const method = clientAdapter._rawMethods[3];
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
});
