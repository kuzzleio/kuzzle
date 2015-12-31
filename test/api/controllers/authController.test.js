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

describe('Test the auth controller', function () {
  var kuzzle;

  before(function (done) {
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
              console.log(user);
          deferred.resolve(user);
          deferred.promise.nodeify(callback);
          return deferred.promise;
        }));
        done();
      });
  });

  it('should resolve to a valid jwt token if authentication succeed', function (done) {
    var requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'mockup', username: 'jdoe'} }, {}, 'unit-test');

    this.timeout(50);

    kuzzle.funnel.auth.login(requestObject)
      .then(function(response) {
        var decodedToken = jwt.verify(response.data.jwt, params.jsonWebToken.secret);
        should(decodedToken._id).be.equal('jdoe');
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should reject if authentication failure', function () {
    var requestObject = new RequestObject({ controller: 'auth', action: 'login', body: {strategy: 'nostrategy', username: 'jdoe'} }, {}, 'unit-test');
    this.timeout(50);
    return should(kuzzle.funnel.auth.login(requestObject)).be.rejectedWith('Unknown authentication strategy "nostrategy"');
  });
});
