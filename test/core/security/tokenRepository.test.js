'use strict';

const ms = require('ms');
const jwt = require('jsonwebtoken');
const Bluebird = require('bluebird');
const should = require('should');
const sinon = require('sinon');
const {
  errors: {
    BadRequestError,
    InternalError: KuzzleInternalError,
    UnauthorizedError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Token = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user');
const TokenRepository = require('../../../lib/core/security/tokenRepository');

describe.only('Test: security/tokenRepository', () => {
  let kuzzle;
  let tokenRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.security.jwt.secret = 'test-secret';
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

  describe('#verifyToken', () => {
    beforeEach(() => {
      tokenRepository.cacheEngine.get.resolves(null);
    });

    it('should reject the promise if the jwt is invalid', () => {
      return should(tokenRepository.verifyToken('invalidToken'))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should reject the token if the uuid is not known', () => {
      const token = jwt.sign({_id: -99999}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('shoud reject the promise if the jwt is expired', () => {
      const token = jwt.sign({_id: -1}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm, expiresIn: 0});

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.expired'
        });
    });

    it('should reject the promise if an error occurred while fetching the user from the cache', () => {
      const token = jwt.sign(
        { _id: 'auser' },
        kuzzle.config.security.jwt.secret,
        { algorithm: kuzzle.config.security.jwt.algorithm });

      sinon.stub(tokenRepository, 'loadFromCache')
        .rejects(new KuzzleInternalError('Error'));

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.verification_error'
        });
    });

    it('should load the anonymous user if the token is null', () => {
      return tokenRepository.verifyToken(null)
        .then(userToken => assertIsAnonymous(userToken));
    });

    it('should reject the token if it does not contain the user id', () => {
      const token = jwt.sign({forged: 'token'}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token))
        .be.rejectedWith(UnauthorizedError, {
          id: 'security.token.invalid'
        });
    });

    it('should return the token loaded from cache', () => {
      const
        _id = 'auser',
        token = jwt.sign({_id}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm}),
        cacheObj = JSON.stringify({_id, jwt: token});

      tokenRepository.cacheEngine.get.withArgs(tokenRepository.getCacheKey(`${_id}#${token}`)).resolves(cacheObj);

      return tokenRepository.verifyToken(token)
        .then(loaded => {
          should(loaded)
            .be.instanceOf(Token)
            .and.match(JSON.parse(cacheObj));

          // the cache entry must not be refreshed
          should(tokenRepository.cacheEngine.expire).not.be.called();
        });
    });
  });

  describe('#generateToken', () => {
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
        kuzzle.config.security.jwt.secret,
        {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: ms(kuzzle.config.security.jwt.expiresIn) / 1000
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

    it('should return an internal error if an error occurs when generating token', () => {
      const user = new User();

      user._id = 'userInCache';

      tokenRepository.cacheEngine.setex.rejects(new Error('error'));

      return should(tokenRepository.generateToken(user))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'services.cache.write_failed'
        });
    });

    it('should allow a big ttl if no maxTTL is set', async () => {
      const user = new User();
      user._id = 'id';

      const token = await tokenRepository.generateToken(user, {
        expiresIn: '1000y'
      });

      should(token).be.an.instanceOf(Token);
    });

    it('should allow a ttl lower than the maxTTL', async () => {
      const user = new User();
      user._id = 'id';

      kuzzle.config.security.jwt.maxTTL = 42000;

      const token = await tokenRepository.generateToken(user, {
        expiresIn: '30s'
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
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.token.generation_failed'
        });
    });
  });

  describe('#persistForUser', () => {
    it('should persist a token with TTL into Redis', async () => {
      const token = await tokenRepository.persistForUser(
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
      await tokenRepository.persistForUser(
        'encoded-token',
        'user-id',
        -1);

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

  describe('#expire', () => {
    it('should be able to expires a token', async () => {
      const user = new User();
      user._id = 'userInCache';

      const token = await tokenRepository.generateToken(user, 'connectionId');

      await tokenRepository.expire(token);

      should(kuzzle.tokenManager.expire)
        .be.calledOnce()
        .be.calledWith(token);
    });
  });

  describe('#deleteByKuid', () => {
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

      await tokenRepository.deleteByKuid('foo');

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
      tokenRepository.cacheEngine.searchKeys.returns(Promise.resolve([
        'repos/kuzzle/token/foo#foo',
        'repos/kuzzle/token/foo#bar#bar',
        'repos/kuzzle/token/foo#baz'
      ]));

      tokenRepository.cacheEngine.get
        .onFirstCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'foo', expiresAt: 1}));
      tokenRepository.cacheEngine.get
        .onSecondCall()
        .resolves(JSON.stringify({userId: 'foo', _id: 'baz', expiresAt: 2}));

      await tokenRepository.deleteByKuid('foo');

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
});

function assertIsAnonymous (token) {
  should(token._id).be.null();
  should(token.userId).be.exactly('-1');
}
