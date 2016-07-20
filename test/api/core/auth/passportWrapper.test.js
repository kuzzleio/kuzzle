var
  should = require('should'),
  passport = require('passport'),
  util = require('util'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  ForbiddenError = require.main.require('kuzzle-common-objects').Errors.forbiddenError,
  PassportWrapper = require.main.require('lib/api/core/auth/passportWrapper'),
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

describe('Test the passport Wrapper', function () {
  var
    kuzzle,
    passportWrapper;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        passportWrapper = new PassportWrapper(kuzzle);

        passport.use(new MockupStrategy('mockup', function(username, callback) {
          callback(null, {
            _id: username,
            name: 'Johnny Cash'
          });
        }));

        passport.use(new MockupStrategy('null', function(username, callback) {
          callback(null, false, {message: 'Empty User'});
        }));

        passport.use(new MockupStrategy('error', function(username, callback) {
          callback(new ForbiddenError('Bad Credentials'));
        }));

        done();
      });
  });

  it('should reject in case of unknown strategy', function () {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'nostrategy')).be.rejectedWith('Unknown authentication strategy "nostrategy"');
  });

  it('should resolve to the user if good credentials', function (done) {
    passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')
      .then(function (userObject) {
        should(userObject._id).be.equal('jdoe');
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should reject if user is null', function () {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'null')).be.rejectedWith('Empty User');
  });

  it('should reject in case of authenticate error', function () {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'error')).be.rejectedWith('Bad Credentials');
  });

  it('should reject a promise because an exception has been thrown', function() {
    MockupStrategy.prototype.authenticate = function() {
      throw new Error('exception');
    };
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')).be.rejectedWith('exception');
  });
});
