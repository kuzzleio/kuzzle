var
  jwt = require('jsonwebtoken'),
  Promise = require('bluebird'),
  should = require('should'),
  /** @type {Params} */
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  Token = require('../../../../../lib/api/core/models/security/token'),
  User = require('../../../../../lib/api/core/models/security/user'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  TokenRepository = require('../../../../../lib/api/core/models/repositories/tokenRepository');

describe('Test: repositories/tokenRepository', () => {
  var
    context = new RequestContext({
      connectionId: 'papagayo'
    }),
    kuzzle,
    tokenRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    tokenRepository = new TokenRepository(kuzzle);

    return tokenRepository.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      var repository = new TokenRepository(kuzzle, { ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous token', () => {
      var anonymous = tokenRepository.anonymous();

      assertIsAnonymous(anonymous);
    });
  });

  describe('#hydrate', () => {
    it('should return the given token if the given data is not a valid object', () => {
      var
        t = new Token();

      return Promise.all([
        tokenRepository.hydrate(t, null),
        tokenRepository.hydrate(t),
        tokenRepository.hydrate(t, 'a scalar')
      ])
        .then(results => results.forEach(token => should(token).be.exactly(t)));
    });

    it('should return the anonymous token if no _id is set', done => {
      var token = new Token();

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
      var
        token;

      token = jwt.sign({_id: -99999}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        message: 'Invalid token'
      });
    });

    it('shoud reject the promise if the jwt is expired', () => {
      var token = jwt.sign({_id: -1}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm, expiresIn: 0});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        details: {
          subCode: UnauthorizedError.prototype.subCodes.TokenExpired
        }
      });
    });

    it('should reject the promise if an error occurred while fetching the user from the cache', () => {
      var token = jwt.sign({_id: 'auser'}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm});

      sandbox.stub(tokenRepository, 'loadFromCache').returns(Promise.reject(new InternalError('Error')));

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(InternalError);
    });

    it('should load the anonymous user if the token is null', () => {
      return tokenRepository.verifyToken(null)
        .then(userToken => assertIsAnonymous(userToken));
    });
  });

  describe('#generateToken', () => {
    it('should reject the promise if the username is null', () => {
      return should(tokenRepository.generateToken(null)).be.rejectedWith(InternalError);
    });

    it('should reject the promise if the context is null', () => {
      return should(tokenRepository.generateToken(new User(), null)).be.rejectedWith(InternalError);
    });

    it('should reject the promise if an error occurred while generating the token', () => {
      var algorithm = kuzzle.config.security.jwt.algorithm;

      kuzzle.config.security.jwt.algorithm = 'fake JWT ALgorithm';

      return should(tokenRepository.generateToken(new User(), context)
        .catch(err => {
          kuzzle.config.security.jwt.algorithm = algorithm;

          return Promise.reject(err);
        })).be.rejectedWith(InternalError);
    });

    it('should resolve to the good jwt token for a given username', done => {
      var
        user = new User(),
        checkToken = jwt.sign({_id: 'userInCache'}, kuzzle.config.security.jwt.secret, {
          algorithm: kuzzle.config.security.jwt.algorithm,
          expiresIn: kuzzle.config.security.jwt.expiresIn
        }),
        request;

      user._id = 'userInCache';
      request = new Request({}, {
        connectionId: 'connectionId',
        user
      });

      tokenRepository.generateToken(user, request)
        .then(token => {
          should(token).be.an.instanceOf(Token);
          should(token._id).be.exactly(checkToken);

          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should return an internal error if an error occurs when generating token', () => {
      var
        user = new User(),
        request;

      user._id = 'userInCache';
      request = new Request({}, {
        connectionId: 'connectionId',
        user
      });

      tokenRepository.generateToken(user, request, {expiresIn: 'toto'})
        .catch(error => {
          should(error).be.an.instanceOf(InternalError);
          should(error.message).be.exactly('Error while generating token');
        });
    });

  });

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      var
        token = tokenRepository.anonymous(),
        result;

      result = tokenRepository.serializeToCache(token);

      should(result).not.be.an.instanceOf(Token);
      should(result).be.an.Object();
      should(result._id).be.exactly(undefined);
      should(result.userId).be.exactly('-1');
    });
  });

  describe('#expire', () => {
    it('should be able to expires a token', () => {
      var
        user = new User(),
        request,
        token;

      user._id = 'userInCache';
      request = new Request({}, {
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

});

function assertIsAnonymous (token) {
  should(token._id).be.undefined();
  should(token.userId).be.exactly('-1');
}
