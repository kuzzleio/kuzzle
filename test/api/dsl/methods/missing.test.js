var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test missing method', function () {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'index',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper'
    },
    filter = {
      field: 'lastName'
    },
    missinglastName = md5('missinglastName');

  beforeEach(function () {
    methods = new Methods(new Filters());
    return methods.missing(filterId, index, collection, filter, false);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.lastName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.filters.filtersTree[index][collection].fields.lastName[missinglastName]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var ids;

    // Test gt from filterGrace
    ids = methods.filters.filtersTree[index][collection].fields.lastName[missinglastName].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct functions missing', function () {
    should(methods.filters.filtersTree[index][collection].fields.lastName[missinglastName].args).match({
      operator: 'missing',
      not: false,
      field: 'lastName',
      value: 'lastName'
    });
  });

  it('should return a rejected promise if the filter argument is empty', function () {
    return should(methods.missing('foo', index, 'bar', {}, false)).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the filter argument is invalid', function () {
    return should(methods.missing('foo', index, 'bar', { foo: 'bar' }, false)).be.rejectedWith(BadRequestError, { message: 'Filter \'missing\' must contains \'field\' attribute' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    methods.filters.add = function () { return new InternalError('rejected'); };

    return should(methods.missing('foo', index, 'bar', { field: 'foo' }, false)).be.rejected();
  });

  it('should register the filter in the lcao area in case of a "missing" filter', function () {
    methods.filters.add = function (index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
      should(inGlobals).be.false();
      should(curriedFunctionName).not.startWith('not');
      return { path: '' };
    };

    return should(methods.missing('foo', index, 'bar', { field: 'foo' }, false)).be.fulfilled();
  });

  it('should register the filter in the global area in case of a "not missing" filter', function () {
    methods.filters.add = function (index, collection, field, operatorName, value, hashedFunctionName, roomId, not, inGlobals) {
      var fn = md5(`${not ? 'not': ''}missing${field}`);

      should(inGlobals).be.true();
      should(hashedFunctionName).be.exactly(fn);
      return { path: '' };
    };

    return should(methods.missing('foo', index, 'bar', { field: 'foo' }, true)).be.fulfilled();
  });
});
