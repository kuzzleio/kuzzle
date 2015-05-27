var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test range method', function () {

  var
    roomIdFilterGrace = 'roomIdGrace',
    roomIdFilterAda = 'roomIdAda',
    roomIdFilterNobody = 'roomIdNobody',
    roomIdFilterAll = 'roomIdAll',

    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      age: 85
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      age: 36
    },

    filterGrace = {
      range: {
        age: {
          gt: 36,
          lte: 85
        }
      }
    },
    filterAda = {
      range: {
        age: {
          gte: 36,
          lt: 85
        }
      }
    },
    filterNobody = {
      range: {
        age: {
          from: 37,
          to: 84
        }
      }
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.range(roomIdFilterGrace, collection, filterGrace)
      .then(function () {
        return methods.range(roomIdFilterAda, collection, filterAda);
      })
      .then(function () {
        return methods.range(roomIdFilterNobody, collection, filterNobody);
      })
      .then(function () {
        return methods.range(roomIdFilterAll, collection, filterNobody, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty;
    should(methods.dsl.filtersTree[collection]).not.be.empty;
    should(methods.dsl.filtersTree[collection].age).not.be.empty;
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].firstName.termfirstNameBeth).not.be.empty;
    should(methods.dsl.filtersTree[collection].firstName.nottermfirstNameBeth).not.be.empty;
  });

  it('should construct the filterTree with correct room list', function () {
    var
      rooms = methods.dsl.filtersTree[collection].firstName.termfirstNameBeth.rooms,
      roomsNot = methods.dsl.filtersTree[collection].firstName.nottermfirstNameBeth.rooms;

    should(rooms).be.an.Array;
    should(roomsNot).be.an.Array;

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions match', function () {
    var
      resultMatch = methods.dsl.filtersTree[collection].firstName.termfirstNameBeth.fn(documentBeth),
      resultNotMatch = methods.dsl.filtersTree[collection].firstName.termfirstNameBeth.fn(documentAda);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);

    resultMatch = methods.dsl.filtersTree[collection].firstName.nottermfirstNameBeth.fn(documentAda);
    resultNotMatch = methods.dsl.filtersTree[collection].firstName.nottermfirstNameBeth.fn(documentBeth);

    should(resultMatch).be.exactly(true);
    should(resultNotMatch).be.exactly(false);
  });

});