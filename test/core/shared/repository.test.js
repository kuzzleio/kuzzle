'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  InternalError: KuzzleInternalError,
  NotFoundError,
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const Repository = require('../../../lib/core/shared/repository');
const cacheDbEnum = require('../../../lib/core/cache/cacheDbEnum');

describe('Test: repositories/repository', () => {
  let kuzzle;
  let repository;
  let ObjectConstructor;
  const dbPojo = { _id: 'someId', _source: { some: 'source' }, found: true };
  const cachePojo = { _id: 'someId', some: 'source' };

  before(() => {
    ObjectConstructor = function () {};
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    repository = new Repository({
      cache: cacheDbEnum.INTERNAL,
      store: kuzzle.internalIndex,
    });

    repository.collection = 'objects';
    repository.ObjectConstructor = ObjectConstructor;
  });

  describe('#loadOneFromDatabase', () => {
    it('should reject for an non existing id', () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .rejects(new NotFoundError('Not found'));

      return should(repository.loadOneFromDatabase(-9999))
        .rejectedWith(NotFoundError, { id: 'services.storage.not_found' });
    });

    it('should reject the promise in case of error', () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .rejects(new KuzzleInternalError('error'));

      return should(repository.loadOneFromDatabase('error'))
        .rejectedWith(KuzzleInternalError, { message: 'error' });
    });

    it('should return a valid ObjectConstructor instance if found', async () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .resolves(dbPojo);

      const result = await repository.loadOneFromDatabase('persisted');

      should(result).be.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
    });
  });

  describe('#loadMultiFromDatabase', () => {
    it('should return an empty array for an non existing id', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:mGet').resolves({
        items: [],
      });

      const result = await repository.loadMultiFromDatabase([-999, -998, -997]);

      should(result).be.an.Array().and.have.length(0);
    });

    it('should return a list of plain object', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:mGet').resolves({
        items: [dbPojo, dbPojo],
      });

      const results = await repository.loadMultiFromDatabase([
        'persisted',
        'persisted',
      ]);

      should(results).be.an.Array().and.not.be.empty();

      results.forEach(result => {
        should(result).be.instanceOf(ObjectConstructor);
        should(result._id).be.exactly('someId');
        should(result.some).be.exactly('source');
      });
    });

    it('should handle list of objects as an argument', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:mGet').resolves({
        items: [dbPojo, dbPojo],
      });

      const results = await repository.loadMultiFromDatabase([
        { _id:'persisted' },
        { _id:'persisted' },
      ]);

      should(results).be.an.Array().and.not.be.empty();

      results.forEach(result => {
        should(result).be.instanceOf(ObjectConstructor);
        should(result._id).be.exactly('someId');
        should(result.some).be.exactly('source');
      });
    });

    it('should respond with an empty array if no result found', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:mGet').resolves({
        items: [],
      });

      const results = await repository.loadMultiFromDatabase([{ _id:'null' }]);

      should(results).be.an.Array().and.be.empty();
    });
  });

  describe('#loadFromCache', () => {
    it('should return null for an non-existing id', async () => {
      kuzzle.ask.withArgs('core:cache:internal:get').resolves(null);

      should(await repository.loadFromCache(-999)).be.null();
    });

    it('should reject in case of error', () => {
      kuzzle.ask
        .withArgs('core:cache:internal:get')
        .rejects(new KuzzleInternalError('error'));

      return should(repository.loadFromCache('error')).
        rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed',
        });
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.ask
        .withArgs('core:cache:internal:get')
        .resolves('bad type');

      return should(repository.loadFromCache('string'))
        .rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed',
        });
    });

    it('should return a valid ObjectConstructor instance if found', async () => {
      kuzzle.ask
        .withArgs('core:cache:internal:get')
        .resolves(JSON.stringify(cachePojo));

      const result = await repository.loadFromCache('persisted');

      should(result).be.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
    });
  });

  describe('#load', () => {
    beforeEach(() => {
      kuzzle.ask.withArgs('core:cache:internal:get').resolves(null);
    });

    it('should reject for a non-existing id', () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .rejects(new NotFoundError('Not found'));

      return should(repository.load(-9999)).rejectedWith(NotFoundError, {
        id: 'services.storage.not_found',
      });
    });

    it('should reject the promise in case of error', () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .rejects(new KuzzleInternalError('test'));

      return should(repository.load('error'))
        .rejectedWith(KuzzleInternalError, { message: 'test' });
    });

    it('should reject the promise when loading an incorrect object', () => {
      kuzzle.ask.withArgs('core:cache:internal:get').resolves('bad type');

      return should(repository.load('string'))
        .rejectedWith(KuzzleInternalError, {
          id: 'services.cache.read_failed'
        });
    });

    it('should return a valid ObjectConstructor instance if found', async () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .resolves(dbPojo);

      const result = await repository.load('persisted');

      should(result).be.an.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
    });

    it('should return a valid ObjectConstructor instance if found only in cache', async () => {
      kuzzle.ask
        .withArgs('core:cache:internal:get')
        .resolves(JSON.stringify(cachePojo));

      const result = await repository.load('cached');

      should(result).be.an.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
    });

    it('should return a valid ObjectConstructor instance if found only in the store', async () => {
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .resolves(dbPojo);

      const result = await repository.load('uncached');

      should(result).be.an.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
    });

    it('should get content only from the store if no cache is set', async () => {
      sinon.stub(repository, 'loadFromCache');
      repository.cacheDb = cacheDbEnum.NONE;
      kuzzle.ask
        .withArgs('core:storage:private:document:get')
        .resolves(dbPojo);

      const result = await repository.load('no-cache');

      should(result).be.an.instanceOf(ObjectConstructor);
      should(result._id).be.exactly('someId');
      should(result.some).be.exactly('source');
      should(repository.loadFromCache).not.called();
    });

    it('should get content only from the cache if the store is null', async () => {
      repository.store = null;

      should(await repository.load('uncached')).be.null();
    });
  });

  describe('#persistToDatabase', () => {
    it('should call the createOrReplace method of internal Engine', async () => {
      const object = { _id: 'someId', some: 'source' };

      await repository.persistToDatabase(object);

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        kuzzle.internalIndex.index,
        repository.collection,
        'someId',
        repository.serializeToDatabase(object));
    });
  });

  describe('#deleteFromDatabase', () => {
    it('should call a database deletion properly', async () => {
      await repository.deleteFromDatabase('someId');

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:delete',
        kuzzle.internalIndex.index,
        repository.collection,
        'someId');
    });
  });

  describe('#deleteFromCache', () => {
    it('should call a cache deletion properly', async () => {
      repository.cacheDb = cacheDbEnum.INTERNAL;

      await repository.deleteFromCache('someId');

      should(kuzzle.ask).calledWith(
        'core:cache:internal:del',
        repository.getCacheKey('someId'));

      repository.cacheDb = cacheDbEnum.PUBLIC;

      await repository.deleteFromCache('someId');

      should(kuzzle.ask).calledWith(
        'core:cache:public:del',
        repository.getCacheKey('someId'));
    });
  });

  describe('#delete', () => {
    it('should delete an object from both cache and database when pertinent', async () => {
      const someObject = { _id: 'someId' };

      await repository.delete(someObject);

      should(kuzzle.ask).calledWith(
        'core:cache:internal:del',
        repository.getCacheKey('someId'));

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:delete',
        kuzzle.internalIndex.index,
        repository.collection,
        'someId');
    });
  });

  describe('#persistToCache', () => {
    it('should set the object if the ttl is false', async () => {
      await repository.persistToCache(cachePojo, { ttl: false, key: 'someKey' });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        'someKey',
        JSON.stringify(cachePojo));
    });

    it('should set the object with a ttl by default', async () => {
      await repository.persistToCache(cachePojo, { ttl: 500, key: 'someKey' });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        'someKey',
        JSON.stringify(cachePojo),
        { ttl: 500 });
    });
  });

  describe('#refreshCacheTTL', () => {
    it('should persist the object if the ttl is set to false', async () => {
      await repository.refreshCacheTTL(cachePojo, { ttl: false });

      should(kuzzle.ask)
        .calledWith(
          'core:cache:internal:persist',
          repository.getCacheKey(cachePojo._id, repository.collection));
    });

    it('should refresh the ttl with the provided TTL', async () => {
      await repository.refreshCacheTTL(cachePojo, { ttl: 500 });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:expire',
        repository.getCacheKey(cachePojo._id, repository.collection),
        500);
    });

    it('should use the provided object TTL if one has been defined', async () => {
      const pojo = Object.assign({}, cachePojo, { ttl: 1234 });

      await repository.refreshCacheTTL(pojo);

      should(kuzzle.ask).calledWith(
        'core:cache:internal:expire',
        repository.getCacheKey(pojo._id, repository.collection),
        1234);
    });

    it('should use the provided ttl instead of the object-defined one', () => {
      const pojo = Object.assign({}, cachePojo, { ttl: 1234 });

      repository.refreshCacheTTL(pojo, { ttl: 500 });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:expire',
        repository.getCacheKey(pojo._id, repository.collection),
        500);
    });
  });

  describe('#expireFromCache', () => {
    it('should expire the object', () => {
      repository.expireFromCache(cachePojo);

      should(kuzzle.ask).calledWith(
        'core:cache:internal:expire',
        repository.getCacheKey(cachePojo._id, repository.collection),
        -1);
    });
  });

  describe('#serializeToCache', () => {
    it('should return the same object', () => {
      const object = Object.assign(
        new ObjectConstructor(),
        cachePojo._source,
        { _id: cachePojo._id });
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
    it('should return a list from database', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:search').resolves({
        hits: [dbPojo],
        total: 1,
      });

      const response = await repository.search({ query:'noquery' });

      should(response).be.an.Object();
      should(response.hits).be.an.Array();
      should(response.total).be.exactly(1);
      should(kuzzle.ask).be.calledWithMatch(
        'core:storage:private:document:search',
        kuzzle.internalIndex.index,
        repository.collection,
        { query:'noquery' },
        {});
    });

    it('should inject back the scroll id, if there is one', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:search').resolves({
        hits: [dbPojo],
        scrollId: 'foobar',
        total: 1,
      });

      const response = await repository.search({ query: 'noquery' }, {
        from: 13,
        scroll: '45s',
        size: 42,
      });

      should(response).be.an.Object();
      should(response.hits).be.an.Array();
      should(response.total).be.exactly(1);
      should(response.scrollId).be.eql('foobar');
      should(kuzzle.ask).be.calledWithMatch(
        'core:storage:private:document:search',
        kuzzle.internalIndex.index,
        repository.collection,
        { query:'noquery' },
        { from: 13, scroll: '45s', size: 42 });
    });

    it('should return a list if no hits', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:search').resolves({
        hits: [],
        total: 0,
      });

      const response = await repository.search({});

      should(response).be.an.Object();
      should(response.hits).be.an.Array();
      should(response.hits).be.empty();
      should(response.total).be.exactly(0);
    });

    it('should be rejected with an error if something goes wrong', () => {
      const error = new Error('Mocked error');
      kuzzle.ask
        .withArgs('core:storage:private:document:search')
        .rejects(error);

      return should(repository.search({})).be.rejectedWith(error);
    });
  });

  describe('#scroll', () => {
    it('should return a list from database', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:scroll').resolves({
        hits: [dbPojo],
        total: 1,
      });

      const response = await repository.scroll('foo');

      should(response).be.an.Object();
      should(response.hits).be.an.Array();
      should(response.total).be.exactly(1);
      should(kuzzle.ask).be.calledWithMatch(
        'core:storage:private:document:scroll',
        'foo',
        undefined);
    });

    it('should inject back the scroll id', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:scroll').resolves({
        hits: [dbPojo],
        scrollId: 'foobar',
        total: 1,
      });

      const response = await repository.scroll('foo', 'bar');

      should(response).be.an.Object();
      should(response.hits).be.an.Array();
      should(response.total).be.exactly(1);
      should(response.scrollId).be.eql('foobar');
      should(kuzzle.ask).be.calledWithMatch(
        'core:storage:private:document:scroll',
        'foo',
        'bar');
    });

    it('should return a list if no hits', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:scroll').resolves({
        hits: [],
        scrollId: 'foobar',
        total: 0,
      });

      const response = await repository.scroll({});

      should(response).be.an.Object();
      should(response.hits).be.an.Array().and.be.empty();
      should(response.total).be.exactly(0);
      should(response.scrollId).be.eql('foobar');
    });

    it('should be rejected with an error if something goes wrong', () => {
      const error = new Error('Mocked error');
      kuzzle.ask.withArgs('core:storage:private:document:scroll').rejects(error);

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
      repository.search.resolves({ total: 6, scrollId: 'foobarRole', hits: [
        { _id: 'admin' },
        { _id: 'role1' },
        { _id: 'role2' },
        { _id: 'role3' }
      ] });
      repository.scroll.onFirstCall().resolves({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{ _id: 'role4' }]
      });
      repository.scroll.onSecondCall().resolves({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{ _id: 'role5' }]
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
