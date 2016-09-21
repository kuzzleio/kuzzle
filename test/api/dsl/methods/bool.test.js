var
  should = require('should'),
  Promise = require('bluebird'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;

describe('Test bool method', () => {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'test',
    collection = 'collection',
    filter = {
      must : [
        {
          in : {
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
          equals: {
            city: 'NYC'
          }
        }
      ],
      should : [
        {
          equals: {
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
    notequalscityNYC = md5('notequalscityNYC'),
    equalshobbycomputer = md5('equalshobbycomputer'),
    existslastName = md5('existslastName'),
    fieldFirstName = md5('firstName'),
    fieldAge = md5('age'),
    fieldCity = md5('city'),
    fieldHobby = md5('hobby'),
    fieldLastName = md5('lastName');

  before(() => {
    /*
     since there is a "Methods.should()" function, we need to ask should.js
     to not override it with itself -_-
     */
    should.noConflict();

    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.bool(filterId, index, collection, filter);
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldAge]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldHobby]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLastName]).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][md5('infirstNameGrace,Ada')]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagegte36]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagelt85]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldCity][notequalscityNYC]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][equalshobbycomputer]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldFirstName][md5('infirstNameGrace,Ada')].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagegte36].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
    ids = methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagelt85].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldCity][notequalscityNYC].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldHobby][equalshobbycomputer].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldFirstName][md5('infirstNameGrace,Ada')].args).match({
      operator: 'in',
      not: undefined,
      field: 'firstName',
      value: ['Grace', 'Ada']
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagegte36].args).match({
      operator: 'gte',
      not: undefined,
      field: 'age',
      value: 36
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldAge][rangeagelt85].args).match({
      operator: 'lt',
      not: undefined,
      field: 'age',
      value: 85
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldCity][notequalscityNYC].args).match({
      operator: 'equals',
      not: true,
      field: 'city',
      value: 'NYC'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldHobby][equalshobbycomputer].args).match({
      operator: 'equals',
      not: undefined,
      field: 'hobby',
      value: 'computer'
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLastName][existslastName].args).match({
      operator: 'exists',
      not: undefined,
      field: 'lastName',
      value: 'lastName'
    });
  });

  it('should return a rejected promise if an empty filter is provided', () => {
    return should(methods.bool(filterId, index, collection, {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the filter contains an invalid key', () => {
    var f = { foo: 'bar' };

    return should(methods.bool(filterId, index, collection, f)).be.rejectedWith(BadRequestError, { message: 'Function foo doesn\'t exist' });
  });

  it('should return a rejected promise if one of the bool sub-methods fails', () => {
    var f = { must: [ { foo: 'bar' } ] };

    methods.must = () => { return Promise.reject(new Error('rejected')); };
    return should(methods.bool(filterId, index, collection, f)).be.rejectedWith('rejected');
  });
});