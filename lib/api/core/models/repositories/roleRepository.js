module.exports = function (kuzzle) {
  var
    q = require('q'),
    Repository = require('./repository'),
    Role = require('../security/role');


  function RoleRepository() {
    this.roles = {};
  }

  RoleRepository.prototype = new Repository(kuzzle, {
    collection: '_kuzzle/roles',
    ObjectConstructor: Role,
    cacheEngine: kuzzle.services.list.userCache
  });

  RoleRepository.prototype.loadRoles = function (roleKeys) {
    var
      deferred = q.defer(),
      keys = [],
      buffer = {},
      result = [];

    roleKeys.forEach(function (roleKey) {
      if (this.roles[roleKey]) {
        buffer[roleKey] = this.roles[roleKey];
      }
      else {
        keys.push(roleKey);
      }
    }.bind(this));

    if (keys.length === 0) {
      Object.keys(buffer).forEach(function (key) {
        result.push(buffer[key]);
      });

      deferred.resolve(result);
    }
    else {
      this.loadMultiFromDatabase(keys)
        .then(function (responses) {
          var
            promises = [];

          responses.forEach(function (response) {
            var
              err,
              role;

            if (response.found === undefined || response.found === true) {
              buffer[response._id] = response;
            }
            else if (response.found === false) {
              if (kuzzle.config.defaultUserRoles[response._id]) {
                role = new Role();
                promises.push(this.hydrate(role, kuzzle.config.defaultUserRoles[response._id]));
              }
              else {
                err = new Error('Could not load role: ' + response._id);
                err.status = 404;
                deferred.reject(err);
              }
            }
            else {
              err = new Error('Unknown result from Database while loadding role.' + response.toString());
              err.status = 500;
              deferred.reject(err);
            }

            q.all(promises)
              .then(function (roles) {
                roles.forEach(function (r) {
                  buffer[role._id] = r;
                });

                Object.keys(buffer).forEach(function (key) {
                  result.push(buffer[key]);
                });

                deferred.resolve(result);
              })
              .catch(function (error) {
                deferred.reject(error);
              });

          }.bind(this));

        }.bind(this))
        .catch(function (error) {
          deferred.reject(error);
        });
    }


    return deferred.promise;
  };

  return RoleRepository;
}

