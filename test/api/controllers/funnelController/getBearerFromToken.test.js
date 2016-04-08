var
  should = require('should'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('#getBearerTokenFromHeaders', () => {
  var
    getBearerTokenFromHeader = FunnelController.__get__('getBearerTokenFromHeaders');

  it('should extract the bearer token from the header', () => {
    var result = getBearerTokenFromHeader({
      authorization: 'Bearer sometoken'
    });

    should(result).be.exactly('sometoken');
  });
});
