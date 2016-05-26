var
  should = require('should'),
  md5 = require('crypto-md5'),
  methods = require.main.require('lib/api/dsl/methods');

describe('Test term method', function () {

  var
    roomIdMatch = 'roomIdMatch',
    roomIdNot = 'roomIdNotMatch',
    index = 'index',
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
      firstName: 'Grace'
    },
    termfirstNameGrace = md5('termfirstNameGrace'),
    nottermfirstNameGrace = md5('nottermfirstNameGrace');


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.term(roomIdMatch, index, collection, filter)
      .then(function() {
        return methods.term(roomIdNot, index, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.firstName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.firstName[termfirstNameGrace]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.firstName[nottermfirstNameGrace]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var
      rooms = methods.dsl.filtersTree[index][collection].fields.firstName[termfirstNameGrace].rooms,
      roomsNot = methods.dsl.filtersTree[index][collection].fields.firstName[nottermfirstNameGrace].rooms;

    should(rooms).be.an.Array();
    should(roomsNot).be.an.Array();

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions term', function () {
    var
      resultMatch = methods.dsl.filtersTree[index][collection].fields.firstName[termfirstNameGrace].fn(documentGrace),
      resultNotMatch = methods.dsl.filtersTree[index][collection].fields.firstName[termfirstNameGrace].fn(documentAda);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);

    resultMatch = methods.dsl.filtersTree[index][collection].fields.firstName[nottermfirstNameGrace].fn(documentAda);
    resultNotMatch = methods.dsl.filtersTree[index][collection].fields.firstName[nottermfirstNameGrace].fn(documentGrace);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);
  });

});