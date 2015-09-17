var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

require('should-promised');

describe('Test exists method', function () {

  var
    roomId = 'roomId',
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
    return methods.exists(roomId, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.lastName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].fields.lastName.existslastName).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[collection].fields.lastName.existslastName.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions exists', function () {
    var result;

    result = methods.dsl.filtersTree[collection].fields.lastName.existslastName.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].fields.lastName.existslastName.fn(documentAda);
    should(result).be.exactly(false);
  });

  it('should return a rejected promise if the filter argument is empty', function () {
    return should(methods.exists('foo', 'bar', {})).be.rejectedWith('A filter can\'t be empty');
  });

  it('should return a rejected promise if the filter argument is invalid', function () {
    return should(methods.exists('foo', 'bar', { foo: 'bar' })).be.rejectedWith('Filter \'exists\' must contains \'field\' attribute');
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return { error: 'rejected' }; }
    })(function () {
      return should(methods.exists('foo', 'bar', { field: 'foo' }));
    });
  });

  it('should register the filter in the lcao area in case of a "exist" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.false();
        should(curriedFunctionName).not.startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.exists('foo', 'bar', { field: 'foo' })).be.fulfilled();
    });
  });

  it('should register the filter in the global area in case of a "not exist" filter', function () {
    return methods.__with__({
      buildCurriedFunction: function (collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
        should(inGlobals).be.true();
        should(curriedFunctionName).startWith('not');
        return { path: '' };
      }
    })(function () {
      return should(methods.exists('foo', 'bar', { field: 'foo' }, true)).be.fulfilled();
    });
  });
});