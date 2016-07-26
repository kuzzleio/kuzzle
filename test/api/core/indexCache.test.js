var
  should = require('should'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  IndexCache = require.main.require('lib/api/core/indexCache');

describe('Test: core/indexCache', function () {
  var
    indexCache,
    kuzzle;

  before(function () {
    kuzzle = new KuzzleServer();
  });

  beforeEach(function () {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({ indexes: ['foo'] });
        sandbox.stub(kuzzle.services.list.readEngine, 'listCollections').resolves({
          collections: {
            stored: ['bar', 'baz', 'qux']
          }
        });
        indexCache = new IndexCache(kuzzle);
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#init', function () {
    it('should initialize the index cache properly', function (done) {
      this.timeout(50);
      indexCache.init();

      setTimeout(() => {
        should(indexCache.indexes).be.an.Object().and.have.keys('foo');
        should(indexCache.indexes.foo).be.an.Array().and.match(['bar', 'baz', 'qux']);
        done();
      }, 20);
    });
  });

  describe('#add', function () {
    it('should add a single index to the index cache', function () {
      indexCache.add('foobar');
      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar).be.an.Array().and.be.empty();
    });

    it('should add a new collection to the index cache', function () {
      indexCache.add('index', 'collection');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
    });

    it('should not add a collection if it is already in cache', function () {
      indexCache.add('index', 'collection');
      indexCache.add('index', 'collection');

      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
    });

    it('should do nothing if no index is provided', function () {
      indexCache.add();
      should(indexCache.indexes).be.empty();
    });
  });

  describe('#remove', function () {
    it('should remove an index from the cache', function () {
      indexCache.add('index', 'collection');
      indexCache.remove('index');
      should(indexCache.indexes).be.empty();
    });

    it('should remove a single collection from the cache', function () {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.remove('index', 'collection1');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection2']);
    });

    it('should do nothing if the index does not exist', function () {
      indexCache.add('index', 'collection');
      indexCache.remove('foo');
      should(indexCache.indexes).match({index: ['collection']});
    });

    it('should do nothing if the collection does not exist', function () {
      indexCache.add('index', 'collection');
      indexCache.remove('index', 'foo');
      should(indexCache.indexes).match({index: ['collection']});
    });
  });

  describe('#reset', function () {
    it('should empty the index cache if invoked with no argument', function () {
      indexCache.add('index1', 'collection');
      indexCache.add('index2', 'collection');
      indexCache.reset();
      should(indexCache.indexes).be.an.Object().and.be.empty();
    });

    it('should remove all collections of an index', function () {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.reset('index');
      should(indexCache.indexes).be.an.Object().and.have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.be.empty();
    });
  });
});
