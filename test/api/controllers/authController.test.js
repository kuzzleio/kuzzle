var
  should = require('should'),
  jwt = require('jsonwebtoken'),
  q = require('q'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  passport = require('passport'),
  util = require('util'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  requestObject,
  MockupWrapper,
  MockupStrategy;

require('should-promised');

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

  before(function (done) {
    requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'} }, {}, 'unit-test');
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        passport.use(new MockupStrategy( 'mockup', function(username, callback) {
          var
            deferred = q.defer();
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
    kuzzle.funnel.auth.login(requestObject)
      .then(function(response) {
        var decodedToken = jwt.verify(response.data.body.jwt, params.jsonWebToken.secret);
        should(decodedToken._id).be.equal('jdoe');
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should reject if authentication failure', function () {
    this.timeout(50);
    kuzzle.funnel.auth.passport = new MockupWrapper('reject');
    return should(kuzzle.funnel.auth.login(requestObject)).be.rejectedWith('Mockup Wrapper Error');
  });
});
