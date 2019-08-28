'use strict';

const
  should = require('should'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  ms = require('ms'),
  _ = require('lodash'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      PreconditionError,
      ExternalServiceError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', () => {
  let
    kuzzle = {},
    index = 'nyc-open-data',
    collection = 'yellow-taxi',
    esIndexName = '&nyc-open-data.yellow-taxi',
    elasticsearch,
    request,
    documentAda,
    filter,
    timestamp = Date.now(),
    dateNow = Date.now;

  beforeEach(() => {
    // prevents embarking _kuzzle_info data from previous tests
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London',
      hobby: 'computer'
    };

    kuzzle = new KuzzleMock();
    elasticsearch = new ES(kuzzle, kuzzle.config.services.db);
    elasticsearch._buildClient = () => new ESClientMock();

    filter = {
      query: {
        bool: {
          query: [
            {
              term: {
                city: 'NYC'
              }
            },
            {
              term: {
                hobby: 'computer'
              }
            }
          ]
        }
      },
      sort: {},
      aggregations: {},
      aggs: {}
    };

    request = new Request({
      controller: 'document',
      action: 'create',
      requestId: 'foo',
      collection,
      index,
      body: documentAda
    }, { token: { userId: 'test' }, user: { _id: 'test' } });

    elasticsearch.init();

    Date.now = () => timestamp;
  });

  afterEach(() => {
    Date.now = dateNow;
  })

  describe('#constructor', () => {
    it('should initialize properties', () => {
      const esPublic = new ES(kuzzle, kuzzle.config.services.db);
      const esInternal = new ES(kuzzle, kuzzle.config.services.db, 'internal');

      should(esPublic.kuzzle).be.exactly(kuzzle);
      should(esPublic.config).be.exactly(kuzzle.config.services.db);
      should(esPublic.indexPrefix).be.eql('&');
      should(esInternal.indexPrefix).be.eql('%');
    });
  });

  describe('#init', () => {
    it('should initialize properly', () => {
      elasticsearch = new ES(kuzzle, kuzzle.config.services.db);
      elasticsearch._buildClient = () => new ESClientMock();
      const bootstrapMock = { index: 'kuzzle' };

      const promise = elasticsearch.init(bootstrapMock);

      return should(promise).be.fulfilledWith(elasticsearch)
        .then(() => {
          should(elasticsearch.bootstrap).be.eql(bootstrapMock);
          should(elasticsearch.client).not.be.null();
          should(elasticsearch.esWrapper).not.be.null();
          should(elasticsearch.esVersion).not.be.null();
        });
    });
  });

  describe('#scroll', () => {
    it('should be able to scroll an old search', () => {
      elasticsearch.client.scroll.resolves({
        body: {
          total: 0,
          hits: [],
          scrollId: 'azerty'
        }
      });

      const promise = elasticsearch.scroll(
          index,
          collection,
          'i-am-scroll-id',
          { scroll: '10s' });

      return promise
        .then(result => {
          should(kuzzle.services.list.internalCache.exists).be.called();
          should(kuzzle.services.list.internalCache.pexpire).be.called();
          should(elasticsearch.client.scroll.firstCall.args[0]).be.deepEqual({
            index: esIndexName,
            scrollId: 'i-am-scroll-id',
            scroll: '10s'
          });
          should(result).be.deepEqual({
            total: 0,
            hits: [],
            scrollId: 'azerty'
          });
        });
    });

    it('should return a rejected promise if a scroll fails', () => {
      elasticsearch.client.scroll.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.scroll(index, collection, 'i-am-scroll-id');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });

    it('should rejects if the scrollId does not exists in Kuzzle cache', () => {
      kuzzle.services.list.internalCache.exists.resolves(0);

      const promise = elasticsearch.scroll(index, collection, 'i-am-scroll-id');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unknown_scroll_identifier'
      })
        .then(() => {
          should(kuzzle.services.list.internalCache.pexpire).not.be.called();
          should(elasticsearch.client.scroll).not.be.called();
        });
    });
  });

  describe('#search', () => {
    it('should be able to search documents', () => {
      elasticsearch.client.search.resolves({
        body: {
          total: 1,
          hits: [ { _id: 'liia', _source: { city: 'Kathmandu' } } ],
          body: filter,
          aggregations: { some: 'aggregs' },
          scrollId: 'i-am-scroll-id'
        }
      });

      const promise = elasticsearch.search(index, collection, filter);

      return promise
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0]).match({
            index: esIndexName,
            body: filter,
            from: null,
            size: null,
            scroll: null
          });

          should(kuzzle.services.list.internalCache.psetex.firstCall.args[1])
            .be.eql(ms(elasticsearch.config.defaults.scrollTTL));

          should(result).match({
            scrollId: 'i-am-scroll-id',
            hits: [ { _id: 'liia', _source: { city: 'Kathmandu' } } ],
            total: 1,
            aggregations: { some: 'aggregs' }
          });
        });
    });

    it('should be able to search with from/size and scroll arguments', () => {
      elasticsearch.client.search.resolves({
        body: {
          total: 0,
          hits: [],
          scrollId: 'i-am-scroll-id'
        }
      });

      const promise = elasticsearch.search(
        index,
        collection,
        filter,
        { from: 0, size: 1, scroll: '30s' });

      return promise
        .then(() => {
          should(elasticsearch.client.search.firstCall.args[0]).match({
            index: esIndexName,
            body: filter,
            from: 0,
            size: 1,
            scroll: '30s'
          });
          should(kuzzle.services.list.internalCache.psetex.firstCall.args[1])
            .be.eql(ms('30s'));
        });
    });

    it('should return a rejected promise if a search fails', () => {
      elasticsearch.client.search.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.search(index, collection, filter);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });

    it('should not save the scrollId in the cache if not present in response', () => {
      elasticsearch.client.search.resolves({
        body: {
          total: 0,
          hits: []
        }
      });

      const promise = elasticsearch.search(index, collection, {});

      return promise
        .then(() => {
          should(kuzzle.services.list.internalCache.psetex).not.be.called();
        });
    });
  });

  describe('#get', () => {
    it('should allow getting a single document', () => {
      elasticsearch.client.get.resolves({
        body: {
          _id: 'liia',
          _source: { city: 'Kathmandu' },
          _version: 1
        }
      });

      const promise = elasticsearch.get(index, collection, 'liia')

      return promise
        .then(result => {
          should(elasticsearch.client.get).be.calledWithMatch({
            index: esIndexName,
            id: 'liia'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' }
          });
        });
    });

    it('should reject requests when the user search for a document with id _search', () => {
      const promise = elasticsearch.get(index, collection, '_search')

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.wrong_get_action'
      });
    });

    it('should return a rejected promise if a get fails', () => {
      elasticsearch.client.get.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.get(index, collection, 'liia');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#mGet', () => {
    it('should allow getting multiples documents', () => {
      elasticsearch.client.mget.resolves({
        body: {
          docs: [ { _id: 'liia', _source: { city: 'Kathmandu' } } ],
          total: 1
        }
      });

      const promise = elasticsearch.mGet(index, collection, ['liia']);

      return promise
        .then(result => {
          should(elasticsearch.client.mget).be.calledWithMatch({
            index: esIndexName,
            body: ['liia']
          });

          should(result).match({
            hits: [ { _id: 'liia', _source: { city: 'Kathmandu' } } ],
            total: 1
          });
        });
    });

    it('should return a rejected promise if a search fails', () => {
      elasticsearch.client.mget.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.mGet(index, collection, ['liia']);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#count', () => {
    it('should allow counting documents using a provided filter', () => {
      elasticsearch.client.count.resolves({
        body: {
          count: 42
        }
      });

      const promise = elasticsearch.count(index, collection, filter);

      return promise
        .then(result => {
          should(elasticsearch.client.count).be.calledWithMatch({
            index: esIndexName,
            body: filter
          });

          should(result).match({
            count: 42
          });
        });
    });

    it('should return a rejected promise if count fails', () => {
      elasticsearch.client.count.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.count(index, collection);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#create', () => {
    it('should allow creating document an ID is provided', () => {
      elasticsearch.client.index.resolves({
        body: {
          _id: 'liia',
          _version: 1,
          _source: { city: 'Kathmandu' }
        }
      });

      const promise = elasticsearch.create(
        index,
        collection,
        { city: 'Kathmandu' },
        { id: 'liia', refresh: 'wait_for', userId: 'aschen' });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: 'aschen',
                createdAt: timestamp
              }
            },
            id: 'liia',
            refresh: 'wait_for',
            op_type: 'create'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' }
          });
        });
    });

    it('should create a document when no ID is provided', () => {
      elasticsearch.client.index.resolves({
        body: {
          _id: 'mehry',
          _version: 1,
          _source: { city: 'Panipokari' }
        }
      });

      const promise = elasticsearch.create(
        index,
        collection,
        { city: 'Panipokari' });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Panipokari',
              _kuzzle_info: {
                author: 'null'
              }
            }
          });

          should(result).match({
            _id: 'mehry',
            _version: 1,
            _source: { city: 'Panipokari' }
          });
        });
    });

    it('should return a rejected promise if client.index throws an error', () => {
      elasticsearch.client.index.rejects({
        meta: { body: { error: { reason: '[liia]: version conflict, document already exists (current version [1])' } } }
      });

      const promise = elasticsearch.create(
          index,
          collection,
          { city: 'Kathmandu' },
          { id: 'liia' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.document_already_exists'
      });
    });
  });

  describe('#createOrReplace', () => {
    beforeEach(() => {
      elasticsearch.client.index.resolves({
        body: {
          _id: 'liia',
          _version: 1,
          _source: { city: 'Kathmandu' },
          created: true
        }
      });
    });

    it('should support createOrReplace capability', () => {
      const promise = elasticsearch.createOrReplace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' },
        { refresh: 'wait_for', userId: 'aschen' });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: 'aschen',
                createdAt: timestamp,
                updatedAt: timestamp,
                updater: 'aschen'
              }
            },
            id: 'liia',
            refresh: 'wait_for'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' },
            created: true
          });
        });
    });

    it('should not inject meta if specified', () => {
      const promise = elasticsearch.createOrReplace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' },
        { injectKuzzleMeta: false });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Kathmandu',
              _kuzzle_info: undefined
            },
            id: 'liia'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' },
            created: true
          });
        });
    });

    it('should return a rejected promise if client.index fails', () => {
      elasticsearch.client.index.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.createOrReplace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#update', () => {
    beforeEach(() => {
      elasticsearch.client.update.resolves({
        body: {
          _id: 'liia',
          _version: 1
        }
      });
    });

    it('should allow to update a document', () => {
      const promise = elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Panipokari' });

      return promise
        .then(result => {
          should(elasticsearch.client.update).be.calledWithMatch({
            index: esIndexName,
            body: {
              doc: {
                city: 'Panipokari',
                _kuzzle_info: {
                  updatedAt: timestamp,
                  updater: 'null'
                }
              }
            },
            id: 'liia',
            refresh: false,
            retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
          });

          should(result).match({
            _id: 'liia',
            _version: 1
          });
        });
    });

    it('should handle optional configurations', () => {
      const promise = elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        { refresh: 'wait_for', userId: 'aschen', retryOnConflict: 42 });

      return promise
        .then(result => {
          should(elasticsearch.client.update).be.calledWithMatch({
            index: esIndexName,
            body: {
              doc: {
                city: 'Panipokari',
                _kuzzle_info: {
                  updatedAt: timestamp,
                  updater: 'aschen'
                }
              }
            },
            id: 'liia',
            refresh: 'wait_for',
            retryOnConflict: 42
          });

          should(result).match({
            _id: 'liia',
            _version: 1
          });
        });
    });

    it('should return a rejected promise with a NotFoundError when updating a document which does not exist', () => {
      const esError = new Error('test');
      esError.meta = { statusCode: 404 };
      esError.body = {
        found: false,
        _id: 'mehry',
        error: {
          reason: 'foo',
          'resource.id': 'bar'
        }
      };
      elasticsearch.client.update.rejects(esError);

      const promise = elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Panipokari' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.document_not_found'
      });
    });

    it('should return a rejected promise if client.update fails', () => {
      elasticsearch.client.update.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#replace', () => {
    beforeEach(() => {
      elasticsearch.client.index.resolves({
        body: {
          _id: 'liia',
          _version: 1,
          _source: { city: 'Kathmandu' }
        }
      });
      elasticsearch.client.exists.resolves({ body: true });
    });

    it('should support replace capability', () => {
      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: 'null',
                createdAt: timestamp,
                updatedAt: timestamp,
                updater: 'null'
              }
            },
            refresh: false
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' }
          });
        });
    });

    it('should accept additional options', () => {
      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' },
        { refresh: 'wait_for', userId: 'aschen' });

      return promise
        .then(result => {
          should(elasticsearch.client.index).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: 'aschen',
                createdAt: timestamp,
                updatedAt: timestamp,
                updater: 'aschen'
              }
            },
            refresh: 'wait_for'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' }
          });
        });
    });

    it('should throw a NotFoundError Exception if document already exists', () => {
      elasticsearch.client.exists.resolves({ body: false });

      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.document_not_found'
      })
        .then(() => {
          should(elasticsearch.client.index).not.be.called();
        });
    });

    it('should return a rejected promise if client.index fails', () => {
      elasticsearch.client.index.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#delete', () => {
    beforeEach(() => {
      elasticsearch.client.delete.resolves({
        body: {
          _id: 'liia'
        }
      });
    });

    it('should allow to delete a document', () => {
      const promise = elasticsearch.delete(
        index,
        collection,
        'liia');

      return promise
        .then(result => {
          should(elasticsearch.client.delete).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            refresh: false,
            retryOnConflict: 0
          });

          should(result).match({
            _id: 'liia'
          });
        });
    });

    it('should allow additional options', () => {
      const promise = elasticsearch.delete(
        index,
        collection,
        'liia',
        { refresh: 'wait_for', retryOnConflict: 42 });

      return promise
        .then(result => {
          should(elasticsearch.client.delete).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            refresh: 'wait_for',
            retryOnConflict: 42
          });

          should(result).match({
            _id: 'liia'
          });
        });
    });

    it('should return a rejected promise if client.delete fails', () => {
      elasticsearch.client.delete.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.delete(
        index,
        collection,
        'liia');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#deleteByQuery', () => {
    beforeEach(() => {
      elasticsearch.client.deleteByQuery.resolves({
        body: {
          total: 2,
          deleted: 1,
          failures: [
            { shardId: 42, reason: 'error', foo: 'bar' }
          ]
        }
      });
    });

    it('should have deleteByQuery capability', () => {
      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' });

      return promise
        .then(result => {
          should(elasticsearch.client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { filter: 'term' } },
            from: null,
            size: null,
            refresh: false
          });

          should(result).match({
            total: 2,
            deleted: 1,
            failures: [
              { shardId: 42, reason: 'error' }
            ]
          });
        });
    });

    it('should allow additional options', () => {
      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' },
        { refresh: 'wait_for', from: 1, size: 3 });

      return promise
        .then(result => {
          should(elasticsearch.client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { filter: 'term' } },
            from: 1,
            size: 3,
            refresh: 'wait_for'
          });

          should(result).match({
            total: 2,
            deleted: 1,
            failures: [
              { shardId: 42, reason: 'error' }
            ]
          });
        });
    });

    it('should return a rejected promise if client.deleteByQuery fails', () => {
      elasticsearch.client.deleteByQuery.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });

    it('should reject if the query is empty', () => {
      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        'not an object');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.empty_query'
      });
    });
  });

  describe('#createIndex', () => {
    beforeEach(() => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: esIndexName }, { index: '%nepali.liia' }
        ]
      });
    });

    it('should resolves if index does not exists', () => {
      const promise = elasticsearch.createIndex('lfiduras');

      return should(promise).be.resolved();
    });

    it('should rejects if the index already exists', () => {
      const promise = elasticsearch.createIndex('nepali');

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.index_already_exists'
      });
    });

    it('should return a rejected promise if client.cat.indices fails', () => {
      elasticsearch.client.cat.indices.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.createIndex(
        index,
        collection,
        { filter: 'term' });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#createCollection', () => {
    let _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch._checkMappings;

      elasticsearch.collectionExists = sinon.stub().resolves(false);
      elasticsearch.client.indices.create.resolves({});
      elasticsearch._checkMappings = sinon.stub().resolves();
    });

    it('should allow creating a new collection and inject commonMappings', () => {
      const
        mappings = { properties: { city: { type: 'keyword' } } },
        mergedMappings = _.merge(mappings, elasticsearch.config.commonMapping),
        promise = elasticsearch.createCollection(
          index,
          collection,
          mappings
        );

      return promise
        .then(result => {
          should(elasticsearch.collectionExists).be.calledWith(index, collection);
          should(elasticsearch._checkMappings).be.calledWithMatch(
            mergedMappings
          );
          should(elasticsearch.client.indices.create).be.calledWithMatch({
            index: esIndexName,
            body: {
              mappings: mergedMappings
            }
          });

          should(result).match({});
        });
    });

    it('should return a rejected promise if client.indices.create fails', () => {
      elasticsearch.client.indices.create.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.createCollection(
        index,
        collection,
        { properties: { city: { type: 'keyword' } } });

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });

    it('should reject with BadRequestError on wrong mapping', () => {
      elasticsearch._checkMappings = _checkMappings;
      const collectionMapping = {
        dinamic: 'false',
        properties: {
          freeman:  { type: 'keyword' }
        }
      };

      const promise = elasticsearch.createCollection(
        index,
        collection,
        collectionMapping);

      return should(promise).be.rejectedWith({
        message: /Did you mean "dynamic"/,
        errorName: 'external.elasticsearch.incorrect_mapping_property'
      });
    });

    it('should call updateMapping if the collection already exists', () => {
      elasticsearch.collectionExists = sinon.stub().resolves(true);
      elasticsearch.updateMapping = sinon.stub().resolves({});

      const promise = elasticsearch.createCollection(index, collection);

      return promise
        .then(() => {
          should(elasticsearch.collectionExists).be.calledWith(index, collection);
          should(elasticsearch.updateMapping).be.calledOnce();
        });
    });

    it('should not overwrite kuzzle commonMapping', () => {
      elasticsearch.config.commonMapping = {
        properties: {
          gordon: { type: 'text' },
          _kuzzle_info: {
            properties: {
              author:     { type: 'text' },
              createdAt:  { type: 'date' },
              updatedAt:  { type: 'date' },
              updater:    { type: 'keyword' },
            }
          }
        }
      };
      const collectionMapping = {
        properties: {
          gordon:   { type: 'keyword' },
          freeman:  { type: 'keyword' },
          _kuzzle_info: {
            properties: {
              author: { type: 'keyword' }
            }
          }
        }
      };

      const promise = elasticsearch.createCollection(
        index,
        collection,
        collectionMapping);

      return promise
        .then(() => {
          const
            esReq = elasticsearch.client.indices.create.firstCall.args[0],
            expectedMapping = {
              properties: {
                gordon:   { type: 'text' },
                freeman:  { type: 'keyword' },
                _kuzzle_info: {
                  properties: {
                    author:     { type: 'text' },
                    createdAt:  { type: 'date' },
                    updatedAt:  { type: 'date' },
                    updater:    { type: 'keyword' },
                  }
                }
              }
            };

          should(esReq.body.mappings).eql(expectedMapping);
        });
    });

  });

  describe('#getMapping', () => {
    beforeEach(() => {
      elasticsearch.client.indices.getMapping.resolves({
        body: {
          [esIndexName]: {
            mappings: {
              dynamic: true,
              _meta: { lang: 'npl' },
              properties: {
                city: { type: 'keyword' },
                _kuzzle_info: { properties: { author: { type: 'keyword' } } }
              }
            }
          }
        }
      });

      elasticsearch.esWrapper.getMapping = sinon.stub().resolves({foo: 'bar'});
    });

    it('should have getMapping capabilities', () => {
      const promise = elasticsearch.getMapping(index, collection);

      return promise
        .then(result => {
          should(elasticsearch.client.indices.getMapping).be.calledWithMatch({
            index: esIndexName
          });

          should(result).match({
            dynamic: true,
            _meta: { lang: 'npl' },
            properties: {
              city: { type: 'keyword' }
            }
          });
        });
    });

    it('should include kuzzleMeta if specified', () => {
      const promise = elasticsearch.getMapping(
          index,
          collection,
          { includeKuzzleMeta: true });

      return promise
        .then(result => {
          should(elasticsearch.client.indices.getMapping).be.calledWithMatch({
            index: esIndexName
          });

          should(result).match({
            dynamic: true,
            _meta: { lang: 'npl' },
            properties: {
              city: { type: 'keyword' },
              _kuzzle_info: { properties: { author: { type: 'keyword' } } }
            }
          });
        });
    });
  });

  describe('#updateMapping', () => {
    let
      newMapping,
      existingMapping,
      _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch._checkMappings;

      newMapping = {
        properties: {
          name: { type: 'keyword' }
        }
      };

      existingMapping = {
        dynamic: 'strict',
        _meta: { meta: 'data' },
        properties: {
          city: { type: 'keyword' },
          _kuzzle_info: {
            properties: {
              author: { type: 'keyword' }
            }
          }
        }
      };

      elasticsearch.getMapping = sinon.stub().resolves(existingMapping);
      elasticsearch.client.indices.putMapping.resolves({});
      elasticsearch._checkMappings = sinon.stub().resolves();
    });

    it('should have mapping capabilities', () => {
      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return promise
        .then(result => {
          should(elasticsearch.client.indices.putMapping).be.calledWithMatch({
            index: esIndexName,
            body: {
              dynamic: 'strict',
              _meta: { meta: 'data' },
              properties: {
                name: { type: 'keyword' }
              }
            }
          });

          should(result).match({
            dynamic: 'strict',
            _meta: { meta: 'data' },
            properties: {
              city: { type: 'keyword' },
              name: { type: 'keyword' },
              _kuzzle_info: {
                properties: {
                  author: { type: 'keyword' }
                }
              }
            }
          });
        });
    });

    it('should reject with BadRequestError on wrong mapping', () => {
      elasticsearch._checkMappings = _checkMappings;
      newMapping = {
        dinamic: 'false',
        properties: {
          freeman:  { type: 'keyword' }
        }
      };

      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return should(promise).be.rejectedWith({
        message: /Did you mean "dynamic"/,
        errorName: 'external.elasticsearch.incorrect_mapping_property'
      });
    });

    it('should replace dynamic and _meta', () => {
      existingMapping = {
        dynamic: 'true',
        _meta: { some: 'meta' }
      };
      newMapping = {
        dynamic: 'false',
        _meta: { other: 'meta' }
      };

      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return promise
        .then(result => {
          should(elasticsearch.client.indices.putMapping).be.calledWithMatch({
            index: esIndexName,
            body: {
              dynamic: 'false',
              _meta: { other: 'meta' }
            }
          });

          should(result).match({
            dynamic: 'false',
            _meta: { other: 'meta' }
          });
        });
    });

    it('should reject and handle error for bad mapping input', () => {
      const error = new Error('test');
      error.meta = {
        statusCode: 400
      };
      error.body = {
        error: {
          reason: 'foo'
        }
      };
      elasticsearch.client.indices.putMapping.rejects(error);

      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_bad_request_error'
      });
    });
  });

  describe.only('#truncateCollection', () => {
    let existingMapping;

    beforeEach(() => {
      existingMapping = {
        dynamic: 'false',
        properties: {
          name: { type: 'keyword' }
        }
      };

      elasticsearch.getMapping = sinon.stub().resolves(existingMapping);
    });

    it('should delete and then create the collection with the same mapping', () => {
      const promise = elasticsearch.truncateCollection(index, collection);

      return promise
        .then(result => {
          should(elasticsearch.getMapping).be.calledWith(index, collection);
          should(elasticsearch.client.indices.delete).be.calledWithMatch({
            index: esIndexName
          });
          should(elasticsearch.client.indices.create).be.calledWithMatch({
            index: esIndexName,
            mappings: {
              dynamic: 'false',
              properties: {
                name: { type: 'keyword' }
              }
            }
          });

          should(result).be.undefined();
        })
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch.client.indices.delete.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.truncateCollection(index, collection);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#import', () => {
    let
      expectedEsRequest,
      bulkReturnError,
      documents,
      bulkReturn;

    beforeEach(() => {
      expectedEsRequest = {
        body: [
          { index: { _id: 1, _index: esIndexName } },
          {
            firstName: 'foo',
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
              updater: null,
              updatedAt: null
            }
          },

          { index: { _id: 2, _index: esIndexName } },
          {
            firstName: 'bar',
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
              updater: null,
              updatedAt: null
            }
          },
        ],
        refresh: false,
        timeout: null
      };

      bulkReturn = {
        body: {
          items: [
            { index: { status: 201, _id: 1, result: 'created', toto: 42 } },
            { index: { status: 201, _id: 2, result: 'created', toto: 42 } },
            { update: { status: 200, _id: 3, result: 'updated', toto: 42 } },
            { delete: { status: 200, _id: 4, result: 'deleted', toto: 42 } }
          ],
          errors: false
        }
      };

      bulkReturnError = {
        body: {
          items: [
            { index: { status: 201, _id: 1, result: 'created', toto: 42 } },
            { index: { status: 201, _id: 2, result: 'created', toto: 42 } },
            { update: { status: 404, _id: 42, error: { type: 'not_found', reason: 'not found', toto: 42 } } },
            { delete: { status: 404, _id: 21, error: { type: 'not_found', reason: 'not found', toto: 42 } } }
          ],
          errors: true
        }
      };

      documents = [
        { index: { _id: 1, _index: 'overwrite-me' } },
        { firstName: 'foo' },

        { index: { _id: 2, _type: 'delete-me' } },
        { firstName: 'bar' },
      ];

      elasticsearch.client.bulk.resolves(bulkReturn)
    });

    it('should support bulk data import', () => {
      documents = [
        { index: { _id: 1 } },
        { firstName: 'foo' },

        { index: { _id: 2 } },
        { firstName: 'bar' },

        { update: { _id: 3 } },
        { doc: { firstName: 'foobar' } },

        { delete: { _id: 4 } }
      ];

      const promise = elasticsearch.import(index, collection, documents);

      return promise
        .then(result => {
          expectedEsRequest = {
            body: [
              { index: { _id: 1, _index: esIndexName } },
              {
                firstName: 'foo',
                _kuzzle_info: {
                  author: null,
                  createdAt: timestamp,
                  updater: null,
                  updatedAt: null
                }
              },

              { index: { _id: 2, _index: esIndexName } },
              {
                firstName: 'bar',
                _kuzzle_info: {
                  author: null,
                  createdAt: timestamp,
                  updater: null,
                  updatedAt: null
                }
              },

              { update: { _id: 3, _index: esIndexName } },
              { doc: {
                  firstName: 'foobar',
                  _kuzzle_info: {
                    updater: null,
                    updatedAt: timestamp
                  }
                }
              },

              { delete: { _id: 4, _index: esIndexName } }
            ],
            refresh: false,
            timeout: null
          };
          should(elasticsearch.client.bulk).be.calledWithMatch(expectedEsRequest);

          should(result).match({
            items: [
              { index: { status: 201, _id: 1, result: 'created' } },
              { index: { status: 201, _id: 2, result: 'created' } },
              { update: { status: 200, _id: 3, result: 'updated' } },
              { delete: { status: 200, _id: 4, result: 'deleted' } },
            ],
            errors: []
          });
        });
    });

    it('should inject index name', () => {
      const promise = elasticsearch.import(index, collection, documents);

      return promise
        .then(() => {
          should(elasticsearch.client.bulk).be.calledWithMatch(expectedEsRequest);
        });
    });

    it('should inject addition options to esRequest', () => {
      const promise = elasticsearch.import(
        index,
        collection,
        documents,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(() => {
          should(elasticsearch.client.bulk).be.calledWithMatch({
            body: [
              { index: { _id: 1, _index: esIndexName } },
              {
                firstName: 'foo',
                _kuzzle_info: {
                  author: 'aschen',
                  createdAt: timestamp,
                  updater: null,
                  updatedAt: null
                }
              },

              { index: { _id: 2, _index: esIndexName } },
              {
                firstName: 'bar',
                _kuzzle_info: {
                  author: 'aschen',
                  createdAt: timestamp,
                  updater: null,
                  updatedAt: null
                }
              },
            ],
            refresh: 'wait_for',
            timeout: '10m'
          });
        });
    });

    it('should populate "errors" array for bulk data import with some errors', () => {
      elasticsearch.client.bulk.resolves(bulkReturnError);

      const promise = elasticsearch.import(index, collection, documents);

      return promise
        .then(result => {
          should(result).match({
            items: [
              { index: { status: 201, _id: 1, result: 'created' } },
              { index: { status: 201, _id: 2, result: 'created' } },
              ],
            errors: [
              { update: { status: 404, _id: 42, error: { type: 'not_found', reason: 'not found' } } },
              { delete: { status: 404, _id: 21, error: { type: 'not_found', reason: 'not found' } } }
            ]
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch.client.bulk.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.import(index, collection, documents);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#listCollections', () => {
    beforeEach(() => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&nyc-open-data.taxi' }
        ]
      });
    })

    it('should allow listing all available collections', () => {
      const promise = elasticsearch.listCollections('nepali');

      return promise
        .then(result => {
          should(result).match({
            collections: ['mehry', 'liia']
          });
        });
    });

    it('should not list unauthorized collections', () => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '%nepali.mehry' },
          { index: '%nepali.liia' },
          { index: '%nyc-open-data.taxi' }
        ]
      });

      const promise = elasticsearch.listCollections('nepali');

      return promise
        .then(result => {
          should(result).match({
            collections: []
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch.client.cat.indices.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.listCollections(index);

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe('#listIndexes', () => {
    beforeEach(() => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&nyc-open-data.taxi' }
        ]
      });
    })

    it('should allow listing all available indexes', () => {
      const promise = elasticsearch.listIndexes();

      return promise
        .then(result => {
          should(result).match({
            indexes: ['nepali', 'nyc-open-data']
          });
        });
    });

    it('should not list unauthorized indexes', () => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '%nepali.mehry' },
          { index: '%nepali.liia' },
          { index: '%nyc-open-data.taxi' }
        ]
      });

      const promise = elasticsearch.listIndexes();

      return promise
        .then(result => {
          should(result).match({
            indexes: []
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch.client.cat.indices.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.listIndexes();

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });

  describe.only('#deleteIndexes', () => {
    beforeEach(() => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&do-not.delete' },
          { index: '&nyc-open-data.taxi' }
        ]
      });
    })

    it('should allow to deletes multiple indexes', () => {
      const promise = elasticsearch.deleteIndexes(['nepali', 'nyc-open-data']);

      return promise
        .then(result => {
          should(elasticsearch.client.indices.delete).be.calledWithMatch({
            index: ['&nepali.mehry', '&nepali.liia', '&nyc-open-data.taxi']
          });

          should(result).match({
            deleted: ['nepali', 'nyc-open-data']
          });
        });
    });

    it('should not list unauthorized indexes', () => {
      elasticsearch.client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&do-not.delete' },
          { index: '%nyc-open-data.taxi' }
        ]
      });

      const promise = elasticsearch.deleteIndexes(['nepali', 'nyc-open-data']);

      return promise
        .then(result => {
          should(result).match({
            indexes: []
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch.client.cat.indices.rejects({
        meta: { statusCode: 42 }
      });

      const promise = elasticsearch.listIndexes();

      return should(promise).be.rejectedWith({
        errorName: 'external.elasticsearch.unexpected_error'
      });
    });
  });


  describe('#getAllIdsFromQuery', () => {
    it('should be able to get every ids matching a query', () => {
      const
        getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
        ids = ['foo', 'bar'];

      elasticsearch.client.search.yields(null, {
        hits: {
          hits: [{_id: 'foo'}, {_id: 'bar'}],
          total: 2
        }
      });

      return getAllIdsFromQuery(elasticsearch.client, request)
        .then(result => {
          should(result).be.an.Array().and.match(ids);
          should(result.length).be.exactly(2);
        });
    });

    it('should return a rejected promise if the search fails', () => {
      const getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery');

      elasticsearch.client.search.yields(new Error('rejected'));
      return should(getAllIdsFromQuery(elasticsearch.client, request)).be.rejectedWith('rejected');
    });

    it('should scroll through result pages until getting all ids', () => {
      const
        getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
        ids = ['foo', 'bar'];

      elasticsearch.client.search.yields(null, {
        hits: {
          hits: [{_id: 'foo'}],
          total: 2
        }
      });
      elasticsearch.client.scroll.yields(null, {
        hits: {
          hits: [ {_id: 'bar'} ],
          total: 2
        }
      });

      return getAllIdsFromQuery(elasticsearch.client, request)
        .then(result => {
          should(result).be.an.Array().and.match(ids);
          should(result.length).be.exactly(2);
        });
    });
  });

  describe('#reset', () => {
    it('should allow deleting all indexes', () => {
      elasticsearch.client.indices.delete.resolves({});

      elasticsearch.client.cat.indices.resolves('      \n %kuzzle      \n ' + index + ' \n  ');

      request.input.body = {indexes: [index]};

      return elasticsearch.deleteIndexes(request)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0]).be.an.Object().and.match({index: [index]});
        });
    });

    it('should return a rejected promise if the reset fails while deleting all indexes', () => {
      const
        error = new Error('Mocked delete error'),
        indexes = {index: ['some index']};

      request.input.body = {indexes: [index]};
      indexes[kuzzle.config.internalIndex] = [];

      elasticsearch.client.indices.getMapping.resolves(indexes);
      elasticsearch.client.indices.delete.rejects(error);

      return should(elasticsearch.deleteIndexes(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#deleteIndex', () => {
    it('should be able to delete index', () => {
      elasticsearch.client.indices.delete.resolves({});

      return elasticsearch.deleteIndex(request)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0].index).be.exactly(request.input.resource.index);
        });
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', () => {
      elasticsearch.client.indices.delete.rejects(new Error());

      return should(elasticsearch.deleteIndex(request)).be.rejected();
    });

    it('should throw if attempting to delete an internal index', () => {
      request.input.resource.index = '%foobar';

      should(() => elasticsearch.deleteIndex(request)).throw(BadRequestError);
    });
  });

  describe('#listIndexes', () => {
    it('should allow listing indexes', () => {
      elasticsearch.client.indices.getMapping.resolves({indexes: []});

      return elasticsearch.listIndexes(request);
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.rejects(error);

      return should(elasticsearch.listIndexes(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#getInfos', () => {
    it('should allow getting elasticsearch informations', () => {
      const output = { version: {}, indices: { store: {} } };

      elasticsearch.client.cluster.stats.resolves(output);
      elasticsearch.client.cluster.health.resolves(output);
      elasticsearch.client.info.resolves(output);

      return elasticsearch.getInfos(request);
    });
  });

  describe('#refreshIndex', () => {
    it('should send a valid request to es client', () => {
      elasticsearch.client.indices.refresh = sinon.spy(req => Bluebird.resolve(req));

      return elasticsearch.refreshIndex(request)
        .then(data => {
          should(data.index).be.eql(index);
        });
    });

    it('should throw if attempting to refresh an internal index', () => {
      request.input.resource.index = '%foobar';

      should(() => elasticsearch.refreshIndex(request)).throw(BadRequestError);
    });
  });

  describe('#getAutoRefresh', () => {
    it('should reflect the current autoRefresh status', () => {
      return elasticsearch.getAutoRefresh(request)
        .then(response => {
          should(response).be.false();

          elasticsearch.settings.autoRefresh[request.input.resource.index] = true;
          return elasticsearch.getAutoRefresh(request);
        })
        .then(response => {
          should(response).be.true();
          elasticsearch.settings.autoRefresh[request.input.resource.index] = false;
        });
    });

    it('should throw if attempting to get the AutoRefresh status on an internal index', () => {
      request.input.resource.index = '%foobar';

      should(() => elasticsearch.getAutoRefresh(request)).throw(BadRequestError);
    });
  });

  describe('#setAutoRefresh', () => {
    it('should toggle the autoRefresh status', () => {
      const
        req = new Request({
          index: request.index,
          body: { autoRefresh: true }
        });

      kuzzle.internalEngine.createOrReplace = sinon.stub().resolves({});

      return elasticsearch.setAutoRefresh(req)
        .then(response => {
          should(response).be.true();
          should(kuzzle.internalEngine.createOrReplace.calledOnce).be.true();

          req.input.body.autoRefresh = false;
          return elasticsearch.setAutoRefresh(req);
        })
        .then(response => {
          should(response).be.false();
        });
    });

    it('should throw if attempting to set the AutoRefresh option on an internal index', () => {
      request.input.resource.index = '%foobar';

      should(() => elasticsearch.setAutoRefresh(request)).throw(BadRequestError);
    });
  });

  describe('#refreshIndexIfNeeded', () => {
    it('should not refresh the index if autoRefresh is set to false', () => {
      elasticsearch.client.indices.refresh.resolves({});

      return elasticsearch.refreshIndexIfNeeded({index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(elasticsearch.client.indices.refresh).not.be.called();
          should(response).be.eql({ foo: 'bar' });
        });
    });

    it('should refresh the index if asked to', () => {
      elasticsearch.client.indices.refresh.resolves({});
      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return elasticsearch.refreshIndexIfNeeded({index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(elasticsearch.client.indices.refresh).be.called();
          should(response).be.eql({foo: 'bar'});
        });
    });

    it('should not block execution if the index cannot be refreshed', () => {
      const error = new Error('Mocked error');

      elasticsearch.client.indices.refresh.rejects(error);
      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return elasticsearch.refreshIndexIfNeeded({index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(kuzzle.log.error).calledOnce();
          should(elasticsearch.client.indices.refresh).be.called();
          should(response).be.eql({ foo: 'bar' });
          return null;
        });
    });
  });

  describe('#indexExists', () => {
    it('should call es indices.exists method', () => {
      elasticsearch.client.indices.exists.resolves(true);

      return elasticsearch.indexExists(request)
        .then(response => {
          should(response).be.true();

          should(elasticsearch.client.indices.exists).be.calledOnce();

          should(elasticsearch.client.indices.exists.firstCall.args[0]).match({
            index: 'test'
          });
        });
    });

    it('should format the error', () => {
      const
        error = new Error('test'),
        spy = sinon.spy(elasticsearch.esWrapper, 'formatESError');

      elasticsearch.client.indices.exists.rejects(error);

      return elasticsearch.indexExists(request)
        .then(() => {
          throw new Error('this should not occur');
        })
        .catch(() => {
          should(spy)
            .be.calledOnce()
            .be.calledWith(error);
        });
    });
  });

  describe('#collectionExists', () => {
    it('should call es indices.existType method', () => {
      elasticsearch.client.indices.existsType.resolves(true);

      return elasticsearch.collectionExists(request)
        .then(() => {
          should(elasticsearch.client.indices.existsType).be.calledOnce();

          should(elasticsearch.client.indices.existsType.firstCall.args[0])
            .match({
              index,
              type: collection
            });
        });
    });

    it('should format errors', () => {
      const
        error = new Error('test'),
        spy = sinon.spy(elasticsearch.esWrapper, 'formatESError');

      elasticsearch.client.indices.existsType.rejects(error);

      return elasticsearch.collectionExists(request)
        .then(() => {
          throw new Error('this should not happen');
        })
        .catch(() => {
          should(spy)
            .be.calledOnce()
            .be.calledWith(error);
        });
    });
  });

  describe('#mcreate', () => {
    const metadata = {
      active: true,
      author: 'test',
      updater: null,
      updatedAt: null,
      deletedAt: null
    };

    it('should prevent creating documents to a non-existing index or collection', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return should(elasticsearch.mcreate(request)).rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return should(elasticsearch.mcreate(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1).'});
    });

    it('should get documents from ES only if there are IDs provided', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 201}}
        ]
      });
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mcreate(request)
        .then(result => {
          should(elasticsearch.client.mget).not.be.called();
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection}},
              {foo: 'bar', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection}},
              {bar: 'foo', _kuzzle_info: metadata}
            ]
          });
          should(result.error).be.an.Array().and.be.empty();
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201},
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[1]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
          should(result.result[1]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });

    it('should filter existing documents depending of their "active" status', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      request.input.body = {
        documents: [
          {_id: 'foo1', body: {foo: 'bar1'}},
          {body: {foo: 'bar_'}},
          {_id: 'foo2', body: {foo: 'bar2'}},
          {_id: 'foo3', body: {foo: 'bar3'}},
          {_id: 'foo4', body: {foo: 'bar4'}}
        ]
      };
      elasticsearch.client.mget.resolves({
        docs: [
          // active document => must be rejected
          {_id: 'foo1', found: true, _source: {_kuzzle_info: {active: true}}},
          // inactive document => can be overwritten
          {_id: 'foo2', found: true, _source: {_kuzzle_info: {active: false}}},
          // non-existent document => can be created
          {_id: 'foo3', found: false},
          // document without metadata => must be considered 'active' and be rejected
          {_id: 'foo4', found: true, _source: {}}
        ]
      });
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo?', status: 201}},
          {index: {_id: 'foo2', status: 201}},
          {index: {_id: 'foo3', status: 201}}
        ]
      });

      return elasticsearch.mcreate(request)
        .then(result => {
          should(elasticsearch.client.mget).calledOnce().and.calledWithMatch({
            index,
            type: collection,
            body: {
              docs: [
                {_id: 'foo1', _source: '_kuzzle_info.active'},
                {_id: 'foo2', _source: '_kuzzle_info.active'},
                {_id: 'foo3', _source: '_kuzzle_info.active'},
                {_id: 'foo4', _source: '_kuzzle_info.active'},
              ]
            }
          });
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection}},
              {foo: 'bar_', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection, _id: 'foo2'}},
              {foo: 'bar2', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection, _id: 'foo3'}},
              {foo: 'bar3', _kuzzle_info: metadata}
            ]
          });
          should(result.error).be.an.Array().and.match([
            {document: {_id: 'foo1', body: {foo: 'bar1'}}, reason: 'document already exists'},
            {document: {_id: 'foo4', body: {foo: 'bar4'}}, reason: 'document already exists'}
          ]);
          should(result.result).match([
            {_id: 'foo?', _source: {foo: 'bar_', _kuzzle_info: metadata}, _meta: metadata, status: 201},
            {_id: 'foo2', _source: {foo: 'bar2', _kuzzle_info: metadata}, _meta: metadata, status: 201},
            {_id: 'foo3', _source: {foo: 'bar3', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          for(let i = 0; i < 3; i++) {
            should(result.result[i]._meta.createdAt).be.approximately(now, 100);
            should(result.result[i]._source._kuzzle_info.createdAt).be.approximately(now, 100);
          }
        });
    });

    it('should correctly separate bulk successes from errors', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 400}}
        ]
      });
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mcreate(request)
        .then(result => {
          should(elasticsearch.client.mget).not.be.called();
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection}},
              {foo: 'bar', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection}},
              {bar: 'foo', _kuzzle_info: metadata}
            ]
          });
          should(result.error).match([
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 400}
          ]);
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });
  });

  describe('#mcreateOrReplace', () => {
    const metadata = {
      active: true,
      author: 'test',
      updater: null,
      updatedAt: null,
      deletedAt: null
    };

    it('should prevent creating/replacing documents to a non-existing index or collection', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return should(elasticsearch.mcreateOrReplace(request)).rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return should(elasticsearch.mcreateOrReplace(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1).'});
    });

    it('should bulk import documents to be created or replaced', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 201}}
        ]
      });
      request.input.body = {documents: [{_id: 'foobar', body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mcreateOrReplace(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection, _id: 'foobar'}},
              {foo: 'bar', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection}},
              {bar: 'foo', _kuzzle_info: metadata}
            ]
          });
          should(result.error).be.an.Array().and.be.empty();
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201},
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[1]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
          should(result.result[1]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });

    it('should not inject kuzzle meta when specified', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 201}}
        ]
      });
      request.input.body = {documents: [{_id: 'foobar', body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mcreateOrReplace(request, false)
        .then(() => {
          const esRequest = elasticsearch.client.bulk.args[0][0];
          should(esRequest.body[1]._kuzzle_info).be.undefined();
          should(esRequest.body[3]._kuzzle_info).be.undefined();
        });
    });

    it('should correctly separate bulk successes from errors', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 400}}
        ]
      });
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mcreateOrReplace(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection}},
              {foo: 'bar', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection}},
              {bar: 'foo', _kuzzle_info: metadata}
            ]
          });
          should(result.error).match([
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 400}
          ]);
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });
  });

  describe('#mupdate', () => {
    const metadata = {
      active: true,
      updater: 'test',
      deletedAt: null
    };

    it('should prevent updating documents to a non-existing index or collection', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      request.input.body = {
        documents: [
          {_id: 'foo', body: {foo: 'bar'}},
          {_id: 'bar', body: {bar: 'foo'}}
        ]
      };

      return should(elasticsearch.mupdate(request))
        .rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {
        documents: [
          {_id: 'foo', body: {foo: 'bar'}},
          {_id: 'bar', body: {bar: 'foo'}}
        ]
      };

      return should(elasticsearch.mupdate(request)).rejectedWith(
        SizeLimitError,
        {message: 'Number of documents exceeds the server configured value (1).'});
    });

    it('should bulk import documents to be updated', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {
            index: {
              _id: 'foo',
              status: 201,
              get: {
                _source: {foo: 'bar', leftalone: true, _kuzzle_info: metadata}
              }
            }
          },
          {
            index: {
              _id: 'bar',
              status: 201,
              get: {
                _source: {bar: 'foo', leftalone: true, _kuzzle_info: metadata}
              }
            }
          }
        ]
      });
      request.input.body = {
        documents: [
          {_id: 'foo', body: {foo: 'bar'}},
          {_id: 'bar', body: {bar: 'foo'}}
        ]
      };

      return elasticsearch.mupdate(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {update: {_index: index, _type: collection, _id: 'foo'}},
              {doc: {foo: 'bar', _kuzzle_info: metadata}, _source: true},
              {update: {_index: index, _type: collection, _id: 'bar'}},
              {doc: {bar: 'foo', _kuzzle_info: metadata}, _source: true}
            ]
          });
          should(result.error).be.an.Array().and.be.empty();
          should(result.result).match([
            {
              _id: 'foo',
              _source: {foo: 'bar', leftalone: true, _kuzzle_info: metadata},
              _meta: metadata,
              status: 201
            },
            {
              _id: 'bar',
              _source: {bar: 'foo', leftalone: true, _kuzzle_info: metadata},
              _meta: metadata,
              status: 201
            }
          ]);

          should(result.result[0]._meta.updatedAt).be.approximately(now, 100);
          should(result.result[1]._meta.updatedAt).be.approximately(now, 100);
        });
    });

    it('should correctly separate bulk successes from errors', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 400}}
        ]
      });
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return elasticsearch.mupdate(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {update: {_index: index, _type: collection, _id: 'foo'}},
              {doc: {foo: 'bar', _kuzzle_info: metadata}, _source: true},
              {update: {_index: index, _type: collection, _id: 'bar'}},
              {doc: {bar: 'foo', _kuzzle_info: metadata}, _source: true}
            ]
          });
          should(result.error).match([
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 400}
          ]);
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._source._kuzzle_info.updatedAt).be.approximately(now, 100);
        });
    });

    it('should reject documents without an ID', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mupdate(request)
        .then(result => {
          should(elasticsearch.client.bulk).not.be.called();
          should(result.error).match([
            {document: {_source: {foo: 'bar'}}, reason: 'a document ID is required'},
            {document: {_source: {bar: 'foo'}}, reason: 'a document ID is required'}
          ]);
          should(result.result).be.an.Array().and.be.empty();
        });
    });
  });

  describe('#mreplace', () => {
    const metadata = {
      active: true,
      author: 'test',
      updater: null,
      updatedAt: null,
      deletedAt: null
    };

    it('should prevent replacing documents to a non-existing index or collection', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      elasticsearch.client.mget.resolves({docs: [{found: true}, {found: true}]});
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return should(elasticsearch.mreplace(request)).rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.mget.resolves({docs: [{found: true}, {found: true}]});
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return should(elasticsearch.mreplace(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1).'});
    });

    it('should reject documents that are not found', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      request.input.body = {
        documents: [
          {_id: 'foo1', body: {foo: 'bar1'}},
          {_id: 'foo2', body: {foo: 'bar2'}},
        ]
      };
      elasticsearch.client.mget.resolves({
        docs: [
          {_id: 'foo1', found: false},
          {_id: 'foo2', found: true, _source: {_kuzzle_info: {active: false}}}
        ]
      });
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo2', status: 201}}
        ]
      });

      return elasticsearch.mreplace(request)
        .then(result => {
          should(elasticsearch.client.mget).calledOnce().and.calledWithMatch({
            index,
            type: collection,
            body: {
              docs: [
                {_id: 'foo1', _source: '_kuzzle_info.active'},
                {_id: 'foo2', _source: '_kuzzle_info.active'}
              ]
            }
          });
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection, _id: 'foo2'}},
              {foo: 'bar2', _kuzzle_info: metadata}
            ]
          });
          should(result.error).be.an.Array().and.match([
            {document: {_id: 'foo1', _source: {foo: 'bar1'}}, reason: 'cannot replace a non-existing document (use mCreateOrReplace if you need to create non-existing documents)'},
          ]);
          should(result.result).match([
            {_id: 'foo2', _source: {foo: 'bar2', _kuzzle_info: metadata}, _meta: metadata, status: 201},
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });

    it('should correctly separate bulk successes from errors', () => {
      const now = Date.now();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 400}}
        ]
      });
      elasticsearch.client.mget.resolves({
        docs: [
          {_id: 'foo', found: true, _source: {_kuzzle_info: {active: true}}},
          {_id: 'bar', found: true, _source: {_kuzzle_info: {active: false}}}
        ]
      });
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return elasticsearch.mreplace(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {index: {_index: index, _type: collection, _id: 'foo'}},
              {foo: 'bar', _kuzzle_info: metadata},
              {index: {_index: index, _type: collection, _id: 'bar'}},
              {bar: 'foo', _kuzzle_info: metadata}
            ]
          });
          should(result.error).match([
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 400}
          ]);
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.createdAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.createdAt).be.approximately(now, 100);
        });
    });

    it('should reject documents without an ID', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      request.input.body = {documents: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mreplace(request)
        .then(result => {
          should(elasticsearch.client.bulk).not.be.called();
          should(result.error).match([
            {document: {_source: {foo: 'bar'}}, reason: 'a document ID is required'},
            {document: {_source: {bar: 'foo'}}, reason: 'a document ID is required'}
          ]);
          should(result.result).be.an.Array().and.be.empty();
        });
    });
  });

  describe('#mdelete', () => {
    const metadata = {
      active: false,
      updater: 'test'
    };

    it('should prevent deleting documents in a non-existing index or collection', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      request.input.body = {ids: ['foo', 'bar']};

      return should(elasticsearch.mdelete(request)).rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {ids: ['foo', 'bar']};

      return should(elasticsearch.mdelete(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1).'});
    });

    it('should correctly separate bulk successes from errors', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.bulk.resolves({
        took: 30,
        errors: false,
        items: [
          {index: {_id: 'foo', status: 201}},
          {index: {_id: 'bar', status: 400}}
        ]
      });
      request.input.body = {ids: ['foo', 'bar']};

      return elasticsearch.mdelete(request)
        .then(result => {
          should(elasticsearch.client.bulk.args[0][0]).match({
            index,
            type: collection,
            body: [
              {update: {_index: index, _type: collection, _id: 'foo'}},
              {doc: {_kuzzle_info: metadata}},
              {update: {_index: index, _type: collection, _id: 'bar'}},
              {doc: {_kuzzle_info: metadata}}
            ]
          });
          should(result.error).match([{_id: 'bar', status: 400}]);
          should(result.result).match(['foo']);
        });
    });

    it('should reject non-string IDs', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      request.input.body = {ids: [{body: {foo: 'bar'}}, {body: {bar: 'foo'}}]};

      return elasticsearch.mdelete(request)
        .then(result => {
          should(elasticsearch.client.bulk).not.be.called();
          should(result.error).match([
            {id: {body: {foo: 'bar'}}, reason: 'the document ID must be a string'},
            {id: {body: {bar: 'foo'}}, reason: 'the document ID must be a string'}
          ]);
          should(result.result).be.an.Array().and.be.empty();
        });
    });
  });

  describe('#_checkMapping', () => {
    it('should throw when a property is incorrect', () => {
      const
        mapping2 = {
          type: 'nested',
          properties: {}
        },
        mapping = {
          properties: {},
          dinamic: 'false'
        };


      should(() => elasticsearch._checkMapping(mapping))
        .throw({ message: 'Incorrect mapping property "mapping.dinamic". Did you mean "dynamic" ?' });

      should(() => elasticsearch._checkMapping(mapping2))
        .throw({ message: 'Incorrect mapping property "mapping.type".' });
    });

    it('should throw when a nested property is incorrect', () => {
      const mapping = {
        dynamic: 'false',
        properties: {
          name: { type: 'keyword' },
          car: {
            dinamic: 'false',
            properties: {
              brand: { type: 'keyword' }
            }
          }
        }
      };

      should(() => elasticsearch._checkMapping(mapping))
        .throw({ message: 'Incorrect mapping property "mapping.properties.car.dinamic". Did you mean "dynamic" ?' });
    });

    it('should return null if no properties are incorrect', () => {
      const mapping = {
        dynamic: 'false',
        properties: {
          name: { type: 'keyword' },
          car: {
            dynamic: 'false',
            type: 'nested',
            properties: {
              brand: { type: 'keyword' }
            }
          }
        }
      };

      should(() => elasticsearch._checkMapping(mapping))
        .not.throw();
    });
  });
});
