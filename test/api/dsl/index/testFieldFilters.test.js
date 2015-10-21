var
  should = require('should'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Dsl = rewire('../../../../lib/api/dsl/index');

require('should-promised');

describe('Test: dsl.testFieldFilters', function () {
  var
    testFieldFilters = Dsl.__get__('testFieldFilters'),
    dsl,
    requestObject = new RequestObject({
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    });

  before(function () {
    Dsl.__set__('testRooms', function (rooms) {
      return Promise.resolve(rooms);
    });
  });

  beforeEach(function () {
    dsl = new Dsl();
  });

  it('should return a promise when no fields are provided', function () {
    var result = testFieldFilters({}, {}, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if the collection isn\'t yet listed', function () {
    var result = testFieldFilters.call(dsl, {}, requestObject, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty arry if no field is registered on a given collection', function () {
    var result;

    dsl.filtersTree[requestObject.collection] = {};

    result = testFieldFilters.call(dsl, {}, requestObject, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if the tested fields aren\'t listed on a given collection', function () {
    var result;

    dsl.filtersTree[requestObject.collection] = { fields: { foobar: '' }};

    result = testFieldFilters.call(dsl, requestObject, {}, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to an empty array if no filter match the given document', function () {
    var
      result;

    dsl.filtersTree[requestObject.collection] = {
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

    result = testFieldFilters.call(dsl, requestObject, { foobar: '' }, {});
    return should(result).be.fulfilledWith([]);
  });

  it('should resolve to a list of rooms to notify if a document matches registered filters', function () {
    var
      result,
      rooms = [ 'foo', 'bar', 'baz' ];

    dsl.filtersTree[requestObject.collection] = {
      fields: {
        'foo.bar': {
          testFoobar: {
            rooms: rooms,
            fn: function () {
              return true;
            }
          }
        }
      }
    };

    result = testFieldFilters.call(dsl, requestObject, { 'foo.bar.baz': '' }, {});
    return should(result).be.fulfilledWith(rooms);
  });

  it('should return a rejected promise if testRooms fails', function () {
    var
      result,
      rooms = [ 'foo', 'bar', 'baz' ];

    dsl.filtersTree[requestObject.collection] = {
      fields: {
        'foo.bar': {
          testFoobar: {
            rooms: rooms,
            fn: function () {
              return true;
            }
          }
        }
      }
    };

    return Dsl.__with__({
      testRooms: function () { return Promise.reject(new Error('rejected')); }
    })(function () {
      result = testFieldFilters.call(dsl, requestObject, { 'foo.bar.baz': '' }, {});
      return should(result).be.rejectedWith('rejected');
    });
  });
});
