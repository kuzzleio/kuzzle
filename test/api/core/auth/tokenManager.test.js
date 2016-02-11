var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RealTimeResponseObject = require.main.require('lib/api/core/models/realTimeResponseObject'),
  TokenManager = require.main.require('lib/api/core/auth/tokenManager');

describe('Test: token manager core component', function () {
  var
    kuzzle,
    tokenManager;

  before(function (done) {
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

  describe('#add', function () {
    var token;

    beforeEach(function () {
      token = {_id: 'foobar', expiresAt: Date.now()+1000};
    });

    it('should not add a token if the context does not contain a connection object', function () {
      tokenManager.add(token, {});
      should(tokenManager.tokenizedConnections.foobar).be.undefined();
    });

    it('should not add a token if the context connection does not contain an id', function () {
      tokenManager.add(token, {connection: {}});
      should(tokenManager.tokenizedConnections.foobar).be.undefined();
    });

    it('should add the token if the context is properly formatted', function () {
      var
        context = {connection: {id: 'foo'}};
      
      tokenManager.add(token, context);
      should(tokenManager.tokenizedConnections.foobar).be.an.Object();
      should(tokenManager.tokenizedConnections.foobar.expiresAt).be.eql(token.expiresAt);
      should(tokenManager.tokenizedConnections.foobar.connection).be.eql(context.connection);
    });
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