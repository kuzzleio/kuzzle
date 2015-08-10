var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test or method', function () {

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
          city: 'London'
        }
      }
    ];


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.or(roomId, collection, filter)
      .then(function () {
        return methods.or(roomId, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].city).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].city.termcityNYC).not.be.empty();
    should(methods.dsl.filtersTree[collection].city.termcityLondon).not.be.empty();
    should(methods.dsl.filtersTree[collection].city.nottermcityNYC).not.be.empty();
    should(methods.dsl.filtersTree[collection].city.nottermcityLondon).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].city.termcityNYC.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].city.termcityLondon.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].city.nottermcityNYC.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].city.nottermcityLondon.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions', function () {
    var result;

    result = methods.dsl.filtersTree[collection].city.termcityNYC.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].city.termcityNYC.fn(documentAda);
    should(result).be.exactly(false);

    result = methods.dsl.filtersTree[collection].city.termcityLondon.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].city.termcityLondon.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].city.nottermcityNYC.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].city.nottermcityNYC.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].city.nottermcityLondon.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].city.nottermcityLondon.fn(documentAda);
    should(result).be.exactly(false);
  });

});