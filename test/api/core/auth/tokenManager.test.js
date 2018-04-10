const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Token = require('../../../../lib/api/core/models/security/token'),
  TokenManager = require('../../../../lib/api/core/auth/tokenManager');

describe('Test: token manager core component', () => {
  let
    kuzzle,
    token,
    tokenManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    tokenManager = new TokenManager(kuzzle);
    token = new Token({
      _id: 'foo#bar',
      userId: 'foo',
      jwt: 'bar',
      expiresAt: Date.now()+1000
    });
  });


  afterEach(() => {
    if (tokenManager.timer) {
      clearTimeout(tokenManager.timer);
    }
  });

  describe('#link', () => {
    it('should not add a link to an anonymous token', () => {
      tokenManager.link(kuzzle.repositories.token.anonymous(), 'foo', 'bar');
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
    });

    it('should link the provided room ID to a new entry if this is the first subscription with this token', () => {
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(token, 'foo', 'bar');
      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionId: 'foo',
          expiresAt: token.expiresAt,
          userId: token.userId,
          rooms: new Set(['bar'])
        }])
        .and.have.length(1);

      should(runTimerStub).be.calledOnce();
    });

    it('should add the room ID to the list if an entry already exists for this token', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['bar'])
      });

      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(token, 'foo', 'bar2');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionId: 'foo',
          expiresAt: token.expiresAt,
          userId: token.userId,
          rooms: new Set(['bar', 'bar2'])
        }])
        .and.have.length(1);

      should(runTimerStub).not.be.called();
    });

    it('should not start a new timer if the new token is not the next one to expire', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['bar'])
      });

      const 
        runTimerStub = sinon.stub(tokenManager, 'runTimer'),
        tokenAfter = new Token({
          _id: 'foo2#bar2',
          userId: 'foo2',
          jwt: 'bar2',
          expiresAt: Date.now()+10000
        });

      tokenManager.link(tokenAfter, 'foo2', 'bar2');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionId: 'foo',
          expiresAt: token.expiresAt,
          userId: token.userId,
          rooms: new Set(['bar'])
        }, {
          idx: `${tokenAfter.expiresAt};${tokenAfter._id}`,
          connectionId: 'foo2',
          expiresAt: tokenAfter.expiresAt,
          userId: tokenAfter.userId,
          rooms: new Set(['bar2'])
        }])
        .and.have.length(2);

      should(runTimerStub).not.be.called();
    });
  });

  describe('#expire', () => {
    it('should force a token to expire when called', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['bar'])
      });

      tokenManager.expire(token);
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).be.calledOnce();
    });

    it('should do nothing if the provided token is from the anonymous user', () => {
      const 
        anon = kuzzle.repositories.token.anonymous(),
        // manually insert the anonymous token in the manager
        // should never happen in real-life scenarios (see UTs above)
        fakeEntry = {
          idx: `${anon.expiresAt};${anon._id}`,
          connectionId: 'foo',
          expiresAt: anon.expiresAt,
          userId: anon.userId,
          rooms: new Set(['bar'])
        };

      tokenManager.tokens.insert(fakeEntry);

      tokenManager.expire(anon);

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([fakeEntry])
        .and.have.length(1);

    });

    it('should do nothing if the provided token has not been previously registered', () => {
      const token2 = new Token({
        _id: 'foo2#bar2',
        userId: 'foo2',
        jwt: 'bar2',
        expiresAt: Date.now()+1000
      });

      tokenManager.tokens.array.push(token);
      tokenManager.expire(token2);

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.have.length(1);
    });
  });

  describe('#checkTokensValidity', () => {
    it('should do nothing if no token has expired', () => {
      const 
        expiresAt = Date.now() + 1000000,
        runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(new Token({_id: 'bar', expiresAt}), 'connectionId1', 'roomId1');
      tokenManager.link(new Token({_id: 'foo', expiresAt}), 'connectionId2', 'roomId2');

      runTimerStub.resetHistory();
      tokenManager.checkTokensValidity();

      should(kuzzle.notifier.notifyServer).not.be.called();
      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).not.be.called();
      should(tokenManager.tokens.array).have.length(2);
      should(runTimerStub).be.calledOnce();
    });

    it('should clean up subscriptions upon a token expiration', () => {
      const 
        now = Date.now(),
        runTimerStub = sinon.stub(tokenManager, 'runTimer');

      kuzzle.hotelClerk.customers = {
        connectionId2: {
          room1: true,
          room2: true
        },
        connectionId1: {
          room3: true
        }
      };

      tokenManager.link(new Token({_id: 'bar', expiresAt: now + 1000000}), 'connectionId1', 'roomId1');
      tokenManager.link(new Token({_id: 'foo', expiresAt: now - 1000}), 'connectionId2', 'roomId2');

      runTimerStub.resetHistory();
      tokenManager.checkTokensValidity();

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).be.calledOnce();
      should(kuzzle.notifier.notifyServer)
        .be.calledOnce()
        .be.calledWith(['room1', 'room2'], 'connectionId2', 'TokenExpired', 'Authentication Token Expired');

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]._id).be.eql('bar');
      should(runTimerStub).be.calledOnce();
    });

    it('should behave correctly if the token does not match any subscription', () => {
      const 
        now = Date.now(),
        runTimerStub = sinon.stub(tokenManager, 'runTimer');

      kuzzle.hotelClerk.customers = {};

      tokenManager.link(new Token({_id: 'bar', expiresAt: now + 1000000}), 'connectionId1', 'roomId1');
      tokenManager.link(new Token({_id: 'foo', expiresAt: now - 1000}), 'connectionId2', 'roomId2');

      runTimerStub.resetHistory();
      tokenManager.checkTokensValidity();

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).not.be.called();
      should(kuzzle.notifier.notifyServer).not.be.called();

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]._id).be.eql('bar');
      should(runTimerStub).be.calledOnce();
    });

    it('should not rerun a timer if the last token has been removed', () => {
      const 
        now = Date.now(),
        runTimerStub = sinon.stub(tokenManager, 'runTimer');

      kuzzle.hotelClerk.customers = {};

      tokenManager.link(new Token({_id: 'foo', expiresAt: now - 1000}), 'connectionId2', 'roomId2');

      runTimerStub.resetHistory();
      tokenManager.checkTokensValidity();

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(runTimerStub).not.be.called();
    });
  });

  describe('#unlink', () => {
    it('should not try to unlink an anonymous token', () => {
      const 
        anon = kuzzle.repositories.token.anonymous(),
        // manually insert the anonymous token in the manager
        // should never happen in real-life scenarios (see UTs above)
        fakeEntry = {
          idx: `${anon.expiresAt};${anon._id}`,
          connectionId: 'foo',
          expiresAt: anon.expiresAt,
          userId: anon.userId,
          rooms: new Set(['bar'])
        };

      tokenManager.tokens.insert(fakeEntry);

      tokenManager.unlink(anon, 'bar');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([fakeEntry])
        .and.have.length(1);
    });

    it('should not try to unlink a non-existing token', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['bar'])
      });

      tokenManager.unlink(new Token({_id: 'i am the beyonder'}), 'bar');
      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.have.length(1);
    });

    it('should remove only the provided room ID from the entry', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['foo', 'bar', 'baz'])
      });

      tokenManager.unlink(token, 'bar');
      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionId: 'foo',
          expiresAt: token.expiresAt,
          userId: token.userId,
          rooms: new Set(['foo', 'baz'])
        }])
        .and.have.length(1);
    });

    it('should also remove the entry if the last linked room ID is removed', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionId: 'foo',
        expiresAt: token.expiresAt,
        userId: token.userId,
        rooms: new Set(['foo', 'bar', 'baz'])
      });

      tokenManager.unlink(token, 'bar');
      tokenManager.unlink(token, 'foo');
      tokenManager.unlink(token, 'baz');

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
    });
  });
});
