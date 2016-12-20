var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  DocumentController = require('../../../lib/api/controllers/documentController'),
  foo = {foo: 'bar'};

describe('Test: document controller', () => {
  var
    documentController,
    kuzzle,
    request,
    engine;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    documentController = new DocumentController(kuzzle);
    request = new Request({index: '%test', collection: 'unit-test-documentController'});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#search', () => {
    it('should fulfill with an object', () => {
      return documentController.search(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match(foo);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.search.returns(Promise.reject(new Error('foobar')));

      return should(documentController.search(request)).be.rejectedWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should fulfill with an object', () => {
      return documentController.scroll(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match(foo);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.scroll.returns(Promise.reject(new Error('foobar')));

      return should(documentController.scroll(request)).be.rejectedWith('foobar');
    });
  });

  describe('#get', () => {
    beforeEach(() => {
      request.input.resource._id = 'an id';
    });

    it('should fulfill with an object', () => {
      return documentController.get(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({_source: {foo}});
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.get.returns(Promise.reject(new Error('foobar')));
      return should(documentController.get(request)).be.rejected();
    });
  });

  describe('#count', () => {
    beforeEach(() => {
      request.input.body = {some: 'body'};
    });

    it('should fulfill with an object', () => {
      return documentController.count(request)
        .then(response => {
          should(response).be.Number();
          should(response).be.eql(42);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.count.returns(Promise.reject(new Error('foobar')));
      return should(documentController.count(request)).be.rejected();
    });
  });


  describe('#create', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.body = {};

      return documentController.create(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

            should(engine.create).be.calledOnce();
            should(engine.create).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(request);

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

  describe('#createOrReplace', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.body = {};

      return documentController.createOrReplace(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

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
      request.input.body = {};

      engine.createOrReplace.returns(Promise.resolve(Object.assign({}, foo, {created: true})));

      return documentController.createOrReplace(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

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
      request.input.body = {};

      return documentController.update(request)
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
      request.input.body = {};

      return documentController.replace(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

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

      return documentController.delete(request)
        .then(response => {
          try {
            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

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
      request.input.body = {query: {some: 'query'}};

      return documentController.deleteByQuery(request)
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

  describe('#validate', () => {
    it('should send the right response when the given document satisfy the specifications', () => {
      var expected = {
        errorMessages: {},
        validation: true
      };

      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'document-id';
      request.input.body = {};

      kuzzle.validation = {
        validationPromise: sinon.stub().returns(Promise.resolve(expected))
      };

      return documentController.validate(request)
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
      request.input.body = {};

      kuzzle.validation.validationPromise = sinon.stub().returns(Promise.resolve(expected));

      return documentController.validate(request)
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