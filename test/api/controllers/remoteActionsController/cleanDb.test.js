var
  should = require('should'),
  sinon = require('sinon');


describe('Test: clean database', () => {
  var
    cleanDb,
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      indexCache: {
        remove: sinon.spy()
      },
      internalEngine: {
        index: 'testIndex',
        deleteIndex: sinon.stub().resolves('deleteIndex')
      },
      isServer: true
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

});
