var
  should = require('should'),
  rewire = require('rewire'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Worker = rewire('../../lib/workers/write');

describe('Testing: write worker', function () {
  var
    kuzzle,
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.init = function () {return q();};

        // we test successful write commands using a mockup 'create' action...
        kuzzle.services.list.writeEngine.create = function (request) { return q(request); };

        // ...and failed write command with a mockup 'update' action
        kuzzle.services.list.writeEngine.update = function () { return q.reject(new Error('rejected')); };
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

  it('should respond with an error if an unknown action has been submitted', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
      saveAdd = kuzzle.services.list.broker.add,
      responded = false;

    kuzzle.services.list.broker.add = function(queue, response) {
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
    };

    requestObject.action = 'foobar';
    callback.call(kuzzle, requestObject);
    kuzzle.services.list.broker.add = saveAdd;

    should(responded).be.true();
  });

  it('should respond to the response queue and to the notifier queue when a query is successfully completed', function (done) {
    var
      callback = Worker.__get__('onListenCB'),
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
    };

    callback.call(kuzzle, requestObject);

    setTimeout(function () {
      try {
        should(responseQueue).be.true();
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
      onListenCB = Worker.__get__('onListenCB'),
      responseQueue = false,
      saveBrokerAdd = kuzzle.services.list.broker.add;

    this.timeout(50);

    kuzzle.services.list.broker.add = function (queue, data) {
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
    };

    requestObject.action = 'update';
    onListenCB.call(kuzzle, requestObject);

    setTimeout(function () {
      try {
        should(responseQueue).be.true();
        kuzzle.services.list.broker.add = saveBrokerAdd;
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });
});
