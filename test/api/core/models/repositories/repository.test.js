var
  q = require('q'),
  should = require('should'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  Repository = require.main.require('lib/api/core/models/repositories/repository'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: repositories/repository', function () {
  var
    forwardedObject,
    persistedObject,
    repository,
    ObjectConstructor,
    mockCacheEngine,
    mockReadEngine,
    mockWriteLayer,
    cachedObject,
    uncachedObject;

  ObjectConstructor = function () {
    this.type = 'testObject';
  };

  persistedObject = new ObjectConstructor();
  persistedObject._id = -1;
  persistedObject.name = 'persisted';


  cachedObject = new ObjectConstructor();
  cachedObject._id = -2;
  cachedObject.name = 'cached';

  uncachedObject = new ObjectConstructor();
  uncachedObject._id = -3;
  uncachedObject.name = 'uncached';

  mockCacheEngine = {
    get: function (key) {
      if (key === repository.index + '/' + repository.collection + '/persisted') {
        return q(JSON.stringify(persistedObject));
      }
      if (key === repository.index + '/' + repository.collection + '/cached') {
        return q(JSON.stringify(cachedObject));
      }
      if (key === repository.index + '/' + repository.collection + '/error') {
        return q.reject(new InternalError('Error'));
      }
      if (key === repository.index + '/' + repository.collection + '/string') {
        return q('a string');
      }

      return q(null);
    },
    set: (key, value) => { forwardedObject = {op: 'set', key: key, value: JSON.parse(value)}; return q('OK'); },
    volatileSet: (key, value, ttl) => { forwardedObject = {op: 'volatileSet', key: key, value: JSON.parse(value), ttl: ttl }; return q('OK'); },
    expire: (key, ttl) => { forwardedObject = {op: 'expire', key: key, ttl: ttl}; return q('OK'); },
    persist: key => { forwardedObject = {op: 'persist', key: key}; return q('OK'); }
  };
  mockReadEngine = {
    get: function (requestObject, forward) {
      var err;
      if (forward !== false) {
        forwardedObject = requestObject;
      }
      if (requestObject.data._id === 'persisted') {
        return q(new ResponseObject(requestObject, persistedObject));
      }
      if (requestObject.data._id === 'uncached') {
        return q(new ResponseObject(requestObject, uncachedObject));
      }
      if (requestObject.data._id === 'cached') {
        return q(new ResponseObject(requestObject, uncachedObject));
      }
      if (requestObject.data._id === 'error') {
        return q.reject(new InternalError('Error'));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return q(err);
    },
    mget: function (requestObject) {
      var
        promises = [];

      forwardedObject = requestObject;

      requestObject.data.body.ids.forEach(function (id) {
        var req = new RequestObject({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: repository.collection,
          index: repository.index,
          body: {
            _id: id
          }
        });

        promises.push(mockReadEngine.get(req, false));
      });

      return q.all(promises)
        .then(function (results) {
          var result = new ResponseObject(requestObject, {hits: results.map(function (response) {
            if (response instanceof ResponseObject) {
              return {
                found: (response.data.found === undefined) ? true : response.data.found,
                _source: response.data.body,
                _id: response.data.body._id
              };
            }

            return {
              found: (response.found === undefined) ? true : response.found,
              _source: response.name,
              _id: response._id
            };
          })});

          return q(result);
        });
    },
    search: function (requestObject) {
      return q(new ResponseObject(requestObject, {hits: [{_id: 'role', _source: {indexes: {}}}], total: 1}));
    }
  };
  mockWriteLayer = {
    execute: function (o) {
      forwardedObject = o;
    },
    delete: requestObject => {
      return q(new ResponseObject(requestObject));
    }
  };

  before(function () {
    var mockKuzzle = {
      config: require.main.require('lib/config')(require('rc')('kuzzle'))
    };

    repository = new Repository(mockKuzzle, {
      index: '%test',
      collection: 'repository',
      ObjectConstructor: ObjectConstructor,
      readEngine: mockReadEngine,
      writeLayer: mockWriteLayer,
      cacheEngine: mockCacheEngine
    });
  });

  beforeEach(function () {
    forwardedObject = null;
    repository.ObjectConstructor = ObjectConstructor;
    repository.readEngine = mockReadEngine;
    repository.writeLayer = mockWriteLayer;
    repository.cacheEngine = mockCacheEngine;
  });

  describe('#loadOneFromDatabase', function () {
    it('should return null for an non existing id', function (done) {
      repository.loadOneFromDatabase(-9999)
        .then(function (result) {
          should(result).be.null();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadOneFromDatabase('error')).be.rejectedWith(InternalError);
    });

    it('should create a valid requestObject request for the readEngine', function (done) {
      repository.loadOneFromDatabase(-9999)
        .then(function (result) {
          should(forwardedObject).be.instanceOf(RequestObject);
          should(forwardedObject.controller).be.exactly('read');
          should(forwardedObject.action).be.exactly('get');
          should(forwardedObject.data._id).be.exactly(-9999);
          should(forwardedObject.collection).be.exactly(repository.collection);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a valid ObjectConstructor instance if found', function (done) {
      repository.loadOneFromDatabase('persisted')
        .then(function (result) {
          should(result).be.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

  });

  describe('#loadMultiFromDatabase', function () {
    it('should return an empty array for an non existing id', function (done) {
      repository.loadMultiFromDatabase([-999, -998, -997])
        .then(function (results) {
          should(results).be.an.Array().and.have.length(0);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadMultiFromDatabase(['error'])).be.rejectedWith(InternalError);
    });

    it('should create a valid requestObject request for the readEngine', function (done) {
      repository.loadMultiFromDatabase([-999, 'persisted', -998])
        .then(function (results) {
          should(forwardedObject).be.instanceOf(RequestObject);
          should(forwardedObject.controller).be.exactly('read');
          should(forwardedObject.action).be.exactly('mget');
          should(forwardedObject.collection).be.exactly(repository.collection);
          should(forwardedObject.data.body.ids).be.eql([-999, 'persisted', -998]);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a list of hydrated object when parameter hydrate is set', function (done) {
      repository.loadMultiFromDatabase(['persisted'], true)
        .then(function (results) {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(function (result) {
            should(result).be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly(-1);
            should(result.name).be.exactly('persisted');
          });

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a list of plain object when parameter hydrate is false', function (done) {
      repository.loadMultiFromDatabase(['persisted'], false)
        .then(function (results) {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(function (result) {
            should(result).not.be.instanceOf(ObjectConstructor);
            should(result._id).be.exactly(-1);
            should(result._source.name).be.exactly('persisted');
          });

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#loadFromCache', function () {
    it('should return null for an non-existing id', function (done) {
      repository.loadFromCache(-999)
        .then(function (result) {
          should(result).be.null();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject the promise in case of error', done => {
      should(repository.loadFromCache('error')).be.rejectedWith(InternalError);
      should(repository.loadFromCache('string')).be.rejectedWith(InternalError);
      done();
    });

    it('should return a valid ObjectConstructor instance if found', function (done) {
      repository.loadFromCache('persisted')
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');
          should(result.type).be.exactly('testObject');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#load', function () {
    it('should return null for an non-existing id', function (done) {
      repository.load(-999)
        .then(function (result) {
          should(result).be.null();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject the promise in case of error', done => {
      should(repository.load('error')).be.rejectedWith(InternalError);
      should(repository.load('string')).be.rejectedWith(InternalError);
      done();
    });

    it('should return a valid ObjectConstructor instance if found', function (done) {
      repository.load('persisted')
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');
          should(result.type).be.exactly('testObject');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a valid ObjectConstructor instance if found only in cache', function (done) {
      repository.load('cached')
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-2);
          should(result.name).be.exactly('cached');
          should(result.type).be.exactly('testObject');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a valid ObjectConstructor instance if found only in readEngine', function (done) {
      repository.load('uncached')
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should get content only from readEngine if cacheEngine is null', function (done) {
      repository.cacheEngine = null;
      repository.load('cached')
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should get content only from cacheEngine if readEngine is null', function (done) {
      repository.readEngine = null;
      repository.load('uncached')
        .then(function (result) {
          should(result).be.null();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#persistToDatabase', () => {
    it('should construct a valid requestObject', () => {
      repository.persistToDatabase(persistedObject);

      should(forwardedObject).be.an.instanceOf(RequestObject);
      should(forwardedObject.data.body).be.eql(persistedObject);
    });
  });

  describe('#deleteFromDatabase', () => {
    it('should construct a valid requestObject', () => {
      repository.deleteFromDatabase('test');

      should(forwardedObject).be.an.instanceOf(RequestObject);
      should(forwardedObject).match({
        data: { _id: 'test' },
        controller: 'write',
        action: 'delete'
      });
    });
  });

  describe('#persistToCache', () => {
    it('should set the object if the ttl is false', () => {
      repository.persistToCache(persistedObject, {ttl: false});

      should(forwardedObject.op).be.exactly('set');
      should(forwardedObject.value).be.eql(persistedObject);
    });

    it('should set the object with a ttl by default', () => {
      repository.persistToCache(persistedObject, {ttl: 500});

      should(forwardedObject.op).be.exactly('volatileSet');
      should(forwardedObject.value).be.eql(persistedObject);
      should(forwardedObject.ttl).be.exactly(500);
    });
  });

  describe('#refreshCacheTTL', () => {
    it('should persist the object if the ttl is set to false', () => {
      repository.refreshCacheTTL(persistedObject, {ttl: false});

      should(forwardedObject.op).be.exactly('persist');
    });

    it('should refresh the ttl if not passed falsed', () => {
      repository.refreshCacheTTL(persistedObject, {ttl: 500});

      should(forwardedObject.op).be.exactly('expire');
      should(forwardedObject.ttl).be.exactly(500);
    });

  });

  describe('#hydrate', function () {
    it('should return a properly hydrated object with a plain old object', function (done) {
      var
        object = new ObjectConstructor(),
        data = {
          value1: {
            test: true
          },
          type: 'myType'
        };

      repository.hydrate(object, data)
        .then(function (result) {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result.type).be.exactly('myType');
          should(result.value1).be.eql({test: true});
          should(result.value1.test).be.true();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should hydrate properly with a ResponseObject', function (done) {
      var
        object = new ObjectConstructor(),
        data = new ResponseObject (null, {
          value1: {
            test: true
          },
          type: 'myType'
        });

      repository.hydrate(object, data)
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result.type).be.exactly('myType');
          should(result.value1).be.eql({test: true});
          should(result.value1.test).be.true();
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should hydrate properly with a ResponseObject containing a _source member', function (done) {
      var
        object = new ObjectConstructor(),
        data = new ResponseObject (null, {
          _id: 'foo',
          _source: {
            value1: {
              test: true
            },
            type: 'myType'
          }
        });

      repository.hydrate(object, data)
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result.type).be.exactly('myType');
          should(result.value1).be.eql({test: true});
          should(result.value1.test).be.true();
          should(result._id).be.eql('foo');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a rejected promise if the provided data is not an object', function () {
      return should(repository.hydrate(new ObjectConstructor(), 'foobar')).be.rejectedWith(InternalError);
    });
  });

  describe('#serializeToCache', () => {
    it('should return the same object', () => {
      should(repository.serializeToCache(persistedObject)).be.exactly(persistedObject);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return the same object', () => {
      should(repository.serializeToDatabase(persistedObject)).be.exactly(persistedObject);
    });
  });

  describe('#search', function () {
    it('should return a list from database', function (done) {
      repository.search({}, 0, 10, false)
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);

          done();
        });
    });
    it('should construct role if hydrate is true', function (done) {
      repository.search({}, 0, 10, true)
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);

          should(response.hits[0].type).be.exactly('testObject');
          done();
        });
    });
  });
});
