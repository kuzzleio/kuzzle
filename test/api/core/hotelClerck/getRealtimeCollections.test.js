var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test: hotelClerk.getRealtimeCollections', function () {
  var
    index = 'foo',
    collection = 'bar';

  beforeEach(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should return an empty array if there is no subscription', function () {
    should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.be.empty();
  });

  it('should return an array of unique collection names', function () {
    kuzzle.hotelClerk.rooms = {
      foo: {
        collection: 'foo'
      },
      bar: {
        collection: 'bar'
      },
      foobar: {
        collection: 'foo',
      },
      barfoo: {
        collection: 'barfoo'
      }
    };

    should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.match(['foo', 'bar', 'barfoo']);
  });
});
