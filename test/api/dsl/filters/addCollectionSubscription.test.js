var
  should = require('should'),
  DslFilters = require.main.require('lib/api/dsl/filters');

describe('Test: dsl.filters.addCollectionSubscription', function () {
  var
    filters,
    index = 'test';

  beforeEach(function () {
    filters = new DslFilters();
  });

  it('should return a resolved promise when adding a new collection', function () {
    return should(filters.addCollectionSubscription('foo', index, 'bar')).be.fulfilled();
  });

  it('should initialize the filtersTree object correctly when adding a new collection', function () {
    return filters.addCollectionSubscription('foo', index, 'bar')
      .then(function () {
        should(filters.filtersTree[index]).be.an.Object();
        should(filters.filtersTree[index].bar).be.an.Object();
        should(filters.filtersTree[index].bar.globalFilterIds).be.an.Array();
        should(filters.filtersTree[index].bar.globalFilterIds.length).be.exactly(1);
        should(filters.filtersTree[index].bar.globalFilterIds[0]).be.exactly('foo');
      });
  });

  it('should not add the same room multiple times in the same collection', function () {
    return filters.addCollectionSubscription('foo', index, 'bar')
      .then(function () {
        return filters.addCollectionSubscription('foo', index, 'bar');
      })
      .then(function () {
        should(filters.filtersTree[index]).be.an.Object();
        should(filters.filtersTree[index].bar).be.an.Object();
        should(filters.filtersTree[index].bar.globalFilterIds).be.an.Array();
        should(filters.filtersTree[index].bar.globalFilterIds.length).be.exactly(1);
        should(filters.filtersTree[index].bar.globalFilterIds[0]).be.exactly('foo');
      });
  });
});
