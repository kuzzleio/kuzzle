'use strict';

var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  DocumentController = require('../../../lib/api/controllers/documentController'),
  foo = {foo: 'bar'},
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  PartialError = require('kuzzle-common-objects').errors.PartialError;

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

    it('should throw an error if index contains a comma', () => {
      request.input.resource.index = '%test,anotherIndex';

      return should(() => {
        documentController.search(request);
      }).throw('document:search on multiple indexes is not available.');
    });

    it('should throw an error if collection contains a comma', () => {
      request.input.resource.collection = 'unit-test-documentController,anotherCollection';

      return should(() => {
        documentController.search(request);
      }).throw('document:search on multiple collections is not available.');
    });

    it('should throw an error if the size argument exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;

      return should(() => documentController.search(request)).throw('document:search cannot fetch more documents than the server configured limit (1)');
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.search.returns(Promise.reject(new Error('foobar')));

      return should(documentController.search(request)).be.rejectedWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should fulfill with an object', () => {
      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      return documentController.scroll(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match(foo);
        });
    });

    it('should reject an error in case of error', () => {
      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

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

  describe('#mGet', () => {
    it('should fulfill with an array of documents', () => {
      request.input.body = {ids: ['anId', 'anotherId']};
      kuzzle.services.list.storageEngine.mget.returns(Promise.resolve({hits: request.input.body.ids}));


      return documentController.mGet(request)
        .then(response => {
          should(response).be.match({hits: request.input.body.ids, total: request.input.body.ids.length});
        });
    });

    it('should throw an error if ids is not an array', () => {
      request.input.body = {ids: 'not an array'};
      request.input.controller = 'document';
      request.input.action = 'mGet';


      return should(() => {
        documentController.mGet(request);
      }).throw('document:mGet must specify the body attribute "ids" of type "array".');
    });

    it('should throw an error if the number of documents to get exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.body = {ids: ['anId', 'anotherId']};
      kuzzle.services.list.storageEngine.mget.returns(Promise.resolve({hits: request.input.body.ids}));

      return should(() => {
        documentController.mGet(request);
      }).throw('Number of gets to perform exceeds the server configured value (1)');
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

  describe('#doMultipleActions', () => {
    it('mCreate should fulfill with an object', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'created'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreate(request)
        .then(result => {
          should(result).match({hits: [{result: 'created'}, {result: 'created'}], total: 2});
        });
    });

    it('mCreate should set a partial error if one of the action fails', () => {
      let callCount = 0;
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        if (callCount > 0) {
          return Promise.reject(new InternalError('some error'));
        }

        arguments[0].setResult({result: 'created'});
        callCount++;

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreate(request)
        .then(result => {
          should(result).match({hits: [{result: 'created'}], total: 1});
          should(request.error).be.instanceOf(PartialError);
          should(request.status).be.eql(206);
        });
    });

    it('mCreate should throw an error if documents field is not an array', () => {
      request.input.body = {documents: 'not an array'};
      request.input.controller = 'document';
      request.input.action = 'mCreate';

      return should(() => {
        documentController.mCreate(request);
      }).throw('document:mCreate must specify the body attribute "documents" of type "array".');
    });

    it('mCreate should throw an error if number of actions exceeds server configuration', () => {
      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      kuzzle.config.limits.documentsWriteCount = 1;

      return should(() => {
        documentController.mCreate(request);
      }).throw('Number of documents to update exceeds the server configured value (1)');
    });

    it('mCreate should return a rejected promise if Kuzzle is overloaded', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      kuzzle.funnel.getRequestSlot.onSecondCall().yields(new ServiceUnavailableError('overloaded'));

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreate(request)
        .then(result => {
          should(result.total).be.eql(1, 'Only 1 document should have been created');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('mCreateOrReplace should fulfill with an object', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreateOrReplace(request)
        .then(result => {
          should(result).match({hits: [{result: 'updated'}, {result: 'updated'}], total: 2});
        });
    });

    it('mCreateOrReplace should return a rejected promise if Kuzzle is overloaded', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      kuzzle.funnel.getRequestSlot.onSecondCall().yields(new ServiceUnavailableError('overloaded'));

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreateOrReplace(request)
        .then(result => {
          should(result.total).be.eql(1, 'Only 1 document should have been created');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('mCreateOrReplace should throw an error if number of actions exceeds server configuration', () => {
      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      kuzzle.config.limits.documentsWriteCount = 1;

      return should(() => {
        documentController.mCreateOrReplace(request);
      }).throw('Number of documents to update exceeds the server configured value (1)');
    });

    it('mUpdate should fulfill with an object', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mUpdate(request)
        .then(result => {
          should(result).match({hits: [{result: 'updated'}, {result: 'updated'}], total: 2});
        });
    });

    it('mUpdate should return a rejected promise if Kuzzle is overloaded', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      kuzzle.funnel.getRequestSlot.onSecondCall().yields(new ServiceUnavailableError('overloaded'));

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mUpdate(request)
        .then(result => {
          should(result.total).be.eql(1, 'Only 1 document should have been created');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('mUpdate should throw an error if number of actions exceeds server configuration', () => {
      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      kuzzle.config.limits.documentsWriteCount = 1;

      return should(() => {
        documentController.mUpdate(request);
      }).throw('Number of documents to update exceeds the server configured value (1)');
    });

    it('mReplace should fulfill with an object', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mReplace(request)
        .then(result => {
          should(result).match({hits: [{result: 'updated'}, {result: 'updated'}], total: 2});
        });
    });

    it('mReplace should return a rejected promise if Kuzzle is overloaded', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'updated'});

        return Promise.resolve(arguments[0]);
      });

      kuzzle.funnel.getRequestSlot.onSecondCall().yields(new ServiceUnavailableError('overloaded'));

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mReplace(request)
        .then(result => {
          should(result.total).be.eql(1, 'Only 1 document should have been created');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('mReplace should throw an error if number of actions exceeds server configuration', () => {
      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      kuzzle.config.limits.documentsWriteCount = 1;

      return should(() => {
        documentController.mReplace(request);
      }).throw('Number of documents to update exceeds the server configured value (1)');
    });
  });

  describe('#createOrReplace', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'test-document';
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
      request.input.resource._id = 'test-document';
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

  describe('#mDelete', () => {
    it('should fulfill with an object', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'deleted'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {ids: ['documentId', 'anotherDocumentId']};

      return documentController.mDelete(request)
        .then(result => {
          should(result).match(['documentId', 'anotherDocumentId']);
        });
    });

    it('should set a partial error if one of the action fails', () => {
      let callCount = 0;
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        if (callCount > 0) {
          return Promise.reject(new InternalError('some error'));
        }

        arguments[0].setResult({result: 'deleted'});
        callCount++;

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {ids: ['documentId', 'anotherDocumentId']};

      return documentController.mDelete(request)
        .then(result => {
          should(result).match(['documentId']);
          should(request.error).be.instanceOf(PartialError);
          should(request.status).be.eql(206);
        });
    });

    it('should throw an error if documents field is not an array', () => {
      request.input.body = {ids: 'not an array'};
      request.input.controller = 'document';
      request.input.action = 'mDelete';

      return should(() => {
        documentController.mDelete(request);
      }).throw('document:mDelete must specify the body attribute "ids" of type "array".');
    });

    it('should return a rejected promise if Kuzzle is overloaded', () => {
      kuzzle.funnel.processRequest = sandbox.spy(function () {
        arguments[0].setResult({result: 'deleted'});

        return Promise.resolve(arguments[0]);
      });

      request.input.body = {ids: ['documentId', 'anotherDocumentId']};
      kuzzle.funnel.getRequestSlot.onSecondCall().yields(new ServiceUnavailableError('overloaded'));

      return documentController.mDelete(request)
        .then(result => {
          should(result.length).be.eql(1, 'Only 1 document should have been deleted');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('mDelete should throw an error if number of actions exceeds server configuration', () => {
      request.input.body = {ids: ['documentId', 'anotherDocumentId']};
      kuzzle.config.limits.documentsWriteCount = 1;

      return should(() => {
        documentController.mDelete(request);
      }).throw('Number of delete to perform exceeds the server configured value (1)');
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