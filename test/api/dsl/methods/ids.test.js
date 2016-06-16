var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test ids method', function () {
  var
    methods,
    filterIdMatch = 'matching filter ID',
    filterIdNot = 'not matching filter ID',
    index = 'test',
    collection = 'collection',
    filter = {
      values: ['idGrace']
    },
    idsIdidGrace = md5('ids_ididGrace'),
    notidsIdidGrace = md5('notids_ididGrace'),
    fieldId = md5('_id');

  beforeEach(function () {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.ids(filterIdMatch, index, collection, filter, false)
      .then(() => methods.ids(filterIdNot, index, collection, filter, true));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldId]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    /* jshint camelcase:false */
    should(methods.filters.filtersTree[index][collection].fields[fieldId][idsIdidGrace]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldId][notidsIdidGrace]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    /* jshint camelcase:false */
    var
      ids = methods.filters.filtersTree[index][collection].fields[fieldId][idsIdidGrace].ids,
      idsNot = methods.filters.filtersTree[index][collection].fields[fieldId][notidsIdidGrace].ids;

    should(ids).be.an.Array();
    should(idsNot).be.an.Array();

    should(ids).have.length(1);
    should(idsNot).have.length(1);

    should(ids[0]).be.exactly(filterIdMatch);
    should(idsNot[0]).be.exactly(filterIdNot);
  });

  it('should construct the filterTree with correct functions ids', function () {
    /* jshint camelcase:false */
    should(methods.filters.filtersTree[index][collection].fields[fieldId][idsIdidGrace].args).match({
      operator: 'terms',
      not: false,
      field: '_id',
      value: [ 'idGrace' ]
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldId][notidsIdidGrace].args).match({
      operator: 'terms',
      not: true,
      field: '_id',
      value: [ 'idGrace' ]
    });
  });

  it('should reject a promise if the filter is empty', function () {
    return should(methods.ids(filterIdMatch, index, collection, {})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if the filter has no "values"', function () {
    return should(methods.ids(filterIdMatch, index, collection, {foo: 'bar'})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if "values" is not an array', function () {
    return should(methods.ids(filterIdMatch, index, collection, {values: 'toto'})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if the filter has empty "values"', function () {
    return should(methods.ids(filterIdMatch, index, collection, {values: []})).be.rejectedWith(BadRequestError);
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    methods.filters.add = function () { return new InternalError('rejected'); };
    return should(methods.ids(filterIdMatch, index, collection, filter, false)).be.rejectedWith('rejected');
  });
});