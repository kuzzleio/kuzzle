var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  InternalError = require('../../../../lib/api/core/errors/internalError');

require('should-promised');

describe('Test geoboundingbox method', function () {
  var
    roomId = 'roomId',
    collection = 'collection',
    documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      'location.lat': 32.692742, // we can't test with nested document here
      'location.lon': -97.114127
    },
    documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      'location.lat': 51.519291,
      'location.lon': -0.149817
    },

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
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[collection]).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields).not.be.empty();

    should(methods.dsl.filtersTree[collection].fields.location).not.be.empty();
  });

  it('should construct the filterTree with correct curried function name', function () {
    // Coord are geoashed for build the curried function name
    // because we have many times the same coord in filters,
    // we must have only three functions (one for filterEngland, and two for filterUSA)

    should(Object.keys(methods.dsl.filtersTree[collection].fields.location)).have.length(3);
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxgcmfj457fu10ffy7m4).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5cc73fds7jwb737).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxgcmfj457fu10ffy7m4.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5cc73fds7jwb737.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions geoboundingbox', function () {
    var result;

    // test filterEngland
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxgcmfj457fu10ffy7m4.fn(documentGrace);
    should(result).be.exactly(false);
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxgcmfj457fu10ffy7m4.fn(documentAda);
    should(result).be.exactly(true);

    // test filterUSA
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5cc73fds7jwb737.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5cc73fds7jwb737.fn(documentAda);
    should(result).be.exactly(false);

    // test filterUSA2
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.fn(documentGrace);
    should(result).be.exactly(true);
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoBoundingBoxc0x5c7zzzds7jw7zzz.fn(documentAda);
    should(result).be.exactly(false);
  });

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoBoundingBox('foo', 'bar', {})).be.rejectedWith('Missing filter');
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

    return should(methods.geoBoundingBox(roomId, collection, invalidFilter)).be.rejectedWith('Unable to parse GeoBoundingBox coordinates');
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.geoBoundingBox(roomId, collection, filterEngland)).be.rejectedWith('rejected');
    });
  });
});