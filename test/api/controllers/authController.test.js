const
  should = require('should'),
  jwt = require('jsonwebtoken'),
  Bluebird = require('bluebird'),
  /** @type KuzzleConfiguration */
  params = require('../../../lib/config'),
  AuthController = require('../../../lib/api/controllers/authController'),
  Kuzzle = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  Token = require('../../../lib/api/core/models/security/token'),
  {
    UnauthorizedError,
    BadRequestError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

describe('Test the auth controller', () => {
  let
    request,
    kuzzle,
    authController;

  beforeEach(() => {
    kuzzle = new Kuzzle();

    request = new Request({
      controller: 'auth',
      action: 'login',
      body: {
        strategy: 'mockup',
        username: 'jdoe'
      }
    });

    authController = new AuthController(kuzzle);
  });

  describe('#login', () => {
    it('should resolve to a valid jwt token if authentication succeed', () => {
      const token = new Token();

      token._id = 'foo';
      token.jwt = 'bar';
      token.userId = 'foobar';

      kuzzle.repositories.token.generateToken.returns(Bluebird.resolve(token));

      return authController.login(request)
        .then(response => {
          should(response).match({_id: 'foobar', jwt: 'foo'});
          should(kuzzle.repositories.token.generateToken).calledWith({}, request, {});
        });
    });

    it('should resolve to a redirect url', () => {
      kuzzle.passport.authenticate.returns(Bluebird.resolve({headers: {Location: 'http://github.com'}}));

      return authController.login(request)
        .then(response => {
          should(response.headers.Location).be.equal('http://github.com');
        });
    });

    it('should use local strategy if no one is set', () => {
      delete request.input.body.strategy;

      return authController.login(request)
        .then(() => {
          should(kuzzle.passport.authenticate).calledWith({query: request.input.body, original: request}, 'local');
        });
    });

    it('should be able to set authentication expiration', () => {
      const token = new Token();

      token._id = 'foo';
      token.jwt = 'bar';
      token.userId = 'foobar';

      kuzzle.repositories.token.generateToken.returns(Bluebird.resolve(token));

      request.input.body.expiresIn = '1s';

      return authController.login(request)
        .then(response => {
          should(response).match({_id: 'foobar', jwt: 'foo'});
          should(kuzzle.repositories.token.generateToken).calledWith({}, request, {expiresIn: '1s'});
        });
    });

    it('should reject if authentication fails', () => {
      kuzzle.passport.authenticate.returns(Bluebird.reject(new Error('error')));

      return should(authController.login(request)).be.rejected();
    });
  });

  describe('#logout', () => {
    beforeEach(() => {
      const
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
    });

    it('should expire token', () => {
      return authController.logout(request)
        .then(response => {
          should(kuzzle.repositories.token.expire).calledWith(request.context.token);
          should(response.responseObject).be.instanceof(Object);
        });
    });

    it('should emit an error if the token cannot be expired', () => {
      const error = new Error('Mocked error');

      kuzzle.repositories.token.expire.returns(Bluebird.reject(error));

      return should(authController.logout(request)).be.rejectedWith(KuzzleInternalError);
    });
  });

  describe('#getCurrentUser', () => {
    it('should return the user given in the context', () => {
      const req = new Request({body: {}}, {token: {userId: 'admin'}, user: {_id: 'admin'}});

      return authController.getCurrentUser(req)
        .then(response => {
          should(response).match(req.context.user);
        });
    });
  });

  describe('#checkToken', () => {
    let testToken;

    beforeEach(() => {
      request = new Request({action: 'checkToken', controller: 'auth', body: {token: 'foobar'}}, {});
      testToken = new Token();
      testToken.expiresAt = 42;
    });

    it('should throw an error if no token is provided', () => {
      return should(() => {
        authController.checkToken(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should return a valid response if the token is valid', () => {
      kuzzle.repositories.token.verifyToken.returns(Bluebird.resolve(testToken));

      return authController.checkToken(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.valid).be.true();
          should(response.state).be.undefined();
          should(response.expiresAt).be.eql(testToken.expiresAt);
          should(kuzzle.repositories.token.verifyToken).calledWith(request.input.body.token);
        });
    });

    it('should return a valid response if the token is not valid', () => {
      kuzzle.repositories.token.verifyToken.returns(Bluebird.reject(new UnauthorizedError('foobar')));

      return authController.checkToken(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.valid).be.false();
          should(response.state).be.eql('foobar');
          should(response.expiresAt).be.undefined();
          should(kuzzle.repositories.token.verifyToken).calledWith(request.input.body.token);
        });
    });

    it('should return a rejected promise if an error occurs', () => {
      const error = new KuzzleInternalError('Foobar');
      kuzzle.repositories.token.verifyToken.returns(Bluebird.reject(error));

      return should(authController.checkToken(request)).be.rejectedWith(error);
    });
  });

  describe('#updateSelf', () => {
    const opts = {database: {method: 'update'}};

    it('should return a valid response', () => {
      return authController.updateSelf(new Request(
        {body: {foo: 'bar'}},
        {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
      ))
        .then(response => {
          should(response).be.instanceof(Object);
          should(kuzzle.repositories.user.persist).calledWith({_id: 'admin', foo: 'bar'}, opts);
        });
    });

    it('should throw an error if profile is specified', () => {
      should(() => {
        authController.updateSelf(new Request(
          {body: {foo: 'bar', profileIds: ['test']}},
          {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
        ));
      }).throw(BadRequestError);
    });

    it('should throw an error if _id is specified in the body', () => {
      should(() => {
        authController.updateSelf(new Request(
          {body: {foo: 'bar', _id: 'test'}},
          {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}}
        ));
      }).throw(BadRequestError);
    });

    it('should throw an error if current user is anonymous', () => {
      should(() => {
        authController.updateSelf(new Request({body: {foo: 'bar'}}, {token: {userId: '-1'}, user: {_id: '-1'}}));
      }).throw(UnauthorizedError);
    });
  });

  describe('#getMyRights', () => {
    const req = new Request({body: {}}, {token: {userId: 'test'}, user: {
      _id: 'test',
      getRights: () => {
        return Bluebird.resolve({
          rights1: {controller: 'read', action: 'get', index: 'foo', collection: 'bar', value: 'allowed'},
          rights2: {controller: 'write', action: 'delete', index: '*', collection: '*', value: 'conditional'}
        });
      }
    }});

    it('should be able to get current user\'s rights', () => {
      return authController.getMyRights(req)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          let filteredItem = response.hits.filter(item => {
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
      should(kuzzle.pluginsManager.listStrategies).be.a.Function();

      return authController.getStrategies()
        .then(result => {
          should(kuzzle.pluginsManager.listStrategies).calledOnce();
          should(result).be.instanceof(Array).of.length(0);
        });
    });
  });
});
