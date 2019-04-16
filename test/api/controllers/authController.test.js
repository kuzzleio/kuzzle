const
  sinon = require('sinon'),
  should = require('should'),
  jwt = require('jsonwebtoken'),
  Bluebird = require('bluebird'),
  AuthController = require('../../../lib/api/controllers/authController'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Token = require('../../../lib/api/core/models/security/token'),
  User = require('../../../lib/api/core/models/security/user'),
  {
    Request,
    errors: {
      UnauthorizedError,
      BadRequestError,
      InternalError: KuzzleInternalError,
      PluginImplementationError
    }
  } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/controller');

describe('Test the auth controller', () => {
  let
    request,
    kuzzle,
    user,
    authController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.security.jwt.secret = 'test-secret';

    user = new User();
    kuzzle.passport.authenticate.returns(Bluebird.resolve(user));

    request = new Request({
      controller: 'auth',
      action: 'login',
      strategy: 'mockup',
      body: {
        username: 'jdoe'
      },
      foo: 'bar'
    });

    authController = new AuthController(kuzzle);

    return authController.init();
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(authController).instanceOf(BaseController);
    });
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(authController).instanceOf(BaseController);
    });
  });

  describe('#login', () => {
    it('should resolve to a valid jwt token if authentication succeed', () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      kuzzle.repositories.token.generateToken.resolves(token);

      return authController.login(request)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).calledWith('auth:strategyAuthenticated', {strategy: 'mockup', content: user});
          should(response).match({
            _id: 'foobar',
            jwt: 'bar',
            expiresAt: 4567,
            ttl: 1234
          });
          should(kuzzle.repositories.token.generateToken).calledWith(user, request, {});
        });
    });

    it('should modify the result according to auth:strategyAuthenticated pipe events', () => {
      kuzzle.pluginsManager.trigger = sinon.stub().withArgs('auth:strategyAuthenticated').returns({strategy: 'foobar', content: {foo: 'bar'}});

      return authController.login(request)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).calledWith('auth:strategyAuthenticated', {strategy: 'mockup', content: user});
          should(response).match({foo: 'bar'});
          should(kuzzle.repositories.token.generateToken).not.be.called();
        });
    });

    it('should handle strategy\'s headers and status code in case of multi-step authentication strategy', () => {
      const redir = {headers: {Location: 'http://github.com'}, statusCode: 302};

      kuzzle.passport.authenticate.resolves(redir);

      return authController.login(request)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).not.be.called();
          should(response.headers.Location).be.equal('http://github.com');
          should(response.statusCode).be.equal(302);
          should(request.status).be.equal(302);
          should(request.response).match({status: 302, result: response, headers: {Location: 'http://github.com'}});
          should(kuzzle.repositories.token.generateToken).not.be.called();
        });
    });

    it('should call passport.authenticate with input body and query string', () => {
      authController.login(request);
      should(kuzzle.passport.authenticate).be.calledOnce();
      should(kuzzle.passport.authenticate).be.calledWithMatch({body: {username: 'jdoe'}, query: {foo: 'bar'}});
    });

    it('should throw if no strategy is specified', () => {
      delete request.input.args.strategy;

      return should(() => {authController.login(request);})
        .throw();
    });

    it('should be able to set authentication expiration', () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      kuzzle.repositories.token.generateToken.resolves(token);

      request.input.args.expiresIn = '1s';

      return authController.login(request)
        .then(response => {
          should(response).match({
            _id: 'foobar',
            jwt: 'bar',
            expiresAt: 4567,
            ttl: 1234
          });
          should(kuzzle.repositories.token.generateToken).calledWith(user, request, {expiresIn: '1s'});
        });
    });

    it('should reject if authentication fails', () => {
      kuzzle.passport.authenticate.rejects(new Error('error'));

      return should(authController.login(request)).be.rejected();
    });
  });

  describe('#logout', () => {
    beforeEach(() => {
      const
        signedToken = jwt.sign({_id: 'admin'}, kuzzle.config.security.jwt.secret, {algorithm: kuzzle.config.security.jwt.algorithm}),
        t = new Token({
          _id: 'foo#' + signedToken,
          userId: 'foo',
          jwt: signedToken
        });

      request = new Request({
        controller: 'auth',
        action: 'logout',
        jwt: signedToken
      }, {
        connectionId: 'papagaya',
        token: t,
        user: { _id: 'foo' }
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

      kuzzle.repositories.token.expire.rejects(error);

      return should(authController.logout(request)).be.rejectedWith(KuzzleInternalError);
    });

    it('should throw if invoked by an anonymous user', () => {
      request.context.user._id = '-1';

      should(() => authController.logout(request)).throw(
        UnauthorizedError,
        {message: 'You must be authenticated to execute that action'});
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

    it('should a PluginImplementationError if a plugin throws a non-KuzzleError error', () => {
      const req = new Request({body: {}}, {token: {userId: 'admin'}, user: {_id: 'admin'}});

      kuzzle.pluginsManager.listStrategies.returns(['foo']);
      kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('bar')));

      return should(authController.getCurrentUser(req)).be.rejectedWith(PluginImplementationError);
    });
  });

  describe('#checkToken', () => {
    let testToken;

    beforeEach(() => {
      request = new Request({action: 'checkToken', controller: 'auth', body: {token: 'foobar'}}, {});
      testToken = new Token({expiresAt: 42});
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
      kuzzle.repositories.token.verifyToken.rejects(new UnauthorizedError('foobar'));

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
      kuzzle.repositories.token.verifyToken.rejects(error);

      return should(authController.checkToken(request)).be.rejectedWith(error);
    });
  });

  describe('#refreshToken', () => {
    it('should throw if the user is not authenticated', () => {
      return should(() => authController.refreshToken(new Request(
        {},
        {token: {userId: 'anonymous', _id: '-1'}, user: {_id: '-1'}}
      )))
        .throw(
          UnauthorizedError,
          {message: 'You must be authenticated to execute that action'});
    });

    it('should throw if the token has already been refreshed', () => {
      return should(() => authController.refreshToken(new Request(
        {},
        {
          token: {userId: 'foo', _id: 'bar', refreshed: true},
          user: {_id: 'bar'}
        }
      )))
        .throw(UnauthorizedError, {message: 'Invalid token'});
    });

    it('should provide a new jwt and expire the current one after the grace period', () => {
      const newToken = {
        _id: '_id',
        jwt: 'new-token',
        userId: 'userId',
        ttl: 'ttl',
        expiresAt: 42
      };

      kuzzle.repositories.token.generateToken.resolves(newToken);

      const req = new Request(
        { expiresIn: '42h' },
        {
          token: {
            userId: 'user',
            _id: '_id',
            jwt: 'jwt',
            refreshed: false
          },
          user: {
            _id: 'user'
          }
        }
      );

      return authController.refreshToken(req)
        .then(response => {
          should(response).eql({
            _id: 'userId',
            jwt: 'new-token',
            expiresAt: 42,
            ttl: 'ttl'
          });

          should(req.context.token.refreshed).be.true();

          should(kuzzle.repositories.token.persistToCache)
            .be.calledWith(
              req.context.token,
              {ttl: kuzzle.config.security.jwt.gracePeriod / 1000});

          should(kuzzle.repositories.token.generateToken)
            .be.calledWith(
              { _id: 'user' },
              req,
              { expiresIn: '42h' }
            );

          should(kuzzle.tokenManager.refresh)
            .calledWith(req.context.token, newToken);
        });
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
      const r = new Request(
        { body: {foo: 'bar'} },
        { token: {userId: '-1'}, user: {_id: '-1'} });

      should(() => authController.updateSelf(r)).throw(
        UnauthorizedError,
        {message: 'You must be authenticated to execute that action'});
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

  describe('Credentials', () => {
    describe('#createMyCredentials', () => {
      it('should call the plugin create method', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'createCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.createMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({foo: 'bar'});
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledTwice();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('create');
            should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[1]).be.eql('validate');
            should(methodStub).be.calledTwice();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
            should(methodStub.firstCall.args[2]).be.eql('someUserId');
            should(methodStub.firstCall.args[3]).be.eql('someStrategy');
            should(methodStub.secondCall.args[0]).be.eql(request);
            should(methodStub.secondCall.args[1]).be.deepEqual({some: 'credentials'});
            should(methodStub.secondCall.args[2]).be.eql('someUserId');
            should(methodStub.secondCall.args[3]).be.eql('someStrategy');
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is received', () => {
        request = new Request({
          controller: 'security',
          action: 'createCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });

        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.createMyCredentials(request)).be.rejectedWith(PluginImplementationError);
      });
    });

    describe('#updateMyCredentials', () => {
      it('should call the plugin update method', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'createCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.updateMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({foo: 'bar'});
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledTwice();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('update');
            should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[1]).be.eql('validate');
            should(methodStub).be.calledTwice();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
            should(methodStub.firstCall.args[2]).be.eql('someUserId');
            should(methodStub.firstCall.args[3]).be.eql('someStrategy');
            should(methodStub.secondCall.args[0]).be.eql(request);
            should(methodStub.secondCall.args[1]).be.deepEqual({some: 'credentials'});
            should(methodStub.secondCall.args[2]).be.eql('someUserId');
            should(methodStub.secondCall.args[3]).be.eql('someStrategy');
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is thrown', () => {
        request = new Request({
          controller: 'security',
          action: 'createCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.updateMyCredentials(request)).be.rejectedWith(PluginImplementationError);
      });
    });

    describe('#credentialsExist', () => {
      it('should call the plugin exists method', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'hasCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies = sinon.stub().returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod = sinon.stub().returns(methodStub);

        return authController.credentialsExist(request)
          .then(result => {
            should(result).be.deepEqual({foo: 'bar'});
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('exists');
            should(methodStub).be.calledOnce();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.eql('someUserId');
            should(methodStub.firstCall.args[2]).be.eql('someStrategy');
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin', () => {
        request = new Request({
          controller: 'security',
          action: 'hasCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.credentialsExist(request)).be.rejectedWith(PluginImplementationError);
      });
    });

    describe('#validateMyCredentials', () => {
      it('should call the plugin validate method', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'validateCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.validateMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({foo: 'bar'});
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('validate');
            should(methodStub).be.calledOnce();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
            should(methodStub.firstCall.args[2]).be.eql('someUserId');
            should(methodStub.firstCall.args[3]).be.eql('someStrategy');
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin', () => {
        request = new Request({
          controller: 'security',
          action: 'validateCredentials',
          strategy: 'someStrategy',
          body: {
            some: 'credentials'
          }
        }, {
          user: {
            _id: 'someUserId'
          }
        });

        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.validateMyCredentials(request)).be.rejectedWith(PluginImplementationError);
      });
    });

    describe('#deleteMyCredentials', () => {
      it('should call the plugin delete method', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'deleteCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.deleteMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({acknowledged: true});
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('delete');
            should(methodStub).be.calledOnce();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.eql('someUserId');
            should(methodStub.firstCall.args[2]).be.eql('someStrategy');
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin', () => {
        request = new Request({
          controller: 'security',
          action: 'deleteCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });

        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.deleteMyCredentials(request)).be.rejectedWith(PluginImplementationError);
      });
    });

    describe('#getMyCredentials', () => {
      it('should call the plugin getInfo method if it is provided', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'getCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.hasStrategyMethod.returns(true);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.getMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({foo: 'bar'});
            should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getInfo');
            should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('getInfo');
            should(methodStub).be.calledOnce();
            should(methodStub.firstCall.args[0]).be.eql(request);
            should(methodStub.firstCall.args[1]).be.eql('someUserId');
            should(methodStub.firstCall.args[2]).be.eql('someStrategy');
          });
      });

      it('should resolve to an empty object if getInfo method is not provided', () => {
        const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
        request = new Request({
          controller: 'security',
          action: 'getCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });
        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.hasStrategyMethod.returns(false);
        kuzzle.pluginsManager.getStrategyMethod.returns(methodStub);

        return authController.getMyCredentials(request)
          .then(result => {
            should(result).be.deepEqual({});
            should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
            should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
            should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getInfo');
            should(kuzzle.pluginsManager.getStrategyMethod.callCount).be.eql(0);
          });
      });

      it('should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin', () => {
        request = new Request({
          controller: 'security',
          action: 'getCredentials',
          strategy: 'someStrategy'
        }, {
          user: {
            _id: 'someUserId'
          }
        });

        kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
        kuzzle.pluginsManager.hasStrategyMethod.returns(true);
        kuzzle.pluginsManager.getStrategyMethod.returns(() => Bluebird.reject(new Error('foo')));

        return should(authController.getMyCredentials(request)).be.rejectedWith(PluginImplementationError);
      });
    });
  });
});
