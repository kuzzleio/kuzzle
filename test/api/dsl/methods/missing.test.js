var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError');

require('should-promised');

describe('Test missing method', function () {

  var
    roomId = 'roomId',
    index = 'index',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper'
    },
    documentAda = {
      firstName: 'Ada'
    },
    filter = {
      field: 'lastName'
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.missing(roomId, index, collection, filter, false);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.lastName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.lastName.missinglastName).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[index][collection].fields.lastName.missinglastName.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions missing', function () {
    var result;

    result = methods.dsl.filtersTree[index][collection].fields.lastName.missinglastName.fn(documentAda);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[index][collection].fields.lastName.missinglastName.fn(documentGrace);
    should(result).be.exactly(false);
  });

  it('should return a rejected promise if the filter argument is empty', function () {
    return should(methods.missing('foo', index, 'bar', {}, false)).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the filter argument is invalid', function () {
    return should(methods.missing('foo', index, 'bar', { foo: 'bar' }, false)).be.rejectedWith(BadRequestError, { message: 'Filter \'missing\' must contains \'field\' attribute' });
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.missing('foo', index, 'bar', { field: 'foo' }, false));
    });
  });

  it('should register the filter in the lcao area in case of a "missing" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.false();
        should(curriedFunctionName).not.startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.missing('foo', index, 'bar', { field: 'foo' }, false)).be.fulfilled();
    });
  });

  it('should register the filter in the global area in case of a "not missing" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.true();
        should(curriedFunctionName).startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.missing('foo', index, 'bar', { field: 'foo' }, true)).be.fulfilled();
    });
  });
});