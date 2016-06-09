var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.removeFieldFilter', function () {
  var
    filters;

  beforeEach(function () {
    filters = new DslFilters();
  });

  it('should do nothing if no filters are provided', function () {
    return should(filters.removeFieldFilter({})).be.fulfilled();
  });
});
