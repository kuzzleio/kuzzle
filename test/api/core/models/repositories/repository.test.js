const
  _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  {
    InternalError: KuzzleInternalError,
    NotFoundError
  } = require('kuzzle-common-objects').errors,
  Repository = require('../../../../../lib/api/core/models/repositories/repository');

describe('Test: repositories/repository', () => {
  let
    kuzzle,
    /** @type {Repository} */
    repository,
    ObjectConstructor,
    dbPojo = {_id: 'someId', _source: {some: 'source'}, found: true},
    cachePojo = {_id: 'someId', some: 'source'};

  before(() => {

    /**
     * @constructor
     */
    ObjectConstructor = function () {};
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    repository = new Repository(kuzzle);
    repository.index = '%test';
    repository.collection = 'repository';
    repository.init({});
    repository.ObjectConstructor = ObjectConstructor;
  });

  describe('#loadOneFromDatabase', () => {
    it('should return null for an non existing id', () => {
      return repository.loadOneFromDatabase(-9999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      kuzzle.internalEngine.get.rejects(new KuzzleInternalError('error'));

      return should(repository.loadOneFromDatabase('error')).be.rejectedWith(KuzzleInternalError);
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      kuzzle.internalEngine.get.resolves(dbPojo);
      return repository.loadOneFromDatabase('persisted')
        .then(result => {
          should(result).be.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });
  });

  describe('#loadMultiFromDatabase', () => {
    it('should return an empty array for an non existing id', () => {
      kuzzle.internalEngine.mget.resolves({hits: []});
      return repository.loadMultiFromDatabase([-999, -998, -997])
        .then(results => should(results).be.an.Array().and.have.length(0));
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadMultiFromDatabase('error')).be.rejectedWith(KuzzleInternalError);
    });

    it('should return a list of plain object', () => {
      kuzzle.internalEngine.mget.resolves({hits: [dbPojo, dbPojo]});

      return repository.loadMultiFromDatabase(['persisted', 'persisted'])
        .then(results => {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly('someId');
            should(result.some).be.exactly('source');
          });
        });
    });

    it('should handle list of objects as an argument', () => {
      kuzzle.internalEngine.mget.resolves({hits: [dbPojo, dbPojo]});

      return repository.loadMultiFromDatabase([{_id:'persisted'}, {_id:'persisted'}])
        .then(results => {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly('someId');
            should(result.some).be.exactly('source');
          });
        });
    });

    it('should respond with an empty array if no result found', () => {
      return repository.loadMultiFromDatabase([{_id:'null'}])
        .then(results => {
          should(results).be.an.Array();
          should(results).be.empty();
        });
    });
  });

  describe('#loadFromCache', () => {
    it('should return null for an non-existing id', () => {
      kuzzle.services.list.internalCache.get.resolves(null);

      return repository.loadFromCache(-999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      kuzzle.services.list.internalCache.get.rejects(new KuzzleInternalError('error'));

      return should(repository.loadFromCache('error')).be.rejectedWith(KuzzleInternalError);
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.services.list.internalCache.get.resolves('bad type');

      return should(repository.loadFromCache('string')).be.rejectedWith(KuzzleInternalError);
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      kuzzle.services.list.internalCache.get.resolves(JSON.stringify(cachePojo));

      return repository.loadFromCache('persisted')
        .then(result => {
          should(result).be.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });
  });

  describe('#load', () => {
    it('should return null for an non-existing id', () => {
      kuzzle.internalEngine.get.rejects(new NotFoundError('test'));

      return repository.load(-999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      kuzzle.internalEngine.get.rejects(new KuzzleInternalError('test'));

      return should(repository.load('error')).be.rejectedWith(KuzzleInternalError);
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.services.list.internalCache.get = sinon.stub().resolves('bad type');

      return should(repository.load('string')).be.rejectedWith(KuzzleInternalError);
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      kuzzle.services.list.internalCache.get.resolves(null);
      kuzzle.internalEngine.get.resolves(dbPojo);

      return repository.load('persisted')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in cache', () => {
      kuzzle.services.list.internalCache.get.resolves(JSON.stringify(cachePojo));

      return repository.load('cached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in databaseEngine', () => {
      kuzzle.services.list.internalCache.get.resolves(null);
      kuzzle.internalEngine.get.resolves(dbPojo);

      return repository.load('uncached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should get content only from databaseEngine if cacheEngine is null', () => {
      repository.cacheEngine = null;
      kuzzle.internalEngine.get.resolves(dbPojo);

      return repository.load('no-cache')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should get content only from cacheEngine if databaseEngine is null', () => {
      repository.databaseEngine = null;

      return repository.load('uncached')
        .then(result => should(result).be.null());
    });
  });

  describe('#persistToDatabase', () => {
    it('should call the createOrReplace method of internal Engine', () => {
      const createOrReplaceStub = kuzzle.internalEngine.createOrReplace;
      const object = {_id: 'someId', some: 'source'};

      return repository.persistToDatabase(object)
        .then(() => {
          should(createOrReplaceStub.firstCall.args[0]).be.eql(repository.collection);
          should(createOrReplaceStub.firstCall.args[1]).be.exactly('someId');
          should(createOrReplaceStub.firstCall.args[2]).be.deepEqual(repository.serializeToDatabase(object));
        });
    });
  });

  describe('#deleteFromDatabase', () => {
    it('should call a database deletion properly', () => {
      const deleteStub = kuzzle.internalEngine.delete;

      return repository.deleteFromDatabase('someId')
        .then(() => {
          should(deleteStub.firstCall.args[0]).be.eql(repository.collection);
          should(deleteStub.firstCall.args[1]).be.exactly('someId');
        });
    });
  });

  describe('#deleteFromCache', () => {
    it('should call a cache deletion properly', () => {
      const removeStub = kuzzle.services.list.internalCache.remove;

      return repository.deleteFromCache('someId')
        .then(() => {
          should(removeStub.firstCall.args[0]).be.exactly(repository.getCacheKey('someId'));
        });
    });
  });

  describe('#delete', () => {
    it('should delete an object from both cache and database when pertinent', () => {
      const deleteStub = kuzzle.internalEngine.delete;
      const removeStub = kuzzle.services.list.internalCache.remove;

      return repository.delete('someId')
        .then(() => {
          should(removeStub).be.calledOnce();
          should(removeStub.firstCall.args[0]).be.exactly(repository.getCacheKey('someId'));
          should(deleteStub).be.calledOnce();
          should(deleteStub.firstCall.args[0]).be.eql(repository.collection);
          should(deleteStub.firstCall.args[1]).be.exactly('someId');
        });
    });
  });

  describe('#persistToCache', () => {
    it('should set the object if the ttl is false', () => {
      const setStub = kuzzle.services.list.internalCache.set;

      return repository.persistToCache(cachePojo, {ttl: false, key: 'someKey'})
        .then(() => {
          should(setStub.firstCall.args[0]).be.eql('someKey');
          should(setStub.firstCall.args[1]).be.eql(JSON.stringify(cachePojo));
        });
    });

    it('should set the object with a ttl by default', () => {
      const volatileSetStub = kuzzle.services.list.internalCache.volatileSet;

      return repository.persistToCache(cachePojo, {ttl: 500, key: 'someKey'})
        .then(() => {
          should(volatileSetStub.firstCall.args[0]).be.eql('someKey');
          should(volatileSetStub.firstCall.args[1]).be.eql(JSON.stringify(cachePojo));
          should(volatileSetStub.firstCall.args[2]).be.eql(500);
        });
    });
  });

  describe('#refreshCacheTTL', () => {
    it('should persist the object if the ttl is set to false', () => {
      const persistStub = kuzzle.services.list.internalCache.persist;

      repository.refreshCacheTTL(cachePojo, {ttl: false});

      should(persistStub.firstCall.args[0]).be.eql(repository.getCacheKey(cachePojo._id, repository.collection));
    });

    it('should refresh the ttl if not passed falsed', () => {
      const expireStub = kuzzle.services.list.internalCache.expire;

      repository.refreshCacheTTL(cachePojo, {ttl: 500});

      should(expireStub.firstCall.args[0]).be.eql(repository.getCacheKey(cachePojo._id, repository.collection));
      should(expireStub.firstCall.args[1]).be.eql(500);
    });
  });

  describe('#expireFromCache', () => {
    it('should expire the object', () => {
      const expireStub = kuzzle.services.list.internalCache.expire;

      repository.expireFromCache(cachePojo);

      should(expireStub.firstCall.args[0]).be.eql(repository.getCacheKey(cachePojo._id, repository.collection));
      should(expireStub.firstCall.args[1]).be.eql(-1);
    });
  });

  describe('#serializeToCache', () => {
    it('should return the same object', () => {
      const object = new ObjectConstructor();
      _.assign(object, cachePojo._source, {_id: cachePojo._id});

      const serialized = repository.serializeToCache(object);

      should(Object.keys(serialized).length).be.exactly(Object.keys(object).length);
      Object.keys(repository.serializeToCache(object)).forEach(key => {
        should(object[key]).be.exactly(serialized[key]);
      });
      should(typeof object).be.equal('object');
    });
  });

  describe('#serializeToDatabase', () => {
    it('should remove the _id', () => {
      should(repository.serializeToDatabase(cachePojo))
        .eql({
          some: 'source'
        });
    });
  });

  describe('#search', () => {
    it('should return a list from database', () => {
      kuzzle.internalEngine.search.resolves({hits: [dbPojo], total: 1});

      return repository.search({query:'noquery'})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(kuzzle.internalEngine.search).be.calledWithMatch(repository.collection, {query:'noquery'}, {});
        });
    });

    it('should inject back the scroll id, if there is one', () => {
      kuzzle.internalEngine.search.resolves({
        hits: [dbPojo],
        total: 1,
        scrollId: 'foobar'
      });

      return repository.search({query:'noquery'}, {from: 13, size: 42, scroll: '45s'})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(response.scrollId).be.eql('foobar');
          should(kuzzle.internalEngine.search).be.calledWithMatch(repository.collection, {query:'noquery'}, {from: 13, size: 42, scroll: '45s'});
        });
    });

    it('should return a list if no hits', () => {
      kuzzle.internalEngine.search.resolves({hits: [], total: 0});

      return repository.search({})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.hits).be.empty();
          should(response.total).be.exactly(0);
        });
    });

    it('should be rejected with an error if something goes wrong', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.search.rejects(error);

      return should(repository.search({})).be.rejectedWith(error);
    });
  });

  describe('#scroll', () => {
    it('should return a list from database', () => {
      kuzzle.internalEngine.scroll.resolves({
        hits: [dbPojo],
        total: 1
      });

      return repository.scroll('foo')
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(kuzzle.internalEngine.scroll).be.calledWithMatch(repository.collection, 'foo', undefined);
        });
    });

    it('should inject back the scroll id', () => {
      kuzzle.internalEngine.scroll.resolves({
        hits: [dbPojo],
        total: 1,
        scrollId: 'foobar'
      });

      return repository.scroll('foo', 'bar')
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(response.scrollId).be.eql('foobar');
          should(kuzzle.internalEngine.scroll).be.calledWithMatch(repository.collection, 'foo', 'bar');
        });
    });

    it('should return a list if no hits', () => {
      kuzzle.internalEngine.scroll.resolves({
        hits: [],
        total: 0,
        scrollId: 'foobar'
      });

      return repository.scroll({})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.hits).be.empty();
          should(response.total).be.exactly(0);
          should(response.scrollId).be.eql('foobar');
        });
    });

    it('should be rejected with an error if something goes wrong', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.scroll.rejects(error);

      return should(repository.scroll('foo')).be.rejectedWith(error);
    });
  });
});
