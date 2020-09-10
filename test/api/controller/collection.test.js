'use strict';

const should = require('should');
const sinon = require('sinon');
const {
  Request,
  BadRequestError,
  NotFoundError,
  SizeLimitError
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const CollectionController = require('../../../lib/api/controller/collection');
const { NativeController } = require('../../../lib/api/controller/base');

describe('Test: collection controller', () => {
  let collectionController;
  let kuzzle;
  let index = '%text';
  let collection = 'unit-test-collectionController';
  let request;

  beforeEach(() => {
    const data = {
      controller: 'collection',
      index,
      collection
    };

    kuzzle = new KuzzleMock();
    collectionController = new CollectionController(kuzzle);

    request = new Request(data);
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(collectionController).instanceOf(NativeController);
    });
  });

  describe('#updateMapping', () => {
    it('should throw a BadRequestError if the body is missing', () => {
      return should(collectionController.updateMapping(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should call updateMapping on publicStorage', async () => {
      const mappings = {
        dynamic: 'false',
        _meta: 'data',
        properties: 'properties'
      };
      request.input.body = mappings;
      collectionController.publicStorage.updateMapping.resolves(mappings);

      const response = await collectionController.updateMapping(request);

      should(collectionController.publicStorage.updateMapping)
        .be.calledWith(index, collection, mappings);

      should(response).match({
        dynamic: 'false',
        _meta: 'data',
        properties: 'properties'
      });
    });
  });

  describe('#getMapping', () => {
    it('should call getMapping on publicStorage', async () => {
      const mappings = {
        dynamic: 'false',
        _meta: 'data',
        properties: 'properties'
      };
      collectionController.publicStorage.getMapping.resolves(mappings);

      const response = await collectionController.getMapping(request);

      should(collectionController.publicStorage.getMapping)
        .be.calledWith(index, collection, { includeKuzzleMeta: false });

      should(response).match(mappings);
    });

    it('should include kuzzleMeta if specified', async () => {
      const mappings = {
        dynamic: 'false',
        _meta: 'data',
        properties: 'properties'
      };
      request.input.args.includeKuzzleMeta = true;
      collectionController.publicStorage.getMapping.resolves(mappings);

      await collectionController.getMapping(request);

      should(collectionController.publicStorage.getMapping)
        .be.calledWith(index, collection, { includeKuzzleMeta: true });
    });
  });

  describe('#truncate', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      const response = await collectionController.truncate(request);

      should(collectionController.publicStorage.truncateCollection)
        .be.calledWith(index, collection);

      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#getSpecifications', () => {
    it('should trigger the proper methods and return a valid response', async () => {
      kuzzle.internalIndex.get.resolves({ _source: { some: 'validation' } });

      const response = await collectionController.getSpecifications(request);

      should(kuzzle.internalIndex.get).be.calledWithMatch(
        'validations',
        `${index}#${collection}`);

      should(response).match({
        some: 'validation'
      });
    });

    it('should give a meaningful message if there is no specifications', () => {
      kuzzle.internalIndex.get.rejects(new NotFoundError('not found'));

      return should(collectionController.getSpecifications(request))
        .be.rejectedWith(
          NotFoundError,
          {id: 'validation.assert.not_found'});
    });
  });

  describe('#searchSpecifications', () => {
    it('should throw if the page size exceeds server limitations', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.from = 0;
      request.input.args.size = 20;

      should(() => collectionController.searchSpecifications(request)).throw(
        SizeLimitError,
        { id: 'services.storage.get_limit_exceeded' });
    });

    it('should call internalIndex with the right data', () => {
      kuzzle.internalIndex.search.resolves({
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
          should(kuzzle.internalIndex.search).be.calledWithMatch(
            'validations',
            request.input.body,
            {
              from: request.input.args.from,
              size: request.input.args.size,
              scroll: request.input.args.scroll
            });

          should(response).match({
            total: 123,
            scrollId: 'foobar',
            hits: [{ _id: 'bar' }]
          });
        });
    });
  });

  describe('#scrollSpecifications', () => {
    it('should throw if no scrollId is provided', () => {
      request = new Request({
        controller: 'collection',
        action: 'scrollSpecifications'
      });

      should(() => collectionController.scrollSpecifications(request))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should call internalIndex with the right data', async () => {
      kuzzle.internalIndex.scroll.resolves({
        hits: [{ _id: 'bar' }],
        scrollId: 'foobar',
        total: 123
      });

      request = new Request({ scrollId: 'foobar' });

      const response = await collectionController.scrollSpecifications(request);

      should(kuzzle.internalIndex.scroll).be.calledWithMatch(
        'foobar',
        collectionController.defaultScrollTTL);

      should(response).match({
        total: 123,
        scrollId: 'foobar',
        hits: [{ _id: 'bar' }]
      });
    });

    it('should handle the optional scroll argument', async () => {
      kuzzle.internalIndex.scroll.resolves({
        hits: [{ _id: 'bar' }],
        scrollId: 'foobar',
        total: 123
      });

      request = new Request({ scrollId: 'foobar', scroll: 'qux' });

      const response = await collectionController.scrollSpecifications(request);

      should(kuzzle.internalIndex.scroll)
        .be.calledWithMatch('foobar', 'qux');

      should(response).match({
        total: 123,
        scrollId: 'foobar',
        hits: [{ _id: 'bar' }]
      });
    });
  });

  describe('#updateSpecifications', () => {
    it('should create or replace specifications', async () => {
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
      kuzzle.validation.validateFormat.resolves({ isValid: true });
      kuzzle.validation.curateSpecification.resolves();

      const response = await collectionController.updateSpecifications(request);

      should(kuzzle.internalIndex.refreshCollection).be.calledWith('validations');
      should(kuzzle.validation.curateSpecification).be.called();
      should(kuzzle.internalIndex.createOrReplace).be.calledWithMatch(
        'validations',
        `${index}#${collection}`,
        {
          index,
          collection,
          validation: request.input.body
        });

      should(response).match(request.input.body);
    });

    it('should rejects and do not create or replace specifications if the specs are wrong', () => {
      request.input.body = {
        strict: true,
        fields: {
          myField: {
            mandatory: true,
            type: 'zorglub',
            defaultValue: 42
          }
        }
      };
      kuzzle.validation.validateFormat.resolves({
        isValid: false,
        errors: ['zorglub is a bad type !']
      });

      const promise = collectionController.updateSpecifications(request);


      return should(promise).be.rejectedWith(BadRequestError, { id: 'validation.assert.invalid_specifications' })
        .then(() => {
          should(kuzzle.validation.curateSpecification).not.be.called();
          should(kuzzle.internalIndex.createOrReplace).not.be.called();
        });
    });
  });

  describe('#validateSpecifications', () => {
    beforeEach(() => {
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
    });

    it('should call the right functions and respond with the right response', async () => {
      kuzzle.validation.validateFormat.resolves({ isValid: true });

      const response = await collectionController.validateSpecifications(request);

      should(kuzzle.validation.validateFormat)
        .be.calledWith(index, collection, request.input.body, true);
      should(response).match({
        valid: true
      });
    });

    it('should return an error if specifications are invalid', async () => {
      kuzzle.validation.validateFormat.resolves({
        isValid: false,
        errors: 'errors'
      });

      const response = await collectionController.validateSpecifications(request);

      should(response).match({
        valid: false,
        details: 'errors',
        description: 'Some errors with provided specifications.'
      });
    });
  });

  describe('#deleteSpecifications', () => {
    it('should call the right functions and respond with the right response if the validation specification exists', async () => {
      kuzzle.internalIndex.delete.resolves();

      const response = await collectionController.deleteSpecifications(request);

      should(kuzzle.internalIndex.delete)
        .be.calledWith('validations', `${index}#${collection}`);
      should(kuzzle.internalIndex.refreshCollection).be.calledWith('validations');
      should(kuzzle.validation.curateSpecification).be.calledOnce();

      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#list', () => {
    let realtimeListCollectionsStub;

    beforeEach(() => {
      collectionController.publicStorage.listCollections.resolves(['col', 'loc']);
      realtimeListCollectionsStub = kuzzle.ask
        .withArgs('core:realtime:collections:get', sinon.match.string)
        .resolves(['foo', 'bar']);
    });

    it('should resolve to a full collections list', async () => {
      const response = await collectionController.list(request);

      should(kuzzle.ask).calledWith(
        'core:realtime:collections:get',
        request.input.resource.index);

      should(collectionController.publicStorage.listCollections)
        .be.calledWith(index);

      should(response.type).be.exactly('all');
      should(response.collections).be.an.Array();
      should(response.collections).deepEqual([
        { name: 'bar', type: 'realtime' },
        { name: 'col', type: 'stored' },
        { name: 'foo', type: 'realtime' },
        { name: 'loc', type: 'stored' }
      ]);
    });

    it('should reject the request if an invalid "type" argument is provided', () => {
      request = new Request({index: 'index', type: 'foo'});

      return should(collectionController.list(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should only return stored collections with type = stored', async () => {
      request = new Request({index: 'index', type: 'stored'});

      const response = await collectionController.list(request);

      should(response).be.instanceof(Object);
      should(response.type).be.exactly('stored');
      should(realtimeListCollectionsStub).not.be.called();
      should(collectionController.publicStorage.listCollections).be.called();
    });

    it('should only return realtime collections with type = realtime', async () => {
      request = new Request({index: 'index', type: 'realtime'});

      const response = await collectionController.list(request);

      should(response).be.instanceof(Object);
      should(response.type).be.exactly('realtime');
      should(realtimeListCollectionsStub)
        .calledWith('core:realtime:collections:get', 'index');
      should(collectionController.publicStorage.listCollections).not.be.called();
    });

    it('should return a portion of the collection list if from and size are specified', async () => {
      request = new Request({index: 'index', type: 'all', from: 2, size: 3});
      collectionController.publicStorage.listCollections.resolves(['astored', 'bstored', 'cstored', 'dstored', 'estored']);
      realtimeListCollectionsStub.resolves([
        'arealtime',
        'brealtime',
        'crealtime',
        'drealtime',
        'erealtime'
      ]);

      const response = await collectionController.list(request);

      should(response).be.instanceof(Object);
      should(response.collections).be.deepEqual([
        {name: 'brealtime', type: 'realtime'},
        {name: 'bstored', type: 'stored'},
        {name: 'crealtime', type: 'realtime'}
      ]);
      should(response.type).be.exactly('all');
      should(realtimeListCollectionsStub)
        .calledWith('core:realtime:collections:get', 'index');
      should(collectionController.publicStorage.listCollections).be.called();
    });

    it('should return a portion of the collection list if from is specified', async () => {
      request = new Request({index: 'index', type: 'all', from: 8});
      collectionController.publicStorage.listCollections.resolves(['astored', 'bstored', 'cstored', 'dstored', 'estored']);
      realtimeListCollectionsStub.resolves([
        'arealtime',
        'brealtime',
        'crealtime',
        'drealtime',
        'erealtime'
      ]);

      const response = await collectionController.list(request);

      should(response.type).be.exactly('all');
      should(response.collections).be.deepEqual([
        {name: 'erealtime', type: 'realtime'},
        {name: 'estored', type: 'stored'}
      ]);
      should(response).be.instanceof(Object);
      should(realtimeListCollectionsStub)
        .calledWith('core:realtime:collections:get', 'index');
      should(collectionController.publicStorage.listCollections).be.called();
    });

    it('should return a portion of the collection list if size is specified', async () => {
      request = new Request({index: 'index', type: 'all', size: 2});
      collectionController.publicStorage.listCollections.resolves(['astored', 'bstored', 'cstored', 'dstored', 'estored']);
      realtimeListCollectionsStub.resolves([
        'arealtime',
        'brealtime',
        'crealtime',
        'drealtime',
        'erealtime'
      ]);

      const response = await collectionController.list(request);

      should(response).be.instanceof(Object);
      should(response.collections).be.deepEqual([
        {name: 'arealtime', type: 'realtime'},
        {name: 'astored', type: 'stored'}
      ]);
      should(response.type).be.exactly('all');
      should(realtimeListCollectionsStub)
        .calledWithMatch('core:realtime:collections:get', 'index');
      should(collectionController.publicStorage.listCollections).be.called();
    });

    it('should reject if getting stored collections fails', () => {
      collectionController.publicStorage.listCollections.rejects(new Error('foobar'));
      request = new Request({index: 'index', type: 'stored'});
      return should(collectionController.list(request)).be.rejected();
    });

    it('should reject if getting all collections fails', () => {
      collectionController.publicStorage.listCollections.rejects(new Error('foobar'));
      request = new Request({index: 'index', type: 'all'});
      return should(collectionController.list(request)).be.rejected();
    });
  });

  describe('#exists', () => {
    it('should call the storageEngine', () => {
      collectionController.publicStorage.collectionExists.resolves(true);

      return collectionController.exists(request)
        .then(response => {
          should(response).match(true);
          should(collectionController.publicStorage.collectionExists).be.calledOnce();
        });
    });
  });

  describe('#refresh', () => {
    it('should call the storageEngine', async () => {
      const response = await collectionController.refresh(request);

      should(response).be.null();
      should(collectionController.publicStorage.refreshCollection)
        .be.calledWith(index, collection);
    });
  });

  describe('#create', () => {
    it('should resolve to a valid response', async () => {
      const response = await collectionController.create(request);

      should(collectionController.publicStorage.createCollection)
        .be.calledWith(index, collection);

      should(response).be.instanceof(Object);
      should(response).match({
        acknowledged: true
      });
    });
  });

  describe('#delete', () => {
    it('should call deleteCollection', async () => {
      const response = await collectionController.delete(request);

      should(collectionController.publicStorage.deleteCollection)
        .be.calledWith(index, collection);

      should(response).be.null();
    });
  });
});
