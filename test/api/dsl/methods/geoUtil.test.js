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
    result = methods._geoUtil.constructPoint({ lat: -74.1, lon: 40.73 });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: { lat: -74.1, lon: 40.73 } }', function () {
    result = methods._geoUtil.constructPoint({ latLon: { lat: -74.1, lon: 40.73 }});
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: [ -74.1, 40.73 ] }', function () {
    result = methods._geoUtil.constructPoint({ latLon: [ -74.1, 40.73 ] });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });

  it('Point: form { latLon: "-74.1, 40.73" }', function () {
    result = methods._geoUtil.constructPoint({ latLon: '-74.1, 40.73' });
    should(result.lat).be.exactly(lat);
    should(result.lon).be.exactly(lon);
  });
  it('Point: geohash form', function () {
    result = methods._geoUtil.constructPoint({ latLon: 'dr5r9ydj2y73' });
    should(Math.round(result.lat)).be.exactly(Math.round(lon));
    should(Math.round(result.lon)).be.exactly(Math.round(lat));
  });
  it('should throw an error if bad coordinates are given', function () {
    try {
      result = methods._geoUtil.constructPoint('foo', 'bar', {});
      return false;
    } catch(err) {
      return true;
    }
  });
  it('Point: should handle a [0,0] coordinates', function () {
    result = methods._geoUtil.constructPoint({ lat: 0, lon: 0 });
    should(result.lat).be.exactly(0);
    should(result.lon).be.exactly(0);
  });


});