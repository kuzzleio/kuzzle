var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  NotificationObject = require.main.require('lib/api/core/models/notificationObject'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer');

describe('Test: hotelClerk.getChannels', () => {
  var
    kuzzle,
    context = {
      connection: {id: 'connectionid'},
      user: null
    },
    request = {
      controller: 'subscribe',
      action: 'on',
      requestId: 'foo',
      index: 'index',
      collection: 'bar',
      body: {},
      metadata: {}
    },
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
    kuzzle = new KuzzleServer();
    kuzzle.removeAllListeners();
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []});
  });

  it('should return an empty array if the room does not exist', () => {
    should(kuzzle.hotelClerk.getChannels('foo', {})).be.an.Array().and.be.empty();
  });

  it('should return the right channels depending on the response state', done => {
    var
      roomId,
      notification,
      channels = {};

    request.state = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new RequestObject({collection: 'foo', body: dataGrace}));
        channels.all = response.channel;
        request.state = 'done';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        channels.done = response.channel;
        request.state = 'pending';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        var eligibleChannels;

        channels.pending = response.channel;
        notification.state = 'done';

        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.done].sort());

        notification.state = 'pending';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.pending].sort());

        delete notification.state;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(3);
        should(eligibleChannels.sort()).match([channels.all, channels.pending, channels.done].sort());

        request.state = 'done';
        done();
      })
      .catch(error => done(error));
  });

  it('should return the right channels depending on the response scope', done => {
    var
      roomId,
      notification,
      channels = {};

    request.scope = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new RequestObject({collection: 'foo', body: dataGrace}));
        channels.all = response.channel;
        request.scope = 'in';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        channels.in = response.channel;
        request.scope = 'out';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        channels.out = response.channel;
        request.scope = 'none';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        var eligibleChannels;

        channels.none = response.channel;
        notification.scope = 'in';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        notification.scope = 'out';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete notification.scope;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

  it('should return the right channels depending on the user event type', done => {
    var
      roomId,
      notification,
      channels = {};

    request.users = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
        notification = new NotificationObject(response.roomId, new RequestObject({collection: 'foo', body: dataGrace}));
        notification.controller = 'subscribe';
        channels.all = response.channel;
        request.users = 'in';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        channels.in = response.channel;
        request.users = 'out';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        channels.out = response.channel;
        request.users = 'none';
        return kuzzle.hotelClerk.addSubscription(new RequestObject(request), context);
      })
      .then(response => {
        var eligibleChannels;

        channels.none = response.channel;

        notification.action = 'on';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        notification.action = 'off';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete notification.controller;
        delete notification.action;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, notification);
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

});
