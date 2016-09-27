var
  should = require('should'),
  sinon = require('sinon');


describe('Test: clean database', () => {
  var
    cleanDb,
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
      indexCache: {
        remove: sinon.spy()
      },
      internalEngine: {
        index: 'testIndex',
        deleteIndex: sinon.stub().resolves('deleteIndex')
      },
      services: {
        list: {
          memoryStorage: {
            flushdb: callback => callback(null)
          },
          foo: {
            flushdb: callback => callback(null)
          },
          bar: {
            flushdb: callback => callback(null)
          }
        }
      }
    };

    cleanDb = require('../../../../lib/api/controllers/remoteActions/cleanDb')(kuzzle);
  });


  it('should clean the database', () => {
    return cleanDb()
      .then(response => {
        should(response).be.exactly('deleteIndex');
        should(kuzzle.internalEngine.deleteIndex).be.calledOnce();
        should(kuzzle.internalEngine.deleteIndex).be.calledWithExactly('testIndex');
        should(kuzzle.indexCache.remove).be.calledOnce();
        should(kuzzle.indexCache.remove).be.calledWith('testIndex');
      });
  });

  it('should clean the memoryStorage and the internal caches', () => {
    var spies = {
      memoryStorage: sinon.spy(kuzzle.services.list.memoryStorage, 'flushdb'),
      foo: sinon.spy(kuzzle.services.list.foo, 'flushdb'),
      bar: sinon.spy(kuzzle.services.list.bar, 'flushdb')
    };

    return cleanDb()
      .then(() => {
        should(spies.memoryStorage).be.calledOnce();
        should(spies.foo).be.calledOnce();
        should(spies.bar).be.calledOnce();
      });
  });

});
