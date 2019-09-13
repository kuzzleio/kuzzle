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
      'kuzzle',
      kuzzle.storageEngine.internal);

    indexStorage._storageEngine.indexExists.resolves(false);
  });

  describe('#init', () => {
    it('should not create the index if already exists', async () => {
      indexStorage._storageEngine.indexExists.resolves(true);

      await indexStorage.init();

      should(indexStorage._storageEngine.createIndex).not.be.called();
    });

    it('should create index and call bootstrap.startOrWait if a bootstrap is setup', async () => {
      indexStorage.bootstrap = new InternalIndexBootstrap(
        kuzzle,
        kuzzle.storageEngine.internal);
      indexStorage.bootstrap.startOrWait = sinon.stub().resolves();

      await indexStorage.init();

      should(indexStorage._storageEngine.createIndex).be.calledWith('kuzzle');
      should(indexStorage.bootstrap.startOrWait).be.called();
    });

    it('should create provided collections', async () => {
      const collections = {
        users: {
          properties: {
            name: { type: 'keyword' }
          }
        },
        tokens: {
          properties: {
            id: { type: 'keyword' }
          }
        }
      };

      await indexStorage.init(collections);

      should(indexStorage._storageEngine.createCollection)
        .be.calledWith('kuzzle', 'users', collections.users)
        .be.calledWith('kuzzle', 'tokens', collections.tokens);
    });
  });

  describe('raw methods', () => {
    it('should define raw methods', () => {
      for (const method of indexStorage._rawMethods) {
        should(indexStorage[method]).be.a.Function();
      }
    });

    it('should use storageEngine methods and directly pass arguments to them', async () => {
      // get "random method"
      const method = indexStorage._rawMethods[4];
      indexStorage._storageEngine[method].resolves('ret');

      const response = await indexStorage[method]('arg1', 'arg2', 'arg3');

      should(indexStorage._storageEngine[method])
        .be.calledWith('kuzzle', 'arg1', 'arg2', 'arg3');
      should(response).be.eql('ret');
    });
  });

  describe('#scroll', () => {
    it('should call storageEngine.scroll with the good arguments', async () => {
      await indexStorage.scroll('users', 'scroll-id', '15m');

      should(indexStorage._storageEngine.scroll).be.calledWith(
        'kuzzle',
        'users',
        'scroll-id',
        { scroll: '15m' });
    });
  });

  describe('#create', () => {
    it('should call storageEngine.create with the good arguments', async () => {
      await indexStorage.create(
        'users',
        'user-kuid',
        { name: 'aschen' },
        { refresh: 'wait_for' });

      should(indexStorage._storageEngine.create).be.calledWith(
        'kuzzle',
        'users',
        { name: 'aschen' },
        { id: 'user-kuid', refresh: 'wait_for' });
    });
  });
});
