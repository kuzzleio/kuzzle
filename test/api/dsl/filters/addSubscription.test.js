var
  should = require('should'),
  DslFilters = require.main.require('lib/api/dsl/filters');

describe('Test: dsl.filters.addSubscription', function () {
  var
    filters,
    roomId = 'roomId',
    index = 'index',
    collection = 'user',
    fakeFilter = {
      fakeFilter: {
        city: ['NYC', 'London']
      }
    },
    filter = {
      terms: {
        city: ['NYC', 'London']
      }
    };

  before(function () {
    filters = new DslFilters();
  });


  it('should return an error when the filter is undefined', function () {
    return should(filters.addSubscription(roomId, index, collection, undefined)).be.rejected();
  });

  it('should return an error when the filter doesn\'t exist', function () {
    return should(filters.addSubscription(roomId, index, collection, fakeFilter)).be.rejected();
  });

  it('should return an error when the filter is empty', function () {
    return should(filters.addSubscription(roomId, index, collection, {})).be.rejected();
  });

  it('should resolve a promise when the filter exists', function () {
    return should(filters.addSubscription(roomId, index, collection, filter)).not.be.rejected();
  });

});
