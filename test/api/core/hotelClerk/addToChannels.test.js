var
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  NotificationObject = require('../../../../lib/api/core/models/notificationObject'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.addToChannels', () => {
  var
    kuzzle,
    context = {
      connection: {id: 'connectionid'},
      user: null
    },
    request,
    dataGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      age: 85,
      location: {
        lat: 32.692742,
        lon: -97.114127
      },
      city: 'NYC',
      hobby: 'computer'
    };

  beforeEach(() => {
    request = {
      controller: 'realtime',
      action: 'subscribe',
      requestId: 'foo',
      index: 'index',
      collection: 'bar',
      body: {},
      metadata: {}
    };
    kuzzle = new KuzzleMock();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();
  });

  it('should result in an empty array if the room does not exist', () => {
    var result = [];

    kuzzle.hotelClerk.addToChannels(result, 'foo', {});
    should(result).be.an.Array().and.be.empty();
  });

  it('should push the right channels depending on the response state', done => {
    var
      roomId,
      notification,
      channels = {};

    request.state = 'all';
    kuzzle.hotelClerk.addSubscription(new Request(request), context)
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new Request({collection: 'foo', body: dataGrace}));
        channels.all = response.channel;
        request.state = 'done';
        return kuzzle.hotelClerk.addSubscription(new Request(request), context);
      })
      .then(response => {
        channels.done = response.channel;
        request.state = 'pending';
        return kuzzle.hotelClerk.addSubscription(new Request(request), context);
      })
      .then(response => {
        var eligibleChannels = [];

        channels.pending = response.channel;
        notification.state = 'done';

        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.done].sort());

        notification.state = 'pending';
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.pending].sort());

        delete notification.state;
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(3);
        should(eligibleChannels.sort()).match([channels.all, channels.pending, channels.done].sort());

        request.state = 'done';
        done();
      })
      .catch(error => done(error));
  });

  it('should push the right channels depending on the response scope', done => {
    var
      roomId,
      notification,
      channels = {};

    request.scope = 'all';
    kuzzle.hotelClerk.addSubscription(new Request(request), context)
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new Request({collection: 'foo', body: dataGrace}));
        channels.all = response.channel;
        request.scope = 'in';
        return kuzzle.hotelClerk.addSubscription(new Request(request), context);
      })
      .then(response => {
        channels.in = response.channel;
        request.scope = 'out';
        return kuzzle.hotelClerk.addSubscription(new Request(request), context);
      })
      .then(response => {
        channels.out = response.channel;
        request.scope = 'none';
        return kuzzle.hotelClerk.addSubscription(new Request(request), context);
      })
      .then(response => {
        var eligibleChannels = [];

        channels.none = response.channel;
        notification.scope = 'in';
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        notification.scope = 'out';
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete notification.scope;
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

  it('should push the right channels depending on the user event type', done => {
    var
      roomId,
      notification,
      channels = {};

    request.users = 'all';
    kuzzle.hotelClerk.addSubscription(new Request(request))
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new Request({collection: 'foo', body: dataGrace}), {});
        notification.controller = 'realtime';
        channels.all = response.channel;
        request.users = 'in';
        return kuzzle.hotelClerk.addSubscription(new Request(request));
      })
      .then(response => {
        channels.in = response.channel;
        request.users = 'out';
        return kuzzle.hotelClerk.addSubscription(new Request(request));
      })
      .then(response => {
        channels.out = response.channel;
        request.users = 'none';
        return kuzzle.hotelClerk.addSubscription(new Request(request));
      })
      .then(response => {
        var eligibleChannels = [];

        channels.none = response.channel;

        notification.action = 'subscribe';
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        notification.action = 'unsubscribe';
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete notification.controller;
        delete notification.action;
        eligibleChannels = [];
        kuzzle.hotelClerk.addToChannels(eligibleChannels, roomId, notification);
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

});
