var
  should = require('should'),
  Kuzzle = require('../../../../lib/api/kuzzle');

describe('Test: hotelClerk.getRealtimeCollections', () => {
  var
    index = 'foo',
    kuzzle;

  beforeEach(() => {
    kuzzle = new Kuzzle();
  });

  it('should return an empty array if there is no subscription', () => {
    should(kuzzle.hotelClerk.getRealtimeCollections()).be.an.Array().and.be.empty();
  });

  it('should return an array of unique collection names', () => {
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
