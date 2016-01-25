module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    BadRequestError = require('../../errors/badRequestError'),
    Repository = require('./repository'),
    Role = require('../security/role');


  function RoleRepository() {
    this.roles = {};
  }

  RoleRepository.prototype = new Repository(kuzzle, {
    index: '%kuzzle',
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
        .then(function (roles) {
          var promises = [];

          roles.forEach(function (role) {
            buffer[role._id] = role;
          });

          _.difference(roleKeys, Object.keys(buffer)).forEach(function (key) {
            var role;

            if (kuzzle.config.defaultUserRoles[key] !== undefined) {
              role = new Role();
              promises.push(this.hydrate(role, kuzzle.config.defaultUserRoles[key]));
            }
          }.bind(this));

          if (promises.length === 0) {
            Object.keys(buffer).forEach(function (key) {
              result.push(buffer[key]);
            });

            deferred.resolve(result);
            return;
          }

          q.all(promises)
            .then(function (results) {
              results.forEach(function (role) {
                buffer[role._id] = role;
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

    if (requestObject.data.body && requestObject.data.body.indexes) {
      role.indexes = requestObject.data.body.indexes;
    }

    return role;
  };

  /**
   * Get from database the document that represent the role given in parameter
   * @param {Role} role
   * @returns {Promise}
   */
  RoleRepository.prototype.loadRole = function (role) {
    var deferred = q.defer();

    if (!role._id) {
      deferred.reject(new BadRequestError('Missing role id'));
      return deferred.promise;
    }

    if (this.roles[role._id]) {
      deferred.resolve(this.roles[role._id]);
    }
    else {
      return this.loadOneFromDatabase(role._id);
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

    if (requestObject.data.body.indexes && Array.isArray(requestObject.data.body.indexes)) {
      filter = {or: []};

      requestObject.data.body.indexes.forEach(index => {
        filter.or.push({exists: {field : 'indexes.' + index}});
      });

      // Manually add wildcard on index because we want to retrieve roles that add rights on all indexes
      if (requestObject.data.body.indexes.length >= 1) {
        filter.or.push({exists: {field: 'indexes.*'}});
      }
    }

    // todo: get list from ES and do a .map on it for filter on collection/controller/action in addition to index
    return this.search(filter, requestObject.data.body.from, requestObject.data.body.size, requestObject.data.body.hydrate);
  };

  /**
   * Given a Role object, validates its definition and if OK, persist it to the database.
   * @param {Role} role
   * @returns {Promise}
   */
  RoleRepository.prototype.validateAndSaveRole = function (role) {
    var context = {
      connection: {type: 'websocket'},
      user: kuzzle.repositories.user.anonymous()
    };

    if (!role._id) {
      return q.reject(new BadRequestError('Missing role id'));
    }

    return role.validateDefinition(context)
      .then(() => {
        this.roles[role._id] = role;
        return this.persistToDatabase(role);
      });
  };

  /**
   * Given a Role object, delete it from memory and database
   * @param {Role} role
   * @returns {Promise}
   */
  RoleRepository.prototype.deleteRole = function (role) {
    if (!role._id) {
      return q.reject(new BadRequestError('Missing role id'));
    }

    return this.deleteFromDatabase(role._id)
      .then(response => {
        if (this.roles[role._id]) {
          delete this.roles[role._id];
        }

        return response;
      });
  };

  /**
   * From a Role object, returns an object ready to be persisted
   * @param {Role} role
   * @returns {Object}
   */
  RoleRepository.prototype.serializeToDatabase = function (role) {
    return {
      indexes: role.indexes
    };
  };

  RoleRepository.prototype.serializeToCache = RoleRepository.prototype.serializeToDatabase;

  return RoleRepository;
};

