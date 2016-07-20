var
  rc = require('rc'),
  params = rc('kuzzle'),
  Promise = require('bluebird'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject;

describe('Test: clean and prepare database remote action', function () {

  it('should call cleanDb and prepareDb', () => {
    var 
      cleanDbCalled = false,
      prepareDbCalled = false,
      request = new RequestObject({controller: 'remoteActions', action: 'cleanAndPrepare', body: {}}),
      kuzzle;

    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.remoteActionsController.actions.cleanDb = function () {
          cleanDbCalled = true;
          return Promise.resolve();
        };
        kuzzle.remoteActionsController.actions.prepareDb = function () {
          prepareDbCalled = true;
          return Promise.resolve();
        };

        return kuzzle.remoteActionsController.actions.cleanAndPrepare(kuzzle, request);
      })
      .then(() => {
        should(cleanDbCalled).be.true();
        should(prepareDbCalled).be.true();
      });
  });
});