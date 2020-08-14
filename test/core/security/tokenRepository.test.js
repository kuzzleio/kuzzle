'use strict';

const ms = require('ms');
const jwt = require('jsonwebtoken');
const Bluebird = require('bluebird');
const should = require('should');
const sinon = require('sinon');
const {
  BadRequestError,
  InternalError: KuzzleInternalError,
  UnauthorizedError
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Token = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user');
const TokenRepository = require('../../../lib/core/security/tokenRepository');
const Repository = require('../../../lib/core/shared/repository');

describe('Test: security/tokenRepository', () => {
  let kuzzle;
  let tokenRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.security.jwt.secret = 'test-secret';
    kuzzle.ask.restore();

    tokenRepository = new TokenRepository(kuzzle);

    return tokenRepository.init();
  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      const repository = new TokenRepository(kuzzle, { ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });

    it('should define a valid anonymous token', () => {
      assertIsAnonymous(tokenRepository.anonymousToken);
    });
  });

  describe('#hydrate', () => {
    it('should return the given token if the given data is not a valid object', () => {
      const t = new Token();

      return Bluebird.all([
        tokenRepository.hydrate(t, null),
        tokenRepository.hydrate(t),
        tokenRepository.hydrate(t, 'a scalar')
      ])
        .then(results => results.forEach(token => should(token).be.exactly(t)));
    });

    it('should return the anonymous token if no _id is set', done => {
      const token = new Token();

      tokenRepository.hydrate(token, {})
        .then(result => {
          assertIsAnonymous(result);
          done();
        })
        .catch(err => { done(err); });
    });
  });

  describe('#verify', () => {
    const verifyEvent = 'core:security:token:verify';

    beforeEach(() => {
      tokenRepository.cacheEngine.get.resolves(null);
    });

    it('should register a "verify" event', async () => {
      sinon.stub(tokenRepository, 'verifyToken');

      await kuzzle.ask(verifyEvent, 'hash');

      should(tokenRepository.verifyToken).calledWith('hash');
    });

    it('should reject the promise if the jwt is invalid', () => {
      return should(kuzzle.ask(verifyEvent, 'invalidToken'))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should reject the token if the uuid is not known', () => {
      const token = jwt.sign(
        {_id: -99999},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(kuzzle.ask(verifyEvent, token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('shoud reject if the jwt is expired', () => {
      const token = jwt.sign(
        {_id: -1},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm, expiresIn: 0});

      return should(kuzzle.ask(verifyEvent, token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.expired'
        });
    });

    it('should reject if an error occurred while fetching the user from the cache', () => {
      const token = jwt.sign(
        { _id: 'auser' },
        kuzzle.config.security.jwt.secret,
        { algorithm: kuzzle.config.security.jwt.algorithm });

      sinon.stub(tokenRepository, 'loadFromCache')
        .rejects(new KuzzleInternalError('Error'));

      return should(kuzzle.ask(verifyEvent, token))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.verification_error'
        });
    });

    it('should load the anonymous user if the token is null', async () => {
      const userToken = await kuzzle.ask(verifyEvent, null);

      assertIsAnonymous(userToken);
    });

    it('should reject the token if it does not contain the user id', () => {
      const token = jwt.sign(
        {forged: 'token'},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(kuzzle.ask(verifyEvent, token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should return the token loaded from cache', async () => {
      const _id = 'auser';
      const token = jwt.sign(
        {_id},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});
      const cacheObj = JSON.stringify({_id, jwt: token});

      tokenRepository.cacheEngine.get
        .withArgs(tokenRepository.getCacheKey(`${_id}#${token}`))
        .resolves(cacheObj);

      const loaded = await kuzzle.ask(verifyEvent, token);

      should(loaded).be.instanceOf(Token).and.match(JSON.parse(cacheObj));

      // the cache entry must not be refreshed
      should(tokenRepository.cacheEngine.expire).not.be.called();
    });
  });

  describe('#create', () => {
    const createEvent = 'core:security:token:create';

    it('should register a "create" event', async () => {
      sinon.stub(tokenRepository, 'generateToken');

      await kuzzle.ask(createEvent, 'user', 'opts');

      should(tokenRepository.generateToken).calledWith('user', 'opts');
    });

    it('should reject the promise if the username is null', () => {
      return should(kuzzle.ask(createEvent, null))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.unknown_user'
        });
    });

    it('should resolve to a token signed with the provided username', async () => {
      const user = new User();
      const checkToken = jwt.sign(
        { _id: 'userInCache' },
        kuzzle.config.security.jwt.secret,
        {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: ms(kuzzle.config.security.jwt.expiresIn) / 1000
        });

      user._id = 'userInCache';

      sinon.spy(tokenRepository, 'persistForUser');

      const token = await kuzzle.ask(createEvent, user);

      should(token).be.an.instanceOf(Token);
      should(token.jwt).be.exactly(checkToken);
      should(token._id).be.exactly(`${user._id}#${checkToken}`);
      should(tokenRepository.persistForUser)
        .be.calledWith(checkToken, user._id, 3600000);
    });

    it('should return an internal error if an error occurs when generating token', () => {
      const user = new User();

      user._id = 'userInCache';

      tokenRepository.cacheEngine.setex.rejects(new Error('error'));

      return should(kuzzle.ask(createEvent, user))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'services.cache.write_failed'
        });
    });

    it('should allow a big ttl if no maxTTL is set', async () => {
      const user = new User();
      user._id = 'id';

      const token = await kuzzle.ask(createEvent, user, {expiresIn: '1000y'});

      should(token).be.an.instanceOf(Token);
    });

    it('should allow a ttl lower than the maxTTL', async () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      const token = await kuzzle.ask(createEvent, user, {expiresIn: '30s'});

      should(token).be.an.instanceOf(Token);
    });

    it('should reject if the ttl exceeds the maxTTL', () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      return should(kuzzle.ask(createEvent, user, {expiresIn: '1m'}))
        .be.rejectedWith(BadRequestError, {id: 'security.token.ttl_exceeded'});
    });

    it('should reject if the ttl is infinite and the maxTTL is finite', () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      return should(kuzzle.ask(createEvent, user, { expiresIn: -1 }))
        .be.rejectedWith(BadRequestError, {id: 'security.token.ttl_exceeded'});
    });

    it('should reject if the ttl is not ms-compatible or not a number', () => {
      const user = new User();
      user._id = 'id';

      return should(kuzzle.ask(createEvent, user, { expiresIn: 'ehh' }))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.generation_failed'
        });
    });
  });

  describe('#assign', () => {
    const assignEvent = 'core:security:token:assign';

    it('should register an "assign" event', async () => {
      sinon.stub(tokenRepository, 'persistForUser');

      await kuzzle.ask(assignEvent, 'hash', 'user', 'ttl');

      should(tokenRepository.persistForUser).calledWith('hash', 'user', 'ttl');
    });

    it('should persist a token with TTL into Redis', async () => {
      const token = await kuzzle.ask(assignEvent,
        'encoded-token',
        'user-id',
        42000);

      should(tokenRepository.cacheEngine.setex)
        .be.calledOnce()
        .be.calledWith('repos/kuzzle/token/user-id#encoded-token', 42);
      should(token._id).be.eql('user-id#encoded-token');
      should(token.ttl).be.eql(42000);
      should(token.expiresAt).be.approximately(Date.now() + 42000, 20);
    });

    it('should persist a token without TTL into Redis', async () => {
      await kuzzle.ask(assignEvent, 'encoded-token', 'user-id', -1);

      should(tokenRepository.cacheEngine.set)
        .be.calledOnce()
        .be.calledWith('repos/kuzzle/token/user-id#encoded-token');
    });
  });

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      const token = new Token({userId: 'foo'});
      const result = tokenRepository.serializeToCache(token);

      should(result).not.be.an.instanceOf(Token);
      should(result).be.an.Object();
      should(result._id).be.exactly(null);
      should(result.userId).be.exactly('foo');
    });
  });

  describe('#delete', () => {
    const deleteEvent = 'core:security:token:delete';

    it('should register a "delete" event', async () => {
      sinon.stub(tokenRepository, 'expire');

      await kuzzle.ask(deleteEvent, 'token');

      should(tokenRepository.expire).calledWith('token');
    });

    it('should be able to expires a token', async () => {
      const user = new User();
      user._id = 'userInCache';

      const token = await tokenRepository.generateToken(user, 'connectionId');

      sinon.stub(Repository.prototype, 'expireFromCache');

      try {
        await kuzzle.ask(deleteEvent, token);

        should(kuzzle.tokenManager.expire)
          .be.calledOnce()
          .be.calledWith(token);
      }
      finally {
        Repository.prototype.expireFromCache.restore();
      }
    });
  });

  describe('#deleteByKuid', () => {
    const deleteEvent = 'core:security:token:deleteByKuid';

    it('should register a "deleteByKuid" event', async () => {
      sinon.stub(tokenRepository, 'deleteByKuid');

      await kuzzle.ask(deleteEvent, 'kuid');

      should(tokenRepository.deleteByKuid).calledWith('kuid');
    });

    it('should delete the tokens associated to a user identifier', async () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      tokenRepository.cacheEngine.searchKeys.resolves([
        'repos/kuzzle/token/foo#foo',
        'repos/kuzzle/token/foo#bar',
        'repos/kuzzle/token/foo#baz']);

      tokenRepository.cacheEngine.get.onFirstCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'foo', expiresAt: 1 }));

      tokenRepository.cacheEngine.get.onSecondCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'bar', expiresAt: 2 }));

      tokenRepository.cacheEngine.get.onThirdCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'baz', expiresAt: 3 }));

      await kuzzle.ask(deleteEvent, 'foo');

      should(tokenRepository.cacheEngine.expire)
        .calledWith('repos/kuzzle/token/foo', -1)
        .calledWith('repos/kuzzle/token/bar', -1)
        .calledWith('repos/kuzzle/token/baz', -1);

      should(kuzzle.tokenManager.expire)
        .calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1})
        .calledWithMatch({userId: 'foo', _id: 'bar', expiresAt: 2})
        .calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 3});
    });

    it('should not delete tokens if the internal cache return a false positive', async () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      tokenRepository.cacheEngine.searchKeys.resolves([
        'repos/kuzzle/token/foo#foo',
        'repos/kuzzle/token/foo#bar#bar',
        'repos/kuzzle/token/foo#baz'
      ]);

      tokenRepository.cacheEngine.get
        .onFirstCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'foo', expiresAt: 1}));
      tokenRepository.cacheEngine.get
        .onSecondCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'baz', expiresAt: 2}));

      await kuzzle.ask(deleteEvent, 'foo');

      should(tokenRepository.cacheEngine.get.callCount).be.eql(2);
      should(tokenRepository.cacheEngine.expire.callCount).be.eql(2);
      should(tokenRepository.cacheEngine.expire)
        .calledWith('repos/kuzzle/token/foo', -1)
        .calledWith('repos/kuzzle/token/baz', -1);

      should(kuzzle.tokenManager.expire.callCount).be.eql(2);
      should(kuzzle.tokenManager.expire)
        .calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1})
        .calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 2});
    });
  });

  describe('#get', () => {
    const getEvent = 'core:security:token:get';

    it('should register a "get" event', async () => {
      sinon.stub(tokenRepository, 'loadForUser');

      await kuzzle.ask(getEvent, 'user', 'hash');

      should(tokenRepository.loadForUser).calledWith('user', 'hash');
    });

    it('should retrieve the right token', async () => {
      sinon.stub(Repository.prototype, 'load').resolves('foo');

      try {
        const ret = await kuzzle.ask(getEvent, 'user', 'hash');

        should(ret).eql('foo');

        should(Repository.prototype.load).calledWith('user#hash');
      }
      finally {
        Repository.prototype.load.restore();
      }
    });
  });

  describe('#refresh', () => {
    const refreshEvent = 'core:security:token:refresh';
    let fakeToken;

    beforeEach(() => {
      fakeToken = new Token();

      sinon.stub(tokenRepository, 'generateToken').resolves(fakeToken);
      sinon.stub(tokenRepository, 'persistToCache').resolves();
    });

    it('should register a "refresh" event', async () => {
      sinon.stub(tokenRepository, 'refresh');

      await kuzzle.ask(refreshEvent, 'user', 'token', 'ttl');

      should(tokenRepository.refresh).calledWith('user', 'token', 'ttl');
    });

    it('should create a new token and expire the old one', async () => {
      const oldToken = new Token();

      const token = await kuzzle.ask(refreshEvent, 'user', oldToken, '10m');

      should(token).eql(fakeToken);
      should(oldToken.refreshed).be.true();
      should(tokenRepository.generateToken).calledWithMatch('user', {
        expiresIn: '10m'
      });
      should(tokenRepository.persistToCache).calledWithMatch(oldToken, {
        ttl: kuzzle.config.security.jwt.gracePeriod / 1000,
      });
      should(kuzzle.tokenManager.refresh).calledWith(oldToken, fakeToken);
    });

    it('should leave the current token intact if a new one cannot be created', async () => {
      const oldToken = new Token();

      tokenRepository.generateToken.rejects(new Error('foo'));

      await should(kuzzle.ask(refreshEvent, 'user', oldToken, '10m'))
        .rejectedWith('foo');

      should(oldToken.refreshed).be.false();
      should(tokenRepository.persistToCache).not.called();
    });

    it('should refuse to refresh an already refreshed token', async () => {
      const oldToken = new Token();
      oldToken.refreshed = true;

      await should(kuzzle.ask(refreshEvent, 'user', oldToken, '10m'))
        .rejectedWith(UnauthorizedError, {id: 'security.token.invalid'});

      should(tokenRepository.generateToken).not.called();
      should(tokenRepository.persistToCache).not.called();
    });
  });
});

function assertIsAnonymous (token) {
  should(token._id).be.null();
  should(token.userId).be.exactly('-1');
}
