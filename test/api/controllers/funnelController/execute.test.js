var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  kuzzle = require.main.require('lib'),
  rc = require('rc'),
  Role = require.main.require('lib/api/core/models/security/role'),
  Profile = require.main.require('lib/api/core/models/security/profile');

require('should-promised');

describe('Test execute function in funnel controller', function () {

  var
    context;

  before(function (callback) {
    context = {
      connection: {id: 'connectionid'},
      user: null
    };

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
    var
      requestObject = new RequestObject({
        action: 'create'
      });
    requestObject._context = context;

    return should(kuzzle.funnel.execute(requestObject)).be.rejected();
  });

  it('should reject the promise if no action is specified', function () {
    var
      requestObject = new RequestObject({
        action: 'create'
      });
    requestObject._context = context;

    return should(kuzzle.funnel.execute(requestObject)).be.rejected();
  });

  it('should reject the promise if the controller doesn\'t exist', function () {
    var
      requestObject = new RequestObject({
        action: 'create'
      });
    requestObject._context = context;

    return should(kuzzle.funnel.execute(requestObject)).be.rejected();
  });

  it('should reject the promise if the action doesn\'t exist', function () {
    var
      requestObject = new RequestObject({
        action: 'create'
      });
    requestObject._context = context;

    return should(kuzzle.funnel.execute(requestObject)).be.rejected();
  });

  it('should resolve the promise if everything is ok', function () {
    var
      requestObject = new RequestObject({
        requestId: 'requestId',
        controller: 'write',
        action: 'create',
        collection: 'user',
        persist: false,
        body: {
          firstName: 'Grace'
        }
      });
    requestObject._context = context;

    return should(kuzzle.funnel.execute(requestObject)).not.be.rejected();
  });

});
