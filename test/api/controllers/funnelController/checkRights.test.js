'use strict';

const
  should = require('should'),
  Bluebird = require('bluebird'),
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

  it('should reject the promise with UnauthorizedError if an anonymous user is not allowed to execute the action', done => {
    let request = new Request({controller: 'document', index: '@test', action: 'get'});
    kuzzle.repositories.user.load.returns(Bluebird.resolve({_id: -1, isActionAllowed: sinon.stub().returns(Bluebird.resolve(false))}));
    kuzzle.repositories.token.verifyToken.returns(Bluebird.resolve({userId: -1}));

    funnel.checkRights(request)
      .then(() => should.fail('fulfilled promise', 'rejected promise'))
      .catch(err => {
        should(err).be.instanceof(UnauthorizedError);
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onAuthorized', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onUnauthorized', request)).be.true();
        done();
      });
  });

  it('should reject the promise with UnauthorizedError if an authenticated user is not allowed to execute the action', done => {
    let request = new Request({controller: 'document', index: '@test', action: 'get'});
    kuzzle.repositories.user.load.returns(Bluebird.resolve({_id: 'user', isActionAllowed: sinon.stub().returns(Bluebird.resolve(false))}));
    kuzzle.repositories.token.verifyToken.returns(Bluebird.resolve({user: 'user'}));

    funnel.checkRights(request)
      .then(() => should.fail('fulfilled promise', 'rejected promise'))
      .catch(err => {
        should(err).be.instanceof(ForbiddenError);
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onAuthorized', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onUnauthorized', request)).be.true();
        done();
      });
  });

  it('should resolve the promise ', () => {
    const request = new Request({
      requestId: 'requestId',
      controller: 'index',
      action: 'list'
    });

    kuzzle.repositories.user.load.returns(Bluebird.resolve({_id: 'user', isActionAllowed: sinon.stub().returns(Bluebird.resolve(true))}));
    kuzzle.repositories.token.verifyToken.returns(Bluebird.resolve({user: 'user'}));

    return funnel.checkRights(request)
      .then(() => {
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onAuthorized', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onUnauthorized', request)).be.false();
      });
  });
});
