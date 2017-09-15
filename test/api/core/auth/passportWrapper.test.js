const
  should = require('should'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  mockrequire = require('mock-require'),
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  PassportResponse = require('../../../../lib/api/core/auth/passportResponse');

/**
 * @param name
 * @param verify
 * @constructor
 */
/*
class MockupStrategy extends passport.Strategy {
  constructor(name, verify) {
    super();
    this.name = name;
    this._verify = verify;
  }

  authenticate (req) {
    let username;

    if (req.body && req.body.username) {
      username = req.body.username;
    }

    const verified = (err, user, info) => {
      if (err) { 
        return this.error(err); 
      }

      if (!user) { 
        return this.fail(info); 
      }

      this.success(user, info);
      this.redirect(user);
    };

    try {
      this._verify(username, verified);
    } catch (ex) {
      return this.error(ex);
    }
  }
}
*/
describe('Test the passport Wrapper', () => {
  let 
    PassportWrapper,
    passportWrapper,
    passportMock;

  beforeEach(() => {
    passportMock = {
      use: sinon.stub(),
      unuse: sinon.stub(),
      authenticate: sinon.stub(),
      _strategy: sinon.stub().returns(true)
    };

    mockrequire('passport', passportMock);
    PassportWrapper = mockrequire.reRequire('../../../../lib/api/core/auth/passportWrapper');

    passportWrapper = new PassportWrapper(new Kuzzle());
/*
    passportWrapper.use(new MockupStrategy('mockup', (username, callback) => {
      callback(null, {
        _id: username,
        name: 'Johnny Cash'
      });
    }));

    passportWrapper.use(new MockupStrategy('null', (username, callback) => {
      callback(null, false, {message: 'Empty User'});
    }));

    passportWrapper.use(new MockupStrategy('error', (username, callback) => {
      callback(new ForbiddenError('Bad Credentials'));
    }));
*/
  });
/*
  it('should register and unregister strategies correctly', () => {
    const mock = new MockupStrategy('foobar', () => {});


    passportWrapper.use('foobar', mock);

    should(passportWrapper.options.foobar).be.an.Object().and.be.empty();

  });
*/
  it('should reject in case of unknown strategy', () => {
    passportMock._strategy.returns(false);

    return should(passportWrapper.authenticate('foo', 'bar'))
      .be.rejectedWith('Unknown authentication strategy "bar"');
  });

  it('should resolve to the user if credentials are verified', () => {
    const user = {username: 'jdoe'};

    passportMock.authenticate.yields(null, user);

    return should(passportWrapper.authenticate('foo', 'bar')).be.fulfilledWith(user);
  });

  it('should reject if passport does not return a user', () => {
    passportMock.authenticate.yields(null, null, new Error('foobar'));

    return should(passportWrapper.authenticate('foo', 'bar')).be.rejectedWith('foobar');
  });

  it('should reject in case of an authentication error', () => {
    passportMock.authenticate.yields(new Error('foobar'));

    return should(passportWrapper.authenticate('foo', 'bar')).be.rejectedWith(/^foobar/);
  });

  it('should return a PassportResponse if the strategy calls a HTTP redirection', () => {
    MockupStrategy.prototype.authenticate = function() {
      this.redirect('http://example.org');
    };
    return passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')
      .then(response => {
        should(response).be.an.instanceOf(PassportResponse);
        should(response.statusCode).be.equal(302);
        should(response.getHeader('Location')).be.equal('http://example.org');
      });
  });

  it('should reject a promise because an exception has been thrown', () => {
    MockupStrategy.prototype.authenticate = () => {
      throw new Error('exception');
    };
    return should(passportWrapper.authenticate({body: {username: 'jdoe'}}, 'mockup')).be.rejectedWith('exception');
  });
});
