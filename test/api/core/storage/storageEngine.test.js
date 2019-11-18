'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  mockrequire = require('mock-require'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  BaseModel = require('../../../../lib/api/core/storage/models/baseModel'),
  ClientAdapterMock = require('../../../mocks/clientAdapter.mock');

describe('StorageEngine', () => {
  let
    StorageEngine,
    storageEngine,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('../../../../lib/api/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../../lib/api/core/storage/storageEngine');
    storageEngine = new StorageEngine(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#constructor', () => {
    it('should initialize the storage clients', () => {
      should(storageEngine.indexCache.add).be.a.Function();
      should(storageEngine.indexCache.remove).be.a.Function();
      should(storageEngine.indexCache.exists).be.a.Function();

      should(storageEngine.public._client.scope).be.eql('public');
      should(storageEngine.internal._client.scope).be.eql('internal');

      should(storageEngine.config).be.eql(kuzzle.config.services.storageEngine);
    });
  });

  describe('#init', () => {
    it('should initialize storage clients, models and populate cache', async () => {
      storageEngine._populateIndexCache = sinon.stub().resolves();

      await storageEngine.init();

      should(storageEngine._publicClient.init).be.called();
      should(storageEngine._internalClient.init).be.called();
      should(storageEngine._populateIndexCache).be.called();
      should(BaseModel.kuzzle).be.eql(kuzzle);
      should(BaseModel.indexStorage).be.eql(kuzzle.internalIndex);
    });
  });

  describe('#_populateIndexCache', () => {
    beforeEach(() => {
      storageEngine._internalClient.listIndexes.resolves(['foobar']);
      storageEngine._internalClient.listCollections.resolves(['foolection']);

      storageEngine._publicClient.listIndexes.resolves(['barfoo']);
      storageEngine._publicClient.listCollections.resolves(['barlection']);

      storageEngine._publicClient.listAliases.resolves([]);
    });

    it('should add internal and public indexes and collections to cache', async () => {
      await storageEngine.init();

      should(storageEngine._indexes.foobar).match({
        scope: 'internal',
        collections: ['foolection']
      });

      should(storageEngine._indexes.barfoo).match({
        scope: 'public',
        collections: ['barlection']
      });
    });

    it('should handle aliases', async () => {
      storageEngine._publicClient.listAliases.resolves([{
        name: 'barlection-alias', index: 'barfoo', collection: 'barlection'
      }]);

      await storageEngine.init();

      should(storageEngine._indexes.barfoo.collections).match([
        'barlection', 'barlection-alias'
      ]);
    });
  });

  describe('#add', () => {
    it('should add a new index to the cache and emit an event', () => {
      storageEngine.indexCache.add({ index: 'foobar' });

      should(storageEngine._indexes).have.keys('foobar');
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:add',
        {
          index: 'foobar', scope: 'public'
        });
    });

    it('should not add an index if it already exists', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection' });

      storageEngine.indexCache.add({ index: 'foobar'});

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledOnce();
    });

    it('should add a new collection to the index cache and emit an event', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection' });

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:add',
        {
          index: 'foobar', collection: 'collection', scope: 'public'
        });
    });

    it('should not add a collection if it is already in cache', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection' });
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection' });

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledOnce();
    });

    it('should do nothing if no collection is provided', () => {
      storageEngine.indexCache.add('foobar');

      should(storageEngine._indexes).be.empty();
      should(kuzzle.emit).not.be.called();
    });

    it('does not emit event when notify is set to false (call from cluster sync', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection', notify: false });

      should(kuzzle.emit).not.be.called();
    });
  });

  describe('#remove', () => {
    beforeEach(() => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'foolection', notify: false });
    });

    it('should remove a single collection from the cache and emit an event', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'foolection2', notify: false });

      storageEngine.indexCache.remove({ index: 'foobar', collection: 'foolection' });

      should(storageEngine._indexes.foobar).match({
        scope: 'public',
        collections: ['foolection2']
      });
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:remove',
        {
          index: 'foobar', collection: 'foolection', scope: 'public'
        });
    });

    it('should do nothing if the index does not exist', () => {
      storageEngine.indexCache.remove({ index: 'barfoo' });

      should(storageEngine._indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).not.be.called();
    });

    it('should do nothing if the collection does not exist', () => {
      storageEngine.indexCache.remove({ index: 'foobar', collection: 'barlection' });

      should(storageEngine._indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).not.be.called();
    });

    it('does not emit event when notify is set to false (call from cluster sync', () => {
      storageEngine.indexCache.remove({ index: 'foobar', collection: 'foolection', notify: false });

      should(kuzzle.emit).not.be.called();
    });

    it('should delete an index from cache', () => {
      storageEngine.indexCache.remove({ index: 'foobar' });

      should(storageEngine._indexes.foobar).be.undefined();
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'foolection' });
    });

    it('should returns true if the index exists in Kuzzle', () => {
      const exists = storageEngine.indexCache.exists({ index: 'foobar' });

      should(exists).be.true();
    });

    it('should returns true if the collection exists in Kuzzle', () => {
      const exists = storageEngine.indexCache.exists({ index: 'foobar', collection: 'foolection' });

      should(exists).be.true();
    });

    it('should returns false if the index does not exists in Kuzzle', () => {
      const exists = storageEngine.indexCache.exists({ index: 'barfoo' });

      should(exists).be.false();
    });

    it('should returns false if the collection does not exists in Kuzzle', () => {
      const exists = storageEngine.indexCache.exists({ index: 'foobar', collection: 'barlection' });

      should(exists).be.false();
    });

    it('should return false if the index is not the same type', () => {
      storageEngine.indexCache.add({ index: 'kuzzle', collection: 'users', scope: 'internal' });

      const indexExists = storageEngine.indexCache.exists({ index: 'kuzzle' });
      const collectionExists = storageEngine.indexCache.exists({
        index: 'kuzzle',
        collection: 'users'
      });

      should(indexExists).be.false();
      should(collectionExists).be.false();
    });
  });
});
