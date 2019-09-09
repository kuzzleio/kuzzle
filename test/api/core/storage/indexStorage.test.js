const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  InternalIndexBootstrap = require('../../../../lib/api/core/storage/bootstrap/internalIndexBootstrap'),
  IndexStorage = require('../../../../lib/api/core/storage/indexStorage');

describe('IndexStorage', () => {
  let
    indexStorage,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    indexStorage = new IndexStorage(
      kuzzle,
      'kuzzle',
      kuzzle.services.internalStorage);
  });

  describe('#init', () => {
    it('should call bootstrap.startOrWait if a bootstrap is setup', async () => {
      indexStorage.bootstrap = new InternalIndexBootstrap(
        kuzzle,
        indexStorage.storageEngine);
      indexStorage.bootstrap.startOrWait = sinon.stub().resolves();

      await indexStorage.init();

      should(indexStorage.bootstrap.startOrWait).be.called();
    });
  });

  describe('#get', () => {
    it('should call storageEngine.get with the good arguments', async () => {
      await indexStorage.get('users', 'user-kuid');

      should(indexStorage.storageEngine.get).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid');
    });
  });

  describe('#mGet', () => {
    it('should call storageEngine.mGet with the good arguments', async () => {
      await indexStorage.mGet('users', ['user-kuid']);

      should(indexStorage.storageEngine.mGet).be.calledWith(
        'kuzzle',
        'users',
        ['user-kuid']);
    });
  });

  describe('#search', () => {
    it('should call storageEngine.search with the good arguments', async () => {
      await indexStorage.search(
        'users',
        { query: { match_all: {} } },
        { from: 0, size: 1, scroll: '10m'});

      should(indexStorage.storageEngine.search).be.calledWith(
        'kuzzle',
        'users',
        { query: { match_all: {} } },
        { from: 0, size: 1, scroll: '10m' });
    });
  });

  describe('#scroll', () => {
    it('should call storageEngine.scroll with the good arguments', async () => {
      await indexStorage.scroll('users', 'scroll-id', '15m');

      should(indexStorage.storageEngine.scroll).be.calledWith(
        'kuzzle',
        'users',
        'scroll-id',
        { scroll: '15m' });
    });
  });

  describe('#count', () => {
    it('should call storageEngine.count with the good arguments', async () => {
      await indexStorage.count('users', { query: { match_all: {} } });

      should(indexStorage.storageEngine.count).be.calledWith(
        'kuzzle',
        'users',
        { query: { match_all: {} } });
    });
  });

  describe('#create', () => {
    it('should call storageEngine.create with the good arguments', async () => {
      await indexStorage.create(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexStorage.storageEngine.create).be.calledWith(
        'kuzzle',
        'users',
        { name: 'aschen' },
        { id: 'user-kuid', refresh: 'wait_for' });
    });
  });

  describe('#createOrReplace', () => {
    it('should call storageEngine.createOrReplace with the good arguments', async () => {
      await indexStorage.createOrReplace(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexStorage.storageEngine.createOrReplace).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#replace', () => {
    it('should call storageEngine.replace with the good arguments', async () => {
      await indexStorage.replace(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexStorage.storageEngine.replace).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#update', () => {
    it('should call storageEngine.update with the good arguments', async () => {
      await indexStorage.update(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexStorage.storageEngine.update).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });
    });
  });

  describe('#delete', () => {
    it('should call storageEngine.delete with the good arguments', async () => {
      await indexStorage.delete('users', 'user-kuid', { refresh: 'wait_for' });

      should(indexStorage.storageEngine.delete).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid',
        { refresh: 'wait_for' });
    });
  });

  describe('#exists', () => {
    it('should call storageEngine.exists with the good arguments', async () => {
      await indexStorage.exists('users', 'user-kuid');

      should(indexStorage.storageEngine.exists).be.calledWith(
        'kuzzle',
        'users',
        'user-kuid');
    });
  });

  describe('#createCollection', () => {
    it('should call storageEngine.createCollection with the good arguments', async () => {
      await indexStorage.createCollection(
        'admins',
        { properties: { name: { type: 'keyword '} } });

      should(indexStorage.storageEngine.createCollection).be.calledWith(
        'kuzzle',
        'admins',
        { properties: { name: { type: 'keyword '} } });
    });

    it('should add the collection to the indexCache', async () => {
      await indexStorage.createCollection('admins');

      should(kuzzle.indexCache.add).be.calledWithMatch({
        index: 'kuzzle',
        collection: 'admins',
        scope: indexStorage.storageEngine.scope
      });
    });
  });
});
