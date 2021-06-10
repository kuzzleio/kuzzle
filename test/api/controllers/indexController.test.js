'use strict';

const should = require('should');
const sinon = require('sinon');

const IndexController = require('../../../lib/api/controllers/indexController');
const { Request } = require('../../../index');
const NativeController = require('../../../lib/api/controllers/base/nativeController');
const mockAssertions = require('../../mocks/mockAssertions');
const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('IndexController', () => {
  let indexController;
  let kuzzle;
  let index = 'text';
  let collection = 'unit-test-indexController';
  let request;

  beforeEach(() => {
    const data = {
      controller: 'index',
      index,
      collection
    };

    kuzzle = new KuzzleMock();

    indexController = mockAssertions(new IndexController());
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

      indexController = new IndexController();

      kuzzle.ask.withArgs('core:storage:public:index:list').resolves([
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'
      ]);
      kuzzle.ask.withArgs('core:storage:public:index:mDelete').resolves(['a', 'e', 'i']);
    });

    it('should list indexes from storage engine, filter authorized ones and respond', async () => {
      request.input.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };
      request.context.token = { userId: '42' };
      request.context.user = { isActionAllowed: isActionAllowedStub };

      const response = await indexController.mDelete(request);

      should(isActionAllowedStub).have.callCount(5);

      should(kuzzle.ask)
        .be.calledWith('core:storage:public:index:mDelete', ['a', 'e', 'i']);

      should(response).match({ deleted: ['a', 'e', 'i'] });
    });
  });

  describe('#create', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.create(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:create', index);

      should(response).be.undefined();
    });
  });

  describe('#delete', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await indexController.delete(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:delete', index);

      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#list', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      kuzzle.ask
        .withArgs('core:storage:public:index:list')
        .resolves(['a', 'b', 'c']);

      const response = await indexController.list(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:list');

      should(response).match({
        indexes: ['a', 'b', 'c']
      });
    });
  });

  describe('#exists', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      kuzzle.ask.withArgs('core:storage:public:index:exist').resolves(true);

      const response = await indexController.exists(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:exist', index);

      should(response).be.eql(true);
    });
  });

  describe('#stats', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      kuzzle.ask.withArgs('core:storage:public:index:stats').resolves(true);

      const response = await indexController.stats(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:stats');

      should(response).be.eql(true);
    });
  });
});
