var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError');

var
  kuzzle,
  oldProcessExit = process.exit;

before(function (done) {

  process.exit = (status) => {
    return true;
  };

  kuzzle = new Kuzzle();

  kuzzle.start(params, {dummy: true})
    .then(function () {
      done();
    });
});

after(function () {
  process.exit = oldProcessExit;
});

describe('Test: remote actions controller', function () {

  it('should fail if there is no action given', function (done) {
    var request = new RequestObject({controller: 'remoteActions', action: null, body: {}});

    kuzzle.services.list.broker.listenOnce(request.requestId, (response) => {
      should(response.error).not.be.null();
      should(response.error.message).not.be.null();
      should(response.error.message).be.a.String().and.be.exactly('No action given.');
      done();
    });
    kuzzle.services.list.broker.broadcast(kuzzle.config.queues.remoteActionsQueue, request);

  });

  it('should fail if the given action does not exist', function (done) {
    var request = new RequestObject({controller: 'remoteActions', action: 'foo', body: {}});

    kuzzle.services.list.broker.listenOnce(request.requestId, (response) => {
      should(response.error).not.be.null();
      should(response.error.message).not.be.null();
      should(response.error.message).be.a.String().and.be.exactly('The action "foo" do not exist.');
      done();
    });
    kuzzle.services.list.broker.broadcast(kuzzle.config.queues.remoteActionsQueue, request);

  });

  it('should fail if the given action triggers some error', function (done) {
    var request = new RequestObject({controller: 'remoteActions', action: 'enable', body: {service: 'broker', enable: true}});

    kuzzle.services.list.broker.listenOnce(request.requestId, (response) => {
      should(response.error).not.be.null();
      should(response.error.message).not.be.null();
      should(response.error.message).be.a.String().and.be.exactly('The action "enable" do not exist.');
      done();
    });
    kuzzle.services.list.broker.broadcast(kuzzle.config.queues.remoteActionsQueue, request);

  });
});