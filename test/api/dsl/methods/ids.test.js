var
  should = require('should'),
  methods = require.main.require('lib/api/dsl/methods');

describe('Test ids method', function () {

  var
    roomIdMatch = 'roomIdMatch',
    roomIdNot = 'roomIdNotMatch',
    collection = 'collection',
    documentGrace = {
      _id: 'idGrace',
      firstName: 'Grace',
      lastName: 'Hopper'
    },
    documentAda = {
      _id: 'idAda',
      firstName: 'Ada',
      lastName: 'Lovelace'
    },
    filter = {
      values: ['idGrace']
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.ids(roomIdMatch, collection, filter, false)
      .then(function() {
        return methods.ids(roomIdNot, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields).not.be.empty();

    should(methods.dsl.filtersTree[collection].fields._id).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    /* jshint camelcase:false */
    should(methods.dsl.filtersTree[collection].fields._id.ids_id).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields._id.notids_id).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    /* jshint camelcase:false */
    var
      rooms = methods.dsl.filtersTree[collection].fields._id.ids_id.rooms,
      roomsNot = methods.dsl.filtersTree[collection].fields._id.notids_id.rooms;

    should(rooms).be.an.Array();
    should(roomsNot).be.an.Array();

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions ids', function () {
    /* jshint camelcase:false */

    var
      resultMatch = methods.dsl.filtersTree[collection].fields._id.ids_id.fn(documentGrace),
      resultNotMatch = methods.dsl.filtersTree[collection].fields._id.ids_id.fn(documentAda);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);

    resultMatch = methods.dsl.filtersTree[collection].fields._id.notids_id.fn(documentAda);
    resultNotMatch = methods.dsl.filtersTree[collection].fields._id.notids_id.fn(documentGrace);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);
  });

});