var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test "geoPolygon" operator', () => {
  var
    field = 'location',
    valueInside = [
      { lat: -1, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: -1 },
      { lat: -1, lon: -1 } ],
    valueOutside = [
      { lat: 10, lon: 11 },
      { lat: 11, lon: 11 },
      { lat: 11, lon: 10 },
      { lat: 10, lon: 10 }
    ],
    valueExact = [
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
      { lat: 0, lon: 0 }
    ],
    document = {
      name: 'Zero',
      'location.lat': 0, // we can't test with nested document here
      'location.lon': 0
    };

  it('should ignore documents without latitude or longitude', () => {
    should(operators.geoPolygon(field, valueInside, {
      name: 'No',
      'location.lat': 0
    })).be.false();

    should(operators.geoPolygon(field, valueInside, {
      name: 'Just... No',
      'location.lon': 0
    })).be.false();
  });

  it('should test polygons correctly', () => {
    should(operators.geoPolygon(field, valueInside, document)).be.true();
    should(operators.geoPolygon(field, valueExact, document)).be.true();
    should(operators.geoPolygon(field, valueOutside, document)).be.false();
  });
});
