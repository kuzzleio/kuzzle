module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
    Repository = require('./repository'),
    Role = require('../security/role');


  function RoleRepository() {
    this.roles = {};
  }

  RoleRepository.prototype = new Repository(kuzzle, {
    index: kuzzle.config.internalIndex,
    collection: 'roles',
    ObjectConstructor: Role,
    cacheEngine: kuzzle.services.list.userCache
  });

  /**
   * From a list of role ids, retrieves the matching Role objects.
   *
   * @param {Array} roleKeys The role ids to load
   * @returns {Promise} Resolves to an array containing the matching found Role objects.
   */
  RoleRepository.prototype.loadRoles = function (roleKeys) {
    var
      deferred = q.defer(),
      keys = [],
      buffer = {},
      result = [];

    roleKeys.forEach((roleKey) => {
      if (this.roles[roleKey]) {
        buffer[roleKey] = this.roles[roleKey];
      }
      else {
        keys.push(roleKey);
      }
    });

    if (keys.length === 0) {
      Object.keys(buffer).forEach((key) => {
        result.push(buffer[key]);
      });

      deferred.resolve(result);
    }
    else {
      this.loadMultiFromDatabase(keys, true)
        .then((roles) => {
          var promises = [];

          roles.forEach(role => {
            buffer[role._id] = role;
            this.roles[role._id] = role;
          });

          _.difference(roleKeys, Object.keys(buffer)).forEach((key) => {
            var role;

            if (kuzzle.config.defaultUserRoles[key] !== undefined) {
              role = new Role();
              promises.push(this.hydrate(role, kuzzle.config.defaultUserRoles[key]));
            }
          });

          if (promises.length === 0) {
            Object.keys(buffer).forEach((key) => {
              result.push(buffer[key]);
            });

            deferred.resolve(result);
            return;
          }

          q.all(promises)
            .then(results => {
              results.forEach(role => {
                buffer[role._id] = role;
                this.roles[role._id] = role;
              });

              Object.keys(buffer).forEach(key => {
                result.push(buffer[key]);
              });

              deferred.resolve(result);
            })
            .catch((error) => {
              deferred.reject(error);
            });
        })
        .catch((error) => {
          deferred.reject(error);
        });
    }


    return deferred.promise;
  };

  /**
   * Builds a Role object from a RequestObject
   * @param {RequestObject} requestObject
   * @returns {Role}
   */
  RoleRepository.prototype.getRoleFromRequestObject = function (requestObject) {
    var role = new Role();
    if (requestObject.data._id) {
      role._id = requestObject.data._id;
    }

    Object.keys(requestObject.data.body).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        role[key] = requestObject.data.body[key];
      }
    });

    return role;
  };

  /**
   * Get from database the document that represent the role given in parameter
   *
   * @param {Role|string} role
   * @returns Promise<T>
   */
  RoleRepository.prototype.loadRole = function (role) {
    var
      roleId,
      deferred = q.defer();

    if (role instanceof Role) {
      roleId = role._id;
    }
    else if (typeof role === 'string') {
      roleId = role;
    }

    if (!roleId) {
      deferred.reject(new BadRequestError('Missing role id'));
      return deferred.promise;
    }

    if (this.roles[roleId]) {
      deferred.resolve(this.roles[roleId]);
    }
    else {
      return this.loadOneFromDatabase(roleId)
        .then(loadedRole => {
          if (loadedRole) {
            this.roles[loadedRole._id] = loadedRole;
          }

          return loadedRole;
        });
    }

    return deferred.promise;
  };

  /**
   *
   * @param {RequestObject} requestObject
   */
  RoleRepository.prototype.searchRole = function (requestObject) {
    var filter = {};

    requestObject.data.body = requestObject.data.body || {};

    if (requestObject.data.body.controllers && Array.isArray(requestObject.data.body.controllers)) {
      filter = {or: []};

      requestObject.data.body.controllers.forEach(controller => {
        filter.or.push({exists: {field : 'controllers.' + controller}});
      });

      // Manually add wildcard on index because we want to retrieve roles that add rights on all indexes
      if (requestObject.data.body.controllers.length >= 1) {
        filter.or.push({exists: {field: 'controllers.*'}});
      }
    }

    // todo: get list from ES and do a .map on it for filter on collection/controller/action in addition to index
    return this.search(filter, requestObject.data.body.from, requestObject.data.body.size, false);
  };

  /**
   * Given a Role object, validates its definition and if OK, persist it to the database.
   *
   * @param {Role} role
   * @param {object} context - user's context
   * @param {Object} opts The persistence options
   *
   * @returns Promise<T>
   */
  RoleRepository.prototype.validateAndSaveRole = function (role, context, opts) {
    if (!role._id) {
      return q.reject(new BadRequestError('Missing role id'));
    }

    return role.validateDefinition(context)
      .then(() => {
        this.roles[role._id] = role;
        return this.persistToDatabase(role, opts);
      })
      .then(() => role);
  };

  /**
   * Given a Role object, delete it from memory and database
   * @param {Role} role
   * @returns Promise<T>
   */
  RoleRepository.prototype.deleteRole = function (role) {
    var filter;

    if (!role._id) {
      return q.reject(new BadRequestError('Missing role id'));
    }

    if (['admin', 'default', 'anonymous'].indexOf(role._id) > -1) {
      return q.reject(new BadRequestError(role._id + ' is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.'));
    }

    filter = { or: [{terms: { 'roles': [ role ] }}] };

    return kuzzle.repositories.profile.search(filter, 0, 1, false)
      .then(response => {
        if (response.total > 0) {
          return q.reject(new BadRequestError('The role "' + role._id + '" cannot be deleted since it is used by some profile.'));
        }

        return this.deleteFromDatabase(role._id)
          .then(deleteResponse => {
            if (this.roles[role._id]) {
              delete this.roles[role._id];
            }

            return deleteResponse;
          });
      });
  };

  /**
   * From a Role object, returns an object ready to be persisted
   * @param {Role} role
   * @returns {Object}
   */
  RoleRepository.prototype.serializeToDatabase = function (role) {
    var serializedRole = {};

    Object.keys(role).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        serializedRole[key] = role[key];
      }
    });

    return serializedRole;
  };

  RoleRepository.prototype.serializeToCache = RoleRepository.prototype.serializeToDatabase;

  return RoleRepository;
};

