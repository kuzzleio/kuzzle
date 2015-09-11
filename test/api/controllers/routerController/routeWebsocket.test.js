/*
 * This file tests the routeWebsocket function, which handles websockets
 * connections, listens to requests and forward them to the funnel controller.
 *
 * Since this function only controls events received by the socket passed as
 * an argument, we'll use a simple event emitter to test its behavior
 */

var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  EventEmitter = require('events').EventEmitter,
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  ResponseObject = require('root-require')('lib/api/core/models/responseObject');


require('should-promised');

describe('Test: routerController.routeWebsocket', function () {
  var
    kuzzle,
    router,
    emitter = new EventEmitter(),
    forwardedObject = {},
    notifyStatus;

    before(function () {
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
        },
        mockupNotifier = function (requestId, responseObject) {
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
      kuzzle.log = new captainsLog({level: 'silent'});

      kuzzle.start(params, {dummy: true})
        .then(function () {
          done();
        });

      kuzzle.funnel.execute = mockupFunnel;
      kuzzle.notifier.notify = mockupNotifier;

      router = new RouterController(kuzzle);
      router.routeWebsocket(emitter);
    });

    it('should have registered a listener for each known controller', function () {
      router.controllers.forEach(function (controller) {
        should(emitter.listeners(controller).length).be.exactly(1);
      });
    });

    it('should embed incoming requests into a well-formed request object', function (done) {
      var emittedObject = {body: {resolve: true}, action: 'get'};

      emitter.emit('read', emittedObject);

      setTimeout(function () {
        try {
          should(forwardedObject.data.body).not.be.null();
          should(forwardedObject.data.body).be.exactly(emittedObject.body);
          should(forwardedObject.protocol).be.exactly('websocket');
          should(forwardedObject.controller).be.exactly('read');
          should(forwardedObject.action).be.exactly('get');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should notify with the returned document in case of success', function (done) {
      var emittedObject = {body: {resolve: true}, action: 'get'};

      notifyStatus = '';
      emitter.emit('read', emittedObject);

      setTimeout(function () {
        try {
          should(notifyStatus).be.exactly('success');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });


    it('should notify with an error object in case of rejection', function (done) {
      var
        emittedObject = {body: {resolve: false}, action: 'get'},
        eventReceived = false;

      notifyStatus = '';

      kuzzle.once('read:websocket:funnel:reject', function () {
        eventReceived = true;
      });

      emitter.emit('read', emittedObject);

      setTimeout(function () {
        try {
          should(notifyStatus).be.exactly('error');
          should(eventReceived).be.true();
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should not notify if the response is empty', function (done) {
      var
        emittedObject = {body: {resolve: true, empty: true}, action: 'get'};

      notifyStatus = '';
      emitter.emit('read', emittedObject);

      setTimeout(function () {
        try {
          should(notifyStatus).be.exactly('');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
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
