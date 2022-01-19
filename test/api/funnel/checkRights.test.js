'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  ForbiddenError,
  UnauthorizedError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const FunnelController = require('../../../lib/api/funnel');
const { Token } = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user').default;

describe('funnel.checkRights', () => {
  const getUserEvent = 'core:security:user:get';
  const verifyTokenEvent = 'core:security:token:verify';
  let kuzzle;
  let funnel;
  let verifiedToken;
  let loadedUser;
  let request;
  let verifyTokenStub;
  let getUserStub;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController();

    request = new Request({
      controller: 'document',
      action: 'get',
      jwt: 'hashed JWT'
    });

    loadedUser = new User();
    loadedUser._id = 'foo';
    loadedUser._source = { bar: 'qux' };
    loadedUser.profileIds = ['default'];

    verifiedToken = new Token({
      _id: 'token',
      expiresAt: 123,
      jwt: 'hash',
      refreshed: false,
      ttl: 456,
      userId: loadedUser._id,
    });

    verifyTokenStub = kuzzle.ask
      .withArgs(verifyTokenEvent, request.input.jwt)
      .resolves(verifiedToken);

    getUserStub = kuzzle.ask
      .withArgs(getUserEvent, verifiedToken.userId)
      .resolves(loadedUser);
  });

  afterEach(() => {
    global.kuzzle.config.plugins.common.failsafeMode = false;
  });

  it('should link the token to the connection for realtime protocols', async () => {
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);
    request.context.connection.id = 'connection-id';
    request.context.connection.protocol = 'websocket';

    await funnel.checkRights(request);

    should(global.kuzzle.tokenManager.link)
      .be.calledWith(request.context.token, 'connection-id');
  });

  it('should reject with an UnauthorizedError if an anonymous user is not allowed to execute the action', async () => {
    verifiedToken.userId = '-1';

    const getAnonStub = kuzzle.ask
      .withArgs(getUserEvent, '-1')
      .resolves(loadedUser);

    sinon.stub(loadedUser, 'isActionAllowed').resolves(false);

    await should(funnel.checkRights(request)).rejectedWith(UnauthorizedError, {
      id: 'security.rights.unauthorized',
    });

    should(verifyTokenStub).calledOnce();
    should(getAnonStub).calledOnce();

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).calledWith('request:onUnauthorized', request);
  });

  it('should with a ForbiddenError if an authenticated user is not allowed to execute the action', async () => {
    sinon.stub(loadedUser, 'isActionAllowed').resolves(false);

    await should(funnel.checkRights(request)).rejectedWith(ForbiddenError, {
      id: 'security.rights.forbidden',
    });

    should(verifyTokenStub).calledOnce();
    should(getUserStub).calledOnce();

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).calledWith('request:onUnauthorized', request);
  });

  it('should forward a token:verify exception and trigger event', async () => {
    const error = new Error('foo');

    verifyTokenStub.rejects(error);

    await should(funnel.checkRights(request)).rejectedWith(error);

    should(verifyTokenStub).calledOnce();
    should(getUserEvent).not.called();

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).be.calledWith('request:onUnauthorized', request);
  });

  it('should forward a user:get exception', async () => {
    const error = new Error('foo');

    getUserStub.rejects(error);

    await should(funnel.checkRights(request)).rejectedWith(error);

    should(verifyTokenStub).calledOnce();
    should(getUserStub).calledOnce();

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).not.calledWith('request:onUnauthorized', request);
  });

  it('should resolve if rights are correct', async () => {
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(verifyTokenStub).calledOnce();
    should(getUserStub).calledOnce();

    should(kuzzle.pipe).calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).not.calledWith('request:onUnauthorized', request);
    should(global.kuzzle.tokenManager.link).not.be.called();
  });

  it('should reject if non admin user use the API during failsafe mode', async () => {
    global.kuzzle.config.plugins.common.failsafeMode = true;
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({
      id: 'security.rights.failsafe_mode_admin_only'
    });

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).be.calledWith('request:onUnauthorized', request);
  });

  it('should allow admin user to use the API during failsafe mode', async () => {
    global.kuzzle.config.plugins.common.failsafeMode = true;
    loadedUser.profileIds = ['admin'];
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(kuzzle.pipe).be.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).not.calledWith('request:onUnauthorized', request);
  });

  it('should use the token in the cookie when cookieAuth is true and internal.cookieAuthentication is true and only the cookie is present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = null;
    request.input.args.cookieAuth = true;
    request.input.headers = {cookie: 'authToken=hashed JWT;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should use the token when cookieAuth is true and internal.cookieAuthentication is true and only the token is present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = true;
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should throw security.token.verification_error when cookieAuth is true and internal.cookieAuthentication is true and both cookie that belongs to kuzzle and token are present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = true;
    request.input.headers = {cookie: 'authToken=foobar; randomToken=test' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({ id: 'security.token.verification_error' });
  });

  it('should not throw security.token.verification_error when cookieAuth is true and internal.cookieAuthentication is true and both cookie that does not belongs to kuzzle and token are present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = true;
    request.input.headers = {cookie: 'randomToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).not.be.rejectedWith({ id: 'security.token.verification_error' });

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should use the token when cookieAuth is true and internal.cookieAuthentication is true and both cookie and token are present, but cookie is set to null', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = true;
    request.input.headers = {cookie: 'authToken=null;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should not throw security.cookie.unsupported and use the token when cookieAuth is false and internal.cookieAuthentication is false and cookies are present but none of them belongs to kuzzle', async () => {
    kuzzle.config.http.cookieAuthentication = false;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = false;
    request.input.headers = {cookie: 'randomToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).not.be.rejectedWith({ id: 'security.cookie.unsupported' });

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should throw security.cookie.unsupported when cookieAuth is true and internal.cookieAuthentication is false', async () => {
    kuzzle.config.http.cookieAuthentication = false;

    request.input.jwt = null;
    request.input.args.cookieAuth = true;
    request.input.headers = {cookie: 'authToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({ id: 'security.cookie.unsupported' });

  });

  it('should throw security.token.verification_error when cookieAuth is false and internal.cookieAuthentication is true and both cookie and token are present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = false;
    request.input.headers = {cookie: 'authToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({ id: 'security.token.verification_error' });
  });

  it('should use the token in the cookie when cookieAuth is false and internal.cookieAuthentication is true and only the cookie is present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = null;
    request.input.args.cookieAuth = false;
    request.input.headers = {cookie: 'authToken=hashed JWT;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should use the token in the jwt when cookieAuth is false and internal.cookieAuthentication is true and only the token is present', async () => {
    kuzzle.config.http.cookieAuthentication = true;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = false;
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });

  it('should throw security.cookie.unsupported when cookieAuth is false and internal.cookieAuthentication is false and both cookie and token are present', async () => {
    kuzzle.config.http.cookieAuthentication = false;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = false;
    request.input.headers = {cookie: 'authToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({ id: 'security.cookie.unsupported' });
  });

  it('should throw security.cookie.unsupported when cookieAuth is false and internal.cookieAuthentication is false and only the cookie is present', async () => {
    kuzzle.config.http.cookieAuthentication = false;

    request.input.jwt = null;
    request.input.args.cookieAuth = false;
    request.input.headers = {cookie: 'authToken=foobar;' };
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await should(funnel.checkRights(request)).be.rejectedWith({ id: 'security.cookie.unsupported' });
  });

  it('should use the token in the jwt when cookieAuth is false and internal.cookieAuthentication is false and only the token is present', async () => {
    kuzzle.config.http.cookieAuthentication = false;

    request.input.jwt = 'hashed JWT';
    request.input.args.cookieAuth = false;
    sinon.stub(loadedUser, 'isActionAllowed').resolves(true);

    await funnel.checkRights(request);

    should(request.input.jwt).and.be.a.String().and.be.eql('hashed JWT');
  });
});