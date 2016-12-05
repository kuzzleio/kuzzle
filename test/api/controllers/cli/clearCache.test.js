var
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: clear cache', () => {
  var
    clearCache,
    spies,
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      services: {
        list: {
          internalCache: {
            flushdb: callback => callback(null)
          },
          memoryStorage: {
            flushdb: callback => callback(null)
          }
        }
      }
    };

    spies = {
      memoryStorage: sinon.spy(kuzzle.services.list.memoryStorage, 'flushdb'),
      internalCache: sinon.spy(kuzzle.services.list.internalCache, 'flushdb')
    };

    clearCache = require('../../../../lib/api/controllers/cli/clearCache')(kuzzle);
  });

  it('should clean the internalStorage by default if no database name is provided', () => {
    var request = new Request({});

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).be.calledOnce();
        should(spies.memoryStorage).not.be.called();
      });
  });

  it('should clean explicitely the internalCache', () => {
    var request = new Request({database: 'internalCache'});

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).be.calledOnce();
        should(spies.memoryStorage).not.be.called();
      });
  });

  it('should clean explicitely the memoryStorage', () => {
    var request = new Request({database: 'memoryStorage'});

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).not.be.called();
        should(spies.memoryStorage).be.calledOnce();
      });
  });

  it('should return a rejected Promise if an unknown database name is provided', () => {
    var request = new Request({database: 'fake'});

    should(clearCache(request)).be.rejected();
  });

});
