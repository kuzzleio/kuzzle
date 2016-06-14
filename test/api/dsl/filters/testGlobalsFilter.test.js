var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  DslFilters = rewire('../../../../lib/api/dsl/filters'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.filters.testGlobalsFilters', function () {
  var
    filters,
    index = 'foo',
    collection = 'bar',
    flattenBody,
    cachedResult = { Goldorak: 'GO!' },
    data = {foo: {bar: 'bar'}};

  before(function () {
    DslFilters.__set__('findMatchingFilters', function (ids, body, cache) {
      should(ids).be.an.Array();
      should(body).be.exactly(flattenBody);
      should(cache).match(cachedResult);
      return q(ids);
    });

    filters = new DslFilters();
    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = {};
    flattenBody = Dsl.__get__('flattenObject')(data);
  });

  it('should resolve to an empty array if there if the collection doesn\'t contain a room array', function () {
    return should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if there is no rooms registered on that collection', function () {
    filters.filtersTree[index][collection].rooms = [];
    return should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should call the testRooms with the appropriate set of arguments', function () {
    var ids = ['Excuse', 'me', 'while', 'I', 'kiss', 'the', 'sky'];

    filters.filtersTree[index][collection].globalFilterIds = ids;
    return should(filters.testGlobalsFilters(index, collection, flattenBody, cachedResult)).be.fulfilledWith(ids);
  });
});