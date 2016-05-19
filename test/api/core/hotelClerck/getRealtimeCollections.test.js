var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

describe('Test: hotelClerk.getRealtimeCollections', function () {
  var collection = 'foobar',
    index = 'index';

  beforeEach(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should return an empty array if there is no subscription', function () {
    should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.be.empty();
  });

  it('should return an array of unique collection names', function () {
    var
      connection = {id: 'connectionid'},
      anonymousUser;

    kuzzle.hotelClerk.rooms = {
      foo: {
        collection: 'foo',
        index: index
      },
      bar: {
        collection: 'bar',
        index: index
      },
      foobar: {
        collection: 'foo',
        index: index
      },
      barfoo: {
        collection: 'barfoo',
        index: index
      }
    };

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (user) {
        var requestObject1 = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          collection: collection,
          body: {}
        });

        anonymousUser = user;

        kuzzle.notifier.notify = function () {};
        return kuzzle.hotelClerk.addSubscription(requestObject1, {
          connection: connection,
          user: anonymousUser
        });
      })
      .then(function () {
        var requestObject2 = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          collection: collection,
          body: { term: { foo: 'bar' } }
        });

        return kuzzle.hotelClerk.addSubscription(requestObject2, {
          connection: connection,
          user: anonymousUser
        });
      })
      .then(() => {
        should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.match([{name: 'foobar'}]);
      });
  });
});
