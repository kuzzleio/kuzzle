var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.testFieldFilters', function () {
  var
    testFieldFilters = Dsl.__get__('testFieldFilters'),
    dsl,
    index = 'test',
    collection = 'bar',
    data = { foo: { bar: 'bar' }},
    flattenBody;

  before(function () {
    Dsl.__set__('testRooms', function (rooms) {
      return q(rooms);
    });
  });

  beforeEach(function () {
    dsl = new Dsl();
    flattenBody = Dsl.__get__('flattenObject')(data);
  });

  it('should return a promise when no fields are provided', function () {
    var result = testFieldFilters.call(dsl, index, collection, {}, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if the collection isn\'t yet listed', function () {
    var result = testFieldFilters.call(dsl, index, 'nocollection', flattenBody, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if no field is registered on a given collection', function () {
    var result;

    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = {};

    result = testFieldFilters.call(dsl, index, collection, flattenBody, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if the tested fields aren\'t listed on a given collection', function () {
    var result;

    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = { fields: { foobar: '' }};

    result = testFieldFilters.call(dsl, index, collection, flattenBody, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if no filter match the given document', function () {
    var
      result;

    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = {
      fields: {
        foobar: {
          testFoobar: {
            rooms: [ 'foo', 'bar', 'baz' ],
            fn: function () {
              return false;
            }
          }
        }
      }
    };

    result = testFieldFilters.call(dsl, index, collection, flattenBody, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to a list of rooms to notify if a document matches registered filters', function () {
    var
      result,
      rooms = [ 'foo', 'bar', 'baz' ];

    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = {
      fields: {
        'foo.bar': {
          testFoobar: {
            rooms: rooms,
            args: {
              operator: 'term',
              not: false,
              field: 'foo.bar',
              value: 'bar'
            }
          }
        }
      }
    };

    result = testFieldFilters.call(dsl, index, collection, flattenBody, {});
    return should(result).be.fulfilledWith(rooms);
  });

  it('should return a rejected promise if testRooms fails', function () {
    var
      result,
      rooms = [ 'foo', 'bar', 'baz' ];

    dsl.filtersTree[index] = {};
    dsl.filtersTree[index][collection] = {
      fields: {
        'foo.bar': {
          testFoobar: {
            rooms: rooms,
            args: {
              operator: 'term',
              not: false,
              field: 'foo.bar',
              value: 'bar'
            }
          }
        }
      }
    };

    return Dsl.__with__({
      testRooms: function () { return q.reject(new Error('rejected')); }
    })(function () {
      result = testFieldFilters.call(dsl, index, collection, flattenBody, {});
      return should(result).be.rejectedWith('rejected');
    });
  });
});
