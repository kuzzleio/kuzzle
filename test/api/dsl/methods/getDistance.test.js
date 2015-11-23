var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError');

require('should-promised');

describe('Test geoDistance method', function () {
  var
    roomId = 'roomId',
    collection = 'collection',
    document = {
      name: 'Zero',
      'location.lat': 0, // we can't test with nested document here
      'location.lon': 0
    },
    // realDistance: 111319.491,
    // distA: 111318,
    // distB: 111320,

    filterExact = {
      location: {
        lat: 0,
        lon: 1,
      },
      distance: 111318
    },
    filterOK = {
      location: {
        lat: 0,
        lon: 1,
      },
      distance: 111320
    },
    filterTooFar = {
      location: {
        lat: 0,
        lon: 1,
      },
      distance: 111317
    },
    filterOkHumanReadable = {
      location: {
        lat: 0,
        lon: 1,
      },
      distance: '365 219,816 Ft'
    };

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.geoDistance(roomId, collection, filterExact)
      .then(function () {
        return methods.geoDistance(roomId, collection, filterOK);
      })
      .then(function () {
        return methods.geoDistance(roomId, collection, filterTooFar);
      })
      .then(function () {
        return methods.geoDistance(roomId, collection, filterOkHumanReadable);
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
    // we must have only four functions
    
    should(Object.keys(methods.dsl.filtersTree[collection].fields.location)).have.length(4);
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111318).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111320).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111317).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location['locationgeoDistancekpbxyzbpv111318.9999168']).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111318.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111320.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111317.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location['locationgeoDistancekpbxyzbpv111318.9999168'].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions geodistance', function () {
    var result;

    // test exact
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111318.fn(document);
    should(result).be.exactly(true);

    // test ok
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111320.fn(document);
    should(result).be.exactly(true);

    // test too far
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistancekpbxyzbpv111317.fn(document);
    should(result).be.exactly(false);

    // test human readable distance
    result = methods.dsl.filtersTree[collection].fields.location['locationgeoDistancekpbxyzbpv111318.9999168'].fn(document);
    should(result).be.exactly(true);

  });

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoDistance('foo', 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', function () {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        },
        distance: 123
      };

    return should(methods.geoDistance(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse coordinates' });
  });

  it('should return a rejected promise if the distance filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        }
      };

    return should(methods.geoDistance(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No distance given' });
  });

  it('should return a rejected promise if the distance filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        distance: 'bad bad bad'
      };

    return should(methods.geoDistance(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse the distance filter parameter' });
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.geoDistance(roomId, collection, filterOK)).be.rejectedWith('rejected');
    });
  });
});