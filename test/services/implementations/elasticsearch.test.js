'use strict';

const
  should = require('should'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    NotFoundError,
    KuzzleError,
    PreconditionError,
    ExternalServiceError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors,
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', () => {
  let
    kuzzle = {},
    index = 'test',
    collection = 'unit-tests-elasticsearch',
    createdDocumentId = 'id-test',
    elasticsearch,
    engineType = 'storageEngine',
    request,
    documentAda,
    filter,
    filterAfterActiveAdded,
    rawKuzzleInfo;

  beforeEach(() => {
    // prevents embarking _kuzzle_info data from previous tests
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London',
      hobby: 'computer'
    };

    kuzzle = new KuzzleMock();
    ES.__set__('buildClient', () => new ESClientMock());
    elasticsearch = new ES(kuzzle, {service: engineType}, kuzzle.config.services.db);
    elasticsearch.autoRefresh = {};

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
    filterAfterActiveAdded = {
      query: {
        bool: {
          must: filter.query,
          filter: {
            bool: {
              must_not: {
                term: {
                  '_kuzzle_info.active': false
                }
              }
            }
          }
        }
      },
      sort: {},
      aggregations: {},
      aggs: {}
    };

    rawKuzzleInfo = {
      query: {
        bool: {
          filter: {
            bool: {
              must_not: {
                term: {
                  '_kuzzle_info.active': false
                }
              }
            }
          }
        }
      }
    };

    request = new Request({
      controller: 'document',
      action: 'create',
      requestId: 'foo',
      collection,
      index,
      body: documentAda
    }, {token: {userId: 'test'}, user: {_id: 'test'}});
    elasticsearch.init();
  });

  describe('#init', () => {
    it('should initialize properly', () => {
      return should(elasticsearch.init()).be.fulfilledWith(elasticsearch);
    });
  });

  describe('#initESRequest', () => {
    it('should prepare the data for elasticsearch', () => {
      const initESRequest = ES.__get__('initESRequest');

      request.input.resource._id = 'foobar';
      ['unrecognized', 'from', 'size', 'scroll', 'scrollId', 'refresh'].forEach(arg => {
        request.input.args[arg] = arg;
      });

      let preparedData = initESRequest(request,
        ['from', 'size', 'scroll', 'scrollId', 'refresh']);

      should(preparedData.type).be.exactly(request.input.resource.collection);
      should(preparedData.id).be.undefined();
      should(preparedData._id).be.undefined();
      should(preparedData.index).be.exactly(request.input.resource.index);

      should(preparedData)
        .not.have.property('unrecognized');
      ['from', 'size', 'scroll', 'scrollId', 'refresh'].forEach(arg => {
        should(preparedData[arg]).be.exactly(arg);
      });
    });

    it('should throw if attempting to access to an internal index', () => {
      const initESRequest = ES.__get__('initESRequest');

      request.input.resource.index = '%foobar';

      should(() => initESRequest(request)).throw(BadRequestError);
    });
  });

  describe('#search', () => {
    it('should be able to search documents', () => {
      elasticsearch.client.search.resolves({total: 0, hits: [{_id: 'foo', _source: {foo: 'bar'}}]});

      request.input.body = filter;
      return elasticsearch.search(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].body).be.deepEqual(filterAfterActiveAdded);
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should handle search results without a _source property', () => {
      elasticsearch.client.search.resolves({total: 0, hits: [{_id: 'foo'}]});

      request.input.body = filter;
      return elasticsearch.search(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].body).be.deepEqual(filterAfterActiveAdded);
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should be able to search with from/size and scroll arguments', () => {
      elasticsearch.client.search.resolves({total: 0, hits: [], _scroll_id: 'banana42'});

      request.input.body = filter;
      request.input.args.from = 0;
      request.input.args.size = 1;
      request.input.args.scroll = '30s';

      return elasticsearch.search(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0]).be.deepEqual({
            from: 0,
            size: 1,
            scroll: '30s',
            index: index,
            type: collection,
            body: filterAfterActiveAdded
          });
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
          should(result._scroll_id).be.exactly('banana42');
          should(result.scrollId).be.exactly('banana42');
        });
    });

    it('should return a rejected promise if a search fails', done => {
      elasticsearch.client.search.rejects(new Error('Mocked error'));

      elasticsearch.search(request)
        .then(() => done('should have been rejected'))
        .catch(() => {
          try {
            should(elasticsearch.client.search.firstCall.args[0].body).not.be.exactly(filter);
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#scroll', () => {
    it('should be able to scroll an old search', () => {
      const req = new Request({
        scrollId: 'banana42'
      });
      elasticsearch.client.scroll.resolves({total: 0, hits: []});

      return elasticsearch.scroll(req)
        .then(result => {
          should(elasticsearch.client.scroll.firstCall.args[0]).be.deepEqual({scrollId: 'banana42', scroll: '15s'});
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should return a rejected promise if a scroll fails', () => {
      elasticsearch.client.scroll.rejects(new Error('error'));

      request.input.args.scrollId = 'foobar';
      return should(elasticsearch.scroll(request)).be.rejectedWith(Error, {message: 'error'});
    });
  });

  describe('#create', () => {
    it('should allow creating documents if the document does not already exists', () => {
      sinon.stub(elasticsearch, 'refreshIndex').resolves();
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.index.resolves({});

      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return elasticsearch.create(request)
        .then(() => {
          let data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);

          should(elasticsearch.client.get).not.be.called();

          should(elasticsearch.refreshIndex)
            .be.calledOnce();
          should(elasticsearch.refreshIndex.firstCall.args[0].index).be.eql(request.index);
        });
    });

    it('should replace a document because it already exists but is inactive', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.index.resolves({});
      elasticsearch.client.get.resolves({_source: {_kuzzle_info: {active: false}}});
      request.input.resource._id = '42';

      return elasticsearch.create(request)
        .then(() => {
          const data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should create a document with a non existing id', () => {
      const
        error = new Error('Mocked error'),
        refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.create.resolves({});
      error.displayName = 'NotFound';

      elasticsearch.client.get.rejects(error);
      request.input.resource._id = '42';

      return elasticsearch.create(request)
        .then(() => {
          const data = elasticsearch.client.create.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should reject the create promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked create error');
      elasticsearch.client.get.rejects(new Error('Mocked create error'));
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = 'foobar';

      return should(elasticsearch.create(request)).be.rejectedWith(error);
    });

    it('should reject the create promise if client.index throws an error', () => {
      const error = new Error('Mocked index error');
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.get.resolves({_source: {_kuzzle_info: {active: false}}});
      elasticsearch.client.index.rejects(error);
      request.input.resource._id = '42';

      return should(elasticsearch.create(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });

    it('should reject a promise if the document already exists', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.get.resolves({_source: {_kuzzle_info: {active: true}}});
      request.input.resource._id = '42';

      return should(elasticsearch.create(request)).be.rejectedWith(BadRequestError);
    });

    it('should reject if index or collection don\'t exist', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);
      elasticsearch.client.index.resolves({});

      return should(elasticsearch.create(request)).be.rejectedWith(PreconditionError);
    });
  });

  describe('#createOrReplace', () => {
    it('should support createOrReplace capability', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      elasticsearch.client.index.resolves({});
      request.input.resource._id = createdDocumentId;

      return elasticsearch.createOrReplace(request)
        .then(() => {
          const data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);
          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should reject the createOrReplace promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');

      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.index.rejects(error);

      request.input.resource._id = createdDocumentId;
      return should(elasticsearch.createOrReplace(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });

    it('should reject if index or collection don\'t exist', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(false);

      elasticsearch.client.index.resolves({});
      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.createOrReplace(request)).be.rejectedWith(PreconditionError);
    });
  });

  describe('#replace', () => {
    it('should support replace capability', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.index.resolves({});
      elasticsearch.client.exists.resolves(true);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;

      return elasticsearch.replace(request)
        .then(() => {
          const data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);
          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should reject the replace promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');

      elasticsearch.client.exists.resolves(true);
      elasticsearch.client.index.rejects(error);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.replace(request)).be.rejectedWith(error);
    });

    it('should throw a NotFoundError Exception if document already exists', done => {
      elasticsearch.client.exists.resolves(false);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      kuzzle.indexes = {};
      request.input.resource._id = createdDocumentId;

      elasticsearch.replace(request)
        .catch(err => {
          try {
            should(err).be.an.instanceOf(NotFoundError);
            should(err.message).be.exactly(`Document with id "${request.input.resource._id}" not found.`);
            should(elasticsearch.client.index).not.be.called();

            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should reject if index or collection don\'t exist', () => {
      elasticsearch.client.exists.resolves(false);
      elasticsearch.kuzzle.indexCache.exists.resolves(false);

      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.replace(request)).be.rejectedWith(PreconditionError);
    });

    it('should support replace capability', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.index.resolves({});
      elasticsearch.client.exists.resolves(true);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;

      return elasticsearch.replace(request)
        .then(() => {
          const data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);
          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });
  });

  describe('#get', () => {
    it('should allow getting a single document', () => {
      elasticsearch.client.get.resolves({_source: {_kuzzle_info: {active: true}}});

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return elasticsearch.get(request)
        .then(() => {
          should(elasticsearch.client.get.firstCall.args[0].id).be.exactly(createdDocumentId);
        });
    });

    it('should not throw error when "_source" is not defined', () => {
      elasticsearch.client.get.resolves({foo: 'bar'});

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return elasticsearch.get(request);
    });

    it('should reject requests when document is on inactive stat', () => {
      elasticsearch.client.get.resolves({_source: {_kuzzle_info: {active: false}}});

      return should(elasticsearch.get(request)).be.rejectedWith(NotFoundError);
    });

    it('should reject requests when the user search for a document with id _search', () => {
      request.input.resource._id = '_search';

      return should(elasticsearch.get(request)).be.rejectedWith(BadRequestError);
    });

    it('should allow expose kuzzle metadata in _source._kuzzle_info and _meta properties', () => {
      elasticsearch.client.get.returns(Bluebird.resolve({_source: {_kuzzle_info: {active: true}}}));

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return elasticsearch.get(request)
        .then(response => {
          should(response._source._kuzzle_info).be.eql(response._meta);
        });
    });
  });

  describe('#mget', () => {
    it('should return a rejected promise if getting a single document fails', done => {
      elasticsearch.client.mget.rejects(new Error('Mocked error'));

      elasticsearch.mget(request)
        .catch(() => {
          try {
            should(elasticsearch.client.mget.calledOnce).be.true();
            should(elasticsearch.client.mget.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should allow getting multiples documents', () => {
      elasticsearch.client.mget.resolves({});

      request.input.body = {ids: ['1', '2', '3']};

      return elasticsearch.mget(request)
        .then(() => {
          should(elasticsearch.client.mget.firstCall.args[0].body.ids).be.an.Array();
        });
    });

    it('should return a rejected promise if getting some multiple documents fails', done => {
      elasticsearch.client.mget.rejects(new Error('Mocked error'));

      request.input.body = {};

      elasticsearch.mget(request)
        .catch(() => {
          try {
            should(elasticsearch.client.mget.firstCall.args[0].body.ids).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#count', () => {
    it('should allow counting documents using a provided filter', () => {
      elasticsearch.client.count.resolves({});

      request.input.body = {};

      return elasticsearch.count(request)
        .then(() => {
          should(elasticsearch.client.count.firstCall.args[0].body).be.deepEqual(rawKuzzleInfo);
        });
    });

    it('should allow counting objects using a query', () => {
      elasticsearch.client.count.resolves({});

      request.input.body = {};
      request.input.body = {query: {foo: 'bar'}};
      rawKuzzleInfo.query.bool.must = request.input.body.query;

      return elasticsearch.count(request)
        .then(() => {
          should(elasticsearch.client.count)
            .be.calledOnce();

          should(elasticsearch.client.count.firstCall.args[0].body).be.deepEqual(rawKuzzleInfo);
        });
    });

    it('should return a rejected promise if the count fails', () => {
      const error = new Error('Mocked error');
      elasticsearch.client.count.rejects(error);

      request.input.body = {query: {foo: 'bar'}};

      return should(elasticsearch.count(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#update', () => {
    it('should allow to update a document', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.update.resolves({});
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;

      return elasticsearch.update(request)
        .then(() => {
          const data = elasticsearch.client.update.firstCall.args[0];

          should(data.retryOnConflict).be.undefined();
          should(data.body.doc).be.exactly(documentAda);
          should(data.body.doc._kuzzle_info).be.an.Object();
          should(data.body.doc._kuzzle_info.updatedAt).be.a.Number();
          should(data.body.doc._kuzzle_info.updater).be.eql('test');
          should(data.body.doc._kuzzle_info.active).be.true();

          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should handle the retryOnConflict optional argument', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.config.defaults.onUpdateConflictRetries = 42;
      elasticsearch.client.update.resolves({});
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;
      request.input.args.retryOnConflict = 13;

      return elasticsearch.update(request)
        .then(() => {
          const data = elasticsearch.client.update.firstCall.args[0];

          should(data.retryOnConflict).be.eql(13);
          should(data.body.doc).be.exactly(documentAda);
          should(data.body.doc._kuzzle_info).be.an.Object();
          should(data.body.doc._kuzzle_info.updatedAt).be.a.Number();
          should(data.body.doc._kuzzle_info.updater).be.eql('test');
          should(data.body.doc._kuzzle_info.active).be.true();

          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should handle the onUpdateConflictRetries default configuration', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.config.defaults.onUpdateConflictRetries = 42;
      elasticsearch.client.update.resolves({});
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      request.input.resource._id = createdDocumentId;

      return elasticsearch.update(request)
        .then(() => {
          const data = elasticsearch.client.update.firstCall.args[0];

          should(data.retryOnConflict).be.eql(42);
          should(data.body.doc).be.exactly(documentAda);
          should(data.body.doc._kuzzle_info).be.an.Object();
          should(data.body.doc._kuzzle_info.updatedAt).be.a.Number();
          should(data.body.doc._kuzzle_info.updater).be.eql('test');
          should(data.body.doc._kuzzle_info.active).be.true();

          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should reject if index or collection don\'t exist', () => {
      elasticsearch.client.exists.resolves(false);
      elasticsearch.kuzzle.indexCache.exists.resolves(false);

      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.update(request)).be.rejectedWith(PreconditionError);
    });

    it('should return a rejected promise with a NotFoundError when updating a document which does not exist', done => {
      const
        esError = new Error('test');

      esError.displayName = 'NotFound';
      esError.body = {
        error: {
          reason: 'foo'
        }
      };

      esError.body.error['resource.id'] = 'bar';
      elasticsearch.client.update.rejects(esError);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      elasticsearch.update(request)
        .catch((error) => {
          try{
            should(error).be.instanceOf(NotFoundError);
            should(error.message).be.equal('foo: bar');
            should(elasticsearch.client.update.firstCall.args[0].id).be.null();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should return a rejected promise with a customised NotFoundError when elasticsearch throws a known error', done => {
      const
        esError = new Error('[index_not_found_exception] no such index, with { resource.type=index_or_alias resource.id=banana index=banana }');

      esError.displayName = 'NotFound';
      esError.body = {
        error: {
          reason: 'foo'
        }
      };

      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      elasticsearch.client.update.rejects(esError);

      elasticsearch.update(request)
        .catch((error) => {
          try{
            should(error).be.instanceOf(NotFoundError);
            should(error.message).be.equal('Index "banana" does not exist, please create it first');
            should(error.internalError).eql(esError);
            should(error.service).be.equal('elasticsearch');
            should(elasticsearch.client.update.firstCall.args[0].id).be.null();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should return a rejected promise with an Error if an update fails for unknown reason', () => {
      const
        esError = new Error('banana error');

      elasticsearch.client.update.rejects(esError);
      elasticsearch.kuzzle.indexCache.exists.resolves(true);

      return should(elasticsearch.update(request)).be.rejected();
    });
  });

  describe('#delete', () => {
    it('should allow to delete a document', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.update.resolves({});
      elasticsearch.client.get.resolves({
        _source: {
          _kuzzle_info: {
            active: true
          }
        }
      });

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return elasticsearch.delete(request)
        .then(() => {
          should(elasticsearch.client.update.firstCall.args[0].id).be.exactly(createdDocumentId);
          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should return a rejected promise if a delete fails', () => {
      elasticsearch.client.update.rejects(new Error('Mocked error'));

      return should(elasticsearch.delete(request)).be.rejected();
    });
  });

  describe('#deleteByQuery', () => {
    beforeEach(() => {
      request.input.body = {
        query: {
          term: {firstName: 'foobar'}
        }
      };
    });

    it('should return an empty result array when no document has been deactivated using a filter', () => {
      elasticsearch.client.search.yields(null, {hits: {hits: [], total: 0}});

      return elasticsearch.deleteByQuery(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0]).not.be.undefined();

          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
        });
    });

    it('should allow to deactivate documents using a provided filter', () => {
      const
        refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded'),
        mockupIds = ['foo', 'bar', 'baz'],
        getAllIdsStub = sinon.stub().resolves(mockupIds);

      elasticsearch.client.bulk.resolves(mockupIds);

      return ES.__with__({
        getAllIdsFromQuery: getAllIdsStub,
        Date: {
          now: () => 42
        }
      })(() => {
        return elasticsearch.deleteByQuery(request)
          .then(result => {
            const bulkData = elasticsearch.client.bulk.firstCall.args[0];

            // elasticsearch.client.bullk
            should(bulkData.body).not.be.undefined().and.be.an.Array();
            // (mockupIds.length * 2) because there is update requests with body
            should(bulkData.body.length).be.exactly(mockupIds.length * 2);

            bulkData.body.forEach(cmd => {
              should(cmd).be.an.Object();
              if (cmd.update) {
                should(cmd.update).not.be.undefined().and.be.an.Object();
                should(mockupIds.indexOf(cmd.update._id)).not.be.eql(-1);
                should(cmd.update._type).be.exactly(request.input.resource.collection);
              }
              if (cmd.doc) {
                should(cmd.doc).not.be.undefined().and.be.an.Object();
                should(cmd.doc).be.eql({_kuzzle_info: { active: false, deletedAt: 42, updater: 'test' }});
              }
            });

            // elasticserach.deleteByQuery
            should(result.ids).not.be.undefined().and.be.an.Array();
            should(result.ids).match(mockupIds);

            // refreshIndexIfNeeded
            should(refreshIndexSpy.calledOnce).be.true();
          });
      });
    });

    it('should return a rejected promise if the delete by query fails because of a bad filter', () => {
      elasticsearch.client.search.yields(new Error(), {});

      return should(elasticsearch.deleteByQuery(request)).be.rejected();
    });

    it('should return a rejected promise if the delete by query fails because of a bulk failure', () => {
      const error = new KuzzleError('Mocked error');
      elasticsearch.client.bulk.rejects(error);

      request.input.body.query = {some: 'query'};

      return ES.__with__({
        getAllIdsFromQuery: () => Bluebird.resolve(['foo', 'bar'])
      })(() => {
        return should(elasticsearch.deleteByQuery(request)).be.rejectedWith(error);
      });
    });

    it('should return a rejected promise if the delete by query fails because the filter is null', () => {
      request.input.body.query = null;

      return should(elasticsearch.deleteByQuery(request)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#deleteByQueryFromTrash', () => {
    it('should return an empty result array when no document has been deleted using a filter', () => {
      elasticsearch.client.search.yields(null, {hits: {hits: [], total: 0}});

      delete request.input.body;
      request.input.body.query = {term: {firstName: 'no way any document can be returned with this filter'}};

      return elasticsearch.deleteByQueryFromTrash(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].body.query).be.exactly(request.input.body.query);

          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
        });
    });

    it('should allow to delete inactive documents using a provided filter from the trash', () => {
      const
        refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded'),
        mockupIds = ['foo', 'bar', 'baz'],
        getAllIdsStub = sinon.stub().resolves(mockupIds);

      elasticsearch.client.bulk.resolves(mockupIds);
      elasticsearch.client.search.yields(null, {hits: {hits: [{_id: 'foo'}, {_id: 'bar'}, {_id: 'baz'}], total: mockupIds.length}});

      return ES.__with__({
        getAllIdsFromQuery: getAllIdsStub,
        Date: {
          now: () => 42
        }
      })(() => {
        return should(elasticsearch.deleteByQueryFromTrash(request)
          .then(result => {
            const bulkData = elasticsearch.client.bulk.firstCall.args[0];

            // elasticsearch.client.bulk
            should(bulkData.body).not.be.undefined().and.be.an.Array();
            should(bulkData.body.length).be.exactly(mockupIds.length);

            bulkData.body.forEach(cmd => {
              should(cmd).be.an.Object();
              should(cmd.delete).not.be.undefined().and.be.an.Object();
              should(mockupIds.indexOf(cmd.delete._id)).not.be.eql(-1);
              should(cmd.delete._type).be.exactly(request.input.resource.collection);
            });

            // elasticserach.deleteByQuery
            should(result.ids).not.be.undefined().and.be.an.Array();
            should(result.ids).match(mockupIds);

            // refreshIndexIfNeeded
            should(refreshIndexSpy.calledOnce).be.true();
          }));
      });
    });

    it('should return a rejected promise if the delete by query fails because of a bad filter', () => {
      elasticsearch.client.search.yields(new Error(), {});

      return should(elasticsearch.deleteByQuery(request)).be.rejected();
    });

    it('should reject the promise if the delete by query fails because of a bulk failure', () => {
      const error = new KuzzleError('Mocked error');
      elasticsearch.client.bulk.rejects(error);

      request.input.body.query = {some: 'query'};

      return ES.__with__({
        getAllIdsFromQuery: () => Bluebird.resolve(['foo', 'bar'])
      })(() => {
        return should(elasticsearch.deleteByQuery(request)).be.rejectedWith(error);
      });
    });

    it('should return a rejected promise if the delete by query fails because the filter is null', () => {
      request.input.body.query = null;

      return should(elasticsearch.deleteByQuery(request)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#import', () => {
    it('should support bulk data import', () => {
      const
        refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.bulk.resolves({});
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 1, _type: collection, _index: 'alias'}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      return elasticsearch.import(request)
        .then(() => {
          should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(request.input.body.bulkData);
          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should add metadata to documents', () => {
      elasticsearch.client.bulk.resolves({});
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: 'alias'}},
          {firstName: 'bar'},
          {create: {_id: 3, _type: collection, _index: index}},
          {firstName: 'gordon'},
          {update: {_id: 1, _type: collection, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      return elasticsearch.import(request)
        .then(() => {
          const body = elasticsearch.client.bulk.firstCall.args[0].body;

          // Bulk action: index
          should(body[1]._kuzzle_info).be.type('object');
          should(body[1]._kuzzle_info.author).be.exactly('test');
          should(body[1]._kuzzle_info.createdAt).be.belowOrEqual(Date.now());
          should(body[1]._kuzzle_info.updatedAt).be.null();
          should(body[1]._kuzzle_info.updater).be.null();
          should(body[1]._kuzzle_info.active).be.ok();
          should(body[1]._kuzzle_info.deletedAt).be.null();

          // Bulk action: create
          should(body[5]._kuzzle_info).be.type('object');
          should(body[5]._kuzzle_info.author).be.exactly('test');
          should(body[5]._kuzzle_info.createdAt).be.belowOrEqual(Date.now());
          should(body[5]._kuzzle_info.updatedAt).be.null();
          should(body[5]._kuzzle_info.updater).be.null();
          should(body[5]._kuzzle_info.active).be.ok();
          should(body[5]._kuzzle_info.deletedAt).be.null();

          // Bulk action: update
          should(body[7].doc._kuzzle_info).be.type('object');
          should(body[7].doc._kuzzle_info.updater).be.exactly('test');
          should(body[7].doc._kuzzle_info.updatedAt).not.be.null();
        });
    });

    it('should inject only the allowed optional parameters', () => {
      const refreshIndexSpy = sinon.spy(elasticsearch, 'refreshIndexIfNeeded');

      elasticsearch.client.bulk.resolves({});
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([]);

      request.input.body = {
        bulkData: []
      };
      request.input.args.consistency = 'foo';
      request.input.args.refresh = 'wait_for';
      request.input.args.routing = 'foo/bar';
      request.input.args.timeout = 999;
      request.input.args.fields = 'foo, bar, baz';

      return elasticsearch.import(request)
        .then(() => {
          const arg = elasticsearch.client.bulk.firstCall.args[0];

          should(arg)
            .not.have.properties([
              'consistency',
              'routing',
              'timeout',
              'fields'
            ]);
          should(arg.refresh)
            .be.exactly('wait_for');

          should(refreshIndexSpy.calledOnce).be.true();
        });
    });

    it('should raise a "Partial Error" response for bulk data import with some errors', () => {
      elasticsearch.client.bulk.resolves({
        errors: true,
        items: [
          {index: {status: 404, error: 'DocumentMissingException'}},
          {index: {status: 404, error: 'DocumentMissingException'}}
        ]
      });
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 12, _type: collection, _index: 'alias'}},
          {doc: {firstName: 'foobar'}},
          {update: {_id: 212, _type: collection, _index: index}},
          {doc: {firstName: 'foobar'}}
        ]
      };

      return elasticsearch.import(request)
        .then(result => {
          should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(request.input.body.bulkData);

          should(result.errors).be.true();
          should(result.partialErrors).be.an.Array().and.match([{status: 404}]).and.match([{error: /^DocumentMissingException/}]);
        });
    });

    it('should override the type with the collection if one has been specified in the request', () => {
      elasticsearch.client.bulk.resolves({
        items: [
          {index: {_id: 1, _index: index, _type: collection}},
          {index: {_id: 2, _index: 'indexAlt', _type: collection}},
          {update: {_id: 1, _index: index, _type: collection}},
          {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
        ]
      });
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } },
        indexAlt: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _index: 'indexAlt'}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: 'alias'}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _index: 'indexAlt'}}
        ]
      };

      return elasticsearch.import(request)
        .then(() => {
          const data = elasticsearch.client.bulk.firstCall.args[0];

          should(data.body).be.an.Array().and.match([
            {index: {_id: 1, _index: index, _type: collection}},
            {firstName: 'foo'},
            {index: {_id: 2, _index: 'indexAlt', _type: collection}},
            {firstName: 'bar'},
            {update: {_id: 1, _index: 'alias', _type: collection}},
            {doc: {firstName: 'foobar'}},
            {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
          ]);

        });
    });

    it('should reject the import promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([]);

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _index: index}}
        ]
      };

      elasticsearch.client.bulk.rejects(error);

      return should(elasticsearch.import(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });

    it('should return a rejected promise if bulk data try to write into internal index', () => {
      request.input.body = {
        bulkData: [
          {index: {_id: 1, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _index: kuzzle.internalEngine.index}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _index: index}}
        ]
      };
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } },
        [kuzzle.internalEngine.index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([]);

      elasticsearch.client.bulk.resolves({});

      return should(elasticsearch.import(request)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if body contains no bulkData parameter', () => {
      request.input.body.bulkData = null;
      return should(elasticsearch.import(request)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if no type has been provided, locally or globally', () => {
      request.input.resource.collection = null;

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: 'alias'}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      elasticsearch.client.bulk.resolves({});
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      return should(elasticsearch.import(request)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if no index has been provided, locally or globally', () => {
      request.input.resource.index = null;

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 1, _type: collection}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      elasticsearch.client.bulk.resolves({});
      const getMappingResult = {
        [index]: { mappings: { [collection]: {} } }
      };
      elasticsearch.client.indices.getMapping.resolves(getMappingResult);
      elasticsearch.client.cat.aliases.resolves([
        {alias: 'alias', index}
      ]);

      return should(elasticsearch.import(request)).be.rejectedWith(BadRequestError);
    });

    it('should rejected if index and/or collection don\'t exist', () => {
      elasticsearch.client.indices.getMapping.resolves({});
      elasticsearch.client.cat.aliases.resolves([]);
      request.input.resource.index = null;

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
        ]
      };

      elasticsearch.client.bulk.resolves({});

      return should(elasticsearch.import(request)).be.rejectedWith(PreconditionError);
    });
  });

  describe('#updateMapping', () => {
    let
      getMappingReturn;

    beforeEach(() => {
      getMappingReturn = {
        [index]: {
          mappings: {
            [collection]: {}
          }
        }
      };

      elasticsearch.esWrapper.getMapping = sinon.stub().resolves(getMappingReturn);
    });

    it('should have mapping capabilities', () => {
      elasticsearch.client.indices.putMapping.resolves({});

      request.input.body = {
        dynamic: 'true',
        properties: {
          city: {type: 'string'}
        }
      };

      return elasticsearch.updateMapping(request)
        .then(() => {
          const arg = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(arg.body.properties.city)
            .be.exactly(request.input.body.properties.city);
        });
    });

    it('should reject and handle error for bad mapping input', done => {
      const
        error = new Error('test');

      error.displayName = 'BadRequest';
      error.body = {
        error: {
          reason: 'foo'
        }
      };

      elasticsearch.client.indices.putMapping.rejects(error);

      elasticsearch.updateMapping(request)
        .catch((err) => {
          try {
            should(err).be.instanceOf(BadRequestError);
            should(err.message).be.equal('foo');
            should(elasticsearch.client.indices.putMapping.firstCall.args[0]).not.have.key('properties');
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should get existing _meta and dynamic policy for the collection', () => {
      getMappingReturn[index].mappings[collection] = {
        dynamic: 'strict',
        _meta: { gordon: 'freeman' }
      };

      return elasticsearch.updateMapping(request)
        .then(() => {
          should(elasticsearch.esWrapper.getMapping).be.calledOnce();

          const esRequest = elasticsearch.client.indices.putMapping.firstCall.args[0];
          should(esRequest.body.dynamic).be.eql('strict');
          should(esRequest.body._meta).match({ gordon: 'freeman' });
        });
    });

    it('should inject default mapping for the index', () => {
      const expectedKuzzleMeta = {
        properties: {
          active: { type: 'boolean' },
          author: { type: 'text' }, // This one differ from commonMapping
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          updater: { type: 'keyword' },
          deletedAt: { type: 'date' }
        }
      };
      getMappingReturn[index].mappings[collection] = {
        properties: {
          _kuzzle_info: {
            properties: {
              author: { type: 'text' }
            }
          }
        }
      };

      return elasticsearch.updateMapping(request)
        .then(() => {
          should(elasticsearch.esWrapper.getMapping).be.calledOnce();

          const esRequest = elasticsearch.client.indices.putMapping.firstCall.args[0];
          should(esRequest.body.properties._kuzzle_info).match(expectedKuzzleMeta);
        });
    });

    it('should inject the default mapping', () => {
      elasticsearch.client.indices.putMapping.resolves({});

      elasticsearch.config.commonMapping = {
        foo: {type: 'boolean'},
        _kuzzle_info: {
          properties: {
            active: {type: 'boolean'},
            author: {type: 'text'},
            createdAt: {type: 'date'},
            updatedAt: {type: 'date'},
            updater: {type: 'keyword'},
            deletedAt: {type: 'date'}
          }
        }
      };

      request.input.body = {
        properties: {
          city: {type: 'string'}
        }
      };

      return elasticsearch.updateMapping(request)
        .then(() => {
          const esReq = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(esReq.body).eql({
            dynamic: true,
            _meta: {},
            properties: {
              city: {type: 'string'},
              foo: {type: 'boolean'},
              _kuzzle_info: {
                properties: {
                  active: {type: 'boolean'},
                  author: {type: 'text'},
                  createdAt: {type: 'date'},
                  updatedAt: {type: 'date'},
                  updater: {type: 'keyword'},
                  deletedAt: {type: 'date'}
                }
              }
            }
          });
        });
    });

    it('should create a fresh mapping for each collection', () => {
      const mapping = Object.assign({}, elasticsearch.config.commonMapping);

      return elasticsearch.updateMapping(new Request({
        index,
        collection,
        controller: 'collection',
        action: 'updateMapping',
        body: {
          properties: {
            foo: {
              type: 'text'
            }
          }
        }
      }))
        .then(() => elasticsearch.updateMapping(new Request({
          index,
          collection,
          controller: 'collection',
          action: 'updateMapping',
          body: {
            properties: {
              bar: {
                type: 'integer'
              }
            }
          }
        })))
        .then(() => {
          should(elasticsearch.config.commonMapping).eql(mapping);
        });
    });

    it('should reuse a previously defined common mapping', () => {
      kuzzle.indexCache.defaultMappings[index] = {
        gordon: { type: 'text' }
      };

      return elasticsearch.updateMapping(new Request({
        index,
        collection,
        body: {
          properties: {
            freeman: { type: 'boolean' }
          }
        }
      }))
        .then(() => {
          const esReq = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(esReq).eql({
            index,
            type: collection,
            body: {
              dynamic: true,
              _meta: {},
              properties: {
                gordon: { type: 'text' },
                freeman: { type: 'boolean' }
              }
            }
          });
        });
    });
  });

  describe('#getMapping', () => {
    beforeEach(() => {
      elasticsearch.esWrapper.getMapping = sinon.stub().resolves({foo: 'bar'});
    });

    it('should forward the request to elasticseach wrapper', () => {
      return elasticsearch.getMapping(request)
        .then(res => {
          should(elasticsearch.esWrapper.getMapping)
            .be.calledOnce()
            .be.calledWithExactly({ index: 'test', type: 'unit-tests-elasticsearch'}, false);
          should(res).match({foo: 'bar'});
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

  describe('#listCollections', () => {
    it('should allow listing all available collections', () => {
      const
        mappings = {
          [index]: {
            mappings: {
              [collection]: {}
            }
          }
        };

      elasticsearch.client.indices.getMapping.resolves(mappings);
      request.input.body = null;
      return elasticsearch.listCollections(request);
    });

    it('should reject the listCollections promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.rejects(error);

      request.input.resource.index = 'kuzzle-unit-tests-fakeindex';
      request.input.body = null;
      return should(elasticsearch.listCollections(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });

  describe('#createCollection', () => {
    beforeEach(() => {
      request.input.resource.collection = '%foobar';

      elasticsearch.client.indices.putMapping.resolves({});
      elasticsearch.kuzzle.indexCache.exists
        .onCall(0).resolves(true)
        .onCall(1).resolves(false);
    });

    it('should allow creating a new collection', () => {
      return elasticsearch.createCollection(request);
    });

    it('should reject the createCollection promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      elasticsearch.client.indices.putMapping.rejects(error);

      return should(
        elasticsearch.createCollection(request)
      ).be.rejectedWith(ExternalServiceError, {message: error.message});
    });

    it('should reject if index doesn\'t exist', () => {
      elasticsearch.kuzzle.indexCache.exists.onCall(0).resolves(false);

      return should(
        elasticsearch.createCollection(request)
      ).be.rejectedWith(PreconditionError);
    });

    it('should inject default mapping for index', () => {
      elasticsearch.config.dynamic = 'strict';
      elasticsearch.kuzzle.indexCache.defaultMappings[index] = {
        foo: { type: 'boolean' },
        _kuzzle_info: {
          properties: {
            active: { type: 'boolean' },
            author: { type: 'text' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            updater: { type: 'keyword' },
            deletedAt: { type: 'date' }
          }
        }
      };

      return elasticsearch.createCollection(request)
        .then(() => {
          const esRequest = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(esRequest.body.properties).match({
            foo: { type: 'boolean' },
            _kuzzle_info: {
              properties: {
                active: { type: 'boolean' },
                author: { type: 'text' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                updater: { type: 'keyword' },
                deletedAt: { type: 'date' }
              }
            }
          });
          should(esRequest.body.dynamic).be.eql('strict');
        });
    });

    it('should create collection with mapping if supplied in the body', () => {
      elasticsearch.config.commonMapping = {};

      const collectionMapping = {
        dynamic: 'false',
        _meta: { alyx: 'vance' },
        properties: {
          gordon:   { type: 'text' },
          freeman:  { type: 'keyword' }
        }
      };
      request.input.body = collectionMapping;

      return elasticsearch.createCollection(request)
        .then(() => {
          const esReq = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(esReq.body.dynamic).eql(collectionMapping.dynamic);
          should(esReq.body._meta).eql(collectionMapping._meta);
          should(esReq.body.properties).eql(collectionMapping.properties);
        });
    });

    it('should call updateMapping if the collection already exists', () => {
      elasticsearch.kuzzle.indexCache.exists.onCall(1).resolves(true);
      elasticsearch.updateMapping = sinon.stub().resolves({});

      return elasticsearch.createCollection(request)
        .then(() => {
          should(elasticsearch.updateMapping).be.calledOnce();
          should(elasticsearch.kuzzle.indexCache.exists).be.calledTwice();
          should(elasticsearch.kuzzle.indexCache.exists.getCall(0).args).be.eql([index]);
          should(elasticsearch.kuzzle.indexCache.exists.getCall(1).args).be.eql([index, '%foobar']);
        });
    });

    it('should not overwrite kuzzle commonMapping', () => {
      elasticsearch.config.commonMapping = {
        gordon: { type: 'text' },
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
      request.input.body = collectionMapping;

      return elasticsearch.createCollection(request)
        .then(() => {
          const esReq = elasticsearch.client.indices.putMapping.firstCall.args[0];
          should(esReq.body.properties).eql({
            gordon:   { type: 'text' },
            freeman:  { type: 'keyword' },
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
        });
    });

    it('should reuse a previously created common mapping', () => {
      kuzzle.indexCache.defaultMappings[index] = {
        gordon: { type: 'text' }
      };

      const collectionMapping = {
        properties: {
          freeman:  { type: 'keyword' },
          _kuzzle_info: {
            properties: {
              author: { type: 'keyword' }
            }
          }
        }
      };
      request.input.body = collectionMapping;

      return elasticsearch.createCollection(request)
        .then(() => {
          const esReq = elasticsearch.client.indices.putMapping.firstCall.args[0];

          should(esReq.body.properties).eql({
            gordon:   { type: 'text' },
            freeman:  { type: 'keyword' },
            _kuzzle_info: {
              properties: {
                author: { type: 'keyword' }
              }
            }
          });
        });

    });
  });

  describe('#truncateCollection', () => {
    it('should allow truncating an existing collection', () => {
      const spy = sinon.stub(elasticsearch, 'deleteByQuery').resolves({});

      return elasticsearch.truncateCollection(request)
        .then(() => {
          const req = spy.firstCall.args[0];

          should(req).be.an.instanceOf(Request);
          should(req.input.body.query).be.Object().and.match({match_all: {}});
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

  describe('#createIndex', () => {
    it('should be able to create index', () => {
      elasticsearch.client.indices.create.resolves({});

      return elasticsearch.createIndex(request)
        .then(() => {
          should(elasticsearch.client.indices.create.firstCall.args[0].index).be.exactly(request.input.resource.index);
        });
    });

    it('should reject the createIndex promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      elasticsearch.client.indices.create.rejects(error);

      return should(elasticsearch.createIndex(request)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });

    it('should throw if attempting to create an internal index', () => {
      request.input.resource.index = '%foobar';

      should(() => elasticsearch.createIndex(request)).throw(BadRequestError);
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
      const
        output = {version: {}, indices: {store: {}}};

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
      const
        error = new Error('Mocked error'),
        pluginSpy = kuzzle.pluginsManager.trigger;

      elasticsearch.client.indices.refresh.rejects(error);
      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return elasticsearch.refreshIndexIfNeeded({index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(pluginSpy.calledWith('log:error')).be.true();
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

      return should(elasticsearch.mcreate(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1)'});
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

      return should(elasticsearch.mcreateOrReplace(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1)'});
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
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return should(elasticsearch.mupdate(request)).rejectedWith(PreconditionError);
    });

    it('should abort if the number of documents exceeds the configured limit', () => {
      elasticsearch.kuzzle.indexCache.exists.resolves(true);
      kuzzle.config.limits.documentsWriteCount = 1;
      request.input.body = {documents: [{_id: 'foo', body: {foo: 'bar'}}, {_id: 'bar', body: {bar: 'foo'}}]};

      return should(elasticsearch.mupdate(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1)'});
    });

    it('should bulk import documents to be updated', () => {
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
          should(result.error).be.an.Array().and.be.empty();
          should(result.result).match([
            {_id: 'foo', _source: {foo: 'bar', _kuzzle_info: metadata}, _meta: metadata, status: 201},
            {_id: 'bar', _source: {bar: 'foo', _kuzzle_info: metadata}, _meta: metadata, status: 201}
          ]);

          should(result.result[0]._meta.updatedAt).be.approximately(now, 100);
          should(result.result[1]._meta.updatedAt).be.approximately(now, 100);
          should(result.result[0]._source._kuzzle_info.updatedAt).be.approximately(now, 100);
          should(result.result[1]._source._kuzzle_info.updatedAt).be.approximately(now, 100);
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

      return should(elasticsearch.mreplace(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1)'});
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

      return should(elasticsearch.mdelete(request)).rejectedWith(SizeLimitError, {message: 'Number of documents exceeds the server configured value (1)'});
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
});
