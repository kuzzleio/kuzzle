var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test term method', function () {

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
      firstName: 'Grace'
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.term(roomIdMatch, collection, filter)
      .then(function() {
        return methods.term(roomIdNot, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].firstName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].firstName.termfirstNameGrace).not.be.empty();
    should(methods.dsl.filtersTree[collection].firstName.nottermfirstNameGrace).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var
      rooms = methods.dsl.filtersTree[collection].firstName.termfirstNameGrace.rooms,
      roomsNot = methods.dsl.filtersTree[collection].firstName.nottermfirstNameGrace.rooms;

    should(rooms).be.an.Array();
    should(roomsNot).be.an.Array();

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions term', function () {
    var
      resultMatch = methods.dsl.filtersTree[collection].firstName.termfirstNameGrace.fn(documentGrace),
      resultNotMatch = methods.dsl.filtersTree[collection].firstName.termfirstNameGrace.fn(documentAda);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);

    resultMatch = methods.dsl.filtersTree[collection].firstName.nottermfirstNameGrace.fn(documentAda);
    resultNotMatch = methods.dsl.filtersTree[collection].firstName.nottermfirstNameGrace.fn(documentGrace);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);
  });

});