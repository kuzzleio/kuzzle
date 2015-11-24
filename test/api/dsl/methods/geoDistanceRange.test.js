var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError');

require('should-promised');

describe('Test geoDistanceRangeRange method', function () {
  var
    roomId = 'roomId',
    collection = 'collection',
    document = {
      name: 'Zero',
      'location.lat': 0, // we can't test with nested document here
      'location.lon': 0
    },

    filterOK = {
      location: {
        lat: 0,
        lon: 1,
      },
      from: 111320,
      to: 111317
    },
    filterNOK = {
      location: {
        lat: 0,
        lon: 1,
      },
      from: 1,
      to: 10
    },
    filterOkHumanReadable = {
      location: {
        lat: 0,
        lon: 1,
      },
      from: '365 200 Ft',
      to: '365 220 Ft'
    },
    filterEqual = {
      location: {
        lat: 0,
        lon: 1,
      },
      from: 111318,
      to: 111318
    };

  before(function () {
    methods.dsl.filtersTree = {};
    return methods.geoDistanceRange(roomId, collection, filterOK)
      .then(function () {
        return methods.geoDistanceRange(roomId, collection, filterNOK);
      })
      .then(function () {
        return methods.geoDistanceRange(roomId, collection, filterOkHumanReadable);
      })
      .then(function () {
        return methods.geoDistanceRange(roomId, collection, filterEqual);
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
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111320111317).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv110).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111318111318).not.be.empty();
    should(methods.dsl.filtersTree[collection].fields.location['locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001']).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111320111317.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv110.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111318111318.rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[collection].fields.location['locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001'].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);
  });

  it('should construct the filterTree with correct functions geoDistanceRange', function () {
    var result;

    // test ok
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111320111317.fn(document);
    should(result).be.exactly(true);

    // test not ok
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv110.fn(document);
    should(result).be.exactly(false);

    // test human readable distance
    result = methods.dsl.filtersTree[collection].fields.location.locationgeoDistanceRangekpbxyzbpv111318111318.fn(document);
    should(result).be.exactly(true);

    // test from == to
    result = methods.dsl.filtersTree[collection].fields.location['locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001'].fn(document);
    should(result).be.exactly(true);

  });

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoDistanceRange('foo', 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', function () {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        },
        from: 123,
        to: 133
      };

    return should(methods.geoDistanceRange(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse coordinates' });
  });

  it('should return a rejected promise if the from filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        to: 123
      };

    return should(methods.geoDistanceRange(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No from parameter given' });
  });

  it('should return a rejected promise if the to filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        from: 123
      };

    return should(methods.geoDistanceRange(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No to parameter given' });
  });

  it('should return a rejected promise if the distance filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        from: 'bad bad bad',
        to: 'bad bad bad'
      };

    return should(methods.geoDistanceRange(roomId, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse the distance filter parameter' });
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.geoDistanceRange(roomId, collection, filterOK)).be.rejectedWith('rejected');
    });
  });
});