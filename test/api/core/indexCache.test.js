const
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  IndexCache = require('../../../lib/api/core/indexCache');

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
      kuzzle.services.publicStorage.listIndexes.resolves(['barfoo']);

      kuzzle.services.internalStorage.listCollections.resolves(['foolection']);
      kuzzle.services.publicStorage.listCollections.resolves(['barlection']);
    });

    it('should add internal and public indexes and collections to cache', async () => {
      await indexCache.init();


    });

    it('should handle aliases', () => {

    });
  });

  describe('#add', () => {
    it('should add a single index to the index cache', () => {
      indexCache.add({ index: 'foobar' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.indexType).eql('public');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.be.empty();
    });

    it('should add a new collection to the index cache', () => {
      indexCache.add({ index: 'foobar', collection: 'collection' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
    });

    it('should not add a collection if it is already in cache', () => {
      indexCache.add({ index: 'foobar', collection: 'collection' });
      indexCache.add({ index: 'foobar', collection: 'collection' });

      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar.collections)
        .be.an.Array()
        .and.match(['collection']);
    });

    it('should do nothing if no index is provided', () => {
      indexCache.add();

      should(indexCache.indexes).be.empty();
    });
  });

  describe('#remove', () => {
    it('should remove an index from the cache', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('index');
      should(indexCache.indexes).be.empty();
    });

    it('should remove a single collection from the cache', () => {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.remove('index', 'collection1');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection2']);
    });

    it('should do nothing if the index does not exist', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('foo');
      should(indexCache.indexes).match({index: ['collection']});
    });

    it('should do nothing if the collection does not exist', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('index', 'foo');
      should(indexCache.indexes).match({index: ['collection']});
    });
  });

  describe('#exists', () => {
    it('should resolve with true if the index exists in Kuzzle', done => {
      indexCache.add('index1');

      indexCache.exists('index1')
        .then(result => {
          should(result).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true if the collection exists in Kuzzle', done => {
      indexCache.add('index1', 'collection1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true and update the cache if the index exists in ES but not in Kuzzle', done => {
      kuzzle.services.list.storageEngine.indexExists.resolves(true);

      indexCache.exists('index1')
        .then(result => {
          should(result).be.true();
          should(indexCache.indexes).have.keys('index1');
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true and update the cache and apply mapping if the collection exists in ES but not in Kuzzle', done => {
      kuzzle.services.list.storageEngine.collectionExists.resolves(true);
      indexCache.add('index1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.true();
          should(indexCache.indexes.index1).be.eql(['collection1']);
          should(kuzzle.internalEngine.applyDefaultMapping).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with false if the index does not exists in ES', done => {
      kuzzle.services.list.storageEngine.indexExists.resolves(false);

      indexCache.exists('index1')
        .then(result => {
          should(result).be.false();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with false if the collection does not exists in ES', done => {
      kuzzle.services.list.storageEngine.collectionExists.resolves(false);
      indexCache.add('index1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.false();
          done();
        })
        .catch(error => done(error));
    });

    it('should not send a request to elastic with hotReload to false', done => {
      kuzzle.services.list.storageEngine.indexExists.reset();
      kuzzle.services.list.storageEngine.collectionExists.reset();

      indexCache.exists('index1', undefined, false)
        .then(result => {
          should(result).be.false();
          should(kuzzle.services.list.storageEngine.indexExists).not.be.called();
          should(kuzzle.services.list.storageEngine.collectionExists).not.be.called();
          done();
        })
        .catch(error => done(error));
    });

    it('should propagate other errors', () => {
      const serviceUnavailableError = new ServiceUnavailableError();
      kuzzle.services.list.storageEngine.indexExists.rejects(serviceUnavailableError);

      return should(indexCache.exists('index1')).be.rejectedWith(serviceUnavailableError);
    });
  });
});
