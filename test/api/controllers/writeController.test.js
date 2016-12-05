var
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  WriteController = require('../../../lib/api/controllers/writeController');

describe('Test: write controller', () => {
  var
    foo = {foo: 'bar'},
    /** @type WriteController */
    controller,
    kuzzle,
    engine,
    request;


  beforeEach(() => {
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    controller = new WriteController(kuzzle);

    request = new Request({body: {foo: 'bar'}});
  });

  describe('#create', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return controller.create(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(engine.create).be.calledOnce();
            should(engine.create).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(request, foo);

            sinon.assert.callOrder(
              engine.create,
              kuzzle.notifier.notifyDocumentCreate
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#publish', () => {
    it('should  resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return controller.publish(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createOrReplace', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return controller.createOrReplace(request)
        .then(response => {
          try {

            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(engine.createOrReplace).be.calledOnce();
            should(engine.createOrReplace).be.calledWith(request);

            should(kuzzle.indexCache.add).be.calledOnce();
            should(kuzzle.indexCache.add).be.calledWith(request.input.resource.index, request.input.resource.collection);

            should(kuzzle.notifier.notifyDocumentReplace).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(request);

            sinon.assert.callOrder(
              engine.createOrReplace,
              kuzzle.indexCache.add,
              kuzzle.notifier.notifyDocumentReplace
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should trigger a "create" notification if the document did not exist', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      engine.createOrReplace.returns(Promise.resolve(Object.assign({}, foo, {created: true})));

      return controller.createOrReplace(request)
        .then(response => {
          try {
            should(engine.createOrReplace).be.calledOnce();

            should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(request);
            should(kuzzle.notifier.notifyDocumentReplace).have.callCount(0);

            should(response).be.instanceof(Object);
            should(response).match({foo: foo.foo, created: true});

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#update', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';

      return controller.update(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(engine.update).be.calledOnce();
            should(engine.update).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentUpdate).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentUpdate).be.calledWith(request);

            sinon.assert.callOrder(
              engine.update,
              kuzzle.notifier.notifyDocumentUpdate
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#replace', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';

      return controller.replace(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(engine.replace).be.calledOnce();
            should(engine.replace).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentReplace).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(request);

            sinon.assert.callOrder(
              engine.replace,
              kuzzle.notifier.notifyDocumentReplace
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }

        });
    });
  });

  describe('#delete', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';

      return controller.delete(request)
        .then(response => {
          try {
            should(engine.delete).be.calledOnce();
            should(engine.delete).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentDelete).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentDelete).be.calledWith(request);

            sinon.assert.callOrder(
              engine.delete,
              kuzzle.notifier.notifyDocumentDelete
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#deleteByQuery', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return controller.deleteByQuery(request)
        .then(response => {
          try {

            should(engine.deleteByQuery).be.calledOnce();
            should(engine.deleteByQuery).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentDelete).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentDelete).be.calledWith(request, 'responseIds');

            sinon.assert.callOrder(
              engine.deleteByQuery,
              kuzzle.notifier.notifyDocumentDelete
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createCollection', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return controller.createCollection(request)
        .then(response => {
          try {
            should(engine.createCollection).be.calledOnce();
            should(engine.createCollection).be.calledWith(request);

            should(kuzzle.indexCache.add).be.calledOnce();
            should(kuzzle.indexCache.add).be.calledWith(request.input.resource.index, request.input.resource.collection);

            sinon.assert.callOrder(
              engine.createCollection,
              kuzzle.indexCache.add
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#validateDocument', () => {
    it('should send the right response when the given document satisfy the specifications', () => {
      var expected = {
        errorMessages: {},
        validation: true
      };

      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';

      kuzzle.validation = {
        validationPromise: sinon.stub().returns(Promise.resolve(expected))
      };

      return controller.validate(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();
            should(response).be.instanceof(Object);
            should(response).match(expected);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should send the right response when the given document do not satisfy the specifications', () => {
      var expected = {
        errorMessages: {
          fieldScope: {
            children: {
              myField: {
                messages: [
                  'The field must be an integer.'
                ]
              }
            }
          }
        },
        valid: false
      };

      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';

      kuzzle.validation.validationPromise = sinon.stub().returns(Promise.resolve(expected));

      return controller.validate(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();
            should(response).be.instanceof(Object);
            should(response).match(expected);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });
});
