var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;

describe('Test bool method', function () {
  var
    roomId = 'roomId',
    index = 'test',
    collection = 'collection',
    filter = {
      must : [
        {
          terms : {
            firstName : ['Grace', 'Ada']
          }
        },
        {
          range: {
            age: {
              gte: 36,
              lt: 85
            }
          }
        }
      ],
      'must_not' : [
        {
          term: {
            city: 'NYC'
          }
        }
      ],
      should : [
        {
          term : {
            hobby : 'computer'
          }
        },
        {
          exists : {
            field : 'lastName'
          }
        }
      ]
    },
    rangeagegte36 = md5('rangeagegte36'),
    rangeagelt85 = md5('rangeagelt85'),
    nottermcityNYC = md5('nottermcityNYC'),
    termhobbycomputer = md5('termhobbycomputer'),
    existslastName = md5('existslastName');

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.bool(roomId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.firstName).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.hobby).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.lastName).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    should(methods.dsl.filtersTree[index][collection].fields.firstName[md5('termsfirstNameGrace,Ada')]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.hobby[termhobbycomputer]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.lastName[existslastName]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[index][collection].fields.firstName[md5('termsfirstNameGrace,Ada')].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
    rooms = methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.hobby[termhobbycomputer].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.lastName[existslastName].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct arguments', function () {
    should(methods.dsl.filtersTree[index][collection].fields.firstName[md5('termsfirstNameGrace,Ada')].args).match({
      operator: 'terms',
      not: undefined,
      field: 'firstName',
      value: ['Grace', 'Ada']
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagegte36].args).match({
      operator: 'gte',
      not: undefined,
      field: 'age',
      value: 36
    });

    should(methods.dsl.filtersTree[index][collection].fields.age[rangeagelt85].args).match({
      operator: 'lt',
      not: undefined,
      field: 'age',
      value: 85
    });

    should(methods.dsl.filtersTree[index][collection].fields.city[nottermcityNYC].args).match({
      operator: 'term',
      not: true,
      field: 'city',
      value: 'NYC'
    });

    should(methods.dsl.filtersTree[index][collection].fields.hobby[termhobbycomputer].args).match({
      operator: 'term',
      not: undefined,
      field: 'hobby',
      value: 'computer'
    });

    should(methods.dsl.filtersTree[index][collection].fields.lastName[existslastName].args).match({
      operator: 'exists',
      not: undefined,
      field: 'lastName',
      value: 'lastName'
    });
  });

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.bool(roomId, index, collection, {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the filter contains an invalid key', function () {
    var f = { foo: 'bar' };

    return should(methods.bool(roomId, index, collection, f)).be.rejectedWith(BadRequestError, { message: 'Function foo doesn\'t exist' });
  });

  it('should return a rejected promise if one of the bool sub-methods fails', function () {
    var f = { must: [ { foo: 'bar' } ] };

    methods.must = function () { return q.reject(new Error('rejected')); };
    return should(methods.bool(roomId, index, collection, f)).be.rejectedWith('rejected');
  });
});