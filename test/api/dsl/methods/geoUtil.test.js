var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  KuzzleError = require.main.require('kuzzle-common-objects').Errors.kuzzleError,
  geohash = require('ngeohash');



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

  it('Point: form { latLon: "40.73, -74.1" }', function () {
    result = methods.__get__('geoUtil').constructPoint({ latLon: '40.73, -74.1' });
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

  it ('getDistance: should handle strings with no space like "1km"', function () {
    result = methods.__get__('geoUtil').getDistance('1km');
    should(result).be.exactly(1000);
  });

  it ('Polygon: should throw an error if some points are in a non valid format (bad point)', function () {
    var
      polygon = {
        points: [
          [0,0],
          [0,1],
          [0]
        ]
      };

    try {
      result = methods.__get__('geoUtil').constructPolygon(polygon);
      return false;
    } catch(err) {
      return true;
    }

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
  
  it ('Polygon: should handle correctly all points format (string)', function () {
    var
      polygon = {
        points: [
          [0,0],
          {lon: 1, lat: 2},
          '0,0',
          geohash.encode(2,2)
        ]
      };

    try {
      result = methods.__get__('geoUtil').constructPolygon(polygon);
      return true;
    } catch(err) {
      return false;
    }
  });
  
  it ('Polygon: should handle correctly all points format (string)', function () {
    var
      polygon = {
        points: [
          [0,0],
          {lon: 1, lat: 2},
          '2,1',
          geohash.encode(2,2)
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