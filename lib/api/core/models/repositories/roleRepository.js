'use strict';

const
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Repository = require('./repository'),
  Role = require('../security/role');

/**
 * @class RoleRepository
 * @extends Repository
 */
class RoleRepository extends Repository {
  /**
   * @constructor
   * @param {Kuzzle} kuzzle
   */
  constructor (kuzzle) {
    super(kuzzle);

    this.collection = 'roles';
    this.ObjectConstructor = Role;
    this.roles = {};
  }

  init () {
    super.init({
      cacheEngine: null
    });
  }

  /**
   * From a list of role ids, retrieves the matching Role objects.
   *
   * @param {Array} roleKeys The role ids to load
   * @returns {Promise} Resolves to an array containing the matching found Role objects.
   */
  loadRoles (roleKeys) {
    const
      keys = [],
      buffer = {},
      result = [];

    roleKeys.forEach(roleKey => {
      if (this.roles[roleKey]) {
        buffer[roleKey] = this.roles[roleKey];
      }
      else if (this.kuzzle.config.security.standard.roles[roleKey]) {
        const role = new Role();
        role._id = roleKey;
        buffer[roleKey] = _.assignIn(role, this.kuzzle.config.security.standard.roles[roleKey]);
        this.roles[roleKey] = role;
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
        roles.forEach(r => {
          buffer[r._id] = r;
          this.roles[r._id] = r;
        });

        Object.keys(buffer).forEach((key) => {
          result.push(buffer[key]);
        });

        return result;
      });
  }

  /**
   * Builds a Role object from a Request
   *
   * @param {Request} request
   * @returns {Role}
   */
  getRoleFromRequest (request) {
    let role = new Role();

    if (request.input.resource._id) {
      role._id = request.input.resource._id;
    }

    Object.keys(request.input.body || {}).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        role[key] = request.input.body[key];
      }
    });

    return role;
  }

  /**
   * Get from database the document that represent the role given in parameter
   *
   * @param {string} roleId
   * @returns Promise
   */
  loadRole (roleId) {
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
  }

  /**
   * @param {Array} controllers
   * @param {int} from
   * @param {int} size
   */
  searchRole (controllers, from, size) {
    return this.search({query: {}}, 0, 1000)
      .then(res => {
        let result = {
          hits: res.hits,
          total: res.total
        };

        if (controllers && Array.isArray(controllers)) {
          result.hits = res.hits.filter(role => Object.keys(role.controllers).some(key => key === '*' || controllers.includes(key)));
          result.total = result.hits.length;
        }
        let to = size && (from || 0) + size;
        result.hits = result.hits.slice(from, to);

        return result;
      });
  }

  /**
   * Given a Role object, validates its definition and if OK, persist it to the database.
   *
   * @param {Role} role
   * @param {object} opts The persistence options
   * @returns Promise
   */
  validateAndSaveRole (role, opts) {
    return role.validateDefinition()
      .then(() => {
        this.roles[role._id] = role;
        this.kuzzle.pluginsManager.trigger('core:roleRepository:save', {_id: role._id, controllers: role.controllers});
        return this.persistToDatabase(role, opts);
      })
      .then(() => role);
  }

  /**
   * Given a Role object, delete it from memory and database
   *
   * @param {Role} role
   * @returns Promise
   */
  deleteRole (role) {
    if (['admin', 'default', 'anonymous'].indexOf(role._id) > -1) {
      return Promise.reject(new BadRequestError(role._id + ' is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.'));
    }

    return this.kuzzle.repositories.profile.searchProfiles([role._id], 0, 1)
      .then(response => {
        if (response.total > 0) {
          return Promise.reject(new BadRequestError('The role "' + role._id + '" cannot be deleted since it is used by some profile.'));
        }

        return this.deleteFromDatabase(role._id)
          .then(deleteResponse => {
            if (this.roles[role._id]) {
              delete this.roles[role._id];
            }

            this.kuzzle.pluginsManager.trigger('core:roleRepository:delete', {_id: role._id});
            return deleteResponse;
          });
      });
  }

  /**
   * From a Role object, returns an object ready to be persisted
   *
   * @param {Role} role
   * @returns {object}
   */
  serializeToDatabase (role) {
    let serializedRole = {};

    Object.keys(role).forEach((key) => {
      if (['_id', 'closures', 'restrictedTo'].indexOf(key) === -1) {
        serializedRole[key] = role[key];
      }
    });

    return serializedRole;
  }
}

module.exports = RoleRepository;
