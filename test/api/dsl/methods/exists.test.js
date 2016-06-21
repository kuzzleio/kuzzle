var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test exists method', function () {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'test',
    collection = 'collection',
    filter = {
      field: 'lastName'
    },
    existslastName = md5('existslastName'),
    fieldLastName = md5('lastName');

  beforeEach(function () {
    methods = new Methods(new Filters());
    return methods.exists(filterId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLastName]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var ids;

    // Test gt from filterGrace
    ids = methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct exists arguments', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName].args).match({
      operator: 'exists',
      not: undefined,
      field: 'lastName',
      value: 'lastName'
    });
  });

  it('should return a rejected promise if the filter argument is empty', function () {
    return should(methods.exists('foo', 'index', 'bar', {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the filter argument does not contain a "field" term', function () {
    return should(methods.exists('foo', 'index', 'bar', { foo: 'bar' })).be.rejectedWith(BadRequestError, { message: 'Filter \'exists\' must contains \'field\' attribute' });
  });

  it('should return a rejected promise if the "field" term does not contain a string', function () {
    return should(methods.exists('foo', 'index', 'bar', { field: {foo: 'bar'} })).be.rejectedWith(BadRequestError);
  });

  it('should return a rejected promise if filters.add fails', function () {
    methods.filters.add = () => new InternalError('rejected');
    return should(methods.exists('foo', 'index', 'bar', { field: 'foo' })).be.rejected();
  });

  it('should register the filter in the local area in case of a "exist" filter', function () {
    methods.filters.add = function (anIndex, aCollection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
      should(inGlobals).be.false();
      should(curriedFunctionName).not.startWith('not');
      return {path: ''};
    };

    return should(methods.exists('foo', 'index', 'bar', { field: 'foo' })).be.fulfilled();
  });

  it('should register the filter in the global area in case of a "not exist" filter', function () {
    methods.filters.add = function (anIndex, aCollection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
      should(inGlobals).be.true();
      should(encodedFunctionName).be.exactly('notexistsfoo');
      return { path: '' };
    };

    return should(methods.exists('foo', 'index', 'bar', { field: 'foo' }, true)).be.fulfilled();
  });
});
