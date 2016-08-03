var
  should = require('should'),
  DslFilters = require.main.require('lib/api/dsl/filters');

describe('Test: dsl.filters.addSubscription', () => {
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

  before(() => {
    filters = new DslFilters();
  });


  it('should return an error when the filter is undefined', () => {
    return should(filters.addSubscription(roomId, index, collection, undefined)).be.rejected();
  });

  it('should return an error when the filter doesn\'t exist', () => {
    return should(filters.addSubscription(roomId, index, collection, fakeFilter)).be.rejected();
  });

  it('should return an error when the filter is empty', () => {
    return should(filters.addSubscription(roomId, index, collection, {})).be.rejected();
  });

  it('should resolve a promise when the filter exists', () => {
    return should(filters.addSubscription(roomId, index, collection, filter)
      .then(response => {
        should(response.diff).be.an.Array();
        should(response.diff).have.length(1);
      })
    ).not.be.rejected();
  });

});
