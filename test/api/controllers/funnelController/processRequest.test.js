var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  ForbiddenError = require.main.require('kuzzle-common-objects').Errors.forbiddenError,
  UnauthorizedError = require.main.require('kuzzle-common-objects').Errors.unauthorizedError,
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.processRequest', () => {
  var
    context = {
      connection: {id: 'connectionid'},
      token: null
    },
    kuzzle,
    processRequest;

  before(() => {
    kuzzle = new KuzzleServer();
    processRequest = FunnelController.__get__('processRequest');
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
      return Promise.resolve({
        userId: 'user'
      });
    });
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.funnel.init();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject the promise if no controller is specified', () => {
    var object = {
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if no action is specified', () => {
    var object = {
      controller: 'write'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if the controller doesn\'t exist', () => {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if the action doesn\'t exist', () => {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise with UnauthorizedError if an anonymous user is not allowed to execute the action', () => {
    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').resolves({_id: -1, isActionAllowed: sandbox.stub().resolves(false)});
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').resolves({userId: -1});

    return should(
      processRequest(kuzzle, kuzzle.funnel.controllers,
        new RequestObject({
          controller: 'read',
          index: '@test',
          action: 'get'
        }),
        context)
    ).be.rejectedWith(UnauthorizedError);
  });

  it('should reject the promise with UnauthorizedError if an authenticated user is not allowed to execute the action', () => {
    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').resolves({_id: 'user', isActionAllowed: sandbox.stub().resolves(false)});
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').resolves({user: 'user'});

    return should(
      processRequest(kuzzle, kuzzle.funnel.controllers,
        new RequestObject({
          controller: 'read',
          index: '@test',
          action: 'get'
        }),
        context)
    ).be.rejectedWith(ForbiddenError);
  });

  it('should resolve the promise if everything is ok', () => {
    var requestObject = new RequestObject({
      requestId: 'requestId',
      controller: 'read',
      action: 'listIndexes',
      collection: 'collection'
    });

    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.user, 'load').resolves({_id: 'user', isActionAllowed: sandbox.stub().resolves(true)});
    sandbox.stub(kuzzle.repositories.token, 'verifyToken').resolves({user: 'user'});
    sandbox.stub(kuzzle.funnel.controllers.read, 'listIndexes').resolves();

    return processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context);
  });
});
