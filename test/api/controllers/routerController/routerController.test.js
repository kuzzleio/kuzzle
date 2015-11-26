var
  should = require('should'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController');

describe('Test: routerController', () => {
  var
    getBearerTokenFromHeader = RouterController.__get__('getBearerTokenFromHeaders');

  describe('#getBearerTokenFromHeaders', () => {
    it('should extract the bearer token from the header', () => {
      var result = getBearerTokenFromHeader({
        authorization: 'Bearer sometoken'
      });

      should(result).be.exactly('sometoken');
    });
  });
});
