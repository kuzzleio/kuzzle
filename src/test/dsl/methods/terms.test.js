var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test terms method', function () {

  var
    roomIdMatch = 'roomIdMatch',
    roomIdNot = 'roomIdNotMatch',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper'
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace'
    },
    filter = {
      firstName: ['Grace', 'Jean']
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.terms(roomIdMatch, collection, filter)
      .then(function() {
        return methods.terms(roomIdNot, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty;
    should(methods.dsl.filtersTree[collection]).not.be.empty;
    should(methods.dsl.filtersTree[collection].firstName).not.be.empty;
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Jean']).not.be.empty;
    should(methods.dsl.filtersTree[collection].firstName['nottermsfirstNameGrace,Jean']).not.be.empty;
  });

  it('should construct the filterTree with correct room list', function () {
    var
      rooms = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Jean'].rooms,
      roomsNot = methods.dsl.filtersTree[collection].firstName['nottermsfirstNameGrace,Jean'].rooms;

    should(rooms).be.an.Array;
    should(roomsNot).be.an.Array;

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions terms', function () {
    var
      resultMatch = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Jean'].fn(documentGrace),
      resultNotMatch = methods.dsl.filtersTree[collection].firstName['termsfirstNameGrace,Jean'].fn(documentAda);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);

    resultMatch = methods.dsl.filtersTree[collection].firstName['nottermsfirstNameGrace,Jean'].fn(documentAda);
    resultNotMatch = methods.dsl.filtersTree[collection].firstName['nottermsfirstNameGrace,Jean'].fn(documentGrace);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);
  });

});