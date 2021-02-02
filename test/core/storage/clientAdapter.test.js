'use strict';

const should = require('should');
const sinon = require('sinon');
const mockRequire = require('mock-require');

const {
  BadRequestError,
  PartialError,
  PreconditionError,
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const ElasticsearchMock = require('../../mocks/elasticsearch.mock');
const MutexMock = require('../../mocks/mutex.mock');

const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');

describe('#core/storage/ClientAdapter', () => {
  let ClientAdapter;
  let publicAdapter;
  let privateAdapter;
  let kuzzle;

  before(() => {
    mockRequire('../../../lib/util/mutex', { Mutex: MutexMock });
    mockRequire('../../../lib/service/storage/elasticsearch', ElasticsearchMock);
    ClientAdapter = mockRequire.reRequire('../../../lib/core/storage/clientAdapter');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    kuzzle.ask.restore();

    publicAdapter = new ClientAdapter(scopeEnum.PUBLIC);
    privateAdapter = new ClientAdapter(scopeEnum.PRIVATE);

    return Promise.all([publicAdapter, privateAdapter].map(adapter => {
      sinon.stub(adapter.cache);
      return adapter.init();
    }));
  });

  describe('#constructor', () => {
    it('should instantiate an ES client with the right scope', () => {
      should(publicAdapter.scope).eql(scopeEnum.PUBLIC);
      should(privateAdapter.scope).eql(scopeEnum.PRIVATE);

      should(publicAdapter.client).not.eql(privateAdapter.client);

      should(publicAdapter.client._scope).eql(scopeEnum.PUBLIC);
      should(privateAdapter.client._scope).eql(scopeEnum.PRIVATE);
    });
  });

  describe('#init', () => {
    let uninitializedAdapter;

    beforeEach(() => {
      uninitializedAdapter = new ClientAdapter(scopeEnum.PUBLIC);

      // prevents event conflicts with the already initialized adapters above
      kuzzle.onAsk.restore();
      sinon.stub(kuzzle, 'onAsk');
    });

    it('should initialize a new ES client', async () => {
      should(uninitializedAdapter.client.init).not.called();

      await uninitializedAdapter.init();
      should(uninitializedAdapter.client.init).calledOnce();
    });

    it('should initialize its index/collection cache', async () => {
      uninitializedAdapter.client.listIndexes.resolves(['foo', 'bar']);
      uninitializedAdapter.client.listCollections.withArgs('foo').resolves([
        'foo1',
        'foo2',
      ]);
      uninitializedAdapter.client.listCollections.withArgs('bar').resolves([
        'bar1',
        'bar2',
      ]);
      uninitializedAdapter.client.listAliases.resolves([
        { index: 'alias1', collection: 'qux' },
        { index: 'alias2', collection: 'qux' },
      ]);

      sinon.stub(uninitializedAdapter.cache, 'addCollection');

      await uninitializedAdapter.init();

      const opts = { notify: false };

      should(uninitializedAdapter.cache.addCollection).calledWith('foo', 'foo1', opts);
      should(uninitializedAdapter.cache.addCollection).calledWith('foo', 'foo2', opts);
      should(uninitializedAdapter.cache.addCollection).calledWith('bar', 'bar1', opts);
      should(uninitializedAdapter.cache.addCollection).calledWith('bar', 'bar2', opts);
      should(uninitializedAdapter.cache.addCollection).calledWith('alias1', 'qux', opts);
      should(uninitializedAdapter.cache.addCollection).calledWith('alias2', 'qux', opts);
    });
  });

  describe('#global events', () => {
    it('should register a global "info" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        await kuzzle.ask(`core:storage:${adapter.scope}:info:get`);
        should(adapter.client.info).calledOnce();
      }
    });
  });

  describe('#index handling events', () => {
    describe('#index:create', async () => {
      it('should register an "index:create" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(`core:storage:${adapter.scope}:index:create`, 'foo');

          should(adapter.client.createIndex).calledWith('foo');
          should(adapter.cache.addIndex).calledWith('foo');
        }
      });

      it('should reject if the index already exists', async () => {
        publicAdapter.cache.hasIndex.withArgs('foo').returns(true);

        return should(publicAdapter.createIndex('foo'))
          .rejectedWith(PreconditionError, {
            id: 'services.storage.index_already_exists',
          });
      });
    });

    describe('#index:delete', () => {
      it('should register an "index:delete" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(`core:storage:${adapter.scope}:index:delete`, 'foo');

          should(publicAdapter.cache.assertIndexExists).calledWith('foo');
          should(publicAdapter.client.deleteIndex).calledWith('foo');
          should(publicAdapter.cache.removeIndex).calledWith('foo');
        }
      });

      it('should reject if the index to delete does not exist', async () => {
        const err = new Error('foo');
        publicAdapter.cache.assertIndexExists.throws(err);

        await should(publicAdapter.deleteIndex('foo')).rejectedWith(err);
        should(publicAdapter.client.deleteIndex).not.called();
        should(publicAdapter.cache.removeIndex).not.called();
      });
    });

    it('should register an "index:exist" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        adapter.cache.hasIndex.returns('bar');

        const res = await kuzzle.ask(
          `core:storage:${adapter.scope}:index:exist`,
          'foo');

        should(res).eql('bar');
        should(adapter.cache.hasIndex).calledOnce().calledWith('foo');
      }
    });

    it('should register an "index:list" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        adapter.cache.listIndexes.resolves('bar');

        const res = await kuzzle.ask(`core:storage:${adapter.scope}:index:list`);

        should(res).eql('bar');
        should(adapter.cache.listIndexes).calledOnce();
      }
    });

    it('should register an "index:stats" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        adapter.client.stats.resolves('bar');

        const res = await kuzzle.ask(`core:storage:${adapter.scope}:index:stats`);

        should(res).eql('bar');
        should(adapter.client.stats).calledOnce();
      }
    });

    describe('#index:mDelete', () => {
      it('should register an "index:mDelete" event', async () => {
        const indexes = ['foo', 'bar', 'baz'];

        for (const adapter of [publicAdapter, privateAdapter]) {
          adapter.client.deleteIndexes.resolves(indexes);

          const deleted = await kuzzle.ask(
            `core:storage:${adapter.scope}:index:mDelete`,
            indexes);

          should(publicAdapter.client.deleteIndexes).calledWith(indexes);
          should(publicAdapter.cache.removeIndex).calledWith('foo');
          should(publicAdapter.cache.removeIndex).calledWith('bar');
          should(publicAdapter.cache.removeIndex).calledWith('baz');
          should(deleted).eql(indexes);
        }
      });

      it('should do nothing if at least 1 index does not exist', async () => {
        const err = new Error('foo');
        publicAdapter.cache.assertIndexExists.withArgs('bar').throws(err);

        await should(publicAdapter.deleteIndexes(['foo', 'bar', 'baz']))
          .rejectedWith(err);

        should(publicAdapter.client.deleteIndexes).not.called();
        should(publicAdapter.cache.removeIndex).not.called();
      });
    });
  });

  describe('#collection handling events', () => {
    it('#collection:create', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        await kuzzle.ask(
          `core:storage:${adapter.scope}:collection:create`,
          'foo',
          'bar',
          'opts');

        should(publicAdapter.client.createCollection)
          .calledOnce()
          .calledWith('foo', 'bar', 'opts');

        should(publicAdapter.cache.addCollection).calledWith('foo', 'bar');
      }
    });

    describe('#collection:delete', () => {
      it('should register a "collection:delete" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:collection:delete`,
            'foo',
            'bar');

          should(publicAdapter.client.deleteCollection).calledWith('foo', 'bar');
          should(publicAdapter.cache.removeCollection).calledWith('foo', 'bar');
        }
      });

      it('should reject if the collection does not exist in the cache', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        await should(publicAdapter.deleteCollection('foo', 'bar'))
          .rejectedWith(err);

        should(publicAdapter.client.deleteCollection).not.called();
        should(publicAdapter.cache.removeCollection).not.called();
      });
    });

    it('should register a "collection:exist" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        await kuzzle.ask(
          `core:storage:${adapter.scope}:collection:exist`,
          'foo',
          'bar');

        should(adapter.cache.hasCollection)
          .calledOnce()
          .calledWith('foo', 'bar');
      }
    });

    it('should register a "collection:list" event', async () => {
      for (const adapter of [publicAdapter, privateAdapter]) {
        await kuzzle.ask(`core:storage:${adapter.scope}:collection:list`, 'foo');

        should(adapter.cache.listCollections).calledOnce().calledWith('foo');
      }
    });

    describe('#collection:refresh', async () => {
      it('should register a "collection:refresh" event', async () => {

        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:collection:refresh`,
            'foo',
            'bar');

          should(adapter.client.refreshCollection)
            .calledOnce()
            .calledWith('foo', 'bar');
          should(adapter.cache.assertCollectionExists).calledWith('foo', 'bar');
        }
      });

      it('should reject if the collection does not exist in the cache', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        await should(kuzzle.ask('core:storage:public:collection:refresh', 'foo', 'bar'))
          .rejectedWith(err);

        should(publicAdapter.client.refreshCollection).not.called();
      });
    });

    describe('#collection:truncate', () => {
      it('should register a "collection:truncate" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:collection:truncate`,
            'foo',
            'bar');

          should(adapter.cache.assertCollectionExists).calledWith('foo', 'bar');

          should(adapter.client.truncateCollection)
            .calledOnce()
            .calledWith('foo', 'bar');
        }
      });

      it('should reject if the collection does not exist in the cache', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        await should(kuzzle.ask('core:storage:public:collection:truncate', 'foo', 'bar'))
          .rejectedWith(err);

        should(publicAdapter.client.truncateCollection).not.called();
      });
    });

    describe('#collection:update', () => {
      it('should register a "collection:update" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:collection:update`,
            'foo',
            'bar',
            'changes');

          should(adapter.cache.assertCollectionExists).calledWith('foo', 'bar');

          should(adapter.client.updateCollection)
            .calledOnce()
            .calledWith('foo', 'bar', 'changes');
        }
      });

      it('should reject if the collection does not exist in the cache', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const promise = kuzzle.ask(
          'core:storage:public:collection:update',
          'foo',
          'bar',
          'changes');

        await should(promise).rejectedWith(err);

        should(publicAdapter.client.updateCollection).not.called();
      });
    });
  });

  describe('#mappings related events', () => {
    describe('#mappings:get', () => {
      it('should register a "mappings:get" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:mappings:get`,
            'foo',
            'bar',
            'opts');

          should(adapter.cache.assertCollectionExists).calledWith('foo', 'bar');

          should(adapter.client.getMapping)
            .calledOnce()
            .calledWith('foo', 'bar', 'opts');
        }
      });

      it('should reject if the collection does not exist in the cache', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const promise = kuzzle.ask(
          'core:storage:public:mappings:get',
          'foo',
          'bar',
          'opts');

        await should(promise).rejectedWith(err);

        should(publicAdapter.client.getMapping).not.called();
      });
    });

    describe('#mappings:import', () => {
      let mappings;

      beforeEach(() => {
        mappings = {
          index: {
            collection: {
              properties: {
                foo: 'bar',
                baz: 'qux',
              },
            },
          },
        };
      });

      it('should register a "mappings:import" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:mappings:import`,
            mappings);

          should(adapter.client.createIndex).calledWith('index');
          should(adapter.client.createCollection)
            .calledWith('index', 'collection', {
              mappings: mappings.index.collection,
            });

          should(adapter.cache.addIndex).calledWith('index');
          should(adapter.cache.addCollection).calledWith('index', 'collection');

          const mutex = MutexMock.__getLastMutex();
          should(mutex.resource).eql('loadMappings');
          should(mutex.lock).calledOnce();
          should(mutex.unlock).calledOnce();
        }
      });

      it('should reject if the provided argument is not a valid object', async () => {
        for (const arg of [null, [], 'foo', 123, true]) {
          const result = kuzzle.ask('core:storage:public:mappings:import', arg);

          await should(result).rejectedWith(BadRequestError, {
            id: 'api.assert.invalid_argument',
          });
        }
      });

      it('should reject if the provided mappings are malformed', async () => {
        for (const arg of [null, [], 'foo', 123, true]) {
          mappings.index = arg;

          const result = kuzzle.ask(
            'core:storage:public:mappings:import',
            mappings);

          await should(result).rejectedWith(BadRequestError, {
            id: 'api.assert.invalid_argument',
          });
        }
      });

      it('should reject if creating a new index fails', () => {
        const err = new Error();

        publicAdapter.client.createIndex.rejects(err);

        return should(kuzzle.ask('core:storage:public:mappings:import', mappings))
          .rejectedWith(err);
      });

      it('should ignore rejections due to an already existing index', async () => {
        mappings.index2 = mappings.index;

        const err = new Error();
        err.id = 'services.storage.index_already_exists';

        publicAdapter.client.createIndex.onFirstCall().rejects(err);

        await should(kuzzle.ask('core:storage:public:mappings:import', mappings))
          .fulfilled();

        should(publicAdapter.client.createIndex).calledWith('index');
        should(publicAdapter.client.createIndex).calledWith('index2');
      });
    });

    describe('#mappings:update', () => {
      it('should register a "mappings:update" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:mappings:update`,
            'index',
            'collection',
            'mappings');

          should(adapter.cache.assertCollectionExists).calledWith('index', 'collection');

          should(adapter.client.updateMapping)
            .calledWith('index', 'collection', 'mappings');
        }
      });

      it('should reject if the index/collection pair does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:mappings:update',
          'index',
          'collection',
          'mappings');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.updateMapping).not.called();
      });
    });
  });

  describe('#document handling events', () => {
    describe('#document:bulk', () => {
      it('should register a "document:bulk" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:bulk`,
            'index',
            'collection',
            'documents',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.import)
            .calledWith('index', 'collection', 'documents', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:bulk',
          'index',
          'collection',
          'documents',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.import).not.called();
      });
    });

    describe('#document:count', () => {
      it('should register a "document:count" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:count`,
            'index',
            'collection',
            'filters');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.count)
            .calledWith('index', 'collection', 'filters');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:count',
          'index',
          'collection',
          'filters');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.count).not.called();
      });
    });

    describe('#document:create', () => {
      it('should register a "document:create" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:create`,
            'index',
            'collection',
            'content',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.create)
            .calledWith('index', 'collection', 'content', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:create',
          'index',
          'collection',
          'content',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.create).not.called();
      });
    });

    describe('#document:createOrReplace', () => {
      it('should register a "document:createOrReplace" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:createOrReplace`,
            'index',
            'collection',
            'id',
            'content',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.createOrReplace)
            .calledWith('index', 'collection', 'id', 'content', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:createOrReplace',
          'index',
          'collection',
          'id',
          'content',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.createOrReplace).not.called();
      });
    });

    describe('#document:delete', () => {
      it('should register a "document:delete" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:delete`,
            'index',
            'collection',
            'id',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.delete)
            .calledWith('index', 'collection', 'id', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:delete',
          'index',
          'collection',
          'id',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.delete).not.called();
      });
    });

    describe('#document:deleteByQuery', () => {
      it('should register a "document:deleteByQuery" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:deleteByQuery`,
            'index',
            'collection',
            'query',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.deleteByQuery)
            .calledWith('index', 'collection', 'query', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:deleteByQuery',
          'index',
          'collection',
          'query',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.deleteByQuery).not.called();
      });
    });

    describe('#document:deleteFields', () => {
      it('should register a "document:deleteFields" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:deleteFields`,
            'index',
            'collection',
            ['query'],
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.deleteFields)
            .calledWith('index', 'collection', ['query'], 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:deleteFields',
          'index',
          'collection',
          'query',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.deleteFields).not.called();
      });
    });

    describe('#document:exist', () => {
      it('should register a "document:exist" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:exist`,
            'index',
            'collection',
            'id');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.exists)
            .calledWith('index', 'collection', 'id');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:exist',
          'index',
          'collection',
          'id');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.exists).not.called();
      });
    });

    describe('#document:get', () => {
      it('should register a "document:get" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:get`,
            'index',
            'collection',
            'id');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.get)
            .calledWith('index', 'collection', 'id');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:get',
          'index',
          'collection',
          'id');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.get).not.called();
      });
    });

    describe('#document:import', () => {
      let fixtures;

      beforeEach(() => {
        fixtures = {
          index: {
            collection: [
              { foo: 'bar' },
              { baz: 'qux' },
            ],
          },
        };
      });

      it('should register a "document:import" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          adapter.client.import.resolves({ errors: [] });

          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:import`,
            fixtures);

          should(adapter.client.import)
            .calledWith('index', 'collection', fixtures.index.collection);
        }
      });

      it('should reject if the provided argument is not a valid object', async () => {
        for (const arg of [null, [], 'foo', 123, true]) {
          const result = kuzzle.ask('core:storage:public:document:import', arg);

          await should(result).rejectedWith(BadRequestError, {
            id: 'api.assert.invalid_argument',
          });
        }
      });

      it('should reject if the provided fixtures are malformed', async () => {
        for (const arg of [null, [], 'foo', 123, true]) {
          fixtures.index = arg;

          const result = kuzzle.ask(
            'core:storage:public:document:import',
            fixtures);

          await should(result).rejectedWith(BadRequestError, {
            id: 'api.assert.invalid_argument',
          });
        }
      });

      it('should wrap import errors', async () => {
        publicAdapter.client.import.resolves({ errors: [ 'oh', 'noes' ] });

        await should(kuzzle.ask('core:storage:public:document:import', fixtures))
          .rejectedWith(PartialError, { id: 'services.storage.import_failed' });
      });
    });

    describe('#document:mCreate', () => {
      it('should register a "document:mCreate" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mCreate`,
            'index',
            'collection',
            'documents',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mCreate)
            .calledWith('index', 'collection', 'documents', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mCreate',
          'index',
          'collection',
          'documents',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mCreate).not.called();
      });
    });

    describe('#document:mCreateOrReplace', () => {
      it('should register a "document:mCreateOrReplace" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mCreateOrReplace`,
            'index',
            'collection',
            'documents',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mCreateOrReplace)
            .calledWith('index', 'collection', 'documents', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mCreateOrReplace',
          'index',
          'collection',
          'documents',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mCreateOrReplace).not.called();
      });
    });

    describe('#document:mDelete', () => {
      it('should register a "document:mDelete" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mDelete`,
            'index',
            'collection',
            'ids',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mDelete)
            .calledWith('index', 'collection', 'ids', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mDelete',
          'index',
          'collection',
          'ids',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mDelete).not.called();
      });
    });

    describe('#document:mReplace', () => {
      it('should register a "document:mReplace" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mReplace`,
            'index',
            'collection',
            'documents',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mReplace)
            .calledWith('index', 'collection', 'documents', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mReplace',
          'index',
          'collection',
          'documents',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mReplace).not.called();
      });
    });

    describe('#document:mUpdate', () => {
      it('should register a "document:mUpdate" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mUpdate`,
            'index',
            'collection',
            'documents',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mUpdate)
            .calledWith('index', 'collection', 'documents', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mUpdate',
          'index',
          'collection',
          'documents',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mUpdate).not.called();
      });
    });

    describe('#document:mExecute', () => {
      it('should register a "document:mExecute" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mExecute`,
            'index',
            'collection',
            'query',
            'callback',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mExecute)
            .calledWith('index', 'collection', 'query', 'callback', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mExecute',
          'index',
          'collection',
          'query',
          'callback',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mExecute).not.called();
      });
    });

    describe('#document:mGet', () => {
      it('should register a "document:mGet" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:mGet`,
            'index',
            'collection',
            'ids');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.mGet).calledWith('index', 'collection', 'ids');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:mGet',
          'index',
          'collection',
          'ids',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.mGet).not.called();
      });
    });

    describe('#document:replace', () => {
      it('should register a "document:replace" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:replace`,
            'index',
            'collection',
            'id',
            'content',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.replace)
            .calledWith('index', 'collection', 'id', 'content', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:replace',
          'index',
          'collection',
          'id',
          'content',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.replace).not.called();
      });
    });

    describe('#document:scroll', () => {
      it('should register a "document:scroll" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:scroll`,
            'id',
            'options');

          should(adapter.client.scroll).calledWith('id', 'options');
        }
      });
    });

    describe('#document:search', () => {
      it('should register a "document:search" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:search`,
            'index',
            'collection',
            'query',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.search)
            .calledWith('index', 'collection', 'query', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:search',
          'index',
          'collection',
          'query',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.search).not.called();
      });
    });

    describe('#document:update', () => {
      it('should register a "document:update" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:update`,
            'index',
            'collection',
            'id',
            'content',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.update)
            .calledWith('index', 'collection', 'id', 'content', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:update',
          'index',
          'collection',
          'id',
          'content',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.update).not.called();
      });
    });

    describe('#document:updateByQuery', () => {
      it('should register a "document:updateByQuery" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:updateByQuery`,
            'index',
            'collection',
            'query',
            'changes',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.updateByQuery)
            .calledWith('index', 'collection', 'query', 'changes', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:updateByQuery',
          'index',
          'collection',
          'query',
          'changes',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.updateByQuery).not.called();
      });
    });

    describe('#document:upsert', () => {
      it('should register a "document:upsert" event', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:document:upsert`,
            'index',
            'collection',
            'id',
            'changes',
            'options');

          should(adapter.cache.assertCollectionExists)
            .calledWith('index', 'collection');

          should(adapter.client.upsert)
            .calledWith('index', 'collection', 'id', 'changes', 'options');
        }
      });

      it('should reject if the collection does not exist', async () => {
        const err = new Error();

        publicAdapter.cache.assertCollectionExists.throws(err);

        const result = kuzzle.ask(
          'core:storage:public:document:upsert',
          'index',
          'collection',
          'id',
          'changes',
          'options');

        await should(result).rejectedWith(err);

        should(publicAdapter.client.update).not.called();
      });
    });

  });

  describe('#cache handling events', () => {
    describe('#cache:add', () => {
      it('should handle adding a single index', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(`core:storage:${adapter.scope}:cache:add`, 'index');

          should(adapter.cache.addIndex).calledWith('index', { notify: false });
          should(adapter.cache.addCollection).not.called();
        }
      });

      it('should handle adding an index/collection pair', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:cache:add`,
            'index',
            'collection');

          should(adapter.cache.addIndex).not.called();
          should(adapter.cache.addCollection).calledWith('index', 'collection', {
            notify: false,
          });
        }
      });
    });

    describe('#cache:remove', () => {
      it('should handle removing a single index', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(`core:storage:${adapter.scope}:cache:remove`, 'index');

          should(adapter.cache.removeIndex).calledWith('index', {
            notify: false,
          });
          should(adapter.cache.removeCollection).not.called();
        }
      });

      it('should handle removing an index/collection pair', async () => {
        for (const adapter of [publicAdapter, privateAdapter]) {
          await kuzzle.ask(
            `core:storage:${adapter.scope}:cache:remove`,
            'index',
            'collection');

          should(adapter.cache.removeIndex).not.called();
          should(adapter.cache.removeCollection).calledWith('index', 'collection', {
            notify: false,
          });
        }
      });
    });
  });
});
