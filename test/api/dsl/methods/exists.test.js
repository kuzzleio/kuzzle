var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test exists method', function () {
  var
    roomId = 'roomId',
    index = 'test',
    collection = 'collection',
    filter = {
      field: 'lastName'
    },
    existslastName = md5('existslastName');

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.exists(roomId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.lastName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.lastName[existslastName]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[index][collection].fields.lastName[existslastName].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct exists arguments', function () {
    should(methods.dsl.filtersTree[index][collection].fields.lastName[existslastName].args).match({
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

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.exists('foo', 'index', 'bar', { field: 'foo' }));
    });
  });

  it('should register the filter in the lcao area in case of a "exist" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.false();
        should(curriedFunctionName).not.startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.exists('foo', 'index', 'bar', { field: 'foo' })).be.fulfilled();
    });
  });

  it('should register the filter in the global area in case of a "not exist" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.true();
        should(curriedFunctionName).startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.exists('foo', 'index', 'bar', { field: 'foo' }, true)).be.fulfilled();
    });
  });
});