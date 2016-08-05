var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.filters.findMatchingFilters', () => {
  var
    filters,
    findMatchingFilters = DslFilters.__get__('findMatchingFilters');

  beforeEach(() => {
    filters = new DslFilters();
  });

  it('should return a rejected promise when the room to test does\'t exist', () => {
    should(findMatchingFilters.call(filters, ['foo'], {}, {})).be.empty();
  });

  it('should mark the filter as notifiable if no filter are provided', () => {
    filters.filters.foo = {};

    should(findMatchingFilters.call(filters, ['foo'], {}, {})).match(['foo']);
  });

  it('should return the correct list of rooms whose filters are matching', () => {
    filters.filters = {
      foo: {
        encodedFilters: { returnValue: true }
      },
      bar: {
        encodedFilters: { returnValue: false }
      },
      baz: {
        encodedFilters: { returnValue: true }
      }
    };

    DslFilters.__with__({
      testFilterRecursively: (filler, filter) => filter.returnValue
    })(() => {
      should(findMatchingFilters.call(filters, ['foo', 'bar', 'baz'])).match(['foo', 'baz']);
    });
  });

  it('should not return duplicate room ids', () => {
    filters.filters.foo = {};

    should(findMatchingFilters.call(filters, ['foo', 'foo'], {}, {})).match(['foo']);
  });
});