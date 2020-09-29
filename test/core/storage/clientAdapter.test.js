'use strict';

const should = require('should');
const sinon = require('sinon');
const mockRequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const ElasticsearchMock = require('../../mocks/elasticsearch.mock');

const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');

describe.only('#core/storage/ClientAdapter', () => {
  let ClientAdapter;
  let clientAdapter;
  let kuzzle;

  before(() => {
    mockRequire('../../../lib/service/storage/elasticsearch', ElasticsearchMock);
    ClientAdapter = mockRequire.reRequire('../../../lib/core/storage/clientAdapter');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    clientAdapter = new ClientAdapter(kuzzle, scopeEnum.PUBLIC);
  });

  describe('#constructor', () => {
    it('should instantiate an ES client with the right scope', () => {
      should(clientAdapter.client._scope).eql(scopeEnum.PUBLIC);

      const privateAdapter = new ClientAdapter(kuzzle, scopeEnum.PRIVATE);
      should(privateAdapter.client._scope).eql(scopeEnum.PRIVATE);
    });
  });

  describe('#init', () => {
    it('should initialize the ES client', async () => {
      should(clientAdapter.client.init).not.called();

      await clientAdapter.init();

      should(clientAdapter.client.init).calledOnce();
    });

    it('should initialize its index/collection cache', async () => {
      clientAdapter.client.listIndexes.resolves(['foo', 'bar']);
      clientAdapter.client.listCollections.withArgs('foo').resolves([
        'foo1',
        'foo2',
      ]);
      clientAdapter.client.listCollections.withArgs('bar').resolves([
        'bar1',
        'bar2',
      ]);
      clientAdapter.client.listAliases.resolves([
        { index: 'alias1', collection: 'qux' },
        { index: 'alias2', collection: 'qux' },
      ]);

      sinon.stub(clientAdapter.cache, 'addCollection');

      await clientAdapter.init();

      const opts = { notify: false };

      should(clientAdapter.cache.addCollection).calledWith('foo', 'foo1', opts);
      should(clientAdapter.cache.addCollection).calledWith('foo', 'foo2', opts);
      should(clientAdapter.cache.addCollection).calledWith('bar', 'bar1', opts);
      should(clientAdapter.cache.addCollection).calledWith('bar', 'bar2', opts);
      should(clientAdapter.cache.addCollection).calledWith('alias1', 'qux', opts);
      should(clientAdapter.cache.addCollection).calledWith('alias2', 'qux', opts);
    });
  });

  describe('#global events', () => {
    it('should register a global "info" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);

        await adapter.init();
        await kuzzle.ask(`core:store:${scope}:info:get`);
        should(adapter.client.info).calledOnce();
      }
    });
  });

  describe('#index:create', () => {
    it('should register an "index:create" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);
        sinon.stub(adapter, 'createIndex');

        await adapter.init();
        await kuzzle.ask(`core:store:${scope}:index:create`, 'foo');
        should(adapter.createIndex).calledOnce().calledWith('foo');
      }
    });

    it('should handle index creation', async () => {
      sinon.stub(clientAdapter.cache, 'addIndex');

      await clientAdapter.createIndex('foo');

      should(clientAdapter.client.createIndex).calledWith('foo');
      should(clientAdapter.cache.addIndex).calledWith('foo');
    });
  });

  describe('#index:delete', () => {
    beforeEach(() => {
      sinon.stub(clientAdapter.cache, 'assertIndexExists');
      sinon.stub(clientAdapter.cache, 'removeIndex');
    });

    it('should register an "index:delete" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);
        sinon.stub(adapter, 'deleteIndex');

        await adapter.init();
        await kuzzle.ask(`core:store:${scope}:index:delete`, 'foo');
        should(adapter.deleteIndex).calledOnce().calledWith('foo');
      }
    });

    it('should clean up the cache when removing the index', async () => {
      await clientAdapter.deleteIndex('foo');

      should(clientAdapter.client.deleteIndex).calledWith('foo');
      should(clientAdapter.cache.removeIndex).calledWith('foo');
    });

    it('should reject if the index to delete does not exist', async () => {
      const err = new Error('foo');
      clientAdapter.cache.assertIndexExists.throws(err);

      await should(clientAdapter.deleteIndex('foo')).rejectedWith(err);
      should(clientAdapter.client.deleteIndex).not.called();
      should(clientAdapter.cache.removeIndex).not.called();
    });
  });

  describe('#index:exist', () => {
    it('should register an "index:exist" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);
        sinon.stub(adapter.cache, 'hasIndex').resolves('bar');

        await adapter.init();
        const res = await kuzzle.ask(`core:store:${scope}:index:exist`, 'foo');

        should(res).eql('bar');
        should(adapter.cache.hasIndex).calledOnce().calledWith('foo');
      }
    });
  });

  describe('#index:list', () => {
    it('should register an "index:list" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);
        sinon.stub(adapter.cache, 'listIndexes').resolves('bar');

        await adapter.init();
        const res = await kuzzle.ask(`core:store:${scope}:index:list`);

        should(res).eql('bar');
        should(adapter.cache.listIndexes).calledOnce();
      }
    });
  });

  describe('#index:mDelete', () => {
    beforeEach(() => {
      sinon.stub(clientAdapter.cache, 'assertIndexExists');
      sinon.stub(clientAdapter.cache, 'removeIndex');
    });

    it('should register an "index:mDelete" event', async () => {
      kuzzle.ask.restore();

      for (const scope of Object.values(scopeEnum)) {
        const adapter = new ClientAdapter(kuzzle, scope);
        sinon.stub(adapter, 'deleteIndexes');

        await adapter.init();
        await kuzzle.ask(`core:store:${scope}:index:mDelete`, 'foo');
        should(adapter.deleteIndexes).calledOnce().calledWith('foo');
      }
    });

    it('should handle multi-indexes deletion', async () => {
      const indexes = ['foo', 'bar', 'baz'];
      await clientAdapter.deleteIndexes(indexes);

      should(clientAdapter.client.deleteIndexes).calledWith(indexes);
      should(clientAdapter.cache.removeIndex).calledWith('foo');
      should(clientAdapter.cache.removeIndex).calledWith('bar');
      should(clientAdapter.cache.removeIndex).calledWith('baz');
    });

    it('should do nothing if at least 1 index does not exist', async () => {
      const err = new Error('foo');
      clientAdapter.cache.assertIndexExists.withArgs('bar').throws(err);

      await should(clientAdapter.deleteIndexes(['foo', 'bar', 'baz']))
        .rejectedWith(err);

      should(clientAdapter.client.deleteIndexes).not.called();
      should(clientAdapter.cache.removeIndex).not.called();
    });
  });
});
