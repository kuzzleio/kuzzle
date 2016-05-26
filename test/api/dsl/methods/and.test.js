var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test and method', function () {

  var
    roomId = 'roomId',
    index = 'index',
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
    ],
    termCity = md5('termcityNYC'),
    termHobby = md5('termhobbycomputer');


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.and(roomId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.hobby).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.city[termCity]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.hobby[termHobby]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[index][collection].fields.city[termCity].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.hobby[termHobby].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions', function () {
    var result;

    result = methods.dsl.filtersTree[index][collection].fields.city[termCity].fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[index][collection].fields.city[termCity].fn(documentAda);
    should(result).be.exactly(false);

    result = methods.dsl.filtersTree[index][collection].fields.hobby[termHobby].fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[index][collection].fields.hobby[termHobby].fn(documentAda);
    should(result).be.exactly(true);
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return methods.__with__({
      getFormattedFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      return should(methods.and(roomId, index, collection, filter)).be.rejectedWith('rejected');
    });
  });
});