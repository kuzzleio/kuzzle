var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test "and" method', function () {
  var
    methods,
    roomId = 'roomId',
    index = 'index',
    collection = 'collection',
    filter = [
      {
        term: {
          city: 'NYC'
        }
      },
      {
        not: {
          term: {
            hobby: 'computer'
          }
        }
      }
    ],
    termCity = md5('termcityNYC'),
    termHobby = md5('nottermhobbycomputer');


  before(function () {
    methods = new Methods({filtersTree: {}});
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

  it('should construct the filterTree with correct encoded function name', function () {
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

  it('should construct the filterTree with correct operator arguments', function () {
    should(methods.dsl.filtersTree[index][collection].fields.city[termCity].args).match({
      operator: 'term',
      not: undefined,
      field: 'city',
      value: 'NYC'
    });

    should(methods.dsl.filtersTree[index][collection].fields.hobby[termHobby].args).match({
      operator: 'term',
      not: true,
      field: 'hobby',
      value: 'computer'
    });
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return Methods.__with__({
      getFormattedFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      return should(methods.and(roomId, index, collection, filter)).be.rejectedWith('rejected');
    });
  });
});