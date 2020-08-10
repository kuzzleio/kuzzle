'use strict';

const should = require('should');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const sinon = require('sinon');
const Repository = require('../../../lib/core/shared/repository');
const {
  InternalError: KuzzleInternalError,
  NotFoundError
} = require('kuzzle-common-objects');

describe('Test: repositories/repository', () => {
  let
    kuzzle,
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
    repository.collection = 'objects';
    repository.init({ indexStorage: kuzzle.internalIndex });
    repository.ObjectConstructor = ObjectConstructor;
  });

  describe('#loadOneFromDatabase', () => {
    it('should reject for an non existing id', () => {
      repository.indexStorage.get.rejects(new NotFoundError('Not found'));

      return should(repository.loadOneFromDatabase(-9999))
        .rejectedWith(NotFoundError, { id: 'services.storage.not_found' });
    });

    it('should reject the promise in case of error', () => {
      repository.indexStorage.get.rejects(new KuzzleInternalError('error'));

      return should(repository.loadOneFromDatabase('error'))
        .rejectedWith(KuzzleInternalError, { message: 'error' });
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      repository.indexStorage.get.resolves(dbPojo);
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
      repository.indexStorage.mGet.resolves({items: []});
      return repository.loadMultiFromDatabase([-999, -998, -997])
        .then(results => should(results).be.an.Array().and.have.length(0));
    });

    it('should return a list of plain object', () => {
      repository.indexStorage.mGet.resolves({items: [dbPojo, dbPojo]});

      return repository.loadMultiFromDatabase(['persisted', 'persisted'])
        .then(results => {
          should(results).be.an.Array().and.not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly('someId');
            should(result.some).be.exactly('source');
          });
        });
    });

    it('should handle list of objects as an argument', () => {
      repository.indexStorage.mGet.resolves({items: [dbPojo, dbPojo]});

      return repository.loadMultiFromDatabase([{_id:'persisted'}, {_id:'persisted'}])
        .then(results => {
          should(results).be.an.Array().and.not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly('someId');
            should(result.some).be.exactly('source');
          });
        });
    });

    it('should respond with an empty array if no result found', () => {
      repository.indexStorage.mGet.resolves({ items: [] });

      return repository.loadMultiFromDatabase([{_id:'null'}])
        .then(results => {
          should(results).be.an.Array().and.be.empty();
        });
    });
  });

  describe('#loadFromCache', () => {
    it('should return null for an non-existing id', () => {
      kuzzle.cacheEngine.internal.get.resolves(null);

      return repository.loadFromCache(-999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      kuzzle.cacheEngine.internal.get.rejects(new KuzzleInternalError('error'));

      return should(repository.loadFromCache('error')).
        rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed'
        });
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.cacheEngine.internal.get.resolves('bad type');

      return should(repository.loadFromCache('string'))
        .rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed'
        });
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(cachePojo));

      return repository.loadFromCache('persisted')
        .then(result => {
          should(result).be.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });
  });

  describe('#load', () => {
    beforeEach(() => {
      repository.cacheEngine.get.resolves(null);
    });

    it('should reject for a non-existing id', () => {
      repository.indexStorage.get.rejects(new NotFoundError('Not found'));

      return should(repository.load(-9999))
        .rejectedWith(NotFoundError, {
          id: 'services.storage.not_found'
        });
    });

    it('should reject the promise in case of error', () => {
      repository.indexStorage.get.rejects(new KuzzleInternalError('test'));

      return should(repository.load('error'))
        .rejectedWith(KuzzleInternalError, { message: 'test' });
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.cacheEngine.internal.get.resolves('bad type');

      return should(repository.load('string'))
        .rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed'
        });
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      repository.indexStorage.get.resolves(dbPojo);

      return repository.load('persisted')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in cache', () => {
      kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(cachePojo));

      return repository.load('cached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in indexStorage', () => {
      repository.indexStorage.get.resolves(dbPojo);

      return repository.load('uncached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should get content only from indexStorage if cacheEngine is null', () => {
      repository.indexStorage.get.resolves(dbPojo);

      return repository.load('no-cache')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly('someId');
          should(result.some).be.exactly('source');
        });
    });

    it('should get content only from cacheEngine if indexStorage is null', () => {
      repository.indexStorage = null;

      return repository.load('uncached')
        .then(result => should(result).be.null());
    });
  });

  describe('#persistToDatabase', () => {
    it('should call the createOrReplace method of internal Engine', () => {
      const object = {_id: 'someId', some: 'source'};

      return repository.persistToDatabase(object)
        .then(() => {
          should(repository.indexStorage.createOrReplace)
            .calledOnce()
            .calledWith(repository.collection, 'someId', repository.serializeToDatabase(object));
        });
    });
  });

  describe('#deleteFromDatabase', () => {
    it('should call a database deletion properly', () => {
      return repository.deleteFromDatabase('someId')
        .then(() => {
          should(repository.indexStorage.delete)
            .calledOnce()
            .calledWith(repository.collection, 'someId');
        });
    });
  });

  describe('#deleteFromCache', () => {
    it('should call a cache deletion properly', () => {
      return repository.deleteFromCache('someId')
        .then(() => {
          should(kuzzle.cacheEngine.internal.del)
            .calledOnce()
            .calledWith(repository.getCacheKey('someId'));
        });
    });
  });

  describe('#delete', () => {
    it('should delete an object from both cache and database when pertinent', () => {
      const someObject = { _id: 'someId' };

      return repository.delete(someObject)
        .then(() => {
          should(kuzzle.cacheEngine.internal.del)
            .calledOnce()
            .calledWith(repository.getCacheKey('someId'));

          should(repository.indexStorage.delete)
            .calledOnce()
            .calledWith(repository.collection, 'someId');
        });
    });
  });

  describe('#persistToCache', () => {
    it('should set the object if the ttl is false', () => {
      return repository.persistToCache(cachePojo, {ttl: false, key: 'someKey'})
        .then(() => {
          should(kuzzle.cacheEngine.internal.set)
            .calledOnce()
            .calledWith('someKey', JSON.stringify(cachePojo));
        });
    });

    it('should set the object with a ttl by default', () => {
      return repository.persistToCache(cachePojo, {ttl: 500, key: 'someKey'})
        .then(() => {
          should(kuzzle.cacheEngine.internal.setex)
            .calledOnce()
            .calledWith('someKey', 500, JSON.stringify(cachePojo));
        });
    });
  });

  describe('#refreshCacheTTL', () => {
    it('should persist the object if the ttl is set to false', () => {
      repository.refreshCacheTTL(cachePojo, {ttl: false});

      should(kuzzle.cacheEngine.internal.persist)
        .calledOnce()
        .calledWith(repository.getCacheKey(cachePojo._id, repository.collection));
    });

    it('should refresh the ttl with the provided TTL', () => {
      repository.refreshCacheTTL(cachePojo, {ttl: 500});

      should(kuzzle.cacheEngine.internal.expire)
        .calledOnce()
        .calledWith(repository.getCacheKey(cachePojo._id, repository.collection), 500);
    });

    it('should use the provided object TTL if one has been defined', () => {
      const pojo = Object.assign({}, cachePojo, {ttl: 1234});

      repository.refreshCacheTTL(pojo);

      should(kuzzle.cacheEngine.internal.expire)
        .calledOnce()
        .calledWith(repository.getCacheKey(pojo._id, repository.collection), 1234);
    });

    it('should use the provided ttl instead of the object-defined one', () => {
      const pojo = Object.assign({}, cachePojo, {ttl: 1234});

      repository.refreshCacheTTL(pojo, {ttl: 500});

      should(kuzzle.cacheEngine.internal.expire)
        .calledOnce()
        .calledWith(repository.getCacheKey(pojo._id, repository.collection), 500);
    });
  });

  describe('#expireFromCache', () => {
    it('should expire the object', () => {
      repository.expireFromCache(cachePojo);

      should(kuzzle.cacheEngine.internal.expire)
        .calledOnce()
        .calledWith(repository.getCacheKey(cachePojo._id, repository.collection), -1);
    });
  });

  describe('#serializeToCache', () => {
    it('should return the same object', () => {
      const
        object = Object.assign(new ObjectConstructor(), cachePojo._source, {_id: cachePojo._id}),
        serialized = repository.serializeToCache(object);

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
      repository.indexStorage.search.resolves({hits: [dbPojo], total: 1});

      return repository.search({query:'noquery'})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(repository.indexStorage.search).be.calledWithMatch(repository.collection, {query:'noquery'}, {});
        });
    });

    it('should inject back the scroll id, if there is one', () => {
      repository.indexStorage.search.resolves({
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
          should(repository.indexStorage.search).be.calledWithMatch(repository.collection, {query:'noquery'}, {from: 13, size: 42, scroll: '45s'});
        });
    });

    it('should return a list if no hits', () => {
      repository.indexStorage.search.resolves({hits: [], total: 0});

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
      repository.indexStorage.search.rejects(error);

      return should(repository.search({})).be.rejectedWith(error);
    });
  });

  describe('#scroll', () => {
    it('should return a list from database', () => {
      repository.indexStorage.scroll.resolves({
        hits: [dbPojo],
        total: 1
      });

      return repository.scroll('foo')
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
          should(repository.indexStorage.scroll).be.calledWithMatch('foo', undefined);
        });
    });

    it('should inject back the scroll id', () => {
      repository.indexStorage.scroll.resolves({
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
          should(repository.indexStorage.scroll).be.calledWithMatch('foo', 'bar');
        });
    });

    it('should return a list if no hits', () => {
      repository.indexStorage.scroll.resolves({
        hits: [],
        total: 0,
        scrollId: 'foobar'
      });

      return repository.scroll({})
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array().and.be.empty();
          should(response.total).be.exactly(0);
          should(response.scrollId).be.eql('foobar');
        });
    });

    it('should be rejected with an error if something goes wrong', () => {
      const error = new Error('Mocked error');
      repository.indexStorage.scroll.rejects(error);

      return should(repository.scroll('foo')).be.rejectedWith(error);
    });
  });

  describe('#truncate', () => {
    it('should scroll and delete all objects except protected ones', () => {
      repository.search = sinon.stub();
      repository.scroll = sinon.stub();
      repository.delete = sinon.stub();
      repository.load = sinon.stub();
      repository.collection = 'profiles';
      repository.search.resolves({total: 6, scrollId: 'foobarRole', hits: [
        {_id: 'admin' },
        {_id: 'role1' },
        {_id: 'role2' },
        {_id: 'role3' }
      ]});
      repository.scroll.onFirstCall().resolves({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role4'}]
      });
      repository.scroll.onSecondCall().resolves({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role5'}]
      });
      for (let i = 0; i < 6; i++) {
        repository.load.onCall(i).resolves({ _id: `role${i + 1}` });
      }

      return repository.truncate({ refresh: 'wait_for' })
        .then(result => {
          should(repository.search).be.calledOnce();
          should(repository.scroll).be.calledTwice();

          should(repository.scroll.getCall(0).args[0]).be.eql('foobarRole');
          should(repository.scroll.getCall(1).args[0]).be.eql('foobarRole2');

          should(repository.delete.callCount).be.eql(5);
          should(repository.delete.getCall(0).args[0]._id).be.eql('role1');
          should(repository.delete.getCall(0).args[1]).be.eql({ refresh: 'wait_for' });
          should(repository.delete.getCall(1).args[0]._id).be.eql('role2');
          should(repository.delete.getCall(2).args[0]._id).be.eql('role3');
          should(repository.delete.getCall(3).args[0]._id).be.eql('role4');
          should(repository.delete.getCall(4).args[0]._id).be.eql('role5');

          should(result).be.eql(5);
        });
    });

  });
});
