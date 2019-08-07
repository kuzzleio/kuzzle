'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  DocumentController = require('../../../lib/api/controllers/documentController'),
  {
    Request,
    errors: {
      InternalError: KuzzleInternalError,
      NotFoundError,
      PartialError,
      BadRequestError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/baseController');

describe('Test: document controller', () => {
  const foo = {foo: 'bar'};
  let
    documentController,
    kuzzle,
    request,
    engine;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    documentController = new DocumentController(kuzzle);
    request = new Request({
      controller: 'document',
      index: '%test',
      collection: 'unit-test-documentController'
    });
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(documentController).instanceOf(BaseController);
    });
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
      request.input.action = 'search';

      should(() => documentController.search(request)).throw(
        BadRequestError,
        { message: 'Search on multiple indexes is not available.' });
    });

    it('should throw an error if collection contains a comma', () => {
      request.input.resource.collection = 'unit-test-documentController,anotherCollection';
      request.input.action = 'search';

      should(() => documentController.search(request)).throw(
        BadRequestError,
        { message: 'Search on multiple collections is not available.' });
    });

    it('should throw an error if the size argument exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;
      request.input.action = 'search';

      should(() => documentController.search(request)).throw(
        SizeLimitError,
        { message: 'Number of gets to perform exceeds the server configured value ( 1 ).' });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.search.rejects(new Error('foobar'));

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

      kuzzle.services.list.storageEngine.scroll.rejects(new Error('foobar'));

      return should(documentController.scroll(request)).be.rejectedWith('foobar');
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      request.input.resource._id = 'foo';
    });

    it('should fullfill with a boolean', () => {
      request.input.resource._id = 'foo';

      return documentController.exists(request)
        .then(response => {
          should(response).be.a.Boolean();
          should(response).be.true();
        });
    });

    it('should return false if the document doesn\'t exist', () => {
      request.input.resource._id = 'ghost';

      engine.get.rejects(new NotFoundError('foobar'));

      return documentController.exists(request)
        .then(response => {
          should(response).be.a.Boolean();
          should(response).be.false();
        });
    });

    it('should reject with an error in case of error', () => {
      engine.get.rejects(new Error('foobar'));

      return should(documentController.exists(request)).be.rejected();
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
      kuzzle.services.list.storageEngine.get.rejects(new Error('foobar'));
      return should(documentController.get(request)).be.rejected();
    });
  });

  describe('#mGet', () => {
    it('should fulfill with an array of documents', () => {
      request.input.body = {ids: ['anId', 'anotherId']};
      kuzzle.services.list.storageEngine.mget.returns(Bluebird.resolve({hits: request.input.body.ids}));


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
      }).throw('The request must specify the body attribute "ids" of type "array".');
    });

    it('should throw an error if the number of documents to get exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.body = {ids: ['anId', 'anotherId']};
      kuzzle.services.list.storageEngine.mget.returns(Bluebird.resolve({hits: request.input.body.ids}));
      request.input.action = 'mGet';

      should(() => documentController.mGet(request)).throw(
        SizeLimitError,
        { message: 'Number of gets to perform exceeds the server configured value ( 1 ).' });
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
      kuzzle.services.list.storageEngine.count.rejects(new Error('foobar'));
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
            should(kuzzle.validation.validate).be.calledOnce();

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });
  });

  describe('#doMultipleActions', () => {
    it('mCreate should fulfill with an object', () => {
      kuzzle.services.list.storageEngine.mcreate.resolves({
        result: ['created', 'created'],
        error: []
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreate(request)
        .then(result => {
          should(result).match({hits: ['created', 'created'], total: 2});
        });
    });

    it('mCreate should set a partial error if one of the action fails', () => {
      kuzzle.services.list.storageEngine.mcreate.resolves({
        result: ['created'],
        error: [new KuzzleInternalError('some error')]
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };
      return documentController.mCreate(request)
        .then(result => {
          should(result).match({hits: ['created'], total: 1});
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
      }).throw('The request must specify the body attribute "documents" of type "array".');
    });

    it('mCreateOrReplace should fulfill with an object', () => {
      kuzzle.services.list.storageEngine.mcreateOrReplace.resolves({
        result: ['created', 'replaced'],
        error: []
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mCreateOrReplace(request)
        .then(result => {
          should(result).match({hits: ['created', 'replaced'], total: 2});
        });
    });

    it('mUpdate should fulfill with an object', () => {
      kuzzle.services.list.storageEngine.mupdate.resolves({
        result: ['updated', 'updated'],
        error: []
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mUpdate(request)
        .then(result => {
          should(result).match({hits: ['updated', 'updated'], total: 2});
        });
    });

    it('mReplace should fulfill with an object', () => {
      kuzzle.services.list.storageEngine.mreplace.resolves({
        result: ['replaced', 'replaced'],
        error: []
      });

      request.input.body = {
        documents: [
          {_id: 'documentId', body: {some: 'body'}},
          {_id: 'anotherDocumentId', body: {some: 'body'}}
        ]
      };

      return documentController.mReplace(request)
        .then(result => {
          should(result).match({hits: ['replaced', 'replaced'], total: 2});
        });
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
            should(kuzzle.validation.validate).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

            should(engine.createOrReplace).be.calledOnce();
            should(engine.createOrReplace).be.calledWith(request);

            should(kuzzle.notifier.notifyDocumentReplace).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(request);

            sinon.assert.callOrder(
              engine.createOrReplace,
              kuzzle.notifier.notifyDocumentReplace
            );

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should trigger a "create" notification if the document did not exist', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.resource._id = 'test-document';
      request.input.body = {};

      engine.createOrReplace.returns(Bluebird.resolve(Object.assign({}, foo, {created: true})));

      return documentController.createOrReplace(request)
        .then(response => {
          try {
            should(kuzzle.validation.validate).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

            should(engine.createOrReplace).be.calledOnce();

            should(kuzzle.notifier.notifyDocumentCreate).be.calledOnce();
            should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(request);
            should(kuzzle.notifier.notifyDocumentReplace).have.callCount(0);

            should(response).be.instanceof(Object);
            should(response).match({foo: foo.foo, created: true});

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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
            should(kuzzle.validation.validate).be.calledOnce();

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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
            should(kuzzle.validation.validate).be.calledOnce();

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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
          should(kuzzle.notifier.publish).be.calledOnce();
          should(kuzzle.notifier.publish).be.calledWith(request);

          should(engine.delete).be.calledOnce();
          should(engine.delete).be.calledWith(request);

          should(kuzzle.notifier.notifyDocumentMDelete).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentMDelete).be.calledWith(request);

          sinon.assert.callOrder(
            engine.delete,
            kuzzle.notifier.notifyDocumentMDelete
          );

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#mDelete', () => {
    it('should fulfill with an object', () => {
      kuzzle.services.list.storageEngine.mdelete.resolves({
        result: ['documentId', 'anotherDocumentId'],
        error: []
      });

      request.input.body = {ids: ['documentId', 'anotherDocumentId']};

      return documentController.mDelete(request)
        .then(result => {
          should(result).match(['documentId', 'anotherDocumentId']);
        });
    });

    it('should set a partial error if one of the action fails', () => {
      kuzzle.services.list.storageEngine.mdelete.resolves({
        result: ['documentId'],
        error: ['anotherDocumentId']
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
      }).throw('The request must specify the body attribute "ids" of type "array".');
    });
  });

  describe('#deleteByQuery', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
      request.input.body = {query: {some: 'query'}};

      return documentController.deleteByQuery(request)
        .then(response => {
          should(engine.deleteByQuery).be.calledOnce();
          should(engine.deleteByQuery).be.calledWith(request);

          should(kuzzle.notifier.notifyDocumentMDelete).be.calledOnce();
          should(kuzzle.notifier.notifyDocumentMDelete).be.calledWith(request, 'responseIds');

          sinon.assert.callOrder(
            engine.deleteByQuery,
            kuzzle.notifier.notifyDocumentMDelete
          );

          should(response).be.instanceof(Object);
          should(response).match(foo);
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
        validate: sinon.stub().returns(Bluebird.resolve(expected))
      };

      return documentController.validate(request)
        .then(response => {
          try {
            should(kuzzle.validation.validate).be.calledOnce();
            should(response).be.instanceof(Object);
            should(response).match(expected);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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

      kuzzle.validation.validate = sinon.stub().returns(Bluebird.resolve(expected));

      return documentController.validate(request)
        .then(response => {
          try {
            should(kuzzle.validation.validate).be.calledOnce();
            should(response).be.instanceof(Object);
            should(response).match(expected);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });
  });
});
