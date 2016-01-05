var
  should = require('should'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

require('should-promised');

describe('Test: hotelClerk.countSubscription', function () {
  var
    anonymousUser,
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
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
      .then(function (user) {
        anonymousUser = user;
        done();
      });
  });

  it('should reject the request if no room ID has been provided', function () {
    var requestObject = new RequestObject({
      body: {}
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', function () {
    var requestObject = new RequestObject({
      body: { roomId: 'foobar' }
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(NotFoundError, { message: 'The room Id foobar does not exist' });
  });

  it('should return the right subscriptions count when handling a correct request', function () {
    var
      aContext,
      anotherContext,
      subscribeRequest = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: 'foo',
        collection: 'bar',
        index: 'test',
        body: { term: { foo: 'bar' } }
      }),
      countRequest = new RequestObject({ body: {}});

    aContext = {
      connection: {id: 'a connection'},
      user: anonymousUser
    };
    anotherContext = {
      connection: {id: 'another connection'},
      user: anonymousUser
    };

    return kuzzle.hotelClerk.addSubscription(subscribeRequest, aContext)
      .then(function (createdRoom) {
        countRequest.data.body.roomId = createdRoom.roomId;
        return kuzzle.hotelClerk.addSubscription(subscribeRequest, anotherContext);
      })
      .then(function () {
        return kuzzle.hotelClerk.countSubscription(countRequest);
      })
      .then(function (response) {
        should(response.roomId).be.exactly(countRequest.data.body.roomId);
        should(response.count).be.exactly(2);
        return kuzzle.hotelClerk.removeSubscription(countRequest, aContext);
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
