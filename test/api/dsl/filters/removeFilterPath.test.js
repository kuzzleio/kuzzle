var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.removeFilterPath', function () {
  var
    filters,
    removeFilterPath = DslFilters.__get__('removeFilterPath');

  beforeEach(function () {
    filters = new DslFilters();
    filters.filtersTree = {
      anIndex: {
        aCollection: {
          globalFilterIds: [],
          fields: {
            aField: {
              randomFilter: {
                ids: [],
                args: {}
              }
            }
          }
        },
        bCollection: {
          globalFilterIds: [],
          fields: {
            aField: {
              randomFilter: {
                ids: [],
                args: {}
              }
            }
          }
        }
      }
    };
  });

  it('should not delete the entire filter if another room use it', function () {
    filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids = [ 'foo', 'bar' ];
    removeFilterPath.call(filters, 'bar', 'anIndex.aCollection.aField.randomFilter');

    should.exist(filters.filtersTree.anIndex.aCollection);
    should.exist(filters.filtersTree.anIndex.aCollection.fields);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.aField);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter);
    should(filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids).be.an.Array().and.match(['foo']);
  });

  it('should do nothing if the provided filter ID is not listed in the filter path', function () {
    var ids = [ 'foo', 'bar' ];

    filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids = ids;
    removeFilterPath.call(filters, 'foobar', 'anIndex.aCollection.aField.randomFilter');

    should.exist(filters.filtersTree.anIndex.aCollection);
    should.exist(filters.filtersTree.anIndex.aCollection.fields);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.aField);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter);
    should(filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids).be.an.Array().and.match(ids);
  });

  it('should remove the entire collection if there is no filter IDs left', function () {
    filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids = [ 'foo' ];
    removeFilterPath.call(filters, 'foo', 'anIndex.aCollection.aField.randomFilter');

    should(filters.filtersTree).be.an.Object().and.not.be.empty();
    should.exist(filters.filtersTree.anIndex);
    should.exist(filters.filtersTree.anIndex.bCollection);
    should.not.exist(filters.filtersTree.anIndex.aCollection);
  });

  it('should remove the entire index if there is no room left', function () {
    filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids = [ 'foo' ];
    filters.filtersTree.anIndex.bCollection.fields.aField.randomFilter.ids = [ 'foo' ];
    removeFilterPath.call(filters, 'foo', 'anIndex.aCollection.aField.randomFilter');
    removeFilterPath.call(filters, 'foo', 'anIndex.bCollection.aField.randomFilter');

    should(filters.filtersTree).be.an.Object().and.be.empty();
  });

  it('should not delete any other filter than the one we provided', function () {
    filters.filtersTree.anIndex.aCollection.fields.aField.randomFilter.ids = [ 'foo' ];
    filters.filtersTree.anIndex.aCollection.fields.anotherField = {
      anotherFilter: {
        ids: [ 'foo' ],
        args: {}
      }
    };

    removeFilterPath.call(filters, 'foo', 'anIndex.aCollection.aField.randomFilter');

    should.exist(filters.filtersTree.anIndex.aCollection);
    should.exist(filters.filtersTree.anIndex.aCollection.fields);
    should.not.exist(filters.filtersTree.anIndex.aCollection.fields.aField);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.anotherField);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.anotherField.anotherFilter);
    should.exist(filters.filtersTree.anIndex.aCollection.fields.anotherField.anotherFilter.ids);
    should(filters.filtersTree.anIndex.aCollection.fields.anotherField.anotherFilter.ids).match(['foo']);
  });
});
