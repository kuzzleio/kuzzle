var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  KuzzleError = require.main.require('lib/api/core/errors/kuzzleError');



describe('Test unimplemented methods', function () {
  it('geoShape call should return a rejected promise', function () {
    should(methods.geoShape()).be.rejectedWith(KuzzleError, {message: 'geoShape is not implemented yet.'});
  });
  it('regexp call should return a rejected promise', function () {
    should(methods.regexp()).be.rejectedWith(KuzzleError, {message: 'regexp is not implemented yet.'});
  });
});