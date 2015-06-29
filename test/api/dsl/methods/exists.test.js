var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

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
    should(methods.dsl.filtersTree).not.be.empty;
    should(methods.dsl.filtersTree[collection]).not.be.empty;
    should(methods.dsl.filtersTree[collection].lastName).not.be.empty;
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].lastName.existslastName).not.be.empty;
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[collection].lastName.existslastName.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions exists', function () {
    var result;

    result = methods.dsl.filtersTree[collection].lastName.existslastName.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].lastName.existslastName.fn(documentAda);
    should(result).be.exactly(false);
  });

});