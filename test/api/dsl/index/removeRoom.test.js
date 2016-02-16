var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Dsl = rewire('../../../../lib/api/dsl/index'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

describe('Test removeRoom function index.js file from DSL', function () {
  var
    kuzzle,
    roomId,
    anonymousUser,
    roomName = 'roomNameGrace',
    index = 'test',
    collection = 'user',
    filter = {
      terms: {
        city: ['NYC', 'London']
      }
    },
    requestObject = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: filter
    });


  beforeEach(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (user) {
        var context = {
          connection: {id: 'connectionid'},
          user: user
        };

        anonymousUser = user;
        return kuzzle.hotelClerk.addSubscription(requestObject, context);
      })
      .then(function (realTimeResponseObject) {
        roomId = realTimeResponseObject.roomId;
        done();
      });
  });

  it('should return a promise', function () {
    var result = kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId]);

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should have an empty room list and filtersTree when the function is called', function () {
    should(kuzzle.dsl.filtersTree).be.Object();
    should(kuzzle.dsl.filtersTree).not.be.empty();

    return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.empty().Object();
      });
  });

  it('should return a reject promise on fail', function () {
    Dsl.__with__({
      removeRoomFromFields: function () { return q.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      return should(dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])).be.rejected();
    });
  });
});
