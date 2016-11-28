'use strict';

const
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  ESClientMock = require('../../mocks/services/elasticsearchClient.mock'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', () => {
  let
    kuzzle,
    sandbox = sinon.sandbox.create(),
    index = '%test',
    collection = 'unit-tests-elasticsearch',
    createdDocumentId = 'id-test',
    elasticsearch,
    engineType = 'storageEngine',
    requestObject,
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
    ES.__set__('buildClient', () => new ESClientMock());
    kuzzle = new KuzzleMock();
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

    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: collection,
      index: index,
      body: documentAda
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

  describe('#cleanData', () => {
    it('should prepare the data for elasticsearch', () => {
      var
        cleanData = ES.__get__('cleanData'),
        preparedData;

      requestObject.data._id = 'foobar';
      preparedData = cleanData.call(elasticsearch, requestObject, kuzzle);

      should(preparedData.type).be.exactly(requestObject.collection);
      should(preparedData.id).be.exactly(requestObject.data._id);
      should(preparedData._id).be.undefined();
      should(preparedData.index).be.exactly(requestObject.index);

      // we expect all properties expect _id to be carried over the new data object
      Object.keys(requestObject.data).forEach(member => {
        if (member !== '_id') {
          should(preparedData[member]).be.exactly(requestObject.data[member]);
        }
      });
    });
  });

  describe('#search', () => {
    it('should be able to search documents', () => {
      elasticsearch.client.search.returns(Promise.resolve({total: 0, hits: []}));

      requestObject.data.body = filter;
      return elasticsearch.search(requestObject)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].body).be.deepEqual(filterAfterActiveAdded);
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should be able to search with from/size and scroll arguments', () => {
      elasticsearch.client.search.returns(Promise.resolve({total: 0, hits: [], _scroll_id: 'banana42'}));

      requestObject.data.body = filter;
      requestObject.data.body.from = 0;
      requestObject.data.body.size = 1;
      requestObject.data.body.scroll = '30s';

      return elasticsearch.search(requestObject)
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

      elasticsearch.search(requestObject)
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
      elasticsearch.client.scroll.returns(Promise.resolve({total: 0, hits: []}));

      requestObject.data.body = {scrollId: 'banana42'};

      return elasticsearch.scroll(requestObject)
        .then(result => {
          should(elasticsearch.client.scroll.firstCall.args[0]).be.deepEqual({scrollId: 'banana42'});
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should return a rejected promise if no scrollId is given', done => {
      elasticsearch.client.scroll.returns(Promise.resolve({total: 0, hits: []}));

      requestObject.data.body = {};

      elasticsearch.scroll(requestObject)
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

      requestObject.data.body.scrollId = 'foobar';
      return should(elasticsearch.scroll(requestObject)).be.rejectedWith(Error, {message: 'error'});
    });
  });

  describe('#create', () => {
    it('should allow creating documents if the document does not already exists', () => {
      sandbox.stub(elasticsearch, 'refreshIndex').returns(Promise.resolve());
      elasticsearch.client.index.returns(Promise.resolve({}));

      elasticsearch.settings.autoRefresh[requestObject.index] = true;

      return elasticsearch.create(requestObject)
        .then(() => {
          let data = elasticsearch.client.index.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);

          should(elasticsearch.client.get).not.be.called();

          should(elasticsearch.refreshIndex.calledOnce).be.true();
          should(elasticsearch.refreshIndex.firstCall.args[0].index).be.eql(requestObject.index);
        });
    });

    it('should replace a document because it already exists but is inactive', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));
      requestObject.data._id = 42;

      return should(ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.create(requestObject)
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
      requestObject.data._id = 42;

      return should(ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.create(requestObject)
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

      requestObject.data._id = 'foobar';

      return should(elasticsearch.create(requestObject)).be.rejectedWith(error);
    });

    it('should reject the create promise if client.index throws an error', () => {
      var error = new Error('Mocked index error');
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));
      elasticsearch.client.index.returns(Promise.reject(error));
      requestObject.data._id = '42';

      return should(elasticsearch.create(requestObject)).be.rejectedWith(error);
    });

    it('should reject a promise if the document already exists', () => {
      var error = new Error('Mocked create error');
      elasticsearch.client.create.returns(Promise.reject(error));
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: true}}}));
      requestObject.data._id = 42;

      return should(elasticsearch.create(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#createOrReplace', () => {
    it('should support createOrReplace capability', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.createOrReplace(requestObject)
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

      requestObject.data._id = createdDocumentId;
      return should(elasticsearch.createOrReplace(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#replace', () => {
    it('should support replace capability', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.index.returns(Promise.resolve({}));
      elasticsearch.client.exists.returns(Promise.resolve(true));

      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.replace(requestObject)
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

      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.replace(requestObject)).be.rejectedWith(error);
    });

    it('should throw a NotFoundError Exception if document already exists', done => {
      elasticsearch.client.exists.returns(Promise.resolve(false));

      kuzzle.indexes = {};
      requestObject.data._id = createdDocumentId;

      elasticsearch.replace(requestObject)
        .catch(err => {
          try {
            should(err).be.an.instanceOf(NotFoundError);
            should(err.message).be.exactly('Document with id ' + requestObject.data._id + ' not found.');
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

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.get(requestObject)
        .then(() => {
          should(elasticsearch.client.get.firstCall.args[0].id).be.exactly(createdDocumentId);
        })).be.fulfilled();
    });

    it('should not throw error when "_source" is not defined', () => {
      elasticsearch.client.get.returns(Promise.resolve({foo: 'bar'}));

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.get(requestObject))
        .be.fulfilled();
    });

    it('should reject requests when document is on inactive stat', () => {
      elasticsearch.client.get.returns(Promise.resolve({_source: {_kuzzle_info: {active: false}}}));

      return should(elasticsearch.get(requestObject)).be.rejectedWith(NotFoundError);
    });

    it('should reject requests when the user search for a document with id _search', () => {
      requestObject.data._id = '_search';

      return should(elasticsearch.get(requestObject)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#mget', () => {
    it('should return a rejected promise if getting a single document fails', done => {
      elasticsearch.client.get.returns(Promise.reject(new Error('Mocked error')));

      elasticsearch.get(requestObject)
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

      requestObject.data = {body: {ids: [1, 2, 3]}};

      return should(elasticsearch.mget(requestObject)
        .then(() => {
          should(elasticsearch.client.mget.firstCall.args[0].body.ids).be.an.Array();
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if getting some multiple documents fails', done => {
      elasticsearch.client.mget.returns(Promise.reject(new Error('Mocked error')));

      requestObject.data.body = {};

      elasticsearch.mget(requestObject)
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

      requestObject.data.body = {};

      return should(elasticsearch.count(requestObject)
        .then(() => {
          should(elasticsearch.client.count.firstCall.args[0].body).be.deepEqual(rawKuzzleInfo);
        })
      ).be.fulfilled();
    });

    it('should allow counting objects using a query', () => {
      elasticsearch.client.count.returns(Promise.resolve({}));

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      rawKuzzleInfo.query.bool.must = requestObject.data.query;
      return should(elasticsearch.count(requestObject)
        .then(() => {
          should(elasticsearch.client.count.firstCall.args[0].body).be.deepEqual(rawKuzzleInfo);
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the count fails', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.count.returns(Promise.reject(error));

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return should(elasticsearch.count(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#update', () => {
    it('should allow to update a document', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.update.returns(Promise.resolve({}));

      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.update(requestObject)
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

      elasticsearch.update(requestObject)
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


      elasticsearch.update(requestObject)
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

    it('should return a rejected promise with an Error if an update fails for unknown reason', () => {
      var esError = new Error('banana error');

      elasticsearch.client.update.returns(Promise.reject(esError));

      return elasticsearch.update(requestObject)
        .catch((error) => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledWith(
              'log:warn',
              '[warning] unhandled elasticsearch error:\nbanana error'
            );

          should(error).be.instanceOf(Error);
          should(elasticsearch.client.update.firstCall.args[0].id).be.undefined();
        });
    });
  });

  describe('#delete', () => {
    it('should allow to delete a document', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.delete.returns(Promise.resolve({}));

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.delete(requestObject)
            .then(() => {
              should(elasticsearch.client.delete.firstCall.args[0].id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if a delete fails', done => {
      elasticsearch.client.delete.returns(Promise.reject(new Error('Mocked error')));

      elasticsearch.delete(requestObject)
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

      delete requestObject.data.body;
      requestObject.data.query = {term: {firstName: 'no way any document can be returned with this filter'}};

      return elasticsearch.deleteByQuery(requestObject)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].query).be.exactly(requestObject.data.query);

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
        return elasticsearch.deleteByQuery(requestObject)
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
                should(cmd.update._type).be.exactly(requestObject.collection);
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

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });

    it('should return a rejected promise if the delete by query fails because of a bulk failure', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.bulk.returns(Promise.reject(error));

      requestObject.data.body = {};

      return ES.__with__({
        getAllIdsFromQuery: () => Promise.resolve(['foo', 'bar'])
      })(() => {
        return should(elasticsearch.deleteByQuery(requestObject)).be.rejectedWith(error);
      });
    });

    it('should return a rejected promise if the delete by query fails because the filter is null', () => {
      requestObject.data.body = null;

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#deleteByQueryFromTrash', () => {
    it('should return an empty result array when no document has been deleted using a filter', () => {
      elasticsearch.client.search.yields(null, {hits: {hits: [], total: 0}});

      delete requestObject.data.body;
      requestObject.data.filter = {term: {firstName: 'no way any document can be returned with this filter'}};

      return should(elasticsearch.deleteByQueryFromTrash(requestObject)
        .then(result => {
          should(elasticsearch.client.search.firstCall.args[0].query).be.exactly(requestObject.data.query);

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
        getAllIdsFromQuery: getAllIdsStub,
        refreshIndexIfNeeded: refreshIndexSpy
      })(() => {
        return should(elasticsearch.deleteByQueryFromTrash(requestObject)
          .then(result => {
            var bulkData = elasticsearch.client.bulk.firstCall.args[0];

            // elasticsearch.client.bulk
            should(bulkData.body).not.be.undefined().and.be.an.Array();
            should(bulkData.body.length).be.exactly(mockupIds.length);

            bulkData.body.forEach(cmd => {
              should(cmd).be.an.Object();
              should(cmd.delete).not.be.undefined().and.be.an.Object();
              should(mockupIds.indexOf(cmd.delete._id)).not.be.eql(-1);
              should(cmd.delete._type).be.exactly(requestObject.collection);
            });

            // elasticserach.deleteByQuery
            should(result.ids).not.be.undefined().and.be.an.Array();
            should(result.ids).match(mockupIds);

            // refreshIndexIfNeeded
            should(refreshIndexSpy.calledOnce).be.true();
          })
        ).be.fulfilled();
      });
    });

    it('should return a rejected promise if the delete by query fails because of a bad filter', () => {
      elasticsearch.client.search.yields(new Error(), {});

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });

    it('should return a rejected promise if the delete by query fails because of a bulk failure', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.bulk.returns(Promise.reject(error));

      requestObject.data.body = {};

      return ES.__with__({
        getAllIdsFromQuery: () => Promise.resolve(['foo', 'bar'])
      })(() => {
        return should(elasticsearch.deleteByQuery(requestObject)).be.rejectedWith(error);
      });
    });

    it('should return a rejected promise if the delete by query fails because the filter is null', () => {
      requestObject.data.body = null;

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejectedWith(BadRequestError);
    });
  });

  describe('#import', () => {
    it('should support bulk data import', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      elasticsearch.client.bulk.returns(Promise.resolve({}));

      requestObject.data.body = {
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
          return elasticsearch.import(requestObject)
            .then(() => {
              should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(requestObject.data.body.bulkData);

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

      requestObject.data = {
        body: {
          bulkData: []
        },
        consistency: 'foo',
        refresh: 'wait_for',
        routing: 'foo/bar',
        timeout: 999,
        fields: 'foo, bar, baz'
      };

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.import(requestObject)
            .then(() => {
              should(elasticsearch.client.bulk.firstCall.args[0].consistency).be.exactly('foo');
              should(elasticsearch.client.bulk.firstCall.args[0].refresh).be.exactly('wait_for');
              should(elasticsearch.client.bulk.firstCall.args[0].routing).be.exactly('foo/bar');
              should(elasticsearch.client.bulk.firstCall.args[0].timeout).be.exactly(999);
              should(elasticsearch.client.bulk.firstCall.args[0].fields).be.exactly('foo, bar, baz');
              should(elasticsearch.client.bulk.firstCall.args[0].foo).be.undefined();

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should raise a "Partial Error" response for bulk data import with some errors', () => {
      elasticsearch.client.bulk.returns(Promise.resolve({
        errors: true,
        items: {
          12: {index: {status: 404, error: 'DocumentMissingException'}},
          212: {index: {status: 404, error: 'DocumentMissingException'}}
        }
      }));

      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)
        .then(result => {
          should(elasticsearch.client.bulk.firstCall.args[0].body).be.exactly(requestObject.data.body.bulkData);

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

      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)
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

      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)).be.rejectedWith(error);
    });

    it('should return a rejected promise if bulk data try to write into internal index', () => {
      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if no body is provided', () => {
      delete requestObject.data.body;
      return should(elasticsearch.import(requestObject)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if body contains no bulkData parameter', () => {
      delete requestObject.data.body.bulkData;
      return should(elasticsearch.import(requestObject)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if no type has been provided, locally or globally', () => {
      delete requestObject.collection;

      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)).be.rejectedWith(BadRequestError);
    });

    it('should return a rejected promise if no index has been provided, locally or globally', () => {
      delete requestObject.index;

      requestObject.data.body = {
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

      return should(elasticsearch.import(requestObject)).be.rejected();
    });
  });

  describe('#updateMapping', () => {
    it('should have mapping capabilities', () => {
      elasticsearch.client.indices.putMapping.returns(Promise.resolve({}));

      requestObject.data.body = {
        properties: {
          city: {type: 'string'}
        }
      };

      return should(elasticsearch.updateMapping(requestObject)
        .then(() => {
          should(elasticsearch.client.indices.putMapping.firstCall.args[0].body).be.exactly(requestObject.data.body);
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

      elasticsearch.updateMapping(requestObject)
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

      return should(elasticsearch.getMapping(requestObject)
        .then(result => {
          should(result[requestObject.index]).not.be.undefined();
          should(result[requestObject.index].mappings).not.be.undefined();
        })).be.fulfilled();
    });

    it('should return a rejected promise if there is no mapping found', () => {
      var mappings = {};
      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      requestObject.collection = 'foobar';
      requestObject.index = 'kuzzle-unit-tests-fakeindex';

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(mappings));

      return should(elasticsearch.getMapping(requestObject)).be.rejected();
    });

    it('should reject the getMapping promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      return should(elasticsearch.getMapping(requestObject)).be.rejectedWith(error);
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

      return should(getAllIdsFromQuery.call(elasticsearch, requestObject)
        .then(result => {
          should(result).be.an.Array().and.match(ids);
          should(result.length).be.exactly(2);
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the search fails', () => {
      var getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery');

      elasticsearch.client.search.yields(new Error('rejected'));
      return should(getAllIdsFromQuery.call(elasticsearch, requestObject)).be.rejectedWith('rejected');
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

      return should(getAllIdsFromQuery.call(elasticsearch, requestObject)
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
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.fulfilled();
    });

    it('should reject the listCollections promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      requestObject.index = 'kuzzle-unit-tests-fakeindex';
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#createCollection', () => {
    it('should allow creating a new collection', () => {
      elasticsearch.client.indices.putMapping.returns(Promise.resolve({}));

      requestObject.collection = '%foobar';
      return should(elasticsearch.createCollection(requestObject)).be.fulfilled();
    });

    it('should reject the createCollection promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.putMapping.returns(Promise.reject(error));

      return should(elasticsearch.createCollection(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#truncateCollection', () => {
    it('should allow truncating an existing collection', () => {
      var spy = sandbox.stub(elasticsearch, 'deleteByQuery').returns(Promise.resolve({}));

      return should(elasticsearch.truncateCollection(requestObject)
        .then(() => {
          var request = spy.firstCall.args[0];

          should(request).be.an.instanceOf(RequestObject);
          should(request.data.body).be.Object().and.be.empty();
        })).be.fulfilled();
    });
  });

  describe('#reset', () => {
    it('should allow deleting all indexes', () => {
      elasticsearch.client.indices.delete.returns(Promise.resolve({}));

      elasticsearch.client.cat.indices.returns(Promise.resolve('      \n %kuzzle      \n ' + index + ' \n  '));

      requestObject.data.body.indexes = [index];

      return should(elasticsearch.deleteIndexes(requestObject)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0]).be.an.Object().and.match({index: [index]});
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the reset fails while deleting all indexes', () => {
      var
        error = new Error('Mocked delete error'),
        indexes = { index: []};

      indexes[kuzzle.config.internalIndex] = [];

      elasticsearch.client.indices.getMapping.returns(Promise.resolve(indexes));
      elasticsearch.client.indices.delete.returns(Promise.reject(error));

      return should(elasticsearch.deleteIndexes(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#createIndex', () => {
    it('should be able to create index', () => {
      elasticsearch.client.indices.create.returns(Promise.resolve({}));

      return should(elasticsearch.createIndex(requestObject)
        .then(() => {
          should(elasticsearch.client.indices.create.firstCall.args[0].index).be.exactly(requestObject.index);
        })).be.fulfilled();
    });

    it('should reject the createIndex promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.create.returns(Promise.reject(error));

      return should(elasticsearch.createIndex(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#deleteIndex', () => {
    it('should be able to delete index', () => {
      elasticsearch.client.indices.delete.returns(Promise.resolve({}));

      return should(elasticsearch.deleteIndex(requestObject)
        .then(() => {
          should(elasticsearch.client.indices.delete.firstCall.args[0].index).be.exactly(requestObject.index);
        })
      ).be.fulfilled();
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', () => {
      elasticsearch.client.indices.delete.returns(Promise.reject(new Error()));

      return should(elasticsearch.deleteIndex(requestObject)).be.rejected();
    });
  });

  describe('#listIndexes', () => {
    it('should allow listing indexes', () => {
      elasticsearch.client.indices.getMapping.returns(Promise.resolve({indexes: []}));

      return should(elasticsearch.listIndexes(requestObject)).be.fulfilled();
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', () => {
      var error = new Error('Mocked error');
      elasticsearch.client.indices.getMapping.returns(Promise.reject(error));

      return should(elasticsearch.listIndexes(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#getInfos', () => {
    it('should allow getting elasticsearch informations', () => {
      var
        output = {version: {}, indices: {store: {}}};

      elasticsearch.client.cluster.stats.returns(Promise.resolve(output));
      elasticsearch.client.cluster.health.returns(Promise.resolve(output));
      elasticsearch.client.info.returns(Promise.resolve(output));

      return should(elasticsearch.getInfos(requestObject)).be.fulfilled();
    });
  });

  describe('#refreshIndex', () => {
    it('should send a valid request to es client', () => {
      elasticsearch.client.indices.refresh.returns(Promise.resolve(requestObject));

      return elasticsearch.refreshIndex(requestObject)
        .then(data => {
          should(data.index).be.eql(index);
        });
    });
  });

  describe('#getAutoRefresh', () => {
    it('should reflect the current autoRefresh status', () => {
      return should(elasticsearch.getAutoRefresh(requestObject)
        .then(response => {
          should(response).be.false();

          elasticsearch.settings.autoRefresh[requestObject.index] = true;
          return elasticsearch.getAutoRefresh(requestObject);
        })
        .then(response => {
          should(response).be.true();
          elasticsearch.settings.autoRefresh[requestObject.index] = false;
        })
      ).be.fulfilled();
    });
  });

  describe('#setAutoRefresh', () => {
    it('should toggle the autoRefresh status', () => {
      var
        req = new RequestObject({
          index: requestObject.index,
          body: { autoRefresh: true }
        });

      return should(elasticsearch.setAutoRefresh(req)
        .then(response => {
          should(response).be.true();
          should(kuzzle.internalEngine.createOrReplace.calledOnce).be.true();

          req.data.body.autoRefresh = false;
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
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded');

      elasticsearch.client.indices.refresh.returns(Promise.resolve({}));

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(elasticsearch.client.indices.refresh.called).be.false();
          should(response).be.eql({ foo: 'bar' });
        })).be.fulfilled();
    });

    it('should refresh the index if asked to', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded');

      elasticsearch.client.indices.refresh.returns(Promise.resolve({}));

      elasticsearch.settings.autoRefresh[requestObject.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(elasticsearch.client.indices.refresh.called).be.true();
          should(response).be.eql({ foo: 'bar' });
        })).be.fulfilled();
    });

    it('should not block execution in case the index could not be refreshed', () => {
      var
        error = new Error('Mocked error'),
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded');

      elasticsearch.client.indices.refresh.returns(Promise.reject(error));

      elasticsearch.settings.autoRefresh[requestObject.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(kuzzle.pluginsManager.trigger.calledWith('log:error')).be.true();
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

      return elasticsearch.indexExists(requestObject)
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

      return elasticsearch.indexExists(requestObject)
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

      return elasticsearch.collectionExists(requestObject)
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

      return elasticsearch.collectionExists(requestObject)
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
