var
  should = require('should'),
  _ = require('lodash'),
  jwt = require('jsonwebtoken'),
  ms = require('ms'),
  Promise = require('bluebird'),
  /** @type KuzzleConfiguration */
  params = require('../../../lib/config'),
  passport = require('passport'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  util = require('util'),
  Kuzzle = require('../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  Token = require('../../../lib/api/core/models/security/token'),
  request,
  MockupStrategy;

/**
 * @param name
 * @param verify
 * @constructor
 */
MockupStrategy = function(name, verify) {
  passport.Strategy.call(this);
  this.name = name;
  this._verify = verify;

};

util.inherits(MockupStrategy, passport.Strategy);

MockupStrategy.prototype.authenticate = function(req) {
  var
    self = this,
    username;

  if (req.body && req.body.username) {
    username = req.body.username;
  }

  function verified(err, user, info) {
    if (err) { return self.error(err); }
    if (!user) { return self.fail(info); }
    self.success(user, info);
  }

  try {
    this._verify(username, verified);
  } catch (ex) {
    return self.error(ex);
  }
};

describe('Test the auth controller', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    request = new Request({controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'}});
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));

    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        sandbox.stub(kuzzle.repositories.token, 'generateToken', (user, gtcontext, opts) => {
          var
            token = new Token(),
            expiresIn,
            encodedToken = jwt.sign({_id: user._id}, kuzzle.config.security.jwt.secret, opts);

          if (!opts.expiresIn) {
            opts.expiresIn = 0;
          }
          expiresIn = ms(opts.expiresIn);

          _.assignIn(token, {
            _id: encodedToken,
            userId: user._id,
            ttl: expiresIn,
            expiresAt: Date.now() + expiresIn
          });
          return token;
        });

        sandbox.stub(kuzzle.repositories.token, 'persistToCache').returns(Promise.resolve());
        sandbox.stub(kuzzle.repositories.user, 'load', t => {
          if (t === 'unknown_user') {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            _id: t,
            profileIds: [t]
          });
        });

        return null;
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#login', () => {
    beforeEach(() => {
      return passport.use(new MockupStrategy('mockup', function(username, callback) {
        callback(null, {_id: username});
      }));
    });

    it('should resolve to a valid jwt token if authentication succeed', () => {
      sandbox.stub(kuzzle.passport, 'authenticate', r => Promise.resolve({_id: r.query.username}));
      return kuzzle.funnel.controllers.auth.login(request)
        .then(response => {
          var decodedToken = jwt.verify(response.jwt, params.security.jwt.secret);
          should(decodedToken._id).be.equal('jdoe');
        });
    });

    it('should resolve to a redirect url', () => {
      sandbox.stub(kuzzle.passport, 'authenticate').returns(Promise.resolve({headers: {Location: 'http://github.com'}}));

      return kuzzle.funnel.controllers.auth.login(request)
        .then(response => {
          should(response.headers.Location).be.equal('http://github.com');
        });
    });

    it('should use local strategy if no one is set', () => {

      var spy = sandbox.stub(kuzzle.passport, 'authenticate', (data, strategy) => {
        should(strategy).be.exactly('local');
        return Promise.resolve('foo');
      });

      delete request.input.body.strategy;

      return kuzzle.funnel.controllers.auth.login(request)
        .then(() => {
          should(spy.calledOnce).be.true();
        });
    });

    it('should be able to set authentication expiration', function (done) {
      this.timeout(1200);

      request.input.body.expiresIn = '1s';

      sandbox.stub(kuzzle.passport, 'authenticate', r => Promise.resolve({_id: r.query.username}));
      kuzzle.funnel.controllers.auth.login(request, {connection: {id: 'banana'}})
        .then(response => {
          var decodedToken = jwt.verify(response.jwt, params.security.jwt.secret);
          should(decodedToken._id).be.equal('jdoe');

          setTimeout(() => {
            try {
              jwt.verify(response.jwt, params.security.jwt.secret);
            }
            catch (err) {
              should(err).be.an.instanceOf(jwt.TokenExpiredError);
              done();
            }
          }, 1000);
        });
    });

    it('should register token in the token manager when a connexion id is set', () => {
      request.input.body.expiresIn = '1m';
      request.context.connectionId = 'banana';

      kuzzle.repositories.token.generateToken.restore();
      sandbox.stub(kuzzle.tokenManager, 'add', token => {
        should(token).be.an.instanceOf(Token);
        should(token.ttl).be.exactly(60000);
        should(token.expiresAt).be.approximately(Date.now() + token.ttl, 30);
      });

      sandbox.stub(kuzzle.passport, 'authenticate', r => Promise.resolve({_id: r.query.username}));
      return kuzzle.funnel.controllers.auth.login(request);
    });

    it('should reject if authentication failure', () => {
      sandbox.stub(kuzzle.passport, 'authenticate').returns(Promise.reject(new Error('Mockup Wrapper Error')));
      return kuzzle.funnel.controllers.auth.login(request)
        .then(() => should.fail('Authenticate should have reject'))
        .catch((error) => {
          should(error.message).be.exactly('Mockup Wrapper Error');
        });
    });
  });

  describe('#logout', () => {

    beforeEach(() => {
      var
        signedToken = jwt.sign({_id: 'admin'}, params.security.jwt.secret, {algorithm: params.security.jwt.algorithm}),
        t = new Token();

      t._id = signedToken;
      request = new Request({
        controller: 'auth',
        action: 'logout',
        jwt: signedToken
      }, {
        connectionId: 'papagaya',
        token: t
      });

      sandbox.stub(kuzzle.repositories.token, 'expire').returns(Promise.resolve());
    });

    it('should expire token', () => {
      kuzzle.repositories.token.expire.restore();
      sandbox.stub(kuzzle.repositories.token, 'expire', token => {
        should(token).be.exactly(request.context.token);
        return Promise.resolve();
      });

      return kuzzle.funnel.controllers.auth.logout(request)
        .then(response => {
          should(response.responseObject).be.instanceof(Object);
        });
    });

    it('should emit an error if token cannot be expired', () => {
      var error = new Error('Mocked error');
      kuzzle.repositories.token.expire.restore();
      sandbox.stub(kuzzle.repositories.token, 'expire').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.auth.logout(request)).be.rejectedWith(error);
    });
  });

  describe('#getCurrentUser', () => {
    it('should return the user given in the context', () => {
      var req = new Request({body: {}}, {token: {userId: 'admin'}, user: {_id: 'admin'}});

      return kuzzle.funnel.controllers.auth.getCurrentUser(req)
        .then(response => {
          should(response).match(req.context.user);
        });
    });
  });

  describe('#checkToken', () => {
    var testToken;

    beforeEach(() => {
      request = new Request({action: 'checkToken', controller: 'auth', body: {token: 'foobar'}}, {});
      testToken = new Token();
      testToken.expiresAt = 42;
    });

    it('should throw an error if no token is provided', () => {
      return should(() => {
        kuzzle.funnel.controllers.auth.checkToken(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should return a valid response if the token is valid', () => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(request.input.body.token);
        return Promise.resolve(testToken);
      });

      return kuzzle.funnel.controllers.auth.checkToken(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.valid).be.true();
          should(response.state).be.undefined();
          should(response.expiresAt).be.eql(testToken.expiresAt);
        });
    });

    it('should return a valid response if the token is not valid', () => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(request.input.body.token);

        return Promise.reject(new UnauthorizedError('foobar'));
      });

      return kuzzle.funnel.controllers.auth.checkToken(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.valid).be.false();
          should(response.state).be.eql('foobar');
          should(response.expiresAt).be.undefined();
        });
    });

    it('should return a rejected promise if an error occurs', () => {
      var error = new InternalError('Foobar');
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(request.input.body.token);
        return Promise.reject(error);
      });

      return should(kuzzle.funnel.controllers.auth.checkToken(request)).be.rejectedWith(error);
    });
  });

  describe('#updateSelf', () => {
    var
      persistOptions;

    beforeEach(() => {
      persistOptions = {};
      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load', id => {
        if (id === 'anonymous') {
          return kuzzle.repositories.user.anonymous();
        }
        if (id === 'admin') {
          return Promise.resolve({_id: 'admin', _source: {profilesId: ['admin']}});
        }
        return Promise.resolve(null);
      });

      sandbox.stub(kuzzle.repositories.user, 'persist', (user, opts) => {
        persistOptions = opts;
        return Promise.resolve(user);
      });
    });

    it('should return a valid response', () => {
      return kuzzle.funnel.controllers.auth.updateSelf(new Request(
        {body: {foo: 'bar'}},
        {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
      ))
        .then(response => {
          should(response).be.instanceof(Object);
          should(persistOptions.database.method).be.exactly('update');
          should(response._id).be.exactly('admin');
        });
    });

    it('should throw an error if profile is specified', () => {
      should(() => {
        kuzzle.funnel.controllers.auth.updateSelf(new Request(
          {body: {foo: 'bar', profileIds: ['test']}},
          {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
        ));
      }).throw(BadRequestError);
    });

    it('should throw an error if _id is specified in the body', () => {
      should(() => {
        kuzzle.funnel.controllers.auth.updateSelf(new Request(
          {body: {foo: 'bar', _id: 'test'}},
          {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
        ));
      }).throw(BadRequestError);
    });

    it('should throw an error if current user is anonymous', () => {
      should(() => {
        kuzzle.funnel.controllers.auth.updateSelf(new Request({body: {foo: 'bar'}}, {token: {userId: '-1'}, user: {_id: '-1'}}));
      }).throw(UnauthorizedError);
    });
  });

  describe('#getMyRights', () => {
    var req = new Request({body: {}}, {token: {userId: 'test'}, user: {
      _id: 'test',
      getRights: () => {
        return Promise.resolve({
          rights1: {controller: 'read', action: 'get', index: 'foo', collection: 'bar', value: 'allowed'},
          rights2: {controller: 'write', action: 'delete', index: '*', collection: '*', value: 'conditional'}
        });
      }
    }});

    it('should be able to get current user\'s rights', () => {
      return kuzzle.funnel.controllers.auth.getMyRights(req)
        .then(response => {
          var filteredItem;

          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          filteredItem = response.hits.filter(item => {
            return item.controller === 'read' &&
              item.action === 'get' &&
              item.index === 'foo' &&
              item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = response.hits.filter(item => {
            return item.controller === 'write' &&
              item.action === 'delete' &&
              item.index === '*' &&
              item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });
  });

  describe('#getAuthenticationStrategies', () => {
    it('should return a valid response', () => {
      return kuzzle.funnel.controllers.auth.getStrategies()
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).have.property('authenticationStrategies').instanceof(Array);
        });
    });
  });
});
