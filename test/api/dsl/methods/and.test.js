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
        equals: {
          city: 'NYC'
        }
      },
      {
        not: {
          equals: {
            hobby: 'computer'
          }
        }
      }
    ],
    equalsCity = md5('equalscityNYC'),
    equalsHobby = md5('notequalshobbycomputer'),
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
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][equalsCity]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][equalsHobby]).not.be.empty();
  });

  it('should construct the filterTree with the correct filter IDs list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][equalsCity].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldHobby][equalsHobby].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct operator arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][equalsCity].args).match({
      operator: 'equals',
      not: undefined,
      field: 'city',
      value: 'NYC'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][equalsHobby].args).match({
      operator: 'equals',
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