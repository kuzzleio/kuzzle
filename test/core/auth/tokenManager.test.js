'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const { Token } = require('../../../lib/model/security/token');
const { TokenManager } = require('../../../lib/core/auth/tokenManager');

describe('Test: token manager core component', () => {
  const anonymousToken = new Token({ _id: null, userId: '-1' });
  let kuzzle;
  let token;
  let tokenManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.ask
      .withArgs('core:security:user:anonymous:get')
      .resolves({_id: '-1'});

    tokenManager = new TokenManager();
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

  describe('events', () => {
    it('should register a listener on "connection:remove"', done => {
      tokenManager.removeConnection = async connectionId => {
        should(connectionId).be.eql('connection-id');
        done();
      };

      kuzzle.emit('connection:remove', { id: 'connection-id' });
    });
  });

  describe('#removeConnection', () => {
    it('should expire the token if it exists', async () => {
      sinon.stub(tokenManager, 'expire').resolves();
      tokenManager.link(token, 'connectionId');

      await tokenManager.removeConnection('connectionId');

      should(tokenManager.expire.getCall(0).args[0]._id).be.eql(token._id);
    });
  });

  describe('#link', () => {
    it('should do nothing if the token is not set', () => {
      tokenManager.link(null, 'foo');
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(tokenManager.tokensByConnection.size).equal(0);
    });

    it('should not add a link to an anonymous token', () => {
      tokenManager.link(anonymousToken, 'foo');

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(tokenManager.tokensByConnection.size).equal(0);
    });

    it('should link the provided connection ID to a new entry if this is the first subscription with this token', () => {
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(token, 'foo');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }])
        .and.have.length(1);

      should(tokenManager.tokensByConnection.get('foo')).match({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });

      should(runTimerStub).be.calledOnce();
    });

    it('should add the connection ID to the list if an entry already exists for this token', () => {


      tokenManager.link(token, 'foo');
      tokenManager.link(token, 'bar');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo', 'bar']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }])
        .and.have.length(1);

      should(tokenManager.tokensByConnection.get('foo')).match({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo', 'bar']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });

      should(tokenManager.tokensByConnection.get('bar')).match({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo', 'bar']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });
    });

    it('should not start a new timer if the new token is not the next one to expire', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });

      const
        runTimerStub = sinon.stub(tokenManager, 'runTimer'),
        tokenAfter = new Token({
          _id: 'foo2#bar2',
          userId: 'foo2',
          jwt: 'bar2',
          expiresAt: Date.now()+10000,
        });

      tokenManager.link(tokenAfter, 'foo2');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }, {
          idx: `${tokenAfter.expiresAt};${tokenAfter._id}`,
          connectionIds: new Set(['foo2']),
          expiresAt: tokenAfter.expiresAt,
          userId: tokenAfter.userId,
        }])
        .and.have.length(2);

      should(tokenManager.tokensByConnection.get('foo2')).match({
        idx: `${tokenAfter.expiresAt};${tokenAfter._id}`,
        connectionIds: new Set(['foo2']),
        expiresAt: tokenAfter.expiresAt,
        userId: tokenAfter.userId,
      });

      should(runTimerStub).not.be.called();
    });

    it('should update the associated token of a connection when a connection is linked to a another token', () => {
      const tokenAfter = new Token({
        _id: 'foo2#bar2',
        userId: 'foo2',
        jwt: 'bar2',
        expiresAt: Date.now()+10000,
      });

      tokenManager.link(token, 'foo1');
      tokenManager.link(token, 'foo2');

      should(tokenManager.tokensByConnection.get('foo1')).match({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo1', 'foo2']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });

      tokenManager.link(tokenAfter, 'foo1');

      should(tokenManager.tokensByConnection.get('foo1')).match({
        idx: `${tokenAfter.expiresAt};${tokenAfter._id}`,
        connectionIds: new Set(['foo1']),
        expiresAt: tokenAfter.expiresAt,
        userId: tokenAfter.userId,
      });

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo2']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }, {
          idx: `${tokenAfter.expiresAt};${tokenAfter._id}`,
          connectionIds: new Set(['foo1']),
          expiresAt: tokenAfter.expiresAt,
          userId: tokenAfter.userId,
        }])
        .and.have.length(2);
    });
  });

  describe('#expire', () => {
    it('should force a token to expire when called', async () => {
      tokenManager.link(token, 'foo');
      tokenManager.link(token, 'bar');

      await tokenManager.expire(token);
      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(kuzzle.ask)
        .calledWith('core:realtime:connection:remove', 'foo')
        .and.calledWith('core:realtime:connection:remove', 'bar');

      should(tokenManager.tokensByConnection.size).equal(0);
    });

    it('should do nothing if the provided token is from the anonymous user', async () => {
      // manually insert the anonymous token in the manager
      // should never happen in real-life scenarios (see UTs above)
      const fakeEntry = {
        idx: `${anonymousToken.expiresAt};${anonymousToken._id}`,
        connectionIds: new Set(['foo']),
        expiresAt: anonymousToken.expiresAt,
        userId: anonymousToken.userId,
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
        expiresAt: Date.now()+1000,
        _idx: `${Date.now()+1000}#foo2`,
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
        new Token({_id: 'bar', expiresAt }),
        'connectionId1');
      tokenManager.link(
        new Token({_id: 'foo', expiresAt }),
        'connectionId2');

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
        new Token({_id: 'bar', expiresAt: now + 1000000 }),
        'connectionId1');
      tokenManager.link(
        new Token({_id: 'foo', expiresAt: now - 1000 }),
        'connectionId2');

      runTimerStub.resetHistory();
      await tokenManager.checkTokensValidity();

      clock.runAll();

      should(tokenExpiredStub)
        .be.calledOnce()
        .be.calledWith('core:realtime:tokenExpired:notify', 'connectionId2');

      should(tokenManager.tokens.array.length).be.eql(1);
      should(tokenManager.tokens.array[0]._id).be.eql('bar');
      should(runTimerStub).be.calledOnce();
      should(tokenManager.tokensByConnection).have.key('connectionId1');
      should(tokenManager.tokensByConnection).not.have.key('connectionId2');
    });

    it('should not expire API key', async () => {
      const runTimerStub = sinon.stub(tokenManager, 'runTimer');

      tokenManager.link(
        new Token({_id: 'api-key-1', expiresAt: -1 }),
        'connectionId1');

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
        new Token({_id: 'foo', expiresAt: now - 1000 }),
        'connectionId2');

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
        connectionIds: new Set(['foo']),
        expiresAt: anonymousToken.expiresAt,
        userId: anonymousToken.userId,
      };

      tokenManager.tokens.insert(fakeEntry);

      tokenManager.unlink(anonymousToken, 'foo');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([fakeEntry])
        .and.have.length(1);
    });

    it('should not try to unlink a non-existing token', () => {
      tokenManager.tokens.insert({
        idx: `${token.expiresAt};${token._id}`,
        connectionIds: new Set(['foo']),
        expiresAt: token.expiresAt,
        userId: token.userId,
      });

      tokenManager.unlink(new Token({_id: 'i am the beyonder' }), 'bar');
      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.have.length(1);
    });

    it('should remove only the provided connection ID from the entry', () => {
      tokenManager.link(token, 'foo');
      tokenManager.link(token, 'bar');
      tokenManager.link(token, 'baz');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo', 'bar', 'baz']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }])
        .and.have.length(1);

      tokenManager.unlink(token, 'bar');
      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo', 'baz']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }])
        .and.have.length(1);
    });

    it('should also remove the entry if the last linked connection ID is removed', () => {
      tokenManager.link(token, 'foo');
      tokenManager.link(token, 'bar');
      tokenManager.link(token, 'baz');

      should(tokenManager.tokens.array)
        .be.an.Array()
        .and.match([{
          idx: `${token.expiresAt};${token._id}`,
          connectionIds: new Set(['foo', 'bar', 'baz']),
          expiresAt: token.expiresAt,
          userId: token.userId,
        }])
        .and.have.length(1);

      tokenManager.unlink(token, 'bar');
      tokenManager.unlink(token, 'foo');
      tokenManager.unlink(token, 'baz');

      should(tokenManager.tokens.array).be.an.Array().and.be.empty();
      should(tokenManager.tokensByConnection).be.empty();
    });
  });

  describe('#refresh', () => {
    beforeEach(() => {
      tokenManager.link(token, 'foo');
    });

    it('should do nothing if the provided token is not linked', () => {
      tokenManager.refresh(
        new Token({_id: 'i am the beyonder' }),
        new Token({_id: 'i am the mountain' }));

      should(tokenManager.tokens.array).have.length(1);
      should(tokenManager.tokens.array[0].idx)
        .eql(`${token.expiresAt};${token._id}`);

      should(tokenManager.tokensByConnection.get('foo')).match({
        idx: `${token.expiresAt};${token._id}`
      });
    });

    it('should replace the old token with the new one', () => {
      const newT = new Token({_id: '...I got better' });
      tokenManager.refresh(token, newT);

      should(tokenManager.tokens.array).have.length(1);
      should(tokenManager.tokens.array[0].idx)
        .eql(`${newT.expiresAt};${newT._id}`);

      should(tokenManager.tokensByConnection.get('foo')).match({
        idx: `${newT.expiresAt};${newT._id}`
      });
    });
  });

  describe('#getConnectedUserToken', () => {
    it('should return a matching token', () => {
      tokenManager.link(token, 'foo');

      const ret = tokenManager.getConnectedUserToken(token.userId, 'foo');

      should(ret).match({
        _id: token._id,
        expiresAt: token.expiresAt,
        ttl: null,
        userId: token.userId,
        jwt: token.jwt,
        connectionIds: new Set(['foo']),
      });
    });

    it('should not return token if the userId is not associated to the connection', () => {
      tokenManager.link(token, 'foo');
      tokenManager.link(new Token({_id: 'New Token'}), 'bar');

      const response = tokenManager.getConnectedUserToken(token.userId, 'bar');
      should(response).be.null();
    });
  });
});
