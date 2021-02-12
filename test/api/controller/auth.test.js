'use strict';

const sinon = require('sinon');
const should = require('should');
const jwt = require('jsonwebtoken');
const Bluebird = require('bluebird');

const {
  Request,
  UnauthorizedError,
  BadRequestError,
  InternalError: KuzzleInternalError,
  PluginImplementationError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const AuthController = require('../../../lib/api/controller/auth');
const Token = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user');
const { NativeController } = require('../../../lib/api/controller/base');

describe('Test the auth controller', () => {
  let request;
  let requestCookieOnly;
  let kuzzle;
  let user;
  let authController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.security.jwt.secret = 'test-secret';
    kuzzle.config.http.supportCookieAuthentication = false;
    kuzzle.ask.withArgs('core:security:user:anonymous:get').resolves({_id: '-1'});

    user = new User();
    kuzzle.passport.authenticate.returns(Bluebird.resolve(user));
    kuzzle.pluginsManager.strategies.mockup = {};
    request = new Request({
      controller: 'auth',
      action: 'login',
      strategy: 'mockup',
      body: {
        username: 'jdoe'
      },
      foo: 'bar'
    });

    requestCookieOnly = new Request({
      controller: 'auth',
      action: 'login',
      strategy: 'mockup',
      body: {
        username: 'jdoe'
      },
      foo: 'bar',
      cookieOnly: true
    });

    requestCookieOnly.input.headers = {cookie: 'authToken=;'};

    authController = new AuthController();

    return authController.init();
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(authController).instanceOf(NativeController);
    });
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(authController).instanceOf(NativeController);
    });
  });

  describe('#checkRights', () => {
    let userObject;

    beforeEach(() => {
      userObject = {
        isActionAllowed: sinon.stub().resolves(true)
      };

      request.context.user = userObject;

      request.input.body = {
        controller: 'document',
        action: 'create'
      };
    });

    it('should check if the action is allowed for the user', async () => {
      const response = await authController.checkRights(request);

      should(userObject.isActionAllowed).be.calledWithMatch({
        input: {
          controller: 'document',
          action: 'create',
        }
      });
      should(response).be.eql({ allowed: true });
    });

    it('should reject if the provided request is not valid', async () => {
      request.input.body.controller = null;

      await should(authController.checkRights(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });

      request.input.body.controller = 'document';
      request.input.body.action = null;

      await should(authController.checkRights(request))
        .be.rejectedWith({ id: 'api.assert.missing_argument' });
    });
  });

  describe('#login', () => {
    let createTokenStub;

    beforeEach(() => {
      createTokenStub = kuzzle.ask.withArgs('core:security:token:create');
    });

    it('should resolve to a valid jwt token if authentication succeed', async () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.tokenManager.getConnectedUserToken.resolves(null);

      const response = await authController.login(request);

      should(kuzzle.pipe).calledWith('auth:strategyAuthenticated', {
        strategy: 'mockup',
        content: user
      });

      should(response).match({
        _id: 'foobar',
        jwt: 'bar',
        expiresAt: 4567,
        ttl: 1234
      });

      should(createTokenStub).calledOnce();
    });

    it('should refresh the token if it already exists', async () => {
      const existingToken = new Token({
        _id: 'foobar#foo',
        jwt: 'foo',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.tokenManager.getConnectedUserToken.returns(existingToken);

      await authController.login(request);

      should(kuzzle.tokenManager.getConnectedUserToken).be.called();
      should(kuzzle.tokenManager.refresh).be.calledWith(existingToken, token);
    });

    it('should modify the result according to auth:strategyAuthenticated pipe events', async () => {
      kuzzle.pipe
        .withArgs('auth:strategyAuthenticated')
        .resolves({strategy: 'foobar', content: {foo: 'bar'}});

      const response = await authController.login(request);

      should(kuzzle.pipe).calledWith('auth:strategyAuthenticated', {
        strategy: 'mockup',
        content: user
      });
      should(response).match({foo: 'bar'});
      should(createTokenStub).not.be.called();
    });

    it('should handle strategy\'s headers and status code in case of multi-step authentication strategy', async () => {
      const redir = {headers: {Location: 'http://github.com'}, statusCode: 302};

      kuzzle.passport.authenticate.resolves(redir);

      const response = await authController.login(request);

      should(kuzzle.pipe).not.be.called();
      should(response.headers.Location).be.equal('http://github.com');
      should(response.statusCode).be.equal(302);
      should(request.status).be.equal(302);
      should(request.response).match({
        status: 302,
        result: response,
        headers: {Location: 'http://github.com'}
      });

      should(kuzzle.ask.withArgs('core:security:token:create')).not.be.called();
    });

    it('should call passport.authenticate with input body and query string', async () => {
      createTokenStub.resolves(new Token());
      await authController.login(request);

      should(kuzzle.passport.authenticate)
        .be.calledOnce()
        .be.calledWithMatch({
          body: { username: 'jdoe' },
          query: { foo: 'bar' }
        });
    });

    it('should reject if no strategy is specified', () => {
      delete request.input.args.strategy;

      return should(authController.login(request))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "strategy".'
        });
    });

    it('should be able to set authentication expiration', async () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.passport.authenticate.resolves(user);

      request.input.args.expiresIn = '1s';

      const response = await authController.login(request);

      should(response).match({
        _id: 'foobar',
        jwt: 'bar',
        expiresAt: 4567,
        ttl: 1234
      });

      should(createTokenStub).be.calledWith(
        'core:security:token:create',
        user,
        { expiresIn: '1s' });
    });

    it('should reject if authentication fails', () => {
      kuzzle.passport.authenticate.rejects(new Error('error'));

      return should(authController.login(request)).be.rejected();
    });

    it('should reject in case of unknown strategy', () => {
      request.input.args.strategy = 'foobar';

      return should(authController.login(request))
        .rejectedWith(BadRequestError, {
          id: 'security.credentials.unknown_strategy'
        });
    });
  });

  describe('#login with cookies', () => {
    let createTokenStub;

    beforeEach(() => {
      kuzzle.config.http.supportCookieAuthentication = true;
      createTokenStub = kuzzle.ask.withArgs('core:security:token:create');
    });

    it('should resolve to a valid jwt token in the header if authentication succeed ', async () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.tokenManager.getConnectedUserToken.resolves(null);

      const response = await authController.login(requestCookieOnly);

      should(kuzzle.pipe).calledWith('auth:strategyAuthenticated', {
        strategy: 'mockup',
        content: user
      });

      should.exists(requestCookieOnly.response.headers);
      should.exists(requestCookieOnly.response.headers['Set-Cookie']);
      should(requestCookieOnly.response.headers['Set-Cookie']).be.an.Array()
        .and.match(/authToken=bar; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Strict/);

      should(response).be.deepEqual({
        _id: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      should(createTokenStub).calledOnce();
    });

    it('should refresh the token if it already exists', async () => {
      const existingToken = new Token({
        _id: 'foobar#foo',
        jwt: 'foo',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.tokenManager.getConnectedUserToken.returns(existingToken);

      const response = await authController.login(requestCookieOnly);

      should(kuzzle.tokenManager.getConnectedUserToken).be.called();
      should(kuzzle.tokenManager.refresh).be.calledWith(existingToken, token);

      should.exists(requestCookieOnly.response.headers);
      should.exists(requestCookieOnly.response.headers['Set-Cookie']);
      should(requestCookieOnly.response.headers['Set-Cookie']).be.an.Array()
        .and.match(/authToken=bar; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Strict/);

      should(response).be.deepEqual({
        _id: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

    });

    it('should modify the result according to auth:strategyAuthenticated pipe events', async () => {
      kuzzle.pipe
        .withArgs('auth:strategyAuthenticated')
        .resolves({strategy: 'foobar', content: {foo: 'bar'}});

      const response = await authController.login(requestCookieOnly);

      should(kuzzle.pipe).calledWith('auth:strategyAuthenticated', {
        strategy: 'mockup',
        content: user
      });
      should(response).match({foo: 'bar'});
      should(createTokenStub).not.be.called();
    });

    it('should handle strategy\'s headers and status code in case of multi-step authentication strategy', async () => {
      const redir = {headers: {Location: 'http://github.com'}, statusCode: 302};

      kuzzle.passport.authenticate.resolves(redir);

      const response = await authController.login(requestCookieOnly);

      should(kuzzle.pipe).not.be.called();
      should(response.headers.Location).be.equal('http://github.com');
      should(response.statusCode).be.equal(302);
      should(requestCookieOnly.status).be.equal(302);
      should(requestCookieOnly.response).match({
        status: 302,
        result: response,
        headers: {Location: 'http://github.com'}
      });

      should(kuzzle.ask.withArgs('core:security:token:create')).not.be.called();
    });

    it('should call passport.authenticate with input body and query string', async () => {
      createTokenStub.resolves(new Token());
      await authController.login(requestCookieOnly);

      should(kuzzle.passport.authenticate)
        .be.calledOnce()
        .be.calledWithMatch({
          body: { username: 'jdoe' },
          query: { foo: 'bar' }
        });
    });

    it('should reject if no strategy is specified', () => {
      delete requestCookieOnly.input.args.strategy;

      return should(authController.login(requestCookieOnly))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "strategy".'
        });
    });

    it('should be able to set authentication expiration', async () => {
      const token = new Token({
        _id: 'foobar#bar',
        jwt: 'bar',
        userId: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      createTokenStub.resolves(token);
      kuzzle.passport.authenticate.resolves(user);

      requestCookieOnly.input.args.expiresIn = '1s';

      const response = await authController.login(requestCookieOnly);

      should.exists(requestCookieOnly.response.headers);
      should.exists(requestCookieOnly.response.headers['Set-Cookie']);
      should(requestCookieOnly.response.headers['Set-Cookie']).be.an.Array()
        .and.match(/authToken=bar; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Strict/);

      should(response).be.deepEqual({
        _id: 'foobar',
        expiresAt: 4567,
        ttl: 1234
      });

      should(createTokenStub).be.calledWith(
        'core:security:token:create',
        user,
        { expiresIn: '1s' });
    });

    it('should reject if authentication fails', () => {
      kuzzle.passport.authenticate.rejects(new Error('error'));

      return should(authController.login(requestCookieOnly)).be.rejected();
    });

    it('should reject in case of unknown strategy', () => {
      requestCookieOnly.input.args.strategy = 'foobar';

      return should(authController.login(requestCookieOnly))
        .rejectedWith(BadRequestError, {
          id: 'security.credentials.unknown_strategy'
        });
    });
  });

  describe('#logout', () => {
    beforeEach(() => {
      const signedToken = jwt.sign(
        {_id: 'admin'},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});
      const t = new Token({
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

    it('should expire token', async () => {
      const response = await authController.logout(request);

      should(kuzzle.ask)
        .calledWith('core:security:token:delete', request.context.token);

      should(response.responseObject).be.instanceof(Object);
    });

    it('should expire all tokens at once', async () => {
      request.input.args.global = true;

      await authController.logout(request);

      should(kuzzle.ask).calledWith('core:security:token:deleteByKuid', 'foo');
    });

    it('should emit an error if the token cannot be expired', () => {
      const error = new Error('Mocked error');

      kuzzle.ask.withArgs('core:security:token:delete').rejects(error);

      return should(authController.logout(request)).be.rejectedWith(error);
    });

    it('should reject if invoked by an anonymous user', () => {
      request.context.user._id = '-1';

      return should(authController.logout(request)).rejectedWith(
        UnauthorizedError,
        {id: 'security.rights.unauthorized'});
    });
  });

  describe('#logout with cookies', () => {
    beforeEach(() => {
      kuzzle.config.http.supportCookieAuthentication = true;

      const signedToken = jwt.sign(
        {_id: 'admin'},
        kuzzle.config.security.jwt.secret,
        {algorithm: kuzzle.config.security.jwt.algorithm});
      const t = new Token({
        _id: 'foo#' + signedToken,
        userId: 'foo',
        jwt: signedToken
      });

      request = new Request({
        controller: 'auth',
        action: 'logout',
        cookieOnly: true,
      }, {
        connectionId: 'papagaya',
        token: t,
        user: { _id: 'foo' }
      });

      request.input.headers = {cookie: `authToken=${signedToken};`};
    });

    it('should nullify the authToken cookie', async () => {
      await authController.logout(request);

      should.exists(request.response.headers);
      should.exists(request.response.headers['Set-Cookie']);
      should(request.response.headers['Set-Cookie']).be.an.Array()
        .and.match(/authToken=null; Path=\/; HttpOnly; SameSite=Strict/);
    });

    it('should expire token', async () => {
      const response = await authController.logout(request);

      should(kuzzle.ask)
        .calledWith('core:security:token:delete', request.context.token);

      should(response.responseObject).be.instanceof(Object);
    });

    it('should expire all tokens at once', async () => {
      request.input.args.global = true;

      await authController.logout(request);

      should(kuzzle.ask).calledWith('core:security:token:deleteByKuid', 'foo');
    });

    it('should emit an error if the token cannot be expired', () => {
      const error = new Error('Mocked error');

      kuzzle.ask.withArgs('core:security:token:delete').rejects(error);

      return should(authController.logout(request)).be.rejectedWith(error);
    });

    it('should reject if invoked by an anonymous user', () => {
      request.context.user._id = '-1';

      return should(authController.logout(request)).rejectedWith(
        UnauthorizedError,
        {id: 'security.rights.unauthorized'});
    });
  });

  describe('#getCurrentUser', () => {
    it('should return the user given in the context', async () => {
      const req = new Request(
        {body: {}},
        {
          token: {userId: 'admin'},
          user: {_id: 'admin'}
        });

      const response = await authController.getCurrentUser(req);

      should(response).match(req.context.user);
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
      request = new Request(
        {
          action: 'checkToken',
          controller: 'auth',
          body: {token: 'foobar'}
        },
        {});
      testToken = new Token({ expiresAt: 42, userId: 'durres' });
    });

    it('should reject an error if no token is provided', () => {
      return should(authController.checkToken(new Request({body: {}})))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.token".'
        });
    });

    it('should return a valid response if the token is valid', async () => {
      const verifyStub = kuzzle.ask
        .withArgs('core:security:token:verify', request.input.body.token)
        .resolves(testToken);

      const response = await authController.checkToken(request);

      should(verifyStub).calledOnce();
      should(response).be.instanceof(Object);
      should(response.kuid).be.eql('durres');
      should(response.valid).be.true();
      should(response.state).be.undefined();
      should(response.expiresAt).be.eql(testToken.expiresAt);
    });

    it('should return a valid response if the token is not valid', async () => {
      const verifyStub = kuzzle.ask
        .withArgs('core:security:token:verify', request.input.body.token)
        .rejects(new UnauthorizedError('foobar'));

      const response = await authController.checkToken(request);

      should(verifyStub).calledOnce();
      should(response).be.instanceof(Object);
      should(response.valid).be.false();
      should(response.state).be.eql('foobar');
      should(response.expiresAt).be.undefined();
    });

    it('should return a rejected promise if an error occurs', () => {
      const error = new KuzzleInternalError('Foobar');
      kuzzle.ask
        .withArgs('core:security:token:verify', request.input.body.token)
        .rejects(error);

      return should(authController.checkToken(request)).be.rejectedWith(error);
    });
  });

  describe('#checkToken with cookies', () => {
    let testToken;

    beforeEach(() => {
      kuzzle.config.http.supportCookieAuthentication = true;

      request = new Request(
        {
          action: 'checkToken',
          controller: 'auth',
          body: {},
          cookieOnly: true,
        },
        {});
      
      request.input.jwt = 'foobar';
      testToken = new Token({ expiresAt: 42, userId: 'durres' });
    });

    it('should reject an error if no token is provided in the cookie', () => {
      return should(authController.checkToken(new Request({body: {}})))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.token".'
        });
    });

    it('should return a valid response if the token is valid', async () => {
      const verifyStub = kuzzle.ask
        .withArgs('core:security:token:verify', request.input.jwt)
        .resolves(testToken);

      const response = await authController.checkToken(request);

      should(verifyStub).calledOnce();
      should(response).be.instanceof(Object);
      should(response.kuid).be.eql('durres');
      should(response.valid).be.true();
      should(response.state).be.undefined();
      should(response.expiresAt).be.eql(testToken.expiresAt);
    });

    it('should return a valid response if the token is not valid', async () => {
      const verifyStub = kuzzle.ask
        .withArgs('core:security:token:verify', request.input.jwt)
        .rejects(new UnauthorizedError('foobar'));

      const response = await authController.checkToken(request);

      should(verifyStub).calledOnce();
      should(response).be.instanceof(Object);
      should(response.valid).be.false();
      should(response.state).be.eql('foobar');
      should(response.expiresAt).be.undefined();
    });

    it('should return a rejected promise if an error occurs', () => {
      const error = new KuzzleInternalError('Foobar');
      kuzzle.ask
        .withArgs('core:security:token:verify', request.input.jwt)
        .rejects(error);

      return should(authController.checkToken(request)).be.rejectedWith(error);
    });
  });

  describe('#refreshToken', () => {
    it('should reject if the user is not authenticated', () => {
      return should(authController.refreshToken(new Request(
        {},
        {token: {userId: 'anonymous', _id: '-1'}, user: {_id: '-1'}}
      )))
        .rejectedWith(
          UnauthorizedError,
          {id: 'security.rights.unauthorized'});
    });

    it('should provide a new jwt and expire the current one ', async () => {
      const newToken = {
        _id: '_id',
        jwt: 'new-token',
        userId: 'userId',
        ttl: 'ttl',
        expiresAt: 42
      };
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

      kuzzle.ask.withArgs('core:security:token:refresh').resolves(newToken);

      const response = await authController.refreshToken(req);

      should(response).eql({
        _id: 'userId',
        jwt: 'new-token',
        expiresAt: 42,
        ttl: 'ttl'
      });

      should(kuzzle.ask).calledWith(
        'core:security:token:refresh',
        req.context.user,
        req.context.token,
        req.input.args.expiresIn);
    });
  });

  describe('#refreshToken with cookies', () => {
    beforeEach(() => {
      kuzzle.config.http.supportCookieAuthentication = true;
    });

    it('should reject if the user is not authenticated', () => {
      return should(authController.refreshToken(new Request(
        {cookieOnly: true},
        {token: {userId: 'anonymous', _id: '-1'}, user: {_id: '-1'}}
      )))
        .rejectedWith(
          UnauthorizedError,
          {id: 'security.rights.unauthorized'});
    });

    it('should provide a new jwt and expire the current one ', async () => {
      const newToken = {
        _id: '_id',
        jwt: 'new-token',
        userId: 'userId',
        ttl: 'ttl',
        expiresAt: 42
      };
      const req = new Request(
        {
          expiresIn: '42h',
          cookieOnly: true
        },
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

      kuzzle.ask.withArgs('core:security:token:refresh').resolves(newToken);

      const response = await authController.refreshToken(req);

      should(response).eql({
        _id: 'userId',
        expiresAt: 42,
        ttl: 'ttl'
      });

      should.exists(req.response.headers);
      should.exists(req.response.headers['Set-Cookie']);
      should(req.response.headers['Set-Cookie']).be.an.Array()
        .and.match(/authToken=new-token; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Strict/);

      should(kuzzle.ask).calledWith(
        'core:security:token:refresh',
        req.context.user,
        req.context.token,
        req.input.args.expiresIn);
    });
  });

  describe('#updateSelf', () => {
    it('should return a valid response', async () => {
      const r = new Request(
        {body: {foo: 'bar'}},
        {
          token: {userId: 'admin', _id: 'admin'},
          user: {_id: 'admin'}
        }
      );
      kuzzle.ask.resolves(user);

      const response = await authController.updateSelf(r);

      should(response).be.instanceof(Object);

      should(kuzzle.ask).calledWith(
        'core:security:user:update',
        r.context.user._id,
        null,
        r.input.body,
        {
          refresh: 'wait_for',
          retryOnConflict: 10,
          userId: r.context.user._id,
        });
    });

    it('should reject an error if profile is specified', () => {
      const r = new Request(
        {body: {foo: 'bar', profileIds: ['test']}},
        {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}});

      return should(authController.updateSelf(r))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.forbidden_argument',
          message: 'The argument "body.profileIds" is not allowed by this API action.'
        });
    });

    it('should reject an error if _id is specified in the body', () => {
      const r = new Request(
        {body: {foo: 'bar', _id: 'test'}},
        {token: {userId: 'admin', _id: 'admin'}, user: {_id: 'admin'}});

      return should(authController.updateSelf(r))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.forbidden_argument',
          message: 'The argument "body._id" is not allowed by this API action.'
        });
    });

    it('should reject an error if current user is anonymous', () => {
      const r = new Request(
        { body: {foo: 'bar'} },
        { token: {userId: '-1'}, user: {_id: '-1'} });

      return should(authController.updateSelf(r)).rejectedWith(
        UnauthorizedError,
        {id: 'security.rights.unauthorized'});
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
