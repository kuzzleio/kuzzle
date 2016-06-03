var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test range method', function () {
  var
    methods,
    filterIdFilterGrace = 'filterIdGrace',
    filterIdFilterAda = 'filterIdAda',
    filterIdFilterAll = 'filterIdAll',
    filterIdFilterNobody = 'filterIdNobody',
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

  beforeEach(function () {
    methods = new Methods(new Filters());

    return methods.range(filterIdFilterGrace, index, collection, filterGrace)
      .then(() => methods.range(filterIdFilterAda, index, collection, filterAda))
      .then(() => methods.range(filterIdFilterAll, index, collection, filterAll))
      .then(() => methods.range(filterIdFilterNobody, index, collection, filterAll, true));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', function () {
    should(methods.filters.filtersTree[index][collection].fields.age[rangeagegt36]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age[rangeagelte85]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age[rangeagegte36]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age[rangeagelt85]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age[notrangeagegte36]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields.age[notrangeagelte85]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var ids;

    // Test gt from filterGrace
    ids = methods.filters.filtersTree[index][collection].fields.age[rangeagegt36].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterIdFilterGrace);

    // Test lte from filterGrace and filterAll
    ids = methods.filters.filtersTree[index][collection].fields.age[rangeagelte85].ids;
    should(ids).be.an.Array();
    should(ids).have.length(2);
    should(ids).containEql(filterIdFilterGrace);
    should(ids).containEql(filterIdFilterAll);

    // Test gte from filterAda and filterAll
    ids = methods.filters.filtersTree[index][collection].fields.age[rangeagegte36].ids;
    should(ids).be.an.Array();
    should(ids).have.length(2);
    should(ids).containEql(filterIdFilterAda);
    should(ids).containEql(filterIdFilterAll);

    // Test lt from filterAda
    ids = methods.filters.filtersTree[index][collection].fields.age[rangeagelt85].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterIdFilterAda);

    // Test not gte from negative filterAll
    ids = methods.filters.filtersTree[index][collection].fields.age[notrangeagegte36].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterIdFilterNobody);

    // Test not lte from negative filterAll
    ids = methods.filters.filtersTree[index][collection].fields.age[notrangeagelte85].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterIdFilterNobody);
  });

  it('should construct the filterTree with correct functions range', function () {
    should(methods.filters.filtersTree[index][collection].fields.age[rangeagegt36].args).match({
      operator: 'gt', not: undefined, field: 'age', value: 36
    });

    should(methods.filters.filtersTree[index][collection].fields.age[rangeagelte85].args).match({
      operator: 'lte', not: undefined, field: 'age', value: 85
    });

    should(methods.filters.filtersTree[index][collection].fields.age[rangeagegte36].args).match({
      operator: 'gte', not: undefined, field: 'age', value: 36
    });

    should(methods.filters.filtersTree[index][collection].fields.age[rangeagelt85].args).match({
      operator: 'lt', not: undefined, field: 'age', value: 85
    });

    should(methods.filters.filtersTree[index][collection].fields.age[notrangeagegte36].args).match({
      operator: 'gte', not: true, field: 'age', value: 36
    });

    should(methods.filters.filtersTree[index][collection].fields.age[notrangeagelte85].args).match({
      operator: 'lte', not: true, field: 'age', value: 85
    });
  });

  it('should return a rejected promise if the filter is empty', function () {
    return should(methods.range(filterIdFilterGrace, index, collection, {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    methods.filters.add = function () { return new InternalError('rejected'); };

    return should(methods.range(filterIdFilterGrace, index, collection, filterGrace)).be.rejectedWith('rejected');
  });
});
