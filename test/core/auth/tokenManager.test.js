'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Token = require('../../../lib/model/security/token');
const TokenManager = require('../../../lib/core/auth/tokenManager');

describe('Test: token manager core component', () => {
  const anonymousToken = new Token({ _id: '-1' });
  let kuzzle;
  let token;
  let tokenManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.ask
      .withArgs('core:security:user:anonymous:get')
      .resolves({_id: '-1'});

    tokenManager = new TokenManager(kuzzle);
    token = new Token({
      _id: 'foo#bar',
      expiresAt: Date.now()+1000,
      jwt: 'bar',
      userId: 'foo',
    });

    return tokenManager.init();
  });

  afterEach(() => {
    if (tokenManager.timer) {
      clearTimeout(tokenManager.timer);
    }
  });

  describe('#link', () => {
    it('should do nothing if the token is not set', () => {
      tokenManager.link(null, 'foo', 'bar');
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
    });

    it('should not add a link to an anonymous token', () => {
      tokenManager.link(anonymousToken, 'foo', 'bar');
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
    it('should force a token to expire when called', async () => {
      tokenManager._add(token, 'foo', ['bar']);

      await tokenManager.expire(token);
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(kuzzle.ask)
        .calledWith('core:realtime:user:remove', 'foo');
    });

    it('should do nothing if the provided token is from the anonymous user', async () => {
      // manually insert the anonymous token in the manager
      // should never happen in real-life scenarios (see UTs above)
      const fakeEntry = {
        idx: `${anonymousToken.expiresAt};${anonymousToken._id}`,
        connectionId: 'foo',
        expiresAt: anonymousToken.expiresAt,
        userId: anonymousToken.userId,
        rooms: new Set(['bar'])
      };

      tokenManager.tokens.insert(fakeEntry);

      await tokenManager.expire(anonymousToken);

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([fakeEntry])
        .and.have.length(1);
    });

    it('should do nothing if the provided token has not been previously registered', async () => {
      const token2 = new Token({
        _id: 'foo2#bar2',
        userId: 'foo2',
        jwt: 'bar2',
        expiresAt: Date.now()+1000
      });

      tokenManager.tokens.array.push(token);
      await tokenManager.expire(token2);

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.have.length(1);
    });
  });

  describe('#checkTokensValidity', () => {
    let clock;
    let tokenExpiredStub;

    beforeEach(() => {
      clock = sinon.useFakeTimers(new Date());
      tokenExpiredStub = kuzzle.ask
        .withArgs('core:realtime:tokenExpired:notify', sinon.match.string)
        .resolves();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should do nothing if no token has expired', async () => {
      const expiresAt = Date.now() + 1000000;
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(
        new Token({_id: 'bar', expiresAt}),
        'connectionId1',
        'roomId1');
      tokenManager.link(
        new Token({_id: 'foo', expiresAt}),
        'connectionId2',
        'roomId2');

      runTimerStub.resetHistory();
      await tokenManager.checkTokensValidity();

      should(tokenExpiredStub).not.be.called();
      should(tokenManager.tokens.array).have.length(2);
      should(runTimerStub).be.calledOnce();
    });

    it('should clean up subscriptions upon a token expiration', async () => {
      const now = Date.now();
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(
        new Token({_id: 'bar', expiresAt: now + 1000000}),
        'connectionId1',
        'roomId1');
      tokenManager.link(
        new Token({_id: 'foo', expiresAt: now - 1000}),
        'connectionId2',
        'roomId2');

      runTimerStub.resetHistory();
      await tokenManager.checkTokensValidity();

      clock.runAll();

      should(tokenExpiredStub)
        .be.calledOnce()
        .be.calledWith('core:realtime:tokenExpired:notify', 'connectionId2');

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]._id).be.eql('bar');
      should(runTimerStub).be.calledOnce();
    });

    it('should not expire API key', async () => {
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(
        new Token({_id: 'api-key-1', expiresAt: -1}),
        'connectionId1',
        'roomId1');

      runTimerStub.resetHistory();

      await tokenManager.checkTokensValidity();

      clock.runAll();

      should(tokenExpiredStub).not.be.called();

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]._id).be.eql('api-key-1');
      should(runTimerStub).be.calledOnce();
    });

    it('should not rerun a timer if the last token has been removed', async () => {
      const now = Date.now();
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(
        new Token({_id: 'foo', expiresAt: now - 1000}),
        'connectionId2',
        'roomId2');

      runTimerStub.resetHistory();
      await tokenManager.checkTokensValidity();

      clock.runAll();

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(runTimerStub).not.be.called();
    });
  });

  describe('#unlink', () => {
    it('should not try to unlink an anonymous token', () => {
      // manually insert the anonymous token in the manager
      // should never happen in real-life scenarios (see UTs above)
      const fakeEntry = {
        idx: `${anonymousToken.expiresAt};${anonymousToken._id}`,
        connectionId: 'foo',
        expiresAt: anonymousToken.expiresAt,
        userId: anonymousToken.userId,
        rooms: new Set(['bar'])
      };

      tokenManager.tokens.insert(fakeEntry);

      tokenManager.unlink(anonymousToken, 'bar');

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
      tokenManager._add(token, 'foo', ['bar', 'foo', 'baz']);

      tokenManager.unlink(token, 'bar');
      tokenManager.unlink(token, 'foo');
      tokenManager.unlink(token, 'baz');

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(tokenManager.tokensByConnectedUser).be.empty();
    });
  });

  describe('#refresh', () => {
    beforeEach(() => {
      tokenManager._add(token, 'foo', ['bar']);
    });

    it('should do nothing if the provided token is not linked', () => {
      tokenManager.refresh(
        new Token({_id: 'i am the beyonder'}),
        new Token({_id: 'i am the mountain'}));

      should(tokenManager.tokens.array).have.length(1);
      should(tokenManager.tokens.array[0].idx)
        .eql(`${token.expiresAt};${token._id}`);
    });

    it('should replace the old token with the new one', () => {
      const newT = new Token({_id: '...I got better'});
      tokenManager.refresh(token, newT);

      should(tokenManager.tokens.array).have.length(1);
      should(tokenManager.tokens.array[0].idx)
        .eql(`${newT.expiresAt};${newT._id}`);
    });
  });

  describe('#getConnectedUserToken', () => {
    it('should return a matching token', () => {
      tokenManager._add(token, 'foo', ['bar']);

      const response = tokenManager.getConnectedUserToken(token.userId, 'foo');
      should(response).be.an.instanceOf(Token);
      should(response).match({
        _id: token._id,
        expiresAt: token.expiresAt,
        ttl: null,
        userId: token.userId,
        jwt: token.jwt
      });
    });
  });
});
