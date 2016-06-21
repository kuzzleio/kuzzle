var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.getRealtimeCollections', function () {
  var
    index = 'foo',
    kuzzle;

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

    should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.match([{name: 'foo', index: index}, {name: 'bar', index: index}, {name: 'barfoo', index: index}]);
  });
});
