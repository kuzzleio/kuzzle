'use strict';

const should = require('should');
const {
  Request,
  BadRequestError,
  SizeLimitError
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const DocumentController = require('../../../lib/api/controller/document');
const { NativeController } = require('../../../lib/api/controller/base');
const actionEnum = require('../../../lib/core/realtime/actionEnum');

describe('DocumentController', () => {
  const index = 'festivals';
  const collection = 'huma';
  let documentController;
  let kuzzle;
  let request;

  beforeEach(() => {
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
      should(documentController).instanceOf(NativeController);
    });
  });

  describe('#search', () => {
    it('should call publicStorage search method', async () => {
      documentController.publicStorage.search.resolves({
        aggregations: 'aggregations',
        hits: 'hits',
        other: 'other',
        remaining: 'remaining',
        scrollId: 'scrollId',
        total: 'total',
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
      kuzzle.storageEngine.public.search.rejects(new Error('foobar'));

      return should(documentController.search(request)).be.rejectedWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should call publicStorage scroll method', async () => {
      documentController.publicStorage.scroll.resolves({
        hits: 'hits',
        other: 'other',
        remaining: 'remaining',
        scrollId: 'scrollId',
        total: 'total',
      });

      request.input.args.scroll = '1m';
      request.input.args.scrollId = 'SomeScrollIdentifier';

      const response = await documentController.scroll(request);

      should(documentController.publicStorage.scroll).be.calledWith(
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
        items: [
          { _id: 'id', _source: 'source', _version: 1, some: 'some' },
          { _id: 'id2', _source: 'source', _version: 1, some: 'some' }
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
      documentController.publicStorage.mGet.resolves(({
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
    it('should call publicStorage count method', async () => {
      documentController.publicStorage.count.resolves(42);
      request.input.body = { query: {} };

      const response = await documentController.count(request);

      should(documentController.publicStorage.count).be.calledWith(
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
      items;

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

      documentController.publicStorage.mCreate.resolves(({
        items,
        errors: []
      }));
    });

    it('should call the right publicStorage method and notify the changes', async () => {
      request.context.user = { _id: 'aschen' };
      request.input.args.refresh = 'wait_for';

      const response = await documentController._mChanges(request, 'mCreate', actionEnum.CREATE);

      should(documentController.publicStorage.mCreate).be.calledWith(
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
        successes: items,
        errors: []
      });
    });

    it('should have default values for userId and refresh params', async () => {
      await documentController._mChanges(request, 'mCreate', actionEnum.CREATE);

      should(documentController.publicStorage.mCreate).be.calledWith(
        index,
        collection,
        documents,
        { userId: null, refresh: 'false' });
    });

    it('should handle errors if some actions failed', async () => {
      documentController.publicStorage.mCreate.resolves(({
        items,
        errors: [
          {
            document: { _id: '_id42', _source: '_source' },
            status: 206,
            reason: 'reason'
          }
        ]
      }));

      const response = await documentController._mChanges(request, 'mCreate', actionEnum.CREATE);

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
        _version: '_version',
        _source: { ...content, name: 'gordon' }
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

      should(documentController.publicStorage.update).be.calledWith(
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

      documentController.publicStorage.updateByQuery.resolves(esResponse);
    });

    it('should call publicStorage updateByQuery method and notify the changes', async () => {
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

      should(documentController.publicStorage.updateByQuery).be.calledWith(
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

      should(documentController.publicStorage.updateByQuery).be.calledWith(
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
      request.input.args.refresh = 'wait_for';
      documentController.publicStorage.get.resolves({
        _id: 'foobar',
        _source: '_source'
      });
      request.input.resource._id = 'foobar';

      const response = await documentController.delete(request);

      should(documentController.publicStorage.delete).be.calledWith(
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

    it('should call publicStorage delete method, notify and retrieve document source', async () => {
      documentController.publicStorage.get.resolves({
        _id: 'foobar',
        _source: '_source'
      });
      request.input.resource._id = 'foobar';
      request.input.args.source = true;

      const response = await documentController.delete(request);

      should(documentController.publicStorage.delete).be.calledWith(
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

      documentController.publicStorage.mDelete.resolves(({
        documents,
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
      documentController.publicStorage.mDelete.resolves(({
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
      documentController.publicStorage.deleteByQuery.resolves(({
        documents: [
          { _id: 'id1', _source: '_source1' },
          { _id: 'id2', _source: '_source2' }
        ],
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

    it('should call publicStorage deleteByQuery method, notify the changes and retrieve all sources', async () => {
      request.input.body = { query: { foo: 'bar' } };
      request.input.args.refresh = 'wait_for';
      request.input.args.source = true;

      const response = await documentController.deleteByQuery(request);

      should(documentController.publicStorage.deleteByQuery).be.calledWith(
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
