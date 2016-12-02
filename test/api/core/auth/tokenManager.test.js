var
  should = require('should'),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  TokenManager = require('../../../../lib/api/core/auth/tokenManager');

describe('Test: token manager core component', () => {
  var
    kuzzle,
    token,
    contextStub,
    tokenManager;

  before(() => {
    kuzzle = new Kuzzle();
    kuzzle.hotelClerk.customers = {
      'foobar': {
        'room1': {},
        'room2': {},
        'room3': {}
      }
    };
    contextStub = {connection: {id: 'foobar'}};
  });

  beforeEach(() => {
    tokenManager = new TokenManager(kuzzle);
    token = {_id: 'foobar', expiresAt: Date.now()+1000};
  });


  afterEach(() => {
    if (tokenManager.timer) {
      clearTimeout(tokenManager.timer);
    }
  });

  describe('#add', () => {
    it('should not add a token if the context does not contain a connection object', () => {
      should(tokenManager.add(token, {})).be.false();
    });

    it('should not add a token if the context connection does not contain an id', () => {
      should(tokenManager.add(token, {connection: {}}));
    });

    it('should add the token if the context is properly formatted', () => {
      should(tokenManager.add(token, contextStub)).be.true();
      should(tokenManager.tokens.array).be.an.Array().and.not.be.empty();
      should(tokenManager.tokens.array[0]).match(token);
    });
  });

  describe('#expire', () => {
    it('should force a token to expire when called', () => {
      tokenManager.add(token, contextStub);
      should(tokenManager.tokens.array[0]).match(token);

      should(tokenManager.expire(token)).be.true();
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
    });

    it('should do nothing if the provided token is invalid', () => {
      should(tokenManager.expire({_id: 'foo'})).be.false();
      should(tokenManager.expire({expiresAt: 'foo'})).be.false();
      should(tokenManager.expire({bar: 'foo'})).be.false();
    });

    it('should do nothing if the provided token has not been previously registered', () => {
      should(tokenManager.expire(token)).be.false();
    });
  });

  describe('#checkTokensValidity', () => {
    var
      notification,
      rooms,
      connectionId,
      subscriptionsCleaned;

    before(() => {
      kuzzle.notifier.notify = (r, msg, cont, id) => {
        rooms = r;
        notification = msg;
        connectionId = id;
      };

      kuzzle.hotelClerk.removeCustomerFromAllRooms = () => {subscriptionsCleaned = true; return Promise.resolve();};
    });

    beforeEach(() => {
      notification = null;
      rooms = null;
      connectionId = '';
      subscriptionsCleaned = false;
    });

    it('should do nothing if no token has expired', () => {
      var
        now = Date.now(),
        stubTokens = [
          {
            _id: 'bar',
            expiresAt: now + 1000000
          },
          {
            _id: 'foo',
            expiresAt: now + 1000000
          }
        ];

      stubTokens.forEach(t => tokenManager.add(t, contextStub));

      tokenManager.checkTokensValidity();

      should(notification).be.null();
      should(subscriptionsCleaned).be.false();
      should(tokenManager.tokens.array.length).be.eql(2);
      should(tokenManager.tokens.array).match(stubTokens);
    });

    it('should clean up subscriptions upon a token expiration', () => {
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
      should(notification).be.instanceof(Request);
      should(notification.requestId).be.eql('server notification');
      should(notification.controller).be.eql('auth');
      should(notification.action).be.eql('jwtTokenExpired');
      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]).match(stubTokens.bar);
    });

    it('should behave correctly if the token does not match any subscription', () => {
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
      should(notification).be.null();
      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]).match(stubTokens.bar);
    });
  });
});