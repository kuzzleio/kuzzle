var
  should = require('should'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.filters.testGlobalsFilters', () => {
  var
    filters,
    index = 'foo',
    collection = 'bar',
    flattenBody,
    cachedResult = { Goldorak: 'GO!' },
    data = {foo: {bar: 'bar'}};

  before(() => {
    DslFilters.__set__('findMatchingFilters', (ids, body, cache) => {
      should(ids).be.an.Array();
      should(body).be.exactly(flattenBody);
      should(cache).match(cachedResult);
      return ids;
    });

    filters = new DslFilters();
    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = {};
    flattenBody = Dsl.__get__('flattenObject')(data);
  });

  it('should return an empty array if there if the collection doesn\'t contain a room array', () => {
    should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).be.empty();
  });

  it('should an empty array if there is no rooms registered on that collection', () => {
    filters.filtersTree[index][collection].rooms = [];
    should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).be.empty();
  });

  it('should call the testRooms with the appropriate set of arguments', () => {
    var ids = ['Excuse', 'me', 'while', 'I', 'kiss', 'the', 'sky'];

    filters.filtersTree[index][collection].globalFilterIds = ids;
    should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).match(ids);
  });
});