var
  should = require('should'),
  Promise = require('bluebird'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  DslFilters = rewire('../../../../lib/api/dsl/filters'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.filters.testFieldFilters', function () {
  var
    filters,
    index = 'test',
    collection = 'bar',
    data = { foo: { bar: 'bar' }},
    flattenBody;

  before(function () {
    DslFilters.__set__('findMatchingFilters', function (ids) {
      return ids;
    });
  });

  beforeEach(function () {
    filters = new DslFilters();
    flattenBody = Dsl.__get__('flattenObject')(data);
  });

  it('should return an empty array when no fields are provided', function () {
    should(filters.testFieldFilters(index, collection, {}, {})).be.empty();
  });

  it('should return an empty array if the collection isn\'t yet listed', function () {
    should(filters.testFieldFilters(index, 'nocollection', flattenBody, {})).be.empty();
  });

  it('should return an empty array if no field is registered on a given collection', function () {
    var result;

    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = {};

    result = filters.testFieldFilters(index, collection, flattenBody, {});
    should(result).be.empty();
  });

  it('should return an empty array if the tested fields aren\'t listed on a given collection', function () {
    var result;

    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = { fields: { foobar: '' }};

    result = filters.testFieldFilters(index, collection, flattenBody, {});
    should(result).be.empty();
  });

  it('should return an empty array if no filter match the given document', function () {
    var
      result;

    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = {
      fields: {
        foobar: {
          testFoobar: {
            ids: [ 'foo', 'bar', 'baz' ],
            args: {}
          }
        }
      }
    };

    result = filters.testFieldFilters(index, collection, flattenBody, {});
    should(result).be.empty();
  });

  it('should return a list of filter IDs to notify if a document matches registered filters', function () {
    var
      result,
      hashedFieldName = md5('foo.bar'),
      ids = [ 'foo', 'bar', 'baz' ];

    filters.filtersTree[index] = {};
    filters.filtersTree[index][collection] = {fields: {}};
    filters.filtersTree[index][collection].fields[hashedFieldName] = {
      testFoobar: {
        ids: ids,
        args: {
          operator: 'term',
          not: false,
          field: 'foo.bar',
          value: 'bar'
        }
      }
    };

    result = filters.testFieldFilters(index, collection, flattenBody, {});
    should(result).match(ids);
  });
});
