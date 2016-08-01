var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject;

describe('Test: clean and prepare database remote action', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should call cleanDb and prepareDb', () => {
    var
      request = new RequestObject({controller: 'remoteActions', action: 'cleanAndPrepare', body: {}}),
      cleanDbCalled = sandbox.stub(kuzzle.remoteActionsController.actions, 'cleanDb').resolves(),
      prepareDbCalled = sandbox.stub(kuzzle.remoteActionsController.actions, 'prepareDb').resolves();

    return kuzzle.remoteActionsController.actions.cleanAndPrepare(kuzzle, request)
      .then(() => {
        should(cleanDbCalled.calledOnce).be.true();
        should(prepareDbCalled.calledOnce).be.true();
      });
  });
});