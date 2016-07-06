var
  should = require('should'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test "terms" method', function () {
  var
    methods,
    filterIdMatch = 'filterIdMatch',
    filterIdNotMatch = 'filterIdNotMatch',
    index = 'index',
    collection = 'collection',
    filter = {
      firstName: ['Grace', 'Jean']
    },
    termsfirstNameGraceJean = md5('termsfirstNameGrace,Jean'),
    nottermsfirstNameGraceJean = md5('nottermsfirstNameGrace,Jean'),
    fieldFirstName = md5('firstName');

  beforeEach(function () {
    /** @type Methods */
    methods = new Methods(new Filters());

    return methods.terms(filterIdMatch, index, collection, filter, false)
      .then(() => methods.terms(filterIdNotMatch, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][termsfirstNameGraceJean]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][nottermsfirstNameGraceJean]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var
      ids = methods.filters.filtersTree[index][collection].fields[fieldFirstName][termsfirstNameGraceJean].ids,
      idsNot = methods.filters.filtersTree[index][collection].fields[fieldFirstName][nottermsfirstNameGraceJean].ids;

    should(ids).be.an.Array();
    should(idsNot).be.an.Array();

    should(ids).have.length(1);
    should(idsNot).have.length(1);

    should(ids[0]).be.exactly(filterIdMatch);
    should(idsNot[0]).be.exactly(filterIdNotMatch);
  });

  it('should construct the filterTree with correct functions terms', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][termsfirstNameGraceJean].args).match({
      operator: 'terms',
      not: false,
      field: 'firstName',
      value: [ 'Grace', 'Jean' ]
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][nottermsfirstNameGraceJean].args).match({
      operator: 'terms',
      not: true,
      field: 'firstName',
      value: [ 'Grace', 'Jean' ]
    });
  });

});