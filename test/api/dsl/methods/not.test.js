var
  should = require('should'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test "not" method', function () {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'index',
    collection = 'collection',
    filter = {
      term: {
        city: 'London'
      }
    },
    nottermcityLondon = md5('nottermcityLondon'),
    fieldCity = md5('city');

  beforeEach(function () {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.not(filterId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var ids;

    // Test gt from filterGrace
    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct functions', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon].args).match({
      operator: 'term', not: true, field: 'city', value: 'London'
    });
  });

  it('should pass an inverted "not" argument to the must function', function () {
    methods.must = function (roomId, anIndex, aCollection, filters, not) {
      should(roomId).be.exactly(not);
    };

    methods.not(true, index, {}, {}, false);
    methods.not(false, index, {}, {}, true);
  });
});
