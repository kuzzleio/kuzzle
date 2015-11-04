module.exports = function (kuzzle) {
  var
    q = require('q'),
    InternalError = require('../../errors/internalError'),
    NotFoundError = require('../../errors/notFoundError'),
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
                deferred.reject(new NotFoundError('Could not load role ' + response.id));
              }
            }
            else {
              deferred.reject(new InternalError('Unknown result from Database while loading role\n' + response.toString()));
            }
          }.bind(this));

          q.all(promises)
            .then(function (roles) {
              roles.forEach(function (r) {
                buffer[r._id] = r;
              });

              Object.keys(buffer).forEach(function (key) {
                result.push(buffer[key]);
              });

              deferred.resolve(result);
            })
            .catch(function (error) {
              deferred.reject(error);
            });

        }.bind(this))
        .catch(function (error) {
          deferred.reject(error);
        });
    }


    return deferred.promise;
  };

  return RoleRepository;
};

