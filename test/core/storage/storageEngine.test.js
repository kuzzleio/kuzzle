'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const BaseModel = require('../../../lib/models/storage/baseModel');
const ClientAdapterMock = require('../../mocks/clientAdapter.mock');

describe('StorageEngine', () => {
  let StorageEngine;
  let storageEngine;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('../../../lib/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../lib/core/storage/storageEngine');
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

      should(storageEngine._indexes.get('foobar')).match({
        scope: 'internal',
        collections: new Set(['foolection'])
      });

      should(storageEngine._indexes.get('barfoo')).match({
        scope: 'public',
        collections: new Set(['barlection'])
      });
    });

    it('should handle aliases', async () => {
      storageEngine._publicClient.listAliases.resolves([{
        name: 'barlection-alias', index: 'barfoo', collection: 'barlection'
      }]);

      await storageEngine.init();

      should(storageEngine._indexes.get('barfoo').collections)
        .have.keys('barlection', 'barlection-alias');
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
      should(storageEngine._indexes.get('foobar').collections)
        .have.keys('collection');
      should(kuzzle.emit).be.calledOnce();
    });

    it('should add a new collection to the index cache and emit an event', () => {
      storageEngine.indexCache.add({ index: 'foobar', collection: 'collection' });

      should(storageEngine._indexes).have.keys('foobar');
      should(storageEngine._indexes.get('foobar').collections)
        .have.keys('collection');
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
      should(storageEngine._indexes.get('foobar').collections)
        .have.keys('collection');
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

      should(storageEngine._indexes.get('foobar')).match({
        scope: 'public',
        collections: new Set(['foolection2'])
      });
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:remove',
        {
          index: 'foobar', collection: 'foolection', scope: 'public'
        });
    });

    it('should do nothing if the index does not exist', () => {
      storageEngine.indexCache.remove({ index: 'barfoo' });

      should(storageEngine._indexes.get('foobar')).match({
        scope: 'public',
        collections: new Set(['foolection'])
      });
      should(kuzzle.emit).not.be.called();
    });

    it('should do nothing if the collection does not exist', () => {
      storageEngine.indexCache.remove({ index: 'foobar', collection: 'barlection' });

      should(storageEngine._indexes.get('foobar')).match({
        scope: 'public',
        collections: new Set(['foolection'])
      });
      should(kuzzle.emit).not.be.called();
    });

    it('does not emit event when notify is set to false (call from cluster sync', () => {
      storageEngine.indexCache.remove({ index: 'foobar', collection: 'foolection', notify: false });

      should(kuzzle.emit).not.be.called();
    });

    it('should delete an index from cache', () => {
      storageEngine.indexCache.remove({ index: 'foobar' });

      should(storageEngine._indexes).not.have.keys('foobar');
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

  describe('#listIndexes', () => {
    beforeEach(() => {
      storageEngine.indexCache.add({ index: 'covid-19', scope: 'public' });
      storageEngine.indexCache.add({ index: 'foobar', scope: 'public' });

      storageEngine.indexCache.add({ index: 'barfoo', scope: 'internal' });
    });

    it('should returns the public index list by default', () => {
      const indexes = storageEngine.indexCache.listIndexes();

      should(indexes).be.eql(['covid-19', 'foobar']);
    });

    it('should accept scope argument', () => {
      const indexes = storageEngine.indexCache.listIndexes({ scope: 'internal' });

      should(indexes).be.eql(['barfoo']);
    });
  });

  describe('#listCollections', () => {
    beforeEach(() => {
      storageEngine.indexCache.add(
        { index: 'covid-19', collection: 'france', scope: 'public' });
      storageEngine.indexCache.add(
        { index: 'covid-19', collection: 'italia', scope: 'public' });

      storageEngine.indexCache.add(
        { index: 'barfoo', collection: 'deutschland', scope: 'internal' });
    });

    it('should returns the public index list by default', () => {
      const collections = storageEngine.indexCache.listCollections(
        { index: 'covid-19'});

      should(collections).be.eql(['france', 'italia']);
    });

    it('should accept scope argument', () => {
      const collections = storageEngine.indexCache.listCollections(
        { index: 'barfoo', scope: 'internal' });

      should(collections).be.eql(['deutschland']);
    });
  });
});
