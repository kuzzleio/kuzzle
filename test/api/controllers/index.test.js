const
  should = require('should'),
  sinon = require('sinon'),
  IndexController = require('../../../lib/api/controllers/index'),
  { Request } = require('kuzzle-common-objects'),
  { NativeController } = require('../../../lib/api/controllers/base'),
  mockAssertions = require('../../mocks/mockAssertions'),
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

    indexController = mockAssertions(new IndexController(kuzzle));
    request = new Request(data);
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(indexController).instanceOf(NativeController);
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

      indexController.publicStorage.listIndexes.resolves([
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'
      ]);
      indexController.publicStorage.deleteIndexes.resolves(['a', 'e', 'i']);
    });

    it('should list indexes from storage engine, filter authorized ones and respond', async () => {
      request.input.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };
      request.context.token = { userId: '42' };
      request.context.user = { isActionAllowed: isActionAllowedStub };

      const response = await indexController.mDelete(request);

      should(isActionAllowedStub).have.callCount(5);

      should(indexController.publicStorage.deleteIndexes)
        .be.calledWith(['a', 'e', 'i']);

      should(response).match({ deleted: ['a', 'e', 'i'] });
    });
  });

  describe('#create', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.create(request);

      should(indexController.publicStorage.createIndex).be.calledWith(index);

      should(response).be.undefined();
    });
  });

  describe('#delete', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.delete(request);

      should(indexController.publicStorage.deleteIndex).be.calledWith(index);

      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#list', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      indexController.publicStorage.listIndexes.resolves(['a', 'b', 'c']);

      const response = await indexController.list(request);

      should(indexController.publicStorage.listIndexes).be.called();

      should(response).match({
        indexes: ['a', 'b', 'c']
      });
    });
  });

  describe('#exists', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      indexController.publicStorage.indexExists.resolves(true);

      const response = await indexController.exists(request);

      should(indexController.publicStorage.indexExists).be.calledWith(index);

      should(response).be.eql(true);
    });
  });
});
