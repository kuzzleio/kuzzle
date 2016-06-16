var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  NotificationObject = require.main.require('lib/api/core/models/notificationObject'),
  TokenManager = require.main.require('lib/api/core/auth/tokenManager');

describe('Test: token manager core component', function () {
  var
    kuzzle,
    token,
    contextStub,
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

        contextStub = {connection: {id: 'foobar'}};
        done();
      })
      .catch(err => done(err));
  });

  beforeEach(function () {
    tokenManager = new TokenManager(kuzzle);
    token = {_id: 'foobar', expiresAt: Date.now()+1000};
  });

  describe('#add', function () {
    it('should not add a token if the context does not contain a connection object', function () {
      tokenManager.add(token, {});
      should(tokenManager.tokenizedConnections.foobar).be.eql(undefined);
    });

    it('should not add a token if the context connection does not contain an id', function () {
      tokenManager.add(token, {connection: {}});
      should(tokenManager.tokenizedConnections.foobar).be.eql(undefined);
    });

    it('should add the token if the context is properly formatted', function () {
      tokenManager.add(token, contextStub);
      should(tokenManager.tokenizedConnections.foobar).be.an.Object();
      should(tokenManager.tokenizedConnections.foobar.expiresAt).be.eql(token.expiresAt);
      should(tokenManager.tokenizedConnections.foobar.connection).be.eql(contextStub.connection);
    });
  });

  describe('#add', function () {
    var anotherToken;

    beforeEach(function () {
      anotherToken = {_id: 'foobar', expiresAt: Date.now()+1000};
    });

    it('should not add a token if the context does not contain a connection object', function () {
      tokenManager.add(anotherToken, {});
      should(tokenManager.tokenizedConnections.foobar).be.eql(undefined);
    });

    it('should not add a token if the context connection does not contain an id', function () {
      tokenManager.add(anotherToken, {connection: {}});
      should(tokenManager.tokenizedConnections.foobar).be.eql(undefined);
    });

    it('should add the token if the context is properly formatted', function () {
      var
        context = {connection: {id: 'foo'}};
      
      tokenManager.add(anotherToken, context);
      should(tokenManager.tokenizedConnections.foobar).be.an.Object();
      should(tokenManager.tokenizedConnections.foobar.expiresAt).be.eql(anotherToken.expiresAt);
      should(tokenManager.tokenizedConnections.foobar.connection).be.eql(context.connection);
    });
  });

  describe('#expire', function () {
    it('should force a token to expire when called', function () {
      tokenManager.add(token, contextStub);
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

      kuzzle.hotelClerk.removeCustomerFromAllRooms = () => {subscriptionsCleaned = true;};
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
          _id: 'foo',
          expiresAt: Date.now() + 1000000
        },
        bar: {
          _id: 'bar',
          expiresAt: Date.now() + 1000000
        }
      };

      Object.keys(stubTokens).forEach(k => tokenManager.add(stubTokens[k], contextStub));

      tokenManager.checkTokensValidity();

      should(notification).be.eql(null);
      should(subscriptionsCleaned).be.false();
      should(tokenManager.tokenizedConnections.foo).match({expiresAt: stubTokens.foo.expiresAt, connection: contextStub.connection});
      should(tokenManager.tokenizedConnections.bar).match({expiresAt: stubTokens.bar.expiresAt, connection: contextStub.connection});
    });

    it('should clean up subscriptions upon a token expiration', function () {
      var
        stubTokens = {
          foo: {
            _id: 'foo',
            expiresAt: Date.now() - 1000
          },
          bar: {
            _id: 'bar',
            expiresAt: Date.now() + 1000000
          }
        };

      Object.keys(stubTokens).forEach(k => tokenManager.add(stubTokens[k], contextStub));

      tokenManager.checkTokensValidity();

      should(subscriptionsCleaned).be.true();
      should(rooms).match(['room1', 'room2', 'room3']);
      should(connectionId).be.eql('foobar');
      should(notification).be.instanceof(NotificationObject);
      should(notification.roomId).be.eql(rooms);
      should(notification.requestId).be.eql('server notification');
      should(notification.controller).be.eql('auth');
      should(notification.action).be.eql('jwtTokenExpired');
      should(tokenManager.tokenizedConnections.foo).be.eql(undefined);
      should(tokenManager.tokenizedConnections.bar).match({expiresAt: stubTokens.bar.expiresAt, connection: contextStub.connection});
    });

    it('should behave correctly if the token does not match any subscription', function () {
      var
        stubTokens = {
          foo: {
            _id: 'foo',
            expiresAt: Date.now() - 1000
          },
          bar: {
            _id: 'bar',
            expiresAt: Date.now() + 1000000
          }
        };

      contextStub = {connection: {id: 'this id matches nothing'}};
      Object.keys(stubTokens).forEach(k => tokenManager.add(stubTokens[k], contextStub));

      tokenManager.checkTokensValidity();

      should(subscriptionsCleaned).be.false();
      should(notification).be.eql(null);
      should(tokenManager.tokenizedConnections.foo).be.eql(undefined);
      should(tokenManager.tokenizedConnections.bar).match({expiresAt: stubTokens.bar.expiresAt, connection: contextStub.connection});
    });
  });
});