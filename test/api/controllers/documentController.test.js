'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError,
  SizeLimitError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const DocumentController = require('../../../lib/api/controllers/documentController');
const { NativeController } = require('../../../lib/api/controllers/baseController');
const actionEnum = require('../../../lib/core/realtime/actionEnum');

describe('DocumentController', () => {
  const index = 'festivals';
  const collection = 'huma';
  let documentController;
  let kuzzle;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    documentController = new DocumentController();

    request = new Request({
      controller: 'document',
      index,
      collection
    });
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(documentController).instanceOf(NativeController);
    });
  });

  describe('#search', () => {
    beforeEach(() => {
      kuzzle.ask
        .withArgs('core:storage:public:document:search')
        .resolves({
          aggregations: 'aggregations',
          hits: 'hits',
          other: 'other',
          remaining: 'remaining',
          scrollId: 'scrollId',
          total: 'total',
        });
    });

    it('should forward to the store module', async () => {
      request.input.body = { query: { bar: 'bar '} };
      request.input.args.from = 1;
      request.input.args.size = 3;
      request.input.args.scroll = '10s';

      const response = await documentController.search(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:search',
        index,
        collection,
        { query: { bar: 'bar '} },
        { from: 1, size: 3, scroll: '10s' });

      should(response).match({
        aggregations: 'aggregations',
        hits: 'hits',
        remaining: 'remaining',
        scrollId: 'scrollId',
        total: 'total',
      });
    });

    it('should reject if index contains a comma', () => {
      request.input.resource.index = '%test,anotherIndex';
      request.input.action = 'search';

      return should(documentController.search(request)).rejectedWith(
        BadRequestError,
        { id: 'services.storage.no_multi_indexes' });
    });

    it('should reject if collection contains a comma', () => {
      request.input.resource.collection = 'unit-test-documentController,anotherCollection';
      request.input.action = 'search';

      return should(documentController.search(request)).rejectedWith(
        BadRequestError,
        { id: 'services.storage.no_multi_collections' });
    });

    it('should reject if the size argument exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;
      request.input.action = 'search';

      return should(documentController.search(request)).rejectedWith(
        SizeLimitError,
        { id: 'services.storage.get_limit_exceeded' });
    });

    it('should reject in case of error', () => {
      kuzzle.ask
        .withArgs('core:storage:public:document:search')
        .rejects(new Error('foobar'));

      return should(documentController.search(request)).rejectedWith('foobar');
    });

    it('should reject if the "lang" is not supported', () => {
      request.input.args.lang = 'turkish';

      return should(documentController.search(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should reject if the "lang" is not supported', () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.lang = 'turkish';

      return should(documentController.search(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: 'Melis' } } };
      request.input.args.lang = 'koncorde';
      documentController.translateKoncorde = sinon.stub().resolves();

      await documentController.search(request);

      should(documentController.translateKoncorde)
        .be.calledWith({ equals: { name: 'Melis' } });
    });
  });

  describe('#scroll', () => {
    it('should forward to the store module', async () => {
      kuzzle.ask
        .withArgs('core:storage:public:document:scroll')
        .resolves({
          hits: 'hits',
          other: 'other',
          remaining: 'remaining',
          scrollId: 'scrollId',
          total: 'total',
        });

      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      const response = await documentController.scroll(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:scroll',
        'SomeScrollIdentifier',
        { scrollTTL: '1m' });

      should(response).match({
        hits: 'hits',
        remaining: 'remaining',
        scrollId: 'scrollId',
        total: 'total',
      });
    });

    it('should reject in case of error', () => {
      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      kuzzle.ask
        .withArgs('core:storage:public:document:scroll')
        .rejects(new Error('foobar'));

      return should(documentController.scroll(request)).be.rejectedWith('foobar');
    });
  });

  describe('#exists', () => {
    it('should forward to the store module', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:exist').resolves(true);
      request.input.resource._id = 'foo';

      const response = await documentController.exists(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:exist',
        index,
        collection,
        'foo');

      should(response).be.True();
    });
  });

  describe('#get', () => {
    it('should forward to the store module', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:get').resolves(({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        some: 'other'
      }));

      request.input.resource._id = 'foo';

      const response = await documentController.get(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:get',
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

      kuzzle.ask.withArgs('core:storage:public:document:mGet').resolves(({
        items: [
          { _id: 'id', _source: 'source', _version: 1, some: 'some' },
          { _id: 'id2', _source: 'source', _version: 1, some: 'some' }
        ],
        errors: []
      }));
    });

    it('should forward to the store module', async () => {
      const response = await documentController.mGet(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:mGet',
        index,
        collection,
        ['foo', 'bar']);

      should(response).match({
        errors: [],
        successes: [
          { _id: 'id', _source: 'source', _version: 1 },
          { _id: 'id2', _source: 'source', _version: 1 }
        ]
      });
    });

    it('should throw an error if the number of documents to get exceeds server configuration', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => documentController.mGet(request)).throw(
        SizeLimitError,
        { id: 'services.storage.get_limit_exceeded' });
    });

    it('should handle errors if some documents are missing', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:mGet').resolves(({
        items: [
          { _id: 'id', _source: 'source', _version: 1, some: 'some' }
        ],
        errors: ['id2']
      }));

      const response = await documentController.mGet(request);

      should(response).match({
        errors: ['id2'],
        successes: [
          { _id: 'id', _source: 'source', _version: 1 }
        ]
      });
    });
  });

  describe('#count', () => {
    it('should forward to the store module', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:count').resolves(42);
      request.input.body = { query: {} };

      const response = await documentController.count(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:count',
        index,
        collection,
        { query: {} });

      should(response).be.eql({ count: 42 });
    });
  });

  describe('#create', () => {
    const content = { foo: 'bar' };

    beforeEach(() => {
      request.input.body = content;
      kuzzle.validation.validate.resolvesArg(0);

      kuzzle.ask.withArgs('core:storage:public:document:create').resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });

    it('should forward to the store module and notify', async () => {
      request.input.resource._id = 'foobar';
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.create(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:create',
        index,
        collection,
        content,
        { id: 'foobar', userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.ask).be.calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.CREATE,
        { _id: '_id', _source: '_source' });

      should(response).match({
        _id: '_id',
        _source: '_source',
        _version: '_version',
      });
    });

    it('should have default value for refresh, userId and id', async () => {
      await documentController.create(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:create',
        index,
        collection,
        content,
        { id: null, userId: null, refresh: 'false' });
    });
  });

  describe('#_mChanges', () => {
    let documents;
    let items;

    beforeEach(() => {
      documents = [
        { _id: '_id1', body: '_source' },
        { _id: '_id2', body: '_source' },
        { _id: '_id3', body: '_source' }
      ];

      request.input.body = { documents };

      items = [
        { _id: '_id1', _source: '_source', _version: '_version', created: true, result: 'created' },
        { _id: '_id2', _source: '_source', _version: '_version', created: true, result: 'created' },
        { _id: '_id3', _source: '_source', _version: '_version', created: true, result: 'created' }
      ];

      kuzzle.ask.withArgs('core:storage:public:document:mCreate').resolves(({
        items,
        errors: []
      }));
    });

    it('should forward to the store module and notify the changes', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController._mChanges(
        request,
        'mCreate',
        actionEnum.CREATE);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:mCreate',
        index,
        collection,
        documents,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.CREATE,
        items);

      should(response).match({
        errors: [],
        successes: items,
      });
    });

    it('should have default values for userId and refresh params', async () => {
      await documentController._mChanges(request, 'mCreate', actionEnum.CREATE);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:mCreate',
        index,
        collection,
        documents,
        { userId: null, refresh: 'false' });
    });

    it('should handle errors if some actions failed', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:mCreate').resolves(({
        items,
        errors: [
          {
            document: { _id: '_id42', _source: '_source' },
            status: 206,
            reason: 'reason'
          }
        ]
      }));

      const response = await documentController._mChanges(
        request,
        'mCreate',
        actionEnum.CREATE);

      should(response).match({
        successes: items,
        errors: [
          {
            document: { _id: '_id42', _source: '_source' },
            status: 206,
            reason: 'reason'
          }
        ]
      });
    });

    it('should reject if users give document with "_source" property', () => {
      request.input.body.documents = [
        { _id: 'doc-1', body: {} },
        { _id: 'doc-2', _source: {} },
      ];

      return should(documentController._mChanges(request, 'mCreate', actionEnum.CREATE))
        .be.rejectedWith({ id: 'api.assert.unexpected_argument' });
    });

    it('should reject if the number of documents to edit exceeds server configuration', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      return should(documentController._mChanges(request, 'foobar', actionEnum.CREATE))
        .rejectedWith(
          SizeLimitError,
          { id: 'services.storage.write_limit_exceeded' });
    });

    it('should return immediately if the provided payload is empty', async () => {
      request.input.body.documents = [];

      const response = await documentController._mChanges(
        request,
        'mCreate',
        actionEnum.CREATE);

      should(response).match({
        errors: [],
        successes: [],
      });

      should(kuzzle.ask.withArgs('core:storage:public:document:mCreate'))
        .not.called();
      should(kuzzle.ask.withArgs('core:realtime:document:mNotify'))
        .not.called();
    });
  });

  describe('#createOrReplace', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      kuzzle.ask
        .withArgs('core:storage:public:document:createOrReplace')
        .resolves({
          _id: '_id',
          _version: '_version',
          _source: '_source',
          created: true
        });

      request.input.resource._id = 'foobar';
    });

    it('should forward to the store module and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.createOrReplace(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:createOrReplace',
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.ask).calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.WRITE,
        { _id: '_id', _source: '_source' });

      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: '_source',
        created: true
      });
    });

    it('should have default value for refresh and userId', async () => {
      await documentController.createOrReplace(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:createOrReplace',
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

      kuzzle.ask.withArgs('core:storage:public:document:update').resolves({
        _id: '_id',
        _version: '_version',
        _source: { ...content, name: 'gordon' }
      });

      request.input.resource._id = 'foobar';
    });

    it('should forward to the store module and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';
      request.input.args.retryOnConflict = 42;

      const response = await documentController.update(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:update',
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for', retryOnConflict: 42 });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.ask).be.calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.UPDATE,
        {
          _id: '_id',
          _source: content,
          _updatedFields: Object.keys(request.input.body),
        });

      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: content
      });
    });

    it('should have default value for refresh, userId and retryOnConflict', async () => {
      await documentController.update(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:update',
        index,
        collection,
        'foobar',
        content,
        { userId: null, refresh: 'false', retryOnConflict: undefined });
    });

    it('should returns the entire document with source: true', async () => {
      request.input.args.source = true;
      const response = await documentController.update(request);

      should(response).be.eql({
        _id: '_id',
        _version: '_version',
        _source: { ...content, name: 'gordon' }
      });
    });
  });

  describe('#upsert', () => {
    let changes;
    let defaultValues;

    beforeEach(() => {
      changes = { foo: 'bar' };
      defaultValues = { def: 'val' };

      request.input.body = { changes, default: defaultValues };
      request.input.resource._id = 'foobar';

      kuzzle.ask.withArgs('core:storage:public:document:upsert').resolves({
        _id: '_id',
        _version: '_version',
        _source: { ...changes, name: 'gordon' },
        created: false,
      });
    });

    it('should forward to the storage module and notify on update', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';
      request.input.args.retryOnConflict = 42;

      const response = await documentController.upsert(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:upsert',
        index,
        collection,
        'foobar',
        changes,
        {
          defaultValues,
          refresh: 'wait_for',
          retryOnConflict: 42,
          userId: 'aschen',
        });

      should(kuzzle.ask).be.calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.UPDATE,
        {
          _id: '_id',
          _source: { ...changes, name: 'gordon' },
          _updatedFields: Object.keys(changes),
        });

      should(response).match({
        _id: '_id',
        _version: '_version',
        created: false,
      });
    });

    it('should forward to the storage module and notify on create', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';
      request.input.args.retryOnConflict = 42;

      kuzzle.ask.withArgs('core:storage:public:document:upsert').resolves({
        _id: '_id',
        _version: '_version',
        _source: { ...defaultValues, ...changes, name: 'gordon' },
        created: true,
      });

      const response = await documentController.upsert(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:upsert',
        index,
        collection,
        'foobar',
        changes,
        {
          defaultValues,
          refresh: 'wait_for',
          retryOnConflict: 42,
          userId: 'aschen',
        });

      should(kuzzle.ask).be.calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.CREATE,
        { ...defaultValues, ...changes, name: 'gordon' });

      should(response).match({
        _id: '_id',
        _version: '_version',
        created: true,
      });
    });

    it('should have default value for refresh, userId and retryOnConflict', async () => {
      request.input.body.default = undefined;

      await documentController.upsert(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:upsert',
        index,
        collection,
        'foobar',
        changes,
        {
          defaultValues: {},
          refresh: 'false',
          retryOnConflict: undefined,
          userId: null,
        });
    });

    it('should return the entire document with source: true', async () => {
      request.input.args.source = true;

      const response = await documentController.upsert(request);

      should(response).be.eql({
        _id: '_id',
        _version: '_version',
        _source: { ...changes, name: 'gordon' },
        created: false,
      });
    });
  });

  describe('#updateByQuery', () => {
    let esResponse;

    beforeEach(() => {
      esResponse = {
        successes: [
          { _id: 'id1', _source: { foo: 'bar', bar: 'foo' } },
          { _id: 'id2', _source: { foo: 'bar', bar: 'foo' } }
        ],
        errors: []
      };

      kuzzle.ask
        .withArgs('core:storage:public:document:updateByQuery')
        .resolves(esResponse);
    });

    it('should forward to the store module and notify the changes', async () => {
      request.input.body = {
        query: {
          match: { foo: 'bar' }
        },
        changes: {
          bar: 'foo'
        }
      };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = true;

      const response = await documentController.updateByQuery(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:updateByQuery',
        index,
        collection,
        { match: { foo: 'bar' } },
        { bar: 'foo'},
        { refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.UPDATE,
        esResponse.successes.map(doc => ({
          _id: doc._id,
          _source: doc._source,
          _updatedFields: [ 'bar' ],
        })));

      should(response).be.eql(esResponse);
    });

    it('should not include documents content in the response of updateByQuery', async () => {
      request.input.body = {
        query: {
          match: { foo: 'bar' }
        },
        changes: {
          bar: 'foo'
        }
      };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = false;

      const response = await documentController.updateByQuery(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:updateByQuery',
        index,
        collection,
        { match: { foo: 'bar' } },
        { bar: 'foo' },
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.UPDATE,
        esResponse.successes.map(doc => ({
          _id: doc._id,
          _source: { foo: 'bar', bar: 'foo' },
          _updatedFields: [ 'bar' ],
        })));

      should(response).be.eql(esResponse);
    });

    it('should reject if field "query" is missing', () => {
      request.input.body = {
        invalidField: {
          match: { foo: 'bar' }
        },
        changes: {
          bar: 'foo'
        }
      };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = false;

      return should(documentController.updateByQuery(request)).rejectedWith(
        BadRequestError,
        {
          id: 'api.assert.missing_argument',
          message: /^Missing argument "body.query"/,
        });
    });

    it('should reject if field "changes" is missing', () => {
      request.input.body = {
        query: {
          match: { foo: 'bar' }
        },
        invalidField: {
          bar: 'foo'
        }
      };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = false;

      return should(documentController.updateByQuery(request)).rejectedWith(
        BadRequestError,
        {
          id: 'api.assert.missing_argument',
          message: /^Missing argument "body.changes"/,
        });
    });

    it('should reject if the "lang" is not supported', () => {
      request.input.body = {
        query: { equals: { name: 'Melis' } },
        changes: {}
      };
      request.input.args.lang = 'turkish';

      return should(documentController.updateByQuery(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = {
        query: { equals: { name: 'Melis' } },
        changes: {}
      };
      request.input.args.lang = 'koncorde';
      documentController.translateKoncorde = sinon.stub().resolves();

      await documentController.updateByQuery(request);

      should(documentController.translateKoncorde)
        .be.calledWith({ equals: { name: 'Melis' } });
    });
  });

  describe('#replace', () => {
    let content;

    beforeEach(() => {
      content = { foo: 'bar' };

      request.input.body = content;

      kuzzle.validation.validate.resolvesArg(0);

      kuzzle.ask.withArgs('core:storage:public:document:replace').resolves({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });

      request.input.resource._id = 'foobar';
    });

    it('should forward to the store module and notify', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.replace(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:replace',
        index,
        collection,
        'foobar',
        content,
        { userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.validation.validate).be.calledWith(request, false);

      should(kuzzle.ask).calledWith(
        'core:realtime:document:notify',
        request,
        actionEnum.REPLACE,
        { _id: request.input.resource._id, _source: content });

      should(response).match({
        _id: '_id',
        _version: '_version',
        _source: '_source'
      });
    });

    it('should have default value for refresh and userId', async () => {
      await documentController.replace(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:replace',
        index,
        collection,
        'foobar',
        content,
        { userId: null, refresh: 'false' });
    });
  });

  describe('#delete', () => {
    it('should forward to the store module and notify', async () => {
      request.input.args.refresh = 'wait_for';
      kuzzle.ask.withArgs('core:storage:public:document:get').resolves({
        _id: 'foobar',
        _source: '_source'
      });
      request.input.resource._id = 'foobar';

      const response = await documentController.delete(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:delete',
        index,
        collection,
        'foobar',
        { refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:notify',
        request,
        actionEnum.DELETE,
        { _id: 'foobar', _source: '_source' });

      should(response).be.eql({ _id: 'foobar' });
    });

    it('should forward to the store module, notify and retrieve document source', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:get').resolves({
        _id: 'foobar',
        _source: '_source'
      });
      request.input.resource._id = 'foobar';
      request.input.args.source = true;

      const response = await documentController.delete(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:delete',
        index,
        collection,
        'foobar');

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:notify',
        request,
        actionEnum.DELETE,
        { _id: 'foobar', _source: '_source' });

      should(response).be.eql({ _id: 'foobar', _source: '_source'});
    });
  });

  describe('#mDelete', () => {
    let ids;
    let documents;

    beforeEach(() => {
      ids = ['id1', 'id2', 'id3'];

      request.input.body = { ids };

      documents = [
        { _id: 'id1', _source: '_source1' },
        { _id: 'id2', _source: '_source2' },
        { _id: 'id3', _source: '_source3' }
      ];

      kuzzle.ask.withArgs('core:storage:public:document:mDelete').resolves(({
        documents,
        errors: []
      }));
    });

    it('should forward to the store module and notify the changes', async () => {
      request.input.args.refresh = 'wait_for';

      const response = await documentController.mDelete(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:mDelete',
        index,
        collection,
        ids,
        { refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.DELETE,
        documents);

      should(response).match({
        successes: ['id1', 'id2', 'id3'],
        errors: []
      });
    });

    it('should handle errors if some actions failed', async () => {
      kuzzle.ask.withArgs('core:storage:public:document:mDelete').resolves(({
        documents,
        errors: [
          { id: 'id1', reason: 'reason' }
        ]
      }));

      const response = await documentController.mDelete(request);

      should(response).match({
        successes: ['id1', 'id2', 'id3'],
        errors: [
          { id: 'id1', reason: 'reason' }
        ]
      });
    });
  });

  describe('#deleteByQuery', () => {
    beforeEach(() => {
      kuzzle.ask.withArgs('core:storage:public:document:deleteByQuery').resolves({
        documents: [
          { _id: 'id1', _source: '_source1' },
          { _id: 'id2', _source: '_source2' }
        ],
        total: 2,
        deleted: 2,
        failures: [],
      });
    });

    it('should forward to the store module and notify the changes', async () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.refresh = 'wait_for';

      const response = await documentController.deleteByQuery(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:deleteByQuery',
        index,
        collection,
        { foo: 'bar' },
        { refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.DELETE,
        [
          { _id: 'id1', _source: undefined },
          { _id: 'id2', _source: undefined }
        ]);

      should(response).match({
        documents: [
          { _id: 'id1', _source: undefined },
          { _id: 'id2', _source: undefined }
        ]});
    });

    it('should forward to the store module, notify the changes and retrieve all sources', async () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = true;

      const response = await documentController.deleteByQuery(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:deleteByQuery',
        index,
        collection,
        { foo: 'bar' },
        { refresh: 'wait_for' });

      should(kuzzle.ask).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.DELETE,
        [
          { _id: 'id1', _source: '_source1' },
          { _id: 'id2', _source: '_source2' }
        ]);

      should(response).match({
        documents: [
          { _id: 'id1', _source: '_source1' },
          { _id: 'id2', _source: '_source2' }
        ]});
    });

    it('should reject if the "lang" is not supported', () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.lang = 'turkish';

      return should(documentController.deleteByQuery(request)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_argument' });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: 'Melis' } } };
      request.input.args.lang = 'koncorde';
      documentController.translateKoncorde = sinon.stub().resolves();

      await documentController.deleteByQuery(request);

      should(documentController.translateKoncorde)
        .be.calledWith({ equals: { name: 'Melis' } });
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
