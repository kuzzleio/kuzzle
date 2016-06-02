var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  q = require('q'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;

describe('Test or method', function () {

  var
    roomId = 'roomId',
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
    nottermcityLondon = md5('nottermcityLondon');

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.or(roomId, index, collection, filter)
      .then(function () {
        return methods.or(roomId, index, collection, filter, true);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.city[termcityNYC]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city[termcityLondon]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityLondon]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[index][collection].fields.city[termcityNYC].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.city[termcityLondon].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.city[nottermcityLondon].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct arguments', function () {
    should(methods.dsl.filtersTree[index][collection].fields.city[termcityNYC].args).match({
      operator: 'term', not: undefined, field: 'city', value: 'NYC'
    });

    should(methods.dsl.filtersTree[index][collection].fields.city[termcityLondon].args).match({
      operator: 'term',
      not: undefined,
      field: 'city',
      value: 'London'
    });

    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC].args).match({
      operator: 'term', not: true, field: 'city', value: 'NYC'
    });

    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityLondon].args).match({
      operator: 'term', not: true, field: 'city', value: 'London'
    });
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return methods.__with__({
      getFormattedFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      return should(methods.or(roomId, index, collection, filter)).be.rejectedWith('rejected');
    });
  });

  it('should reject an error if the filter OR is not an array', function () {
    return should(methods.or(roomId, collection, {})).be.rejectedWith(BadRequestError);
  });

  it('should reject an error if the filter OR is an array with empty filters', function () {
    return should(methods.or(roomId, collection, [{}])).be.rejectedWith(BadRequestError);
  });
});