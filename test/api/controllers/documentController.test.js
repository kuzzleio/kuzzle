'use strict';

const
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  DocumentController = require('../../../lib/api/controllers/documentController'),
  {
    Request,
    errors: {
      BadRequestError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/baseController');

describe('DocumentController', () => {
  let
    documentController,
    kuzzle,
    request,
    index,
    collection;

  beforeEach(() => {
    index = 'festivals';

    collection = 'huma';

    kuzzle = new KuzzleMock();

    documentController = new DocumentController(kuzzle);

    request = new Request({
      controller: 'document',
      index,
      collection
    });
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(documentController).instanceOf(BaseController);
    });
  });

  describe('#search', () => {
    it('should call publicStorage search method', async () => {
      documentController.publicStorage.search.resolves({
        scrollId: 'scrollId',
        hits: 'hits',
        aggregations: 'aggregations',
        total: 'total',
        other: 'other'
      });
      request.input.body = { query: { bar: 'bar '} };
      request.input.args.from = 1;
      request.input.args.size = 3;
      request.input.args.scroll = '10s';

      const response = await documentController.search(request);

      should(documentController.publicStorage.search).be.calledWith(
        index,
        collection,
        { query: { bar: 'bar '} },
        { from: 1, size: 3, scroll: '10s' });

      should(response).match({
        scrollId: 'scrollId',
        hits: 'hits',
        aggregations: 'aggregations',
        total: 'total'
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
        { errorName: 'api.base.search_page_size' });
    });

    it('should reject an error in case of error', () => {
      kuzzle.storageEngine.public.search.rejects(new Error('foobar'));

      return should(documentController.search(request)).be.rejectedWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should call publicStorage scroll method', async () => {
      documentController.publicStorage.scroll.resolves({
        scrollId: 'scrollId',
        hits: 'hits',
        total: 'total',
        other: 'other'
      });
      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      const response = await documentController.scroll(request);

      should(documentController.publicStorage.scroll).be.calledWith(
        index,
        collection,
        'SomeScrollIdentifier',
        { scroll: '1m' });

      should(response).match({
        scrollId: 'scrollId',
        hits: 'hits',
        total: 'total'
      });
    });

    it('should reject an error in case of error', () => {
      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      kuzzle.storageEngine.public.scroll.rejects(new Error('foobar'));

      return should(documentController.scroll(request)).be.rejectedWith('foobar');
    });
  });

  describe('#exists', () => {
    it('should call publicStorage exists method', async () => {
      documentController.publicStorage.exists.resolves(true);
      request.input.resource._id = 'foo';

      const response = await documentController.exists(request);

      should(documentController.publicStorage.exists).be.calledWith(
        index,
        collection,
        'foo');

      should(response).be.True();
    });
  });

  describe('#get', () => {
    it('should call publicStorage get method', async () => {
      documentController.publicStorage.get.resolves(({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        some: 'other'
      }));
      request.input.resource._id = 'foo';

      const response = await documentController.get(request);

      should(documentController.publicStorage.get).be.calledWith(
        index,
        collection,
        'foo');

      should(response).be.eql({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });
  });

  describe('#mGet', () => {
    beforeEach(() => {
      request.input.body = {
        ids: ['foo', 'bar']
      };

      documentController.publicStorage.mGet.resolves(({
        result: [
          { _id: 'id', _source: 'source', _version: 1, found: true, some: 'some' },
          { _id: 'id2', _source: 'source', _version: 1, found: true, some: 'some' }
        ],
        errors: []
      }));
    });

    it('should call publicStorage mGet method', async () => {
      const response = await documentController.mGet(request);

      should(documentController.publicStorage.mGet).be.calledWith(
        index,
        collection,
        ['foo', 'bar']);

      should(response).match({
        total: 2,
        hits: [
          { _id: 'id', _source: 'source', _version: 1, found: true },
          { _id: 'id2', _source: 'source', _version: 1, found: true }
        ]
      });
    });

    it('should throw an error if the number of documents to get exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => documentController.mGet(request)).throw(
        SizeLimitError,
        { errorName: 'api.base.search_page_size' });
    });

    it('should set a partial error if some documents are missing', async () => {
      documentController.publicStorage.mGet.resolves(({
        result: [
          { _id: 'id', _source: 'source', _version: 1, found: true, some: 'some' }
        ],
        errors: [
          { _id: 'id2', found: true }
        ]
      }));

      const response = await documentController.mGet(request);

      should(response).match({
        total: 2,
        hits: [
          { _id: 'id', _source: 'source', _version: 1, found: true },
          { _id: 'id2', found: true }
        ]
      });
      should(request.error).not.be.undefined();
      should(request.error.errorName).be.eql('api.document.some_document_missing');
    });
  });

  describe('#count', () => {
    it('should call publicStorage count method', async () => {
      documentController.publicStorage.count.resolves(42);
      request.input.body = { query: {} };

      const response = await documentController.count(request);

      should(documentController.publicStorage.count).be.calledWith(
        index,
        collection,
        { query: {} });

      should(response).be.eql(42);
    });
  });

  describe('#create', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      documentController.publicStorage.create.resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });

    it('should call publicStorage create method and notify', async () => {
      request.input.resource._id = 'foobar';
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.create(request);

      should(documentController.publicStorage.create).be.calledWith(
        index,
        collection,
        content,
        { id: 'foobar', userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(
        request,
        {
          _id: '_id',
          _version: '_version',
          _source: '_source'
        });
      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });

    it('should have default value for refresh, userId and id', async () => {
      await documentController.create(request);

      should(documentController.publicStorage.create).be.calledWith(
        index,
        collection,
        content,
        { id: null, userId: null, refresh: 'false' });
    });
  });

  describe('#_mChanges', () => {
    let
      documents,
      result;

    beforeEach(() => {
      documents = [
        { _id: '_id1', body: '_source' },
        { _id: '_id2', body: '_source' },
        { _id: '_id3', body: '_source' }
      ];

      request.input.body = { documents };

      result = [
        { _id: '_id1', _source: '_source', _version: '_version', created: true, result: 'created' },
        { _id: '_id2', _source: '_source', _version: '_version', created: true, result: 'created' },
        { _id: '_id3', _source: '_source', _version: '_version', created: true, result: 'created' }
      ];

      documentController.publicStorage.mCreate.resolves(({
        result,
        errors: []
      }));
    });

    it('should call the right publicStorage method and notify the changes', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController._mChanges(request, 'mCreate', true);

      should(documentController.publicStorage.mCreate).be.calledWith(
        index,
        collection,
        documents,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.notifier.notifyDocumentMChanges).be.calledWith(
        request,
        result,
        true);

      should(response).match({
        result,
        errors: []
      });
    });

    it('should have default values for userId and refresh params', async () => {
      await documentController._mChanges(request, 'mCreate', true);

      should(documentController.publicStorage.mCreate).be.calledWith(
        index,
        collection,
        documents,
        { userId: null, refresh: 'false' });
    });

    it('should set a partial error if some actions failed', async () => {
      documentController.publicStorage.mCreate.resolves(({
        result,
        errors: [
          {
            document: { _id: '_id42', _source: '_source' },
            status: 206,
            reason: 'reason'
          }
        ]
      }));

      await documentController._mChanges(request, 'mCreate', true);

      should(request.error.status).be.eql(206);
      should(request.error.errorName).be.eql('api.document.creation_failed');
      should(request.error.errors).match([
        {
          document: { _id: '_id42', _source: '_source' },
          status: 206,
          reason: 'reason'
        }
      ]);
    });
  });

  describe('#createOrReplace', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      documentController.publicStorage.createOrReplace.resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        created: true
      });

      request.input.resource._id = 'foobar';
    });

    it('should call publicStorage createOrReplace method and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.createOrReplace(request);

      should(documentController.publicStorage.createOrReplace).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.notifier.notifyDocumentCreate).be.calledWith(
        request,
        {
          _id: '_id',
          _version: '_version',
          _source: '_source',
          created: true
        });
      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        created: true
      });
    });

    it('should notify replace if document was replaced', async () => {
      documentController.publicStorage.createOrReplace.resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        created: false
      });

      await documentController.createOrReplace(request);

      should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(
        request);
    });

    it('should have default value for refresh and userId', async () => {
      await documentController.createOrReplace(request);

      should(documentController.publicStorage.createOrReplace).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: null, refresh: 'false' });
    });
  });

  describe('#update', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      documentController.publicStorage.update.resolves({
        _id: '_id',
        _version: '_version'
      });

      request.input.resource._id = 'foobar';
    });

    it('should call publicStorage update method and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';
      request.input.args.retryOnConflict = 42;

      const response = await documentController.update(request);

      should(documentController.publicStorage.update).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for', retryOnConflict: 42 });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.notifier.notifyDocumentUpdate).be.calledWith(
        request);
      should(response).match({
        _id: '_id',
        _version: '_version'
      });
    });

    it('should have default value for refresh, userId and retryOnConflict', async () => {
      await documentController.update(request);

      should(documentController.publicStorage.update).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: null, refresh: 'false', retryOnConflict: undefined });
    });
  });

  describe('#replace', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      documentController.publicStorage.replace.resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });

      request.input.resource._id = 'foobar';
    });

    it('should call publicStorage replace method and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.replace(request);

      should(documentController.publicStorage.replace).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.notifier.notifyDocumentReplace).be.calledWith(
        request);
      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });

    it('should have default value for refresh and userId', async () => {
      await documentController.replace(request);

      should(documentController.publicStorage.replace).be.calledWith(
        index,
        collection,
        'foobar',
        content,
        { userId: null, refresh: 'false' });
    });
  });

  describe('#delete', () => {
    it('should call publicStorage delete method and notify', async () => {
      request.input.resource._id = 'foobar';

      const response = await documentController.delete(request);

      should(kuzzle.notifier.publish).be.calledWith(request);

      should(documentController.publicStorage.delete).be.calledWith(
        index,
        collection,
        'foobar');

      should(kuzzle.notifier.notifyDocumentMDelete).be.calledWith(
        request,
        ['foobar']);

      should(response).match({
        _id: 'foobar'
      });
    });
  });

  describe('#mDelete', () => {
    let
      ids,
      result;

    beforeEach(() => {
      ids = ['id1', 'id2', 'id3'];

      request.input.body = { ids };

      result = ['id1', 'id2', 'id3'];

      documentController.publicStorage.mDelete.resolves(({
        result,
        errors: []
      }));
    });

    it('should call publicStorage mDelete method and notify the changes', async () => {
      request.input.args.refresh = 'wait_for';

      const response = await documentController.mDelete(request);

      should(documentController.publicStorage.mDelete).be.calledWith(
        index,
        collection,
        ids,
        { refresh: 'wait_for' });

      should(kuzzle.notifier.notifyDocumentMDelete).be.calledWith(request, result);

      should(response).match(result);
    });

    it('should set a partial error if some actions failed', async () => {
      documentController.publicStorage.mDelete.resolves(({
        result,
        errors: [
          { id: 'id1', reason: 'reason' }
        ]
      }));

      await documentController.mDelete(request);

      should(request.error.status).be.eql(206);
      should(request.error.errorName).be.eql('api.document.deletion_failed');
      should(request.error.errors).match([
        { id: 'id1', reason: 'reason' }
      ]);
    });
  });

  describe('#deleteByQuery', () => {
    beforeEach(() => {
      documentController.publicStorage.deleteByQuery.resolves(({
        ids: ['id1', 'id2'],
        total: 2,
        deleted: 2,
        failures: []
      }));
    });

    it('should call publicStorage deleteByQuery method and notify the changes', async () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.deleteByQuery(request);

      should(documentController.publicStorage.deleteByQuery).be.calledWith(
        index,
        collection,
        { foo: 'bar' },
        { refresh: 'wait_for' });

      should(kuzzle.notifier.notifyDocumentMDelete).be.calledWith(
        request,
        ['id1', 'id2']);

      should(response).be.eql(['id1', 'id2']);
    });
  });

  describe('#validate', () => {
    it('should call validation.validate method', async () => {
      request.input.body = { foo: 'bar' };
      kuzzle.validation.validate.resolves({ ok: 'ok' });

      const response = await documentController.validate(request);

      should(kuzzle.validation.validate).be.calledWith(
        request,
        true);

      should(response).match({ ok: 'ok' });
    });
  });
});
