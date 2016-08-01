/**
 * This component listens to responses from workers and forward them to the client at the origin of the request
 */
var
  should = require('should'),
  uuid = require('node-uuid'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  WorkerListener = require.main.require('lib/api/core/workerListener');

describe('Test: workerListener', () => {
  var
    kuzzle,
    listenCallback,
    spy,
    controllers = ['write', 'subscribe', 'read', 'admin', 'bulk'],
    requestObject = new RequestObject({
      controller: '',
      action: 'update',
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    });

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        spy = sandbox.stub(kuzzle.services.list.broker, 'listen', (room, cb) => {
          listenCallback = cb;
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register only once, when the component is been instantiated', () => {
    var workerListener = new WorkerListener(kuzzle);

    workerListener.startListener(kuzzle.config.queues.workerWriteResponseQueue);
    controllers.forEach(controller => {
      requestObject.controller = controller;
      requestObject.requestId = uuid.v1();
      workerListener.add(requestObject, {});
    });

    should(spy.calledOnce).be.true();
  });

  it('should resolved the stored promise when receiving a success response', () => {
    var
      workerListener = new WorkerListener(kuzzle),
      responseObject,
      promise;

    workerListener.startListener(kuzzle.config.queues.workerWriteResponseQueue);

    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    promise = workerListener.add(requestObject, { id: 'foobar'});

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);

    return should(promise).be.fulfilledWith(responseObject);
  });

  it('should reject the stored promise when receiving an errored response', () => {
    var
      workerListener = new WorkerListener(kuzzle, kuzzle.config.queues.workerWriteResponseQueue),
      responseObject,
      promise;

    workerListener.startListener(kuzzle.config.queues.workerWriteResponseQueue);

    requestObject.controller = 'write';
    requestObject.requestId = uuid.v1();
    promise = workerListener.add(requestObject, { id: 'foobar'});

    responseObject = new ResponseObject(requestObject, new Error('foobar'));
    listenCallback.call(kuzzle, responseObject);

    return should(promise).be.rejectedWith(responseObject);
  });

  it('should only trigger a log response when receiving an unknown response', done => {
    var
      workerListener = new WorkerListener(kuzzle),
      responseObject;

    workerListener.startListener(kuzzle.config.queues.workerWriteResponseQueue);

    kuzzle.once('log:verbose', () => done());

    requestObject.requestId = uuid.v1();

    responseObject = new ResponseObject(requestObject);

    listenCallback.call(kuzzle, responseObject);
  });
});
