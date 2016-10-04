var
  should = require('should'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test equals method', () => {
  var
    methods,
    filterIdMatch = 'matching filter ID',
    filterIdNot = 'non matching filter ID',
    index = 'index',
    collection = 'collection',
    filter = {
      firstName: 'Grace'
    },
    equalsfirstNameGrace = md5('equalsfirstNameGrace'),
    notequalsfirstNameGrace = md5('notequalsfirstNameGrace'),
    fieldFirstName = md5('firstName');


  before(() => {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.equals(filterIdMatch, index, collection, filter)
      .then(() => methods.equals(filterIdNot, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName]).not.be.empty();
  });

  it('should construct the filterTree with correct arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][equalsfirstNameGrace].args).match({
      operator: 'equals',
      not: undefined,
      field: 'firstName',
      value: 'Grace'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][notequalsfirstNameGrace].args).match({
      operator: 'equals',
      not: true,
      field: 'firstName',
      value: 'Grace'
    });
  });

  it('should construct the filterTree with correct room list', () => {
    var
      ids = methods.filters.filtersTree[index][collection].fields[fieldFirstName][equalsfirstNameGrace].ids,
      idsNot = methods.filters.filtersTree[index][collection].fields[fieldFirstName][notequalsfirstNameGrace].ids;

    should(ids).be.an.Array();
    should(idsNot).be.an.Array();

    should(ids).have.length(1);
    should(idsNot).have.length(1);

    should(ids[0]).be.exactly(filterIdMatch);
    should(idsNot[0]).be.exactly(filterIdNot);
  });
});