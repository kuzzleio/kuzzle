var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleWorker = require.main.require('lib/api/kuzzleWorker'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Worker = rewire('../../lib/workers/write');

describe('Testing: write worker', () => {
  var
    kuzzle,
    spy,
    requestObject;

  before(() => {
    kuzzle = new KuzzleWorker();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        spy = sandbox.stub(kuzzle.services, 'init').resolves();
        sandbox.stub(kuzzle.services.list.writeEngine, 'create', (request) => Promise.resolve(request));
        sandbox.stub(kuzzle.services.list.writeEngine, 'update').rejects(new Error('rejected'));
        requestObject = new RequestObject({
          controller: 'write',
          action: 'create',
          protocol: 'protocol',
          requestId: 'My name is Ozymandias, king of kings',
          collection: 'Look on my works, ye Mighty, and despair!',
          body: {}
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should contain an init() function', () => {
    var writeWorker = new Worker(kuzzle);
    should(writeWorker.init).not.be.undefined().and.be.a.Function();
  });

  it('should return a promise when initializing', () => {
    var
      writeWorker = new Worker(kuzzle),
      result = writeWorker.init();

    should(result).be.a.Promise();
    return should(result
      .then(() => {
        should(spy.calledWith({whitelist: ['broker', 'writeEngine']})).be.true();
      })
    ).be.fulfilled();
  });

  it('should listen to the write task queue', () => {
    var
      brokerSpy = sandbox.stub(kuzzle.services.list.broker, 'listen'),
      writeWorker;

    writeWorker = new Worker(kuzzle);
    return writeWorker.init()
      .then(() => {
        should(brokerSpy.calledOnce).be.true();
        should(brokerSpy.firstCall.args[0]).be.exactly(kuzzle.config.queues.workerWriteTaskQueue);
      });
  });

  it('should respond with an error if an unknown action has been submitted', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      responded = false;

    sandbox.stub(kuzzle.services.list.broker, 'send', function(queue, response) {
      try {
        should(queue).be.exactly(kuzzle.config.queues.workerWriteResponseQueue);
        should(response.status).be.exactly(400);
        should(response.message).not.be.null();
        should(response.message).be.a.String().and.be.exactly('Write Worker: unknown action <foobar>');
        done();
      }
      catch (error) {
        done(error);
      }
      responded = true;
    });

    requestObject.action = 'foobar';
    callback.call(kuzzle, requestObject);

    should(responded).be.true();
  });

  it('should respond to the response queue and to the notifier queue when a query is successfully completed', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      responseQueue = false;

    this.timeout(50);

    sandbox.stub(kuzzle.services.list.broker, 'send', function (queue, data) {
      try {
        should(data).match(requestObject);
      } catch (error) {
        done(error);
      }

      if (queue === kuzzle.config.queues.workerWriteResponseQueue) {
        responseQueue = true;
      }
    });

    callback.call(kuzzle, requestObject);

    setTimeout(() => {
      try {
        should(responseQueue).be.true();
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });

  it('should respond to the client when an error occurs', function (done) {
    var
      onListenCB = Worker.__get__('onListenCB'),
      responseQueue = false;

    this.timeout(50);

    sandbox.stub(kuzzle.services.list.broker, 'send', function (queue, data) {
      try {
        should(data).be.an.Object();
        should(data.status).be.exactly(400);
        should(data.message).be.eql('rejected');
        should(data.stack).be.a.String();
        should(data.requestId).be.eql(requestObject.requestId);
      } catch (error) {
        done(error);
      }

      if (queue === kuzzle.config.queues.workerWriteResponseQueue) {
        responseQueue = true;
      }
      else {
        done(new Error('Message sent to an unknown queue: ' + queue));
      }
    });

    requestObject.action = 'update';
    onListenCB.call(kuzzle, requestObject);

    setTimeout(() => {
      try {
        should(responseQueue).be.true();
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });
});
