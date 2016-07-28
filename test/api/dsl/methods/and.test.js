var
  should = require('should'),
  Promise = require('bluebird'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test "and" method', () => {
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
        not: {
          term: {
            hobby: 'computer'
          }
        }
      }
    ],
    termCity = md5('termcityNYC'),
    termHobby = md5('nottermhobbycomputer'),
    fieldCity = md5('city'),
    fieldHobby = md5('hobby');

  before(() => {
    methods = new Methods(new Filters());
    return methods.and(filterId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldHobby]).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termCity]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][termHobby]).not.be.empty();
  });

  it('should construct the filterTree with the correct filter IDs list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][termCity].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldHobby][termHobby].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct operator arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][termCity].args).match({
      operator: 'term',
      not: undefined,
      field: 'city',
      value: 'NYC'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][termHobby].args).match({
      operator: 'term',
      not: true,
      field: 'hobby',
      value: 'computer'
    });
  });

  it('should return a rejected promise if getFormattedFilters fails', () => {
    return Methods.__with__({
      getFormattedFilters: () => { return Promise.reject(new Error('rejected')); }
    })(() => {
      return should(methods.and(filterId, index, collection, filter)).be.rejectedWith('rejected');
    });
  });
});