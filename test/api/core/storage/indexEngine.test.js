const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  InternalIndexBootstrap = require('../../../../lib/api/core/storage/bootstrap/internalIndexBootstrap'),
  IndexEngine = require('../../../../lib/api/core/storage/indexEngine');

describe('IndexEngine', () => {
  let
    indexEngine,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    indexEngine = new IndexEngine(
      kuzzle,
      'kuzzle',
      kuzzle.services.internalStorage);
  });

  describe('#init', () => {
    it('should call bootstrap.startOrWait if a bootstrap is setup', async () => {
      indexEngine.bootstrap = new InternalIndexBootstrap(
        kuzzle,
        indexEngine.storageEngine);
      indexEngine.bootstrap.startOrWait = sinon.stub().resolves();

      await indexEngine.init();

      should(indexEngine.bootstrap.startOrWait).be.called();
    });
  });

  describe('#get', () => {
    it('should call storageEngine.get with the good arguments', async () => {
      await indexEngine.get('users', 'user-kuid');

      should(indexEngine.storageEngine.get).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid');
    })
  });

  describe('#mGet', () => {
    it('should call storageEngine.mGet with the good arguments', async () => {
      await indexEngine.mGet('users', ['user-kuid']);

      should(indexEngine.storageEngine.mGet).be.calledWith(
        'kuzzle',
        'users',
        ['user-kuid']);
    });
  });

  describe('#search', () => {
    it('should call storageEngine.search with the good arguments', async () => {
      await indexEngine.search(
        'users',
        { query: { match_all: {} } },
        { from: 0, size: 1, scroll: '10m'});

      should(indexEngine.storageEngine.search).be.calledWith(
        'kuzzle',
        'users',
        { query: { match_all: {} } },
        { from: 0, size: 1, scroll: '10m' });
    });
  });

  describe('#scroll', () => {
    it('should call storageEngine.scroll with the good arguments', async () => {
      await indexEngine.scroll('users', 'scroll-id', '15m');

      should(indexEngine.storageEngine.scroll).be.calledWith(
        'kuzzle',
        'users',
        'scroll-id',
        { scroll: '15m' });
    });
  });

  describe('#create', () => {
    it('should call storageEngine.create with the good arguments', async () => {
      await indexEngine.create(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexEngine.storageEngine.create).be.calledWith(
        'kuzzle',
        'users',
        { name: 'aschen' },
        { id: 'user-kuid', refresh: 'wait_for' });
    });
  });

  describe('#createOrReplace', () => {
    it('should call storageEngine.createOrReplace with the good arguments', async () => {
      await indexEngine.createOrReplace(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexEngine.storageEngine.createOrReplace).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#replace', () => {
    it('should call storageEngine.replace with the good arguments', async () => {
      await indexEngine.replace(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexEngine.storageEngine.replace).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#update', () => {
    it('should call storageEngine.update with the good arguments', async () => {
      await indexEngine.update(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexEngine.storageEngine.update).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#delete', () => {
    it('should call storageEngine.delete with the good arguments', async () => {
      await indexEngine.delete('users', 'user-kuid', { refresh: 'wait_for' });

      should(indexEngine.storageEngine.delete).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { refresh: 'wait_for' });
    });
  });

  describe('#exists', () => {
    it('should call storageEngine.exists with the good arguments', async () => {
      await indexEngine.exists('users', 'user-kuid');

      should(indexEngine.storageEngine.exists).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid');
    });
  });

  describe('#createCollection', () => {
    it('should call storageEngine.createCollection with the good arguments', async () => {
      await indexEngine.createCollection(
        'admins',
        { properties: { name: { type: 'keyword '} } });

      should(indexEngine.storageEngine.createCollection).be.calledWith(
        'kuzzle',
        'admins',
        { properties: { name: { type: 'keyword '} } });
    });

    it('should add the collection to the indexCache', async () => {
      await indexEngine.createCollection('admins');

      should(kuzzle.indexCache.add).be.calledWithMatch({
        index: 'kuzzle',
        collection: 'admins',
        scope: indexEngine.storageEngine.scope
      });
    });
  });
});
