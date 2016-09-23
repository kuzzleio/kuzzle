var
  should = require('should'),
  sinon = require('sinon');


describe('Test: clear cache', () => {
  var
    clearCache,
    spies,
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      config: {
        services: {
          cache: {
            aliases: ['memoryStorage', 'foo', 'bar']
          }
        }
      },
      services: {
        list: {
          memoryStorage: {
            flushdb: callback => {
              callback(null);
            }
          },
          foo: {
            flushdb: callback => {
              callback(null);
            }
          },
          bar: {
            flushdb: callback => {
              callback(null);
            }
          },
        }
      }
    };

    spies = {
      memoryStorage: sinon.spy(kuzzle.services.list.memoryStorage, 'flushdb'),
      foo: sinon.spy(kuzzle.services.list.foo, 'flushdb'),
      bar: sinon.spy(kuzzle.services.list.bar, 'flushdb')
    };

    clearCache = require('../../../../lib/api/controllers/remoteActions/clearCache')(kuzzle);
  });


  it('should clean explicitely any volatile database', () => {
    var request = {data: {body: {database: 'foo'}}};

    return clearCache(request)
      .then(() => {
        should(spies.foo).be.calledOnce();
        should(spies.bar).not.be.called();
        should(spies.memoryStorage).not.be.called();
      });
  });

  it('should clean explicitely the memoryStorage', () => {
    var request = {data: {body: {database: 'memoryStorage'}}};

    return clearCache(request)
      .then(() => {
        should(spies.foo).not.be.called();
        should(spies.bar).not.be.called();
        should(spies.memoryStorage).be.calledOnce();
      });
  });

  it('should return a rejected Promise if an unknown database name is provided', () => {
    var request = {data: {body: {database: 'fake'}}};

    should(clearCache(request)).be.rejected();
  });

  it('should clean all volatile redis dbs if no database name is provided', () => {
    var request = {data: {body: {}}};

    return clearCache(request)
      .then(() => {
        should(spies.foo).be.calledOnce();
        should(spies.bar).be.calledOnce();
        should(spies.memoryStorage).not.be.called();
      });
  });

});
