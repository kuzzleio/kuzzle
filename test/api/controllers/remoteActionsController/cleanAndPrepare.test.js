var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test: clean and prepare database remote action', function () {

  it('should call cleanDb and prepareDb', function (done) {
    var 
      request,
      cleanDbCalled = false,
      prepareDbCalled = false,
      request = new RequestObject({controller: 'remoteActions', action: 'cleanAndPrepare', body: {}}),
      kuzzle;

    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true});

    kuzzle.remoteActionsController.actions.cleanDb = function () { cleanDbCalled = true; return q(); }
    kuzzle.remoteActionsController.actions.prepareDb = function () { prepareDbCalled = true; return q(); }

    kuzzle.remoteActionsController.actions.cleanAndPrepare(kuzzle, request)
      .then(function () {
        should(cleanDbCalled).be.true();
        should(prepareDbCalled).be.true();
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});