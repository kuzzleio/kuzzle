var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Promise = require('bluebird'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;

describe('Test or method', () => {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'index',
    collection = 'collection',
    filter = [
      {
        term: {
          city: 'NYC'
        }
      },
      {
        term: {
          city: 'London'
        }
      }
    ],
    termcityNYC = md5('termcityNYC'),
    termcityLondon = md5('termcityLondon'),
    nottermcityNYC = md5('nottermcityNYC'),
    nottermcityLondon = md5('nottermcityLondon'),
    fieldCity = md5('city');

  beforeEach(() => {
    methods = new Methods(new Filters());

    return methods.or(filterId, index, collection, filter)
      .then(() => methods.or(filterId, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termcityNYC]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termcityLondon]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityNYC]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][termcityNYC].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][termcityLondon].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityNYC].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termcityNYC].args).match({
      operator: 'term', not: undefined, field: 'city', value: 'NYC'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termcityLondon].args).match({
      operator: 'term',
      not: undefined,
      field: 'city',
      value: 'London'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityNYC].args).match({
      operator: 'term', not: true, field: 'city', value: 'NYC'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldCity][nottermcityLondon].args).match({
      operator: 'term', not: true, field: 'city', value: 'London'
    });
  });

  it('should return a rejected promise if getFormattedFilters fails', () => {
    return Methods.__with__({
      getFormattedFilters: () => { return Promise.reject(new Error('rejected')); }
    })(() => {
      return should(methods.or(filterId, index, collection, filter)).be.rejectedWith('rejected');
    });
  });

  it('should reject an error if the filter OR is not an array', () => {
    return should(methods.or(filterId, collection, {})).be.rejectedWith(BadRequestError);
  });

  it('should reject an error if the filter OR is an array with empty filters', () => {
    return should(methods.or(filterId, collection, [{}])).be.rejectedWith(BadRequestError);
  });
});