var
  should = require('should'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test term method', () => {
  var
    methods,
    filterIdMatch = 'matching filter ID',
    filterIdNot = 'non matching filter ID',
    index = 'index',
    collection = 'collection',
    filter = {
      firstName: 'Grace'
    },
    termfirstNameGrace = md5('termfirstNameGrace'),
    nottermfirstNameGrace = md5('nottermfirstNameGrace'),
    fieldFirstName = md5('firstName');


  before(() => {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.term(filterIdMatch, index, collection, filter)
      .then(() => methods.term(filterIdNot, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName]).not.be.empty();
  });

  it('should construct the filterTree with correct arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][termfirstNameGrace].args).match({
      operator: 'term',
      not: undefined,
      field: 'firstName',
      value: 'Grace'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][nottermfirstNameGrace].args).match({
      operator: 'term',
      not: true,
      field: 'firstName',
      value: 'Grace'
    });
  });

  it('should construct the filterTree with correct room list', () => {
    var
      ids = methods.filters.filtersTree[index][collection].fields[fieldFirstName][termfirstNameGrace].ids,
      idsNot = methods.filters.filtersTree[index][collection].fields[fieldFirstName][nottermfirstNameGrace].ids;

    should(ids).be.an.Array();
    should(idsNot).be.an.Array();

    should(ids).have.length(1);
    should(idsNot).have.length(1);

    should(ids[0]).be.exactly(filterIdMatch);
    should(idsNot[0]).be.exactly(filterIdNot);
  });
});