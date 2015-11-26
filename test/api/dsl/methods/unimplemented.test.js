var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  KuzzleError = require.main.require('lib/api/core/errors/kuzzleError');

require('should-promised');

describe('Test unimplemented methods', function () {
  it('geoPolygon call should return a rejected promise', function () {
    should(methods.geoPolygon()).be.rejectedWith(KuzzleError, {message: 'geoPolygon is not implemented yet.'});
  });
  it('geoShape call should return a rejected promise', function () {
    should(methods.geoShape()).be.rejectedWith(KuzzleError, {message: 'geoShape is not implemented yet.'});
  });
  it('regexp call should return a rejected promise', function () {
    should(methods.regexp()).be.rejectedWith(KuzzleError, {message: 'regexp is not implemented yet.'});
  });
});