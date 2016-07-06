var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.filters.removeGlobalFilter', function () {
  var
    filters,
    removeGlobalFilter = DslFilters.__get__('removeGlobalFilter');

  beforeEach(function () {
    filters = new DslFilters();
  });

  it('should do nothing if the index or the collection does not exist', function () {
    should(removeGlobalFilter.call(filters, 'fake')).be.false();

    filters.filtersTree.foobar = {};
    should(removeGlobalFilter.call(filters, 'fake')).be.false();

    filters.filtersTree.foobar.globalFilterIds = [];
    should(removeGlobalFilter.call(filters, 'fake')).be.false();
  });

  it('should do nothing if the filter ID does not exist', function () {
    filters.addCollectionSubscription('foo', 'index', 'collection');
    removeGlobalFilter.call(filters, 'bar');

    should(filters.filtersTree.index.collection.globalFilterIds.length).be.exactly(1);
    should(filters.filtersTree.index.collection.globalFilterIds[0]).be.exactly('foo');
  });

  it('should remove the entire index tree if this is the last filter to be removed on it', function () {
    filters.addCollectionSubscription('foo', 'index', 'collection');
    removeGlobalFilter.call(filters, 'foo');

    should(filters.filtersTree.index).be.undefined();
  });
});
