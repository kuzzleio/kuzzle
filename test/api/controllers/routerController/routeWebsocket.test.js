/*
 * This file tests the routeWebsocket function, which handles websockets
 * connections, listens to requests and forward them to the funnel controller.
 *
 * Since this function only controls events received by the socket passed as
 * an argument, we'll use a simple event emitter to test its behavior
 */

var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  EventEmitter = require('events').EventEmitter,
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');


require('should-promised');

describe('Test: routerController.routeWebsocket', function () {
  var
    kuzzle,
    router,
    messageSent,
    emitter = new EventEmitter(),
    forwardedObject = {},
    timer,
    timeout = 500;

  before(function (done) {
    var
      mockupFunnel = function (requestObject) {
        forwardedObject = new ResponseObject(requestObject, {});

        if (requestObject.data.body.resolve) {
          if (requestObject.data.body.empty) {
            return Promise.resolve({});
          }
          else {
            return Promise.resolve(forwardedObject);
          }
        }
        else {
          return Promise.reject(new Error('rejected'));
        }
      };

    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.funnel.execute = mockupFunnel;
        kuzzle.io = {
          emit: () => messageSent = true,
          to: () => { return kuzzle.io; }
        };
        router = new RouterController(kuzzle);
        router.routeWebsocket(emitter);
        done();
      });
  });

  beforeEach(function () {
    messageSent = false;
    forwardedObject = false;
  });

  it('should have registered a global listener', function () {
    should(emitter.listeners(router.routename).length).be.exactly(1);
  });

  it('should embed incoming requests into a well-formed request object', function (done) {
    var emittedObject = {body: {resolve: true}, controller: 'read', action: 'get'};

    emitter.emit(router.routename, emittedObject);

    this.timeout(timeout);
    timer = setInterval(function () {
      if (forwardedObject === false) {
        return;
      }

      try {
        should(forwardedObject.data.body).not.be.null();
        should(forwardedObject.data.body).be.exactly(emittedObject.body);
        should(forwardedObject.protocol).be.exactly('websocket');
        should(forwardedObject.controller).be.exactly('read');
        should(forwardedObject.action).be.exactly('get');
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

  it('should notify with an error object in case of rejection', function (done) {
    var
      emittedObject = {body: {resolve: false}, controller: 'read', action: 'get'},
      eventReceived = false;

    kuzzle.once('log:error', () => eventReceived = true);
    emitter.emit(router.routename, emittedObject);

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

  it('should handle sockets clean disconnection', function (done) {
    var
      removeCustomers = false,
      hasListener;

    this.timeout(50);

    kuzzle.hotelClerk.removeCustomerFromAllRooms = function () {
      removeCustomers = true;
    };

    kuzzle.once('websocket:disconnect', function () {
      done();
    });

    hasListener = emitter.emit('disconnect');

    should(hasListener).be.true();
    should(removeCustomers).be.true();
  });

  it('should handle sockets crashes', function (done) {
    var
      removeCustomers = false,
      hasListener;

    this.timeout(50);

    kuzzle.hotelClerk.removeCustomerFromAllRooms = function () {
      removeCustomers = true;
    };

    kuzzle.once('websocket:error', function () {
      done();
    });

    hasListener = emitter.emit('error');

    should(hasListener).be.true();
    should(removeCustomers).be.true();
  });
});
