var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test ids method', function () {
  var
    methods,
    roomIdMatch = 'roomIdMatch',
    roomIdNot = 'roomIdNotMatch',
    index = 'test',
    collection = 'collection',
    filter = {
      values: ['idGrace']
    },
    idsIdidGrace = md5('ids_ididGrace'),
    notidsIdidGrace = md5('notids_ididGrace');

  before(function () {
    methods = new Methods({filtersTree: {}});
    return methods.ids(roomIdMatch, index, collection, filter, false)
      .then(function() {
        return methods.ids(roomIdNot, index, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields._id).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    /* jshint camelcase:false */
    should(methods.dsl.filtersTree[index][collection].fields._id[idsIdidGrace]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields._id[notidsIdidGrace]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    /* jshint camelcase:false */
    var
      rooms = methods.dsl.filtersTree[index][collection].fields._id[idsIdidGrace].rooms,
      roomsNot = methods.dsl.filtersTree[index][collection].fields._id[notidsIdidGrace].rooms;

    should(rooms).be.an.Array();
    should(roomsNot).be.an.Array();

    should(rooms).have.length(1);
    should(roomsNot).have.length(1);

    should(rooms[0]).be.exactly(roomIdMatch);
    should(roomsNot[0]).be.exactly(roomIdNot);
  });

  it('should construct the filterTree with correct functions ids', function () {
    /* jshint camelcase:false */
    should(methods.dsl.filtersTree[index][collection].fields._id[idsIdidGrace].args).match({
      operator: 'terms',
      not: false,
      field: '_id',
      value: [ 'idGrace' ]
    });

    should(methods.dsl.filtersTree[index][collection].fields._id[notidsIdidGrace].args).match({
      operator: 'terms',
      not: true,
      field: '_id',
      value: [ 'idGrace' ]
    });
  });

  it('should reject a promise if the filter is empty', function () {
    return should(methods.ids(roomIdMatch, index, collection, {})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if the filter has no "values"', function () {
    return should(methods.ids(roomIdMatch, index, collection, {foo: 'bar'})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if "values" is not an array', function () {
    return should(methods.ids(roomIdMatch, index, collection, {values: 'toto'})).be.rejectedWith(BadRequestError);
  });

  it('should reject a promise if the filter has empty "values"', function () {
    return should(methods.ids(roomIdMatch, index, collection, {values: []})).be.rejectedWith(BadRequestError);
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    return Methods.__with__({
      addToFiltersTree: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.ids(roomIdMatch, index, collection, filter, false)).be.rejectedWith('rejected');
    });
  });
});