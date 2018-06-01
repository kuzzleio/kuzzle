const
  jwt = require('jsonwebtoken'),
  Bluebird = require('bluebird'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  Token = require('../../../../../lib/api/core/models/security/token'),
  User = require('../../../../../lib/api/core/models/security/user'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  TokenRepository = require('../../../../../lib/api/core/models/repositories/tokenRepository'),
  {
    InternalError: KuzzleInternalError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

describe('Test: repositories/tokenRepository', () => {
  const
    context = new RequestContext({
      connectionId: 'papagayo'
    });
  let
    kuzzle,
    tokenRepository;

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
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous token', () => {
      const anonymous = tokenRepository.anonymous();

      assertIsAnonymous(anonymous);
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
    it('should reject the promise if the jwt is invalid', () => {
      return should(tokenRepository.verifyToken('invalidToken')).be.rejectedWith(UnauthorizedError, {
        details: {
          subCode: UnauthorizedError.prototype.subCodes.JsonWebTokenError,
          description: 'jwt malformed'
        }
      });
    });

    it('should reject the token if the uuid is not known', () => {
      const token = jwt.sign({_id: -99999}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        message: 'Invalid token'
      });
    });

    it('shoud reject the promise if the jwt is expired', () => {
      const token = jwt.sign({_id: -1}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm, expiresIn: 0});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        details: {
          subCode: UnauthorizedError.prototype.subCodes.TokenExpired
        }
      });
    });

    it('should reject the promise if an error occurred while fetching the user from the cache', () => {
      const token = jwt.sign({_id: 'auser'}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      sinon.stub(tokenRepository, 'loadFromCache').rejects(new KuzzleInternalError('Error'));

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(KuzzleInternalError);
    });

    it('should load the anonymous user if the token is null', () => {
      return tokenRepository.verifyToken(null)
        .then(userToken => assertIsAnonymous(userToken));
    });

    it('should reject the token if it does not contain the user id', () => {
      const token = jwt.sign({forged: 'token'}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {message: 'Json Web Token Error'});
    });

    it('should return the token loaded from cache', () => {
      const
        _id = 'auser',
        token = jwt.sign({_id}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm}),
        cacheObj = JSON.stringify({_id, jwt: token});

      kuzzle.services.list.internalCache.get.withArgs(tokenRepository.getCacheKey(`${_id}#${token}`)).resolves(cacheObj);

      return tokenRepository.verifyToken(token)
        .then(loaded => {
          should(loaded)
            .be.instanceOf(Token)
            .and.match(JSON.parse(cacheObj));

          // the cache entry must not be refreshed
          should(kuzzle.services.list.internalCache.expire).not.be.called();
        });
    });
  });

  describe('#generateToken', () => {
    it('should reject the promise if the username is null', () => {
      return should(tokenRepository.generateToken(null)).be.rejectedWith(KuzzleInternalError);
    });

    it('should reject the promise if the context is null', () => {
      const user = new User();

      user._id = 'foobar';

      return should(tokenRepository.generateToken(user, new Request({}))).be.rejectedWith(KuzzleInternalError);
    });

    it('should reject the promise if an error occurred while generating the token', () => {
      const
        user = new User(),
        request = new Request({}, context);

      user._id = 'foobar';

      return should(tokenRepository.generateToken(user, request, {expiresIn: 'foo'}))
        .be.rejectedWith(KuzzleInternalError, {message: 'Error while generating token'});
    });

    it('should resolve to a token signed with the provided username', () => {
      const
        user = new User(),
        checkToken = jwt.sign({_id: 'userInCache'}, kuzzle.config.security.jwt.secret, {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: kuzzle.config.security.jwt.expiresIn
        });

      user._id = 'userInCache';

      const request = new Request({}, {
        user,
        connectionId: 'connectionId'
      });

      return tokenRepository.generateToken(user, request)
        .then(token => {
          should(token).be.an.instanceOf(Token);
          should(token.jwt).be.exactly(checkToken);
          should(token._id).be.exactly(user._id + '#' + checkToken);
        });
    });

    it('should return an internal error if an error occurs when generating token', () => {
      const user = new User();

      user._id = 'userInCache';

      const request = new Request({}, {
        connectionId: 'connectionId',
        user
      });

      kuzzle.services.list.internalCache.setex.rejects(new Error('error'));

      return should(tokenRepository.generateToken(user, request))
        .be.rejectedWith(KuzzleInternalError, {message: 'Unable to generate token for unknown user'});
    });
  });

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      const
        token = tokenRepository.anonymous(),
        result = tokenRepository.serializeToCache(token);

      should(result).not.be.an.instanceOf(Token);
      should(result).be.an.Object();
      should(result._id).be.exactly(null);
      should(result.userId).be.exactly('-1');
    });
  });

  describe('#expire', () => {
    it('should be able to expires a token', () => {
      const user = new User();
      let token;

      user._id = 'userInCache';

      const request = new Request({}, {
        connectionId: 'connectionId',
        user
      });

      return tokenRepository.generateToken(user, request)
        .then(t => {
          token = t;
          return tokenRepository.expire(token);
        })
        .then(() => {
          should(kuzzle.tokenManager.expire)
            .be.calledOnce()
            .be.calledWith(token);
        });
    });
  });

  describe('#deleteByUserId', () => {
    it('should delete the tokens associated to a user identifier', () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      kuzzle.services.list.internalCache.searchKeys.returns(Promise.resolve([
        'repos/internalIndex/token/foo#foo',
        'repos/internalIndex/token/foo#bar',
        'repos/internalIndex/token/foo#baz'
      ]));

      kuzzle.services.list.internalCache.get.onFirstCall().returns(Promise.resolve(JSON.stringify({userId: 'foo', _id: 'foo', expiresAt: 1})));
      kuzzle.services.list.internalCache.get.onSecondCall().returns(Promise.resolve(JSON.stringify({userId: 'foo', _id: 'bar', expiresAt: 2})));
      kuzzle.services.list.internalCache.get.onThirdCall().returns(Promise.resolve(JSON.stringify({userId: 'foo', _id: 'baz', expiresAt: 3})));

      return tokenRepository.deleteByUserId('foo')
        .then(() => {
          should(kuzzle.services.list.internalCache.expire).calledWith('repos/internalIndex/token/foo', -1);
          should(kuzzle.services.list.internalCache.expire).calledWith('repos/internalIndex/token/bar', -1);
          should(kuzzle.services.list.internalCache.expire).calledWith('repos/internalIndex/token/baz', -1);
          should(kuzzle.tokenManager.expire).calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1});
          should(kuzzle.tokenManager.expire).calledWithMatch({userId: 'foo', _id: 'bar', expiresAt: 2});
          should(kuzzle.tokenManager.expire).calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 3});
        });
    });

    it('should not delete tokens if the internal cache return a false positive', () => {
      sinon.stub(tokenRepository, 'refreshCacheTTL');
      kuzzle.services.list.internalCache.searchKeys.returns(Promise.resolve([
        'repos/internalIndex/token/foo#foo',
        'repos/internalIndex/token/foo#bar#bar',
        'repos/internalIndex/token/foo#baz'
      ]));

      kuzzle.services.list.internalCache.get.onFirstCall().returns(Promise.resolve(JSON.stringify({userId: 'foo', _id: 'foo', expiresAt: 1})));
      kuzzle.services.list.internalCache.get.onSecondCall().returns(Promise.resolve(JSON.stringify({userId: 'foo', _id: 'baz', expiresAt: 2})));

      return tokenRepository.deleteByUserId('foo')
        .then(() => {
          should(kuzzle.services.list.internalCache.get.callCount).be.eql(2);
          should(kuzzle.services.list.internalCache.expire.callCount).be.eql(2);
          should(kuzzle.services.list.internalCache.expire).calledWith('repos/internalIndex/token/foo', -1);
          should(kuzzle.services.list.internalCache.expire).calledWith('repos/internalIndex/token/baz', -1);

          should(kuzzle.tokenManager.expire.callCount).be.eql(2);
          should(kuzzle.tokenManager.expire).calledWithMatch({userId: 'foo', _id: 'foo', expiresAt: 1});
          should(kuzzle.tokenManager.expire).calledWithMatch({userId: 'foo', _id: 'baz', expiresAt: 2});

        });
    });
  });
});

function assertIsAnonymous (token) {
  should(token._id).be.null();
  should(token.userId).be.exactly('-1');
}
