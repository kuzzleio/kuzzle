var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Request = require('kuzzle-common-objects').Request,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  Kuzzle = require('../../../../lib/api/kuzzle');

describe('funnelController.processRequest', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
      return Promise.resolve({
        userId: 'user'
      });
    });
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.funnel.init();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject the promise with UnauthorizedError if an anonymous user is not allowed to execute the action', () => {
    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({_id: -1, isActionAllowed: sandbox.stub().returns(Promise.resolve(false))}));
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').returns(Promise.resolve({userId: -1}));

    return should(kuzzle.funnel.checkRights(new Request({controller: 'document', index: '@test', action: 'get'})))
      .be.rejectedWith(UnauthorizedError);
  });

  it('should reject the promise with UnauthorizedError if an authenticated user is not allowed to execute the action', () => {
    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({_id: 'user', isActionAllowed: sandbox.stub().returns(Promise.resolve(false))}));
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').returns(Promise.resolve({user: 'user'}));

    return should(kuzzle.funnel.checkRights(new Request({controller: 'document', index: '@test', action: 'get'})))
      .be.rejectedWith(ForbiddenError);
  });

  it('should resolve the promise ', () => {
    var request = new Request({
      requestId: 'requestId',
      controller: 'index',
      action: 'list',
      collection: 'collection'
    });

    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').returns(Promise.resolve({_id: 'user', isActionAllowed: sandbox.stub().returns(Promise.resolve(true))}));
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').returns(Promise.resolve({user: 'user'}));
    sandbox.stub(kuzzle.funnel.controllers.index, 'list').returns(Promise.resolve());

    return kuzzle.funnel.checkRights(request);
  });
});
