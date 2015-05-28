var
  should = require('should'),
  methods = require('root-require')('lib/api/dsl/methods');

describe('Test not method', function () {

  var
    roomId = 'roomId',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      location: {
        lat: 32.692742,
        lon: -97.114127
      }
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      location: {
        lat: 51.519291,
        lon: -0.149817
      }
    },

    // Test all supported formats
    filterEngland = {
      location: {
        top: 52.394484,
        left: -2.939744,
        bottom: 51.143628,
        right: 1.180129
      }
    },
    filterEngland2 = {
      location: {
        'top_left': {
          lat: -2.939744,
          lon: 52.394484
        },
        'bottom_right': {
          lat: 1.180129,
          lon: 51.143628
        }
      }
    },
    filterEngland3 = {
      location: {
        'top_left': [52.394484, -2.939744],
        'bottom_right': [51.143628, 1.180129]
      }
    },
    filterUSA = {
      location: {
        'top_left': '48.478867, -125.074754',
        'bottom_right': '24.874640, -62.980026'
      }
    },
    filterUSA2 = {
      location: {
        'top_left': 'c0x5c',
        'bottom_right': 'ds7jw'
      }
    };


  before(function () {
    methods.dsl.filtersTree = {};
    return methods.geoBoundingBox(roomId, collection, filterEngland)
      .then(function () {
        return methods.geoBoundingBox(roomId, collection, filterEngland2);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, collection, filterEngland3);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, collection, filterUSA);
      })
      .then(function () {
        return methods.geoBoundingBox(roomId, collection, filterUSA2);
      });
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty;
    should(methods.dsl.filtersTree[collection]).not.be.empty;
    should(methods.dsl.filtersTree[collection].location).not.be.empty;
  });

  it('should construct the filterTree with correct curried function name', function () {
    // Coord are geoashed for build the curried function name
    // because we have many times the same coord in filters,
    // we must have only three functions (one for filterEngland, and two for filterUSA)
    should(Object.keys(methods.dsl.filtersTree[collection].location)).have.length(3);
    should(methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxmpmr22b6xt0hqeycds).not.be.empty;
    should(methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxj042p0j0phsc9wnc4v).not.be.empty;
    should(methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz).not.be.empty;
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxmpmr22b6xt0hqeycds.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxj042p0j0phsc9wnc4v.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.rooms;
    should(rooms).be.an.Array;
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions geoboundingbox', function () {
    var result;

    // test filterEngland
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxmpmr22b6xt0hqeycds.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxmpmr22b6xt0hqeycds.fn(documentAda);
    should(result).be.exactly(true);

    // test filterUSA
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxj042p0j0phsc9wnc4v.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxj042p0j0phsc9wnc4v.fn(documentAda);
    should(result).be.exactly(false);

    // test filterUSA2
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.fn(documentAda);
    should(result).be.exactly(false);
  });

});