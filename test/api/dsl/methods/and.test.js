var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test and method', function () {

  var
    roomId = 'roomId',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      city: 'NYC',
      hobby: 'computer'
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London',
      hobby: 'computer'
    },
    filter = [
      {
        term: {
          city: 'NYC'
        }
      },
      {
        term: {
          hobby: 'computer'
        }
      }
    ];


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.and(roomId, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].city).not.be.empty();
    should(methods.dsl.filtersTree[collection].hobby).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].city.termcityNYC).not.be.empty();
    should(methods.dsl.filtersTree[collection].hobby.termhobbycomputer).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].city.termcityNYC.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions', function () {
    var result;

    result = methods.dsl.filtersTree[collection].city.termcityNYC.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].city.termcityNYC.fn(documentAda);
    should(result).be.exactly(false);

    result = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].hobby.termhobbycomputer.fn(documentAda);
    should(result).be.exactly(true);
  });

});