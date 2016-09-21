var
  should = require('should'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test "in" method', () => {
  var
    methods,
    filterIdMatch = 'filterIdMatch',
    filterIdNotMatch = 'filterIdNotMatch',
    index = 'index',
    collection = 'collection',
    filter = {
      firstName: ['Grace', 'Jean']
    },
    infirstNameGraceJean = md5('infirstNameGrace,Jean'),
    notinfirstNameGraceJean = md5('notinfirstNameGrace,Jean'),
    fieldFirstName = md5('firstName');

  beforeEach(() => {
    /** @type Methods */
    methods = new Methods(new Filters());

    return methods.in(filterIdMatch, index, collection, filter, false)
      .then(() => methods.in(filterIdNotMatch, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][infirstNameGraceJean]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][notinfirstNameGraceJean]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', () => {
    var
      ids = methods.filters.filtersTree[index][collection].fields[fieldFirstName][infirstNameGraceJean].ids,
      idsNot = methods.filters.filtersTree[index][collection].fields[fieldFirstName][notinfirstNameGraceJean].ids;

    should(ids).be.an.Array();
    should(idsNot).be.an.Array();

    should(ids).have.length(1);
    should(idsNot).have.length(1);

    should(ids[0]).be.exactly(filterIdMatch);
    should(idsNot[0]).be.exactly(filterIdNotMatch);
  });

  it('should construct the filterTree with correct functions terms', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][infirstNameGraceJean].args).match({
      operator: 'in',
      not: false,
      field: 'firstName',
      value: [ 'Grace', 'Jean' ]
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][notinfirstNameGraceJean].args).match({
      operator: 'in',
      not: true,
      field: 'firstName',
      value: [ 'Grace', 'Jean' ]
    });
  });

});