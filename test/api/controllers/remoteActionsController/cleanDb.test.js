var
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  sandbox = sinon.sandbox.create();


describe('Test: clean database', function () {
  var
    cleanDb,
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      indexCache: {
        remove: sandbox.spy()
      },
      internalEngine: {
        index: 'testIndex',
        deleteIndex: sandbox.stub().resolves('deleteIndex')
      },
      isServer: true
    };

    cleanDb = require('../../../../lib/api/controllers/remoteActions/cleanDb')(kuzzle);
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should reject the promise if kuzzle is not a server instance', () => {
    kuzzle.isServer = false;

    return should(cleanDb()).be.rejectedWith(BadRequestError);
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

});
