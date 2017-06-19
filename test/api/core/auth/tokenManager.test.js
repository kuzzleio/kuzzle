const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  TokenManager = require('../../../../lib/api/core/auth/tokenManager');

describe('Test: token manager core component', () => {
  let
    kuzzle,
    token,
    contextStub,
    tokenManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.hotelClerk.customers = {
      'connectionId': {
        'room1': {},
        'room2': {},
        'room3': {}
      }
    };
    contextStub = new RequestContext({
      connectionId: 'connectionId'
    });

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
      should(tokenManager.add(token, {connectionId: null})).be.false();
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

    it('should do nothing if no token has expired', () => {
      const
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

      should(kuzzle.notifier.notifyServer)
        .have.callCount(0);
      should(kuzzle.hotelClerk.removeCustomerFromAllRooms)
        .have.callCount(0);

      should(tokenManager.tokens.array.length).be.eql(2);
      should(tokenManager.tokens.array).match(stubTokens);
    });

    it('should clean up subscriptions upon a token expiration', () => {
      const
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

      kuzzle.hotelClerk.customers.connectionId = {
        room1: true,
        room2: true,
        room3: true
      };

      Object.keys(stubTokens).forEach(k => tokenManager.add(stubTokens[k], contextStub));

      tokenManager.checkTokensValidity();

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms)
        .be.calledOnce();
      should(kuzzle.notifier.notifyServer)
        .be.calledOnce()
        .be.calledWith(['room1', 'room2', 'room3'], 'connectionId', 'TokenExpired', 'Authentication Token Expired');

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]).match(stubTokens.bar);
    });

    it('should behave correctly if the token does not match any subscription', () => {
      const
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

      contextStub = new RequestContext({
        connectionId: 'i dont exist'
      });
      Object.keys(stubTokens).forEach(k => tokenManager.add(stubTokens[k], contextStub));

      tokenManager.checkTokensValidity();

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms)
        .have.callCount(0);
      should(kuzzle.notifier.notifyServer)
        .have.callCount(0);

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]).match(stubTokens.bar);
    });
  });
});
