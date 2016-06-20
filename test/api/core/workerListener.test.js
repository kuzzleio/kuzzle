/**
 * This component listens to responses from workers and forward them to the client at the origin of the request
 */
var
  should = require('should'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  WorkerListener = rewire('../../../lib/api/core/workerListener');

describe('Test: workerListener', function () {
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
    var workerListener;

    registered = 0;

    workerListener = new WorkerListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);
    controllers.forEach(function (controller) {
      requestObject.controller = controller;
      requestObject.requestId = uuid.v1();
      workerListener.add(requestObject, {});
    });

    should(registered).be.exactly(1);
  });

  it('should resolved the stored promise when receiving a success response', function () {
    var
      workerListener = new WorkerListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue),
      responseObject,
      promise;

    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    promise = workerListener.add(requestObject, { id: 'foobar'});

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);

    return should(promise).be.fulfilledWith(responseObject);
  });

  it('should reject the stored promise when receiving an errored response', function () {
    var
      workerListener = new WorkerListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue),
      responseObject,
      promise;

    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    promise = workerListener.add(requestObject, { id: 'foobar'});

    responseObject = new ResponseObject(requestObject, new Error('foobar'));
    listenCallback.call(kuzzle, responseObject);

    return should(promise).be.rejectedWith(responseObject);
  });

  it('should only trigger a log response when receiving an unknown response', function (done) {
    var
      responseObject;

    new WorkerListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue);

    this.timeout(50);

    kuzzle.once('log:verbose', () => done());

    requestObject.requestId = uuid.v1();

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);
  });
});
