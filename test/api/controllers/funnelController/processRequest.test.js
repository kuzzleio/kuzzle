var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  ForbiddenError = require.main.require('kuzzle-common-objects').Errors.forbiddenError,
  UnauthorizedError = require.main.require('kuzzle-common-objects').Errors.unauthorizedError,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

require('sinon-as-promised')(q.Promise);

describe('funnelController.processRequest', function () {
  var
    context = {
      connection: {id: 'connectionid'},
      token: null
    },
    kuzzle,
    sandbox,
    processRequest;

  before(() => {
    kuzzle = new Kuzzle();
    processRequest = FunnelController.__get__('processRequest');
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
      return q({
        user: {
          _id: 'user',
          isActionAllowed: sinon.stub().resolves(true)
        }
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject the promise if no controller is specified', function () {
    var object = {
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if no action is specified', function () {
    var object = {
      controller: 'write'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if the controller doesn\'t exist', function () {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise if the action doesn\'t exist', function () {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejectedWith(BadRequestError);
  });

  it('should reject the promise with UnauthorizedError if an anonymous user is not allowed to execute the action', () => {
    kuzzle.repositories.token.verifyToken.restore();
    sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
      return q({
        user: {
          _id: -1,
          isActionAllowed: sinon.stub().resolves(false)
        }
      });
    });

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
    sandbox.stub(kuzzle.repositories.token, 'verifyToken', () => {
      return q({
        user: {
          _id: 'user',
          isActionAllowed: sinon.stub().resolves(false)
        }
      });
    });

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
    var object = {
      requestId: 'requestId',
      controller: 'read',
      action: 'listIndexes',
      collection: 'collection'
    };

    var requestObject = new RequestObject(object);

    sandbox.stub(kuzzle.funnel.controllers.read, 'listIndexes').resolves();

    return processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context);
  });
});
