var
  should = require('should'),
  DslFilters = require.main.require('lib/api/dsl/filters');

describe('Test: dsl.filters.addCollectionSubscription', () => {
  var
    filters,
    index = 'test';

  beforeEach(() => {
    filters = new DslFilters();
  });

  it('should return a resolved promise when adding a new collection', () => {
    return should(filters.addCollectionSubscription('foo', index, 'bar')).be.fulfilled();
  });

  it('should initialize the filtersTree object correctly when adding a new collection', () => {
    return filters.addCollectionSubscription('foo', index, 'bar')
      .then(response => {
        should(response.diff).be.eql([
          {ftG: {
            i: index,
            c: 'bar',
            fi: 'foo'
          }} 
        ]);
        should(response.filter).be.exactly('foo');

        should(filters.filtersTree[index]).be.an.Object();
        should(filters.filtersTree[index].bar).be.an.Object();
        should(filters.filtersTree[index].bar.globalFilterIds).be.an.Array();
        should(filters.filtersTree[index].bar.globalFilterIds.length).be.exactly(1);
        should(filters.filtersTree[index].bar.globalFilterIds[0]).be.exactly('foo');
      });
  });

  it('should not add the same room multiple times in the same collection', () => {
    return filters.addCollectionSubscription('foo', index, 'bar')
      .then(response => {
        should(response.diff).be.eql([
          {ftG: {
            i: index,
            c: 'bar',
            fi: 'foo'
          }}
        ]);
        return filters.addCollectionSubscription('foo', index, 'bar');
      })
      .then(response => {
        should(response.diff).be.false();

        should(filters.filtersTree[index]).be.an.Object();
        should(filters.filtersTree[index].bar).be.an.Object();
        should(filters.filtersTree[index].bar.globalFilterIds).be.an.Array();
        should(filters.filtersTree[index].bar.globalFilterIds.length).be.exactly(1);
        should(filters.filtersTree[index].bar.globalFilterIds[0]).be.exactly('foo');
      });
  });
});
