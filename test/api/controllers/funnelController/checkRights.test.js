'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  FunnelController = require('../../../../lib/api/controllers/funnelController');

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);
  });

  it('should reject the promise with UnauthorizedError if an anonymous user is not allowed to execute the action', () => {
    let request = new Request({controller: 'document', index: '@test', action: 'get'});
    kuzzle.repositories.user.load.resolves({
      _id: -1,
      isActionAllowed: sinon.stub().resolves(false)
    });
    kuzzle.repositories.token.verifyToken.resolves({userId: -1});

    return funnel.checkRights(request)
      .then(() => should.fail('fulfilled promise', 'rejected promise'))
      .catch(err => {
        should(err).be.instanceof(UnauthorizedError);
        should(kuzzle.pipe.calledWithMatch('request:onAuthorized', request)).be.false();
        should(kuzzle.pipe.calledWithMatch('request:onUnauthorized', request)).be.true();
      });
  });

  it('should reject the promise with UnauthorizedError if an authenticated user is not allowed to execute the action', () => {
    let request = new Request({controller: 'document', index: '@test', action: 'get'});
    kuzzle.repositories.user.load.resolves({
      _id: 'user',
      isActionAllowed: sinon.stub().resolves(false)
    });
    kuzzle.repositories.token.verifyToken.resolves({user: 'user'});

    return funnel.checkRights(request)
      .then(() => should.fail('fulfilled promise', 'rejected promise'))
      .catch(err => {
        should(err).be.instanceof(ForbiddenError);
        should(kuzzle.pipe.calledWithMatch('request:onAuthorized', request)).be.false();
        should(kuzzle.pipe.calledWithMatch('request:onUnauthorized', request)).be.true();
      });
  });

  it('should resolve the promise ', () => {
    const request = new Request({
      requestId: 'requestId',
      controller: 'index',
      action: 'list'
    });

    kuzzle.repositories.user.load.resolves({
      _id: 'user',
      isActionAllowed: sinon.stub().resolves(true)
    });
    kuzzle.repositories.token.verifyToken.resolves({user: 'user'});

    return funnel.checkRights(request)
      .then(() => {
        should(kuzzle.pipe.calledWithMatch('request:onAuthorized', request)).be.true();
        should(kuzzle.pipe.calledWithMatch('request:onUnauthorized', request)).be.false();
      });
  });
});
