var
  should = require('should'),
  _ = require('lodash'),
  jwt = require('jsonwebtoken'),
  ms = require('ms'),
  Promise = require('bluebird'),
  /** @type {Params} */
  params = require('../../../lib/config'),
  passport = require('passport'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  util = require('util'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  Token = require.main.require('lib/api/core/models/security/token'),
  context = {},
  requestObject,
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
    requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'} }, {}, 'unit-test');
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
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

        sandbox.stub(kuzzle.repositories.token, 'persistToCache').resolves();
        sandbox.stub(kuzzle.repositories.user, 'load', t => {
          if (t === 'unknown_user') {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            _id: t,
            profileIds: [t]
          });
        });
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
      sandbox.stub(kuzzle.passport, 'authenticate', request => Promise.resolve({_id: request.query.username}));
      return kuzzle.funnel.controllers.auth.login(requestObject, {})
        .then(response => {
          var decodedToken = jwt.verify(response.data.body.jwt, params.security.jwt.secret);
          should(decodedToken._id).be.equal('jdoe');
        });
    });

    it('should resolve to a redirect url', () => {
      sandbox.stub(kuzzle.passport, 'authenticate').resolves({headers: {Location: 'http://github.com'}});

      return kuzzle.funnel.controllers.auth.login(requestObject, {})
        .then(response => {
          should(response.data.body.headers.Location).be.equal('http://github.com');
        });
    });

    it('should use local strategy if no one is set', () => {

      var spy = sandbox.stub(kuzzle.passport, 'authenticate', (data, strategy) => {
        should(strategy).be.exactly('local');
        return Promise.resolve('foo');
      });

      delete requestObject.data.body.strategy;

      return kuzzle.funnel.controllers.auth.login(requestObject, {})
        .then(() => {
          should(spy.calledOnce).be.true();
        });
    });

    it('should be able to set authentication expiration', function (done) {
      this.timeout(1100);

      requestObject.data.body.expiresIn = '1s';

      sandbox.stub(kuzzle.passport, 'authenticate', request => Promise.resolve({_id: request.query.username}));
      kuzzle.funnel.controllers.auth.login(requestObject, {connection: {id: 'banana'}})
        .then(response => {
          var decodedToken = jwt.verify(response.data.body.jwt, params.security.jwt.secret);
          should(decodedToken._id).be.equal('jdoe');

          setTimeout(() => {
            try {
              jwt.verify(response.data.body.jwt, params.security.jwt.secret);
            }
            catch (err) {
              should(err).be.an.instanceOf(jwt.TokenExpiredError);
              done();
            }
          }, 1000);
        });
    });

    it('should register token in the token manager when a connexion id is set', () => {
      context = {
        connection: {
          id: 'banana'
        }
      };

      requestObject.data.body.expiresIn = '1m';

      kuzzle.repositories.token.generateToken.restore();
      sandbox.stub(kuzzle.tokenManager, 'add', token => {
        should(token).be.an.instanceOf(Token);
        should(token.ttl).be.exactly(60000);
        should(token.expiresAt).be.approximately(Date.now() + token.ttl, 30);
      });

      sandbox.stub(kuzzle.passport, 'authenticate', request => Promise.resolve({_id: request.query.username}));
      return kuzzle.funnel.controllers.auth.login(requestObject, context);
    });

    it('should reject if authentication failure', () => {
      sandbox.stub(kuzzle.passport, 'authenticate').rejects(new Error('Mockup Wrapper Error'));
      return kuzzle.funnel.controllers.auth.login(requestObject)
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

      context = {
        connection: {
          id: 'papagaya'
        },
        token: t
      };

      requestObject = new RequestObject({
        controller: 'auth',
        action: 'logout',
        header: {
          authorization: 'Bearer ' + signedToken
        }
      }, {}, 'unit-test');

      sandbox.stub(kuzzle.repositories.token, 'expire').resolves();

    });

    it('should emit a auth:afterLogout event', () => {
      var
        spy = sandbox.stub(kuzzle.pluginsManager, 'trigger', (event, data) => Promise.resolve(data));

      return kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);

          should(spy.calledWith('auth:beforeLogout')).be.true();
          should(spy.calledWith('auth:afterLogout')).be.true();
        });
    });

    it('should emit an error if event emit raise an error', () => {
      sandbox.stub(kuzzle.pluginsManager, 'trigger', event => {
        if (event === 'auth:afterLogout' || event === 'auth:beforeLogout') {
          return Promise.reject();
        }
      });

      return should(kuzzle.funnel.controllers.auth.logout(requestObject, context)).be.rejected();
    });

    it('should expire token', () => {
      kuzzle.repositories.token.expire.restore();
      sandbox.stub(kuzzle.repositories.token, 'expire', token => {
        should(token).be.exactly(context.token);
        return Promise.resolve();
      });

      return kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
        });
    });

    it('should emit an error if token cannot be expired', () => {
      kuzzle.repositories.token.expire.restore();
      sandbox.stub(kuzzle.repositories.token, 'expire').rejects();
      return should(kuzzle.funnel.controllers.auth.logout(requestObject, context)).be.rejected();
    });

    it('should not remove room registration for connexion if there is no id', () => {
      var spy = sandbox.stub(kuzzle.hotelClerk, 'removeCustomerFromAllRooms').rejects();

      delete context.connection.id;
      return kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(() => {
          should(spy.called).be.false();
        });
    });

  });

  describe('#getCurrentUser', () => {
    it('should return the user given in the context', () => {
      var
        rq = new RequestObject({body: {}}),
        token = {
          token: {userId: 'admin'}
        };

      return kuzzle.funnel.controllers.auth.getCurrentUser(rq, token)
        .then(response => {
          should(response.data.body._id).be.exactly('admin');
          should(response.data.body._source.profileIds).be.eql(['admin']);
        });
    });

    it('should return a falsey response if the current user is unknown', () => {
      var promise = kuzzle.funnel.controllers.auth.getCurrentUser(new RequestObject({
        body: {}
      }), {
        token: { userId: 'unknown_user' }
      });

      return should(promise).be.rejected();
    });
  });

  describe('#checkToken', () => {
    var
      stubToken = {
        expiresAt: 42
      };

    beforeEach(() => {
      requestObject = new RequestObject({action: 'checkToken', controller: 'auth'}, {body: {token: 'foobar'}});
    });

    it('should return a rejected promise if no token is provided', () => {
      return should(kuzzle.funnel.controllers.auth.checkToken(new RequestObject({ body: {}}))).be.rejected();
    });

    it('should return a valid response if the token is valid', () => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return Promise.resolve(stubToken);
      });

      return kuzzle.funnel.controllers.auth.checkToken(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.valid).be.true();
          should(response.data.body.state).be.undefined();
          should(response.data.body.expiresAt).be.eql(stubToken.expiresAt);
        });
    });

    it('should return a valid response if the token is not valid', () => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return Promise.reject({status: 401, message: 'foobar'});
      });

      return kuzzle.funnel.controllers.auth.checkToken(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.valid).be.false();
          should(response.data.body.state).be.eql('foobar');
          should(response.data.body.expiresAt).be.undefined();
        });
    });

    it('should return a rejected promise if an error occurs', () => {
      sandbox.stub(kuzzle.repositories.token, 'verifyToken', arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return Promise.reject({status: 500});
      });

      return should(kuzzle.funnel.controllers.auth.checkToken(requestObject)).be.rejected();
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
          return {_id: 'admin', _source: { profilesId: ['admin'] }};
        }
        return Promise.resolve(null);
      });

      sandbox.stub(kuzzle.repositories.user, 'persist', (user, opts) => {
        persistOptions = opts;
        return Promise.resolve(user);
      });
    });

    it('should return a valid ResponseObject', () => {
      return kuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar' }
      }), { token: { userId: 'admin', _id: 'admin' }})
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(persistOptions.database.method).be.exactly('update');
          should(response.data.body._id).be.exactly('admin');
        });
    });

    it('should reject if profile is specified', () => {
      should(kuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar', profileIds: ['test'] }
      }), { token: { userId: 'admin', _id: 'admin' }}))
        .be.rejected();
    });

    it('should reject if _id is specified in the body', () => {
      should(kuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar', _id: 'test' }
      }), { token: { userId: 'admin', _id: 'admin' }}))
        .be.rejected();
    });

    it('should reject a the promise if current user is anonymous', () => {
      should(kuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: {
          foo: 'bar'
        }
      }), {
        token: {
          userId: {
            _id: -1
          },
          _id: null
        }
      }))
        .be.rejected();
    });
  });

  describe('#getMyRights', () => {
    var
      rq = new RequestObject({body: {}}),
      token = {
        token: {userId: 'test' }
      };

    it('should be able to get current user\'s rights', () => {
      var loadUserStub = userId => {
        return {
          _id: userId,
          _source: {},
          getRights: () => {
            return {
              rights1: {
                controller: 'read', action: 'get', index: 'foo', collection: 'bar',
                value: 'allowed'
              },
              rights2: {
                controller: 'write', action: 'delete', index: '*', collection: '*',
                value: 'conditional'
              }
            };
          }
        };
      };

      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load', loadUserStub);
      return kuzzle.funnel.controllers.auth.getMyRights(rq, token)
        .then(result => {
          var filteredItem;

          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).length(2);

          filteredItem = result.data.body.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = result.data.body.hits.filter(item => {
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
});
