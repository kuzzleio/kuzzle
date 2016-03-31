var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  UnauthorizedError = require.main.require('lib/api/core/errors/unauthorizedError'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Token = require.main.require('lib/api/core/models/security/token'),
  Role = require.main.require('lib/api/core/models/security/role'),
  User = require.main.require('lib/api/core/models/security/user'),
  rewire = require('rewire'),
  FunnelController = rewire('../../../../lib/api/controllers/funnelController');

describe('funnelController.processRequest', function () {
  var
    context = {
      connection: {id: 'connectionid'},
      token: null
    },
    kuzzle,
    processRequest;

  beforeEach(function (callback) {
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.anonymous = new Role();
        params.roleWithoutAdmin._id = 'anonymous';
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.anonymous, params.roleWithoutAdmin);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = {_id: 'anonymous', roles: ['anonymous']};
        return q(kuzzle.repositories.profile.profiles.anonymous);
      })
      .then(function (res) {
        return kuzzle.repositories.token.anonymous();
      })
      .then(function (anonymousToken) {
        context.token = anonymousToken;
        processRequest = FunnelController.__get__('processRequest');
        callback();
      })
      .catch(error => callback(error));
  });

  it('should reject the promise if no controller is specified', function () {
    var object = {
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejected();
  });

  it('should reject the promise if no action is specified', function () {
    var object = {
      controller: 'write'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejected();
  });

  it('should reject the promise if the controller doesn\'t exist', function () {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejected();
  });

  it('should reject the promise if the action doesn\'t exist', function () {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    var requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers, requestObject, context)).be.rejected();
  });

  it('should reject the promise if the user is not allowed to execute the action', () => {
    var
      token = new Token(),
      role = new Role(),
      user = new User();

    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': false
                }
              }
            }
          }
        }
      }
    };

    user._id = 'testUser';
    user.profile = new Profile();
    user.profile.roles = [role];

    token._id = 'fake-token';
    token.user = user;

    kuzzle.repositories.token.verifyToken = function () { return q(token); };

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

  it('should resolve the promise if everything is ok', function (done) {
    var object = {
      requestId: 'requestId',
      controller: 'read',
      action: 'listIndexes',
      collection: 'user'
    };

    var requestObject = new RequestObject(object);

    processRequest(kuzzle, kuzzle.funnel.controllers,requestObject, context)
      .then(() => {
        done();
      })
      .catch(err => done(err));
  });

  it('should resolve the promise in case of a plugin controller action', function() {
    var
      pluginController = {
        bar: function(requestObject){
          return q();
        }
      },
      FooController = function(context) {
        return pluginController;
      },
      object = {
        requestId: 'requestId',
        controller: 'myplugin/foo',
        action: 'bar',
        name: 'John Doe'
      },
      requestObject;

    // Reinitialize the Funnel controller with the dummy plugin controller:
    kuzzle.pluginsManager.controllers = {
      'myplugin/foo': FooController
    };
    kuzzle.funnel.init();

    requestObject = new RequestObject(object);

    return should(processRequest(kuzzle, kuzzle.funnel.controllers,requestObject, context)).not.be.rejected();
  });
});
