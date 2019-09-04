const
  should = require('should'),
  sinon = require('sinon'),
  IndexController = require('../../../lib/api/controllers/indexController'),
  { Request } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/baseController'),
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe('IndexController', () => {
  let
    indexController,
    kuzzle,
    index = 'text',
    collection = 'unit-test-indexController',
    request;

  beforeEach(() => {
    const data = {
      controller: 'index',
      index,
      collection
    };

    kuzzle = new KuzzleMock();

    indexController = new IndexController(kuzzle);
    request = new Request(data);
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(indexController).instanceOf(BaseController);
    });
  });

  describe('#mDelete', () => {
    let isActionAllowedStub;

    beforeEach(() => {
      isActionAllowedStub = sinon.stub()
        .onCall(0).resolves(true)
        .onCall(1).resolves(false)
        .onCall(2).resolves(true)
        .onCall(3).resolves(false)
        .onCall(4).resolves(true);

      indexController = new IndexController(kuzzle);

      indexController.storageEngine.listIndexes.resolves([
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'
      ]);
      indexController.storageEngine.deleteIndexes.resolves(['a', 'e', 'i']);
    });

    it('should list indexes from storage engine, filter authorized ones and respond', async () => {
      request.input.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };
      request.context.token = { userId: '42' };
      request.context.user = { isActionAllowed: isActionAllowedStub };

      const response = await indexController.mDelete(request);

      should(isActionAllowedStub).have.callCount(5);

      should(indexController.storageEngine.deleteIndexes)
        .be.calledWith(['a', 'e', 'i']);

      should(kuzzle.indexCache.remove).be.calledThrice();
      should(kuzzle.indexCache.remove)
        .be.calledWith({ index: 'a' })
        .be.calledWith({ index: 'e' })
        .be.calledWith({ index: 'i' });

      should(response).match({ deleted: ['a', 'e', 'i'] });
    });
  });

  describe('#create', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.create(request);

      should(indexController.storageEngine.createIndex).be.calledWith(index);

      should(response).match({
        acknowledged: true,
        shards_acknowledged: true
      });
    });
  });

  describe('#delete', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.delete(request);

      should(indexController.storageEngine.deleteIndex).be.calledWith(index);

      should(kuzzle.indexCache.remove).be.calledWith({ index });

      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#list', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      indexController.storageEngine.listIndexes.resolves(['a', 'b', 'c']);

      const response = await indexController.list(request);

      should(indexController.storageEngine.listIndexes).be.called();

      should(response).match({
        indexes: ['a', 'b', 'c']
      });
    });
  });

  describe('#exists', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      indexController.storageEngine.indexExists.resolves(true);

      const response = await indexController.exists(request);

      should(indexController.storageEngine.indexExists).be.calledWith(index);

      should(response).be.eql(true);
    });
  });
});
