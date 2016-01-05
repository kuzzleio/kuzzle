var
  should = require('should'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.getChannels', function () {
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
    },
    responseObject;

  beforeEach(function () {
    responseObject = new ResponseObject(new RequestObject({collection: 'foo', body: dataGrace}));
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true});
  });

  it('should return an empty array if the room does not exist', function () {
    should(kuzzle.hotelClerk.getChannels('foo', {})).be.an.Array().and.be.empty();
  });

  it('should return the right channels depending on the response state', function (done) {
    var
      roomId,
      channels = {};

    request.state = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
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

        responseObject.state = 'done';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.done].sort());

        responseObject.state = 'pending';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.pending].sort());

        delete responseObject.state;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(3);
        should(eligibleChannels.sort()).match([channels.all, channels.pending, channels.done].sort());

        request.state = 'done';
        done();
      })
      .catch(error => done(error));
  });

  it('should return the right channels depending on the response scope', function (done) {
    var
      roomId,
      channels = {};

    request.scope = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
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
        responseObject.scope = 'in';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        responseObject.scope = 'out';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete responseObject.scope;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

  it('should return the right channels depending on the user event type', function (done) {
    var
      roomId,
      channels = {};

    responseObject.controller = 'subscribe';
    request.users = 'all';
    kuzzle.hotelClerk.addSubscription(new RequestObject(request), context)
      .then(response => {
        roomId = response.roomId;
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

        responseObject.action = 'on';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.in].sort());

        responseObject.action = 'off';
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(2);
        should(eligibleChannels.sort()).match([channels.all, channels.out].sort());

        delete responseObject.controller;
        delete responseObject.action;
        eligibleChannels = kuzzle.hotelClerk.getChannels(roomId, responseObject.toJson());
        should(eligibleChannels.length).be.exactly(4);
        should(eligibleChannels.sort()).match(Object.keys(channels).map(key => channels[key]).sort());
        done();
      })
      .catch(error => done(error));
  });

});
