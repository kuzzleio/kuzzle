var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.removeFieldFilter', () => {
  var
    filters;

  beforeEach(() => {
    filters = new DslFilters();
  });

  it('should do nothing if no filters are provided', () => {
    should(DslFilters.__get__('removeFieldFilter').call(filters, null)).be.false();
  });
});
