var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RealTimeResponseObject = require.main.require('lib/api/core/models/realTimeResponseObject'),
  TokenManager = require.main.require('lib/api/core/auth/tokenManager');

describe('Test: token manager core component', function (done) {
  var
    kuzzle,
    tokenManager;

  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.hotelClerk.customers = {
          'foobar': {
            'room1': {},
            'room2': {},
            'room3': {}
          }
        };
        done();
      })
      .catch(err => done(err));
  });

  beforeEach(function () {
    tokenManager = new TokenManager(kuzzle);
  });

  describe('#expire', function () {
    it('should force a token to expire when called', function () {
      tokenManager.tokenizedConnections.foobar = {
        expiresAt: Date.now() + 1000000
      };

      tokenManager.expire({_id: 'foobar'});

      should(tokenManager.tokenizedConnections.foobar.expiresAt).be.belowOrEqual(Date.now());
    });
  });

  describe('#checkTokensValidity', function () {
    var
      notification,
      rooms,
      connectionId,
      subscriptionsCleaned;

    before(function () {
      kuzzle.notifier.notify = (r, msg, id) => {
        rooms = r;
        notification = msg;
        connectionId = id;
      };

      kuzzle.hotelClerk.removeCustomerFromAllRooms = () => subscriptionsCleaned = true;
    });

    beforeEach(function () {
      notification = null;
      rooms = null;
      connectionId = '';
      subscriptionsCleaned = false;
    });

    it('should do nothing if no token has expired', function () {
      var stubTokens = {
        foo: {
          expiresAt: Date.now() + 1000000
        },
        bar: {
          expiresAt: Date.now() + 1000000
        }
      };

      tokenManager.tokenizedConnections = stubTokens;

      tokenManager.checkTokensValidity();

      should(notification).be.null();
      should(subscriptionsCleaned).be.false();
      should(tokenManager.tokenizedConnections).be.eql(stubTokens);
    });

    it('should clean up subscriptions upon a token expiration', function () {
      var
        stubTokens = {
          foo: {
            expiresAt: Date.now() - 1000,
            connection: {
              id: 'foobar'
            }
          },
          bar: {
            expiresAt: Date.now() + 1000000
          }
        };

      tokenManager.tokenizedConnections = stubTokens;

      tokenManager.checkTokensValidity();

      should(subscriptionsCleaned).be.true();
      should(rooms).match(['room1', 'room2', 'room3']);
      should(connectionId).be.eql('foobar');
      should(notification).be.instanceof(RealTimeResponseObject);
      should(notification.roomId).be.eql(rooms);
      should(notification.requestId).be.eql('server notification');
      should(notification.controller).be.eql('auth');
      should(notification.action).be.eql('jwtTokenExpired');
      should(tokenManager.tokenizedConnections.foo).be.undefined();
      should(tokenManager.tokenizedConnections.bar).be.eql(stubTokens.bar);
    });

    it('should behave correctly if the token does not match any subscription', function () {
      var
        stubTokens = {
          foo: {
            expiresAt: Date.now() - 1000,
            connection: {
              id: 'barfoo'
            }
          },
          bar: {
            expiresAt: Date.now() + 1000000
          }
        };

      tokenManager.tokenizedConnections = stubTokens;

      tokenManager.checkTokensValidity();

      should(subscriptionsCleaned).be.false();
      should(notification).be.null();
      should(tokenManager.tokenizedConnections.foo).be.undefined();
      should(tokenManager.tokenizedConnections.bar).be.eql(stubTokens.bar);
    });
  });
});
