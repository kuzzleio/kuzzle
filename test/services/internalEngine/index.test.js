'use strict';

const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Bluebird = require('bluebird'),
  ms = require('ms'),
  {
    ExternalServiceError
  } = require('kuzzle-common-objects').errors;

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
    it('should accept a query at root level', () => {
      kuzzle.internalEngine.client.search.resolves({hits: { hits: ['foo', 'bar'], total: 123}});

      return kuzzle.internalEngine.search('collection', {some: 'filters'})
        .then(() => {
          should(kuzzle.internalEngine.client.search)
            .be.calledWithMatch({
              type: 'collection',
              body: {
                query: {
                  some: 'filters'
                }
              }
            });
        });
    });

    it('should inject allowed root arguments if given', () => {
      kuzzle.internalEngine.client.search.resolves({hits: { hits: ['foo', 'bar'], total: 123}});

      return kuzzle.internalEngine.search('collection', {
        query: 'query',
        aggregations: 'aggregations',
        highlight: 'highlight',
        ignored: true
      })
        .then(() => {
          const req = kuzzle.internalEngine.client.search.firstCall.args[0];

          should(req).eql({
            type: 'collection',
            body: {
              aggregations: 'aggregations',
              query: 'query',
              highlight: 'highlight'
            },
            from: undefined,
            index: kuzzle.internalEngine.index,
            scroll: undefined,
            size: undefined
          });
        });
    });

    it('should harmonize search results', () => {
      const
        collection = 'collection',
        query = { 'some': 'filters' };

      kuzzle.internalEngine.client.search.resolves({hits: { hits: ['foo', 'bar'], total: 123}});

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should inject allowed response arguments back in the response', () => {
      kuzzle.internalEngine.client.search.resolves({
        hits: { hits: ['foo', 'bar'], total: 123},
        aggregations: 'aggregations',
        ignored: true
      });

      // nb: highlight is returned inside hits
      return kuzzle.internalEngine.search('collection', {})
        .then(response => {
          should(response).eql({
            hits: ['foo', 'bar'],
            total: 123,
            aggregations: 'aggregations'
          });
        });
    });

    it('should take the query from subqueries object', () => {
      const
        collection = 'collection',
        query = { query: {'some': 'filters' }};

      kuzzle.internalEngine.client.search.returns(Bluebird.resolve({hits: { hits: ['foo', 'bar'], total: 123}}));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should perform a search on an empty filter if the filters argument is missing', () => {
      const collection = 'collection';

      kuzzle.internalEngine.client.search.returns(Bluebird.resolve({hits: {hits: ['foo', 'bar'], total: 123}}));

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
            return Bluebird.reject(error);
          }
        });
    });

    it('should save the scroll id in the cache engine for further uses', () => {
      const
        collection = 'collection',
        query = {};

      kuzzle.internalEngine.client.search.returns(Bluebird.resolve({
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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should save the scroll id with a default ttl if the provided one is not parseable', () => {
      const
        collection = 'collection',
        query = {};

      kuzzle.internalEngine.client.search.returns(Bluebird.resolve({
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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should rejects the promise if the search fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.search.rejects(error);

      return should(kuzzle.internalEngine.search('foo')).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#scroll', () => {
    it('should return a properly formatted result upon a successful scroll call', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Bluebird.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Bluebird.resolve(1));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should set the new scroll TTL to the default TTL if none is provided', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Bluebird.resolve({
        hits: {
          hits: ['foo', 'bar'],
          total: 123
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Bluebird.resolve(1));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should set the new scroll TTL to the default TTL if the one provided is not parseable', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Bluebird.resolve({
        hits: {
          hits: ['foo', 'bar'],
          total: 123
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Bluebird.resolve(1));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should throw if the scroll id is unknown', () => {
      const
        collection = 'collection';

      kuzzle.internalEngine.client.scroll.returns(Bluebird.resolve({
        hits: {
          total: 123,
          hits: ['foo', 'bar']
        },
        _scroll_id: 'foobar'
      }));

      kuzzle.services.list.internalCache.exists.returns(Bluebird.resolve(0));

      return should(kuzzle.internalEngine.scroll(collection, 'foobar')).be.rejectedWith(NotFoundError, {message: 'Non-existing or expired scroll identifier'});
    });
  });

  describe('#get', () => {
    it('should return elasticsearch response', () => {
      const
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.get.returns(Bluebird.resolve({foo: 'bar'}));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if getting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.get.rejects(error);
      return should(kuzzle.internalEngine.get('foo', 'bar')).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#mget', () => {
    it('should return elasticsearch response', () => {
      const
        collection = 'foo',
        ids = ['bar', 'qux'];

      kuzzle.internalEngine.client.mget.returns(Bluebird.resolve({docs: ['foo', 'bar']}));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if getting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.mget.rejects(error);
      return should(kuzzle.internalEngine.mget('foo', ['bar'])).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#create', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.create.returns(Bluebird.resolve({id}));

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.create.rejects(error);
      return should(kuzzle.internalEngine.create('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#createOrReplace', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.returns(Bluebird.resolve({id}));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.index.rejects(error);
      return should(kuzzle.internalEngine.createOrReplace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#update', () => {
    it('should return a properly constructed response', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.update.returns(Bluebird.resolve({id}));

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if creating the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.update.rejects(error);
      return should(kuzzle.internalEngine.update('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#replace', () => {
    it('should replace the document content if it exists', () => {
      const
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.returns(Bluebird.resolve({id}));
      kuzzle.internalEngine.client.exists.returns(Bluebird.resolve(true));

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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should rejects the promise if the document does not exist', () => {
      kuzzle.internalEngine.client.exists.returns(Bluebird.resolve(false));
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(NotFoundError);
    });

    it('should rejects the promise if the replace action fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.exists.returns(Bluebird.resolve(true));
      kuzzle.internalEngine.client.index.rejects(error);
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#delete', () => {
    it('should forward the delete action to elasticsearch', () => {
      const
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.delete.returns(Bluebird.resolve());

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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if deleting the document fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.delete.rejects(error);
      return should(kuzzle.internalEngine.delete('foo', 'bar')).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#createInternalIndex', () => {
    it('should forward the request to elasticsearch', () => {
      const
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.returns(Bluebird.resolve(false));

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          try {
            should(existsStub).be.calledOnce();
            should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
            should(createStub).be.calledOnce();
            should(createStub).be.calledWith({index: kuzzle.internalEngine.index});

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should not try to create an existing index', () => {
      const
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.returns(Bluebird.resolve(true));

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          try {
            should(existsStub).be.calledOnce();
            should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
            should(createStub).have.callCount(0);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should reject the promise if creating the internal index fails', () => {
      const error = new Error('Mocked error');
      kuzzle.internalEngine.client.indices.exists.returns(Bluebird.resolve(false));
      kuzzle.internalEngine.client.indices.create.rejects(error);

      return should(kuzzle.internalEngine.createInternalIndex()).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#listIndexes', () => {
    it('should forward the request to elasticsearch', () => {
      kuzzle.internalEngine.client.indices.getMapping.returns(Bluebird.resolve({
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


            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }

        });

    });
  });

  describe('#listCollections', () => {
    it('should forward the request to elasticsearch', () => {
      kuzzle.internalEngine.client.indices.getMapping.returns(Bluebird.resolve({
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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }

        });

    });
  });

  describe('#getMapping', () => {
    beforeEach(() => {
      kuzzle.internalEngine.esWrapper.getMapping = sinon.stub().resolves({foo: 'bar'});
    });

    it('should forward the request to elasticseach  wrapper', () => {
      const data = {index: 'foo', type: 'bar'};

      return kuzzle.internalEngine.getMapping(data)
        .then(res => {
          should(kuzzle.internalEngine.esWrapper.getMapping)
            .be.calledOnce()
            .be.calledWithExactly(data, false);
          should(res).match({foo: 'bar'});
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
            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
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

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });
  });

  describe('#applyDefaultMapping', () => {
    let
      getMappingResponse,
      commonMapping,
      index,
      collection;

    beforeEach(() => {
      index = 'test-index';
      collection = 'test-collection';

      commonMapping = {
        _kuzzle_info: {
          properties: {
            active:     { type: 'boolean' },
            author:     { type: 'keyword' },
            createdAt:  { type: 'date' },
            updatedAt:  { type: 'date' },
            updater:    { type: 'keyword' },
            deletedAt:  { type: 'date' }
          }
        }
      };

      getMappingResponse = {
        [index]: {
          mappings: {
            [collection]: {}
          }
        }
      };

      kuzzle.internalEngine.updateMapping = sinon.stub().resolves();
      kuzzle.internalEngine.getMapping = sinon.stub().resolves(getMappingResponse);
    });

    it('should update collection mapping with default mapping', () => {
      return kuzzle.internalEngine.applyDefaultMapping(index, collection, commonMapping)
        .then(defaultMapping => {
          should(defaultMapping).match({
            _kuzzle_info: {
              properties: {
                active:     { type: 'boolean' },
                author:     { type: 'keyword' },
                createdAt:  { type: 'date' },
                updatedAt:  { type: 'date' },
                updater:    { type: 'keyword' },
                deletedAt:  { type: 'date' }
              }
            }
          });

          should(kuzzle.internalEngine.updateMapping)
            .be.calledOnce()
            .be.calledWithExactly(collection, {
              [collection]: {
                dynamic: true,
                _meta: {},
                properties: {
                  _kuzzle_info: {
                    properties: {
                      active:     { type: 'boolean' },
                      author:     { type: 'keyword' },
                      createdAt:  { type: 'date' },
                      updatedAt:  { type: 'date' },
                      updater:    { type: 'keyword' },
                      deletedAt:  { type: 'date' }
                    }
                  }
                }
              }
            }, index);
        });
    });

    it('should preserve existing mapping and returns the updated mapping', () => {
      getMappingResponse[index].mappings[collection] = {
        dynamic: 'strict',
        _meta: { gordon: 'freeman' },
        properties: {
          foo: { type: 'boolean' },
          _kuzzle_info: {
            properties: {
              author: { type: 'text' }
            }
          }
        }
      };

      return kuzzle.internalEngine.applyDefaultMapping(index, collection, commonMapping)
        .then(defaultMapping => {
          should(defaultMapping).match({
            _kuzzle_info: {
              properties: {
                active:     { type: 'boolean' },
                author:     { type: 'text' },
                createdAt:  { type: 'date' },
                updatedAt:  { type: 'date' },
                updater:    { type: 'keyword' },
                deletedAt:  { type: 'date' }
              }
            }
          });

          should(kuzzle.internalEngine.updateMapping)
            .be.calledOnce()
            .be.calledWithExactly(collection, {
              [collection]: {
                dynamic: 'strict',
                _meta: { gordon: 'freeman' },
                properties: {
                  _kuzzle_info: {
                    properties: {
                      active:     { type: 'boolean' },
                      author:     { type: 'text' },
                      createdAt:  { type: 'date' },
                      updatedAt:  { type: 'date' },
                      updater:    { type: 'keyword' },
                      deletedAt:  { type: 'date' }
                    }
                  }
                }
              }
            }, index);
        });
    });
  });
});
