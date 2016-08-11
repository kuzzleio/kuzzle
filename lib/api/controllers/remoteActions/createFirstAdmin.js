var
  Promise = require('bluebird'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  _kuzzle;

function createFirstAdmin (requestObject) {
  var
    id = requestObject.data._id,
    password = requestObject.data.body.password,
    reset = requestObject.data.body.reset;

  return createAdminUser(id, password)
    .then(() => {
      if (reset) {
        return resetRoles()
          .then(() => resetProfiles());
      }
    });
}

function resetRoles () {
  var promises;
  
  promises = ['admin', 'default', 'anonymous'].map(id => {
    return _kuzzle.internalEngine.createOrReplace('roles', id, _kuzzle.config.security.standard.roles[id]);
  });
  
  return Promise.all(promises);
}

function resetProfiles () {
  return _kuzzle.internalEngine
    .createOrReplace('profiles', 'admin', {policies: [{roleId: 'admin', allowInternalIndex: true}]})
    .then(() => _kuzzle.internalEngine.createOrReplace('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]}))
    .then(() => _kuzzle.internalEngine.createOrReplace('profiles', 'default', {policies: [{roleId: 'default'}]}));
}

function createAdminUser (id, pwd) {
  // we need to use the real auth controller to let the auth plugins do their job
  var requestObject = new RequestObject({
    _id: id,
    body: {
      password: pwd,
      profilesIds: ['admin']
    }
  });
  
  return _kuzzle.funnel.controllers.security.createOrReplaceUser(requestObject);
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return createFirstAdmin;
};
