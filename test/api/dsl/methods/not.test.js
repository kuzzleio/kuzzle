var
  should = require('should'),
  md5 = require('crypto-md5'),
  methods = require.main.require('lib/api/dsl/methods');

describe('Test not method', function () {
  var
    roomId = 'roomId',
    index = 'index',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      city: 'NYC'
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'London'
    },
    filter = {
      term: {
        city: 'London'
      }
    },
    nottermcityLondon = md5('nottermcityLondon'),
    encodedCity = md5('city');

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.not(roomId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields[encodedCity]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields[encodedCity][nottermcityLondon]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[index][collection].fields[encodedCity][nottermcityLondon].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions', function () {
    var result;

    result = methods.dsl.filtersTree[index][collection].fields[encodedCity][nottermcityLondon].fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[index][collection].fields[encodedCity][nottermcityLondon].fn(documentAda);
    should(result).be.exactly(false);
  });

  it('should pass an inverted "not" argument to the must function', function () {
    methods.must = function (roomId, index, collection, filters, not) {
      should(roomId).be.exactly(not);
    };

    methods.not(true, index, {}, {}, false);
    methods.not(false, index, {}, {}, true);
  });
});
