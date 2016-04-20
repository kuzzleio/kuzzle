/*
 * This file tests the routeMQListener function, which handles MQ
 * connections, listens to requests and forward them to the funnel controller.
 */

var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');


describe('Test: routerController.routeMQListener', function () {
  var
    kuzzle,
    router,
    forwardedObject = {},
    channel,
    messageSent = false,
    mqMessage,
    timer,
    timeout = 500;

  before(function (done) {
    var
      mockupFunnel = function (requestObject, context, callback) {
        forwardedObject = new ResponseObject(requestObject, {});

        if (requestObject.data.body.resolve) {
          if (requestObject.data.body.empty) {
            callback(null, {});
          }
          else {
            callback(null, forwardedObject);
          }
        }
        else {
          callback(new ResponseObject(requestObject, new Error('rejected')));
        }
      },
      mockupSendMessage = replyChannel => {
        messageSent = true;
        channel = replyChannel;
      };

    kuzzle = new Kuzzle();

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.funnel.execute = mockupFunnel;
        kuzzle.services.list.mqBroker.replyTo = mockupSendMessage;
        kuzzle.services.list.mqBroker.addExchange = mockupSendMessage;

        router = new RouterController(kuzzle);
        router.routeMQListener();
        done();
      });
  });

  beforeEach(function () {
    forwardedObject = false;
    messageSent = false;
    channel = '';

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
    };
  });

  it('should register a global listener', function () {
    var listener = kuzzle.services.list.mqBroker.listeners[router.routename];

    should(listener).not.be.undefined();
    should(listener.type).be.exactly('listenExchange');
  });

  it('should be able to manage JSON-based messages content', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { controller: 'write', collection: 'foobar', action: 'create', body: {resolve: true}};

    mqMessage.content = JSON.stringify(body);
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
        should(messageSent).be.true();
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
      body = { controller: 'write', collection: 'foobar', action: 'create', body: {resolve: true}};

    mqMessage.content = new Buffer(JSON.stringify(body));

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
        should(messageSent).be.true();
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

    mqMessage.content = 'foobar';

    listener(mqMessage);
  });

  it('should notify an AMQ client with an error object in case of rejection', function (done) {
    var
      eventReceived = false,
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = {controller: 'write', collection: 'foobar', action: 'create', body: { resolve: false }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    eventReceived = false;

    kuzzle.once('log:error', () => eventReceived = true);
    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(messageSent).be.true();
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

  it('should notify a MQTT client with an error object in case of rejection', function (done) {
    var
      eventReceived = false,
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = {controller: 'write', collection: 'foobar', action: 'create', body: { resolve: false }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    delete mqMessage.properties;
    eventReceived = false;

    kuzzle.once('log:error', () => eventReceived = true);
    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(messageSent).be.true();
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

  it('should initialize an AMQ connection type for AMQP/STOMP messages', function (done) {
    var
      listener = kuzzle.services.list.mqBroker.listeners[router.routename].callback,
      body = { body: { resolve: true }, clientId: 'foobar'};

    mqMessage.content = JSON.stringify(body);
    listener(mqMessage);
    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(messageSent).be.true();
        should(channel).be.exactly(mqMessage.properties.replyTo);
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
    delete mqMessage.properties;

    listener(mqMessage);

    this.timeout(timeout);

    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(messageSent).be.true();
        should(channel).be.exactly('mqtt.foobar');
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
