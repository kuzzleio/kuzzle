var
  should = require('should'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Dsl = rewire('../../../../lib/api/dsl/index');

require('should-promised');

describe('Test: dsl.testGlobalsFilters', function () {
  var
    testGlobalsFilters = Dsl.__get__('testGlobalsFilters'),
    dsl,
    flattenBody = 'foo.bar.baz',
    cachedResult = { Goldorak: 'GO!' },
    requestObject = new RequestObject({
      requestId: 'foo',
      index: 'test',
      collection: 'bar',
      body: {foo: 'bar'}
    });

  before(function () {
    Dsl.__set__('testRooms', function (rooms, body, cache) {
      should(rooms).be.an.Array();
      should(body).be.exactly(flattenBody);
      should(cache).match(cachedResult);
      return Promise.resolve(rooms);
    });

    dsl = new Dsl();
    dsl.filtersTree[requestObject.index] = {};
    dsl.filtersTree[requestObject.index][requestObject.collection] = {};
  });

  it('should resolve to an empty array if there if the collection doesn\'t contain a room array', function () {
    return should(testGlobalsFilters.call(dsl, requestObject, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if there is no rooms registered on that collection', function () {
    dsl.filtersTree[requestObject.index][requestObject.collection].rooms = [];
    return should(testGlobalsFilters.call(dsl, requestObject, flattenBody, cachedResult)).be.fulfilledWith([]);
  });

  it('should call the testRooms with the appropriate set of arguments', function () {
    var rooms = ['Excuse', 'me', 'while', 'I', 'kiss', 'the', 'sky'];

    dsl.filtersTree[requestObject.index][requestObject.collection].rooms = rooms;
    return should(testGlobalsFilters.call(dsl, requestObject, flattenBody, cachedResult)).be.fulfilledWith(rooms);
  });
});