var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Repository = require('./repository'),
  Role = require('../security/role');

/**
 * @class RoleRepository
 * @extends Repository
 * @constructor
 */
function RoleRepository() {
  Repository.apply(this, arguments);
  this.collection = 'roles';
  this.ObjectConstructor = Role;
  this.roles = {};
}

RoleRepository.prototype = Object.create(Repository.prototype);
RoleRepository.prototype.constructor = RoleRepository;

RoleRepository.prototype.init = function roleRepositoryInit () {
  Repository.prototype.init.call(this, {});
};

/**
 * From a list of role ids, retrieves the matching Role objects.
 *
 * @param {Array} roleKeys The role ids to load
 * @returns {Promise} Resolves to an array containing the matching found Role objects.
 */
RoleRepository.prototype.loadRoles = function roleRepositoryLoadRoles (roleKeys) {
  var
    keys = [],
    buffer = {},
    result = [];

  roleKeys.forEach(roleKey => {
    if (this.roles[roleKey]) {
      buffer[roleKey] = this.roles[roleKey];
    }
    else {
      keys.push(roleKey);
    }
  });

  if (keys.length === 0) {
    Object.keys(buffer).forEach(key => {
      result.push(buffer[key]);
    });

    return Promise.resolve(result);
  }

  return this.loadMultiFromDatabase(keys)
    .then(roles => {
      var promises = [];

      roles.forEach(role => {
        buffer[role._id] = role;
        this.roles[role._id] = role;
      });

      _.difference(roleKeys, Object.keys(buffer)).forEach((key) => {
        var role;

        if (this.kuzzle.config.security.standard.roles[key] !== undefined) {
          role = new Role();
          promises.push(_.assignIn(role, this.kuzzle.config.security.standard.roles[key]));
        }
      });

      if (promises.length === 0) {
        Object.keys(buffer).forEach((key) => {
          result.push(buffer[key]);
        });

        return result;
      }

      return Promise.all(promises)
        .then(results => {
          results.forEach(role => {
            buffer[role._id] = role;
            this.roles[role._id] = role;
          });

          Object.keys(buffer).forEach(key => {
            result.push(buffer[key]);
          });

          return result;
        });
    });
};

/**
 * Builds a Role object from a Request
 * @param {Request} request
 * @returns {Role}
 */
RoleRepository.prototype.getRoleFromRequest = function roleRepositoryGetRoleFromRequest (request) {
  var role = new Role();
  if (request.input.resource._id) {
    role._id = request.input.resource._id;
  }

  Object.keys(request.input.body).forEach((key) => {
    if (key === 'closures') {
      return false;
    }
    else if (key !== '_id') {
      role[key] = request.input.body[key];
    }
  });

  return role;
};

/**
 * Get from database the document that represent the role given in parameter
 *
 * @param {string} roleId
 * @returns Promise
 */
RoleRepository.prototype.loadRole = function roleRepositoryLoadRole (roleId) {
  if (!roleId) {
    return Promise.reject(new BadRequestError('Missing role id'));
  }

  if (typeof roleId !== 'string') {
    return Promise.reject(new BadRequestError('A role ID must be provided'));
  }

  if (this.roles[roleId]) {
    return Promise.resolve(this.roles[roleId]);
  }

  return this.loadOneFromDatabase(roleId)
    .then(loadedRole => {
      if (loadedRole) {
        this.roles[loadedRole._id] = loadedRole;
      }

      return loadedRole;
    });
};

/**
 *
 * @param {Request} request
 */
RoleRepository.prototype.searchRole = function roleRepositorySearchRole (request) {
  var query = {query: {}};

  request.input.body = request.input.body || {};

  if (request.input.body.controllers && Array.isArray(request.input.body.controllers)) {
    query.query = {bool: {should: []}};

    request.input.body.controllers.forEach(controller => {
      query.query.bool.should.push({exists: {field : 'controllers.' + controller}});
    });

    // Manually add wildcard on index because we want to retrieve roles that add rights on all indexes
    if (request.input.body.controllers.length >= 1) {
      query.query.bool.should.push({exists: {field: 'controllers.*'}});
    }
  }

  // todo: get list from ES and do a .map on it for query on collection/controller/action in addition to index
  return this.search(query, request.input.args.from, request.input.args.size);
};

/**
 * Given a Role object, validates its definition and if OK, persist it to the database.
 *
 * @param {Role} role
 * @param {object} opts The persistence options
 *
 * @returns Promise
 */
RoleRepository.prototype.validateAndSaveRole = function roleRepositoryValidateAndSaveRole (role, opts) {
  if (!role._id) {
    return Promise.reject(new BadRequestError('Missing role id'));
  }

  return role.validateDefinition()
    .then(() => {
      this.roles[role._id] = role;
      return this.persistToDatabase(role, opts);
    })
    .then(() => role);
};

/**
 * Given a Role object, delete it from memory and database
 * @param {Role} role
 * @returns Promise
 */
RoleRepository.prototype.deleteRole = function roleRepositoryDeleteRole (role) {
  if (!role._id) {
    return Promise.reject(new BadRequestError('Missing role id'));
  }

  if (['admin', 'default', 'anonymous'].indexOf(role._id) > -1) {
    return Promise.reject(new BadRequestError(role._id + ' is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.'));
  }

  return this.kuzzle.repositories.profile.searchProfiles([ role._id ], 0, 1)
    .then(response => {
      if (response.total > 0) {
        return Promise.reject(new BadRequestError('The role "' + role._id + '" cannot be deleted since it is used by some profile.'));
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
 * @returns {object}
 */
RoleRepository.prototype.serializeToDatabase = function roleRepositorySerializeToDatabase (role) {
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

module.exports = RoleRepository;
