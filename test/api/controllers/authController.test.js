var
  should = require('should'),
  jwt = require('jsonwebtoken'),
  q = require('q'),
  /** @type {Params} */
  params = require('rc')('kuzzle'),
  passport = require('passport'),
  sinon = require('sinon'),
  util = require('util'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  Token = require.main.require('lib/api/core/models/security/token'),
  context = {},
  redisClientMock = require('../../mocks/services/redisClient.mock'),
  requestObject,
  MockupWrapper,
  MockupStrategy;

require('sinon-as-promised')(q.Promise);

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

MockupWrapper = function(MockupReturn) {
  this.authenticate = function(request) {
    if (MockupReturn === 'resolve') {
      return q({_id: request.query.username});
    } else if (MockupReturn === 'oauth') {
      return q({headers: {Location: 'http://github.com'}});
    }

    return q.reject(new Error('Mockup Wrapper Error'));
  };
};

describe('Test the auth controller', function () {
  var
    kuzzle,
    sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'} }, {}, 'unit-test');
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        return kuzzle.services.list.tokenCache.init();
      })
      .then(function () {
        kuzzle.services.list.tokenCache.client = redisClientMock;

        kuzzle.repositories.user.load = function(t) {
          if (t === 'unknown_user') {
            return q(null);
          }
          return q({
            _id: t,
            profile: t
          });
        };
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#login', function () {
    beforeEach(() => {
      return passport.use(new MockupStrategy('mockup', function(username, callback) {
        var
          deferred = q.defer(),
          user = {
            _id: username
          };
        deferred.resolve(user);
        deferred.promise.nodeify(callback);
        return deferred.promise;
      }));
    });

    it('should resolve to a valid jwt token if authentication succeed', () => {
      kuzzle.funnel.controllers.auth.passport = new MockupWrapper('resolve');
      return kuzzle.funnel.controllers.auth.login(requestObject, {})
        .then(response => {
          var decodedToken = jwt.verify(response.data.body.jwt, params.jsonWebToken.secret);
          should(decodedToken._id).be.equal('jdoe');
        })
        .catch(() => {
          // This case must not raise
          should(false).be.true();
        });
    });

    it('should resolve to a redirect url', function(done) {
      this.timeout(50);

      kuzzle.funnel.controllers.auth.passport = new MockupWrapper('oauth');
      kuzzle.funnel.controllers.auth.login(requestObject, {})
        .then(function(response) {
          should(response.data.body.headers.Location).be.equal('http://github.com');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should use local strategy if no one is set', function (done) {
      this.timeout(50);

      kuzzle.funnel.controllers.auth.passport = {
        authenticate: function(data, strategy) {
          should(strategy).be.exactly('local');
          done();
          return q.reject();
        }
      };

      delete requestObject.data.body.strategy;

      kuzzle.funnel.controllers.auth.login(requestObject, {});
    });

    it('should be able to set authentication expiration', function (done) {
      this.timeout(1100);

      requestObject.data.body.expiresIn = '1s';

      kuzzle.funnel.controllers.auth.passport = new MockupWrapper('resolve');
      kuzzle.funnel.controllers.auth.login(requestObject, {connection: {id: 'banana'}})
        .then(function(response) {
          var decodedToken = jwt.verify(response.data.body.jwt, params.jsonWebToken.secret);
          should(decodedToken._id).be.equal('jdoe');

          setTimeout(() => {
            try {
              jwt.verify(response.data.body.jwt, params.jsonWebToken.secret);
            }
            catch (err) {
              should(err).be.an.instanceOf(jwt.TokenExpiredError);
              done();
            }
          }, 1000);
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should register token in the token manager when a connexion id is set', function (done) {
      context = {
        connection: {
          id: 'banana'
        }
      };

      requestObject.data.body.expiresIn = '1m';

      kuzzle.tokenManager.add = function(token) {
        should(token).be.an.instanceOf(Token);
        should(token.ttl).be.exactly(60000);
        should(token.expiresAt).be.approximately(Date.now() + token.ttl, 30);
        done();
      };

      kuzzle.funnel.controllers.auth.passport = new MockupWrapper('resolve');
      kuzzle.funnel.controllers.auth.login(requestObject, context)
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject if authentication failure', function (done) {
      this.timeout(50);
      kuzzle.funnel.controllers.auth.passport = new MockupWrapper('reject');
      kuzzle.funnel.controllers.auth.login(requestObject)
        .catch((error) => {
          should(error.message).be.exactly('Mockup Wrapper Error');
          done();
        });
    });
  });

  describe('#logout', function () {

    beforeEach(function () {
      var
        signedToken = jwt.sign({_id: 'admin'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm}),
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

    });

    it('should emit a auth:afterLogout event', () => {
      var
        spy = sandbox.stub(kuzzle.pluginsManager, 'trigger', (event, data) => q(data));

      sandbox.stub(kuzzle.repositories.token.cacheEngine, 'expire').resolves({});

      return kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);

          should(spy.calledWith('auth:beforeLogout')).be.true();
          should(spy.calledWith('auth:afterLogout')).be.true();
        });
    });

    it('should emit an error if event emit raise an error', function () {
      this.timeout(50);

      kuzzle.pluginsManager.trigger = function (event) {
        if (event === 'auth:afterLogout' || event === 'auth:beforeLogout') {
          return q.reject();
        }
      };

      return should(kuzzle.funnel.controllers.auth.logout(requestObject, context)).be.rejected();
    });

    it('should expire token', function (done) {
      this.timeout(50);

      kuzzle.repositories.token.expire = function(token) {
        should(token).be.exactly(context.token);
        return q();
      };

      kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          done();
        })
        .catch(err => done(err));
    });

    it('should emit an error if token cannot be expired', function () {
      this.timeout(50);

      kuzzle.repositories.token.expire = function() {
        return q.reject();
      };

      return should(kuzzle.funnel.controllers.auth.logout(requestObject, context)).be.rejected();
    });

    it('should not remove room registration for connexion if there is no id', function (done) {
      var removeCustomerFromAllRooms = false;
      this.timeout(50);

      kuzzle.hotelClerk.removeCustomerFromAllRooms = function() {
        removeCustomerFromAllRooms = true;
        return q.reject();
      };

      delete context.connection.id;

      kuzzle.funnel.controllers.auth.logout(requestObject, context)
        .then(() => {
          should(removeCustomerFromAllRooms).be.exactly(false);
          done();
        })
        .catch(err => done(err));
    });

  });

  describe('#getCurrentUser', function () {
    it('should return the user given in the context', done => {
      var
        rq = new RequestObject({body: {}}),
        token = {
          token: {user: 'admin'}
        };

      kuzzle.funnel.controllers.auth.getCurrentUser(rq, token)
        .then(response => {
          should(response.data.body._id).be.exactly('admin');
          should(response.data.body._source.profile).be.exactly('admin');

          done();
        })
        .catch(error => done(error));
    });

    it('should return a falsey response if the current user is unknown', () => {
      var promise = kuzzle.funnel.controllers.auth.getCurrentUser(new RequestObject({
        body: {}
      }), {
        token: { user: 'unknown_user' }
      });

      return should(promise).be.rejected();
    });
  });

  describe('#checkToken', function () {
    var
      stubToken = {
        expiresAt: 42
      };

    beforeEach(function () {
      requestObject = new RequestObject({action: 'checkToken', controller: 'auth'}, {body: {token: 'foobar'}});
    });

    it('should return a rejected promise if no token is provided', function () {
      return should(kuzzle.funnel.controllers.auth.checkToken(new RequestObject({ body: {}}))).be.rejected();
    });

    it('should return a valid response if the token is valid', function (done) {
      kuzzle.repositories.token.verifyToken = arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return q(stubToken);
      };

      kuzzle.funnel.controllers.auth.checkToken(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.valid).be.true();
          should(response.data.body.state).be.undefined();
          should(response.data.body.expiresAt).be.eql(stubToken.expiresAt);
          done();
        })
        .catch(err => done(err));
    });

    it('should return a valid response if the token is not valid', function (done) {
      kuzzle.repositories.token.verifyToken = arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return q.reject({status: 401, message: 'foobar'});
      };

      kuzzle.funnel.controllers.auth.checkToken(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.valid).be.false();
          should(response.data.body.state).be.eql('foobar');
          should(response.data.body.expiresAt).be.undefined();
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if an error occurs', function () {
      kuzzle.repositories.token.verifyToken = arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return q.reject({status: 500});
      };

      return should(kuzzle.funnel.controllers.auth.checkToken(requestObject)).be.rejected();
    });
  });

  describe('#updateSelf', function () {
    var
      persistOptions,
      anotherKuzzle;

    before(function (done) {
      anotherKuzzle = new Kuzzle();
      anotherKuzzle.start(params, {dummy: true})
        .then(function () {
          anotherKuzzle.repositories.user.load = id => {
            if (id === 'anonymous') {
              return anotherKuzzle.repositories.user.anonymous();
            }
            if (id === 'admin') {
              return {_id: 'admin', _source: { profile: 'admin' }};
            }

            return q(null);
          };

          anotherKuzzle.repositories.user.persist = (user, opts) => {
            persistOptions = opts;
            return q(user);
          };

          done();
        });
    });

    beforeEach(function () {
      persistOptions = {};
    });

    it('should return a valid ResponseObject', done => {
      anotherKuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar' }
      }), { token: { user: 'admin', _id: 'admin' }})
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(persistOptions.database.method).be.exactly('update');
          should(response.data.body._id).be.exactly('admin');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject if profile is specified', () => {
      should(anotherKuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar', profile: 'test' }
      }), { token: { user: 'admin', _id: 'admin' }}))
        .be.rejected();
    });

    it('should reject if _id is specified in the body', () => {
      should(anotherKuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: { foo: 'bar', _id: 'test' }
      }), { token: { user: 'admin', _id: 'admin' }}))
        .be.rejected();
    });

    it('should reject a the promise if current user is anonymous', () => {
      should(anotherKuzzle.funnel.controllers.auth.updateSelf(new RequestObject({
        body: {
          foo: 'bar'
        }
      }), {
        token: {
          user: {
            _id: -1
          },
          _id: null
        }
      }))
        .be.rejected();
    });
  });

  describe('#getMyRights', function () {
    var
      rq = new RequestObject({body: {}}),
      token = {
        token: {user: 'test' }
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
