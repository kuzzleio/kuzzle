var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test geoboundingbox method', function () {
  var
    methods,
    roomId = 'roomId',
    index = 'test',
    collection = 'collection',
    // Test all supported formats
    filterEngland = {
      location: {
        top: -2.939744,
        left: 52.394484,
        bottom: 1.180129,
        right: 51.143628
      }
    },
    filterEngland2 = {
      location: {
        'top_left': {
          lat: 52.394484,
          lon: -2.939744
        },
        'bottom_right': {
          lat: 51.143628,
          lon: 1.180129
        }
      }
    },
    filterEngland3 = {
      location: {
        'top_left': [ -2.939744, 52.394484 ],
        'bottom_right': [ 1.180129, 51.143628 ]
      }
    },
    filterUSA = {
      location: {
        'top_left': '-125.074754, 48.478867',
        'bottom_right': '-62.980026, 24.874640'
      }
    },
    filterUSA2 = {
      location: {
        'top_left': 'c0x5c',
        'bottom_right': 'ds7jw'
      }
    },
    locationgeoBoundingBoxgcmfj457fu10ffy7m4 = md5('locationgeoBoundingBoxgcmfj457fu10ffy7m4'),
    locationgeoBoundingBoxj042p0j0phsc9wnc4v = md5('locationgeoBoundingBoxj042p0j0phsc9wnc4v'),
    locationgeoBoundingBoxc0x5c7zzzds7jw7zzz = md5('locationgeoBoundingBoxc0x5c7zzzds7jw7zzz');


  before(function () {
    methods = new Methods({filtersTree: {}});
    return methods.geoBoundingBox(roomId, index, collection, filterEngland)
      .then(function () {
        return methods.geoBoundingBox(roomId, index, collection, filterEngland2);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, index, collection, filterEngland3);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, index, collection, filterUSA);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, index, collection, filterUSA2);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', function () {
    // Coordinates are geohashed to encode the function name
    // because we have many times the same coord in filters,
    // we must have only three functions (one for filterEngland, and two for filterUSA)

    should(Object.keys(methods.dsl.filtersTree[index][collection].fields.location)).have.length(3);
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxgcmfj457fu10ffy7m4]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxj042p0j0phsc9wnc4v]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxc0x5c7zzzds7jw7zzz]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxgcmfj457fu10ffy7m4].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxj042p0j0phsc9wnc4v].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxc0x5c7zzzds7jw7zzz].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct geoboundingbox arguments', function () {
    // test filterEngland
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxgcmfj457fu10ffy7m4].args).match({
      operator: 'geoBoundingBox',
      not: undefined,
      field: 'location',
      value: {
        top: -2.939744,
        left: 52.394484,
        right: 51.143628,
        bottom: 1.180129
      }
    });

    // test filterUSA
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxj042p0j0phsc9wnc4v].args).match({
      operator: 'geoBoundingBox',
      not: undefined,
      field: 'location',
      value: {
        top: 48.478867,
        left: -125.074754,
        right: -62.980026,
        bottom: 24.87464
      }
    });

    // test filterUSA2
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoBoundingBoxc0x5c7zzzds7jw7zzz].args).match({
      operator: 'geoBoundingBox',
      not: undefined,
      field: 'location',
      value: {
        top: -125.09033203125,
        left: 48.49365234375,
        right: 24.89501953125,
        bottom: -62.99560546875
      }
    });
  });

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoBoundingBox('foo', index, 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', function () {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        }
      };

    return should(methods.geoBoundingBox(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse coordinates' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    return Methods.__with__({
      addToFiltersTree: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.geoBoundingBox(roomId, index, collection, filterEngland)).be.rejectedWith('rejected');
    });
  });
});