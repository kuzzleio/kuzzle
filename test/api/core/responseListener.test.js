/**
 * This component listens to responses from workers and forward them to the client at the origin of the request
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  ResponseListener = rewire('../../../lib/api/core/responseListener');

require('should-promised');

describe('Test: responseListener', function () {
  var
    kuzzle,
    registered,
    listenCallback,
    controllers = ['write', 'subscribe', 'read', 'admin', 'bulk'],
    requestObject = new RequestObject({
      controller: '',
      action: 'update',
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    });

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.broker.listen = function (room, cb) {
          registered++;
          listenCallback = cb;
        };

        done();
      });
  });

  it('should register only once, when the component is been instantiated', function () {
    var responseListener;

    registered = 0;

    responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);
    controllers.forEach(function (controller) {
      requestObject.controller = controller;
      requestObject.requestId = uuid.v1();
      responseListener.add(requestObject, {});
    });

    should(registered).be.exactly(1);
  });

  it('should forward a registered response back to the requester', function () {
    var
      responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue),
      responseObject,
      promise;

    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    promise = responseListener.add(requestObject, { id: 'foobar'});

    responseObject = new ResponseObject(requestObject);


    listenCallback.call(kuzzle, responseObject);

    return should(promise).be.fulfilledWith(responseObject);
  });


  it('should not do anything when receiving an unregistered response', function () {
    var
      responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue),
      responseObject,
      notified = false;

    requestObject.requestId = uuid.v1();

    kuzzle.notifier.notify = function () {
      notified = true;
    };

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);

    should(notified).be.false();
  });
});
