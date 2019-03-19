const
  should = require('should'),
  sinon = require('sinon'),
  IndexController = require('../../../lib/api/controllers/indexController'),
  {
    Request,
    errors: { BadRequestError }
  } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/controller'),
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Test: index controller', () => {
  let
    indexController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
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

  describe('#base', () => {
    it('should inherit the base constructor', () => {
      should(indexController).instanceOf(BaseController);
    });

    it('should properly override the isAction method', () => {
      indexController._foobar = () => {};
      should(indexController.isAction('list')).be.true();
      should(indexController.isAction('_foobar')).be.false();
    });
  });

  describe('#mDelete', () => {
    let isActionAllowedStub;

    beforeEach(() => {
      isActionAllowedStub = sinon.stub();
      isActionAllowedStub.onCall(0).resolves(true);
      isActionAllowedStub.onCall(1).resolves(false);
      isActionAllowedStub.onCall(2).resolves(true);
      isActionAllowedStub.onCall(3).resolves(false);
      isActionAllowedStub.resolves(true);

      indexController = new IndexController(kuzzle);
    });

    it('should trigger the proper methods and return a valid response', () => {
      request.input.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };
      request.context.token = {userId: '42'};
      request.context.user = {
        isActionAllowed: isActionAllowedStub
      };

      return indexController.mDelete(request)
        .then(response => {
          const engine = kuzzle.services.list.storageEngine;

          should(isActionAllowedStub).have.callCount(5);

          should(engine.deleteIndexes).be.calledOnce();
          should(engine.deleteIndexes.firstCall.args[0]).be.an.instanceOf(Request);
          should(engine.deleteIndexes.firstCall.args[0].serialize()).match({
            data: {
              body: {
                indexes: ['a', 'e', 'i']
              }
            }
          });

          should(kuzzle.indexCache.remove).be.calledThrice();
          should(kuzzle.indexCache.remove.getCall(0)).be.calledWith('a');
          should(kuzzle.indexCache.remove.getCall(1)).be.calledWith('e');
          should(kuzzle.indexCache.remove.getCall(2)).be.calledWith('i');

          should(response).be.instanceof(Object);
          should(response).match({deleted: ['a', 'e', 'i']});
        });
    });
  });

  describe('#create', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return indexController.create(request)
        .then(response => {
          const createIndex = kuzzle.services.list.storageEngine.createIndex;

          should(createIndex).be.calledOnce();
          should(createIndex).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#delete', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return indexController.delete(request)
        .then(response => {
          const deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;

          should(deleteIndex).be.calledOnce();
          should(deleteIndex).be.calledWith(request);

          should(kuzzle.indexCache.remove).be.calledOnce();
          should(kuzzle.indexCache.remove).be.calledWith(request.input.resource.index);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#refresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return indexController.refresh(request)
        .then(response => {
          const engine = kuzzle.services.list.storageEngine;
          should(engine.refreshIndex).be.calledOnce();
          should(engine.refreshIndex).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#refreshInternal', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return indexController.refreshInternal(request)
        .then(response => {
          should(kuzzle.internalEngine.refresh).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).match({ acknowledged: true });
        });
    });
  });

  describe('#getAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return indexController.getAutoRefresh(request)
        .then(response => {
          const engine = kuzzle.services.list.storageEngine;

          should(engine.getAutoRefresh).be.calledOnce();
          should(engine.getAutoRefresh).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(false);
        });
    });
  });

  describe('#setAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      request.input.body = {autoRefresh: true};

      return indexController.setAutoRefresh(request)
        .then(response => {
          const engine = kuzzle.services.list.storageEngine;

          should(engine.setAutoRefresh).be.calledOnce();
          should(engine.setAutoRefresh).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match({response: true});
        });
    });

    it('should return a rejected promise if the request does not contain a body', () => {
      return should(() => {
        indexController.setAutoRefresh(request);
      }).throw(BadRequestError);
    });

    it('should return a rejected promise if the request does not contain the autoRefresh field', () => {
      request.input.body = {foo};

      return should(() => {
        indexController.setAutoRefresh(request);
      }).throw(BadRequestError);
    });

    it('should reject the promise if the autoRefresh value is not a boolean', () => {
      request.input.body = {autoRefresh: -42};

      return should(() => {
        indexController.setAutoRefresh(request);
      }).throw(BadRequestError);
    });
  });

  describe('#list', () => {
    it('should fulfill with a response object', () => {
      return indexController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({indexes: [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i' ]});
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.listIndexes.rejects(new Error('foobar'));
      return should(indexController.list(request)).be.rejected();
    });
  });

  describe('#exists', () => {
    it('should call the storagEngine', () => {
      kuzzle.services.list.storageEngine.indexExists.resolves(foo);
      return indexController.exists(request)
        .then(response => {
          should(response).match(foo);
          should(kuzzle.services.list.storageEngine.indexExists).be.calledOnce();
        });
    });
  });
});
