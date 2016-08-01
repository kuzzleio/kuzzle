var
  should = require('should'),
  rewire = require('rewire'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  KuzzleError = require.main.require('kuzzle-common-objects').Errors.kuzzleError;

describe('Test unimplemented methods', () => {
  var methods;

  before(() => {
    methods = new Methods({filtersTree: {}});
  });
  
  it('geoShape call should return a rejected promise', () => {
    should(methods.geoShape()).be.rejectedWith(KuzzleError, {message: 'geoShape is not implemented yet.'});
  });
});
