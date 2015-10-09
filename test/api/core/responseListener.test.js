/**
 * This component listens to responses from workers and forward them to the client at the origin of the request
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  ResponseObject = require('root-require')('lib/api/core/models/responseObject'),
  ResponseListener = rewire('../../../lib/api/core/responseListener');

require('should-promised');

describe('Test: responseListener', function () {
  var
    kuzzle,
    registered,
    listenCallback,
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

  it('should not wait for a response when the persist flag is false', function () {
    var responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);

    requestObject.persist = false;

    kuzzle.router.controllers.forEach(function (controller) {
      requestObject.controller = controller;
      requestObject.requestId = uuid.v1();
      responseListener.add(requestObject, {});
    });

    should(Object.keys(responseListener.waitingQueries).length).be.exactly(0);
  });

  it('should wait for a response only for requests involving a worker', function () {
    var responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);

    requestObject.persist = true;

    kuzzle.router.controllers.forEach(function (controller) {
      requestObject.controller = controller;
      requestObject.requestId = uuid.v1();
      responseListener.add(requestObject, {});
    });

    should(Object.keys(responseListener.waitingQueries).length).be.exactly(['admin', 'bulk', 'write'].length);
  });

  it('should register only once, when the component is been instantiated', function () {
    var responseListener;

    registered = 0;
    requestObject.persist = true;

    responseListener = new ResponseListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);
    kuzzle.router.controllers.forEach(function (controller) {
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
      notified = {};

    requestObject.persist = true;
    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    responseListener.add(requestObject, { id: 'foobar'});

    kuzzle.notifier.notify = function (requestId, response, connection) {
      notified = {
        requestId: requestId,
        id: connection.id
      };
    };

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);

    should(notified.requestId).be.exactly(requestObject.requestId);
    should(notified.id).be.exactly('foobar');
    should(Object.keys(responseListener.waitingQueries).length).be.exactly(0);
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
