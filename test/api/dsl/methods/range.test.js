var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test range method', function () {

  var
    roomIdFilterGrace = 'roomIdGrace',
    roomIdFilterAda = 'roomIdAda',
    roomIdFilterAll = 'roomIdAll',
    roomIdFilterNobody = 'roomIdNobody',

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
      age: {
        gt: 36,
        lte: 85
      }
    },
    filterAda = {
      age: {
        gte: 36,
        lt: 85
      }
    },
    filterAll = {
      age: {
        gte: 36,
        lte: 85
      }
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.range(roomIdFilterGrace, collection, filterGrace)
      .then(function () {
        return methods.range(roomIdFilterAda, collection, filterAda);
      })
      .then(function () {
        return methods.range(roomIdFilterAll, collection, filterAll);
      })
      .then(function () {
        return methods.range(roomIdFilterNobody, collection, filterAll, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].age).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[collection].age.rangeagegt36).not.be.empty();
    should(methods.dsl.filtersTree[collection].age.rangeagelte85).not.be.empty();
    should(methods.dsl.filtersTree[collection].age.rangeagegte36).not.be.empty();
    should(methods.dsl.filtersTree[collection].age.rangeagelt85).not.be.empty();
    should(methods.dsl.filtersTree[collection].age.notrangeagegte36).not.be.empty();
    should(methods.dsl.filtersTree[collection].age.notrangeagelte85).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[collection].age.rangeagegt36.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterGrace);

    // Test lte from filterGrace and filterAll
    rooms = methods.dsl.filtersTree[collection].age.rangeagelte85.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(2);
    should(rooms).containEql(roomIdFilterGrace);
    should(rooms).containEql(roomIdFilterAll);

    // Test gte from filterAda and filterAll
    rooms = methods.dsl.filtersTree[collection].age.rangeagegte36.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(2);
    should(rooms).containEql(roomIdFilterAda);
    should(rooms).containEql(roomIdFilterAll);

    // Test lt from filterAda
    rooms = methods.dsl.filtersTree[collection].age.rangeagelt85.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterAda);

    // Test not gte from negative filterAll
    rooms = methods.dsl.filtersTree[collection].age.notrangeagegte36.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterNobody);

    // Test not lte from negative filterAll
    rooms = methods.dsl.filtersTree[collection].age.notrangeagelte85.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterNobody);
  });

  it('should construct the filterTree with correct functions range', function () {
    var result;

    result = methods.dsl.filtersTree[collection].age.rangeagegt36.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].age.rangeagegt36.fn(documentAda);
    should(result).be.exactly(false);

    result = methods.dsl.filtersTree[collection].age.rangeagelte85.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].age.rangeagelte85.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].age.rangeagegte36.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].age.rangeagegte36.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].age.rangeagelt85.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].age.rangeagelt85.fn(documentAda);
    should(result).be.exactly(true);

    result = methods.dsl.filtersTree[collection].age.notrangeagegte36.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].age.notrangeagegte36.fn(documentAda);
    should(result).be.exactly(false);

    result = methods.dsl.filtersTree[collection].age.notrangeagelte85.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].age.notrangeagelte85.fn(documentAda);
    should(result).be.exactly(false);
  });

});