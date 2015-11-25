/*
 * This file tests the routeMQListener function, which handles MQ
 * connections, listens to requests and forward them to the funnel controller.
 */

var
  should = require('should'),
  winston = require('winston'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');


require('should-promised');

describe('Test: routerController.routeMQListener', function () {
  var
    kuzzle,
    router,
    forwardedObject = {},
    forwardedConnection = {},
    notifyStatus,
    mqMessage = {
      fields: {
        consumerTag: 'amq.ctag-foobar',
        exchange: 'amq.topic',
        routingKey: 'write.foobar.create'
      },
      properties: {
        header: {},
        replyTo: 'amq.gen-foobar'
      },
      content: null
    },
    timer,
    timeout = 500;

  before(function (done) {
    var
      mockupFunnel = function (requestObject) {
        var deferred = q.defer();

        forwardedObject = new ResponseObject(requestObject, {});

        if (requestObject.data.body.resolve) {
          if (requestObject.data.body.empty) {
            deferred.resolve({});
          }
          else {
            deferred.resolve(forwardedObject);
          }
        }
        else {
          deferred.reject(new Error('rejected'));
        }

        return deferred.promise;
      },
      mockupNotifier = function (requestId, responseObject, connection) {
        forwardedConnection = connection;

        if (responseObject.error) {
          notifyStatus = 'error';
        }
        else if (responseObject.result) {
          notifyStatus = 'success';
        }
        else {
          notifyStatus = '';
        }
      };

    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.funnel.execute = mockupFunnel;
        kuzzle.notifier.notify = mockupNotifier;

        router = new RouterController(kuzzle);
        router.routeMQListener();
        done();
      });
  });

  it('should register a global listener', function () {
    var listener = kuzzle.services.list.mqBroker.listeners[router.routename];

    should(listener).not.be.undefined();
    should(listener.type).be.exactly('listenExchange');
  });

  it('should be able to manage JSON-based messages content', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { controller: 'write', collection: 'foobar', action: 'create', body: { resolve: true }};

    mqMessage.content = JSON.stringify(body);
    notifyStatus = '';

    forwardedObject = false;
    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(forwardedObject.data.body).not.be.null();
        should(forwardedObject.protocol).be.exactly('mq');
        should(forwardedObject.controller).be.exactly('write');
        should(forwardedObject.collection).be.exactly('foobar');
        should(forwardedObject.action).be.exactly('create');
        should(notifyStatus).be.exactly('success');
        done();
      }
      catch (e) {
        done(e);
      }

      clearInterval(timer);
      timer = false;
    }, 5);
  });

  it('should be able to manage Buffer-based messages content', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { controller: 'write', collection: 'foobar', action: 'create', body: { resolve: true }};

    mqMessage.content = new Buffer(JSON.stringify(body));
    notifyStatus = 'pending';

    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (notifyStatus === 'pending') {
        return;
      }

      try {
        should(forwardedObject.data.body).not.be.null();
        should(forwardedObject.protocol).be.exactly('mq');
        should(forwardedObject.controller).be.exactly('write');
        should(forwardedObject.collection).be.exactly('foobar');
        should(forwardedObject.action).be.exactly('create');
        should(notifyStatus).be.exactly('success');
        done();
      }
      catch (e) {
        done(e);
      }

      clearInterval(timer);
      timer = false;
    }, 5);
  });

  it('should fail cleanly with incorrect messages', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback;

    kuzzle.once('log:error', function (error) {
      should(error).be.an.Object();
      should(error.message).be.exactly('Parse error');
      done();
    });

    notifyStatus = '';
    mqMessage.content = 'foobar';

    listener(mqMessage);
  });

  it('should notify with an error object in case of rejection', function (done) {
    var
      eventReceived = false,
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = {controller: 'write', collection: 'foobar', action: 'create', body: { resolve: false }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    notifyStatus = 'pending';
    eventReceived = false;

    kuzzle.once('write:mq:funnel:reject', function () {
      eventReceived = true;
    });

    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (notifyStatus === 'pending') {
        return;
      }

      try {
        should(notifyStatus).be.exactly('error');
        should(eventReceived).be.true();
        done();
      }
      catch (e) {
        done(e);
      }

      clearInterval(timer);
      timer = false;
    }, 5);
  });

  it('should not notify if the response is empty', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { body: { resolve: true, empty: true }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    notifyStatus = 'expected';

    listener(mqMessage);

    setTimeout(function () {
      try {
        should(notifyStatus).be.exactly('expected');
        done();
      }
      catch (e) {
        done(e);
      }
    }, timeout);
  });

  it('should initialize an AMQ connection type for AMQP/STOMP messages', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { body: { resolve: true }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    notifyStatus = '';
    forwardedObject = false;

    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(forwardedConnection.type).be.exactly('amq');
        should(forwardedConnection.id).be.exactly('foobar');
        should(forwardedConnection.replyTo).be.exactly(mqMessage.properties.replyTo);
        done();
      }
      catch (e) {
        done(e);
      }

      clearInterval(timer);
      timer = false;
    }, 5);
  });

  it('should initialize an MQTT connection type for MQTT messages', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { body: { resolve: true }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    notifyStatus = '';
    delete mqMessage.properties;

    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(forwardedConnection.type).be.exactly('mqtt');
        should(forwardedConnection.id).be.exactly('foobar');
        should(forwardedConnection.replyTo).be.exactly('mqtt.foobar');
        done();
      }
      catch (e) {
        done(e);
      }

      clearInterval(timer);
      timer = false;
    }, 5);
  });
});
