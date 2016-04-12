var
  should = require('should'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.removeSubscription', function () {
  var
    kuzzle,
    roomId,
    channel,
    anonymousUser,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      user: anonymousUser
    },
    badConnection = {id: 'badconnectionid'},
    roomName1 = 'roomName1',
    roomName2 = 'roomName2',
    index = 'test',
    collection = 'user',
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
      requestId: roomName1,
      index: index,
      collection: collection,
      body: filter1
    }),
    requestObject2 = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName2,
      index: index,
      collection: collection,
      body: filter2
    }),
    unsubscribeRequest,
    notified,
    mockupNotifier = (roomId, request, notification) => {
      notified = { roomId, request, notification };
    };


  beforeEach(function () {
    notified = null;
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(() => kuzzle.repositories.user.anonymous())
      .then(user => {
        anonymousUser = user;
        kuzzle.notifier.notify = mockupNotifier;
        return kuzzle.hotelClerk.addSubscription(requestObject1, context);
      })
      .then(notification => {
        roomId = notification.roomId;
        channel = notification.channel;
        unsubscribeRequest = new RequestObject({
          controller: 'subscribe',
          action: 'off',
          index: index,
          collection: collection,
          body: { roomId: roomId }
        });
      });
  });

  it('should do nothing when a bad connectionId is given', function () {
    var
      badContext = {
        connection: badConnection,
        user: anonymousUser
      };

    return should(kuzzle.hotelClerk.removeSubscription(requestObject1, badContext)).be.rejected();
  });

  it('should do nothing when a badly formed unsubscribe request is provided', function () {
    var badRequestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      index: index,
      collection: collection,
      body: filter1
    });

    return should(kuzzle.hotelClerk.removeSubscription(badRequestObject, context)).be.rejected();
  });

  it('should do nothing if a bad room name is given', function () {
    var badRequestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      index: index,
      collection: collection,
      body: { roomId: 'this is not a room ID' }
    });

    return should(kuzzle.hotelClerk.removeSubscription(badRequestObject, context)).be.rejected();
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .finally(function () {
        should(kuzzle.dsl.filtersTree).be.an.Object();
        should(kuzzle.dsl.filtersTree).be.empty();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();
      });
  });

  it('should not delete all subscriptions when we want to just remove one', function () {
    return kuzzle.hotelClerk.addSubscription(requestObject2, context)
      .then(function () {
        return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
          .then(function () {
            should(kuzzle.dsl.filtersTree).be.an.Object();
            should(kuzzle.dsl.filtersTree).not.be.empty();

            should(kuzzle.hotelClerk.rooms).be.an.Object();
            should(kuzzle.hotelClerk.rooms).not.be.empty();

            should(kuzzle.hotelClerk.customers).be.an.Object();
            should(kuzzle.hotelClerk.customers).not.be.empty();
          });
      });
  });

  it('should send a notification to other users connected on that room', function () {
    var
      localContext = {
        connection: {id: 'anotherconnection'},
        user: anonymousUser
      },
      rId;

    return kuzzle.hotelClerk.addSubscription(requestObject1, localContext)
      .then(createdRoom => {
        rId = createdRoom.roomId;
        return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context);
      })
      .then(() => {
        should(notified.roomId).be.exactly(rId);
        should(notified.request).be.instanceOf(RequestObject);
        should(notified.request.controller).be.exactly('subscribe');
        should(notified.request.action).be.exactly('off');
        should(notified.request.index).be.exactly(requestObject1.index);
        should(notified.notification.count).be.exactly(1);
      });
  });

  it('should trigger a protocol:leaveChannel hook', function (done) {
    this.timeout(50);

    kuzzle.once('protocol:leaveChannel', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.a.String();
      should(data.id).be.eql(context.connection.id);
      done();
    });

    kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context);
  });
});
