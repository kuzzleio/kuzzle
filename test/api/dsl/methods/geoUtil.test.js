var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  KuzzleError = require.main.require('lib/api/core/errors/kuzzleError');

require('should-promised');

describe('Test geoUtil methods included in the DSL methods file', function () {
  var result,
    lat = -74.1,
    lon = 40.73;

  it('Point: form { lat: -74.1, lon: 40.73 }', function () {
    result = methods.__get__('geoUtil').constructPoint({ lat: -74.1, lon: 40.73 });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: { lat: -74.1, lon: 40.73 } }', function () {
    result = methods.__get__('geoUtil').constructPoint({ latLon: { lat: -74.1, lon: 40.73 }});
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: [ -74.1, 40.73 ] }', function () {
    result = methods.__get__('geoUtil').constructPoint({ latLon: [ -74.1, 40.73 ] });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: "-74.1, 40.73" }', function () {
    result = methods.__get__('geoUtil').constructPoint({ latLon: '-74.1, 40.73' });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });
  it('Point: geohash form', function () {
    result = methods.__get__('geoUtil').constructPoint({ latLon: 'dr5r9ydj2y73' });
    should(Math.round(result.lat)).be.exactly(Math.round(lon));
    should(Math.round(result.lon)).be.exactly(Math.round(lat));
  });
  it('should throw an error if bad coordinates are given', function () {
    try {
      result = methods.__get__('geoUtil').constructPoint('foo', 'bar', {});
      return false;
    } catch(err) {
      return true;
    }
  });
  it('Point: should handle a [0,0] coordinates', function () {
    result = methods.__get__('geoUtil').constructPoint({ lat: 0, lon: 0 });
    should(result.lat).be.exactly(0);
    should(result.lon).be.exactly(0);
  });

  it ('getDistance: should handle localized string like "365 219,816 Ft"', function () {
    result = methods.__get__('geoUtil').getDistance('365 219,816 Ft');
    should(result).be.exactly(111318.9999168);
  });

  it ('Polygon: should throw an error if some points are in a non valid format (bad array of coordinates)', function () {
    var
      polygon = {
        points: [
          [0,0],
          [0,'foo']
        ]
      };

    try {
      result = methods.__get__('geoUtil').constructPolygon(polygon);
      return false;
    } catch(err) {
      console.log(err);
      return true;
    }

  });

  it ('Polygon: should throw an error if some points are in a non valid format (bad object)', function () {
    var
      polygon = {
        points: [
          [0,0],
          {foo: 'bar'}
        ]
      };

    try {
      result = methods.__get__('geoUtil').constructPolygon(polygon);
      return false;
    } catch(err) {
      return true;
    }
  });
  it ('Polygon: should throw an error if some points are in a non valid format (string)', function () {
    var
      polygon = {
        points: [
          [0,0],
          'a,b'
        ]
      };

    try {
      result = methods.__get__('geoUtil').constructPolygon(polygon);
      return false;
    } catch(err) {
      return true;
    }
  });
});