var
  jwt = require('jsonwebtoken'),
  Promise = require('bluebird'),
  should = require('should'),
  /** @type {Params} */
  params = require('../../../../../lib/config'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  UnauthorizedError = require.main.require('kuzzle-common-objects').Errors.unauthorizedError,
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Token = require.main.require('lib/api/core/models/security/token'),
  User = require.main.require('lib/api/core/models/security/user'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Repository = require.main.require('lib/api/core/models/repositories/repository'),
  TokenRepository = require.main.require('lib/api/core/models/repositories/tokenRepository');

describe('Test: repositories/tokenRepository', () => {
  var
    context = {connection: {id: 'papagayo'}},
    kuzzle,
    tokenRepository;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    var
      mockCacheEngine,
      mockProfileRepository,
      mockUserRepository,
      tokenInCache;

    mockCacheEngine = {
      get: key => {
        if (key === tokenRepository.index + '/' + tokenRepository.collection + '/tokenInCache') {
          return Promise.resolve(JSON.stringify(tokenInCache));
        }
        return Promise.resolve(null);
      },
      volatileSet: () => Promise.resolve('OK'),
      expire: (key, ttl) => Promise.resolve({key: key, ttl: ttl})
    };

    mockProfileRepository = {
      loadProfile: profileKey => {
        var profile = new Profile();
        profile._id = profileKey;
        return Promise.resolve(profile);
      }
    };

    mockUserRepository = {
      load: username => {
        var user = new User();
        user._id = username;
        user.profileIds = ['anonymous'];

        return Promise.resolve(user);
      },
      anonymous: () => {
        var
          role = new Role(),
          profile = new Profile(),
          user = new User();

        role._id = 'anonymous';
        role.controllers = {
          '*': {
            actions: {
              '*': true
            }
          }
        };

        user._id = -1;
        user.profileIds = ['anonymous'];
        profile.policies = [{roleId: role._id}];

        return Promise.resolve(user);
      },
      admin: () => {
        var
          role = new Role(),
          profile = new Profile(),
          user = new User();

        role._id = 'admin';
        role.controllers = {
          '*': {
            actions: {
              '*': true
            }
          }
        };

        user._id = 'admin';
        user.profileIds = ['admin'];
        profile.policies = [{roleId: role._id}];

        return Promise.resolve(user);
      }
    };

    tokenInCache = {
      _id: 'tokenInCache',
      user: 'admin'
    };

    kuzzle.repositories.profile = mockProfileRepository;
    kuzzle.repositories.user = mockUserRepository;

    tokenRepository = new TokenRepository(kuzzle);
    tokenRepository.init();
    tokenRepository.cacheEngine = mockCacheEngine;

    kuzzle.tokenManager = {
      add: () => {},
      expire: () => {},
      checkTokensValidity: () => {}
    };

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
    it('should return a valid anonymous token', done => {
      tokenRepository.anonymous()
        .then(token => {
          assertIsAnonymous(token);
          done();
        })
        .catch(error => {
          done(error);
        });
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

      token = jwt.sign({_id: -99999}, params.security.jwt.secret, {algorithm: params.security.jwt.algorithm});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        message: 'Invalid token'
      });
    });

    it('shoud reject the promise if the jwt is expired', () => {
      var token = jwt.sign({_id: -1}, params.security.jwt.secret, {algorithm: params.security.jwt.algorithm, expiresIn: 0});

      return should(tokenRepository.verifyToken(token)).be.rejectedWith(UnauthorizedError, {
        details: {
          subCode: UnauthorizedError.prototype.subCodes.TokenExpired
        }
      });
    });

    it('should reject the promise if an error occurred while fetching the user from the cache', () => {
      var token = jwt.sign({_id: 'auser'}, params.security.jwt.secret, {algorithm: params.security.jwt.algorithm});

      sandbox.stub(tokenRepository, 'loadFromCache').rejects(new InternalError('Error'));

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
        checkToken = jwt.sign({_id: 'userInCache'}, params.security.jwt.secret, {
          algorithm: params.security.jwt.algorithm,
          expiresIn: params.security.jwt.expiresIn
        });

      user._id = 'userInCache';

      tokenRepository.generateToken(user, context)
        .then(token => {
          should(token).be.an.instanceOf(Token);
          should(token._id).be.exactly(checkToken);

          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should return an internal error if an error append when generating token', () => {
      var
        user = new User();

      user._id = 'userInCache';

      tokenRepository.generateToken(user, context, {expiresIn: 'toto'})
        .catch(error => {
          should(error).be.an.instanceOf(InternalError);
          should(error.message).be.exactly('Error while generating token');
        });
    });

  });

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      tokenRepository.anonymous()
        .then(token => {
          var result = tokenRepository.serializeToCache(token);

          should(result).not.be.an.instanceOf(Token);
          should(result).be.an.Object();
          should(result._id).be.exactly(undefined);
          should(result.userId).be.exactly(-1);

        });
    });
  });

  describe('#expire', () => {
    it('should be able to expires a token', done => {
      var
        user = new User();

      user._id = 'userInCache';

      tokenRepository.generateToken(user, context)
        .then(token =>tokenRepository.expire(token))
        .then(() => done())
        .catch(error => done(error));
    });

    it('should expire token in the token manager', () => {
      var
        tokenManagerExpired = false,
        user = new User();

      kuzzle.tokenManager.expire = () => {
        tokenManagerExpired = true;
      };
      user._id = 'userInCache';

      tokenRepository.generateToken(user, context)
        .then(token => tokenRepository.expire(token))
        .then(() => {
          should(tokenManagerExpired).be.exactly(true);
        });
    });

    it('should return an internal error if an error append when expires a token', done => {
      var
        user = new User();

      Repository.prototype.expireFromCache = () => {
        return Promise.reject();
      };

      user._id = 'userInCache';

      tokenRepository.generateToken(user, context)
        .then(token => {
          return tokenRepository.expire(token);
        })
        .catch(error => {
          should(error).be.an.instanceOf(InternalError);
          should(error.message).be.exactly('Error expiring token');
          done();
        });
    });
  });

});

function assertIsAnonymous (token) {
  should(token._id).be.undefined();
  should(token.userId).be.exactly(-1);
}
