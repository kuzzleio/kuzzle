'use strict';

const should = require('should');
const sinon = require('sinon');
const ms = require('ms');

const {
  BadRequestError,
  PreconditionError,
  SizeLimitError,
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const ESClientMock = require('../../mocks/service/elasticsearchClient.mock');

const ES = require('../../../lib/service/storage/elasticsearch');
const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');

describe('Test: ElasticSearch service', () => {
  let kuzzle;
  let index;
  let collection;
  let esIndexName;
  let elasticsearch;
  let timestamp;
  let esClientError;
  let dateNow = Date.now;

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

    elasticsearch._esWrapper = {
      reject: sinon.spy((error) => Promise.reject(error)),
      formatESError: sinon.spy(error => error)
    };

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
        scopeEnum.PRIVATE);

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
    it('should be able to scroll an old search', async () => {
      const cacheStub = kuzzle.ask
        .withArgs('core:cache:internal:get')
        .resolves('1');

      elasticsearch._client.scroll.resolves({
        body: {
          _scroll_id: 'azerty',
          hits: {
            hits: [
              {_id: 'foo', _source: {}},
              {_id: 'bar', _source: {}},
            ],
            total: { value: 1000 },
          },
        }
      });

      const result = await elasticsearch.scroll('i-am-scroll-id', {
        scrollTTL: '10s'
      });

      should(cacheStub).calledOnce();

      const redisKey = cacheStub.firstCall.args[1];

      // 3:
      //   the redis key stub returns "1" (1 result fetched so far) +
      //   the 2 results contained in the stubbed result of _client.scroll
      // 10: scrollTTL of 10s
      should(kuzzle.ask)
        .calledWith('core:cache:internal:store', redisKey, 3, { ttl: 10000 });

      should(elasticsearch._client.clearScroll).not.called();

      should(elasticsearch._client.scroll.firstCall.args[0]).be.deepEqual({
        scroll: '10s',
        scrollId: 'i-am-scroll-id',
      });

      should(result).be.match({
        aggregations: undefined,
        hits: [
          {_id: 'foo', _source: {}},
          {_id: 'bar', _source: {}},
        ],
        remaining: 997,
        scrollId: 'azerty',
        total: 1000,
      });
    });

    it('should clear a scroll upon fetching its last page of results', async () => {
      const cacheStub = kuzzle.ask
        .withArgs('core:cache:internal:get')
        .resolves('998');

      elasticsearch._client.scroll.resolves({
        body: {
          hits: {
            hits: [
              {_id: 'foo', _source: {}},
              {_id: 'bar', _source: {}},
            ],
            total: { value: 1000 }
          },
          _scroll_id: 'azerty'
        }
      });

      const result = await elasticsearch.scroll('i-am-scroll-id', {
        scrollTTL: '10s'
      });

      should(cacheStub).be.calledOnce();

      const redisKey = cacheStub.firstCall.args[1];

      should(kuzzle.ask).not.calledWith('core:cache:internal:store');
      should(kuzzle.ask).calledWith('core:cache:internal:del', redisKey);

      should(elasticsearch._client.clearScroll)
        .calledOnce()
        .calledWithMatch({scrollId: 'azerty'});

      should(elasticsearch._client.scroll.firstCall.args[0]).be.deepEqual({
        scroll: '10s',
        scrollId: 'i-am-scroll-id',
      });

      should(result).be.match({
        aggregations: undefined,
        hits: [
          {_id: 'foo', _source: {}},
          {_id: 'bar', _source: {}},
        ],
        remaining: 0,
        scrollId: 'azerty',
        total: 1000,
      });
    });

    it('should reject promise if a scroll fails', async () => {
      elasticsearch._client.scroll.rejects(esClientError);

      kuzzle.ask.withArgs('core:cache:internal:get').resolves('1');

      await should(elasticsearch.scroll('i-am-scroll-id')).be.rejected();

      should(elasticsearch._esWrapper.formatESError).calledWith(esClientError);
    });

    it('should reject if the scrollId does not exists in Kuzzle cache', async () => {
      kuzzle.ask.withArgs('core:cache:internal:get').resolves(null);

      await should(elasticsearch.scroll('i-am-scroll-id')).be.rejectedWith({
        id: 'services.storage.unknown_scroll_id'
      });

      should(elasticsearch._client.scroll).not.be.called();
    });

    it('should reject if the scroll duration is too great', async () => {
      elasticsearch._config.maxScrollDuration = '21m';

      await should(elasticsearch.scroll('i-am-scroll-id', { scrollTTL: '42m' }))
        .be.rejectedWith({ id: 'services.storage.scroll_duration_too_great' });

      should(elasticsearch._client.scroll).not.be.called();
    });

    it('should default an explicitly null scrollTTL argument', async () => {
      const cacheStub = kuzzle.ask
        .withArgs('core:cache:internal:get', sinon.match.string)
        .resolves('1');

      elasticsearch._client.scroll.resolves({
        body: {
          hits: { hits: [], total: { value: 1000 } },
          _scroll_id: 'azerty'
        }
      });

      await elasticsearch.scroll('scroll-id', { scrollTTL: null });

      should(cacheStub).calledOnce();
      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        sinon.match.string,
        1,
        sinon.match.object);

      should(elasticsearch._client.scroll.firstCall.args[0]).be.deepEqual({
        scrollId: 'scroll-id',
        scroll: elasticsearch.config.defaults.scrollTTL
      });
    });
  });

  describe('#search', () => {
    let filter;

    beforeEach(() => {
      filter = {};
    });

    it('should be able to search documents', async () => {
      elasticsearch._client.search.resolves({
        body: {
          aggregations: { some: 'aggregs' },
          body: filter,
          hits: {
            hits: [
              {
                _id: 'liia',
                _source: { city: 'Kathmandu' },
                highlight: 'highlight',
                other: 'thing'
              }
            ],
            total: { value: 1 },
          },
          _scroll_id: 'i-am-scroll-id',
        }
      });

      const result = await elasticsearch.search(index, collection, filter);

      should(elasticsearch._client.search.firstCall.args[0]).match({
        index: esIndexName,
        body: { query: { match_all: {} } },
        from: undefined,
        size: undefined,
        scroll: undefined,
        trackTotalHits: true,
      });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        sinon.match.string,
        1,
        { ttl: ms(elasticsearch.config.defaults.scrollTTL) });

      should(result).match({
        aggregations: { some: 'aggregs' },
        hits: [
          {
            _id: 'liia',
            _source: { city: 'Kathmandu' },
            highlight: 'highlight',
          },
        ],
        remaining: 0,
        scrollId: 'i-am-scroll-id',
        total: 1,
      });
    });

    it('should be able to search with from/size and scroll arguments', async () => {
      elasticsearch._client.search.resolves({
        body: {
          hits: { hits: [], total: { value: 0 } },
          _scroll_id: 'i-am-scroll-id'
        }
      });

      await elasticsearch.search(index, collection, filter, {
        from: 0,
        scroll: '30s',
        size: 1,
      });

      should(elasticsearch._client.search.firstCall.args[0]).match({
        body: filter,
        from: 0,
        index: esIndexName,
        scroll: '30s',
        size: 1,
        trackTotalHits: true,
      });

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        sinon.match.string,
        0,
        { ttl: 30000 });
    });

    it('should return a rejected promise if a search fails', async () => {
      elasticsearch._client.search.rejects(esClientError);

      await should(elasticsearch.search(index, collection, filter))
        .be.rejected();

      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
    });

    it('should return a rejected promise if an unhautorized property is in the query', () => {
      filter = {
        not_authorized: 42,
        query : {}
      };

      return should(elasticsearch.search(index, collection, filter))
        .be.rejectedWith({ id: 'services.storage.invalid_search_query' });
    });

    it('should not save the scrollId in the cache if not present in response', async () => {
      elasticsearch._client.search.resolves({
        body: {
          hits: { hits: [], total: { value: 0 } },
        },
      });

      await elasticsearch.search(index, collection, {});

      should(kuzzle.ask).not.calledWith('core:cache:internal:store');
    });

    it('should return a rejected promise if the scroll duration is too great', async () => {
      elasticsearch._config.maxScrollDuration = '21m';

      const promise = elasticsearch.search(index, collection, filter, {
        scroll: '42m'
      });

      await should(promise).be.rejectedWith({
        id: 'services.storage.scroll_duration_too_great'
      });

      should(elasticsearch._client.search).not.be.called();
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
          should(elasticsearch._esWrapper.formatESError)
            .be.calledWith(esClientError);
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
          should(elasticsearch._client.index).be.calledWithMatch({
            index: esIndexName,
            body: {
              city: 'Panipokari',
              _kuzzle_info: {
                author: null
              }
            },
            op_type: 'index'
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
          _version: 1,
          get: {
            _source: {city: 'Panipokari'}
          }
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
            _version: 1,
            _source: {
              city: 'Panipokari'
            }
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
            _source: true,
            retryOnConflict: 42
          });

          should(result).match({
            _id: 'liia',
            _version: 1,
            _source: {
              city: 'Panipokari'
            }
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

    it('should default an explicitly null retryOnConflict', async () => {
      await elasticsearch.update(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        { refresh: 'wait_for', userId: 'oh noes', retryOnConflict: null });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: 'oh noes'
            }
          }
        },
        id: 'liia',
        refresh: 'wait_for',
        _source: true,
        retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
      });
    });
  });

  describe('#upsert', () => {
    beforeEach(() => {
      elasticsearch._client.update.resolves({
        body: {
          _id: 'liia',
          _version: 2,
          result: 'updated',
          get: {
            _source: {city: 'Panipokari'}
          }
        }
      });
    });

    it('should allow to upsert a document', async () => {
      const result = await elasticsearch.upsert(
        index,
        collection,
        'liia',
        { city: 'Panipokari' });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: null
            }
          },
          upsert: {
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
            },
          },
        },
        id: 'liia',
        refresh: undefined,
        retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
      });

      should(result).match({
        _id: 'liia',
        _version: 2,
        _source: {
          city: 'Panipokari'
        },
        created: false,
      });
    });

    it('should handle default values for upserted documents', async () => {
      const result = await elasticsearch.upsert(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        {
          defaultValues: { oh: 'noes' },
        });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: null
            }
          },
          upsert: {
            oh: 'noes',
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
            },
          },
        },
        id: 'liia',
        refresh: undefined,
        retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
      });

      should(result).match({
        _id: 'liia',
        _version: 2,
        _source: {
          city: 'Panipokari'
        },
        created: false,
      });
    });

    it('should return the right "_created" result on a document creation', async () => {
      elasticsearch._client.update.resolves({
        body: {
          _id: 'liia',
          _version: 1,
          result: 'created',
          get: {
            _source: {city: 'Panipokari'}
          }
        }
      });

      const result = await elasticsearch.upsert(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        {
          defaultValues: { oh: 'noes' },
        });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: null
            }
          },
          upsert: {
            oh: 'noes',
            _kuzzle_info: {
              author: null,
              createdAt: timestamp,
            },
          },
        },
        id: 'liia',
        refresh: undefined,
        retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
      });

      should(result).match({
        _id: 'liia',
        _version: 1,
        _source: {
          city: 'Panipokari'
        },
        created: true,
      });
    });

    it('should handle optional configurations', async () => {
      const result = await elasticsearch.upsert(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        { refresh: 'wait_for', userId: 'aschen', retryOnConflict: 42 });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: 'aschen',
            }
          },
          upsert: {
            _kuzzle_info: {
              author: 'aschen',
              createdAt: timestamp,
            },
          },
        },
        id: 'liia',
        refresh: 'wait_for',
        _source: true,
        retryOnConflict: 42
      });

      should(result).match({
        _id: 'liia',
        _version: 2,
        _source: {
          city: 'Panipokari'
        },
        created: false,
      });
    });

    it('should return a rejected promise if client.upsert fails', async () => {
      elasticsearch._client.update.rejects(esClientError);

      await should(elasticsearch.upsert(index, collection, 'liia', {
        city: 'Kathmandu'
      })).rejected();

      should(elasticsearch._esWrapper.formatESError).calledWith(esClientError);
    });

    it('should default an explicitly null retryOnConflict', async () => {
      await elasticsearch.upsert(
        index,
        collection,
        'liia',
        { city: 'Panipokari' },
        { refresh: 'wait_for', userId: 'oh noes', retryOnConflict: null });

      should(elasticsearch._client.update).be.calledWithMatch({
        index: esIndexName,
        body: {
          doc: {
            city: 'Panipokari',
            _kuzzle_info: {
              updatedAt: timestamp,
              updater: 'oh noes'
            }
          },
          upsert: {
            _kuzzle_info: {
              author: 'oh noes',
              createdAt: timestamp,
            },
          },
        },
        id: 'liia',
        refresh: 'wait_for',
        _source: true,
        retryOnConflict: elasticsearch.config.defaults.onUpdateConflictRetries
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

  describe('#updateByQuery', () => {
    beforeEach(() => {
      sinon.stub(elasticsearch, '_getAllDocumentsFromQuery').resolves([
        { _id: '_id1', _source: { name: 'Ok' } },
        { _id: '_id2', _source: { name: 'Ok' } },
      ]);

      sinon.stub(elasticsearch, 'mUpdate').resolves({
        items: [
          {
            _id: '_id1',
            _source: { name: 'bar' },
            status: 200
          },
          {
            _id: '_id2',
            _source: { name: 'bar' },
            status: 200
          }
        ],
        errors: []
      });


      elasticsearch._client.indices.refresh.resolves({
        body: { _shards: 1 }
      });
    });

    const documents = [
      {
        _id: '_id1',
        _source: undefined,
        body: {
          name: 'bar'
        }
      },
      {
        _id: '_id2',
        _source: undefined,
        body: {
          name: 'bar'
        }
      }
    ];

    it('should have updateByQuery capability', () => {
      const promise = elasticsearch.updateByQuery(
        index,
        collection,
        { filter: { term: { name: 'Ok' } } },
        { name: 'bar' });

      return promise
        .then(result => {
          should(elasticsearch.mUpdate).be.calledWithMatch(
            index,
            collection,
            documents,
            { refresh: undefined }
          );

          should(result).match({
            successes: [
              {
                _id: '_id1',
                _source: {name: 'bar'},
                status: 200
              },
              {
                _id: '_id2',
                _source: {name: 'bar'},
                status: 200
              }
            ],
            errors: []
          });
        });
    });

    it('should allow additional options', () => {
      const promise = elasticsearch.updateByQuery(
        index,
        collection,
        { filter: 'term' },
        { name: 'bar'},
        { refresh: 'wait_for', size: 3 });

      return promise
        .then(result => {
          should(elasticsearch._getAllDocumentsFromQuery).be.calledWithMatch({
            index: esIndexName,
            body: { query: { filter: 'term'} },
            scroll: '5s',
            size: 3
          });

          should(elasticsearch.mUpdate).be.calledWithMatch(
            index,
            collection,
            documents,
            {
              refresh: 'wait_for'
            });

          should(result).match({
            successes: [
              { _id: '_id1', _source: { name: 'bar' }, status: 200 },
              { _id: '_id2', _source: { name: 'bar' }, status: 200 },
            ],
            errors: []
          });
        });
    });

    it('should reject if the number of impacted documents exceeds the configured limit', () => {
      elasticsearch._getAllDocumentsFromQuery.restore();

      elasticsearch._client.search.resolves({
        body: {
          hits: {
            hits: [],
            total: {
              value: 99999
            }
          },
          _scroll_id: 'foobar'
        }
      });

      kuzzle.config.limits.documentsFetchCount = 2;

      return should(elasticsearch.updateByQuery(index, collection, {}, {}))
        .rejectedWith(
          SizeLimitError,
          { id: 'services.storage.write_limit_exceeded' });
    });
  });


  describe('#deleteByQuery', () => {
    beforeEach(() => {
      sinon.stub(elasticsearch, '_getAllDocumentsFromQuery').resolves([
        { _id: '_id1', _source: '_source1' },
        { _id: '_id2', _source: '_source2' },
      ]);

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

    it('should have deleteByQuery capability', async () => {
      const result = await elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' });

      should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
        index: esIndexName,
        body: { query: { filter: 'term' } },
        scroll: '5s',
        from: undefined,
        size: 1000,
        refresh: undefined
      });

      should(elasticsearch._getAllDocumentsFromQuery).be.calledWithMatch({
        index: esIndexName,
        body: { query: { filter: 'term' } },
        scroll: '5s',
        from: undefined,
        size: 1000,
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

    it('should allow additional options', async () => {
      const result = await elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' },
        { refresh: 'wait_for', from: 1, size: 3 });

      should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
        index: esIndexName,
        body: { query: { filter: 'term' } },
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

    it('should not fetch documents if fetch=false', async () => {
      const result = await elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' },
        { fetch: false });

      should(elasticsearch._client.deleteByQuery).be.calledWithMatch({
        index: esIndexName,
        body: { query: { filter: 'term' } },
        scroll: '5s',
        from: undefined,
        size: 1000,
        refresh: undefined
      });

      should(elasticsearch._getAllDocumentsFromQuery).not.be.called();

      should(result).match({
        documents: [],
        total: 2,
        deleted: 1,
        failures: [
          { shardId: 42, reason: 'error' }
        ]
      });
    });

    it('should rejects if client.deleteByQuery fails', () => {
      elasticsearch._client.deleteByQuery.rejects(esClientError);

      const promise = elasticsearch.deleteByQuery(
        index,
        collection,
        { filter: 'term' });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

    it('should reject if the number of impacted documents exceeds the configured limit', () => {
      elasticsearch._getAllDocumentsFromQuery.restore();

      elasticsearch._client.search.resolves({
        body: {
          hits: {
            hits: [],
            total: {
              value: 99999
            }
          },
          _scroll_id: 'foobar'
        }
      });

      kuzzle.config.limits.documentsFetchCount = 2;

      return should(elasticsearch.deleteByQuery(index, collection, {}))
        .rejectedWith(
          SizeLimitError,
          { id: 'services.storage.write_limit_exceeded' });
    });
  });

  describe('#mExecute', () => {
    it('should call the callback method with each batch returned by ES', async () => {
      const hits1 = {
        hits: [21, 42, 84],
        total: {
          value: 5
        }
      };
      const hits2 = {
        hits: [168, 336],
        total: {
          value: 5
        }
      };
      const callbackStub = sinon
        .stub()
        .onCall(0).resolves(1)
        .onCall(1).resolves(2);

      elasticsearch._client.search.callsArgWith(1, null, {
        body: { hits: hits1 },
        _scroll_id: 'scroll-id'
      });

      elasticsearch._client.scroll.callsArgWith(1, null, {
        body: { hits: hits2 },
        _scroll_id: 'scroll-id'
      });

      const result = await elasticsearch.mExecute(
        index,
        collection,
        { match: 21 },
        callbackStub);

      should(result).match([1, 2]);

      should(elasticsearch._client.search.getCall(0).args[0]).match({
        index: esIndexName,
        body: { query: { match: 21 } },
        scroll: '5s',
        from: 0,
        size: 10
      });

      should(callbackStub).be.calledTwice();
      should(callbackStub.getCall(0).args[0]).be.eql(hits1.hits);
      should(callbackStub.getCall(1).args[0]).be.eql(hits2.hits);
    });

    it('should reject if the query is empty', () => {
      const promise = elasticsearch.mExecute(
        index,
        collection,
        'not an object',
        () => {});

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

    it('should reject if the index already exists', () => {
      return should(elasticsearch.createIndex('nepali')).be.rejectedWith(
        PreconditionError,
        { id: 'services.storage.index_already_exists' });
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

    it('should reject if the index name is invalid', () => {
      sinon.stub(elasticsearch, 'isIndexNameValid').returns(false);

      return should(elasticsearch.createIndex('foobar')).rejectedWith(
        BadRequestError,
        { id: 'services.storage.invalid_index_name' });
    });
  });

  describe('#createCollection', () => {
    let _checkMappings;

    beforeEach(() => {
      _checkMappings = elasticsearch._checkMappings;

      elasticsearch.hasCollection = sinon.stub().resolves(false);
      elasticsearch._client.indices.create.resolves({});
      elasticsearch._checkMappings = sinon.stub().resolves();
    });

    it('should allow creating a new collection and inject commonMappings', async () => {
      const
        settings = { index: { blocks: { write: true } } },
        mappings = { properties: { city: { type: 'keyword' } } };

      const result = await elasticsearch.createCollection(
        index,
        collection,
        { mappings, settings });

      should(elasticsearch.hasCollection).be.calledWith(index, collection);
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
          },
          settings: { index: { blocks: { write: true } } }
        }
      });

      should(result).be.null();
    });

    it('should allow to set dynamic and _meta fields', async () => {
      const mappings = { dynamic: 'true', _meta: { some: 'meta' } };


      const result = await elasticsearch.createCollection(
        index,
        collection,
        { mappings });

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

    it('should return a rejected promise if client.indices.create fails', () => {
      elasticsearch._client.indices.create.rejects(esClientError);

      const promise = elasticsearch.createCollection(
        index,
        collection,
        { mappings: { properties: { city: { type: 'keyword' } } } });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
        });
    });

    it('should not reject when a race condition occur between exists and create methods', () => {
      const esReject = new Error('foo');

      esReject.meta = {
        body: {
          error: {
            type: 'resource_already_exists_exception'
          }
        }
      };

      elasticsearch._client.indices.create.rejects(esReject);

      const promise = elasticsearch.createCollection(
        index,
        collection,
        { mappings: { properties: { city: { type: 'keyword' } } } });

      return should(promise).be.fulfilled()
        .then(() => {
          should(elasticsearch._esWrapper.formatESError).not.be.called();
        });
    });

    it('should reject with BadRequestError on wrong mapping', () => {
      elasticsearch._checkMappings = _checkMappings;
      const mappings = {
        dinamic: 'false',
        properties: {
          freeman:  { type: 'keyword' }
        }
      };

      const promise = elasticsearch.createCollection(
        index,
        collection,
        { mappings });

      return should(promise).be.rejectedWith({
        message: /Did you mean "dynamic"/,
        id: 'services.storage.invalid_mapping'
      });
    });

    it('should reject when an incorrect dynamic property value is provided', async () => {
      const mappings1 = {
        dynamic: null
      };
      const mappings2 = {
        properties: {
          user: {
            properties: {
              metadata: {
                dynamic: 'notTooMuch'
              }
            }
          }
        }
      };
      const mappings3 = {
        dynamic: true
      };

      await elasticsearch.createCollection(
        index,
        collection,
        { mappings: mappings3 });

      should(elasticsearch._checkMappings).be.calledWithMatch({
        dynamic: 'true'
      });

      await should(elasticsearch.createCollection(
        index,
        collection,
        { mappings: mappings1 })
      ).be.rejectedWith({
        message: /Dynamic property value should be a string./,
        id: 'services.storage.invalid_mapping'
      });

      await should(elasticsearch.createCollection(
        index,
        collection,
        { mappings: mappings2 })
      ).be.rejectedWith({
        message: /Incorrect dynamic property value/,
        id: 'services.storage.invalid_mapping'
      });
    });

    it('should call updateCollection if the collection already exists', async () => {
      const
        settings = { index: { blocks: { write: true } } },
        mappings = { properties: { city: { type: 'keyword' } } };

      elasticsearch.hasCollection = sinon.stub().resolves(true);
      elasticsearch.updateCollection = sinon.stub().resolves({});

      await elasticsearch.createCollection(index, collection, { mappings, settings });

      should(elasticsearch.hasCollection).be.calledWith(index, collection);
      should(elasticsearch.updateCollection).be.calledWithMatch(index, collection, {
        settings: { index: { blocks: { write: true } } },
        mappings: { properties: { city: { type: 'keyword' } } }
      });
    });

    it('should not overwrite kuzzle commonMapping', async () => {
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
      const mappings = {
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

      await elasticsearch.createCollection(index, collection, { mappings });

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

    it('should reject if the index name is invalid', () => {
      sinon.stub(elasticsearch, 'isIndexNameValid').returns(false);

      return should(elasticsearch.createCollection('foo', 'bar')).rejectedWith(
        BadRequestError,
        { id: 'services.storage.invalid_index_name' });
    });

    it('should reject if the collection name is invalid', () => {
      sinon.stub(elasticsearch, 'isCollectionNameValid').returns(false);

      return should(elasticsearch.createCollection('foo', 'bar')).rejectedWith(
        BadRequestError,
        { id: 'services.storage.invalid_collection_name' });
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

  describe('#updateCollection', () => {
    let
      oldSettings,
      settings,
      mappings;

    beforeEach(() => {
      oldSettings = {
        body: {
          [esIndexName]: {
            settings: {
              index: {
                creation_date: Date.now(),
                provided_name: 'hello_world',
                uuid: 'some-u-u-i-d',
                version: { no: 4242 },
                blocks: { write: false }
              }
            }
          }
        }
      };
      settings = { index: { blocks: { write: true } } };
      mappings = { properties: { city: { type: 'keyword' } } };

      elasticsearch._client.indices.getSettings.resolves(oldSettings);
      elasticsearch.updateMapping = sinon.stub().resolves();
      elasticsearch.updateSettings = sinon.stub().resolves();
      elasticsearch.updateSearchIndex = sinon.stub().resolves();
    });
    it('should call updateSettings, updateMapping', async () => {
      elasticsearch.getMapping = sinon.stub().resolves({dynamic: 'true', properties: { city: { type: 'keyword' }, dynamic: 'false' } });
      await elasticsearch.updateCollection(index, collection, { mappings, settings });

      should(elasticsearch.updateSettings).be.calledWith(index, collection, settings);
      should(elasticsearch.updateMapping).be.calledWith(index, collection, mappings);
    });

    it('should call updateSettings and updateMapping', async () => {
      elasticsearch.getMapping = sinon.stub().resolves({ dynamic: 'false', properties: { city: { type: 'keyword' } } });
      await elasticsearch.updateCollection(index, collection, { mappings, settings });

      should(elasticsearch.updateSettings).be.calledWith(index, collection, settings);
      should(elasticsearch.updateMapping).be.calledWith(index, collection, mappings);
      should(elasticsearch.updateSearchIndex).not.be.called();
    });

    it('should revert settings if updateMapping fail', () => {
      elasticsearch.getMapping = sinon.stub().resolves({ dynamic: 'true', properties: { city: { type: 'keyword' } } });
      elasticsearch.updateMapping.rejects();

      const promise = elasticsearch.updateCollection(index, collection, { mappings, settings });

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._client.indices.getSettings).be.calledWithMatch({
            index: esIndexName
          });
          should(elasticsearch.updateSettings).be.calledTwice();
          should(elasticsearch.updateMapping).be.calledOnce();
          should(elasticsearch.updateSettings.getCall(1).args)
            .be.eql([index, collection, { index: { blocks: { write: false } } }]);
        });
    });

    it('should calls updateSearchIndex if dynamic change from false to true', async () => {
      elasticsearch.getMapping = sinon.stub().resolves({
        properties: {
          content: {
            dynamic: 'false'
          }
        }
      });
      const newMappings = {
        properties: {
          content: {
            dynamic: true
          }
        }
      };

      await elasticsearch.updateCollection(index, collection, { mappings: newMappings });

      should(elasticsearch.updateSearchIndex).be.calledOnce();
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
          message: 'Invalid mapping property "mappings.dinamic". Did you mean "dynamic" ?',
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
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
        });
    });
  });

  describe('#updateSettings', () => {
    let newSettings;

    beforeEach(() => {
      newSettings = {
        index: {
          blocks: {
            write: true
          }
        }
      };
    });

    it('should allow to change esindex settings', async () => {
      const result = await elasticsearch.updateSettings(
        index,
        collection,
        newSettings);

      should(elasticsearch._client.indices.putSettings).be.calledWithMatch({
        index: esIndexName,
        body: {
          index: {
            blocks: {
              write: true
            }
          }
        }
      });

      should(result).be.null();
    });

    it('should close then open the index when changing the analyzers', async () => {
      newSettings.analysis = {
        analyzer: { customer_analyzers: {} }
      };

      await elasticsearch.updateSettings(index, collection, newSettings);

      should(elasticsearch._client.indices.close).be.calledWithMatch({
        index: esIndexName
      });
      should(elasticsearch._client.indices.open).be.calledWithMatch({
        index: esIndexName
      });
    });

    it('should return a rejected promise if client.cat.putSettings fails', () => {
      elasticsearch._client.indices.putSettings.rejects(esClientError);

      const promise = elasticsearch.updateSettings(index, collection, newSettings);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
        });
    });
  });

  describe('#updateSearchIndex', () => {
    it('should call updateByQuery', async () => {
      elasticsearch._client.updateByQuery = sinon.stub().resolves();

      await elasticsearch.updateSearchIndex(index, collection);

      should(elasticsearch._client.updateByQuery).be.calledWithMatch({
        body: {},
        conflicts: 'proceed',
        index: '&nyc-open-data.yellow-taxi',
        refresh: true,
        waitForCompletion: false,
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

          { index: { _id: 2, _index: esIndexName, _type: undefined } },
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

        { index: { _id: 2, _type: undefined } },
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
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      await should(elasticsearch.listCollections(index)).be.rejected();

      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      await should(elasticsearch.listIndexes()).be.rejected();

      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
    });
  });

  describe('#listAliases', () => {
    beforeEach(() => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { index: 'mehry', alias: '&nepali.mehry' },
          { index: 'liia', alias: '&nepali.liia' },
          { index: 'taxi', alias: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow listing all available aliases', async () => {
      const result = await elasticsearch.listAliases();

      should(elasticsearch._client.cat.aliases).be.calledWithMatch({
        format: 'json'
      });

      should(result).match([
        { name: 'mehry', index: 'nepali', collection: 'mehry' },
        { name: 'liia', index: 'nepali', collection: 'liia' },
        { name: 'taxi', index: 'nyc-open-data', collection: 'taxi' },
      ]);
    });

    it('should not list unauthorized aliases', async () => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { index: 'alias-mehry', alias: '%nepali.mehry' },
          { index: 'alias-liia', alias: '%nepali.liia' },
          { index: 'alias-taxi', alias: '%nyc-open-data.taxi' },
          { index: 'alias-lfiduras', alias: '&vietnam.lfiduras' }
        ]
      });

      const result = await elasticsearch.listAliases();

      should(result).match([
        { name: 'alias-lfiduras', index: 'vietnam', collection: 'lfiduras' },
      ]);
    });

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.cat.aliases.rejects(esClientError);

      await should(elasticsearch.listAliases()).be.rejected();

      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
    });
  });

  describe('#listAliases', () => {
    beforeEach(() => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { index: 'mehry', alias: '&nepali.mehry' },
          { index: 'liia', alias: '&nepali.liia' },
          { index: 'taxi', alias: '&nyc-open-data.taxi' }
        ]
      });
    });

    it('should allow listing all available aliases', async () => {
      const result = await elasticsearch.listAliases();

      should(elasticsearch._client.cat.aliases).be.calledWithMatch({
        format: 'json'
      });

      should(result).match([
        { name: 'mehry', index: 'nepali', collection: 'mehry' },
        { name: 'liia', index: 'nepali', collection: 'liia' },
        { name: 'taxi', index: 'nyc-open-data', collection: 'taxi' },
      ]);
    });

    it('should not list unauthorized aliases', async () => {
      elasticsearch._client.cat.aliases.resolves({
        body: [
          { index: 'mehry', alias: '%nepali.mehry' },
          { index: 'liia', alias: '%nepali.liia' },
          { index: 'taxi', alias: '%nyc-open-data.taxi' },
          { index: 'lfiduras', alias: '&vietnam.lfiduras' }
        ]
      });

      const result = await elasticsearch.listAliases();

      should(result).match([
        { name: 'lfiduras', index: 'vietnam', collection: 'lfiduras' },
      ]);
    });

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.cat.aliases.rejects(esClientError);

      const promise = elasticsearch.listAliases();

      await should(promise).be.rejected();
      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.cat.indices.rejects(esClientError);

      await should(elasticsearch.listIndexes()).be.rejected();
      should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

    it('should return a rejected promise if client fails', async () => {
      elasticsearch._client.indices.refresh.rejects(esClientError);

      await should(elasticsearch.refreshCollection(index, collection)).rejected();

      should(elasticsearch._esWrapper.formatESError).calledWith(esClientError);
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

  describe('#hasIndex', () => {
    it('should call list indexes and return true if index exists', () => {
      elasticsearch.listIndexes = sinon.stub().resolves(
        ['nepali', 'nyc-open-data']);

      const promise = elasticsearch.hasIndex('nepali');

      return promise
        .then(result => {
          should(elasticsearch.listIndexes).be.called();

          should(result).be.eql(true);
        });
    });

    it('should call list indexes and return false if index does not exists', () => {
      elasticsearch.listIndexes = sinon.stub().resolves(
        ['nepali', 'nyc-open-data']);

      const promise = elasticsearch.hasIndex('vietnam');

      return promise
        .then(result => {
          should(elasticsearch.listIndexes).be.called();

          should(result).be.eql(false);
        });
    });
  });

  describe('#hasCollection', () => {
    it('should call list collections and return true if collection exists', () => {
      elasticsearch.listCollections = sinon.stub().resolves(['liia', 'mehry']);

      const promise = elasticsearch.hasCollection('nepali', 'liia');

      return promise
        .then(result => {
          should(elasticsearch.listCollections).be.called();

          should(result).be.eql(true);
        });
    });

    it('should call list collections and return false if collection does not exists', () => {
      elasticsearch.listCollections = sinon.stub().resolves(['liia', 'mehry']);

      const promise = elasticsearch.hasCollection('nepali', 'lfiduras');

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
                body: { _kuzzle_info: undefined, city: 'Ho Chi Minh City' }
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

    it('should forward the "limits" option to mExecute', async () => {
      await elasticsearch.mCreateOrReplace(
        index,
        collection,
        documents,
        { limits: false });

      const options = elasticsearch._mExecute.getCall(0).args[3];
      should(options.limits).be.false();
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
              document: { _id: undefined, body: { _kuzzle_info: undefined, city: 'Ho Chi Minh City' } },
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
              document: { _id: 'liia', body: { _kuzzle_info: undefined, city: 'Ho Chi Minh City' } },
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

    it('should allow to delete multiple documents with deleteByQuery', async () => {
      const result = await elasticsearch.mDelete(index, collection, documentIds);

      should(elasticsearch._client.indices.refresh).be.calledWith({
        index: `&${index}.${collection}`
      });

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

    it('should not reject if the documents limit is reached but the "limits" option is false', () => {
      kuzzle.config.limits.documentsWriteCount = 1;

      const promise = elasticsearch._mExecute(
        esRequest,
        documents,
        partialErrors,
        { limits: false });

      return should(promise).be.fulfilled();
    });

    it('should return a rejected promise if client fails', () => {
      elasticsearch._client.bulk.rejects(esClientError);

      const promise = elasticsearch._mExecute(esRequest, documents, partialErrors);

      return should(promise).be.rejected()
        .then(() => {
          should(elasticsearch._esWrapper.formatESError).be.calledWith(esClientError);
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

  describe('#isIndexNameValid', () => {
    it('should allow a valid index name', () => {
      should(elasticsearch.isIndexNameValid('foobar')).be.true();
    });

    it('should not allow empty index names', () => {
      should(elasticsearch.isIndexNameValid('')).be.false();
    });

    it('should not allow uppercase chars', () => {
      should(elasticsearch.isIndexNameValid('bAr')).be.false();
    });

    it('should not allow index names that are too long', () => {
      return should(elasticsearch.isIndexNameValid('Ӣ'.repeat(64))).be.false();
    });

    it('should not allow forbidden chars in the name', () => {
      const forbidden = '\\/*?"<>| \t\r\n,#:%.&';

      for (let i = 0; i < forbidden.length; i++) {
        const name = `foo${forbidden[i]}bar`;

        should(elasticsearch.isIndexNameValid(name)).be.false();
      }
    });
  });

  describe('#isCollectionNameValid', () => {
    it('should allow a valid collection name', () => {
      should(elasticsearch.isCollectionNameValid('foobar')).be.true();
    });

    it('should not allow empty collection names', () => {
      should(elasticsearch.isCollectionNameValid('')).be.false();
    });

    it('should not allow uppercase chars', () => {
      should(elasticsearch.isCollectionNameValid('bAr')).be.false();
    });

    it('should not allow collection names that are too long', () => {
      return should(elasticsearch.isCollectionNameValid('Ӣ'.repeat(64)))
        .be.false();
    });

    it('should not allow forbidden chars in the name', () => {
      const forbidden = '\\/*?"<>| \t\r\n,#:%.&';

      for (let i = 0; i < forbidden.length; i++) {
        const name = `foo${forbidden[i]}bar`;

        should(elasticsearch.isCollectionNameValid(name)).be.false();
      }
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
          message: 'Invalid mapping property "mappings.dinamic". Did you mean "dynamic" ?',
          id: 'services.storage.invalid_mapping'
        });

      should(() => elasticsearch._checkMappings(mapping2))
        .throw({
          message: 'Invalid mapping property "mappings.type".',
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
          message: 'Invalid mapping property "mappings.properties.car.dinamic". Did you mean "dynamic" ?',
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
      internalES = new ES(
        kuzzle,
        kuzzle.config.services.storageEngine,
        scopeEnum.PRIVATE);
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
