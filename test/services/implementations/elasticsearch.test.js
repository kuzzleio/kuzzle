'use strict';

const
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  KuzzleError = require('kuzzle-common-objects').errors.KuzzleError,
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', () => {
  let
    kuzzle = {},
    sandbox = sinon.sandbox.create(),
    index = '%test',
    collection = 'unit-tests-elasticsearch',
    createdDocumentId = 'id-test',
    elasticsearch,
    engineType = 'storageEngine',
    request,
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London',
      hobby: 'computer'
    },
    filter,
    filterAfterActiveAdded,
    rawKuzzleInfo;

  beforeEach(() => {
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
              should: [
                {
                  term: {
                    '_kuzzle_info.active': true
                  }
                },
                {
                  bool: {
                    must_not: {
                      exists: {
                        'field': '_kuzzle_info'
                      }
                    }
                  }
                }
              ]
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
              should: [
                {
                  term: {
                    '_kuzzle_info.active': true
                  }
                },
                {
                  bool: {
                    must_not: {
                      exists: {
                        'field': '_kuzzle_info'
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    };

    request = new Request({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection,
      index,
      body: documentAda
    }, {
      token: {
        userId: 'test'
      }
    });
    elasticsearch.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#init', () => {
    it('should initialize properly', () => {
      return should(elasticsearch.init()).be.fulfilledWith(elasticsearch);
    });
  });

  describe('#getElasticsearchRequest', () => {
    it('should prepare the data for elasticsearch', () => {
      var
        getElasticsearchRequest = ES.__get__('getElasticsearchRequest'),
        preparedData;

      request.input.resource._id = 'foobar';
      ['unrecognizeed', 'from', 'size', 'scroll', 'scrollId', 'refresh'].forEach(arg => {
        request.input.args[arg] = arg;
      });

      preparedData = getElasticsearchRequest.call(elasticsearch, request, kuzzle);

      should(preparedData.type).be.exactly(request.input.resource.collection);
      should(preparedData.id).be.exactly(request.input.resource._id);
      should(preparedData._id).be.undefined();
      should(preparedData.index).be.exactly(request.input.resource.index);

      should(preparedData)
        .not.have.property('unrecognized');
      ['from', 'size', 'scroll', 'scrollId', 'refresh'].forEach(arg => {
        should(preparedData[arg]).be.exactly(arg);
      });
    });
  });

  describe('#search', () => {
    it('should be able to search documents', () => {
      elasticsearch.client.search.returns(Promise.resolve({total: 0, hits: []}));

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
      elasticsearch.client.search.returns(Promise.resolve({total: 0, hits: [], _scroll_id: 'banana42'}));

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
          should(result._scroll_id).be.an.exactly('banana42');
        });
    });

    it('should return a rejected promise if a search fails', done => {
      elasticsearch.client.search.returns(Promise.reject(new Error('Mocked error')));

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
      var req = new Request({
        scrollId: 'banana42'
      });
      elasticsearch.client.scroll.returns(Promise.resolve({total: 0, hits: []}));

      return elasticsearch.scroll(req)
        .then(result => {
          should(elasticsearch.client.scroll.firstCall.args[0]).be.deepEqual({scrollId: 'banana42'});
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should return a rejected promise if no scrollId is given', done => {
      elasticsearch.client.scroll.returns(Promise.resolve({total: 0, hits: []}));

      request.input.body = {};

      elasticsearch.scroll(request)
        .then(() => {
          throw new Error('this should never happen');
        })
        .catch(err => {
          try {
            should(err).be.an.instanceOf(BadRequestError);
            should(err.message).be.exactly('The action scroll can\'t be done without a scrollId');
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should return a rejected promise if a scroll fails', () => {
      elasticsearch.client.scroll.returns(Promise.reject(new Error('error')));

      request.input.args.scrollId = 'foobar';
      return should(elasticsearch.scroll(request)).be.rejectedWith(Error, {message: 'error'});
    });
  });

  describe('#create', () => {
    it('should allow creating documents if the document does not already exists', () => {
      sandbox.stub(elasticsearch, 'refreshIndex').returns(Promise.resolve());
      elasticsearch.client.index.returns(Promise.resolve({}));

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
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));
      request.input.resource._id = '42';

      return should(ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.create(request)
          .then(() => {
            var data = elasticsearch.client.index.firstCall.args[0];

            should(data.index).be.exactly(index);
            should(data.type).be.exactly(collection);
            should(data.body).be.exactly(documentAda);

            should(refreshIndexSpy.calledOnce).be.true();
          });
      })).be.fulfilled();
    });

    it('should create a document with a non existing id', () => {
      var
        error = new Error('Mocked error'),
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.create.returns(Promise.resolve({}));
      error.displayName = 'NotFound';

      elasticsearch.client.get.returns(Promise.reject(error));
      request.input.resource._id = '42';

      return should(ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.create(request)
          .then(() => {
            var data = elasticsearch.client.create.firstCall.args[0];

            should(data.index).be.exactly(index);
            should(data.type).be.exactly(collection);
            should(data.body).be.exactly(documentAda);

            should(refreshIndexSpy.calledOnce).be.true();
          });
      })).be.fulfilled();
    });

    it('should reject the create promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked create error');
      elasticsearch.client.get.returns(Promise.reject(new Error('Mocked get error')));

      request.input.resource._id = 'foobar';

      return should(elasticsearch.create(request)).be.rejectedWith(error);
    });

    it('should reject the create promise if client.index throws an error', () => {
      var error = new Error('Mocked index error');
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));
      elasticsearch.client.index.returns(Promise.reject(error));
      request.input.resource._id = '42';

      return should(elasticsearch.create(request)).be.rejectedWith(error);
    });

    it('should reject a promise if the document already exists', () => {
      var error = new Error('Mocked create error');
      elasticsearch.client.create.returns(Promise.reject(error));
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: true}}}));
      request.input.resource._id = '42';

      return should(elasticsearch.create(request)).be.rejectedWith(error);
    });
  });

  describe('#createOrReplace', () => {
    it('should support createOrReplace capability', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      request.input.resource._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.createOrReplace(request)
            .then(() => {
              var data = elasticsearch.client.index.firstCall.args[0];

              should(data.index).be.exactly(index);
              should(data.type).be.exactly(collection);
              should(data.body).be.exactly(documentAda);
              should(data.id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should reject the createOrReplace promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');

      elasticsearch.client.index.returns(Promise.reject(error));

      request.input.resource._id = createdDocumentId;
      return should(elasticsearch.createOrReplace(request)).be.rejectedWith(error);
    });
  });

  describe('#replace', () => {
    it('should support replace capability', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      elasticsearch.client.exists.returns(Promise.resolve(true));

      request.input.resource._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.replace(request)
            .then(() => {
              var data = elasticsearch.client.index.firstCall.args[0];

              should(data.index).be.exactly(index);
              should(data.type).be.exactly(collection);
              should(data.body).be.exactly(documentAda);
              should(data.id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should reject the replace promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');

      elasticsearch.client.exists.returns(Promise.resolve(true));
      elasticsearch.client.index.returns(Promise.reject(error));

      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.replace(request)).be.rejectedWith(error);
    });

    it('should throw a NotFoundError Exception if document already exists', done => {
      elasticsearch.client.exists.returns(Promise.resolve(false));

      kuzzle.indexes = {};
      request.input.resource._id = createdDocumentId;

      elasticsearch.replace(request)
        .catch(err => {
          try {
            should(err).be.an.instanceOf(NotFoundError);
            should(err.message).be.exactly('Document with id ' + request.input.resource._id + ' not found.');
            should(elasticsearch.client.index.called).be.false();

            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#get', () => {
    it('should allow getting a single document', () => {
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: true}}}));

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.get(request)
        .then(() => {
          should(elasticsearch.client.get.firstCall.args[0].id).be.exactly(createdDocumentId);
        })).be.fulfilled();
    });

    it('should not throw error when "_source" is not defined', () => {
      elasticsearch.client.get.returns(Promise.resolve({foo: 'bar'}));

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return should(elasticsearch.get(request))
        .be.fulfilled();
    });

    it('should reject requests when document is on inactive stat', () => {
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));

      return should(elasticsearch.get(request)).be.rejectedWith(NotFoundError);
    });

    it('should reject requests when the user search for a document with id _search', () => {
      request.input.resource._id = '_search';

      return should(elasticsearch.get(request)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#mget', () => {
    it('should return a rejected promise if getting a single document fails', done => {
      elasticsearch.client.get.returns(Promise.reject(new Error('Mocked error')));

      elasticsearch.get(request)
        .catch(() => {
          try {
            should(elasticsearch.client.get.calledOnce).be.true();
            should(elasticsearch.client.get.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should allow getting multiples documents', () => {
      elasticsearch.client.mget.returns(Promise.resolve({}));

      request.input.body = {ids: ['1', '2', '3']};

      return should(elasticsearch.mget(request)
        .then(() => {
          should(elasticsearch.client.mget.firstCall.args[0].body.ids).be.an.Array();
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if getting some multiple documents fails', done => {
      elasticsearch.client.mget.returns(Promise.reject(new Error('Mocked error')));

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
      elasticsearch.client.count.returns(Promise.resolve({}));

      request.input.body = {};

      return should(elasticsearch.count(request)
        .then(() => {
          should(elasticsearch.client.count.firstCall.args[0].body).be.deepEqual(rawKuzzleInfo);
        })
      ).be.fulfilled();
    });

    it('should allow counting objects using a query', () => {
      elasticsearch.client.count.returns(Promise.resolve({}));

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
      var error = new Error('Mocked error');
      elasticsearch.client.count.returns(Promise.reject(error));

      request.input.body = {query: {foo: 'bar'}};

      return should(elasticsearch.count(request)).be.rejectedWith(error);
    });
  });

  describe('#update', () => {
    it('should allow to update a document', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.update.returns(Promise.resolve({}));

      request.input.resource._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.update(request)
            .then(() => {
              var data = elasticsearch.client.update.firstCall.args[0];
              should(data.body.doc).be.exactly(documentAda);
              should(data.id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise with a NotFoundError when updating a document which does not exist', done => {
      var
        esError = new Error('test');

      esError.displayName = 'NotFound';
      esError.body = {
        error: {
          reason: 'foo'
        }
      };

      esError.body.error['resource.id'] = 'bar';
      elasticsearch.client.update.returns(Promise.reject(esError));

      elasticsearch.update(request)
        .catch((error) => {
          try{
            should(error).be.instanceOf(NotFoundError);
            should(error.message).be.equal('foo: bar');
            should(elasticsearch.client.update.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should return a rejected promise with a customised NotFoundError when elasticsearch throws a known error', done => {
      var
        esError = new Error('[index_not_found_exception] no such index, with { resource.type=index_or_alias resource.id=banana index=banana }');

      esError.displayName = 'NotFound';
      esError.body = {
        error: {
          reason: 'foo'
        }
      };

      elasticsearch.client.update.returns(Promise.reject(esError));


      elasticsearch.update(request)
        .catch((error) => {
          try{
            should(error).be.instanceOf(NotFoundError);
            should(error.message).be.equal('Index "banana" does not exist, please create it first');
            should(error.internalError).eql(esError);
            should(error.service).be.equal('elasticsearch');
            should(elasticsearch.client.update.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });

    it('should return a rejected promise with an Error if an update fails for unknown reason', done => {
      var
        esError = new Error('banana error'),
        spyTrigger = kuzzle.pluginsManager.trigger;

      elasticsearch.client.update.returns(Promise.reject(esError));

      elasticsearch.update(request)
        .catch((error) => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledWith(
              'log:warn',
              '[warning] unhandled elasticsearch error:\nbanana error'
            );

          should(error).be.instanceOf(Error);
          should(elasticsearch.client.update.firstCall.args[0].id).be.undefined();
          done();
        });
    });
  });

  describe('#delete', () => {
    it('should allow to delete a document', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.delete.returns(Promise.resolve({}));

      request.input.body = null;
      request.input.resource._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.delete(request)
            .then(() => {
              should(elasticsearch.client.delete.firstCall.args[0].id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if a delete fails', done => {
      elasticsearch.client.delete.returns(Promise.reject(new Error('Mocked error')));

      elasticsearch.delete(request)
        .catch(() => {
          try {
            should(elasticsearch.client.delete.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#deleteByQuery', () => {
    it('should return an empty result array when no document has been deactivated using a filter', () => {
      elasticsearch.client.search.yields(null, {hits: {hits: [], total: 0}});

      request.input.body = {
        query: {
          term: {firstName: 'no way any document can be returned with this filter'}
        }
      };

      return elasticsearch.deleteByQuery(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0]).be.not.undefined();

          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
        });
    });

    it('should allow to deactivate documents using a provided filter', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        mockupIds = ['foo', 'bar', 'baz'],
        getAllIdsStub = sinon.stub().returns(Promise.resolve(mockupIds));

      elasticsearch.client.bulk.returns(Promise.resolve(mockupIds));

      return ES.__with__({
        getAllIdsFromQuery: getAllIdsStub,
        refreshIndexIfNeeded: refreshIndexSpy,
        Date: {
          now: () => 42
        }
      })(() => {
        return elasticsearch.deleteByQuery(request)
          .then(result => {
            var bulkData = elasticsearch.client.bulk.firstCall.args[0];

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
                should(cmd.doc).be.eql({_kuzzle_info: { active: false, deletedAt: 42 }});
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
      var error = new KuzzleError('Mocked error');
      elasticsearch.client.bulk.returns(Promise.reject(error));

      request.input.body.query = {some: 'query'};

      return ES.__with__({
        getAllIdsFromQuery: () => Promise.resolve(['foo', 'bar'])
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

      return should(elasticsearch.deleteByQueryFromTrash(request)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].body.query).be.exactly(request.input.body.query);

          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
        })).be.fulfilled();
    });

    it('should allow to delete inactive documents using a provided filter from the trash', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        mockupIds = ['foo', 'bar', 'baz'],
        getAllIdsStub = sinon.stub().returns(Promise.resolve(mockupIds));

      elasticsearch.client.bulk.returns(Promise.resolve(mockupIds));
      elasticsearch.client.search.yields(null, {hits: {hits: [{_id: 'foo'}, {_id: 'bar'}, {_id: 'baz'}], total: mockupIds.length}});

      return ES.__with__({
        getPaginatedIdsFromQuery: getAllIdsStub,
        refreshIndexIfNeeded: refreshIndexSpy,
        Date: {
          now: () => 42
        }
      })(() => {
        return should(elasticsearch.deleteByQueryFromTrash(request)
          .then(result => {
            var bulkData = elasticsearch.client.bulk.firstCall.args[0];

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
      var error = new KuzzleError('Mocked error');
      elasticsearch.client.bulk.returns(Promise.reject(error));

      request.input.body.query = {some: 'query'};

      return ES.__with__({
        getAllIdsFromQuery: () => Promise.resolve(['foo', 'bar'])
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
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.bulk.returns(Promise.resolve({}));

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 1, _type: collection, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.import(request)
            .then(() => {
              should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(request.input.body.bulkData);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should inject only the allowed optional parameters', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.bulk.returns(Promise.resolve({}));

      request.input.body = {
        bulkData: []
      };
      request.input.args.consistency = 'foo';
      request.input.args.refresh = 'wait_for';
      request.input.args.routing = 'foo/bar';
      request.input.args.timeout = 999;
      request.input.args.fields = 'foo, bar, baz';

      return ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.import(request)
          .then(() => {
            var arg = elasticsearch.client.bulk.firstCall.args[0];

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
    });

    it('should raise a "Partial Error" response for bulk data import with some errors', () => {
      elasticsearch.client.bulk.returns(Promise.resolve({
        errors: true,
        items: {
          12: {index: {status: 404, error: 'DocumentMissingException'}},
          212: {index: {status: 404, error: 'DocumentMissingException'}}
        }
      }));

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _type: collection, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 12, _type: collection, _index: index}},
          {doc: {firstName: 'foobar'}},
          {update: {_id: 212, _type: collection, _index: index}},
          {doc: {firstName: 'foobar'}}
        ]
      };

      return should(elasticsearch.import(request)
        .then(result => {
          should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(request.input.body.bulkData);

          should(result.errors).be.true();
          should(result.partialErrors).be.an.Array().and.match([{status: 404}]).and.match([{error: /^DocumentMissingException/}]);
        })).be.fulfilled();
    });

    it('should override the type with the collection if one has been specified in the request', () => {
      elasticsearch.client.bulk.returns(Promise.resolve({
        items: [
          {index: {_id: 1, _index: index, _type: collection}},
          {index: {_id: 2, _index: 'indexAlt', _type: collection}},
          {update: {_id: 1, _index: index, _type: collection}},
          {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
        ]
      }));

      request.input.body = {
        bulkData: [
          {index: {_id: 1, _index: index}},
          {firstName: 'foo'},
          {index: {_id: 2, _index: 'indexAlt'}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _index: 'indexAlt'}}
        ]
      };

      return should(elasticsearch.import(request)
        .then(() => {
          var data = elasticsearch.client.bulk.firstCall.args[0];

          should(data.body).be.an.Array().and.match([
            {index: {_id: 1, _index: index, _type: collection}},
            {firstName: 'foo'},
            {index: {_id: 2, _index: 'indexAlt', _type: collection}},
            {firstName: 'bar'},
            {update: {_id: 1, _index: index, _type: collection}},
            {doc: {firstName: 'foobar'}},
            {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
          ]);

        })).be.fulfilled();
    });

    it('should reject the import promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');

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

      elasticsearch.client.bulk.returns(Promise.reject(error));

      return should(elasticsearch.import(request)).be.rejectedWith(error);
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

      elasticsearch.client.bulk.returns(Promise.resolve({}));

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
          {index: {_id: 2, _type: collection, _index: index}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _type: collection, _index: index}}
        ]
      };

      elasticsearch.client.bulk.returns(Promise.resolve({}));

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

      elasticsearch.client.bulk.returns(Promise.resolve({}));

      return should(elasticsearch.import(request)).be.rejected();
    });
  });

  describe('#updateMapping', () => {
    it('should have mapping capabilities', () => {
      elasticsearch.client.indices.putMapping.returns(Promise.resolve({}));

      request.input.body = {
        properties: {
          city: {type: 'string'}
        }
      };

      return should(elasticsearch.updateMapping(request)
        .then(() => {
          should(elasticsearch.client.indices.putMapping.firstCall.args[0].body).be.exactly(request.input.body);
        })).be.fulfilled();
    });

    it('should reject and handle error for bad mapping input', done => {
      var
        error = new Error('test');

      error.displayName = 'BadRequest';
      error.body = {
        error: {
          reason: 'foo'
        }
      };

      elasticsearch.client.indices.putMapping.returns(Promise.reject(error));

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
  });

  describe('#getMapping', () => {
    it('should allow users to retrieve a mapping', () => {
      var indiceResult = {};
      var mappings = {
        'unit-tests-elasticsearch': {properties: {}}
      };

      indiceResult[index] = {mappings};

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(indiceResult));

      return should(elasticsearch.getMapping(request)
        .then(result => {
          should(result[index]).not.be.undefined();
          should(result[index].mappings).not.be.undefined();
        })).be.fulfilled();
    });

    it('should return a rejected promise if there is no mapping found', () => {
      var mappings = {};
      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      request.input.resource.collection = 'foobar';
      request.input.resource.index = 'kuzzle-unit-tests-fakeindex';

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(mappings));

      return should(elasticsearch.getMapping(request)).be.rejected();
    });

    it('should reject the getMapping promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      return should(elasticsearch.getMapping(request)).be.rejectedWith(error);
    });
  });

  describe('#getAllIdsFromQuery', () => {
    it('should be able to get every ids matching a query', () => {
      var
        getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
        ids = ['foo', 'bar'];

      elasticsearch.client.search.yields(null, {
        hits: {
          hits: [{_id: 'foo'}, {_id: 'bar'}],
          total: 2
        }
      });

      return should(getAllIdsFromQuery.call(elasticsearch, request)
        .then(result => {
          should(result).be.an.Array().and.match(ids);
          should(result.length).be.exactly(2);
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the search fails', () => {
      var getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery');

      elasticsearch.client.search.yields(new Error('rejected'));
      return should(getAllIdsFromQuery.call(elasticsearch, request)).be.rejectedWith('rejected');
    });

    it('should scroll through result pages until getting all ids', () => {
      var
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

      return should(getAllIdsFromQuery.call(elasticsearch, request)
        .then(result => {
          should(result).be.an.Array().and.match(ids);
          should(result.length).be.exactly(2);
        })
      ).be.fulfilled();
    });
  });

  describe('#listCollections', () => {
    it('should allow listing all available collections', () => {
      var mappings = {};

      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(mappings));
      request.input.body = null;
      return should(elasticsearch.listCollections(request)).be.fulfilled();
    });

    it('should reject the listCollections promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      request.input.resource.index = 'kuzzle-unit-tests-fakeindex';
      request.input.body = null;
      return should(elasticsearch.listCollections(request)).be.rejectedWith(error);
    });
  });

  describe('#createCollection', () => {
    it('should allow creating a new collection', () => {
      elasticsearch.client.indices.putMapping.returns(Promise.resolve({}));

      request.input.resource.collection = '%foobar';
      return should(elasticsearch.createCollection(request)).be.fulfilled();
    });

    it('should reject the createCollection promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.putMapping.returns(Promise.reject(error));

      return should(elasticsearch.createCollection(request)).be.rejectedWith(error);
    });
  });

  describe('#truncateCollection', () => {
    it('should allow truncating an existing collection', () => {
      var spy = sandbox.stub(elasticsearch, 'deleteByQuery').returns(Promise.resolve({}));

      return should(elasticsearch.truncateCollection(request)
        .then(() => {
          var req = spy.firstCall.args[0];

          should(req).be.an.instanceOf(Request);
          should(req.input.body.query).be.Object().and.match({match_all: {}});
        })).be.fulfilled();
    });
  });

  describe('#reset', () => {
    it('should allow deleting all indexes', () => {
      elasticsearch.client.indices.delete.returns(Promise.resolve({}));

      elasticsearch.client.cat.indices.returns(Promise.resolve('      \n %kuzzle      \n ' + index + ' \n  '));

      request.input.body = {indexes: [index]};

      return should(elasticsearch.deleteIndexes(request)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0]).be.an.Object().and.match({index: [index]});
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the reset fails while deleting all indexes', () => {
      var
        error = new Error('Mocked delete error'),
        indexes = {index: ['some index']};

      request.input.body = {indexes: [index]};
      indexes[kuzzle.config.internalIndex] = [];

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(indexes));
      elasticsearch.client.indices.delete.returns(Promise.reject(error));

      return should(elasticsearch.deleteIndexes(request)).be.rejectedWith(error);
    });
  });

  describe('#createIndex', () => {
    it('should be able to create index', () => {
      elasticsearch.client.indices.create.returns(Promise.resolve({}));

      return should(elasticsearch.createIndex(request)
        .then(() => {
          should(elasticsearch.client.indices.create.firstCall.args[0].index).be.exactly(request.input.resource.index);
        })).be.fulfilled();
    });

    it('should reject the createIndex promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.create.returns(Promise.reject(error));

      return should(elasticsearch.createIndex(request)).be.rejectedWith(error);
    });
  });

  describe('#deleteIndex', () => {
    it('should be able to delete index', () => {
      elasticsearch.client.indices.delete.returns(Promise.resolve({}));

      return should(elasticsearch.deleteIndex(request)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0].index).be.exactly(request.input.resource.index);
        })
      ).be.fulfilled();
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', () => {
      elasticsearch.client.indices.delete.returns(Promise.reject(new Error()));

      return should(elasticsearch.deleteIndex(request)).be.rejected();
    });
  });

  describe('#listIndexes', () => {
    it('should allow listing indexes', () => {
      elasticsearch.client.indices.getMapping.returns(Promise.resolve({indexes: []}));

      return should(elasticsearch.listIndexes(request)).be.fulfilled();
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      return should(elasticsearch.listIndexes(request)).be.rejectedWith(error);
    });
  });

  describe('#getInfos', () => {
    it('should allow getting elasticsearch informations', () => {
      var
        output = {version: {}, indices: {store: {}}};

      elasticsearch.client.cluster.stats.returns(Promise.resolve(output));
      elasticsearch.client.cluster.health.returns(Promise.resolve(output));
      elasticsearch.client.info.returns(Promise.resolve(output));

      return should(elasticsearch.getInfos(request)).be.fulfilled();
    });
  });

  describe('#refreshIndex', () => {
    it('should send a valid request to es client', () => {
      elasticsearch.client.indices.refresh = sandbox.spy((req) => Promise.resolve(req));

      return elasticsearch.refreshIndex(request)
        .then(data => {
          should(data.index).be.eql(index);
        });
    });
  });

  describe('#getAutoRefresh', () => {
    it('should reflect the current autoRefresh status', () => {
      return should(elasticsearch.getAutoRefresh(request)
        .then(response => {
          should(response).be.false();

          elasticsearch.settings.autoRefresh[request.input.resource.index] = true;
          return elasticsearch.getAutoRefresh(request);
        })
        .then(response => {
          should(response).be.true();
          elasticsearch.settings.autoRefresh[request.input.resource.index] = false;
        })
      ).be.fulfilled();
    });
  });

  describe('#setAutoRefresh', () => {
    it('should toggle the autoRefresh status', () => {
      var
        req = new Request({
          index: request.index,
          body: { autoRefresh: true }
        });

      kuzzle.internalEngine.createOrReplace = sandbox.stub().returns(Promise.resolve({}));

      return should(elasticsearch.setAutoRefresh(req)
        .then(response => {
          should(response).be.true();
          should(kuzzle.internalEngine.createOrReplace.calledOnce).be.true();

          req.input.body.autoRefresh = false;
          return elasticsearch.setAutoRefresh(req);
        })
        .then(response => {
          should(response).be.false();
        })
      ).be.fulfilled();
    });
  });

  describe('#refreshIndexIfNeeded', () => {
    it('should not refresh the index if autoRefresh is set to false', () => {
      var refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded');

      elasticsearch.client.indices.refresh.returns(Promise.resolve({}));

      return should(refreshIndexIfNeeded.call(elasticsearch, {index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(elasticsearch.client.indices.refresh.called).be.false();
          should(response).be.eql({ foo: 'bar' });
        })).be.fulfilled();
    });

    it('should refresh the index if asked to', () => {
      var refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded');

      elasticsearch.client.indices.refresh.returns(Promise.resolve({}));
      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, {index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(elasticsearch.client.indices.refresh.called).be.true();
          should(response).be.eql({foo: 'bar'});
        })).be.fulfilled();
    });

    it('should not block execution in case the index could not be refreshed', () => {
      var
        error = new Error('Mocked error'),
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        pluginSpy = kuzzle.pluginsManager.trigger;

      elasticsearch.client.indices.refresh.returns(Promise.reject(error));
      elasticsearch.settings.autoRefresh[request.input.resource.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, {index: request.input.resource.index}, {foo: 'bar'})
        .then(response => {
          should(pluginSpy.calledWith('log:error')).be.true();
          should(elasticsearch.client.indices.refresh.called).be.true();
          should(response).be.eql({ foo: 'bar' });
          return null;
        })
      ).be.fulfilled();
    });
  });

  describe('#indexExists', () => {
    it('should call es indices.exists method', () => {
      elasticsearch.client.indices.exists.returns(Promise.resolve(true));

      return elasticsearch.indexExists(request)
        .then(response => {
          try {
            should(response).be.true();

            should(elasticsearch.client.indices.exists).be.calledOnce();

            should(elasticsearch.client.indices.exists.firstCall.args[0]).match({
              index: '%test'
            });

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should format the error', () => {
      var
        error = new Error('test'),
        spy = sandbox.spy(elasticsearch, 'formatESError');

      elasticsearch.client.indices.exists.returns(Promise.reject(error));

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
      elasticsearch.client.indices.existsType.returns(Promise.resolve(true));

      return elasticsearch.collectionExists(request)
        .then(() => {
          try {
            should(elasticsearch.client.indices.existsType).be.calledOnce();

            should(elasticsearch.client.indices.existsType.firstCall.args[0])
              .match({
                index,
                type: collection
              });

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should format errors', () => {
      var
        error = new Error('test'),
        spy = sinon.spy(elasticsearch, 'formatESError');

      elasticsearch.client.indices.existsType.returns(Promise.reject(error));

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

});
