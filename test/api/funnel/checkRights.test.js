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
const Token = require('../../../lib/model/security/token');
const User = require('../../../lib/model/security/user');

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
    funnel = new FunnelController(kuzzle);

    request = new Request({
      controller: 'document',
      action: 'get',
      jwt: 'hashed JWT'
    });

    loadedUser = new User();
    loadedUser._id = 'foo';
    loadedUser._source = { bar: 'qux' };

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

  it('should forward a token:verify exception', async () => {
    const error = new Error('foo');

    verifyTokenStub.rejects(error);

    await should(funnel.checkRights(request)).rejectedWith(error);

    should(verifyTokenStub).calledOnce();
    should(getUserEvent).not.called();

    should(kuzzle.pipe).not.calledWith('request:onAuthorized', request);
    should(kuzzle.pipe).not.calledWith('request:onUnauthorized', request);
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
  });
});
