var
  should = require('should'),
  md5 = require('crypto-md5'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test term method', function () {
  var
    methods,
    roomIdMatch = 'roomIdMatch',
    roomIdNot = 'roomIdNotMatch',
    index = 'index',
    collection = 'collection',
    filter = {
      firstName: 'Grace'
    },
    termfirstNameGrace = md5('termfirstNameGrace'),
    nottermfirstNameGrace = md5('nottermfirstNameGrace');


  before(function () {
    methods = new Methods({filtersTree: {}});
    return methods.term(roomIdMatch, index, collection, filter)
      .then(() => methods.term(roomIdNot, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.firstName).not.be.empty();
  });

  it('should construct the filterTree with correct arguments', function () {
    should(methods.dsl.filtersTree[index][collection].fields.firstName[termfirstNameGrace].args).match({
      operator: 'term',
      not: undefined,
      field: 'firstName',
      value: 'Grace'
    });

    should(methods.dsl.filtersTree[index][collection].fields.firstName[nottermfirstNameGrace].args).match({
      operator: 'term',
      not: true,
      field: 'firstName',
      value: 'Grace'
    });
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
});