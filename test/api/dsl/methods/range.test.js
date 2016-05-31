var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test range method', function () {
  var
    roomIdFilterGrace = 'roomIdGrace',
    roomIdFilterAda = 'roomIdAda',
    roomIdFilterAll = 'roomIdAll',
    roomIdFilterNobody = 'roomIdNobody',
    index = 'index',
    collection = 'collection',
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
    },
    rangeagegt36 = md5('rangeagegt36'),
    rangeagelte85 = md5('rangeagelte85'),
    rangeagegte36 = md5('rangeagegte36'),
    rangeagelt85 = md5('rangeagelt85'),
    notrangeagegte36 = md5('notrangeagegte36'),
    notrangeagelte85 = md5('notrangeagelte85');


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.range(roomIdFilterGrace, index, collection, filterGrace)
      .then(function () {
        return methods.range(roomIdFilterAda, index, collection, filterAda);
      })
      .then(function () {
        return methods.range(roomIdFilterAll, index, collection, filterAll);
      })
      .then(function () {
        return methods.range(roomIdFilterNobody, index, collection, filterAll, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegt36]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelte85]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[notrangeagegte36]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[notrangeagelte85]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    // Test gt from filterGrace
    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagegt36].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterGrace);

    // Test lte from filterGrace and filterAll
    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagelte85].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(2);
    should(rooms).containEql(roomIdFilterGrace);
    should(rooms).containEql(roomIdFilterAll);

    // Test gte from filterAda and filterAll
    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(2);
    should(rooms).containEql(roomIdFilterAda);
    should(rooms).containEql(roomIdFilterAll);

    // Test lt from filterAda
    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterAda);

    // Test not gte from negative filterAll
    rooms = methods.dsl.filtersTree[index][collection].fields.age[notrangeagegte36].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterNobody);

    // Test not lte from negative filterAll
    rooms = methods.dsl.filtersTree[index][collection].fields.age[notrangeagelte85].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomIdFilterNobody);
  });

  it('should construct the filterTree with correct functions range', function () {
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegt36].args).match({
      operator: 'gt', not: undefined, field: 'age', value: 36
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelte85].args).match({
      operator: 'lte', not: undefined, field: 'age', value: 85
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36].args).match({
      operator: 'gte', not: undefined, field: 'age', value: 36
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85].args).match({
      operator: 'lt', not: undefined, field: 'age', value: 85
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[notrangeagegte36].args).match({
      operator: 'gte', not: true, field: 'age', value: 36
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[notrangeagelte85].args).match({
      operator: 'lte', not: true, field: 'age', value: 85
    });
  });

  it('should return a rejected promise if the filter is empty', function () {
    return should(methods.range(roomIdFilterGrace, index, collection, {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    return methods.__with__({
      addToFiltersTree: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.range(roomIdFilterGrace, index, collection, filterGrace)).be.rejectedWith('rejected');
    });
  });
});