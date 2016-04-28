var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Config = require.main.require('lib/config'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError.js'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', function () {
  var
    kuzzle = {},
    sandbox,
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


  before(()=> {
    kuzzle.config = new Config(params);

    elasticsearch = new ES(kuzzle, {service: engineType});

    // we make sure the service won't eer be able to connect to elasticsearch
    elasticsearch.init();
    elasticsearch.client.transport = {};
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: collection,
      index: index,
      body: documentAda
    });

    afterEach(() => {
      sandbox.restore();
    })
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
    it('should be able to search documents', () => {
      var spy = sandbox.stub(elasticsearch.client, 'search').resolves({total: 0, hits: []});

      requestObject.data.body = filter;

      return elasticsearch.search(requestObject)
        .then(function (result) {
          should(spy.firstCall.args[0].body).be.exactly(filter);
          should(result).be.an.Object();
          should(result.total).be.exactly(0);
          should(result.hits).be.an.Array();
        });
    });

    it('should return a rejected promise if a search fails', done => {
      var spy = sandbox.stub(elasticsearch.client, 'search').rejects({});

      elasticsearch.search(requestObject)
        .catch(() => {
          try {
            should(spy.firstCall.args[0].body).not.be.exactly(filter);
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#create', function () {
    it('should allow creating documents', () => {
      var
        spy = sandbox.stub(elasticsearch.client, 'create').resolves({}),
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);
      ES.__set__('refreshIndexIfNeeded', refreshIndexSpy);

      return should(elasticsearch.create(requestObject)
        .then(() => {
          var data = spy.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);

          should(refreshIndexSpy.calledOnce).be.true();
        })).be.fulfilled();
    });


    it('should reject the create promise if elasticsearch throws an error', function () {
      elasticsearch.client.create = function () {
        return q.reject(new Error());
      };

      return should(elasticsearch.create(requestObject)).be.rejected();
    });
  });

  describe('#createOrReplace', function () {
    it('should support createOrReplace capability', function () {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        spy = sandbox.stub(elasticsearch.client, 'index').resolves({});

      ES.__set__('refreshIndexIfNeeded', refreshIndexSpy);

      requestObject.data._id = createdDocumentId;
      return should(elasticsearch.createOrReplace(requestObject)
        .then(() => {
          var data = spy.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);
          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        })).be.fulfilled();

    });

    it('should reject the createOrReplace promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client, 'index').rejects({});

      requestObject.data._id = createdDocumentId;
      return should(elasticsearch.createOrReplace(requestObject)).be.rejected();
    });
  });

  describe('#replace', function () {
    it('should support replace capability', () => {
      var
        spy = sandbox.stub(elasticsearch.client, 'index').resolves({}),
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded);

      sandbox.stub(elasticsearch.client, 'exists').resolves(true);

      ES.__set__('refreshIndexIfNeeded', refreshIndexSpy);

      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.replace(requestObject)
        .then(() => {
          var data = spy.firstCall.args[0];

          should(data.index).be.exactly(index);
          should(data.type).be.exactly(collection);
          should(data.body).be.exactly(documentAda);
          should(data.id).be.exactly(createdDocumentId);

          should(refreshIndexSpy.calledOnce).be.true();
        })).be.fulfilled();
    });

    it('should reject the replace promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client, 'exists').resolves(true);
      sandbox.stub(elasticsearch.client, 'index').rejects({});

      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.replace(requestObject)).be.rejected();
    });

    it('should throw a NotFoundError Exception if document already exists', done => {
      var spy = sandbox.stub(elasticsearch.client, 'index').resolves({});

      sandbox.stub(elasticsearch.client, 'exists').resolves(false);

      kuzzle.indexes = {};
      requestObject.data._id = createdDocumentId;

      elasticsearch.replace(requestObject)
        .catch(err => {
          try {
            should(err).be.an.instanceOf(NotFoundError);
            should(err.message).be.exactly('Document with id ' + requestObject.data._id + ' not found.');
            should(spy.called).be.false();

            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#get', function () {
    it('should allow getting a single document', () => {
      var spy = sandbox.stub(elasticsearch.client, 'get').resolves({});

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.get(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].id).be.exactly(createdDocumentId);
        })).be.fulfilled();
    });

    it('should reject requests when the user search for a document with id _search', () => {
      var spy = sandbox.stub(elasticsearch.client, 'get').resolves({});

      requestObject.data._id = '_search';

      return should(elasticsearch.get(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].id).be.exactly(createdDocumentId);
        })).be.rejectedWith(BadRequestError);
    });
  });

  describe('#mget', function () {
    it('should return a rejected promise if getting a single document fails', done => {
      var
        spy = sandbox.stub(elasticsearch.client, 'get').rejects({});

      elasticsearch.get(requestObject)
        .catch(() => {
          try {
            should(spy.calledOnce).be.true();
            should(spy.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e) }
        });
    });

    it('should allow getting multiples documents', function () {

      elasticsearch.client.mget = function (data) {
        should(data.body.ids).be.an.Array();

        return q(new Error());
      };

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
    it('should allow counting documents using a provided filter', () => {
      elasticsearch.client.count = function (data) {
        should(data.body).have.keys();

        return q({});
      };

      requestObject.data.body = {};

      return elasticsearch.count(requestObject);
    });

    it('should allow counting objects using a query', () => {
      elasticsearch.client.count = function (data) {
        should(data.body).be.an.instanceOf(Object).and.have.property('query', {foo: 'bar'});

        return q({});
      };

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return elasticsearch.count(requestObject);
    });

    it('should return a rejected promise if the count fails', function () {
      elasticsearch.client.count = () => q.reject(new Error());

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return should(elasticsearch.count(requestObject)).be.rejected();
    });
  });

  describe('#update', function () {
    it('should allow to update a document', function () {
      elasticsearch.client.update = function (data) {
        should(data.body.doc).be.exactly(documentAda);
        should(data.id).be.exactly(createdDocumentId);

        return q({});
      };

      requestObject.data._id = createdDocumentId;

      return should(elasticsearch.update(requestObject)).be.fulfilled();
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
    it('should return an empty result array when no document has been deleted using a filter', () => {
      delete requestObject.data.body;
      requestObject.data.filter = {term: {firstName: 'no way any document can be returned with this filter'}};

      elasticsearch.client.search = function (data, callback) {
        should(data.query).be.exactly(requestObject.data.query);

        callback(null, {hits: {hits: [], total: 0}});
      };

      return elasticsearch.deleteByQuery(requestObject)
        .then(function (result) {
          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
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

    it('should return a rejected promise if the delete by query fails because the filter is null', function () {

      requestObject.data.body = null;

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });
  });

  describe('#import', function () {
    it('should support bulk data import', () => {
      var spy = sandbox.stub(elasticsearch.client, 'bulk').resolves({});

      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _type: collection, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _type: collection, _index: index}}
      ];

      return should(elasticsearch.import(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].body).be.exactly(requestObject.data.body);
        })).be.fulfilled();
    });

    it('should raise a "Partial Error" response for bulk data import with some errors', () => {
      var spy = sandbox.stub(elasticsearch.client, 'bulk').resolves({
        errors: true,
        items: {
          12: {index: {status: 404, error: 'DocumentMissingException'}},
          212: {index: {status: 404, error: 'DocumentMissingException'}}
        }
      });

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

      return should(elasticsearch.import(requestObject)
        .then(result => {
          should(spy.firstCall.args[0].body).be.exactly(requestObject.data.body);

          should(result.errors).be.true();
          should(result.partialErrors).be.an.Array().and.match([{status: 404}]).and.match([{error: /^DocumentMissingException/}]);
        })).be.fulfilled();
    });

    it('should override the type with the collection if one has been specified in the request', () => {
      var spy = sandbox.stub(elasticsearch.client, 'bulk').resolves({
        items: [
          {index: {_id: 1, _index: index, _type: collection}},
          {index: {_id: 2, _index: 'indexAlt', _type: collection}},
          {update: {_id: 1, _index: index, _type: collection}},
          {delete: {_id: 2, _index: 'indexAlt', _type: collection}}
        ]
      });

      requestObject.data.body = [
        {index: {_id: 1, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _index: 'indexAlt'}},
        {firstName: 'bar'},
        {update: {_id: 1, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _index: 'indexAlt'}}
      ];

      return should(elasticsearch.import(requestObject)
        .then(() => {
          var data = spy.firstCall.args[0];

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
      requestObject.data.body = [
        {index: {_id: 1, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _index: index}}
      ];

      sandbox.stub(elasticsearch.client, 'bulk').rejects({});

      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no body is provided', () => {
      delete requestObject.data.body;
      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no type has been provided, locally or globally', () => {
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

      sandbox.stub(elasticsearch.client, 'bulk').resolves({});

      return should(elasticsearch.import(requestObject)).be.rejected();
    });

    it('should return a rejected promise if no index has been provided, locally or globally', () => {
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

      sandbox.stub(elasticsearch.client, 'bulk').resolves({});

      return should(elasticsearch.import(requestObject)).be.rejected();
    });
  });

  describe('#updateMapping', function () {
    it('should have mapping capabilities', () => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'putMapping').resolves({});

      requestObject.data.body = {
        properties: {
          city: {type: 'string'}
        }
      };

      return should(elasticsearch.updateMapping(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].body).be.exactly(requestObject.data.body);
        })).be.fulfilled();
    });

    it('should reject bad mapping input', () => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'putMapping').rejects({});

      return should(elasticsearch.updateMapping(requestObject)
        .catch(() => {
          should(spy.firstCall.args[0]).not.have.key('properties');

          return q.reject({});
        })).be.rejected();
    });
  });

  describe('#getMapping', function () {
    it('should allow users to retrieve a mapping', () => {
      var mappings = {};
      mappings[index] = {mappings: {}};

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(mappings);

      return should(elasticsearch.getMapping(requestObject)
        .then(result => {
          should(result[requestObject.index]).not.be.undefined();
          should(result[requestObject.index].mappings).not.be.undefined();
        })).be.fulfilled();
    });

    it('should return a rejected promise if there is no mapping found', () => {
      var mappings = {}
      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      requestObject.collection = 'foobar';
      requestObject.index = 'kuzzle-unit-tests-fakeindex';

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(mappings);

      return should(elasticsearch.getMapping(requestObject)).be.rejected();
    });

    it('should reject the getMapping promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').rejects({});

      return should(elasticsearch.getMapping(requestObject)).be.rejected();
    });
  });

  describe('#getAllIdsFromQuery', function () {
    it('should be able to get every ids matching a query', () => {
      var
        spy,
        getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
        ids = ['foo', 'bar'];

      spy = sandbox.stub(elasticsearch.client, 'search').yields(null, {
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

    it('should return a rejected promise if the search fails', function () {
      var getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery');

      sandbox.stub(elasticsearch.client, 'search').yields(new Error('rejected'));
      return should(getAllIdsFromQuery.call(elasticsearch, requestObject)).be.rejectedWith('rejected');
    });

    it('should scroll through result pages until getting all ids', () => {
      var
        getAllIdsFromQuery = ES.__get__('getAllIdsFromQuery'),
        ids = ['foo', 'bar'];

      sandbox.stub(elasticsearch.client, 'search').yields(null, {
        hits: {
          hits: [{_id: 'foo'}],
          total: 2
        }
      });
      sandbox.stub(elasticsearch.client, 'scroll').yields(null, {
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

  describe('#listCollections', function () {
    it('should allow listing all available collections', function () {
      var mappings = {};

      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(mappings);
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.fulfilled();
    });

    it('should reject the listCollections promise if elasticsearch throws an error', function () {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').rejects({});

      requestObject.index = 'kuzzle-unit-tests-fakeindex';
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.rejected();
    });
  });

  describe('#createCollection', function () {
    it('should allow creating a new collection', function () {
      sandbox.stub(elasticsearch.client.indices, 'putMapping').resolves({});

      requestObject.collection = '%foobar';
      return should(elasticsearch.createCollection(requestObject)).be.fulfilled();
    });

    it('should reject the createCollection promise if elasticsearch throws an error', function () {
      sandbox.stub(elasticsearch.client.indices, 'putMapping').rejects({});

      return should(elasticsearch.createCollection(requestObject)).be.rejected();
    });
  });

  describe('#truncateCollection', function () {
    it('should allow truncating an existing collection', () => {
      var spy = sandbox.stub(elasticsearch, 'deleteByQuery').resolves({});

      return should(elasticsearch.truncateCollection(requestObject)
        .then(() => {
          var request = spy.firstCall.args[0];

          should(request).be.an.instanceOf(RequestObject);
          should(request.data.body).be.Object().and.be.empty();
        })).be.fulfilled();
    });
  });

  describe('#reset', function () {
    it('should allow deleting all indexes', () => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'delete').resolves({});

      sandbox.stub(elasticsearch.client.cat, 'indices').resolves('      \n %kuzzle      \n ' + index + ' \n  ');

      requestObject.data.body.indexes = [index];

      return should(elasticsearch.deleteIndexes(requestObject)
        .then(() => {
          should(spy.firstCall.args[0]).be.an.Object().and.match({index: [index]});
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the reset fails while deleting all indexes', function () {
      var indexes = { index: []};

      indexes[kuzzle.config.internalIndex] = [];

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(indexes);
      sandbox.stub(elasticsearch.client.indices, 'delete').rejects({});

      return should(elasticsearch.deleteIndexes(requestObject)).be.rejected();
    });
  });

  describe('#createIndex', function () {
    it('should be able to create index', function () {
      var spy = sandbox.stub(elasticsearch.client.indices, 'create').resolves({});

      return should(elasticsearch.createIndex(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].index).be.exactly(requestObject.index);
        })).be.fulfilled();
    });

    it('should reject the createIndex promise if elasticsearch throws an error', function () {
      sandbox.stub(elasticsearch.client.indices, 'create').rejects({});

      return should(elasticsearch.createIndex(requestObject)).be.rejected();
    });
  });

  describe('#deleteIndex', function () {
    it('should be able to delete index', function () {
      var spy = sandbox.stub(elasticsearch.client.indices, 'delete').resolves({});

      return should(elasticsearch.deleteIndex(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].index).be.exactly(requestObject.index);
        })
      ).be.fulfilled();
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', function () {
      elasticsearch.client.indices.delete = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.deleteIndex(requestObject)).be.rejected();
    });
  });

  describe('#listIndexes', function () {
    it('should allow listing indexes', function () {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves({indexes: []});

      return should(elasticsearch.listIndexes(requestObject)).be.fulfilled();
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', function () {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').rejects({});

      return should(elasticsearch.listIndexes(requestObject)).be.rejected();
    });
  });

  describe('#getInfos', function () {
    it('should allow getting elasticsearch informations', function () {
      var
        output = {version: {}, indices: {store: {}}};

      sandbox.stub(elasticsearch.client.cluster, 'stats').resolves(output);
      sandbox.stub(elasticsearch.client.cluster, 'health').resolves(output);
      sandbox.stub(elasticsearch.client, 'info').resolves(output);

      return should(elasticsearch.getInfos(requestObject)).be.fulfilled();
    });
  });

  describe('#refreshIndex', function () {
    it('should send a valid request to es client', () => {
      sandbox.stub(elasticsearch.client.indices, 'refresh').resolves(requestObject);

      return elasticsearch.refreshIndex(requestObject)
        .then(data => {
          should(data.index).be.eql(index);
        });
    });
  });
});
