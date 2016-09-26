var
  Promise = require('bluebird'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  Repository = require.main.require('lib/api/core/models/repositories/repository');

describe('Test: repositories/repository', () => {
  var
    kuzzle,
    forwardedObject,
    persistedObject,
    repository,
    ObjectConstructor,
    mockCacheEngine,
    mockDatabaseEngine,
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
      if (key === 'repositories/' + repository.index + '/' + repository.collection + '/persisted') {
        return Promise.resolve(JSON.stringify(persistedObject));
      }
      if (key === 'repositories/' + repository.index + '/' + repository.collection + '/cached') {
        return Promise.resolve(JSON.stringify(cachedObject));
      }
      if (key === 'repositories/' + repository.index + '/' + repository.collection + '/error') {
        return Promise.reject(new InternalError('Error'));
      }
      if (key === 'repositories/' + repository.index + '/' + repository.collection + '/string') {
        return Promise.resolve('a string');
      }

      return Promise.resolve(null);
    },
    set: (key, value) => { forwardedObject = {op: 'set', key: key, value: JSON.parse(value)}; return Promise.resolve('OK'); },
    volatileSet: (key, value, ttl) => { forwardedObject = {op: 'volatileSet', key: key, value: JSON.parse(value), ttl: ttl }; return Promise.resolve('OK'); },
    expire: (key, ttl) => { forwardedObject = {op: 'expire', key: key, ttl: ttl}; return Promise.resolve('OK'); },
    persist: key => { forwardedObject = {op: 'persist', key: key}; return Promise.resolve('OK'); }
  };

  mockDatabaseEngine = {
    get: (type, id) => {
      if (id === 'persisted') {
        return Promise.resolve(persistedObject);
      }

      if (id === 'uncached') {
        return Promise.resolve(uncachedObject);
      }

      if (id === 'cached') {
        return Promise.resolve(uncachedObject);
      }

      if (id === 'source') {
        return Promise.resolve({_id:'theId', _source: {foo: 'bar'}});
      }

      if (id === 'error') {
        return Promise.reject(new InternalError('Error'));
      }

      return Promise.resolve({found: false});
    },
    mget: (type, ids) => {
      var
        promises = [];

      ids.forEach(id => {
        promises.push(mockDatabaseEngine.get(repository.collection, id));
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
    search: (type, filter) => {
      if (filter.empty) {
        return Promise.resolve({});
      }
      if (filter.error) {
        return Promise.reject({});
      }
      return Promise.resolve({hits: [{_id: 'role', _source: {controllers: {}}}], total: 1});
    },
    createOrReplace: (type, id, content) => {
      forwardedObject = {type, id, content};
      return Promise.resolve(content);
    },
    delete: (type, id) => {
      forwardedObject = {type, id};
      return Promise.resolve(id);
    }
  };

  before(() => {
    kuzzle = new Kuzzle();

    repository = new Repository(kuzzle);
    repository.index = '%test';
    repository.collection = 'repository';
    repository.init({});
  });

  beforeEach(() => {
    forwardedObject = null;
    repository.ObjectConstructor = ObjectConstructor;
    repository.databaseEngine = mockDatabaseEngine;
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

    it('should return a valid ObjectConstructor instance if found only in databaseEngine', () => {
      return repository.load('uncached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should get content only from databaseEngine if cacheEngine is null', () => {
      repository.cacheEngine = null;

      return repository.load('cached')
        .then(result => {
          should(result).be.an.instanceOf(ObjectConstructor);
          should(result._id).be.exactly(-3);
          should(result.name).be.exactly('uncached');
          should(result.type).be.exactly('testObject');
        });
    });

    it('should get content only from cacheEngine if databaseEngine is null', () => {
      repository.databaseEngine = null;

      return repository.load('uncached')
        .then(result => should(result).be.null());
    });
  });

  describe('#persistToDatabase', () => {
    it('should call the createOrReplace method of internal Engine', () => {
      return repository.persistToDatabase(persistedObject)
        .then(() => {
          should(forwardedObject.content).be.eql(persistedObject);
          should(forwardedObject.type).be.eql(repository.collection);
          should(forwardedObject.id).be.eql(persistedObject._id);
        });
    });
  });

  describe('#deleteFromDatabase', () => {
    it('should construct a valid requestObject', () => {
      return repository.deleteFromDatabase('test')
        .then(() => {
          should(forwardedObject).match({
            id: 'test',
            type: repository.collection
          });
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
