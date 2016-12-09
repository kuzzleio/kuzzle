var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  CollectionController = rewire('../../../lib/api/controllers/collectionController'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: collection controller', () => {
  var
    collectionController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-collectionController',
    request,
    engine;

  beforeEach(() => {
    var data = {
      controller: 'collection',
      index,
      collection
    };
    kuzzle = new KuzzleMock();
    engine = kuzzle.services.list.storageEngine;
    collectionController = new CollectionController(kuzzle);
    request = new Request(data);
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('#updateMapping', () => {
    it('should activate a hook on a mapping update call and add the collection to the cache', () => {
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

  describe('#updateUserMapping', () => {
    it('should update the user mapping', () => {
      return collectionController.updateUserMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('users', request.input.body);

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

  describe('#getUserMapping', () => {
    it('should fulfill with a response object', () => {
      return collectionController.getUserMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.getMapping).be.calledOnce();
          should(kuzzle.internalEngine.getMapping).be.calledWith({index: kuzzle.internalEngine.index, type: 'users'});

          should(response).be.instanceof(Object);
          should(response).match({mapping: {}});
        });
    });
  });

  describe('#truncate', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return collectionController.truncate(request)
        .then(response => {
          var truncate = kuzzle.services.list.storageEngine.truncateCollection;

          should(truncate).be.calledOnce();
          should(truncate).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getSpecifications', () => {
    it('should call internalEngine with the right id', () => {
      kuzzle.internalEngine.get = sandbox.stub().returns(Promise.resolve({_source: {foo: 'bar'}}));

      return collectionController.getSpecifications(request)
        .then(response => {
          try {
            should(kuzzle.internalEngine.get).be.calledOnce();
            should(kuzzle.internalEngine.get).be.calledWithMatch('validations', `${index}#${collection}`);
            should(response).match(foo);
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#searchSpecifications', () => {
    it('should call internalEngine with the right data', () => {
      kuzzle.internalEngine.search = sandbox.stub().returns(Promise.resolve({hits: [{_id: 'bar'}]}));

      request.input.body = {
        query: {
          match_all: {}
        }
      };
      request.input.args.from = 0;
      request.input.args.size = 20;

      return collectionController.searchSpecifications(request)
        .then(response => {
          try {
            should(kuzzle.internalEngine.search).be.calledOnce();
            should(kuzzle.internalEngine.search).be.calledWithMatch('validations', request.input.body.query, request.input.args.from, request.input.args.size);
            should(response).match({hits: [{_id: 'bar'}]});
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#updateSpecifications', () => {
    it('should create or replace specifications', () => {
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

      kuzzle.validation.isValidSpecification = sandbox.stub().returns(Promise.resolve({isValid: true}));
      kuzzle.validation.curateSpecification = sandbox.stub().returns(Promise.resolve());

      return collectionController.updateSpecifications(request)
        .then(response => {
          try {
            should(kuzzle.internalEngine.refresh).be.calledOnce();
            should(kuzzle.validation.curateSpecification).be.called();
            should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
            should(kuzzle.internalEngine.createOrReplace).be.calledWithMatch('validations', `${index}#${collection}`);
            should(response).match(request.input.body);

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should rejects and do not create or replace specifications if the specs are wrong', () => {
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

      kuzzle.validation.isValidSpecification = sandbox.stub().returns(Promise.resolve({
        isValid: false,
        errors: ['bad bad is a bad type !']
      }));
      kuzzle.validation.curateSpecification = sandbox.stub();

      return collectionController.updateSpecifications(request)
        .catch(error => {
          try {
            should(kuzzle.internalEngine.refresh).not.be.called();
            should(kuzzle.validation.curateSpecification).not.be.called();
            should(kuzzle.internalEngine.createOrReplace).not.be.called();

            should(error).be.an.instanceOf(BadRequestError);
            should(error.message).be.exactly('Some errors with provided specifications.');
            should(error.details).match([ 'bad bad is a bad type !' ]);

            return Promise.resolve();
          }
          catch (er) {
            return Promise.reject(er);
          }
        });
    });
  });

  describe('#validateSpecifications', () => {
    it('should call the right functions and respond with the right response', () => {
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

      CollectionController.__set__({
        prepareSpecificationValidation: sandbox.stub().returns(Promise.resolve(request.input.body))
      });

      return collectionController.validateSpecifications(request)
        .then(response => {
          try {
            should(response).match({valid: true});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should call the right functions and respond with the right response if there is an error', () => {
      var err = new Error('error');
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

      err.details = 'some error';

      CollectionController.__set__({
        prepareSpecificationValidation: sandbox.stub().returns(Promise.reject(err))
      });

      return collectionController.validateSpecifications(request)
        .then(() => Promise.reject())
        .catch((error) => {
          should(request.result).match({
            valid: false,
            errors: 'some error'
          });
          should(error).be.eql(err);
        });
    });
  });

  describe('#deleteSpecifications', () => {
    it('should call the right functions and respond with the right response if the validation specification exists', () => {
      kuzzle.internalEngine.delete = sandbox.stub().returns(Promise.resolve());

      kuzzle.validation.specification = {};
      kuzzle.validation.specification[index] = {};
      kuzzle.validation.specification[index][collection] = {};

      return collectionController.deleteSpecifications(request)
        .then(response => {

          try {
            should(kuzzle.internalEngine.delete).be.calledOnce();
            should(response).match({});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should resolves if there is no specification set', () => {
      kuzzle.internalEngine.delete = sandbox.stub();
      kuzzle.validation.specification = {};

      return collectionController.deleteSpecifications(request)
        .then(response => {
          try {
            should(kuzzle.internalEngine.delete).not.be.called();
            should(response).match({});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#list', () => {
    beforeEach(() => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['foo']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'foo', index: 'index'},
        {name: 'bar', index: 'index'},
        {name: 'baz', index: 'wrong'}
      ]);
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

      return should(() => {
        collectionController.list(request);
      }).throw(BadRequestError);
    });

    it('should only return stored collections with type = stored', () => {
      request = new Request({index: 'index', type: 'stored'});

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('stored');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.false();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should only return realtime collections with type = realtime', () => {
      request = new Request({index: 'index', type: 'realtime'});

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('realtime');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.false();
        });
    });

    it('should return a portion of the collection list if from and size are specified', () => {
      request = new Request({index: 'index', type: 'all', from: 2, size: 3});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'brealtime', type: 'realtime'},
            {name: 'bstored', type: 'stored'},
            {name: 'crealtime', type: 'realtime'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should return a portion of the collection list if from is specified', () => {
      request = new Request({index: 'index', type: 'all', from: 8});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return collectionController.list(request)
        .then(response => {
          should(response.type).be.exactly('all');
          should(response.collections).be.deepEqual([
            {name: 'erealtime', type: 'realtime'},
            {name: 'estored', type: 'stored'}
          ]);
          should(response).be.instanceof(Object);
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should return a portion of the collection list if size is specified', () => {
      request = new Request({index: 'index', type: 'all', size: 2});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({
        collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}
      }));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'},
        {name: 'brealtime', index: 'index'},
        {name: 'crealtime', index: 'index'},
        {name: 'drealtime', index: 'index'},
        {name: 'erealtime', index: 'index'},
        {name: 'baz', index: 'wrong'}
      ]);

      return collectionController.list(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'arealtime', type: 'realtime'},
            {name: 'astored', type: 'stored'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });


    it('should reject an error if getting stored collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      request = new Request({index: 'index', type: 'stored'});
      return should(collectionController.list(request)).be.rejected();
    });

    it('should reject an error if getting all collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      request = new Request({index: 'index', type: 'all'});
      return should(collectionController.list(request)).be.rejected();
    });
  });

  describe('#exists', () => {
    it('should call the storageEngine', () => {
      kuzzle.services.list.storageEngine.collectionExists.returns(Promise.resolve(foo));
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

});
