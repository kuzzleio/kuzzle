var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  RemoteActionsController = require.main.require('lib/api/controllers/remoteActionsController');

describe('Test: remote actions controller', () => {
  var
    kuzzle,
    oldProcessExit = process.exit,
    remoteActionsController,
    brokerInvoked,
    requestId,
    responseObject;

  before(() => {
    process.exit = () => true;

    kuzzle = new KuzzleServer();
    remoteActionsController = new RemoteActionsController(kuzzle);
  });

  after(() => {
    process.exit = oldProcessExit;
  });

  beforeEach(() => {
    brokerInvoked = false;
    requestId = null;
    responseObject = null;
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        sandbox.stub(kuzzle.services.list.broker, 'send', (rid, res) => {
          brokerInvoked = true;
          requestId = rid;
          responseObject = res;
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should fail if there is no action given', () => {
    var request = new RequestObject({controller: 'remoteActions', action: null, body: {}});

    remoteActionsController.onListenCB(request);
    should(brokerInvoked).be.true();
    should(requestId).be.eql(request.requestId);
    should(responseObject).be.instanceOf(ResponseObject);
    should(responseObject.status).be.eql(400);
    should(responseObject.error.message).be.eql('No action given.');
  });

  it('should fail if the given action does not exist', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'foo', body: {}});

    remoteActionsController.onListenCB(request);

    should(brokerInvoked).be.true();
    should(requestId).be.eql(request.requestId);
    should(responseObject).be.instanceOf(ResponseObject);
    should(responseObject.status).be.eql(404);
    should(responseObject.error.message).be.eql('The action "foo" do not exist.');
  });

  it('should fail if the given action triggers some error', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enable', body: {service: 'broker', enable: true}});

    remoteActionsController.onListenCB(request);

    should(brokerInvoked).be.true();
    should(requestId).be.eql(request.requestId);
    should(responseObject).be.instanceOf(ResponseObject);
    should(responseObject.status).be.eql(404);
    should(responseObject.error.message).be.eql('The action "enable" do not exist.');
  });
});
