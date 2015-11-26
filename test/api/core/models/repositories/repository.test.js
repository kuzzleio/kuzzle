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
    mockWriteEngine;

  ObjectConstructor = function () {
    this.type = 'testObject';
  };
  persistedObject = new ObjectConstructor();
  persistedObject._id = -1;
  persistedObject.name = 'persisted';

  mockCacheEngine = {
    get: function (key) {
      if (key === repository.collection + '/persisted') {
        return Promise.resolve(persistedObject);
      }
      if (key === repository.collection + '/error') {
        return Promise.reject(new InternalError('Error'));
      }
      if (key === repository.collection + '/string') {
        return Promise.resolve('a string');
      }

      return Promise.resolve(null);
    },
    set: (key, value) => { forwardedObject = {op: 'set', key: key, value: value}; },
    volatileSet: (key, value, ttl) => { forwardedObject = {op: 'volatileSet', key: key, value: value, ttl: ttl }; },
    expire: (key, ttl) => { forwardedObject = {op: 'expire', key: key, ttl: ttl}; },
    persist: key => { forwardedObject = {op: 'persist', key: key}; }
  };
  mockReadEngine = {
    get: function (requestObject, forward) {
      var err;
      if (forward !== false) {
        forwardedObject = requestObject;
      }
      if (requestObject.data._id === 'persisted') {
        return Promise.resolve(new ResponseObject(requestObject, persistedObject));
      }
      if (requestObject.data._id === 'error') {
        return Promise.reject(new InternalError('Error'));
      }

      err = new NotFoundError('Not found');
      err.found = false;
      err._id = requestObject.data._id;
      return Promise.resolve(err);
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
          body: {
            _id: id
          }
        });

        promises.push(mockReadEngine.get(req, false));
      });

      return q.all(promises)
        .then(function (results) {
          var result = new ResponseObject(requestObject, {docs: results.map(function (response) {
            if (response instanceof ResponseObject) {
              return response.data;
            }
            return response;
          })});

          return Promise.resolve(result);
        });
    }
  };
  mockWriteEngine = {
    createOrUpdate: function (o) {
      forwardedObject = o;
    }
  };

  before(function () {
    var mockKuzzle = {
      config: require.main.require('lib/config')(require('rc')('kuzzle'))
    };

    repository = new Repository(mockKuzzle, {
      collection: '_test/repository',
      ObjectConstructor: ObjectConstructor,
      readEngine: mockReadEngine,
      writeEngine: mockWriteEngine,
      cacheEngine: mockCacheEngine
    });
  });

  beforeEach(function () {
    forwardedObject = null;
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

    it('should return a valid ObjectConstructor instance if found', function (done) {
      repository.loadMultiFromDatabase(['persisted'])
        .then(function (results) {
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

  describe('#persistToDatabase', () => {
    it('should construct a valid requestObject', () => {
      repository.persistToDatabase(persistedObject);

      should(forwardedObject).be.an.instanceOf(RequestObject);
      should(forwardedObject.data.body).be.eql(persistedObject);
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
    it('should return a properly hydrated object', function (done) {
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
});
