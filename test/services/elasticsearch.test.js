'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  ms = require('ms'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  ESClientMock = require('../mocks/services/elasticsearchClient.mock'),
  ES = require('../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', () => {
  let
    kuzzle,
    index,
    collection,
    esIndexName,
    elasticsearch,
    timestamp,
    esClientError,
    dateNow = Date.now;

  beforeEach(async () => {
    kuzzle = new KuzzleMock();

    index = 'nyc-open-data';
    collection = 'yellow-taxi';
    esIndexName = '&nyc-open-data.yellow-taxi';
    timestamp = Date.now();

    esClientError = new Error('es client fail');

    ES.buildClient = () => new ESClientMock();
    elasticsearch = new ES(kuzzle, kuzzle.config.services.storageEngine);

    await elasticsearch.init();

    // eslint-disable-next-line require-atomic-updates
    elasticsearch._esWrapper.reject = sinon.spy((error) => Promise.reject(error));

    Date.now = () => timestamp;
  });

  afterEach(() => {
    Date.now = dateNow;
  });

  describe('#constructor', () => {
    it('should initialize properties', () => {
      const esPublic = new ES(kuzzle, kuzzle.config.services.storageEngine);
      const esInternal = new ES(
        kuzzle,
        kuzzle.config.services.storageEngine,
        'internal');

      should(esPublic._kuzzle).be.exactly(kuzzle);
      should(esPublic.config).be.exactly(kuzzle.config.services.storageEngine);
      should(esPublic._indexPrefix).be.eql('&');
      should(esInternal._indexPrefix).be.eql('%');
    });
  });

  describe('#init', () => {
    it('should initialize properly', () => {
      elasticsearch = new ES(kuzzle, kuzzle.config.services.storageEngine);
      elasticsearch._buildClient = () => new ESClientMock();

      const promise = elasticsearch.init();

      return should(promise).be.fulfilledWith()
        .then(() => {
          should(elasticsearch._client).not.be.null();
          should(elasticsearch._esWrapper).not.be.null();
          should(elasticsearch.esVersion).not.be.null();
        });
    });
  });

  describe('#scroll', () => {
    it('should be able to scroll an old search', () => {
      elasticsearch._client.scroll.resolves({
        body: {
          hits: { hits: [], total: { value: 0 } },
          _scroll_id: 'azerty'
        }
      });

      const promise = elasticsearch.scroll('i-am-scroll-id', { scrollTTL: '10s' });

      return promise
        .then(result => {
          should(kuzzle.cacheEngine.internal.exists).be.called();
          should(kuzzle.cacheEngine.internal.pexpire).be.called();
          should(elasticsearch._client.scroll.firstCall.args[0]).be.deepEqual({
            scrollId: 'i-am-scroll-id',
            scroll: '10s'
          });
          should(result).be.deepEqual({
            total: 0,
            hits: [],
            scrollId: 'azerty',
            aggregations: undefined
          });
        });
    });

    it('should return a rejected promise if a scroll fails', () => {
      elasticsearch._client.scroll.rejects(esClientError);

      const promise = elasticsearch.scroll('i-am-scroll-id');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });

    it('should rejects if the scrollId does not exists in Kuzzle cache', () => {
      kuzzle.cacheEngine.internal.exists.resolves(0);

      const promise = elasticsearch.scroll('i-am-scroll-id');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWithMatch({
            id: 'services.storage.unknown_scroll_id'
          });
          should(kuzzle.cacheEngine.internal.pexpire).not.be.called();
          should(elasticsearch._client.scroll).not.be.called();
        });
    });
  });

  describe('#search', () => {
    let filter;

    beforeEach(() => {
      filter = { };
    });

    it('should be able to search documents', () => {
      elasticsearch._client.search.resolves({
        body: {
          hits: {
            hits: [ { _id: 'liia', _source: { city: 'Kathmandu' }, highlight: 'highlight', other: 'thing' } ],
            total: { value: 1 },
          },
          body: filter,
          aggregations: { some: 'aggregs' },
          _scroll_id: 'i-am-scroll-id'
        }
      });

      const promise = elasticsearch.search(index, collection, filter);

      return promise
        .then(result => {
          should(elasticsearch._client.search.firstCall.args[0]).match({
            index: esIndexName,
            body: { query: { match_all: {} } },
            from: undefined,
            size: undefined,
            scroll: undefined
          });

          should(kuzzle.cacheEngine.internal.psetex.firstCall.args[1])
            .be.eql(ms(elasticsearch.config.defaults.scrollTTL));

          should(result).match({
            scrollId: 'i-am-scroll-id',
            hits: [ { _id: 'liia', _source: { city: 'Kathmandu' }, highlight: 'highlight' } ],
            total: 1,
            aggregations: { some: 'aggregs' }
          });
        });
    });

    it('should be able to search with from/size and scroll arguments', () => {
      elasticsearch._client.search.resolves({
        body: {
          hits: { hits: [], total: { value: 0 } },
          _scroll_id: 'i-am-scroll-id'
        }
      });

      const promise = elasticsearch.search(
        index,
        collection,
        filter,
        { from: 0, size: 1, scroll: '30s' });

      return promise
        .then(() => {
          should(elasticsearch._client.search.firstCall.args[0]).match({
            index: esIndexName,
            body: filter,
            from: 0,
            size: 1,
            scroll: '30s'
          });
          should(kuzzle.cacheEngine.internal.psetex.firstCall.args[1])
            .be.eql(ms('30s'));
        });
    });

    it('should return a rejected promise if a search fails', () => {
      elasticsearch._client.search.rejects(esClientError);

      const promise = elasticsearch.search(index, collection, filter);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });

    it('should not save the scrollId in the cache if not present in response', () => {
      elasticsearch._client.search.resolves({
        body: {
          hits: { hits: [], total: { value: 0 } }
        }
      });

      const promise = elasticsearch.search(index, collection, {});

      return promise
        .then(() => {
          should(kuzzle.cacheEngine.internal.psetex).not.be.called();
        });
    });
  });

  describe('#get', () => {
    it('should allow getting a single document', () => {
      elasticsearch._client.get.resolves({
        body: {
          _id: 'liia',
          _source: { city: 'Kathmandu' },
          _version: 1
        }
      });

      const promise = elasticsearch.get(index, collection, 'liia');

      return promise
        .then(result => {
          should(elasticsearch._client.get).be.calledWithMatch({
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
      const promise = elasticsearch.get(index, collection, '_search');

      return should(promise).be.rejectedWith({
        id: 'services.storage.search_as_an_id'
      });
    });

    it('should return a rejected promise if a get fails', () => {
      elasticsearch._client.get.rejects(esClientError);

      const promise = elasticsearch.get(index, collection, 'liia');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#mGet', () => {
    it('should allow getting multiples documents', () => {
      elasticsearch._client.mget.resolves({
        body: {
          docs: [
            { _id: 'liia', found: true, _source: { city: 'Kathmandu' }, _version: 1 },
            { _id: 'mhery', found: false }
          ]
        }
      });

      const promise = elasticsearch.mGet(index, collection, ['liia', 'mhery']);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            body: {
              docs: [
                { _id: 'liia', _index: esIndexName },
                { _id: 'mhery', _index: esIndexName },
              ]
            }
          });

          should(result).match({
            items: [ { _id: 'liia', _source: { city: 'Kathmandu' }, _version: 1 } ],
            errors: [ 'mhery' ]
          });
        });
    });

    it('should return a rejected promise if client.mget fails', () => {
      elasticsearch._client.mget.rejects(esClientError);

      const promise = elasticsearch.mGet(index, collection, ['liia']);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#count', () => {
    it('should allow counting documents using a provided filter', () => {
      const filter = {
        query: {
          match_all: {}
        }
      };
      elasticsearch._client.count.resolves({
        body: {
          count: 42
        }
      });

      const promise = elasticsearch.count(index, collection, filter);

      return promise
        .then(result => {
          should(elasticsearch._client.count).be.calledWithMatch({
            index: esIndexName,
            body: filter
          });

          should(result).be.eql(42);
        });
    });

    it('should return a rejected promise if count fails', () => {
      elasticsearch._client.count.rejects(esClientError);

      const promise = elasticsearch.count(index, collection);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#create', () => {
    beforeEach(() => {
      elasticsearch.exists = sinon.stub().resolves(false);
    });

    it('should allow creating document an ID is provided', () => {
      elasticsearch._client.index.resolves({
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
          should(elasticsearch.exists).be.calledWith(index, collection, 'liia');
          should(elasticsearch._client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: 'aschen',
                createdAt: timestamp
              }
            },
            id: 'liia',
            refresh: 'wait_for'
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: { city: 'Kathmandu' }
          });
        });
    });

    it('should create a document when no ID is provided', () => {
      elasticsearch._client.index.resolves({
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
          should(elasticsearch.exists).not.be.called();
          should(elasticsearch._client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Panipokari',
              _kuzzle_info: {
                author: null
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
  });

  describe('#createOrReplace', () => {
    beforeEach(() => {
      elasticsearch._client.index.resolves({
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
          should(elasticsearch._client.index).be.calledWithMatch({
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
          should(elasticsearch._client.index).be.calledWithMatch({
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
      elasticsearch._client.index.rejects(esClientError);

      const promise = elasticsearch.createOrReplace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#update', () => {
    beforeEach(() => {
      elasticsearch._client.update.resolves({
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
          should(elasticsearch._client.update).be.calledWithMatch({
            index: esIndexName,
            body: {
              doc: {
                city: 'Panipokari',
                _kuzzle_info: {
                  updatedAt: timestamp,
                  updater: null
                }
              }
            },
            id: 'liia',
            refresh: undefined,
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
          should(elasticsearch._client.update).be.calledWithMatch({
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

    it('should return a rejected promise if client.update fails', () => {
      elasticsearch._client.update.rejects(esClientError);

      const promise = elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#replace', () => {
    beforeEach(() => {
      elasticsearch._client.index.resolves({
        body: {
          _id: 'liia',
          _version: 1,
          _source: { city: 'Kathmandu' }
        }
      });
      elasticsearch._client.exists.resolves({ body: true });
    });

    it('should support replace capability', () => {
      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return promise
        .then(result => {
          should(elasticsearch._client.index).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            body: {
              city: 'Kathmandu',
              _kuzzle_info: {
                author: null,
                createdAt: timestamp,
                updatedAt: timestamp,
                updater: null
              }
            },
            refresh: undefined
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
          should(elasticsearch._client.index).be.calledWithMatch({
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
      elasticsearch._client.exists.resolves({ body: false });

      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWithMatch({
            id: 'services.storage.not_found'
          });
          should(elasticsearch._client.index).not.be.called();
        });
    });

    it('should return a rejected promise if client.index fails', () => {
      elasticsearch._client.index.rejects(esClientError);

      const promise = elasticsearch.replace(
        index,
        collection,
        'liia',
        { city: 'Kathmandu' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#delete', () => {
    beforeEach(() => {
      elasticsearch._client.delete.resolves({
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
          should(elasticsearch._client.delete).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            refresh: undefined
          });

          should(result).be.null();
        });
    });

    it('should allow additional options', () => {
      const promise = elasticsearch.delete(
        index,
        collection,
        'liia',
        { refresh: 'wait_for' });

      return promise
        .then(result => {
          should(elasticsearch._client.delete).be.calledWithMatch({
            index: esIndexName,
            id: 'liia',
            refresh: 'wait_for'
          });

          should(result).be.null();
        });
    });

    it('should return a rejected promise if client.delete fails', () => {
      elasticsearch._client.delete.rejects(esClientError);

      const promise = elasticsearch.delete(
        index,
        collection,
        'liia');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#deleteByQuery', () => {
    beforeEach(() => {
      elasticsearch._getAllDocumentsFromQuery = sinon.stub().resolves([
        { _id: '_id1', _source: '_source1' },
        { _id: '_id2', _source: '_source2' },
      ]);

      elasticsearch._client.indices.refresh.resolves({
        body: { _shards: 1 }
      });

      elasticsearch._client.deleteByQuery.resolves({
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
          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { filter: 'term' } },
            scroll: '5s',
            from: undefined,
            size: undefined,
            refresh: undefined
          });

          should(result).match({
            documents: [
              { _id: '_id1', _source: '_source1' },
              { _id: '_id2', _source: '_source2' },
            ],
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
          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { filter: 'term' } },
            from: 1,
            size: 3,
            refresh: true
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
      elasticsearch._client.deleteByQuery.rejects(esClientError);

      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });

    it('should reject if the query is empty', () => {
      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        'not an object');

      return should(promise).be.rejectedWith({
        id: 'services.storage.missing_argument'
      });
    });
  });

  describe('#createIndex', () => {
    beforeEach(() => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: esIndexName }, { index: '%nepali.liia' }
        ]
      });
    });

    it('should resolve and create a hidden collection if the index does not exist', async () => {
      await elasticsearch.createIndex('lfiduras');

      should(elasticsearch._client.indices.create).be.calledWithMatch({
        index: '&lfiduras._kuzzle_keep',
        body: {}
      });
    });

    it('should rejects if the index already exists', () => {
      const promise = elasticsearch.createIndex('nepali');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWithMatch({
            id: 'services.storage.index_already_exists'
          });
        });
    });

    it('should return a rejected promise if client.cat.indices fails', () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      const promise = elasticsearch.createIndex(
        index,
        collection,
        { filter: 'term' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#createCollection', () => {
    let _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch._checkMappings;

      elasticsearch.collectionExists = sinon.stub().resolves(false);
      elasticsearch._client.indices.create.resolves({});
      elasticsearch._checkMappings = sinon.stub().resolves();
    });

    it('should allow creating a new collection and inject commonMappings', () => {
      const
        mappings = { properties: { city: { type: 'keyword' } } },
        promise = elasticsearch.createCollection(
          index,
          collection,
          mappings
        );

      return promise
        .then(result => {
          should(elasticsearch.collectionExists).be.calledWith(index, collection);
          should(elasticsearch._checkMappings).be.calledWithMatch({
            properties: mappings.properties
          });
          should(elasticsearch._client.indices.create).be.calledWithMatch({
            index: esIndexName,
            body: {
              mappings: {
                dynamic: elasticsearch.config.commonMapping.dynamic,
                _meta: elasticsearch.config.commonMapping._meta,
                properties: mappings.properties
              }
            }
          });

          should(result).be.null();
        });
    });

    it('should allow to set dynamic and _meta fields', () => {
      const
        mappings = { dynamic: 'true', _meta: { some: 'meta' } },
        promise = elasticsearch.createCollection(
          index,
          collection,
          mappings
        );

      return promise
        .then(result => {
          should(elasticsearch._client.indices.create).be.calledWithMatch({
            index: esIndexName,
            body: {
              mappings: {
                dynamic: 'true',
                _meta: { some: 'meta' },
                properties: elasticsearch.config.commonMapping.properties
              }
            }
          });

          should(result).be.null();
        });
    });

    it('should return a rejected promise if client.indices.create fails', () => {
      elasticsearch._client.indices.create.rejects(esClientError);

      const promise = elasticsearch.createCollection(
        index,
        collection,
        { properties: { city: { type: 'keyword' } } });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
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
        id: 'services.storage.invalid_mapping'
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
        dynamic: 'false',
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
            esReq = elasticsearch._client.indices.create.firstCall.args[0],
            expectedMapping = {
              _meta: undefined,
              dynamic: 'false',
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
      elasticsearch._client.indices.getMapping.resolves({
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

      elasticsearch._esWrapper.getMapping = sinon.stub().resolves({foo: 'bar'});
    });

    it('should have getMapping capabilities', () => {
      const promise = elasticsearch.getMapping(index, collection);

      return promise
        .then(result => {
          should(elasticsearch._client.indices.getMapping).be.calledWithMatch({
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
          should(elasticsearch._client.indices.getMapping).be.calledWithMatch({
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

    it('should return a rejected promise if client.cat.indices fails', () => {
      elasticsearch._client.indices.getMapping.rejects(esClientError);

      const promise = elasticsearch.getMapping(index, collection);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
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
      elasticsearch._client.indices.putMapping.resolves({});
      elasticsearch._checkMappings = sinon.stub().resolves();
    });

    it('should have mapping capabilities', () => {
      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return promise
        .then(result => {
          should(elasticsearch._client.indices.putMapping).be.calledWithMatch({
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

      return should(elasticsearch.updateMapping(index, collection, newMapping))
        .be.rejectedWith({
          message: 'Invalid mapping property "mapping.dinamic". Did you mean "dynamic" ?',
          id: 'services.storage.invalid_mapping'
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
          should(elasticsearch._client.indices.putMapping).be.calledWithMatch({
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

    it('should return a rejected promise if client.cat.indices fails', () => {
      elasticsearch._client.indices.putMapping.rejects(esClientError);

      const promise = elasticsearch.updateMapping(index, collection, newMapping);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#truncateCollection', () => {
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
          should(elasticsearch._client.indices.delete).be.calledWithMatch({
            index: esIndexName
          });
          should(elasticsearch._client.indices.create).be.calledWithMatch({
            index: esIndexName,
            body: {
              mappings: {
                dynamic: 'false',
                properties: {
                  name: { type: 'keyword' }
                }
              }
            }
          });

          should(result).be.null();
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.indices.delete.rejects(esClientError);

      const promise = elasticsearch.truncateCollection(index, collection);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#import', () => {
    let
      getExpectedEsRequest,
      bulkReturnError,
      documents,
      bulkReturn;

    beforeEach(() => {
      getExpectedEsRequest = ({ userId=null, refresh, timeout } = {}) => ({
        body: [
          { index: { _id: 1, _index: esIndexName } },
          {
            firstName: 'foo',
            _kuzzle_info: {
              author: userId,
              createdAt: timestamp,
              updater: null,
              updatedAt: null
            }
          },

          { index: { _id: 2, _index: esIndexName } },
          {
            firstName: 'bar',
            _kuzzle_info: {
              author: userId,
              createdAt: timestamp,
              updater: null,
              updatedAt: null
            }
          },

          { update: { _id: 3, _index: esIndexName } },
          {
            doc: {
              firstName: 'foobar',
              _kuzzle_info: {
                updater: userId,
                updatedAt: timestamp
              }
            }
          },

          { delete: { _id: 4, _index: esIndexName } }
        ],
        refresh,
        timeout
      });

      bulkReturn = {
        body: {
          items: [
            { index: { status: 201, _id: 1, toto: 42 } },
            { index: { status: 201, _id: 2, toto: 42 } },
            { update: { status: 200, _id: 3, toto: 42 } },
            { delete: { status: 200, _id: 4, toto: 42 } }
          ],
          errors: false
        }
      };

      bulkReturnError = {
        body: {
          items: [
            { index: { status: 201, _id: 1, toto: 42 } },
            { index: { status: 201, _id: 2, toto: 42 } },
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

        { update: { _id: 3 } },
        { doc: { firstName: 'foobar' } },

        { delete: { _id: 4 } }
      ];

      elasticsearch._client.bulk.resolves(bulkReturn);
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
          should(elasticsearch._client.bulk).be.calledWithMatch(
            getExpectedEsRequest());

          should(result).match({
            items: [
              { index: { status: 201, _id: 1 } },
              { index: { status: 201, _id: 2 } },
              { update: { status: 200, _id: 3 } },
              { delete: { status: 200, _id: 4 } },
            ],
            errors: []
          });
        });
    });

    it('should inject additional options to esRequest', () => {
      const promise = elasticsearch.import(
        index,
        collection,
        documents,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(() => {
          should(elasticsearch._client.bulk).be.calledWithMatch(
            getExpectedEsRequest({ refresh: 'wait_for', timeout: '10m', userId: 'aschen' }));
        });
    });

    it('should populate "errors" array for bulk data import with some errors', () => {
      elasticsearch._client.bulk.resolves(bulkReturnError);

      const promise = elasticsearch.import(index, collection, documents);

      return promise
        .then(result => {
          should(result).match({
            items: [
              { index: { status: 201, _id: 1 } },
              { index: { status: 201, _id: 2 } },
            ],
            errors: [
              { update: { status: 404, _id: 42, error: { type: 'not_found', reason: 'not found' } } },
              { delete: { status: 404, _id: 21, error: { type: 'not_found', reason: 'not found' } } }
            ]
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.bulk.rejects(esClientError);

      const promise = elasticsearch.import(index, collection, documents);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch.import(
        index,
        collection,
        [
          { index: { _id: 1, _index: esIndexName } },
          { body: { foo: 'bar' } },
          { delete: { _id: 2, _index: esIndexName } }
        ]);


      return should(promise).be.rejectedWith({
        id: 'services.storage.write_limit_exceeded'
      });
    });
  });

  describe('#listCollections', () => {
    beforeEach(() => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&nyc-open-data.taxi' },
          { index: '&nepali._kuzzle_keep' }
        ]
      });
    });

    it('should allow listing all available collections', () => {
      const promise = elasticsearch.listCollections('nepali');

      return promise
        .then(result => {
          should(result).match(['mehry', 'liia']);
        });
    });

    it('should not list unauthorized collections', () => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: '%nepali.mehry' },
          { index: '%nepali.liia' },
          { index: '%nyc-open-data.taxi' }
        ]
      });

      const promise = elasticsearch.listCollections('nepali');

      return promise
        .then(result => {
          should(result).match([]);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      const promise = elasticsearch.listCollections(index);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#listIndexes', () => {
    beforeEach(() => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow listing all available indexes', () => {
      const promise = elasticsearch.listIndexes();

      return promise
        .then(result => {
          should(elasticsearch._client.cat.indices).be.calledWithMatch({
            format: 'json'
          });

          should(result).match(['nepali', 'nyc-open-data']);
        });
    });

    it('should not list unauthorized indexes', () => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: '%nepali.mehry' },
          { index: '%nepali.liia' },
          { index: '%nyc-open-data.taxi' },
          { index: '&vietnam.lfiduras' }
        ]
      });

      const promise = elasticsearch.listIndexes();

      return promise
        .then(result => {
          should(result).match(['vietnam']);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      const promise = elasticsearch.listIndexes();

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#listAliases', () => {
    beforeEach(() => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { alias: 'alias-mehry', index: '&nepali.mehry' },
          { alias: 'alias-liia', index: '&nepali.liia' },
          { alias: 'alias-taxi', index: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow listing all available aliases', () => {
      const promise = elasticsearch.listAliases();

      return promise
        .then(result => {
          should(elasticsearch._client.cat.aliases).be.calledWithMatch({
            format: 'json'
          });

          should(result).match([
            { name: 'alias-mehry', index: 'nepali', collection: 'mehry' },
            { name: 'alias-liia', index: 'nepali', collection: 'liia' },
            { name: 'alias-taxi', index: 'nyc-open-data', collection: 'taxi' },
          ]);
        });
    });

    it('should not list unauthorized aliases', () => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { alias: 'alias-mehry', index: '%nepali.mehry' },
          { alias: 'alias-liia', index: '%nepali.liia' },
          { alias: 'alias-taxi', index: '%nyc-open-data.taxi' },
          { alias: 'alias-lfiduras', index: '&vietnam.lfiduras' }
        ]
      });

      const promise = elasticsearch.listAliases();

      return promise
        .then(result => {
          should(result).match([
            { name: 'alias-lfiduras', index: 'vietnam', collection: 'lfiduras' },
          ]);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.cat.aliases.rejects(esClientError);

      const promise = elasticsearch.listAliases();

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#listAliases', () => {
    beforeEach(() => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { alias: 'alias-mehry', index: '&nepali.mehry' },
          { alias: 'alias-liia', index: '&nepali.liia' },
          { alias: 'alias-taxi', index: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow listing all available aliases', () => {
      const promise = elasticsearch.listAliases();

      return promise
        .then(result => {
          should(elasticsearch._client.cat.aliases).be.calledWithMatch({
            format: 'json'
          });

          should(result).match([
            { name: 'alias-mehry', index: 'nepali', collection: 'mehry' },
            { name: 'alias-liia', index: 'nepali', collection: 'liia' },
            { name: 'alias-taxi', index: 'nyc-open-data', collection: 'taxi' },
          ]);
        });
    });

    it('should not list unauthorized aliases', () => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { alias: 'alias-mehry', index: '%nepali.mehry' },
          { alias: 'alias-liia', index: '%nepali.liia' },
          { alias: 'alias-taxi', index: '%nyc-open-data.taxi' },
          { alias: 'alias-lfiduras', index: '&vietnam.lfiduras' }
        ]
      });

      const promise = elasticsearch.listAliases();

      return promise
        .then(result => {
          should(result).match([
            { name: 'alias-lfiduras', index: 'vietnam', collection: 'lfiduras' },
          ]);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.cat.aliases.rejects(esClientError);

      const promise = elasticsearch.listAliases();

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#deleteIndexes', () => {
    beforeEach(() => {
      elasticsearch._client.cat.indices.resolves({
        body: [
          { index: '&nepali.mehry' },
          { index: '&nepali.liia' },
          { index: '&do-not.delete' },
          { index: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow to deletes multiple indexes', () => {
      const promise = elasticsearch.deleteIndexes(['nepali', 'nyc-open-data']);

      return promise
        .then(result => {
          should(elasticsearch._client.indices.delete).be.calledWithMatch({
            index: ['&nepali.mehry', '&nepali.liia', '&nyc-open-data.taxi']
          });

          should(result).match(['nepali', 'nyc-open-data']);
        });
    });

    it('should not delete unauthorized indexes', () => {
      elasticsearch._client.cat.indices.resolves({
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
          should(elasticsearch._client.indices.delete).be.calledWithMatch({
            index: ['&nepali.mehry', '&nepali.liia']
          });

          should(result).match(['nepali']);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      const promise = elasticsearch.listIndexes();

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should call deleteIndexes', () => {
      elasticsearch.deleteIndexes = sinon.stub().resolves();

      const promise = elasticsearch.deleteIndex('nepali');

      return promise
        .then(result => {
          should(elasticsearch.deleteIndexes).be.calledWith(['nepali']);

          should(result).be.null();
        });
    });
  });

  describe('#deleteCollection', () => {
    it('should allow to delete a collection', () => {
      const promise = elasticsearch.deleteCollection('nepali', 'liia');

      return promise
        .then(result => {
          should(elasticsearch._client.indices.delete).be.calledWithMatch({
            index: '&nepali.liia'
          });

          should(result).be.null();
        });
    });
  });

  describe('#refreshCollection', () => {
    it('should send a valid request to es client', () => {
      elasticsearch._client.indices.refresh.resolves({
        body: { _shards: 'shards' }
      });

      const promise = elasticsearch.refreshCollection(index, collection);

      return promise
        .then(result => {
          should(elasticsearch._client.indices.refresh).be.calledWithMatch({
            index: esIndexName
          });

          should(result).match({
            _shards: 'shards'
          });
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.indices.refresh.rejects(esClientError);

      const promise = elasticsearch.refreshCollection(index, collection);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#exists', () => {
    it('should have document exists capability', () => {
      elasticsearch._client.exists.resolves({
        body: true
      });

      const promise = elasticsearch.exists(index, collection, 'liia');

      return promise
        .then(result => {
          should(elasticsearch._client.exists).be.calledWithMatch({
            index: esIndexName,
            id: 'liia'
          });

          should(result).be.eql(true);
        });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.exists.rejects(esClientError);

      const promise = elasticsearch.exists(index, collection, 'liia');

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });
  });

  describe('#indexExists', () => {
    it('should call list indexes and return true if index exists', () => {
      elasticsearch.listIndexes = sinon.stub().resolves(
        ['nepali', 'nyc-open-data']);

      const promise = elasticsearch.indexExists('nepali');

      return promise
        .then(result => {
          should(elasticsearch.listIndexes).be.called();

          should(result).be.eql(true);
        });
    });

    it('should call list indexes and return false if index does not exists', () => {
      elasticsearch.listIndexes = sinon.stub().resolves(
        ['nepali', 'nyc-open-data']);

      const promise = elasticsearch.indexExists('vietnam');

      return promise
        .then(result => {
          should(elasticsearch.listIndexes).be.called();

          should(result).be.eql(false);
        });
    });
  });

  describe('#collectionExists', () => {
    it('should call list collections and return true if collection exists', () => {
      elasticsearch.listCollections = sinon.stub().resolves(['liia', 'mehry']);

      const promise = elasticsearch.collectionExists('nepali', 'liia');

      return promise
        .then(result => {
          should(elasticsearch.listCollections).be.called();

          should(result).be.eql(true);
        });
    });

    it('should call list collections and return false if collection does not exists', () => {
      elasticsearch.listCollections = sinon.stub().resolves(['liia', 'mehry']);

      const promise = elasticsearch.collectionExists('nepali', 'lfiduras');

      return promise
        .then(result => {
          should(elasticsearch.listCollections).be.called();

          should(result).be.eql(false);
        });
    });
  });

  describe('#mCreate', () => {
    let
      kuzzleMeta,
      mExecuteResult,
      documentsWithIds,
      documentsWithoutIds;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null
        }
      };

      documentsWithIds = [
        { body: { city: 'Kathmandu' } },
        { _id: 'liia', body: { city: 'Ho Chi Minh City' } }
      ];

      documentsWithoutIds = [
        { body: { city: 'Kathmandu' } },
        { body: { city: 'Ho Chi Minh City' } }
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it('should do a mGet request if we need to get some documents', () => {
      elasticsearch._client.mget.resolves({
        body: {
          docs: []
        }
      });

      const promise = elasticsearch.mCreate(index, collection, documentsWithIds);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            index: esIndexName,
            body: { docs: [ { _id: 'liia', _source: false } ] }
          });

          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _index: esIndexName } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });

    it('should reject already existing documents', () => {
      elasticsearch._client.mget.resolves({
        body: {
          docs: [ { _id: 'liia', found: true } ]
        }
      });

      const promise = elasticsearch.mCreate(index, collection, documentsWithIds);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            index: esIndexName,
            body: { docs: [ { _id: 'liia', _source: false } ] }
          });

          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _source: { city: 'Kathmandu', ...kuzzleMeta } }
          ];
          const rejected = [
            {
              document: {
                _id: 'liia',
                body: { city: 'Ho Chi Minh City' }
              },
              reason: 'document already exists',
              status: 400
            }
          ];

          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            rejected);

          should(result).match(mExecuteResult);
        });
    });

    it('should not do a mGet request if we didn\'t need to get some documents', () => {
      const promise = elasticsearch.mCreate(
        index,
        collection,
        documentsWithoutIds);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).not.be.called();

          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _index: esIndexName } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });

    it('should allow additional options', () => {
      kuzzleMeta._kuzzle_info.author = 'aschen';
      const promise = elasticsearch.mCreate(
        index,
        collection,
        documentsWithoutIds,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(result => {
          should(elasticsearch._client.mget).not.be.called();

          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _index: esIndexName } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ],
            refresh: 'wait_for',
            timeout: '10m'
          };
          const toImport = [
            { _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });
  });

  describe('#mCreateOrReplace', () => {
    let
      kuzzleMeta,
      mExecuteResult,
      documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null
        }
      };

      documents = [
        { _id: 'mehry', body: { city: 'Kathmandu' } },
        { _id: 'liia', body: { city: 'Ho Chi Minh City' } }
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it('should call _mExecute with formated documents', () => {
      const promise = elasticsearch.mCreateOrReplace(index, collection, documents);

      return promise
        .then(result => {
          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName, _id: 'mehry' } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _index: esIndexName, _id: 'liia' } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });

    it('should allow additional options', () => {
      kuzzleMeta._kuzzle_info.author = 'aschen';

      const promise = elasticsearch.mCreateOrReplace(
        index,
        collection,
        documents,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(result => {
          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName, _id: 'mehry' } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _index: esIndexName, _id: 'liia' } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ],
            refresh: 'wait_for',
            timeout: '10m'
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });

    it('should not inject kuzzle meta when specified', () => {
      const promise = elasticsearch.mCreateOrReplace(
        index,
        collection,
        documents,
        { injectKuzzleMeta: false });

      return promise
        .then(result => {
          const esRequest = {
            index: esIndexName,
            body: [
              { index: { _index: esIndexName, _id: 'mehry' } },
              { city: 'Kathmandu' },
              { index: { _index: esIndexName, _id: 'liia' } },
              { city: 'Ho Chi Minh City' }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu' } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City' } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });
  });

  describe('#mUpdate', () => {
    let
      kuzzleMeta,
      mExecuteResult,
      documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          updater: null,
          updatedAt: timestamp
        }
      };

      documents = [
        { _id: 'mehry', body: { city: 'Kathmandu' } },
        { _id: 'liia', body: { city: 'Ho Chi Minh City' } }
      ];

      mExecuteResult = {
        items: [
          {
            _id: 'mehry',
            _source: { city: 'Kathmandu' },
            get: { _source: { age: 26, city: 'Kathmandu' } }
          },
          {
            _id: 'liia',
            _source: { city: 'Ho Chi Minh City' },
            get: { _source: { age: 29, city: 'Ho Chi Minh City' } }
          }
        ],
        errors: []
      };

      elasticsearch._mExecute = sinon.stub().resolves(mExecuteResult);
    });

    it('should call _mExecute with formated documents', () => {
      const promise = elasticsearch.mUpdate(index, collection, documents);

      return promise
        .then(result => {
          const esRequest = {
            index: esIndexName,
            body: [
              { update: { _index: esIndexName, _id: 'mehry' } },
              { doc: { city: 'Kathmandu', ...kuzzleMeta }, _source: true },
              { update: { _index: esIndexName, _id: 'liia' } },
              { doc: { city: 'Ho Chi Minh City', ...kuzzleMeta }, _source: true }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match({
            items: [
              {
                _id: 'mehry',
                _source: { city: 'Kathmandu', age: 26 }
              },
              {
                _id: 'liia',
                _source: { city: 'Ho Chi Minh City', age: 29 }
              }
            ],
            errors: []
          });
        });
    });

    it('should allow additional options', () => {
      kuzzleMeta._kuzzle_info.updater = 'aschen';

      const promise = elasticsearch.mUpdate(
        index,
        collection,
        documents,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(() => {
          const esRequest = {
            index: esIndexName,
            body: [
              { update: { _index: esIndexName, _id: 'mehry' } },
              { doc: { city: 'Kathmandu', ...kuzzleMeta }, _source: true },
              { update: { _index: esIndexName, _id: 'liia' } },
              { doc: { city: 'Ho Chi Minh City', ...kuzzleMeta }, _source: true }
            ],
            refresh: 'wait_for',
            timeout: '10m'
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);
        });

    });

    it('should add documents without ID to rejected documents', () => {
      documents = [
        { _id: 'mehry', body: { city: 'Kathmandu' } },
        { body: { city: 'Ho Chi Minh City' } }
      ];

      const promise = elasticsearch.mUpdate(index, collection, documents);

      return promise
        .then(() => {
          const esRequest = {
            index: esIndexName,
            body: [
              { update: { _index: esIndexName, _id: 'mehry' } },
              { doc: { city: 'Kathmandu', ...kuzzleMeta }, _source: true }
            ],
            refresh: undefined,
            timeout: undefined
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } }
          ];
          const rejected = [
            {
              document: { _id: undefined, body: { city: 'Ho Chi Minh City' } },
              reason: 'document _id must be a string',
              status: 400
            }
          ];

          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            rejected);
        });
    });

  });

  describe('#mReplace', () => {
    let
      kuzzleMeta,
      mExecuteResult,
      documents;

    beforeEach(() => {
      kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null
        }
      };

      documents = [
        { _id: 'mehry', body: { city: 'Kathmandu' } },
        { _id: 'liia', body: { city: 'Ho Chi Minh City' } }
      ];

      mExecuteResult = { items: [], errors: [] };

      elasticsearch._mExecute = sinon.stub().resolves(mExecuteResult);

      elasticsearch._client.mget.resolves({
        body: {
          docs: [ { _id: 'mehry', found: true }, { _id: 'liia', found: true } ]
        }
      });
    });

    it('should get documents and then format them for _mExecute', () => {
      const promise = elasticsearch.mReplace(index, collection, documents);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            index: esIndexName,
            body: {
              docs: [
                { _id: 'mehry', _source: false },
                { _id: 'liia', _source: false }
              ]
            }
          });

          const esRequest = {
            refresh: undefined,
            timeout: undefined,
            body: [
              { index: { _id: 'mehry', _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _id: 'liia', _index: esIndexName } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ]
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } },
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });

    it('should add not found documents to rejected', () => {
      elasticsearch._client.mget.resolves({
        body: {
          docs: [ { _id: 'mehry', found: true }, { _id: 'liia', found: false } ]
        }
      });

      const promise = elasticsearch.mReplace(index, collection, documents);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            index: esIndexName,
            body: {
              docs: [
                { _id: 'mehry', _source: false },
                { _id: 'liia', _source: false }
              ]
            }
          });

          const esRequest = {
            refresh: undefined,
            timeout: undefined,
            body: [
              { index: { _id: 'mehry', _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta }
            ]
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } }
          ];
          const rejected = [
            {
              document: { _id: 'liia', body: { city: 'Ho Chi Minh City' } },
              reason: 'document not found',
              status: 404
            }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            rejected);

          should(result).match(mExecuteResult);
        });
    });

    it('should add documents without an ID to rejected', () => {
      documents = [
        { _id: 'mehry', body: { city: 'Kathmandu' } },
        { body: { city: 'Ho Chi Minh City' } }
      ];
      elasticsearch._client.mget.resolves({
        body: {
          docs: [ { _id: 'mehry', found: true } ]
        }
      });

      const promise = elasticsearch.mReplace(index, collection, documents);

      return promise
        .then(result => {
          should(elasticsearch._client.mget).be.calledWithMatch({
            index: esIndexName,
            body: {
              docs: [ { _id: 'mehry', _source: false } ]
            }
          });

          const esRequest = {
            refresh: undefined,
            timeout: undefined,
            body: [
              { index: { _id: 'mehry', _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta }
            ]
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } }
          ];
          const rejected = [
            {
              document: { body: { city: 'Ho Chi Minh City' } },
              reason: 'document _id must be a string',
              status: 400
            }
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            rejected);

          should(result).match(mExecuteResult);
        });
    });

    it('should allow additional options', () => {
      kuzzleMeta._kuzzle_info.author = 'aschen';

      const promise = elasticsearch.mReplace(
        index,
        collection,
        documents,
        { refresh: 'wait_for', timeout: '10m', userId: 'aschen' });

      return promise
        .then(result => {
          const esRequest = {
            refresh: 'wait_for',
            timeout: '10m',
            body: [
              { index: { _id: 'mehry', _index: esIndexName } },
              { city: 'Kathmandu', ...kuzzleMeta },
              { index: { _id: 'liia', _index: esIndexName } },
              { city: 'Ho Chi Minh City', ...kuzzleMeta }
            ]
          };
          const toImport = [
            { _id: 'mehry', _source: { city: 'Kathmandu', ...kuzzleMeta } },
            { _id: 'liia', _source: { city: 'Ho Chi Minh City', ...kuzzleMeta } },
          ];
          should(elasticsearch._mExecute).be.calledWithMatch(
            esRequest,
            toImport,
            []);

          should(result).match(mExecuteResult);
        });
    });
  });

  describe('#mDelete', () => {
    let documentIds;

    beforeEach(() => {
      documentIds = ['mehry', 'liia'];

      elasticsearch._getAllDocumentsFromQuery = sinon.stub().resolves([
        { _id: 'mehry', _source: { city: 'Kathmandu' } },
        { _id: 'liia', _source: { city: 'Ho Chi Minh City' } }
      ]);

      elasticsearch._client.deleteByQuery.resolves({
        body: {
          total: 2,
          deleted: 2,
          failures: [ ]
        }
      });

      elasticsearch._client.indices.refresh.resolves({
        body: { _shards: 1 }
      });

      elasticsearch.mGet = sinon.stub().resolves({
        items: [
          { _id: 'mehry', _source: { city: 'Kathmandu' } },
          { _id: 'liia', _source: { city: 'Ho Chi Minh City' } }
        ]
      });
    });

    it('should allow to delete multiple documents with deleteByQuery', () => {
      const promise = elasticsearch.mDelete(index, collection, documentIds);

      return promise
        .then(result => {
          should(elasticsearch.mGet).be.calledWithMatch(
            index,
            collection,
            ['mehry', 'liia']);

          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { ids: { values: ['mehry', 'liia'] } } },
            scroll: '5s'
          });

          should(result).match({
            documents: [
              { _id: 'mehry', _source: { city: 'Kathmandu' } },
              { _id: 'liia', _source: { city: 'Ho Chi Minh City' } }
            ],
            errors: []
          });
        });
    });

    it('should add non existing documents to rejected', () => {
      elasticsearch.mGet = sinon.stub().resolves({
        items: [ { _id: 'mehry', _source: { city: 'Kathmandu' } } ]
      });

      const promise = elasticsearch.mDelete(index, collection, documentIds);

      return promise
        .then(result => {
          should(elasticsearch.mGet).be.calledWithMatch(
            index,
            collection,
            ['mehry', 'liia']);

          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { ids: { values: ['mehry'] } } },
            scroll: '5s'
          });

          should(result).match({
            documents: [
              { _id: 'mehry', _source: { city: 'Kathmandu' } }
            ],
            errors: [
              { _id: 'liia', reason: 'document not found', status: 404 }
            ]
          });
        });
    });

    it('should add document with ID non string to rejected', () => {
      elasticsearch.mGet = sinon.stub().resolves({
        items: [ { _id: 'mehry', _source: { city: 'Kathmandu' } } ]
      });

      const promise = elasticsearch.mDelete(index, collection, ['mehry', 42]);

      return promise
        .then(result => {
          should(elasticsearch.mGet).be.calledWithMatch(
            index,
            collection,
            ['mehry']);

          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { ids: { values: ['mehry'] } } },
            scroll: '5s'
          });

          should(result).match({
            documents: [
              { _id: 'mehry', _source: { city: 'Kathmandu' } }
            ],
            errors: [
              { _id: 42, reason: 'document _id must be a string', status: 400 }
            ]
          });
        });
    });

    it('should allow additional options', () => {
      const promise = elasticsearch.mDelete(
        index,
        collection,
        documentIds,
        { refresh: 'wait_for' });

      return promise
        .then(() => {
          should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { ids: { values: ['mehry', 'liia'] } } },
            scroll: '5s',
            refresh: true
          });
        });
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch.mDelete(index, collection, documentIds);

      return should(promise).be.rejectedWith({
        id: 'services.storage.write_limit_exceeded'
      });
    });
  });

  describe('_mExecute', () => {
    let
      esRequest,
      documents,
      partialErrors;

    beforeEach(() => {
      esRequest = {
        refresh: undefined,
        body: [
          { index: { _index: esIndexName, _id: 'liia' } },
          { city: 'Kathmandu' },
          { update: { _index: esIndexName, _id: 'mehry' } },
          { doc: { city: 'Kathmandu' } }
        ]
      };

      documents = [
        { _id: 'liia', _source: { city: 'Kathmandu' } },
        { _id: 'mehry', _source: { city: 'Ho Chi Minh City' } }
      ];

      partialErrors = [
        {
          document: { body: { some: 'document' } },
          status: 400,
          reason: 'some reason'
        }
      ];

      elasticsearch._client.bulk.resolves({
        body: {
          items: [
            {
              index: {
                _id: 'liia',
                status: 201,
                _version: 1,
                result: 'created',
                created: true,
                foo: 'bar'
              }
            },
            {
              index: {
                _id: 'mehry',
                status: 400,
                error: { reason: 'bad request' },
                bar: 'foo'
              }
            }
          ]
        }
      });
    });

    it('should call client.bulk and separate success from errors', () => {
      const promise = elasticsearch._mExecute(esRequest, documents, partialErrors);

      return promise
        .then(result => {
          should(elasticsearch._client.bulk).be.calledWithMatch(esRequest);

          const expectedResult = [
            {
              _id: 'liia',
              _source: { city: 'Kathmandu' },
              status: 201,
              _version: 1,
              created: true,
              result: 'created'
            }
          ];
          const expectedErrors = [
            {
              document: { body: { some: 'document' } },
              status: 400,
              reason: 'some reason'
            },
            {
              document: { _id: 'mehry', _source: { city: 'Ho Chi Minh City' } },
              status: 400,
              reason: 'bad request'
            }
          ];
          should(result).match({
            items: expectedResult,
            errors: expectedErrors
          });
        });
    });

    it('should not call bulk if there is no documents', () => {
      const promise = elasticsearch._mExecute(esRequest, [], partialErrors);

      return promise
        .then(result => {
          should(elasticsearch._client.bulk).not.be.called();

          const expectedErrors = [
            {
              document: { body: { some: 'document' } },
              reason: 'some reason'
            }
          ];
          should(result).match({
            items: [],
            errors: expectedErrors
          });
        });
    });

    it('should reject if limit document reached', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch._mExecute(esRequest, documents, partialErrors);

      return should(promise).be.rejectedWith({
        id: 'services.storage.write_limit_exceeded'
      });
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.bulk.rejects(esClientError);

      const promise = elasticsearch._mExecute(esRequest, documents, partialErrors);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.reject).be.calledWith(esClientError);
        });
    });

  });

  describe('#_extractMDocuments', () => {
    it('should add documents without body in rejected array', () => {
      const documents = [
        { _id: 'liia', body: { city: 'Kathmandu' } },
        { _id: 'no-body' }
      ];
      const kuzzleMeta = {
        _kuzzle_info: {
          author: null,
          createdAt: timestamp,
          updater: null,
          updatedAt: null
        }
      };

      const {
        rejected,
        extractedDocuments
      } = elasticsearch._extractMDocuments(documents, kuzzleMeta);

      should(rejected).match([{
        document: { _id: 'no-body' },
        reason: 'document body must be an object'
      }]);

      should(extractedDocuments).match([{
        _id: 'liia',
        _source: { city: 'Kathmandu' }
      }]);
    });
  });

  describe('#_checkMappings', () => {
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


      should(() => elasticsearch._checkMappings(mapping))
        .throw({
          message: 'Invalid mapping property "mapping.dinamic". Did you mean "dynamic" ?',
          id: 'services.storage.invalid_mapping'
        });

      should(() => elasticsearch._checkMappings(mapping2))
        .throw({
          message: 'Invalid mapping property "mapping.type".',
          id: 'services.storage.invalid_mapping'
        });
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

      should(() => elasticsearch._checkMappings(mapping))
        .throw({
          message: 'Invalid mapping property "mapping.properties.car.dinamic". Did you mean "dynamic" ?',
          id: 'services.storage.invalid_mapping'
        });
    });

    it('should return null if no properties are incorrect', () => {
      const mapping = {
        dynamic: 'false',
        properties: {
          name: { type: 'keyword' },
          car: {
            dynamic: 'false',
            dynamic_templates: {},
            type: 'nested',
            properties: {
              brand: { type: 'keyword' }
            }
          }
        }
      };

      should(() => elasticsearch._checkMappings(mapping))
        .not.throw();
    });
  });

  describe('Collection emulation utils', () => {
    let
      internalES,
      publicES;

    beforeEach(() => {
      publicES = new ES(kuzzle, kuzzle.config.services.storageEngine);
      internalES = new ES(kuzzle, kuzzle.config.services.storageEngine, 'internal');
    });

    describe('#_getESIndex', () => {
      it('return esIndex name for a collection', () => {
        const
          publicESIndex = publicES._getESIndex('nepali', 'liia'),
          internalESIndex = internalES._getESIndex('nepali', 'mehry');

        should(publicESIndex).be.eql('&nepali.liia');
        should(internalESIndex).be.eql('%nepali.mehry');
      });
    });

    describe('#_extractIndex', () => {
      it('extract the index name from esIndex name', () => {
        const
          publicIndex = publicES._extractIndex('&nepali.liia'),
          internalIndex = internalES._extractIndex('%nepali.liia');

        should(publicIndex).be.eql('nepali');
        should(internalIndex).be.eql('nepali');
      });
    });

    describe('#_extractCollection', () => {
      it('extract the collection names from esIndex name', () => {
        const
          publicCollection = publicES._extractCollection('&nepali.liia'),
          publicCollection2 = publicES._extractCollection('&vietnam.lfiduras'),
          publicCollection3 = publicES._extractCollection('&vietnam.l'),
          publicCollection4 = publicES._extractCollection('&vietnam.iamaverylongcollectionnamebecauseiworthit'),
          internalCollection = internalES._extractCollection('%nepali.liia');

        should(publicCollection).be.eql('liia');
        should(publicCollection2).be.eql('lfiduras');
        should(publicCollection3).be.eql('l');
        should(publicCollection4).be.eql('iamaverylongcollectionnamebecauseiworthit');
        should(internalCollection).be.eql('liia');
      });
    });

    describe('#_extractIndexes', () => {
      it('extract the index names from a list of esIndex name', () => {
        const esIndexes = [
          '%nepali.liia', '%nepali.mehry', '&india.darjeeling', '&vietnam.lfiduras'
        ];

        const
          publicIndexes = publicES._extractIndexes(esIndexes),
          internalIndexes = internalES._extractIndexes(esIndexes);

        should(publicIndexes).be.eql(['india', 'vietnam']);
        should(internalIndexes).be.eql(['nepali']);
      });

      it('does not extract malformated indexes', () => {
        const esIndexes = ['nepali', '&india', '&vietnam.'];

        const
          publicIndexes = publicES._extractIndexes(esIndexes),
          internalIndexes = internalES._extractIndexes(esIndexes);

        should(publicIndexes).be.empty();
        should(internalIndexes).be.empty();
      });
    });

    describe('#_extractCollections', () => {
      it('extract the collection names for an index from a list of esIndex name', () => {
        const esIndexes = [
          '%nepali.liia', '%nepali.mehry', '&nepali.panipokari', '&vietnam.lfiduras'];

        const
          publicCollections = publicES._extractCollections(esIndexes, 'nepali'),
          internalCollections = internalES._extractCollections(esIndexes, 'nepali');

        should(publicCollections).be.eql(['panipokari']);
        should(internalCollections).be.eql(['liia', 'mehry']);
      });
    });
  });
});
