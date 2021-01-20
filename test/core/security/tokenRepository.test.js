'use strict';

const ms = require('ms');
const jwt = require('jsonwebtoken');
const Bluebird = require('bluebird');
const should = require('should');
const sinon = require('sinon');
const mockrequire = require('mock-require');

const {
  BadRequestError,
  InternalError: KuzzleInternalError,
  UnauthorizedError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const MutexMock = require('../../mocks/mutex.mock');

const Token = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user');
const Repository = require('../../../lib/core/shared/repository');
const ApiKey = require('../../../lib/model/storage/apiKey');

describe('Test: security/tokenRepository', () => {
  let kuzzle;
  let TokenRepository;
  let tokenRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.secret = 'test-secret';

    mockrequire('../../../lib/util/mutex', { Mutex: MutexMock });
    TokenRepository = mockrequire.reRequire('../../../lib/core/security/tokenRepository');

    tokenRepository = new TokenRepository();
    sinon.stub(tokenRepository, '_loadApiKeys');
    sinon.stub(ApiKey, 'batchExecute');

    return tokenRepository.init();
  });

  afterEach(() => {
    ApiKey.batchExecute.restore();
    mockrequire.stopAll();
  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      const repository = new TokenRepository({ ttl: 1000 });

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
    beforeEach(() => {
      kuzzle.ask.withArgs('core:cache:internal:get').resolves(null);
    });

    it('should register a "verify" event', async () => {
      sinon.stub(tokenRepository, 'verifyToken');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:verify', 'hash');

      should(tokenRepository.verifyToken).calledWith('hash');
    });

    it('should reject the promise if the jwt is invalid', () => {
      return should(tokenRepository.verifyToken('invalidToken'))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should reject the token if the uuid is not known', () => {
      const token = jwt.sign(
        {_id: -99999},
        kuzzle.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should reject if the jwt is expired', () => {
      const token = jwt.sign(
        { _id: -1 },
        kuzzle.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm, expiresIn: 0});

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.expired'
        });
    });

    it('should reject if an error occurred while fetching the user from the cache', () => {
      const token = jwt.sign(
        { _id: 'auser' },
        kuzzle.secret,
        { algorithm: kuzzle.config.security.jwt.algorithm });

      sinon.stub(tokenRepository, 'loadFromCache')
        .rejects(new KuzzleInternalError('Error'));

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.verification_error'
        });
    });

    it('should load the anonymous user if the token is null', async () => {
      const userToken = await tokenRepository.verifyToken(null);

      assertIsAnonymous(userToken);
    });

    it('should reject the token if it does not contain the user id', () => {
      const token = jwt.sign(
        { forged: 'token' },
        kuzzle.secret,
        { algorithm: kuzzle.config.security.jwt.algorithm });

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should return the token loaded from cache', async () => {
      const _id = 'auser';
      const token = jwt.sign(
        { _id },
        kuzzle.secret,
        { algorithm: kuzzle.config.security.jwt.algorithm });
      const cacheObj = JSON.stringify({_id, jwt: token});

      kuzzle.ask
        .withArgs(
          'core:cache:internal:get',
          tokenRepository.getCacheKey(`${_id}#${token}`))
        .resolves(cacheObj);

      const loaded = await tokenRepository.verifyToken(token);

      should(loaded).be.instanceOf(Token).and.match(JSON.parse(cacheObj));

      // the cache entry must not be refreshed
      should(kuzzle.ask).not.be.calledWith('core:cache:internal:expire');
    });
  });

  describe('#create', () => {
    it('should register a "create" event', async () => {
      sinon.stub(tokenRepository, 'generateToken');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:create', 'user', 'opts');

      should(tokenRepository.generateToken).calledWith('user', 'opts');
    });

    it('should reject the promise if the username is null', () => {
      return should(tokenRepository.generateToken(null))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.unknown_user'
        });
    });

    it('should resolve to a token signed with the provided username', async () => {
      const user = new User();
      const checkToken = jwt.sign(
        { _id: 'userInCache' },
        kuzzle.secret,
        {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: ms(kuzzle.config.security.jwt.expiresIn) / 1000,
        });

      user._id = 'userInCache';

      sinon.spy(tokenRepository, 'persistForUser');

      const token = await tokenRepository.generateToken(user);

      should(token).be.an.instanceOf(Token);
      should(token.jwt).be.exactly(checkToken);
      should(token._id).be.exactly(`${user._id}#${checkToken}`);
      should(tokenRepository.persistForUser)
        .be.calledWith(checkToken, user._id, 3600000);
    });

    it('should return an internal error if an error occurs when generating token', async () => {
      const user = new User();

      user._id = 'userInCache';

      mockrequire('jsonwebtoken', {
        sign: () => {
          throw new Error('oh noes');
        }
      });

      const MockedTokenRepository = mockrequire.reRequire('../../../lib/core/security/tokenRepository');

      tokenRepository = new MockedTokenRepository();

      try {
        await should(tokenRepository.generateToken(user))
          .be.rejectedWith(KuzzleInternalError, {
            id: 'security.token.generation_failed',
          });
      }
      finally {
        mockrequire.stopAll();
      }
    });

    it('should allow a big ttl if no maxTTL is set', async () => {
      const user = new User();
      user._id = 'id';

      const token = await tokenRepository.generateToken(user, {
        expiresIn: '1000y',
      });

      should(token).be.an.instanceOf(Token);
    });

    it('should allow a ttl lower than the maxTTL', async () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      const token = await tokenRepository.generateToken(user, {
        expiresIn: '30s',
      });

      should(token).be.an.instanceOf(Token);
    });

    it('should reject if the ttl exceeds the maxTTL', () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      return should(tokenRepository.generateToken(user, {expiresIn: '1m'}))
        .be.rejectedWith(BadRequestError, {id: 'security.token.ttl_exceeded'});
    });

    it('should reject if the ttl is infinite and the maxTTL is finite', () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      return should(tokenRepository.generateToken(user, { expiresIn: -1 }))
        .be.rejectedWith(BadRequestError, {id: 'security.token.ttl_exceeded'});
    });

    it('should reject if the ttl is not ms-compatible or not a number', () => {
      const user = new User();
      user._id = 'id';

      return should(tokenRepository.generateToken(user, { expiresIn: 'ehh' }))
        .be.rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
        });
    });

    it('should pass the correct expiration delay to jwt.sign', async () => {
      // jwt.sign does not accept double values for its expiresIn option
      // in previous versions of Kuzzle, we simply divided the number of
      // milliseconds received by 1000 without precaution, making jwt.sign
      // throw an error when generating the token
      const user = new User();
      const checkToken = jwt.sign(
        { _id: 'userInCache' },
        kuzzle.secret,
        {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: 123,
        });

      user._id = 'userInCache';

      sinon.spy(tokenRepository, 'persistForUser');

      const token = await tokenRepository.generateToken(user, {
        expiresIn: 123456
      });

      should(token).be.an.instanceOf(Token);
      should(token.jwt).be.exactly(checkToken);
      should(token._id).be.exactly(`${user._id}#${checkToken}`);
      should(tokenRepository.persistForUser)
        .be.calledWith(checkToken, user._id, 123456);
    });
  });

  describe('#assign', () => {
    it('should register an "assign" event', async () => {
      sinon.stub(tokenRepository, 'persistForUser');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:assign', 'hash', 'user', 'ttl');

      should(tokenRepository.persistForUser).calledWith('hash', 'user', 'ttl');
    });

    it('should persist a token with TTL into Redis', async () => {
      const token = await tokenRepository.persistForUser(
        'encoded-token',
        'user-id',
        42000);

      should(kuzzle.ask).be.calledWith(
        'core:cache:internal:store',
        'repos/kuzzle/token/user-id#encoded-token',
        JSON.stringify(token),
        { ttl: 42000 });
      should(token._id).be.eql('user-id#encoded-token');
      should(token.ttl).be.eql(42000);
      should(token.expiresAt).be.approximately(Date.now() + 42000, 20);
    });

    it('should persist a token without TTL into Redis', async () => {
      const token = await tokenRepository
        .persistForUser('encoded-token', 'user-id', -1);

      should(kuzzle.ask).be.calledWith(
        'core:cache:internal:store',
        'repos/kuzzle/token/user-id#encoded-token',
        JSON.stringify(token));
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
    it('should register a "delete" event', async () => {
      sinon.stub(tokenRepository, 'expire');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:delete', 'token');

      should(tokenRepository.expire).calledWith('token');
    });

    it('should be able to expires a token', async () => {
      const user = new User();
      user._id = 'userInCache';

      const token = await tokenRepository.generateToken(user, 'connectionId');

      sinon.stub(Repository.prototype, 'expireFromCache');

      try {
        await tokenRepository.expire(token);

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
    it('should register a "deleteByKuid" event', async () => {
      sinon.stub(tokenRepository, 'deleteByKuid');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:deleteByKuid', 'kuid');

      should(tokenRepository.deleteByKuid).calledWith('kuid');
    });

    it('should delete the tokens associated to a user identifier', async () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      kuzzle.ask.withArgs('core:cache:internal:searchKeys').resolves([
        'repos/kuzzle/token/foo#foo',
        'repos/kuzzle/token/foo#bar',
        'repos/kuzzle/token/foo#baz',
      ]);

      kuzzle.ask.withArgs('core:cache:internal:get').onFirstCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'foo', expiresAt: 1 }));

      kuzzle.ask.withArgs('core:cache:internal:get').onSecondCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'bar', expiresAt: 2 }));

      kuzzle.ask.withArgs('core:cache:internal:get').onThirdCall().resolves(
        JSON.stringify({ userId: 'foo', _id: 'baz', expiresAt: 3 }));

      await tokenRepository.deleteByKuid('foo');

      should(kuzzle.ask)
        .calledWith('core:cache:internal:expire', 'repos/kuzzle/token/foo', -1)
        .calledWith('core:cache:internal:expire', 'repos/kuzzle/token/bar', -1)
        .calledWith('core:cache:internal:expire', 'repos/kuzzle/token/baz', -1);

      should(kuzzle.tokenManager.expire)
        .calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1})
        .calledWithMatch({userId: 'foo', _id: 'bar', expiresAt: 2})
        .calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 3});
    });

    it('should not delete tokens if the internal cache return a false positive', async () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      kuzzle.ask.withArgs('core:cache:internal:searchKeys').resolves([
        'repos/kuzzle/token/foo#foo',
        'repos/kuzzle/token/foo#bar#bar',
        'repos/kuzzle/token/foo#baz'
      ]);

      const cacheGetStub = kuzzle.ask.withArgs('core:cache:internal:get');

      cacheGetStub
        .onFirstCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'foo', expiresAt: 1}));

      cacheGetStub
        .onSecondCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'baz', expiresAt: 2}));

      await tokenRepository.deleteByKuid('foo');

      should(cacheGetStub.callCount).be.eql(2);

      const expireStub = kuzzle.ask.withArgs('core:cache:internal:expire');

      should(expireStub.callCount).be.eql(2);
      should(expireStub)
        .calledWith('core:cache:internal:expire', 'repos/kuzzle/token/foo', -1)
        .calledWith('core:cache:internal:expire', 'repos/kuzzle/token/baz', -1);

      should(kuzzle.tokenManager.expire.callCount).be.eql(2);
      should(kuzzle.tokenManager.expire)
        .calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1})
        .calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 2});
    });
  });

  describe('#get', () => {
    it('should register a "get" event', async () => {
      sinon.stub(tokenRepository, 'loadForUser');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:get', 'user', 'hash');

      should(tokenRepository.loadForUser).calledWith('user', 'hash');
    });

    it('should retrieve the right token', async () => {
      sinon.stub(Repository.prototype, 'load').resolves('foo');

      try {
        const ret = await tokenRepository.loadForUser('user', 'hash');

        should(ret).eql('foo');

        should(Repository.prototype.load).calledWith('user#hash');
      }
      finally {
        Repository.prototype.load.restore();
      }
    });
  });

  describe('#refresh', () => {
    let fakeToken;

    beforeEach(() => {
      fakeToken = new Token();

      sinon.stub(tokenRepository, 'generateToken').resolves(fakeToken);
      sinon.stub(tokenRepository, 'persistToCache').resolves();
    });

    it('should register a "refresh" event', async () => {
      sinon.stub(tokenRepository, 'refresh');

      kuzzle.ask.restore();
      await kuzzle.ask('core:security:token:refresh', 'user', 'token', 'ttl');

      should(tokenRepository.refresh).calledWith('user', 'token', 'ttl');
    });

    it('should create a new token and expire the old one', async () => {
      const oldToken = new Token();

      const token = await tokenRepository.refresh('user', oldToken, '10m');

      should(token).eql(fakeToken);
      should(oldToken.refreshed).be.true();
      should(tokenRepository.generateToken).calledWithMatch('user', {
        expiresIn: '10m'
      });
      should(tokenRepository.persistToCache).calledWithMatch(oldToken, {
        ttl: kuzzle.config.security.jwt.gracePeriod,
      });
      should(kuzzle.tokenManager.refresh).calledWith(oldToken, fakeToken);
    });

    it('should leave the current token intact if a new one cannot be created', async () => {
      const oldToken = new Token();

      tokenRepository.generateToken.rejects(new Error('foo'));

      await should(tokenRepository.refresh('user', oldToken, '10m'))
        .rejectedWith('foo');

      should(oldToken.refreshed).be.false();
      should(tokenRepository.persistToCache).not.called();
    });

    it('should refuse to refresh an already refreshed token', async () => {
      const oldToken = new Token();
      oldToken.refreshed = true;

      await should(tokenRepository.refresh('user', oldToken, '10m'))
        .rejectedWith(UnauthorizedError, {id: 'security.token.invalid'});

      should(tokenRepository.generateToken).not.called();
      should(tokenRepository.persistToCache).not.called();
    });
  });

  describe('#_loadApiKeys', () => {
    beforeEach(() => {
      tokenRepository._loadApiKeys.restore();
      sinon.stub(tokenRepository, 'persistForUser');

      kuzzle.ask.withArgs('core:cache:internal:get').returns(null);

      ApiKey.batchExecute.callsArgWith(1, [
        { _source: { token: 'encoded-token-1', userId: 'user-id-1', ttl: 42 } },
        { _source: { token: 'encoded-token-2', userId: 'user-id-2', ttl: -1 } },
      ]);
    });

    it('should load API key tokens to Redis cache', async () => {
      await tokenRepository._loadApiKeys();

      should(ApiKey.batchExecute).be.calledWith({ match_all: {} });

      should(tokenRepository.persistForUser)
        .be.calledWith('encoded-token-1', 'user-id-1', 42)
        .be.calledWith('encoded-token-2', 'user-id-2', -1);

      should(kuzzle.ask)
        .be.calledWith('core:cache:internal:get', 'token/bootstrap');

      should(kuzzle.ask)
        .be.calledWith('core:cache:internal:store', 'token/bootstrap', 1);
    });

    it('should not load API keys if the bootstrap key exists', async () => {
      kuzzle.ask.withArgs('core:cache:internal:get').returns('1');
      await tokenRepository._loadApiKeys();

      should(ApiKey.batchExecute).not.called();

      should(kuzzle.ask)
        .be.calledWith('core:cache:internal:get', 'token/bootstrap');

      should(kuzzle.ask.withArgs('core:cache:internal:store')).not.called();
    });
  });
});

function assertIsAnonymous (token) {
  should(token._id).be.null();
  should(token.userId).be.exactly('-1');
}
