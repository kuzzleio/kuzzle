'use strict';

const should = require('should');

const { PreconditionError } = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const IndexCache = require('../../../lib/core/storage/indexCache');
const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');

describe('#core/storage/indexCache', () => {
  let kuzzle;
  let indexCache;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    indexCache = new IndexCache(scopeEnum.PUBLIC);
  });

  describe('#addIndex', () => {
    it('should be able to add a new index to the cache', () => {
      should(indexCache.hasIndex('foo')).be.false();

      should(indexCache.addIndex('foo')).be.true();

      should(indexCache.hasIndex('foo')).be.true();

      should(kuzzle.emit).calledWith('core:storage:cache:add:after', {
        index: 'foo',
        scope: scopeEnum.PUBLIC,
      });
    });

    it('should do nothing if adding an already cached index', () => {
      should(indexCache.addIndex('foo')).be.true();

      kuzzle.emit.resetHistory();

      should(indexCache.addIndex('foo')).be.false();

      should(kuzzle.emit).not.calledWith('core:storage:cache:add:after');
    });

    it('should skip notification event when asked', () => {
      should(indexCache.addIndex('foo', { notify: false })).be.true();

      should(kuzzle.emit).not.calledWith('core:storage:cache:add:after');
    });
  });

  describe('#addCollection', () => {
    it('should be able to add a new collection on an existing index', () => {
      indexCache.addIndex('foo');

      should(indexCache.hasCollection('foo', 'bar')).be.false();

      indexCache.addCollection('foo', 'bar');

      should(indexCache.hasCollection('foo', 'bar')).be.true();

      should(kuzzle.emit).calledWith('core:storage:cache:add:after', {
        collection: 'bar',
        index: 'foo',
        scope: scopeEnum.PUBLIC,
      });
    });

    it('should be able to add a new index/collection pair', () => {
      should(indexCache.hasIndex('foo')).be.false();

      indexCache.addCollection('foo', 'bar');

      should(indexCache.hasIndex('foo')).be.true();
      should(indexCache.hasCollection('foo', 'bar')).be.true();
      should(kuzzle.emit).calledWith('core:storage:cache:add:after', {
        collection: 'bar',
        index: 'foo',
        scope: scopeEnum.PUBLIC,
      });
    });

    it('should do nothing if the collection is already cached', () => {
      indexCache.addCollection('foo', 'bar');
      kuzzle.emit.resetHistory();

      indexCache.addCollection('foo', 'bar');
      should(kuzzle.emit).not.calledWith('core:storage:cache:add:after');
    });

    it('should not send notification if asked to', () => {
      indexCache.addCollection('foo', 'bar', { notify: false });

      should(indexCache.hasIndex('foo')).be.true();
      should(indexCache.hasCollection('foo', 'bar')).be.true();
      should(kuzzle.emit).not.calledWith('core:storage:cache:add:after');
    });
  });

  describe('#removeIndex', () => {
    it('should be able to remove an index', () => {
      indexCache.addIndex('foo');

      should(indexCache.hasIndex('foo')).be.true();

      indexCache.removeIndex('foo');

      should(indexCache.hasIndex('foo')).be.false();
      should(kuzzle.emit).calledWith('core:storage:cache:remove:after', {
        index: 'foo',
        scope: scopeEnum.PUBLIC,
      });
    });

    it('should ignore non-existing indexes', () => {
      indexCache.removeIndex('foo');

      should(kuzzle.emit).not.calledWith('core:storage:cache:remove:after');
    });

    it('should not notify if asked to', () => {
      indexCache.addIndex('foo');

      indexCache.removeIndex('foo', { notify: false });

      should(kuzzle.emit).not.calledWith('core:storage:cache:remove:after');
    });
  });

  describe('#removeCollection', () => {
    it('should be able to remove a collection', () => {
      indexCache.addCollection('foo', 'bar');

      should(indexCache.hasCollection('foo', 'bar')).be.true();

      indexCache.removeCollection('foo', 'bar');
      should(indexCache.hasCollection('foo', 'bar')).be.false();
      should(indexCache.hasIndex('foo')).be.true();
      should(kuzzle.emit).calledWith('core:storage:cache:remove:after', {
        collection: 'bar',
        index: 'foo',
        scope: scopeEnum.PUBLIC,
      });
    });

    it('should do nothing if the collection or the index does not exist', () => {
      indexCache.addCollection('foo', 'bar');

      indexCache.removeCollection('ohnoes');
      indexCache.removeCollection('foo', 'ohnoes');
      should(indexCache.hasCollection('foo', 'bar')).be.true();
      should(kuzzle.emit).not.calledWith('core:storage:cache:remove:after');
    });

    it('should not notify if asked to', () => {
      indexCache.addCollection('foo', 'bar');

      indexCache.removeCollection('foo', 'bar', { notify: false });
      should(indexCache.hasCollection('foo', 'bar')).be.false();
      should(kuzzle.emit).not.calledWith('core:storage:cache:remove:after');
    });
  });

  describe('#listIndexes', () => {
    it('should return an empty array on an empty cache', () => {
      should(indexCache.listIndexes()).be.an.Array().and.be.empty();
    });

    it('should return the list of cached indexes', () => {
      indexCache.addIndex('foo');
      indexCache.addCollection('foo', 'bar');
      indexCache.addCollection('qux', 'baz');

      should(indexCache.listIndexes()).match(['foo', 'qux']);
    });
  });

  describe('#listCollections', () => {
    it('should throw on an empty cache', () => {
      should(() => indexCache.listCollections('foo')).throw(PreconditionError, {
        id: 'services.storage.unknown_index',
      });
    });

    it('should return an empty array on an empty index', () => {
      indexCache.addIndex('foo');
      should(indexCache.listCollections('foo')).be.an.Array().and.be.empty();
    });

    it('should return the list of an index cached collections', () => {
      indexCache.addCollection('foo', 'bar');
      indexCache.addCollection('foo', 'baz');
      indexCache.addCollection('qux', 'qux');

      should(indexCache.listCollections('foo')).match(['bar', 'baz']);
    });
  });

  describe('#assertions', () => {
    it('should be able to run an assertion check on an index existence', () => {
      indexCache.addIndex('foo');

      should(() => indexCache.assertIndexExists('foo')).not.throw();
      should(() => indexCache.assertIndexExists('bar')).throw(PreconditionError, {
        id: 'services.storage.unknown_index',
      });
    });

    it('should be able to run an assertion check on a collection existence', () => {
      indexCache.addCollection('foo', 'bar');

      should(() => indexCache.assertCollectionExists('foo', 'bar')).not.throw();

      should(() => indexCache.assertCollectionExists('foo', 'baz'))
        .throw(PreconditionError, { id: 'services.storage.unknown_collection' });

      should(() => indexCache.assertCollectionExists('fooz', 'bar'))
        .throw(PreconditionError, { id: 'services.storage.unknown_index' });
    });
  });
});
