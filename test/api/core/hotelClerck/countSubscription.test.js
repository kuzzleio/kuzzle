var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  kuzzle = require.main.require('lib'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('should-promised');

describe('Test: hotelClerk.countSubscription', function () {
  var
    context = {
      connection: {id: 'connectionId'},
      user: null
    };

  before(function (done) {
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

    kuzzle.hotelClerk.customers = {};
    kuzzle.hotelClerk.rooms = {};

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (anonymousUser) {
        context.user = anonymousUser;
        done();
      });
  });

  it('should reject the request if no room ID has been provided', function () {
    var requestObject = new RequestObject({
      body: {}
    });
    requestObject._context = context;

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith('The room Id is mandatory for count subscription');
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', function () {
    var requestObject = new RequestObject({
      body: { roomId: 'foobar' }
    });
    requestObject._context = context;

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith('The room Id foobar is unknown');
  });

  it('should return the right subscriptions count when handling a correct request', function () {
    var
      subscribeRequest = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          requestId: 'foo',
          collection: 'bar',
          body: { term: { foo: 'bar' } }
        }),
      countRequest = new RequestObject({ body: {}});

    subscribeRequest._context = {
      connection: {id: 'a connection'},
      user: context.user
    };
    countRequest._context = {
      connection: {id: 'count connection'},
      user: context.user
    };

    return kuzzle.hotelClerk.addSubscription(subscribeRequest)
      .then(function (createdRoom) {
        countRequest.data.body.roomId = createdRoom.roomId;
        subscribeRequest._context.connection.id = 'another connection';
        return kuzzle.hotelClerk.addSubscription(subscribeRequest);
      })
      .then(function () {
        return kuzzle.hotelClerk.countSubscription(countRequest);
      })
      .then(function (response) {
        should(response.roomId).be.exactly(countRequest.data.body.roomId);
        should(response.count).be.exactly(2);
        subscribeRequest._context.connection.id = 'a connection';
        return kuzzle.hotelClerk.removeSubscription(subscribeRequest);
      })
      .then(function () {
        return kuzzle.hotelClerk.countSubscription(countRequest);
      })
      .then(function (response) {
        should(response.roomId).be.exactly(countRequest.data.body.roomId);
        should(response.count).be.exactly(1);
      });
  });
});
