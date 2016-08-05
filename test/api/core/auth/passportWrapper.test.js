var
  should = require('should'),
  passport = require('passport'),
  util = require('util'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
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

describe('Test the passport Wrapper', () => {
  var
    kuzzle,
    passportWrapper;

  before(() => {
    kuzzle = new Kuzzle();
    passportWrapper = new PassportWrapper(kuzzle);

    passport.use(new MockupStrategy('mockup', (username, callback) => {
      callback(null, {
        _id: username,
        name: 'Johnny Cash'
      });
    }));

    passport.use(new MockupStrategy('null', (username, callback) => {
      callback(null, false, {message: 'Empty User'});
    }));

    passport.use(new MockupStrategy('error', (username, callback) => {
      callback(new ForbiddenError('Bad Credentials'));
    }));

  });

  it('should reject in case of unknown strategy', () => {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'nostrategy')).be.rejectedWith('Unknown authentication strategy "nostrategy"');
  });

  it('should resolve to the user if good credentials', done => {
    passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')
      .then(userObject => {
        should(userObject._id).be.equal('jdoe');
        done();
      })
      .catch(err =>done(err));
  });

  it('should reject if user is null', () => {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'null')).be.rejectedWith('Empty User');
  });

  it('should reject in case of authenticate error', () => {
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'error')).be.rejectedWith('Bad Credentials');
  });

  it('should reject a promise because an exception has been thrown', () => {
    MockupStrategy.prototype.authenticate = () => {
      throw new Error('exception');
    };
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')).be.rejectedWith('exception');
  });
});
