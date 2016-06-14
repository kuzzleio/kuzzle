var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.filters.removeGlobalFilter', function () {
  var
    filters;

  beforeEach(function () {
    filters = new DslFilters();
  });

  it('should do nothing if the index or the collection does not exist', function () {
    should(filters.removeGlobalFilter('fake')).be.false();

    filters.filtersTree.foobar = {};
    should(filters.removeGlobalFilter('fake')).be.false();

    filters.filtersTree.foobar.globalFilterIds = [];
    should(filters.removeGlobalFilter('fake')).be.false();
  });

  it('should do nothing if the filter ID does not exist', function () {
    filters.addCollectionSubscription('foo', 'index', 'collection');
    filters.removeGlobalFilter('bar');

    should(filters.filtersTree.index.collection.globalFilterIds.length).be.exactly(1);
    should(filters.filtersTree.index.collection.globalFilterIds[0]).be.exactly('foo');
  });

  it('should remove the entire index tree if this is the last filter to be removed on it', function () {
    filters.addCollectionSubscription('foo', 'index', 'collection');
    filters.removeGlobalFilter('foo');

    should(filters.filtersTree.index).be.undefined();
  });
});
