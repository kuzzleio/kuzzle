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

    clearCache = require('../../../../lib/api/controllers/remoteActions/clearCache')(kuzzle);
  });

  it('should clean the internalStorage by default if no database name is provided', () => {
    var request = {data: {body: {}}};

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).be.calledOnce();
        should(spies.memoryStorage).not.be.called();
      });
  });

  it('should clean explicitely the internalCache', () => {
    var request = {data: {body: {database: 'internalCache'}}};

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).be.calledOnce();
        should(spies.memoryStorage).not.be.called();
      });
  });

  it('should clean explicitely the memoryStorage', () => {
    var request = {data: {body: {database: 'memoryStorage'}}};

    return clearCache(request)
      .then(() => {
        should(spies.internalCache).not.be.called();
        should(spies.memoryStorage).be.calledOnce();
      });
  });

  it('should return a rejected Promise if an unknown database name is provided', () => {
    var request = {data: {body: {database: 'fake'}}};

    should(clearCache(request)).be.rejected();
  });

});
