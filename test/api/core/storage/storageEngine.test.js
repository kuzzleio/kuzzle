'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  mockrequire = require('mock-require'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
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
    it('should initialize storage clients and populate cache', async () => {
      storageEngine._populateIndexCache = sinon.stub().resolves();

      await storageEngine.init();

      should(storageEngine._publicClient.init).be.called();
      should(storageEngine._internalClient.init).be.called();
      should(storageEngine._populateIndexCache).be.called();
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
    it('should add a single index to the index cache and emit an event', () => {
      storageEngine.add({ index: 'foobar' });

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.foobar.scope).eql('public');
      should(storageEngine._indexes.foobar.collections)
        .be.an.Array()
        .and.be.empty();
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:add',
        {
          index: 'foobar', scope: 'public'
        });
    });

    it('should add a new collection to the index cache and emit an event', () => {
      storageEngine.add({ index: 'foobar', collection: 'collection' });

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
      storageEngine.add({ index: 'foobar', collection: 'collection' });
      storageEngine.add({ index: 'foobar', collection: 'collection' });

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledOnce();
    });

    it('should do nothing if no index is provided', () => {
      storageEngine.add();

      should(storageEngine._indexes).be.empty();
      should(kuzzle.emit).not.be.called();
    });

    it('does not emit event when notify is set to false (call from cluster sync', () => {
      storageEngine.add({ index: 'foobar', collection: 'collection', notify: false });

      should(kuzzle.emit).not.be.called();
    });
  });

  describe('#remove', () => {
    beforeEach(() => {
      storageEngine.add({ index: 'foobar', collection: 'foolection', notify: false });
    });

    it('should remove an index from the cache and emit an event', () => {
      storageEngine.remove({ index: 'foobar' });

      should(storageEngine._indexes).be.empty();
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:remove',
        {
          index: 'foobar', scope: 'public'
        });
    });

    it('should remove a single collection from the cache and emit an event', () => {
      storageEngine.add({ index: 'foobar', collection: 'foolection2', notify: false });

      storageEngine.remove({ index: 'foobar', collection: 'foolection' });

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
      storageEngine.remove({ index: 'barfoo' });

      should(storageEngine._indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).not.be.called();
    });

    it('should do nothing if the collection does not exist', () => {
      storageEngine.remove({ index: 'foobar', collection: 'barlection' });

      should(storageEngine._indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).not.be.called();
    });

    it('does not emit event when notify is set to false (call from cluster sync', () => {
      storageEngine.remove({ index: 'foobar', collection: 'foolection', notify: false });

      should(kuzzle.emit).not.be.called();
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      storageEngine.add({ index: 'foobar', collection: 'foolection' });
    });

    it('should returns true if the index exists in Kuzzle', () => {
      const exists = storageEngine.exists({ index: 'foobar' });

      should(exists).be.true();
    });

    it('should returns true if the collection exists in Kuzzle', () => {
      const exists = storageEngine.exists({ index: 'foobar', collection: 'foolection' });

      should(exists).be.true();
    });

    it('should returns false if the index does not exists in Kuzzle', () => {
      const exists = storageEngine.exists({ index: 'barfoo' });

      should(exists).be.false();
    });

    it('should returns false if the collection does not exists in Kuzzle', () => {
      const exists = storageEngine.exists({ index: 'foobar', collection: 'barlection' });

      should(exists).be.false();
    });

    it('should return false if the index is not the same type', () => {
      storageEngine.add({ index: 'kuzzle', collection: 'users', scope: 'internal' });

      const indexExists = storageEngine.exists({ index: 'kuzzle' });
      const collectionExists = storageEngine.exists({
        index: 'kuzzle',
        collection: 'users'
      });

      should(indexExists).be.false();
      should(collectionExists).be.false();
    });
  });
});
