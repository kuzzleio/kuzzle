const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  CollectionController = rewire('../../../lib/api/controllers/collectionController'),
  {
    Request,
    errors: {
      BadRequestError,
      PreconditionError,
      NotFoundError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  BaseController = require('../../../lib/api/controllers/baseController');

describe('Test: collection controller', () => {
  let
    collectionController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-collectionController',
    request,
    engine;

  beforeEach(() => {
    const data = {
      controller: 'collection',
      index,
      collection
    };
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    collectionController = new CollectionController(kuzzle);
    request = new Request(data);
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(collectionController).instanceOf(BaseController);
    });
  });

  describe('#updateMapping', () => {
    it('should throw a BadRequestError if the body is missing', () => {
      return should(() => {
        collectionController.updateMapping(request);
      }).throw(BadRequestError);
    });

    it('should activate a hook on a mapping update call and add the collection to the cache', () => {
      request.input.body = {foo: 'bar'};
      return collectionController.updateMapping(request)
        .then(response => {

          should(kuzzle.services.list.storageEngine.updateMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.updateMapping).be.calledWith(request);

          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWith(request.input.resource.index, request.input.resource.collection);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getMapping', () => {
    it('should fulfill with a response object', () => {
      return collectionController.getMapping(request)
        .then(response => {

          should(kuzzle.services.list.storageEngine.getMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.getMapping).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#truncate', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return collectionController.truncate(request)
        .then(response => {
          const truncate = kuzzle.services.list.storageEngine.truncateCollection;

          should(truncate).be.calledOnce();
          should(truncate).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getSpecifications', () => {
    it('should call internalEngine with the right id', () => {
      kuzzle.internalEngine.get.resolves({_source: {foo: 'bar'}});
      kuzzle.indexCache.exists.resolves(true);

      return collectionController.getSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.get).be.calledOnce();
          should(kuzzle.internalEngine.get).be.calledWithMatch(
            'validations',
            `${index}#${collection}`);
          should(response).match(foo);
        });
    });

    it('should return a dedicated error if the index does not exist', () => {
      kuzzle.indexCache.exists.resolves(false);
      
      return should(collectionController.getSpecifications(request))
        .be.rejectedWith(PreconditionError, {message: `The index ${index} does not exist.`});
    });

    it('should return a dedicated error if the collection does not exist', () => {
      kuzzle.indexCache.exists.onFirstCall().resolves(true);
      kuzzle.indexCache.exists.onSecondCall().resolves(false);

      return should(collectionController.getSpecifications(request))
        .be.rejectedWith(PreconditionError, {message: `The collection ${collection} does not exist.`});
    });

    it('should give a meaningful message if there is no specifications', () => {
      kuzzle.indexCache.exists.resolves(true);
      kuzzle.internalEngine.get.rejects(new NotFoundError('not found'));

      return should(collectionController.getSpecifications(request))
        .be.rejectedWith(
          NotFoundError,
          {message: `No specifications defined for index ${index} and collection ${collection}`});
    });
  });

  describe('#searchSpecifications', () => {
    it('should throw if the page size exceeds server limitations', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.from = 0;
      request.input.args.size = 20;
      request.input.action = 'searchSpecifications';
      
      should(() => collectionController.searchSpecifications(request)).throw(
        SizeLimitError,
        { message: 'Search page size exceeds server configured documents limit ( 1 ).' });
    });

    it('should call internalEngine with the right data', () => {
      kuzzle.internalEngine.search.resolves({
        hits: [{_id: 'bar'}],
        scrollId: 'foobar',
        total: 123
      });

      request = new Request({
        body: {
          query: {
            match_all: {}
          }
        },
        from: 0,
        size: 20,
        scroll: '15s'
      });

      return collectionController.searchSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.search).be.calledOnce();
          should(kuzzle.internalEngine.search).be.calledWithMatch('validations', request.input.body.query, {
            from: request.input.args.from,
            size: request.input.args.size,
            scroll: request.input.args.scroll
          });
          should(response).match({total: 123, scrollId: 'foobar', hits: [{_id: 'bar'}]});
        });
    });
  });

  describe('#scrollSpecifications', () => {
    it('should throw if no scrollId is provided', () => {
      should(() => collectionController.scrollSpecifications(new Request({controller: 'collection', action: 'scrollSpecifications'})))
        .throw(BadRequestError, {message: 'The request must specify a scrollId.'});
    });

    it('should call internalEngine with the right data', () => {
      kuzzle.internalEngine.scroll.resolves({
        hits: [{_id: 'bar'}],
        scrollId: 'foobar',
        total: 123
      });

      request = new Request({scrollId: 'foobar'});

      return collectionController.scrollSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.scroll).be.calledOnce();
          should(kuzzle.internalEngine.scroll).be.calledWithMatch('validations', 'foobar', undefined);
          should(response).match({total: 123, scrollId: 'foobar', hits: [{_id: 'bar'}]});
        });
    });

    it('should handle the optional scroll argument', () => {
      kuzzle.internalEngine.scroll.resolves({
        hits: [{_id: 'bar'}],
        scrollId: 'foobar',
        total: 123
      });

      request = new Request({scrollId: 'foobar', scroll: 'qux'});

      return collectionController.scrollSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.scroll).be.calledOnce();
          should(kuzzle.internalEngine.scroll).be.calledWithMatch('validations', 'foobar', 'qux');
          should(response).match({total: 123, scrollId: 'foobar', hits: [{_id: 'bar'}]});
        });
    });
  });

  describe('#updateSpecifications', () => {
    it('should create or replace specifications', () => {
      request.input.resource.index = 'myindex';
      request.input.resource.collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'integer',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification.resolves({isValid: true});
      kuzzle.validation.curateSpecification.resolves();

      return collectionController.updateSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.refresh).be.calledOnce();
          should(kuzzle.validation.curateSpecification).be.called();
          should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
          should(kuzzle.internalEngine.createOrReplace).be.calledWithMatch('validations', 'myindex#mycollection');
          should(response).match(request.input.body);
        });
    });

    it('should rejects and do not create or replace specifications if the specs are wrong', () => {
      request.input.resource.index = 'myindex';
      request.input.resource.collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'bad bad',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification.resolves({
        isValid: false,
        errors: ['bad bad is a bad type !']
      });

      return collectionController.updateSpecifications(request)
        .catch(error => {
          should(kuzzle.internalEngine.refresh).not.be.called();
          should(kuzzle.validation.curateSpecification).not.be.called();
          should(kuzzle.internalEngine.createOrReplace).not.be.called();

          should(error).be.an.instanceOf(BadRequestError);
          should(error.message).be.exactly('Some errors with provided specifications.');
          should(error.details).match([ 'bad bad is a bad type !' ]);
        });
    });

    it('should create or replace specifications when requested with deprecated way', () => {
      request.input.resource.index = undefined;
      request.input.resource.collection = undefined;
      index = 'myindex';
      collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'integer',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification.resolves({isValid: true});
      kuzzle.validation.curateSpecification.resolves();

      return collectionController.updateSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.refresh).be.calledOnce();
          should(kuzzle.validation.curateSpecification).be.called();
          should(kuzzle.internalEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWithMatch('validations', `${index}#${collection}`);
          should(response).match(request.input.body);
        });
    });

    it('should rejects and do not create or replace specifications if the specs are wrong when requested with deprecated way', () => {
      request.input.resource.index = undefined;
      request.input.resource.collection = undefined;
      index = 'myindex';
      collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'bad bad',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification.resolves({
        isValid: false,
        errors: ['bad bad is a bad type !']
      });

      return collectionController.updateSpecifications(request)
        .catch(error => {
          should(kuzzle.internalEngine.refresh).not.be.called();
          should(kuzzle.validation.curateSpecification).not.be.called();
          should(kuzzle.internalEngine.createOrReplace).not.be.called();

          should(error).be.an.instanceOf(BadRequestError);
          should(error.message).be.exactly('Some errors with provided specifications.');
          should(error.details).match([ 'bad bad is a bad type !' ]);
        });
    });
  });

  describe('#validateSpecifications', () => {
    it('should call the right functions and respond with the right response', () => {
      request.input.resource.index = 'myindex';
      request.input.resource.collection = 'mycollection';
      request.input.body = {
        strict: true,
        fields: {
          myField: {
            mandatory: true,
            type: 'integer',
            defaultValue: 42
          }
        }
      };

      const specifications = [{
        _id: 'indexcollection',
        _source: {
          validation: 'validation',
          index: 'index',
          collection: 'collection'
        }
      }];

      const createSpecificationList = sinon.stub().resolves(specifications);
      const validateSpecificationList = sinon.stub().resolves({valid: true});

      CollectionController.__set__({
        createSpecificationList,
        validateSpecificationList
      });

      return collectionController.validateSpecifications(request)
        .then(response => {
          should(response).match({valid: true});
          should(validateSpecificationList)
            .be.calledOnce()
            .be.calledWith(kuzzle.validation, specifications);
        });
    });

    it('should call the right functions and respond with the right response if there is an error', () => {
      const errorResponse = {
        valid: false,
        details: ['bad bad is a bad type'],
        message: 'Some error message'
      };

      request.input.resource.index = 'myindex';
      request.input.resource.collection = 'mycollection';
      request.input.body = {
        strict: true,
        fields: {
          myField: {
            mandatory: true,
            type: 'bad bad',
            defaultValue: 42
          }
        }
      };

      const specifications = [{
        _id: 'indexcollection',
        _source: {
          validation: 'validation',
          index: 'index',
          collection: 'collection'
        }
      }];

      const createSpecificationList = sinon.stub().resolves(specifications);
      const validateSpecificationList = sinon.stub().resolves(errorResponse);

      CollectionController.__set__({
        createSpecificationList,
        validateSpecificationList
      });

      return collectionController.validateSpecifications(request)
        .then(response => {
          should(response).match(errorResponse);
          should(validateSpecificationList).be.calledOnce();
        });
    });

    it('should call the right functions and respond with the right response when requested with deprecated way', () => {
      request.input.resource.index = undefined;
      request.input.resource.collection = undefined;
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'integer',
                defaultValue: 42
              }
            }
          }
        }
      };

      const specifications = [{
        _id: 'indexcollection',
        _source: {
          validation: 'validation',
          index: 'index',
          collection: 'collection'
        }
      }];

      const createSpecificationList = sinon.stub().resolves(specifications);
      const validateSpecificationList = sinon.stub().resolves({valid: true});

      CollectionController.__set__({
        createSpecificationList,
        validateSpecificationList
      });

      return collectionController.validateSpecifications(request)
        .then(response => {
          should(response).match({valid: true});
          should(validateSpecificationList)
            .be.calledOnce()
            .be.calledWith(kuzzle.validation, specifications);
        });
    });

    it('should call the right functions and respond with the right response if there is an error when requested with deprecated way', () => {
      request.input.resource.index = undefined;
      request.input.resource.collection = undefined;
      const errorResponse = {
        valid: false,
        details: ['bad bad is a bad type'],
        message: 'Some error message'
      };

      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'bad bad',
                defaultValue: 42
              }
            }
          }
        }
      };

      const specifications = [{
        _id: 'indexcollection',
        _source: {
          validation: 'validation',
          index: 'index',
          collection: 'collection'
        }
      }];

      const createSpecificationList = sinon.stub().resolves(specifications);
      const validateSpecificationList = sinon.stub().resolves(errorResponse);

      CollectionController.__set__({
        createSpecificationList,
        validateSpecificationList
      });

      return collectionController.validateSpecifications(request)
        .then(response => {
          should(response).match(errorResponse);
          should(validateSpecificationList).be.calledOnce();
        });
    });
  });

  describe('#deleteSpecifications', () => {
    it('should call the right functions and respond with the right response if the validation specification exists', () => {
      kuzzle.internalEngine.delete.resolves();

      kuzzle.validation.specification = {};
      kuzzle.validation.specification[index] = {};
      kuzzle.validation.specification[index][collection] = {};

      return collectionController.deleteSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.delete).be.calledOnce();
          should(response).match({acknowledged: true});
        });
    });

    it('should resolves if there is no specification set', () => {
      kuzzle.validation.specification = {};

      return collectionController.deleteSpecifications(request)
        .then(response => {
          should(kuzzle.internalEngine.delete).not.be.called();
          should(response).match({acknowledged: true});
        });
    });
  });

  describe('#list', () => {
    beforeEach(() => {
      kuzzle.services.list.storageEngine.listCollections.resolves({collections: {stored: ['foo']}});
      kuzzle.hotelClerk.getRealtimeCollections.returns(['foo', 'bar']);
    });

    it('should resolve to a full collections list', () => {
      request = new Request({index: 'index'});

      return collectionController.list(request)
        .then(response => {
          should(kuzzle.hotelClerk.getRealtimeCollections).be.calledOnce();
          should(kuzzle.services.list.storageEngine.listCollections).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('all');
          should(response.collections).not.be.undefined().and.be.an.Array();
          should(response.collections).deepEqual([{name: 'bar', type: 'realtime'}, {name: 'foo', type: 'realtime'}, {name: 'foo', type: 'stored'}]);
        });
    });

    it('should reject the request if an invalid "type" argument is provided', () => {
      request = new Request({index: 'index', type: 'foo'});

      should(() => collectionController.list(request)).throw(
        BadRequestError,
        { message: 'Must specify a valid type argument; Expected: \'all\', \'stored\' or \'realtime\'; Received: foo.'});
    });

    it('should only return stored collections with type = stored', () => {
      request = new Request({index: 'index', type: 'stored'});

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('stored');
          should(kuzzle.hotelClerk.getRealtimeCollections).not.be.called();
          should(kuzzle.services.list.storageEngine.listCollections).be.called();
        });
    });

    it('should only return realtime collections with type = realtime', () => {
      request = new Request({index: 'index', type: 'realtime'});

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('realtime');
          should(kuzzle.hotelClerk.getRealtimeCollections).be.called();
          should(kuzzle.services.list.storageEngine.listCollections).not.be.called();
        });
    });

    it('should return a portion of the collection list if from and size are specified', () => {
      request = new Request({index: 'index', type: 'all', from: 2, size: 3});
      kuzzle.services.list.storageEngine.listCollections.resolves({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}});
      kuzzle.hotelClerk.getRealtimeCollections.returns(['arealtime', 'brealtime', 'crealtime', 'drealtime', 'erealtime']);

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'brealtime', type: 'realtime'},
            {name: 'bstored', type: 'stored'},
            {name: 'crealtime', type: 'realtime'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections).be.called();
          should(kuzzle.services.list.storageEngine.listCollections).be.called();
        });
    });

    it('should return a portion of the collection list if from is specified', () => {
      request = new Request({index: 'index', type: 'all', from: 8});
      kuzzle.services.list.storageEngine.listCollections.resolves({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}});
      kuzzle.hotelClerk.getRealtimeCollections.returns(['arealtime', 'brealtime', 'crealtime', 'drealtime', 'erealtime']);

      return collectionController.list(request)
        .then(response => {
          should(response.type).be.exactly('all');
          should(response.collections).be.deepEqual([
            {name: 'erealtime', type: 'realtime'},
            {name: 'estored', type: 'stored'}
          ]);
          should(response).be.instanceof(Object);
          should(kuzzle.hotelClerk.getRealtimeCollections).be.called();
          should(kuzzle.services.list.storageEngine.listCollections).be.called();
        });
    });

    it('should return a portion of the collection list if size is specified', () => {
      request = new Request({index: 'index', type: 'all', size: 2});
      kuzzle.services.list.storageEngine.listCollections.resolves({
        collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}
      });
      kuzzle.hotelClerk.getRealtimeCollections.returns(['arealtime', 'brealtime', 'crealtime', 'drealtime', 'erealtime']);

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'arealtime', type: 'realtime'},
            {name: 'astored', type: 'stored'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections).be.called();
          should(kuzzle.services.list.storageEngine.listCollections).be.called();
        });
    });


    it('should reject an error if getting stored collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.rejects(new Error('foobar'));
      request = new Request({index: 'index', type: 'stored'});
      return should(collectionController.list(request)).be.rejected();
    });

    it('should reject an error if getting all collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.rejects(new Error('foobar'));
      request = new Request({index: 'index', type: 'all'});
      return should(collectionController.list(request)).be.rejected();
    });
  });

  describe('#exists', () => {
    it('should call the storageEngine', () => {
      kuzzle.services.list.storageEngine.collectionExists.resolves(foo);
      return collectionController.exists(request)
        .then(response => {
          should(response).match(foo);
          should(kuzzle.services.list.storageEngine.collectionExists).be.calledOnce();
        });
    });
  });

  describe('#create', () => {
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return collectionController.create(request)
        .then(response => {
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
        });
    });
  });
});
