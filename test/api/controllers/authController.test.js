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
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  Token = require.main.require('lib/api/core/models/security/token'),
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

    it('should emit a auth:logout event', function () {
      this.timeout(50);

      kuzzle.pluginsManager.trigger = function (event) {
        should(event).be.exactly('auth:logout');
        return q();
      };

      should(kuzzle.funnel.auth.logout(requestObject, context)).be.fulfilledWith(ResponseObject);
    });

    it('should emit an error if event emit raise an error', function () {
      this.timeout(50);

      kuzzle.pluginsManager.trigger = function (event) {
        return q.reject();
      };

      should(kuzzle.funnel.auth.logout(requestObject, context)).be.rejectedWith(InternalError);
    });

    it('should expire token', function () {
      this.timeout(50);

      kuzzle.repositories.token.expire = function(token) {
        should(token).be.exactly(context.token);
        return q();
      };

      should(kuzzle.funnel.auth.logout(requestObject, context)).be.fulfilledWith(ResponseObject);
    });

    it('should emit an error if token cannot be expired', function () {
      this.timeout(50);

      kuzzle.repositories.token.expire = function() {
        return q.reject();
      };

      should(kuzzle.funnel.auth.logout(requestObject, context)).be.rejectedWith(InternalError);
    });

    it('should remove all room registration for current connexion', function () {
      this.timeout(50);

      kuzzle.hotelClerk.removeCustomerFromAllRooms = function(connection) {
        should(connection).be.exactly(context.connection);
        return q();
      };

      should(kuzzle.funnel.auth.logout(requestObject, context)).be.fulfilledWith(ResponseObject);
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
});
