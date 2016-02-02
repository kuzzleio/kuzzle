var
  should = require('should'),
  jwt = require('jsonwebtoken'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  passport = require('passport'),
  util = require('util'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  Token = require.main.require('lib/api/core/models/security/token'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  context = {},
  requestObject,
  MockupWrapper,
  MockupStrategy;

MockupStrategy = function(name, verify) {
  var options = {};

  passport.Strategy.call(this);
  this.name = name;
  this._verify = verify;

};
util.inherits(MockupStrategy, passport.Strategy);

MockupStrategy.prototype.authenticate = function(req, options) {
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
  this.authenticate = function(request, strategy){
    var deferred = q.defer();
    if (MockupReturn === 'resolve') {
      deferred.resolve({_id: request.body.username});
    }
    else {
      deferred.reject(new Error('Mockup Wrapper Error'));
    }
    return deferred.promise;
  };
};

describe('Test the auth controller', function () {
  var kuzzle;

  describe('#login', function () {
    beforeEach(function (done) {
      requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'} }, {}, 'unit-test');
      kuzzle = new Kuzzle();
      kuzzle.start(params, {dummy: true})
        .then(function () {

          kuzzle.repositories.user.load = function(t) {
            var deferred = q.defer();

            deferred.resolve({
              _id: t,
              profile: 'anonymous'
            });

            return deferred;
          };

          passport.use(new MockupStrategy('mockup', function(username, callback) {
            var
              deferred = q.defer(),
              user = {
                _id: username
              };
            deferred.resolve(user);
            deferred.promise.nodeify(callback);
            return deferred.promise;
          }));

          done();
        });
    });

    it('should resolve to a valid jwt token if authentication succeed', function (done) {
      this.timeout(50);

      kuzzle.funnel.auth.passport = new MockupWrapper('resolve');
      kuzzle.funnel.auth.login(requestObject, {})
        .then(function(response) {
          var decodedToken = jwt.verify(response.data.body.jwt, params.jsonWebToken.secret);
          should(decodedToken._id).be.equal('jdoe');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should use local strategy if no one is set', function (done) {
      this.timeout(50);

      kuzzle.funnel.auth.passport = {
        authenticate: function(data, strategy) {
          should(strategy).be.exactly('local');
          done();
          return q.reject();
        }
      };

      delete requestObject.data.body.strategy;

      kuzzle.funnel.auth.login(requestObject, {});
    });

    it('should be able to set authentication expiration', function (done) {
      this.timeout(1100);

      requestObject.data.body.expiresIn = '1s';

      kuzzle.funnel.auth.passport = new MockupWrapper('resolve');
      kuzzle.funnel.auth.login(requestObject, {connection: {id: 'banana'}})
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

    it('should register token in tokenizedConnectionsController when a connexion id is set', function (done) {
      context = {
        connection: {
          id: 'banana'
        }
      };

      requestObject.data.body.expiresIn = '1m';

      kuzzle.hotelClerk.tokenizedConnectionsController.add = function(token, context) {
        should(token).be.an.instanceOf(Token);
        should(token.ttl).be.exactly(60000);
        should(token.expiresAt).be.approximately(Date.now() + token.ttl, 30);
        done();
      };

      kuzzle.funnel.auth.passport = new MockupWrapper('resolve');
      kuzzle.funnel.auth.login(requestObject, context)
        .catch(function (error) {
          done(error);
        });
    });

    it('should reject if authentication failure', function (done) {
      this.timeout(50);
      kuzzle.funnel.auth.passport = new MockupWrapper('reject');
      kuzzle.funnel.auth.login(requestObject)
        .catch((error) => {
          should(error).be.an.instanceOf(ResponseObject);
          should(error.error.message).be.exactly('Mockup Wrapper Error');
          done();
        });
    });
  });
  describe('#logout', function () {

    beforeEach(function (done) {
      var signedToken = jwt.sign({_id: 'admin'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      requestObject = new RequestObject({
        controller: 'auth',
        action: 'logout',
        header: {
          authorization: 'Bearer ' + signedToken
        }
      }, {}, 'unit-test');
      kuzzle = new Kuzzle();
      kuzzle.start(params, {dummy: true})
        .then(kuzzle.repositories.user.admin())
        .then(function (user) {
          var t = new Token();
          t._id = signedToken;
          t.user = user;

          context = {
            connection: {
              id: 'papagaya'
            },
            token: t
          };

          done();
        });
    });

    it('should emit a auth:logout event', function (done) {
      this.timeout(50);

      kuzzle.pluginsManager.trigger = function (event) {
        if (event === 'auth:logout') {
          return q();
        }
      };

      kuzzle.funnel.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          done();
        })
        .catch(err => done(err));
    });

    it('should emit an error if event emit raise an error', function () {
      this.timeout(50);

      kuzzle.pluginsManager.trigger = function (event) {
        if (event === 'auth:logout') {
          return q.reject();
        }
      };

      return should(kuzzle.funnel.auth.logout(requestObject, context)).be.rejectedWith(ResponseObject);
    });

    it('should expire token', function (done) {
      this.timeout(50);

      kuzzle.repositories.token.expire = function(token) {
        should(token).be.exactly(context.token);
        return q();
      };

      kuzzle.funnel.auth.logout(requestObject, context)
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

      return should(kuzzle.funnel.auth.logout(requestObject, context)).be.rejectedWith(ResponseObject);
    });

    it('should remove all room registration for current connexion', function (done) {
      this.timeout(50);

      kuzzle.hotelClerk.removeCustomerFromAllRooms = function(connection) {
        should(connection).be.exactly(context.connection);
        return q();
      };

      kuzzle.funnel.auth.logout(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          done();
        })
        .catch(err => done(err));
    });

    it('should not remove room registration for connexion if there is no id', function (done) {
      var removeCustomerFromAllRooms = false;
      this.timeout(50);

      kuzzle.hotelClerk.removeCustomerFromAllRooms = function() {
        removeCustomerFromAllRooms = true;
        return q.reject();
      };

      delete context.connection.id;

      kuzzle.funnel.auth.logout(requestObject, context)
        .then(() => {
          should(removeCustomerFromAllRooms).be.exactly(false);
          done();
        })
        .catch(err => done(err));
    });
  });

  describe('#getCurrentUser', function () {
    it('should return the user given in the context', done => {
      kuzzle.funnel.auth.getCurrentUser(new RequestObject({
        body: {}
      }), {
        token: { user: { _id: 'admin' } }
      })
        .then(response => {
          should(response.data.body._id).be.exactly('admin');
          should(response.data.body._source).be.an.instanceOf(User);
          should(response.data.body._source.profile).be.an.instanceOf(Profile);
          should(response.data.body._source.profile._id).be.exactly('admin');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should return a falsey response if the current user is unknown', done => {
      kuzzle.funnel.auth.getCurrentUser(new RequestObject({
        body: {}
      }), {
        token: { user: { _id: 'Carmen Sandiego' } }
      })
        .then(response => {
          should(response.data.body._id).be.undefined();
          should(response.data.body.found).be.false();
          done();
        })
        .catch(error => { done(error); });
    });

    it('should return a non-hydrated response if hydrate===false', done => {
      kuzzle.funnel.auth.getCurrentUser(new RequestObject({
        body: {hydrate: false}
      }), {
        token: { user: { _id: 'admin' } }
      })
        .then(response => {
          should(response.data.body._id).be.exactly('admin');
          should(response.data.body._source).not.be.an.instanceOf(User);
          should(response.data.body._source.profile).not.be.an.instanceOf(Profile);
          should(response.data.body._source.name).be.a.String();
          should(response.data.body._source.profile).be.eql('admin');

          done();
        })
        .catch(error => { done(error); });
    });
  });

  describe('#checkToken', function () {
    var
      stubToken = {
        expiresAt: 42
      };

    beforeEach(function () {
      requestObject = new RequestObject({
          action: 'checkToken',
          controller: 'auth'
        },
        {body: {token: 'foobar'}});
      kuzzle = new Kuzzle();
      return kuzzle.start(params, {dummy: true});
    });

    it('should return a rejected promise if no token is provided', function () {
      return should(kuzzle.funnel.auth.checkToken(new RequestObject({ body: {}}))).be.rejectedWith(BadRequestError);
    });

    it('should return a valid response if the token is valid', function (done) {
      kuzzle.repositories.token.verifyToken = arg => {
        should(arg).be.eql(requestObject.data.body.token);
        return q(stubToken);
      };

      kuzzle.funnel.auth.checkToken(requestObject)
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

      kuzzle.funnel.auth.checkToken(requestObject)
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

      return should(kuzzle.funnel.auth.checkToken(requestObject)).be.rejected();
    });
  });
});
