var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.removeCustomerFromAllRooms', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    badConnection = {id: 'badconnectionid'},
    anonymousUser,
    collection = 'user',
    index = '%test',
    filter1 = {
      term: {
        firstName: 'Ada'
      }
    },
    filter2 = {
      terms: {
        firstName: ['Ada', 'Grace']
      }
    },
    requestObject1 = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      collection: collection,
      index: index,
      body: filter1
    }),
    notified,
    mockupNotifier = function (roomId, request, notification) {
      notified = { roomId, request, notification };
    };

  beforeEach(function () {
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(() => kuzzle.repositories.user.anonymous())
      .then(user => {
        anonymousUser = user;

        kuzzle.notifier.notify = mockupNotifier;
        return kuzzle.hotelClerk.addSubscription(requestObject1, {
          connection: connection,
          user: anonymousUser
        });
      })
      .then(() => {
        var requestObject2 = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          collection: collection,
          index: index,
          body: filter2
        });

        return kuzzle.hotelClerk.addSubscription(requestObject2, {
          connection: connection,
          user: anonymousUser
        });
      });
  });

  it('should do nothing when a bad connectionId is given', function () {
    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms(badConnection.id)).be.rejected();
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(function () {
        should(kuzzle.dsl.filtersTree).be.an.Object();
        should(kuzzle.dsl.filtersTree).be.empty();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();
      });
  });

  it('should send a notification to other users connected on that room', function () {
    var
      context = {
        connection: {id: 'anotherconnection'},
        user: anonymousUser
      },
      roomId;

    return kuzzle.hotelClerk.addSubscription(requestObject1, context)
      .then(createdRoom => {
        roomId = createdRoom.roomId;
        return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
      })
      .finally(() => {
        should(notified.roomId).be.exactly(roomId);
        should(notified.request).be.instanceOf(RequestObject);
        should(notified.request.controller).be.exactly('subscribe');
        should(notified.request.action).be.exactly('off');
        should(notified.request.index).be.exactly(requestObject1.index);
        should(notified.notification.count).be.exactly(1);
      });
  });


  it('should log an error if a problem occurs while unsubscribing', function (done) {
    var
      finished = false,

      removeRoom = kuzzle.dsl.removeRoom;

    kuzzle.dsl.removeRoom = function () {
      var deferred = q.defer();

      deferred.reject(new Error('rejected'));

      return deferred.promise;
    };

    this.timeout(500);

    kuzzle.once('log:error', () => {
      if (!finished) {
        finished = true;
        kuzzle.dsl.removeRoom = removeRoom;
        done();
      }
    });

    kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
  });
});
