var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.testGlobalsFilters', function () {
  var
    testGlobalsFilters = Dsl.__get__('testGlobalsFilters'),
    dsl,
    index = 'foo',
    collection = 'bar',
    flattenBody,
    cachedResult = { Goldorak: 'GO!' },
    data = {foo: {bar: 'bar'}};

  before(function () {
    Dsl.__set__('testRooms', function (rooms, body, cache) {
      should(rooms).be.an.Array();
      should(body).be.exactly(flattenBody);
      should(cache).match(cachedResult);
      return q(rooms);
    });

    dsl = new Dsl();
    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = {};
    flattenBody = Dsl.__get__('flattenObject')(data);
  });

  it('should resolve to an empty array if there if the collection doesn\'t contain a room array', function () {
    return should(testGlobalsFilters.call(dsl, index, collection, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if there is no rooms registered on that collection', function () {
    dsl.filtersTree[index][collection].rooms = [];
    return should(testGlobalsFilters.call(dsl, index, collection, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should call the testRooms with the appropriate set of arguments', function () {
    var rooms = ['Excuse', 'me', 'while', 'I', 'kiss', 'the', 'sky'];

    dsl.filtersTree[index][collection].rooms = rooms;
    return should(testGlobalsFilters.call(dsl, index, collection, flattenBody, cachedResult)).be.fulfilledWith(rooms);
  });
});