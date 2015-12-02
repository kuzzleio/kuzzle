var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Config = require.main.require('lib/config'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ES = rewire('../../../lib/services/elasticsearch');

require('should-promised');

describe('Test: ElasticSearch service', function () {
  var
    kuzzle = {
      indexes: {}
    },
    index = '%test',
    collection = 'unit-tests-elasticsearch',
    createdDocumentId,
    elasticsearch,
    engineType = 'readEngine',
    requestObject,
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London',
      hobby: 'computer'
    },
    filter = {
      filter: {
        and: [
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
    };

  beforeEach(function () {
    kuzzle.config = new Config(params);

    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: collection,
      index: index,
      body: documentAda
    });

    elasticsearch = new ES(kuzzle, {service: engineType});
    should(elasticsearch.init()).be.exactly(elasticsearch);
  });

  after(function (done) {
    /*
    We catch a rejected promise because one should be thrown if all tests succeed,
    has there isn't any collection left to delete.

    This hook is here only to ensure we clean up after tests if a test fails.
     */
    elasticsearch.deleteCollection(requestObject)
      .then(function () {
        elasticsearch.deleteIndex(requestObject)
          .then(function () {
            done();
          })
          .catch(function () {
            done();
          });
      })
      .catch(function () {
        elasticsearch.deleteIndex(requestObject)
          .then(function () {
            done();
          })
          .catch(function () {
            done();
          });
      });
  });

  // init
  it('should initialize properly', function () {
    should(elasticsearch.init()).be.exactly(elasticsearch);
    should(elasticsearch.client).not.be.null();
  });

  // cleanData
  it('should prepare the data for elasticsearch', function () {
    var
      cleanData = ES.__get__('cleanData'),
      preparedData;

    requestObject.data._id = 'foobar';
    preparedData = cleanData.call(elasticsearch, requestObject);

    should(preparedData.type).be.exactly(requestObject.collection);
    should(preparedData.id).be.exactly(requestObject.data._id);
    should(preparedData._id).be.undefined();
    should(preparedData.index).be.exactly(requestObject.index);

    // we expect all properties expect _id to be carried over the new data object
    Object.keys(requestObject.data).forEach(function (member) {
      if (member !== '_id') {
        should(preparedData[member]).be.exactly(requestObject.data[member]);
      }
    });
  });

  // multi-index
  it('should be able to create index', function (done) {
    var ret;

    requestObject.data.body = filter;
    ret = elasticsearch.createIndex(requestObject);
    should(ret).be.a.Promise();

    ret
      .then(function(result) {
        should(result.error).not.be.undefined().and.be.null();
        should(result.index).be.exactly(requestObject.index);
        console.log(result);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  // search
  it('should be able to search documents', function (done) {
    var ret;

    requestObject.data.body = filter;
    ret = elasticsearch.search(requestObject);
    should(ret).be.a.Promise();

    ret
      .then(function(result) {
        should(result.error).not.be.undefined().and.be.null();
        should(result.data).not.be.undefined().and.not.be.null();
        should(result.data.hits).not.be.undefined();
        should(result.data.hits.total).be.exactly(0);
        should(result.data.hits.hits).be.an.Array();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if a search fails', function () {
    return should(elasticsearch.search(requestObject)).be.rejected();
  });

  // create
  it('should allow creating documents', function (done) {
    var ret = elasticsearch.create(requestObject);

    should(ret).be.a.Promise();

    ret
      .then(function (result) {
        should(result._type).be.exactly(collection);
        should(result._id).not.be.undefined().and.be.a.String();
        should(result.created).be.true();
        createdDocumentId = result._id;
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  // createOrUpdate
  it('should support createOrUpdate capability', function (done) {
    var ret;

    requestObject.data.id = createdDocumentId;
    ret = elasticsearch.createOrUpdate(requestObject);

    should(ret).be.a.Promise();

    ret
      .then(function (result) {
        should(result._type).be.exactly(collection);
        should(result._id).be.exactly(requestObject.data.id);
        should(result.created).be.false();
        should(result._version).be.eql(2);
        createdDocumentId = result._id;
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  // get
  it('should allow getting a single document', function (done) {
    var ret;

    delete requestObject.data.body;
    requestObject.data._id = createdDocumentId;

    ret = elasticsearch.get(requestObject);

    should(ret).be.a.Promise();

    ret
      .then(function (result) {
        should(result.data).not.be.undefined().and.be.an.Object();
        should(result.data._id).be.exactly(createdDocumentId);
        should(result.data.found).be.true();
        should(result.data._source).match(documentAda);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if getting a single document fails', function () {
    return should(elasticsearch.get(requestObject)).be.rejected();
  });

  // mget
  it('should return a rejected promise if getting some multiple documents fails', function () {
    return should(elasticsearch.mget(requestObject)).be.rejected();
  });

  // count
  it('should allow counting documents using a provided filter', function (done) {
    var ret;

    requestObject.data.body = {};
    ret = elasticsearch.count(requestObject);
    should(ret).be.a.Promise();

    ret
      .then(function(result) {
        should(result.data).not.be.undefined();
        should(result.data.body).be.an.Object().and.match({});
        should(result.data.count).be.a.Number();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should allow counting objects using a query', function (done) {
    var ret;

    delete requestObject.data.body;
    requestObject.data.query = { match: {firstName: 'Ada'}};
    ret = elasticsearch.count(requestObject);
    should(ret).be.a.Promise();

    ret
      .then(function(result) {
        should(result.data).not.be.undefined();
        should(result.data.query).be.an.Object().and.match({});
        should(result.data.count).be.a.Number();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if the count fails', function () {
    return should(elasticsearch.count(requestObject)).be.rejected();
  });

  // update
  it('should allow to update a document', function () {
    requestObject.data._id = createdDocumentId;
    return should(elasticsearch.update(requestObject)).be.fulfilled();
  });

  it('should return a rejected promise if an update fails', function () {
    return should(elasticsearch.update(requestObject)).be.rejected();
  });

  // delete
  it('should allow to delete a document', function () {
    delete requestObject.data.body;
    requestObject.data._id = createdDocumentId;
    return should(elasticsearch.delete(requestObject)).be.fulfilled();
  });

  it('should return a rejected promise if a delete fails', function () {
    return should(elasticsearch.delete(requestObject)).be.rejected();
  });

  // deleteByQuery
  it('should return an empty result array when no document has been deleted using a filter', function (done) {
    delete requestObject.data.body;
    requestObject.data.query = { term: {firstName: 'no way any document can be returned with this filter'}};

    elasticsearch.deleteByQuery(requestObject)
      .then(function (result) {
        should(result.ids).not.be.undefined().and.be.an.Array();
        should(result.ids.length).be.exactly(0);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should allow to delete documents using a provided filter', function (done) {
    var mockupIds = ['foo', 'bar', 'baz'];

    elasticsearch.client.bulk = function (bulkData) {
      try {
        should(bulkData.body).not.be.undefined().and.be.an.Array();
        should(bulkData.body.length).be.exactly(mockupIds.length);

        bulkData.body.forEach(function (cmd) {
          should(cmd).be.an.Object();
          should(cmd.delete).not.be.undefined().and.be.an.Object();
          should(mockupIds.indexOf(cmd.delete._id)).not.be.eql(-1);
          should(cmd.delete._type).be.exactly(requestObject.collection);
        });
      }
      catch (error) {
        done(error);
      }

      return Promise.resolve(mockupIds);
    };

    ES.__with__({
      getAllIdsFromQuery: function () {
        return Promise.resolve(mockupIds);
      }
    })(function () {
      elasticsearch.deleteByQuery(requestObject)
        .then(function (result) {
          try {
            should(result.ids).not.be.undefined().and.be.an.Array();
            should(result.ids).match(mockupIds);
            done();
          }
          catch (e) {
            done(e);
          }
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  it('should return a rejected promise if the delete by query fails because of a bad filter', function () {
    return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
  });

  it('should return a rejected promise if the delete by query fails because of a bulk failure', function () {
    elasticsearch.client.bulk = function () { return Promise.reject(new Error('rejected')); };
    requestObject.data.body = {};

    return ES.__with__({
      getAllIdsFromQuery: function () {
        return Promise.resolve(['foo', 'bar']);
      }
    })(function () {
      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });
  });

  // import (bulk)
  it('should support bulk data import', function () {
    requestObject.data.body = [
        { index:  {_id: 1, _type: collection } },
        { firstName: 'foo' },
        { index:  {_id: 2, _type: collection } },
        { firstName: 'bar' },
        { update: {_id: 1, _type: collection } },
        { doc: { firstName: 'foobar' } },
        { delete: {_id: 2, _type: collection } }
      ];

    return should(elasticsearch.import(requestObject)).be.fulfilled();
  });


  it('should raise a "Partial Error" response for bulk data import with some errors', function (done) {
    requestObject.data.body = [
        { index:  {_id: 1, _type: collection } },
        { firstName: 'foo' },
        { index:  {_id: 2, _type: collection } },
        { firstName: 'bar' },
        { update: {_id: 12, _type: collection } },
        { doc: { firstName: 'foobar' } },
        { update: {_id: 212, _type: collection } },
        { doc: { firstName: 'foobar' } }
      ];

    elasticsearch.import(requestObject)
      .then(function(result) {
        try {
          should(result.status).be.exactly(206);
          should(result.error).be.not.null();
          should(result.error.count).be.exactly(2);
          should(result.error.message).be.exactly('Some error on bulk');
          should(result.error.errors).be.an.Array().and.match([{status: 404}]).and.match([{error: /^DocumentMissingException/}]);
          done();
        } catch(e) {
          done(e);
        }
      })
      .catch(function(error) {
        done(error);
      });
  });

  it('should override the type with the collection if one has been specified in the document', function () {
    requestObject.data.body = [
      { index:  {_id: 1} },
      { firstName: 'foo' },
      { index:  {_id: 2} },
      { firstName: 'bar' },
      { update: {_id: 1} },
      { doc: { firstName: 'foobar' } },
      { delete: {_id: 2} }
    ];

    return should(elasticsearch.import(requestObject)).be.fulfilled();
  });

  it('should return a rejected promise if no body is provided', function () {
    delete requestObject.data.body;
    return should(elasticsearch.import(requestObject)).be.rejected();
  });

  it('should return a rejected promise if no type has been provided, locally or globally', function () {
    delete requestObject.collection;
    requestObject.data.body = [
      { index:  {_id: 1, _type: collection } },
      { firstName: 'foo' },
      { index:  {_id: 2, _type: collection } },
      { firstName: 'bar' },
      { update: {_id: 1} },
      { doc: { firstName: 'foobar' } },
      { delete: {_id: 2, _type: collection } }
    ];

    return should(elasticsearch.import(requestObject)).be.rejected();
  });

  // putMapping
  it('should have mapping capabilities', function () {
    requestObject.data.body =  {
      properties: {
        city: {type: 'string'}
      }
    };

    return should(elasticsearch.putMapping(requestObject)).be.fulfilled();
  });

  it('should reject bad mapping input', function () {
    return should(elasticsearch.putMapping(requestObject)).be.rejected();
  });

  // getMapping
  it('should allow users to retrieve a mapping', function (done) {
    elasticsearch.getMapping(requestObject)
      .then(function (result) {
        should(result.data).not.be.undefined();
        should(result.data.mainindex).not.be.undefined();
        should(result.data.mainindex.mappings).not.be.undefined();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if there is no mapping found', function () {
    requestObject.collection = 'foobar';
    return should(elasticsearch.getMapping(requestObject)).be.rejected();
  });

  it('should reject the getMapping promise if elasticsearch throws an error', function () {
    kuzzle.config[engineType].index = 'kuzzle-unit-tests-fakeindex';
    delete requestObject.data.body;
    return should(elasticsearch.getMapping(requestObject)).be.rejected();
  });

  // deleteCollection
  it('should allow deleting an entire collection', function () {
    delete requestObject.data.body;
    return should(elasticsearch.deleteCollection(requestObject)).be.fulfilled();
  });

  it('should return a rejected promise if the delete collection function fails', function () {
    // because we already deleted the collection in the previous test, it should naturally fail
    delete requestObject.data.body;
    return should(elasticsearch.deleteCollection(requestObject)).be.rejected();
  });

  // reset
  it('should allow resetting the database', function (done) {
    var
      ret,
      deletedAll = false,
      mainindexCreated = false;

    elasticsearch.client.indices.delete = function (param) {
      try {
        should(param).be.an.Object().and.match({index: '_all'});
        deletedAll = true;
        return Promise.resolve({});
      }
      catch (error) {
        done(error);
      }
    };

    elasticsearch.client.indices.create = function (param) {
      try {
        should(param).be.an.Object().and.match({index: 'mainindex'});
        mainindexCreated = true;
        return Promise.resolve({});
      }
      catch (error) {
        done(error);
      }
    };

    ret = elasticsearch.reset();
    should(ret).be.a.Promise();

    ret
      .then(function () {
        should(deletedAll).be.true();
        should(mainindexCreated).be.true();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if the reset fails while creating the main index', function () {
    elasticsearch.client.indices.delete = function () { return Promise.resolve({}); };
    elasticsearch.client.indices.create = function () { return Promise.reject(new Error('rejected')); };

    return should(elasticsearch.reset()).be.rejected();
  });

  it('should return a rejected promise if the reset fails while deleting the database', function () {
    elasticsearch.client.indices.delete = function () { return Promise.reject(new Error('rejected')); };

    return should(elasticsearch.reset()).be.rejected();
  });

  // getAllIdsFromQuery
  it('should be able to get every ids matching a query', function (done) {
    var
      ret,
      getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
      ids = ['foo', 'bar'];

    elasticsearch.client.search = function (data, callback) {
      var response = {
        hits: {
          hits: [
            {_id: 'foo'},
            {_id: 'bar'}
          ],
          total: 2
        }
      };
      callback(null, response);
    };

    ret = getAllIdsFromQuery.call(elasticsearch, requestObject);
    should(ret).be.a.Promise();

    ret
      .then(function (result) {
        should(result).be.an.Array().and.match(ids);
        should(result.length).be.exactly(2);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if the search fails', function () {
    var getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery');

    elasticsearch.client.search = function (data, callback) {
      callback(new Error('rejected'));
    };

    return should(getAllIdsFromQuery.call(elasticsearch, requestObject)).be.rejectedWith('rejected');
  });

  it('should scroll through result pages until getting all ids', function (done) {
    var
      getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
      ids = ['foo', 'bar'];

    elasticsearch.client.search = function (data, callback) {
      var response = {
        hits: {
          hits: [
            {_id: 'foo'}
          ],
          total: 2
        }
      };
      callback(null, response);
    };


    elasticsearch.client.scroll = function (data, callback) {
      var response = {
        hits: {
          hits: [
            {_id: 'bar'}
          ],
          total: 2
        }
      };
      callback(null, response);
    };

    getAllIdsFromQuery.call(elasticsearch, requestObject)
      .then(function (result) {
        should(result).be.an.Array().and.match(ids);
        should(result.length).be.exactly(2);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  // listCollections
  it('should allow listing all available collections', function () {
    delete requestObject.data.body;
    return should(elasticsearch.listCollections(requestObject)).be.fulfilled();
  });

  it('should reject the listCollections promise if elasticsearch throws an error', function () {
    kuzzle.config[engineType].index = 'kuzzle-unit-tests-fakeindex';
    delete requestObject.data.body;
    return should(elasticsearch.listCollections(requestObject)).be.rejected();
  });

  // createCollection
  it('should allow creating a new collection', function () {
    return should(elasticsearch.createCollection(requestObject)).be.fulfilled();
  });

  // truncateCollection
  it('should allow truncating an existing collection', function () {
    return should(elasticsearch.truncateCollection(requestObject)).be.fulfilled();
  });

  it('should return an error if trying to truncate a non-existing collection', function () {
    requestObject.collection = 'non existing collection';
    return should(elasticsearch.truncateCollection(requestObject)).be.rejected();
  });
});
