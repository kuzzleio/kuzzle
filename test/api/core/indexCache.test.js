const
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  IndexCache = require.main.require('lib/api/core/indexCache');

describe('Test: core/indexCache', () => {
  let
    listIndexesStub,
    listCollectionsStub,
    getMappingStub,
    indexCache,
    kuzzle;

  before(() => {
    kuzzle = new KuzzleMock();
  });

  beforeEach(() => {
    const internalMapping = {
      foo: {
        mappings: {
          bar: 'first',
          baz: 'second',
          qux: 'third'
        }
      }
    };

    listIndexesStub = kuzzle.internalEngine.listIndexes.resolves(['foo']);
    listCollectionsStub = kuzzle.internalEngine.listCollections.resolves(['bar', 'baz', 'qux']);
    getMappingStub = kuzzle.internalEngine.getMapping.resolves(internalMapping);
    indexCache = new IndexCache(kuzzle);
  });

  describe('#init', () => {
    it('should initialize the index cache properly', () => {
      return indexCache.init()
        .then(() => {
          should(listIndexesStub.calledOnce).be.true();
          should(listCollectionsStub.calledOnce).be.true();
          should(indexCache.indexes).be.an.Object().and.have.keys('foo');
          should(indexCache.indexes.foo).be.an.Array().and.match(['bar', 'baz', 'qux']);
        });
    });
  });

  describe('#initInternal', () => {
    it('should initialize the internal index cache properly', () => {
      return indexCache.initInternal(kuzzle.internalEngine)
        .then(() => {
          should(getMappingStub.calledOnce).be.true();
          should(indexCache.indexes).be.an.Object().and.have.keys('foo');
          should(indexCache.indexes.foo).be.an.Array().and.match(['bar', 'baz', 'qux']);
        });
    });
  });

  describe('#add', () => {
    it('should add a single index to the index cache', () => {
      indexCache.add('foobar');
      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar).be.an.Array().and.be.empty();
    });

    it('should add a new collection to the index cache', () => {
      indexCache.add('index', 'collection');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
    });

    it('should not add a collection if it is already in cache', () => {
      indexCache.add('index', 'collection');
      indexCache.add('index', 'collection');

      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
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

  describe('#reset', () => {
    it('should empty the index cache if invoked with no argument', () => {
      indexCache.add('index1', 'collection');
      indexCache.add('index2', 'collection');
      indexCache.reset();
      should(indexCache.indexes).be.an.Object().and.be.empty();
    });

    it('should remove all collections of an index', () => {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.reset('index');
      should(indexCache.indexes).be.an.Object().and.have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.be.empty();
    });
  });
});
