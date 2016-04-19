var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  RemoteActionsController = require.main.require('lib/api/controllers/remoteActionsController');

describe('Test: remote actions controller', function () {
  var
    kuzzle,
    oldProcessExit = process.exit,
    remoteActionsController,
    brokerInvoked,
    requestId,
    responseObject;

  before(() => {
    process.exit = status => true;

    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true})
      .then(() => {
        remoteActionsController = new RemoteActionsController(kuzzle);

        kuzzle.services.list.broker.add = (rid, res) => {
          brokerInvoked = true;
          requestId = rid;
          responseObject = res;
        };
      });
  });

  after(function () {
    process.exit = oldProcessExit;
  });

  beforeEach(() => {
    brokerInvoked = false;
    requestId = null;
    responseObject = null;
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