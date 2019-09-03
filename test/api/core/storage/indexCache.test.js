const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  IndexCache = require('../../../../lib/api/core/storage/indexCache');

describe('Test: core/indexCache', () => {
  let
    indexCache,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    indexCache = new IndexCache(kuzzle);
  });

  describe('#init', () => {
    beforeEach(() => {
      kuzzle.services.internalStorage.listIndexes.resolves(['foobar']);
      kuzzle.services.internalStorage.listCollections.resolves(['foolection']);

      kuzzle.services.publicStorage.listIndexes.resolves(['barfoo']);
      kuzzle.services.publicStorage.listCollections.resolves(['barlection']);

      kuzzle.services.publicStorage.listAliases.resolves([]);
    });

    it('should add internal and public indexes and collections to cache', async () => {
      await indexCache.init();

      should(indexCache.indexes.foobar).match({
        scope: 'internal',
        collections: ['foolection']
      });

      should(indexCache.indexes.barfoo).match({
        scope: 'public',
        collections: ['barlection']
      });
    });

    it('should handle aliases', async () => {
      kuzzle.services.publicStorage.listAliases.resolves([{
        name: 'barlection-alias', index: 'barfoo', collection: 'barlection'
      }]);

      await indexCache.init();

      should(indexCache.indexes.barfoo.collections).match([
        'barlection', 'barlection-alias'
      ]);
    });
  });

  describe('#add', () => {
    it('should add a single index to the index cache and emit an event', () => {
      indexCache.add({ index: 'foobar' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.scope).eql('public');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.be.empty();
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:add',
        {
          index: 'foobar', scope: 'public'
        });
    });

    it('should add a new collection to the index cache and emit an event', () => {
      indexCache.add({ index: 'foobar', collection: 'collection' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:add',
        {
          index: 'foobar', collection: 'collection', scope: 'public'
        });
    });

    it('should not add a collection if it is already in cache', () => {
      indexCache.add({ index: 'foobar', collection: 'collection' });
      indexCache.add({ index: 'foobar', collection: 'collection' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
      should(kuzzle.emit).be.calledOnce();
    });

    it('should do nothing if no index is provided', () => {
      indexCache.add();

      should(indexCache.indexes).be.empty();
      should(kuzzle.emit).not.be.called();
    });
  });

  describe('#remove', () => {
    beforeEach(() => {
      indexCache.add({ index: 'foobar', collection: 'foolection' });
    });

    it('should remove an index from the cache and emit an event', () => {
      indexCache.remove({ index: 'foobar' });

      should(indexCache.indexes).be.empty();
      should(kuzzle.emit).be.calledWithMatch(
        'core:indexCache:remove',
        {
          index: 'foobar', scope: 'public'
        });
    });

    it('should remove a single collection from the cache and emit an event', () => {
      indexCache.add({ index: 'foobar', collection: 'foolection2' });

      indexCache.remove({ index: 'foobar', collection: 'foolection' });

      should(indexCache.indexes.foobar).match({
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
      indexCache.remove({ index: 'barfoo' });

      should(indexCache.indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).be.calledOnce();
    });

    it('should do nothing if the collection does not exist', () => {
      indexCache.remove({ index: 'foobar', collection: 'barlection' });

      should(indexCache.indexes).match({
        foobar: {
          scope: 'public',
          collections: ['foolection']
        }
      });
      should(kuzzle.emit).be.calledOnce();
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      indexCache.add({ index: 'foobar', collection: 'foolection' });
    });

    it('should returns true if the index exists in Kuzzle', () => {
      const exists = indexCache.exists({ index: 'foobar' });

      should(exists).be.true();
    });

    it('should returns true if the collection exists in Kuzzle', () => {
      const exists = indexCache.exists({ index: 'foobar', collection: 'foolection' });

      should(exists).be.true();
    });

    it('should returns false if the index does not exists in Kuzzle', () => {
      const exists = indexCache.exists({ index: 'barfoo' });

      should(exists).be.false();
    });

    it('should returns false if the collection does not exists in Kuzzle', () => {
      const exists = indexCache.exists({ index: 'foobar', collection: 'barlection' });

      should(exists).be.false();
    });

    it('should return false if the index is not the same type', () => {
      indexCache.add({ index: 'kuzzle', collection: 'users', scope: 'internal' });

      const indexExists = indexCache.exists({ index: 'kuzzle' });
      const collectionExists = indexCache.exists({
        index: 'kuzzle',
        collection: 'users'
      });

      should(indexExists).be.false();
      should(collectionExists).be.false();
    });
  });
});
