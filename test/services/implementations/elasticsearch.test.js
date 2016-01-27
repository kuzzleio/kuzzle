var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Config = require.main.require('lib/config'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError.js'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', function () {
  var
    kuzzle = {
      indexes: {}
    },
    index = '%test',
    collection = 'unit-tests-elasticsearch',
    createdDocumentId = 'id-test',
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


  before(function () {
    kuzzle.config = new Config(params);

    elasticsearch = new ES(kuzzle, {service: engineType});
    elasticsearch.client = {
      indices: {},
      cat: {},
      cluster: {}
    };
  });

  beforeEach(function () {
    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: collection,
      index: index,
      body: documentAda
    });

    kuzzle.indexes[index] = [collection];
  });

  describe('#init', function () {
    it('should initialize properly', function (done) {
      should(elasticsearch.init()).be.exactly(elasticsearch);
      done();
    });
  });

  describe('#cleanData', function () {
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
  });

  describe('#search', function () {
    it('should be able to search documents', function (done) {
      var ret;

      elasticsearch.client.search = function (data) {
        should(data.body).be.exactly(filter);

        return q({total: 0, hits: []});
      };

      requestObject.data.body = filter;
      ret = elasticsearch.search(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(result.data).not.be.undefined().and.not.be.null();
          should(result.data.body.total).be.exactly(0);
          should(result.data.body.hits).be.an.Array();
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if a search fails', function () {

      elasticsearch.client.search = function (data) {
        should(data.body).not.be.exactly(filter);

        return q.reject(new Error());
      };

      return should(elasticsearch.search(requestObject)).be.rejected();
    });
  });

  describe('#create', function () {
    it('should allow creating documents', function (done) {
      var
        ret;

      kuzzle.indexes = {};

      elasticsearch.client.create = function (data) {
        should(data.index).be.exactly(index);
        should(data.type).be.exactly(collection);
        should(data.body).be.exactly(documentAda);

        return q({});
      };

      ret = elasticsearch.create(requestObject);

      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, [collection]);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the create promise if elasticsearch throws an error', function () {
      elasticsearch.client.create = function () {
        return q.reject(new Error());
      };

      return should(elasticsearch.create(requestObject)).be.rejected();
    });
  });

  describe('#createOrUpdate', function () {
    it('should support createOrUpdate capability', function (done) {
      var ret;

      kuzzle.indexes = {};

      elasticsearch.client.index = function (data) {
        should(data.index).be.exactly(index);
        should(data.type).be.exactly(collection);
        should(data.body).be.exactly(documentAda);
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      requestObject.data._id = createdDocumentId;
      ret = elasticsearch.createOrUpdate(requestObject);

      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, [collection]);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the createOrUpdate promise if elasticsearch throws an error', function () {
      var ret;

      elasticsearch.client.index = function (data) {
        return q.reject(new Error());
      };

      requestObject.data._id = createdDocumentId;
      ret = elasticsearch.createOrUpdate(requestObject);

      return should(ret).be.rejected();
    });
  });

  describe('#replace', function () {
    it('should support replace capability', function (done) {
      var ret;

      elasticsearch.client.exists = function (data) {
        return q(true);
      };

      elasticsearch.client.index = function (data) {
        should(data.index).be.exactly(index);
        should(data.type).be.exactly(collection);
        should(data.body).be.exactly(documentAda);
        should(data.id).be.exactly(createdDocumentId);

        return Promise.resolve({});
      };

      requestObject.data._id = createdDocumentId;
      ret = elasticsearch.replace(requestObject);

      should(ret).be.a.Promise();
      done();
    });

    it('should reject the replace promise if elasticsearch throws an error', function () {
      var ret;

      elasticsearch.client.index = function (data) {
        return Promise.reject(new Error());
      };

      requestObject.data._id = createdDocumentId;
      ret = elasticsearch.replace(requestObject);

      return should(ret).be.rejected();
    });

    it('should throw a NotFoundError Exception if document already exists', function () {
      var ret;

      kuzzle.indexes = {};

      elasticsearch.client.exists = function (data) {
        return q(false);
      };

      elasticsearch.client.index = function (data) {
        should(data.index).be.exactly(index);
        should(data.type).be.exactly(collection);
        should(data.body).be.exactly(documentAda);
        should(data.id).be.exactly(createdDocumentId);

        return Promise.resolve({});
      };

      requestObject.data._id = createdDocumentId;
      ret = elasticsearch.replace(requestObject);

      should(ret).be.rejectedWith(NotFoundError, { message: 'Document with id ' + requestObject.data._id + ' not found.' });
    });
  });

  describe('#get', function () {
    it('should allow getting a single document', function (done) {
      var ret;

      elasticsearch.client.get = function (data) {
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      ret = elasticsearch.get(requestObject);

      should(ret).be.a.Promise();

      ret
        .then(result => {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, [collection]);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject requests when the user search for a document with id _search', function () {
      elasticsearch.client.get = function (data) {
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      requestObject.data._id = '_search';
      return should(elasticsearch.get(requestObject)).be.rejectedWith(BadRequestError);
    });
  });


  describe('#mget', function () {
    it('should return a rejected promise if getting a single document fails', function () {

      elasticsearch.client.get = function (data) {
        should(data.id).be.undefined();

        return q.reject(new Error());
      };


      return should(elasticsearch.get(requestObject)).be.rejected();
    });

    it('should allow getting multiples documents', function () {

      elasticsearch.client.mget = function (data) {
        should(data.body.ids).be.an.Array();

        return q(new Error());
      };

      delete requestObject.data.body;
      requestObject.data = {body: {ids: [1, 2, 3]}};

      return should(elasticsearch.mget(requestObject)).be.fulfilled();
    });

    it('should return a rejected promise if getting some multiple documents fails', function () {
      elasticsearch.client.mget = function (data) {
        should(data.body.ids).be.undefined();

        return q.reject(new Error());
      };

      requestObject.data.body = {};

      return should(elasticsearch.mget(requestObject)).be.rejected();
    });
  });

  describe('#count', function () {
    it('should allow counting documents using a provided filter', function (done) {
      var ret;

      elasticsearch.client.count = function (data) {
        should(data.body).have.keys();

        return q({});
      };

      requestObject.data.body = {};
      ret = elasticsearch.count(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          done();
        })
        .catch(error => done(error));
    });

    it('should allow counting objects using a query', function (done) {
      var ret;

      elasticsearch.client.count = function (data) {
        should(data.body).be.an.instanceOf(Object).and.have.property('query', {foo: 'bar'});

        return q({});
      };

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      ret = elasticsearch.count(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if the count fails', function () {

      elasticsearch.client.count = function (data) {
        return q.reject(new Error());
      };

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return should(elasticsearch.count(requestObject)).be.rejected();
    });
  });

  describe('#update', function () {
    it('should allow to update a document', function (done) {
      var ret;

      kuzzle.indexes = {};

      elasticsearch.client.update = function (data) {
        should(data.body.doc).be.exactly(documentAda);
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      requestObject.data._id = createdDocumentId;

      ret = elasticsearch.update(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, [collection]);
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if an update fails', function () {

      elasticsearch.client.update = function (data) {
        should(data.id).be.undefined();

        return q.reject(new Error());
      };

      return should(elasticsearch.update(requestObject)).be.rejected();
    });
  });

  describe('#delete', function () {
    it('should allow to delete a document', function () {

      elasticsearch.client.delete = function (data) {
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.delete(requestObject)).be.fulfilled();
    });

    it('should return a rejected promise if a delete fails', function () {

      elasticsearch.client.delete = function (data) {
        should(data.id).be.undefined();

        return q.reject(new Error());
      };

      return should(elasticsearch.delete(requestObject)).be.rejected();
    });
  });

  describe('#deleteByQuery', function () {
    it('should return an empty result array when no document has been deleted using a filter', function (done) {
      delete requestObject.data.body;
      requestObject.data.filter = {term: {firstName: 'no way any document can be returned with this filter'}};

      elasticsearch.client.search = function (data, callback) {
        should(data.query).be.exactly(requestObject.data.query);

        callback(null, {hits: {hits: [], total: 0}});
      };

      elasticsearch.deleteByQuery(requestObject)
        .then(function (result) {
          // Ugly line in order to spot a random bug on this unit test
          should(result.data.body.ids).not.be.undefined().and.be.an.Array();
          should(result.data.body.ids.length).be.exactly(0);
          done();
        })
        .catch(error => done(error));
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

        return q(mockupIds);
      };

      ES.__with__({
        getAllIdsFromQuery: function () {
          return q(mockupIds);
        }
      })(function () {
        elasticsearch.deleteByQuery(requestObject)
          .then(function (result) {
            try {
              should(result.data.body.ids).not.be.undefined().and.be.an.Array();
              should(result.data.body.ids).match(mockupIds);
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

      elasticsearch.client.search = function (data, callback) {
        callback(new Error(), {});
      };

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });

    it('should return a rejected promise if the delete by query fails because of a bulk failure', function () {
      elasticsearch.client.bulk = function () {
        return q.reject(new Error('rejected'));
      };
      requestObject.data.body = {};

      return ES.__with__({
        getAllIdsFromQuery: function () {
          return q(['foo', 'bar']);
        }
      })(function () {
        return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
      });
    });
  });

  describe('#bulk', function () {
    it('should support bulk data import', function () {
      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _type: collection, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _type: collection, _index: index}}
      ];

      elasticsearch.client.bulk = function (data) {
        should(data.body).be.exactly(requestObject.data.body);

        return q({});
      };

      return should(elasticsearch.import(requestObject)).be.fulfilled();
    });


    it('should raise a "Partial Error" response for bulk data import with some errors', function (done) {
      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 12, _type: collection, _index: index}},
        {doc: {firstName: 'foobar'}},
        {update: {_id: 212, _type: collection, _index: index}},
        {doc: {firstName: 'foobar'}}
      ];

      elasticsearch.client.bulk = function (data) {
        should(data.body).be.exactly(requestObject.data.body);

        return q({
          errors: true,
          items: {
            12: {index: {status: 404, error: 'DocumentMissingException'}},
            212: {index: {status: 404, error: 'DocumentMissingException'}}
          }
        });
      };

      elasticsearch.import(requestObject)
        .then(function (result) {
          try {
            should(result.status).be.exactly(206);
            should(result.error).be.not.null();
            should(result.error.count).be.exactly(2);
            should(result.error.message).be.exactly('Some errors on bulk');
            should(result.error.errors).be.an.Array().and.match([{status: 404}]).and.match([{error: /^DocumentMissingException/}]);
            done();
          } catch (e) {
            done(e);
          }
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should override the type with the collection if one has been specified in the request', function () {
      kuzzle.indexes = {};

      requestObject.data.body = [
        {index: {_id: 1, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _index: 'indexAlt'}},
        {firstName: 'bar'},
        {update: {_id: 1, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _index: 'indexAlt'}}
      ];

      elasticsearch.client.bulk = function (data) {
        should(data.body).be.an.Array().and.match([
          {index: {_id: 1, _index: index, _type: collection}},
          {firstName: 'foo'},
          {index: {_id: 2, _index: 'indexAlt', _type: collection}},
          {firstName: 'bar'},
          {update: {_id: 1, _index: index, _type: collection}},
          {doc: {firstName: 'foobar'}},
          {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
        ]);

        return q({
          items: [
            {index: {_id: 1, _index: index, _type: collection}},
            {index: {_id: 2, _index: 'indexAlt', _type: collection}},
            {update: {_id: 1, _index: index, _type: collection}},
            {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
          ]
        });
      };

      return should(elasticsearch.import(requestObject)).be.fulfilled();
    });

    it('should reject the import promise if elasticsearch throws an error', function () {
      requestObject.data.body = [
        {index: {_id: 1, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _index: index}}
      ];

      elasticsearch.client.bulk = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no body is provided', function () {
      delete requestObject.data.body;
      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no type has been provided, locally or globally', function () {
      delete requestObject.collection;

      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _type: collection, _index: index}}
      ];

      elasticsearch.client.bulk = function (data) {
        return q({});
      };

      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no index has been provided, locally or globally', function () {
      delete requestObject.index;

      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _type: collection}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _type: collection, _index: index}}
      ];

      elasticsearch.client.bulk = function (data) {
        return q({});
      };

      return should(elasticsearch.import(requestObject)).be.rejected();
    });
  });

  describe('#putMapping', function () {
    it('should have mapping capabilities', function () {
      requestObject.data.body = {
        properties: {
          city: {type: 'string'}
        }
      };
      elasticsearch.client.indices.putMapping = function (data) {
        should(data.body).be.exactly(requestObject.data.body);

        return q({});
      };

      return should(elasticsearch.putMapping(requestObject)).be.fulfilled();
    });

    it('should reject bad mapping input', function () {

      elasticsearch.client.indices.putMapping = function (data) {
        should(data.body).not.have.key('properties');

        return q.reject({});
      };

      return should(elasticsearch.putMapping(requestObject)).be.rejected();
    });
  });

  describe('#getMapping', function () {
    it('should allow users to retrieve a mapping', function (done) {

      elasticsearch.client.indices.getMapping = function (data) {
        var mappings = {};

        mappings[index] = {mappings: {}};

        return q(mappings);
      };

      elasticsearch.getMapping(requestObject)
        .then(function (result) {
          should(result.data).not.be.undefined();
          should(result.data.body[requestObject.index]).not.be.undefined();
          should(result.data.body[requestObject.index].mappings).not.be.undefined();
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if there is no mapping found', function () {
      requestObject.collection = 'foobar';
      requestObject.index = 'kuzzle-unit-tests-fakeindex';

      elasticsearch.client.indices.getMapping = function (data) {
        var mappings = {};

        mappings[index] = {mappings: {}};
        mappings[index].mappings[collection] = {};

        return q(mappings);
      };

      return should(elasticsearch.getMapping(requestObject)).be.rejected();
    });

    it('should reject the getMapping promise if elasticsearch throws an error', function () {

      elasticsearch.client.indices.getMapping = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.getMapping(requestObject)).be.rejected();
    });
  });

  describe('#deleteCollection', function () {
    it('should allow deleting an entire collection', function (done) {

      elasticsearch.client.indices.deleteMapping = function (data) {
        return q({});
      };

      delete requestObject.data.body;
      should(elasticsearch.deleteCollection(requestObject)).be.fulfilled()
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, []);
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if the delete collection function fails', function () {
      // because we already deleted the collection in the previous test, it should naturally fail
      elasticsearch.client.indices.deleteMapping = function (data) {
        return q.reject(new Error());
      };

      delete requestObject.data.body;
      return should(elasticsearch.deleteCollection(requestObject)).be.rejected();
    });
  });

  describe('#getAllIdsFromQuery', function () {
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
        .catch(error => done(error));
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
        .catch(error => done(error));
    });
  });

  describe('#listCollections', function () {
    it('should allow listing all available collections', function () {

      elasticsearch.client.indices.getMapping = function (data) {
        var mappings = {};

        mappings[index] = {mappings: {}};
        mappings[index].mappings[collection] = {};

        return q(mappings);
      };

      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.fulfilled();
    });

    it('should reject the listCollections promise if elasticsearch throws an error', function () {

      elasticsearch.client.indices.getMapping = function (data) {
        return q.reject(new Error());
      };

      requestObject.index = 'kuzzle-unit-tests-fakeindex';
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.rejected();
    });
  });

  describe('#createCollection', function () {
    it('should allow creating a new collection', function (done) {

      elasticsearch.client.indices.putMapping = function (data) {
        return q();
      };

      requestObject.collection = '%foobar';
      elasticsearch.createCollection(requestObject)
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, [collection, requestObject.collection]);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the createCollection promise if elasticsearch throws an error', function () {

      elasticsearch.client.indices.putMapping = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.createCollection(requestObject)).be.rejected();
    });
  });

  describe('#truncateCollection', function () {
    it('should allow truncating an existing collection', function (done) {
      var
        mapping = {},
        hasRetrievedMapping = false,
        hasDeletedMapping = false,
        hasCreatedMapping = false;

      mapping[index] = {mappings: {}};
      mapping[index].mappings[collection] = {foo: 'bar'};

      elasticsearch.client.indices.getMapping = function (data) {
        hasRetrievedMapping = true;
        return q(mapping);
      };
      elasticsearch.client.indices.deleteMapping = function (data) {
        hasDeletedMapping = true;
        return q();
      };
      elasticsearch.client.indices.putMapping = function (data) {
        should(data.body[data.type]).be.exactly(mapping[requestObject.index].mappings[requestObject.collection]);
        hasCreatedMapping = true;
        return q();
      };

      elasticsearch.truncateCollection(requestObject)
        .then(function (result) {
          should(hasRetrievedMapping).be.exactly(true);
          should(hasDeletedMapping).be.exactly(true);
          should(hasCreatedMapping).be.exactly(true);
          done();
        })
        .catch(error => done(error));
    });

    it('should return an error if trying to truncate a non-existing collection', function () {
      var
        mapping = {};

      mapping[index] = {mappings: {}};
      mapping[index].mappings[collection] = {foo: 'bar'};

      elasticsearch.client.indices.getMapping = function (data) {
        return q(mapping);
      };
      elasticsearch.client.indices.deleteMapping = function (data) {
        return q.reject();
      };

      requestObject.collection = 'non existing collection';
      return should(elasticsearch.truncateCollection(requestObject)).be.rejected();
    });

    it('should return an error if trying to truncate a non-existing collection into an non-existing index', function () {
      var
        mapping = {};

      mapping[index] = {mappings: {}};
      mapping[index].mappings[collection] = {foo: 'bar'};

      elasticsearch.client.indices.getMapping = function (data) {
        return q(mapping);
      };

      requestObject.index = 'non existing index';
      return should(elasticsearch.truncateCollection(requestObject)).be.rejected();
    });
  });

  describe('#reset', function () {
    it('should allow deleting all indexes', function (done) {
      var
        ret,
        deletedAll = false;

      elasticsearch.client.cat.indices = function (data) {
        return q('      \n %kuzzle      \n ' + index + ' \n  ');
      };

      elasticsearch.client.indices.delete = function (param) {
        try {
          should(param).be.an.Object().and.match({index: [index]});
          deletedAll = true;
          return q({});
        }
        catch (error) {
          done(error);
          return q.reject(error);
        }
      };

      ret = elasticsearch.deleteIndexes(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function () {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.keys();
          should(deletedAll).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should return a rejected promise if the reset fails while deleting all indexes', function () {
      elasticsearch.client.indices.getMapping = function (data) {
        var indexes = {};
        indexes[kuzzle.config.internalIndex] = [];
        indexes[index] = [];
        return q(indexes);
      };
      elasticsearch.client.indices.delete = function () {
        return q.reject(new Error('rejected'));
      };

      return should(elasticsearch.deleteIndexes(requestObject)).be.rejected();
    });
  });

  describe('#createIndex', function () {
    it('should be able to create index', function (done) {
      var ret;

      kuzzle.indexes = {};

      elasticsearch.client.indices.create = function (data) {
        should(data.index).be.exactly(requestObject.index);

        return q({});
      };

      ret = elasticsearch.createIndex(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.property(index, []);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the createIndex promise if elasticsearch throws an error', function () {
      elasticsearch.client.indices.create = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.createIndex(requestObject)).be.rejected();
    });
  });

  describe('#deleteIndex', function () {
    it('should be able to delete index', function (done) {
      var ret;

      elasticsearch.client.indices.delete = function (data) {
        should(data.index).be.exactly(requestObject.index);

        return q({});
      };

      ret = elasticsearch.deleteIndex(requestObject);
      should(ret).be.a.Promise();

      ret
        .then(function (result) {
          should(kuzzle.indexes).be.an.instanceOf(Object).and.have.keys();
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', function () {
      elasticsearch.client.indices.delete = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.deleteIndex(requestObject)).be.rejected();
    });
  });

  describe('#listIndexes', function () {
    it('should allow listing indexes', function (done) {
      elasticsearch.client.indices.getMapping = function (data) {
        var indexes = {};
        indexes[index] = [];
        return q(indexes);
      };

      elasticsearch.listIndexes(requestObject)
        .then(result => {
          should(result.data.body.indexes).be.an.instanceOf(Array).and.match([index]);
          done();
        })
        .catch(error => done(error));
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', function () {
      elasticsearch.client.indices.getMapping = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.listIndexes(requestObject)).be.rejected();
    });
  });

  describe('#getInfos', function () {
    it('should allow getting elasticsearch informations', function () {
      var esStub = function () { return q({version: {}, indices: {store: {}}}); };

      elasticsearch.client.info = elasticsearch.client.cluster.health = elasticsearch.client.cluster.stats = esStub;
      return should(elasticsearch.getInfos(requestObject)).be.fulfilled();
    });
  });
});
