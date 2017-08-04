'use strict';

const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  ms = require('ms');

describe('InternalEngine', () => {
  let
    kuzzle,
    InternalEngine;

  before(() => {
    mockrequire('elasticsearch', {
      errors: {
        NoConnections: sinon.stub()
      },
      Client: ESClientMock
    });

    InternalEngine = mockrequire.reRequire('../../../lib/services/internalEngine');
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.internalEngine = new InternalEngine(kuzzle);

    return kuzzle.internalEngine.init();
  });

  after(() => {
    mockrequire.stopAll();
  });

  describe('#init', () => {
    it('should act as a singleton', () => {
      return should(kuzzle.internalEngine.init()).be.fulfilledWith(kuzzle.internalEngine);
    });
  });

  describe('#search', () => {
    it('should harmonize search results', () => {
      const
        collection = 'collection',
        query = { 'some': 'filters' };

      kuzzle.internalEngine.client.search.returns(Promise.resolve({hits: { hits: ['foo', 'bar'], total: 123}}));

      return kuzzle.internalEngine.search(collection, query, {from: 0, size: 20, scroll: 'foo'})
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.search)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type: collection,
                from: 0,
                size: 20,
                scroll: 'foo',
                body: {
                  query: query
                }
              });

            should(kuzzle.services.list.internalCache.psetex).not.be.called();
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should take the query from subqueries object', () => {
      const
        collection = 'collection',
        query = { query: {'some': 'filters' }};

      kuzzle.internalEngine.client.search.returns(Promise.resolve({hits: { hits: ['foo', 'bar'], total: 123}}));

      return kuzzle.internalEngine.search(collection, query, {from: 0, size: 20, scroll: 'foo'})
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.search)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type: collection,
                from: 0,
                size: 20,
                scroll: 'foo',
                body: {
                  query: query.query
                }
              });

            should(kuzzle.services.list.internalCache.psetex).not.be.called();
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should perform a search on an empty filter if the filters argument is missing', () => {
      const collection = 'collection';

      kuzzle.internalEngine.client.search.returns(Promise.resolve({hits: {hits: ['foo', 'bar'], total: 123}}));

      return kuzzle.internalEngine.search(collection)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.search.calledOnce)
              .be.true();

            should(kuzzle.internalEngine.client.search.calledWithMatch({
              index: kuzzle.internalEngine.index,
              type: collection
            })).be.true();

            should(kuzzle.services.list.internalCache.psetex).not.be.called();
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should save the scroll id in the cache engine for further uses', () => {
      const
        collection = 'collection',
        query = {};

      kuzzle.internalEngine.client.search.returns(Promise.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      return kuzzle.internalEngine.search(collection, query, {from: 0, size: 20, scroll: '45s'})
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.search)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type: collection,
                from: 0,
                size: 20,
                scroll: '45s',
                body: {
                  query: query
                }
              });

            should(kuzzle.services.list.internalCache.psetex).be.calledWithMatch('collection', 45000, 0);
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            should(result.scrollId).be.eql('foobar');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should save the scroll id with a default ttl if the provided one is not parseable', () => {
      const
        collection = 'collection',
        query = {};

      kuzzle.internalEngine.client.search.returns(Promise.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      return kuzzle.internalEngine.search(collection, query, {from: 0, size: 20, scroll: 'foobar'})
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.search)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type: collection,
                from: 0,
                size: 20,
                scroll: 'foobar',
                body: {
                  query: query
                }
              });

            should(kuzzle.services.list.internalCache.psetex).be.calledWithMatch(
              'collection',
              ms(kuzzle.config.services.db.defaults.scrollTTL),
              0
            );
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            should(result.scrollId).be.eql('foobar');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should rejects the promise if the search fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.search.returns(Promise.reject(error));

      return should(kuzzle.internalEngine.search('foo')).be.rejectedWith(error);
    });
  });

  describe('#scroll', () => {
    it('should return a properly formatted result upon a successful scroll call', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Promise.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Promise.resolve(1));

      return kuzzle.internalEngine.scroll(collection, 'foobar', '45s')
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.scroll)
              .be.calledOnce()
              .be.calledWithMatch({
                scrollId: 'foobar',
                scroll: '45s'
              });

            should(kuzzle.services.list.internalCache.pexpire).be.calledWithMatch(
              'collection',
              45000
            );
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            should(result.scrollId).be.eql('foobar');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should set the new scroll TTL to the default TTL if none is provided', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Promise.resolve({
        hits: {
          hits: ['foo', 'bar'],
          total: 123
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Promise.resolve(1));

      return kuzzle.internalEngine.scroll(collection, 'foobar')
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.scroll)
              .be.calledOnce()
              .be.calledWithMatch({
                scrollId: 'foobar',
                scroll: kuzzle.config.services.db.defaults.scrollTTL
              });

            should(kuzzle.services.list.internalCache.pexpire).be.calledWithMatch(
              'collection',
              ms(kuzzle.config.services.db.defaults.scrollTTL)
            );
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            should(result.scrollId).be.eql('foobar');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should set the new scroll TTL to the default TTL if the one provided is not parseable', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Promise.resolve({
        hits: {
          hits: ['foo', 'bar'],
          total: 123
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Promise.resolve(1));

      return kuzzle.internalEngine.scroll(collection, 'foobar', 'foo')
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.scroll)
              .be.calledOnce()
              .be.calledWithMatch({
                scrollId: 'foobar',
                scroll: 'foo'
              });

            should(kuzzle.services.list.internalCache.pexpire).be.calledWithMatch(
              'collection',
              ms(kuzzle.config.services.db.defaults.scrollTTL)
            );
            should(result).be.an.Object().and.not.be.empty();
            should(result.total).be.eql(123);
            should(result.hits).be.an.Array().and.match(['foo', 'bar']);
            should(result.scrollId).be.eql('foobar');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should throw if the scroll id is unknown', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Promise.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Promise.resolve(0));

      return should(kuzzle.internalEngine.scroll(collection, 'foobar')).be.rejectedWith(NotFoundError, {message: 'Non-existing or expired scroll identifier'});
    });
  });

  describe('#get', () => {
    it('should return elasticsearch response', () => {
      const
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.get.returns(Promise.resolve({foo: 'bar'}));

      return kuzzle.internalEngine.get(collection, id)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.get)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type: collection,
                id
              });

            should(result).be.an.Object().and.match({'foo': 'bar'});
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if getting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.get.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.get('foo', 'bar')).be.rejectedWith(error);
    });
  });

  describe('#mget', () => {
    it('should return elasticsearch response', () => {
      const
        collection = 'foo',
        ids = ['bar', 'qux'];

      kuzzle.internalEngine.client.mget.returns(Promise.resolve({docs: ['foo', 'bar']}));

      return kuzzle.internalEngine.mget(collection, ids)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.mget)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle', type: collection,
                body: {
                  ids
                }
              });

            should(result).be.an.Object().and.not.be.empty();
            should(result).not.have.property('docs');
            should(result).match({hits: ['foo', 'bar']});
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if getting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.mget.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.mget('foo', ['bar'])).be.rejectedWith(error);
    });
  });

  describe('#create', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.create.returns(Promise.resolve({id}));

      return kuzzle.internalEngine.create(collection, id, content)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.create)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle',
                type: collection,
                id,
                body: content
              });

            should(result).be.an.Object().and.not.be.empty();
            should(result).match({id, _source: content});

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.create.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.create('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(error);
    });
  });

  describe('#createOrReplace', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.returns(Promise.resolve({id}));

      return kuzzle.internalEngine.createOrReplace(collection, id, content)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.index)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle',
                type: collection,
                id,
                body: content
              });

            should(result).be.an.Object().and.not.be.empty();
            should(result).match({id, _source: content});
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.index.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.createOrReplace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(error);
    });
  });

  describe('#update', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.update.returns(Promise.resolve({id}));

      return kuzzle.internalEngine.update(collection, id, content)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.update)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle',
                type: collection,
                id,
                body: {
                  doc: content
                }
              });


            should(result).be.an.Object().and.not.be.empty();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.update.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.update('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(error);
    });
  });

  describe('#replace', () => {
    it('should replace the document content if it exists', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.returns(Promise.resolve({id}));
      kuzzle.internalEngine.client.exists.returns(Promise.resolve(true));

      return kuzzle.internalEngine.replace(collection, id, content)
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.index)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle',
                type: collection,
                id,
                body: content
              });

            should(result).be.an.Object().and.not.be.empty();
            should(result).match({id, _source: content});
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should rejects the promise if the document does not exist', () => {
      kuzzle.internalEngine.client.exists.returns(Promise.resolve(false));
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(NotFoundError);
    });

    it('should rejects the promise if the replace action fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.exists.returns(Promise.resolve(true));
      kuzzle.internalEngine.client.index.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(error);
    });
  });

  describe('#delete', () => {
    it('should forward the delete action to elasticsearch', () => {
      const
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.delete.returns(Promise.resolve());

      return kuzzle.internalEngine.delete(collection, id)
        .then(() => {
          try {
            should(kuzzle.internalEngine.client.delete)
              .be.calledOnce()
              .be.calledWithMatch({
                index: '%kuzzle',
                type: collection,
                id
              });

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if deleting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.delete.returns(Promise.reject(error));
      return should(kuzzle.internalEngine.delete('foo', 'bar')).be.rejectedWith(error);
    });
  });

  describe('#createInternalIndex', () => {
    it('should forward the request to elasticsearch', () => {
      const
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.returns(Promise.resolve(false));

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          try {
            should(existsStub).be.calledOnce();
            should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
            should(createStub).be.calledOnce();
            should(createStub).be.calledWith({index: kuzzle.internalEngine.index});

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should not try to create an existing index', () => {
      const
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.returns(Promise.resolve(true));

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          try {
            should(existsStub).be.calledOnce();
            should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
            should(createStub).have.callCount(0);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should reject the promise if creating the internal index fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.indices.exists.returns(Promise.resolve(false));
      kuzzle.internalEngine.client.indices.create.returns(Promise.reject(error));

      return should(kuzzle.internalEngine.createInternalIndex()).be.rejectedWith(error);
    });
  });

  describe('#listIndexes', () => {
    it('should forward the request to elasticsearch', () => {
      kuzzle.internalEngine.client.indices.getMapping.returns(Promise.resolve({
        index1: {mappings: {foo: 'bar'}},
        index2: {mappings: {foo: 'bar'}}
      }));

      return kuzzle.internalEngine.listIndexes()
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.indices.getMapping)
              .be.calledOnce();

            should(kuzzle.internalEngine.client.indices.getMapping.firstCall.args)
              .have.length(0);

            should(result).match(['index1', 'index2']);


            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }

        });

    });
  });

  describe('#listCollections', () => {
    it('should forward the request to elasticsearch', () => {
      kuzzle.internalEngine.client.indices.getMapping.returns(Promise.resolve({
        index1: {mappings: {foo: 'bar', baz: 'qux'}},
        index2: {mappings: {foo: 'bar'}}
      }));

      return kuzzle.internalEngine.listCollections('index1')
        .then(result => {
          try {
            should(kuzzle.internalEngine.client.indices.getMapping)
              .be.calledOnce();

            should(kuzzle.internalEngine.client.indices.getMapping.firstCall.args)
              .have.length(1);

            should(kuzzle.internalEngine.client.indices.getMapping.firstCall.args[0])
              .be.deepEqual({index: 'index1'});

            should(result).match(['foo', 'baz']);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }

        });

    });
  });

  describe('#getMapping', () => {
    it('should forward the request to elasticseach', () => {
      const data = {foo: 'bar'};

      return kuzzle.internalEngine.getMapping(data)
        .then(() => {
          try {
            should(kuzzle.internalEngine.client.indices.getMapping)
              .be.calledOnce()
              .be.calledWithExactly(data);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should forward the request to elasticsearch', () => {
      return kuzzle.internalEngine.deleteIndex()
        .then(() => {
          try {
            should(kuzzle.internalEngine.client.indices.delete)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index
              });
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#updateMapping', () => {
    it('should forward the request to elasticsearch', () => {
      const
        type = 'collection',
        mapping = {foo: 'bar'};

      return kuzzle.internalEngine.updateMapping(type, mapping)
        .then(() => {
          try {
            should(kuzzle.internalEngine.client.indices.putMapping)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index,
                type,
                body: mapping
              });

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#refresh', () => {
    it ('should forward the request to elasticsearch', () => {
      return kuzzle.internalEngine.refresh()
        .then(() => {
          try {
            should(kuzzle.internalEngine.client.indices.refresh)
              .be.calledOnce()
              .be.calledWithMatch({
                index: kuzzle.internalEngine.index
              });

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });
});
