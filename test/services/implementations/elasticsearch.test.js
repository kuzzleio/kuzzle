var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError.js'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ES = rewire('../../../lib/services/elasticsearch');

describe('Test: ElasticSearch service', function () {
  var
    kuzzle = {},
    sandbox = sinon.sandbox.create(),
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
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.pluginsManager = {
          trigger: () => {}
        };

        elasticsearch = new ES(kuzzle, {service: engineType});

        // we make sure the services won't ever be able to connect to elasticsearch
        elasticsearch.init();
        elasticsearch.client.transport = {};
        kuzzle.internalEngine.client.transport = {};
      });
  });

  beforeEach(() => {
    elasticsearch.autoRefresh = {};

    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: collection,
      index: index,
      body: documentAda
    });
  });

  afterEach(() => {
    sandbox.restore();
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

      return should(ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
        return elasticsearch.create(requestObject)
          .then(() => {
            var data = spy.firstCall.args[0];

            should(data.index).be.exactly(index);
            should(data.type).be.exactly(collection);
            should(data.body).be.exactly(documentAda);

            should(refreshIndexSpy.calledOnce).be.true();
          });
      })).be.fulfilled();
    });

    it('should reject the create promise if elasticsearch throws an error', function () {
      sandbox.stub(elasticsearch.client, 'create').rejects({});

      return should(elasticsearch.create(requestObject)).be.rejected();
    });
  });

  describe('#createOrReplace', function () {
    it('should support createOrReplace capability', function () {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        spy = sandbox.stub(elasticsearch.client, 'index').resolves({});

      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.createOrReplace(requestObject)
            .then(() => {
              var data = spy.firstCall.args[0];

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

      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.replace(requestObject)
            .then(() => {
              var data = spy.firstCall.args[0];

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
      requestObject.data._id = '_search';

      return should(elasticsearch.get(requestObject)).be.rejectedWith(BadRequestError);
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
          catch(e) { done(e); }
        });
    });

    it('should allow getting multiples documents', () => {
      var spy = sandbox.stub(elasticsearch.client, 'mget').resolves({});

      requestObject.data = {body: {ids: [1, 2, 3]}};

      return should(elasticsearch.mget(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].body.ids).be.an.Array();
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if getting some multiple documents fails', done => {
      var spy = sandbox.stub(elasticsearch.client, 'mget').rejects({});

      requestObject.data.body = {};

      elasticsearch.mget(requestObject)
        .catch(() => {
          try {
            should(spy.firstCall.args[0].body.ids).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#count', function () {
    it('should allow counting documents using a provided filter', () => {
      var spy = sandbox.stub(elasticsearch.client, 'count').resolves({});

      requestObject.data.body = {};

      return should(elasticsearch.count(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].body).have.keys();
        })
      ).be.fulfilled();
    });

    it('should allow counting objects using a query', () => {
      var spy = sandbox.stub(elasticsearch.client, 'count').resolves({});

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return should(elasticsearch.count(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].body).be.an.instanceOf(Object).and.have.property('query', {foo: 'bar'});
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if the count fails', function () {
      sandbox.stub(elasticsearch.client, 'count').rejects({});

      requestObject.data.body = {};
      requestObject.data.query = {foo: 'bar'};

      return should(elasticsearch.count(requestObject)).be.rejected();
    });
  });

  describe('#update', function () {
    it('should allow to update a document', function () {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        spy = sandbox.stub(elasticsearch.client, 'update').resolves({});

      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.update(requestObject)
            .then(() => {
              var data = spy.firstCall.args[0];
              should(data.body.doc).be.exactly(documentAda);
              should(data.id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if an update fails', done => {
      var spy = sandbox.stub(elasticsearch.client, 'update').rejects({});

      elasticsearch.update(requestObject)
        .catch(() => {
          try{
            should(spy.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#delete', function () {
    it('should allow to delete a document', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        spy = sandbox.stub(elasticsearch.client, 'delete').resolves({});

      delete requestObject.data.body;
      requestObject.data._id = createdDocumentId;

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.delete(requestObject)
            .then(() => {
              should(spy.firstCall.args[0].id).be.exactly(createdDocumentId);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
    });

    it('should return a rejected promise if a delete fails', done => {
      var spy = sandbox.stub(elasticsearch.client, 'delete').rejects({});

      elasticsearch.delete(requestObject)
        .catch(() => {
          try {
            should(spy.firstCall.args[0].id).be.undefined();
            done();
          }
          catch(e) { done(e); }
        });
    });
  });

  describe('#deleteByQuery', function () {
    it('should return an empty result array when no document has been deleted using a filter', () => {
      var spy = sandbox.stub(elasticsearch.client, 'search').yields(null, {hits: {hits: [], total: 0}});

      delete requestObject.data.body;
      requestObject.data.filter = {term: {firstName: 'no way any document can be returned with this filter'}};

      return should(elasticsearch.deleteByQuery(requestObject)
        .then(result => {
          should(spy.firstCall.args[0].query).be.exactly(requestObject.data.query);

          // Ugly line in order to spot a random bug on this unit test
          should(result.ids).not.be.undefined().and.be.an.Array();
          should(result.ids.length).be.exactly(0);
        })).be.fulfilled();
    });

    it('should allow to delete documents using a provided filter', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        mockupIds = ['foo', 'bar', 'baz'],
        spy = sandbox.stub(elasticsearch.client, 'bulk').resolves(mockupIds),
        getAllIdsStub = sinon.stub().resolves(mockupIds);

      return ES.__with__({
        getAllIdsFromQuery: getAllIdsStub,
        refreshIndexIfNeeded: refreshIndexSpy
      })(() => {
        return should(elasticsearch.deleteByQuery(requestObject)
          .then(result => {
            var bulkData = spy.firstCall.args[0];

            // elasticsearch.client.bullk
            should(bulkData.body).not.be.undefined().and.be.an.Array();
            should(bulkData.body.length).be.exactly(mockupIds.length);

            bulkData.body.forEach(function (cmd) {
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
      sandbox.stub(elasticsearch.client, 'search').yields(new Error(), {});

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });

    it('should return a rejected promise if the delete by query fails because of a bulk failure', () => {
      sandbox.stub(elasticsearch.client, 'bulk').rejects({});

      requestObject.data.body = {};

      return ES.__with__({
        getAllIdsFromQuery: () => q(['foo', 'bar'])
      })(function () {
        return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
      });
    });

    it('should return a rejected promise if the delete by query fails because the filter is null', () => {
      requestObject.data.body = null;

      return should(elasticsearch.deleteByQuery(requestObject)).be.rejected();
    });
  });

  describe('#import', function () {
    it('should support bulk data import', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        refreshIndexSpy = sandbox.spy(refreshIndexIfNeeded),
        spy = sandbox.stub(elasticsearch.client, 'bulk').resolves({});

      requestObject.data.body = [
        {index: {_id: 1, _type: collection, _index: index}},
        {firstName: 'foo'},
        {index: {_id: 2, _type: collection, _index: index}},
        {firstName: 'bar'},
        {update: {_id: 1, _type: collection, _index: index}},
        {doc: {firstName: 'foobar'}},
        {delete: {_id: 2, _type: collection, _index: index}}
      ];

      return should(
        ES.__with__('refreshIndexIfNeeded', refreshIndexSpy)(() => {
          return elasticsearch.import(requestObject)
            .then(() => {
              should(spy.firstCall.args[0].body).be.exactly(requestObject.data.body);

              should(refreshIndexSpy.calledOnce).be.true();
            });
        })
      ).be.fulfilled();
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

    it('should reject bad mapping input', done => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'putMapping').rejects({});

      elasticsearch.updateMapping(requestObject)
        .catch(() => {
          try {
            should(spy.firstCall.args[0]).not.have.key('properties');
            done();
          }
          catch(e) { done(e); }
        });
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
      var mappings = {};
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

    it('should return a rejected promise if the search fails', () => {
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
    it('should allow listing all available collections', () => {
      var mappings = {};

      mappings[index] = {mappings: {}};
      mappings[index].mappings[collection] = {};

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(mappings);
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.fulfilled();
    });

    it('should reject the listCollections promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').rejects({});

      requestObject.index = 'kuzzle-unit-tests-fakeindex';
      delete requestObject.data.body;
      return should(elasticsearch.listCollections(requestObject)).be.rejected();
    });
  });

  describe('#createCollection', function () {
    it('should allow creating a new collection', () => {
      sandbox.stub(elasticsearch.client.indices, 'putMapping').resolves({});

      requestObject.collection = '%foobar';
      return should(elasticsearch.createCollection(requestObject)).be.fulfilled();
    });

    it('should reject the createCollection promise if elasticsearch throws an error', () => {
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

    it('should return a rejected promise if the reset fails while deleting all indexes', () => {
      var indexes = { index: []};

      indexes[kuzzle.config.internalIndex] = [];

      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves(indexes);
      sandbox.stub(elasticsearch.client.indices, 'delete').rejects({});

      return should(elasticsearch.deleteIndexes(requestObject)).be.rejected();
    });
  });

  describe('#createIndex', function () {
    it('should be able to create index', () => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'create').resolves({});

      return should(elasticsearch.createIndex(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].index).be.exactly(requestObject.index);
        })).be.fulfilled();
    });

    it('should reject the createIndex promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client.indices, 'create').rejects({});

      return should(elasticsearch.createIndex(requestObject)).be.rejected();
    });
  });

  describe('#deleteIndex', function () {
    it('should be able to delete index', () => {
      var spy = sandbox.stub(elasticsearch.client.indices, 'delete').resolves({});

      return should(elasticsearch.deleteIndex(requestObject)
        .then(() => {
          should(spy.firstCall.args[0].index).be.exactly(requestObject.index);
        })
      ).be.fulfilled();
    });

    it('should reject the deleteIndex promise if elasticsearch throws an error', () => {
      elasticsearch.client.indices.delete = function (data) {
        return q.reject(new Error());
      };

      return should(elasticsearch.deleteIndex(requestObject)).be.rejected();
    });
  });

  describe('#listIndexes', function () {
    it('should allow listing indexes', () => {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').resolves({indexes: []});

      return should(elasticsearch.listIndexes(requestObject)).be.fulfilled();
    });

    it('should reject the listIndexes promise if elasticsearch throws an error', () => {
      sandbox.stub(elasticsearch.client.indices, 'getMapping').rejects({});

      return should(elasticsearch.listIndexes(requestObject)).be.rejected();
    });
  });

  describe('#getInfos', function () {
    it('should allow getting elasticsearch informations', () => {
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

  describe('#getAutoRefresh', function () {
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

  describe('#setAutoRefresh', function () {
    it('should toggle the autoRefresh status', () => {
      var
        spy = sandbox.stub(kuzzle.internalEngine, 'createOrReplace').resolves({}),
        req = new RequestObject({
          index: requestObject.index,
          body: { autoRefresh: true }
        });

      return should(elasticsearch.setAutoRefresh(req)
        .then(response => {
          should(response).be.true();
          should(spy.calledOnce).be.true();

          req.data.body.autoRefresh = false;
          return elasticsearch.setAutoRefresh(req);
        })
        .then(response => {
          should(response).be.false();
        })
      ).be.fulfilled();
    });
  });

  describe('#refreshIndexIfNeeded', function () {
    it('should not refresh the index if autoRefresh is set to false', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        spy = sandbox.stub(elasticsearch.client.indices, 'refresh').resolves({});

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(spy.called).be.false();
          should(response).be.eql({ foo: 'bar' });
        })).be.fulfilled();
    });

    it('should refresh the index if asked to', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        spy = sandbox.stub(elasticsearch.client.indices, 'refresh').resolves({});

      elasticsearch.settings.autoRefresh[requestObject.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(spy.called).be.true();
          should(response).be.eql({ foo: 'bar' });
        })).be.fulfilled();
    });

    it('should not block execution in case the index could not be refreshed', () => {
      var
        refreshIndexIfNeeded = ES.__get__('refreshIndexIfNeeded'),
        spy = sandbox.stub(elasticsearch.client.indices, 'refresh').rejects({}),
        pluginSpy = sandbox.spy(kuzzle.pluginsManager, 'trigger');

      elasticsearch.autoRefresh[requestObject.index] = true;

      return should(refreshIndexIfNeeded.call(elasticsearch, { index: requestObject.index }, { foo: 'bar' })
        .then(response => {
          should(pluginSpy.calledWith('log:error')).be.true();
          should(spy.called).be.true();
          should(response).be.eql({ foo: 'bar' });
        })
        .catch(err => {
          console.log(err);
        })

      ).be.fulfilled();
    });


  });

});
