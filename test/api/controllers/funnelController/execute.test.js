var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('should-promised');

describe('Test execute function in funnel controller', function () {

  var
    context = {
      connection: {id: 'connectionid'},
      user: null
    },
    kuzzle;

  beforeEach(function (callback) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.removeAllListeners();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (anonymousUser) {
        context.user = anonymousUser;
        callback();
      });
  });

  it('should reject the promise if no controller is specified', function () {
    var object = {
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, context)).be.rejected();
  });

  it('should reject the promise if no action is specified', function () {
    var object = {
      controller: 'write'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, context)).be.rejected();
  });

  it('should reject the promise if the controller doesn\'t exist', function () {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, context)).be.rejected();
  });

  it('should reject the promise if the action doesn\'t exist', function () {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, context)).be.rejected();
  });

  it('should resolve the promise if everything is ok', function () {
    var object = {
      requestId: 'requestId',
      controller: 'write',
      action: 'create',
      collection: 'user',
      persist: false,
      body: {
        firstName: 'Grace'
      }
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, context)).not.be.rejected();
  });

  it('should resolve the promise in cas of a plugin controller action', function() {
    var
      pluginController = {
        bar: function(requestObject){
          return Promise.resolve();
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

    return should(kuzzle.funnel.execute(requestObject, context)).not.be.rejected();
  });
});
