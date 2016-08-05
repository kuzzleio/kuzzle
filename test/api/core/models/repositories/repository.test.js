var
  Promise = require('bluebird'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  Repository = require.main.require('lib/api/core/models/repositories/repository'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject;

describe('Test: repositories/repository', () => {
  var
    kuzzle,
    forwardedObject,
    persistedObject,
    repository,
    ObjectConstructor,
    mockCacheEngine,
    mockReadEngine,
    mockWriteLayer,
    cachedObject,
    uncachedObject;

  /**
   * @constructor
   */
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
    get: key => {
      if (key === repository.index + '/' + repository.collection + '/persisted') {
        return Promise.resolve(JSON.stringify(persistedObject));
      }
      if (key === repository.index + '/' + repository.collection + '/cached') {
        return Promise.resolve(JSON.stringify(cachedObject));
      }
      if (key === repository.index + '/' + repository.collection + '/error') {
        return Promise.reject(new InternalError('Error'));
      }
      if (key === repository.index + '/' + repository.collection + '/string') {
        return Promise.resolve('a string');
      }

      return Promise.resolve(null);
    },
    set: (key, value) => { forwardedObject = {op: 'set', key: key, value: JSON.parse(value)}; return Promise.resolve('OK'); },
    volatileSet: (key, value, ttl) => { forwardedObject = {op: 'volatileSet', key: key, value: JSON.parse(value), ttl: ttl }; return Promise.resolve('OK'); },
    expire: (key, ttl) => { forwardedObject = {op: 'expire', key: key, ttl: ttl}; return Promise.resolve('OK'); },
    persist: key => { forwardedObject = {op: 'persist', key: key}; return Promise.resolve('OK'); }
  };

  mockReadEngine = {
    get: (requestObject, forward) => {
      if (forward !== false) {
        forwardedObject = requestObject;
      }

      if (requestObject.data._id === 'persisted') {
        return Promise.resolve(persistedObject);
      }

      if (requestObject.data._id === 'uncached') {
        return Promise.resolve(uncachedObject);
      }

      if (requestObject.data._id === 'cached') {
        return Promise.resolve(uncachedObject);
      }

      if (requestObject.data._id === 'source') {
        return Promise.resolve({_id:'theId', _source: {foo: 'bar'}});
      }

      if (requestObject.data._id === 'error') {
        return Promise.reject(new InternalError('Error'));
      }

      return Promise.resolve({found: false});
    },
    mget: requestObject => {
      var
        promises = [];

      forwardedObject = requestObject;

      requestObject.data.body.ids.forEach(id => {
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

      return Promise.all(promises)
        .then(results => {
          var
            result = results
              .map(r => {
                return {
                  found: (r.found === undefined) ? true : r.found,
                  _source: {name: r.name},
                  _id: r._id
                };
              });

          return {hits: result};
        });
    },
    search: (requestObject) => {
      if (requestObject.data.body.filter.empty) {
        return Promise.resolve({});
      }
      if (requestObject.data.body.filter.error) {
        return Promise.reject({});
      }
      return Promise.resolve({hits: [{_id: 'role', _source: {controllers: {}}}], total: 1});
    }
  };

  mockWriteLayer = {
    execute: o => {
      forwardedObject = o;
    },
    delete: requestObject => Promise.resolve(requestObject)
  };

  before(() => {
    kuzzle = new Kuzzle();

    repository = new Repository(kuzzle);
    repository.index = '%test';
    repository.collection = 'repository';
    repository.ObjectConstructor = ObjectConstructor;
    repository.readEngine = mockReadEngine;
    repository.writeLayer = mockWriteLayer;
    repository.cacheEngine = mockCacheEngine;
  });

  beforeEach(() => {
    forwardedObject = null;
    repository.ObjectConstructor = ObjectConstructor;
    repository.readEngine = mockReadEngine;
    repository.writeLayer = mockWriteLayer;
    repository.cacheEngine = mockCacheEngine;
  });

  describe('#loadOneFromDatabase', () => {
    it('should return null for an non existing id', () => {
      return repository.loadOneFromDatabase(-9999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadOneFromDatabase('error')).be.rejectedWith(InternalError);
    });

    it('should create a valid requestObject request for the readEngine', () => {
      return repository.loadOneFromDatabase(-9999)
        .then(() => {
          should(forwardedObject).be.instanceOf(RequestObject);
          should(forwardedObject.controller).be.exactly('read');
          should(forwardedObject.action).be.exactly('get');
          should(forwardedObject.data._id).be.exactly(-9999);
          should(forwardedObject.collection).be.exactly(repository.collection);
        });
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      return repository.loadOneFromDatabase('persisted')
        .then(result => {
          should(result).be.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');
        });
    });

    it('should handle correctly the responses containing _id and _source', () => {
      return repository.loadOneFromDatabase('source')
        .then(result => {
          should(result._id).be.exactly('theId');
          should(result.foo).be.exactly('bar');
        });
    });
  });

  describe('#loadMultiFromDatabase', () => {
    it('should return an empty array for an non existing id', () => {
      return repository.loadMultiFromDatabase([-999, -998, -997])
        .then(results => should(results).be.an.Array().and.have.length(0));
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadMultiFromDatabase('error')).be.rejectedWith(InternalError);
    });

    it('should create a valid requestObject request for the readEngine', () => {
      return repository.loadMultiFromDatabase([-999, 'persisted', -998])
        .then(() => {
          should(forwardedObject).be.instanceOf(RequestObject);
          should(forwardedObject.controller).be.exactly('read');
          should(forwardedObject.action).be.exactly('mget');
          should(forwardedObject.collection).be.exactly(repository.collection);
          should(forwardedObject.data.body.ids).be.eql([-999, 'persisted', -998]);
        });
    });

    it('should return a list of plain object', () => {
      return repository.loadMultiFromDatabase(['persisted'])
        .then(results => {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(Object);
            should(result._id).be.exactly(-1);
            should(result.name).be.exactly('persisted');
          });
        });
    });

    it('should handle list of objects as an argument', () => {
      return repository.loadMultiFromDatabase([{_id:'persisted'}])
        .then(results => {
          should(results).be.an.Array();
          should(results).not.be.empty();

          results.forEach(result => {
            should(result).be.instanceOf(Object);
            should(result._id).be.exactly(-1);
            should(result.name).be.exactly('persisted');
          });
        });
    });

    it('should respond with an empty array if no result found', () => {
      return repository.loadMultiFromDatabase([{_id:'null'}])
        .then(results => {
          should(results).be.an.Array();
          should(results).be.empty();
        });
    });
  });

  describe('#loadFromCache', () => {
    it('should return null for an non-existing id', () => {
      return repository.loadFromCache(-999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      return should(repository.loadFromCache('error')).be.rejectedWith(InternalError);
    });

    it('should reject the promise when loading an incorrect object', () => {
      return should(repository.loadFromCache('string')).be.rejectedWith(InternalError);
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      return repository.loadFromCache('persisted')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');
          should(result.type).be.exactly('testObject');
        });
    });
  });

  describe('#load', () => {
    it('should return null for an non-existing id', () => {
      return repository.load(-999)
        .then(result => should(result).be.null());
    });

    it('should reject the promise in case of error', () => {
      return should(repository.load('error')).be.rejectedWith(InternalError);
    });

    it('should reject the promise when loading an incorrect object', () => {
      return should(repository.load('string')).be.rejectedWith(InternalError);
    });

    it('should return a valid ObjectConstructor instance if found', () => {
      return repository.load('persisted')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-1);
          should(result.name).be.exactly('persisted');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in cache', () => {
      return repository.load('cached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-2);
          should(result.name).be.exactly('cached');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should return a valid ObjectConstructor instance if found only in readEngine', () => {
      return repository.load('uncached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should get content only from readEngine if cacheEngine is null', () => {
      repository.cacheEngine = null;

      return repository.load('cached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should get content only from cacheEngine if readEngine is null', () => {
      repository.readEngine = null;

      return repository.load('uncached')
        .then(result => should(result).be.null());
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
      should(forwardedObject.value).match(persistedObject);
    });

    it('should set the object with a ttl by default', () => {
      repository.persistToCache(persistedObject, {ttl: 500});

      should(forwardedObject.op).be.exactly('volatileSet');
      should(forwardedObject.value).match(persistedObject);
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

  describe('#serializeToCache', () => {
    it('should return the same object', () => {
      var serialized = repository.serializeToCache(persistedObject);

      should(Object.keys(serialized).length).be.exactly(Object.keys(persistedObject).length);
      Object.keys(repository.serializeToCache(persistedObject)).forEach(key => {
        should(persistedObject[key]).be.exactly(serialized[key]);
      });
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return the same object', () => {
      should(repository.serializeToDatabase(persistedObject)).be.exactly(persistedObject);
    });
  });

  describe('#search', () => {
    it('should return a list from database', () => {
      return repository.search({filter:'nofilter'}, 0, 10, false)
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.total).be.exactly(1);
        });
    });

    it('should return an list if no hits', () => {
      return repository.search({empty:true}, 0, 10, false)
        .then(response => {
          should(response).be.an.Object();
          should(response.hits).be.an.Array();
          should(response.hits).be.empty();
          should(response.total).be.exactly(0);
        });
    });

    it('should be rejected with an error if something goes wrong', () => {
      return should(repository.search({error:true}, 0, 10, false)).be.rejected();
    });
  });
});
