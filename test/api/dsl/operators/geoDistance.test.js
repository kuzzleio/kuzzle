var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test "geoDistance" operator', () => {
  var
    field = 'location',
    document = {
      name: 'Zero',
      'location.lat': 0,
      'location.lon': 0
    },
    valueExact = {
      lat: 0,
      lon: 1,
      distance: 111318
    },
    valueOK = {
      lat: 0,
      lon: 1,
      distance: 111320
    },
    valueTooFar = {
      lat: 0,
      lon: 1,
      distance: 111317
    };

  it('should test geodistance correctly', () => {
    // exact distance
    should(operators.geoDistance(field, valueExact, document)).be.true();

    // ok
    should(operators.geoDistance(field, valueOK, document)).be.true();

    // too far
    should(operators.geoDistance(field, valueTooFar, document)).be.false();
  });

  it('should ignore documents without latitude coordinate', () => {
    var doc = {
      name: 'Zero',
      'location.lon': 0
    };

    should(operators.geoDistance(field, valueOK, doc)).be.false();
  });

  it('should ignore documents without longitude coordinate', () => {
    var doc = {
      name: 'Zero',
      'location.lat': 0
    };

    should(operators.geoDistance(field, valueOK, doc)).be.false();
  });
});
