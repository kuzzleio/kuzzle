var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Worker = rewire('../../lib/workers/write');

require('should-promised');

describe('Testing: write worker', function () {
  var
    kuzzle,
    requestObject;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.init = function () {};

        // we test successful write commands using a mockup 'create' action...
        kuzzle.services.list.writeEngine.create = function (request) { return Promise.resolve(request); };

        // ...and failed write command with a mockup 'update' action
        kuzzle.services.list.writeEngine.update = function () { return Promise.reject(new Error('rejected')); };

        done();
      });
  });

  beforeEach(function () {
    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      protocol: 'protocol',
      requestId: 'My name is Ozymandias, king of kings',
      collection: 'Look on my works, ye Mighty, and despair!',
      body: {}
    });
  });

  it('should contain an init() function', function () {
    var writeWorker = new Worker(kuzzle);
    should(writeWorker.init).not.be.undefined().and.be.a.Function();
  });

  it('should return a promise when initializing', function () {
    var
      writeWorker = new Worker(kuzzle),
      result = writeWorker.init();

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should listen to the write task queue', function (done) {
    var
      brokerListenCalled = false,
      saveListen = kuzzle.services.list.broker.listen,
      writeWorker;

    this.timeout(50);

    kuzzle.services.list.broker.listen = function (taskQueue) {
      brokerListenCalled = true;

      try {
        should(taskQueue).be.exactly(kuzzle.config.queues.workerWriteTaskQueue);
      }
      catch (error) {
        done(error);
      }
    };

    writeWorker = new Worker(kuzzle);
    writeWorker.init()
      .then(function () {
        kuzzle.services.list.broker.listen = saveListen;
        should(brokerListenCalled).be.true();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should respond with an error if an unknown action has been submitted', function () {
    var
      callback = Worker.__get__('onListenCB'),
      saveAdd = kuzzle.services.list.broker.add,
      responded = false;

    kuzzle.services.list.broker.add = function(queue, response) {
      try {
        should(queue).be.exactly(kuzzle.config.queues.workerWriteResponseQueue);
        should(response.error).not.be.null();
        should(response.error).be.a.String().and.be.exactly('Write Worker: unknown action <foobar>');
      }
      catch (error) {
        done(error);
      }
      responded = true;
    };

    requestObject.action = 'foobar';
    callback.call(kuzzle, requestObject);
    kuzzle.services.list.broker.add = saveAdd;

    should(responded).be.true();
  });

  it('should emit events when successfully submitting a query and receiving a response', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      emittedStartEvent = false,
      emittedStopEvent = false,
      saveEventEmitter = kuzzle.emit;

    this.timeout(50);

    kuzzle.emit = function (eventName, data) {
      if (eventName.startsWith('worker:write:' + requestObject.protocol)) {
        try {
          should(data).match(requestObject);
        } catch (error) {
          done(error);
        }

        if (eventName === ('worker:write:' + requestObject.protocol + ':start')) {
          emittedStartEvent = true;
        }
        else if (eventName === ('worker:write:' + requestObject.protocol + ':stop')) {
          emittedStopEvent = true;
        }
      }
    };

    callback.call(kuzzle, requestObject);

    setTimeout(function () {
      try {
        should(emittedStartEvent).be.true();
        should(emittedStopEvent).be.true();
        kuzzle.emit = saveEventEmitter;
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });

  it('should respond to the response queue and to the notifier queue when a query is successfully completed', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      notifierQueue = false,
      responseQueue = false,
      saveBrokerAdd = kuzzle.services.list.broker.add;

    this.timeout(50);

    kuzzle.services.list.broker.add = function (queue, data) {
      try {
        should(data).match(requestObject);
      } catch (error) {
        done(error);
      }

      if (queue === kuzzle.config.queues.workerWriteResponseQueue) {
        responseQueue = true;
      }
      else if (queue === kuzzle.config.queues.coreNotifierTaskQueue) {
        notifierQueue = true;
      }
    };

    callback.call(kuzzle, requestObject);

    setTimeout(function () {
      try {
        should(responseQueue).be.true();
        should(notifierQueue).be.true();
        kuzzle.services.list.broker.add = saveBrokerAdd;
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });

  it('should respond to the client when an error occurs', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      notifierQueue = false,
      responseQueue = false,
      saveBrokerAdd = kuzzle.services.list.broker.add;

    this.timeout(50);

    kuzzle.services.list.broker.add = function (queue, data) {
      try {
        should(data).be.an.Object();
        should(data.error).not.be.undefined().and.not.be.null();
        should(data.error).be.a.String().and.be.exactly('Error: rejected');
      } catch (error) {
        done(error);
      }

      if (queue === kuzzle.config.queues.workerWriteResponseQueue) {
        responseQueue = true;
      }
      else if (queue === kuzzle.config.queues.coreNotifierTaskQueue) {
        notifierQueue = true;
      }
      else {
        done(new Error('Message sent to an unknown queue: ' + queue));
      }
    };

    requestObject.action = 'update';
    callback.call(kuzzle, requestObject);

    setTimeout(function () {
      try {
        should(responseQueue).be.true();
        should(notifierQueue).be.false();
        kuzzle.services.list.broker.add = saveBrokerAdd;
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });
});
