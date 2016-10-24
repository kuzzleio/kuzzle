var
  should = require('should'),
  sinon = require('sinon'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  WriteController = require('../../../lib/api/controllers/writeController');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: write controller', () => {
  var
    foo = {foo: 'bar'},
    controller,
    kuzzle,
    engine,
    trigger,
    requestObject;


  beforeEach(() => {
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    trigger = kuzzle.pluginsManager.trigger;
    controller = new WriteController(kuzzle);

    requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');
    sinon.stub(requestObject, 'isValid').resolves();
  });

  describe('#create', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.create(requestObject, {token: {userId: 42}})
        .then(response => {
          should(requestObject.isValid).be.calledOnce();

          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeCreate');

          should(engine.create).be.calledOnce();
          should(engine.create).be.calledWith(requestObject);

          should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(requestObject, foo);

          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterCreate');

          sinon.assert.callOrder(
            requestObject.isValid,
            kuzzle.pluginsManager.trigger,
            engine.create,
            kuzzle.notifier.notifyDocumentCreate,
            kuzzle.pluginsManager.trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#publish', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.publish(requestObject)
        .then(response => {
          should(requestObject.isValid).be.calledOnce();

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforePublish');

          should(kuzzle.notifier.publish).be.calledOnce();
          should(kuzzle.notifier.publish).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterPublish');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });

          sinon.assert.callOrder(
            requestObject.isValid,
            trigger,
            kuzzle.notifier.publish,
            trigger
          );
        });
    });
  });

  describe('#createOrReplace', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.createOrReplace(requestObject)
        .then(response => {
          should(requestObject.isValid).be.calledOnce();

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeCreateOrReplace', requestObject);

          should(engine.createOrReplace).be.calledOnce();
          should(engine.createOrReplace).be.calledWith(requestObject);

          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWith(requestObject.index, requestObject.collection);

          should(kuzzle.notifier.notifyDocumentReplace).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterCreateOrReplace');

          sinon.assert.callOrder(
            requestObject.isValid,
            trigger,
            engine.createOrReplace,
            kuzzle.indexCache.add,
            kuzzle.notifier.notifyDocumentReplace,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });

    it('should trigger a "create" notification if the docuemnt did not exist', () => {
      engine.createOrReplace.resolves(Object.assign({}, foo, {created: true}));

      return controller.createOrReplace(requestObject)
        .then(response => {
          should(requestObject.isValid).be.calledOnce();
          should(trigger).be.calledTwice();
          should(engine.createOrReplace).be.calledOnce();

          should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(requestObject);
          should(kuzzle.notifier.notifyDocumentReplace).have.callCount(0);

          should(response).be.an.instanceOf(ResponseObject);
        });
    });
  });

  describe('#update', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.update(requestObject, {token: {userId: '42'}})
        .then(response => {
          should(requestObject.isValid).be.calledOnce();

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeUpdate', requestObject);

          should(engine.update).be.calledOnce();
          should(engine.update).be.calledWith(requestObject);

          should(kuzzle.notifier.notifyDocumentUpdate).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentUpdate).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterUpdate');

          sinon.assert.callOrder(
            requestObject.isValid,
            trigger,
            engine.update,
            kuzzle.notifier.notifyDocumentUpdate,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#replace', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.replace(requestObject)
        .then(response => {
          should(requestObject.isValid).be.calledOnce();

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeReplace', requestObject);

          should(engine.replace).be.calledOnce();
          should(engine.replace).be.calledWith(requestObject);

          should(kuzzle.notifier.notifyDocumentReplace).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterReplace');

          sinon.assert.callOrder(
            requestObject.isValid,
            trigger,
            engine.replace,
            kuzzle.notifier.notifyDocumentReplace,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });

        });
    });
  });

  describe('#delete', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.delete(requestObject)
        .then(response => {
          should(requestObject.isValid).have.callCount(0);

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeDelete', requestObject);

          should(engine.delete).be.calledOnce();
          should(engine.delete).be.calledWith(requestObject);

          should(kuzzle.notifier.notifyDocumentDelete).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentDelete).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterDelete');

          sinon.assert.callOrder(
            trigger,
            engine.delete,
            kuzzle.notifier.notifyDocumentDelete,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#deleteByQuery', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.deleteByQuery(requestObject)
        .then(response => {
          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeDeleteByQuery', requestObject);

          should(engine.deleteByQuery).be.calledOnce();
          should(engine.deleteByQuery).be.calledWith(requestObject);

          should(kuzzle.notifier.notifyDocumentDelete).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentDelete).be.calledWith(requestObject, 'responseIds');

          should(trigger.secondCall).be.calledWith('data:afterDeleteByQuery');

          sinon.assert.callOrder(
            trigger,
            engine.deleteByQuery,
            kuzzle.notifier.notifyDocumentDelete,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: {
                foo: 'bar',
                ids: 'responseIds'
              }
            }
          });
        });
    });
  });

  describe('#createCollection', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.createCollection(requestObject)
        .then(response => {
          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeCreateCollection');

          should(engine.createCollection).be.calledOnce();
          should(engine.createCollection).be.calledWith(requestObject);

          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWith(requestObject.index, requestObject.collection);

          should(trigger.secondCall).be.calledWith('data:afterCreateCollection');

          sinon.assert.callOrder(
            trigger,
            engine.createCollection,
            kuzzle.indexCache.add,
            trigger
          );

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

});
