/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Bluebird = require('bluebird'),
  Repository = require('./repository'),
  Role = require('../security/role'),
  errorsManager = require('../../../util/errors'),
  didYouMean = require('../../../util/didYouMean'),
  roleRightsError = errorsManager.wrap('security', 'role');

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
    this.roles = new Map();
  }

  init () {
    super.init({
      cacheEngine: null
    });
  }

  /**
   * From a list of role ids, retrieves the matching Role objects.
   *
   * @param {Array} ids The role ids to load
   * @param {Object} options - resetCache (false)
   * @returns {Promise} Resolves to an array containing the matching found Role objects.
   */
  loadRoles (ids, { resetCache=false } = {}) {
    const roles = [];

    for (const id of ids) {
      let role = this.roles.get(id);

      if (resetCache || !role) {
        role = this.loadOneFromDatabase(id)
          .then(r => {
            this.roles.set(id, r);
            return r;
          });

        this.roles.set(id, role);
      }

      roles.push(role);
    }

    return Bluebird.all(roles);
  }

  /**
   * Builds a Role object from a Request
   *
   * @param {Request} request
   * @returns {Role}
   */
  getRoleFromRequest (request) {
    const dto = {};

    if (request.input.resource._id) {
      dto._id = request.input.resource._id;
    }

    for (const key of Object.keys(request.input.body || {})) {
      if (key !== '_id') {
        dto[key] = request.input.body[key];
      }
    }

    dto._kuzzle_info = {
      author: request.context.user ? String(request.context.user._id) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    return this.fromDTO(dto);
  }

  /**
   * Get from database the document that represent the role given in parameter
   *
   * @param {string} id
   * @returns {object} role
   */
  async load (id) {
    if (!id) {
      throw errorsManager.get('api', 'assert', 'missing_argument', 'roleId');
    }
    if (typeof id !== 'string') {
      throw errorsManager.get('api', 'assert', 'invalid_type', 'roleId', '<string>');
    }

    if (this.roles.has(id)) {
      return this.roles.get(id);
    }

    const role = await this.loadOneFromDatabase(id);
    await this.roles.set(role._id, role);

    return role;
  }

  /**
   * @override
   */
  loadOneFromDatabase (id) {
    return super.loadOneFromDatabase(id)
      .catch(err => {
        if (err.status === 404) {
          throw errorsManager.get('security', 'role', 'not_found', id);
        }
        throw err;
      });
  }

  /**
   * @param {Array} controllers
   * @param {int} from
   * @param {int} size
   */
  searchRole (controllers, from, size) {
    return this.search(
      { query: {}, sort: [{ _id: { order: 'asc' } }]},
      { from: 0, size: 1000 })
      .then(res => {
        const result = {
          hits: res.hits,
          total: res.total
        };

        if (controllers && Array.isArray(controllers)) {
          result.hits = res.hits.filter(role => Object.keys(role.controllers)
            .some(key => key === '*' || controllers.includes(key)));
          result.total = result.hits.length;
        }

        const to = size && (from || 0) + size;
        result.hits = result.hits.slice(from, to);

        return result;
      });
  }

  /**
   * Given a Role object, validates its definition and if OK, persist it to the database.
   *
   * @param {Role} role
   * @param {object} [options] The persistence options
   * @returns Promise
   */
  async validateAndSaveRole (role, options = {}) {
    await role.validateDefinition();

    if (role._id === 'anonymous' && !role.canLogIn()) {
      throw errorsManager.get('security', 'role', 'login_required');
    }
    
    this.kuzzle.emit('core:roleRepository:save', {
      _id: role._id,
      controllers: role.controllers
    });

    this.checkRoleNativeRights(role); 
    this.checkRolePluginsRights(role, options);
    await this.persistToDatabase(role, options);
    
    const updatedRole = await this.loadOneFromDatabase(role._id);    
    await this.roles.set(role._id, updatedRole);

    return updatedRole;
  }

  /**
   * Given a Role object, checks if its controllers and actions exist.
   *
   * @param {Role} role
   */
  checkRoleNativeRights(role) {
    Object.keys(role.controllers).forEach(roleController => {
      if ( roleController !== '*'
        && !this.kuzzle.funnel.isNativeController(roleController)
      ) {
        return;
      }
      
      if (roleController === '*') {
        Object.keys(role.controllers['*'].actions).forEach(action => {
          if (action !== '*') {
            throw roleRightsError.get('unknown_action', role._id, action, '*');
          }
        });
      }
      else {
        const controller = this.kuzzle.funnel.controllers.get(roleController);
        const actions = Object.keys(role.controllers[roleController].actions); 
      
        actions.forEach(action => {
          if (action !== '*' && !controller._isAction(action)) {
            throw roleRightsError.get(
              'unknown_action',
              role._id,
              action,
              roleController,
              didYouMean(action, controller.__actions));
          }
        });
      }
    });
  }

  /**
   * Given a Role object, checks if its controllers and actions exist in plugins.
   *
   * @param {Role} role
   * @param {Force} force
   */
  checkRolePluginsRights(role, { force=false } = {}) {
    Object.keys(role.controllers).forEach(roleController => {
      if ( !(roleController !== '*'
        && !this.kuzzle.funnel.isNativeController(roleController))
      ) {
        return;
      }
      
      if (!this.kuzzle.pluginsManager.isController(roleController)) {
        if (!force) {
          throw roleRightsError.get(
            'unknown_controller',
            role._id,
            roleController,
            didYouMean(roleController, this.kuzzle.pluginsManager.getControllerNames()));
        }
      
        this.kuzzle.log.warn(
          `The role "${role._id}" gives access to the non-existing controller "${roleController}".`);
      
        return;
      }
      
      const roleActions = Object.keys(role.controllers[roleController].actions);
      roleActions.forEach(action => {
        if ( action !== '*'
          && !this.kuzzle.pluginsManager.isAction(roleController, action)
        ) {
          if (!force) {
            throw roleRightsError.get(
              'unknown_action',
              role._id,
              action,
              roleController,
              didYouMean(action, this.kuzzle.pluginsManager.getActions(roleController)));
          }
          this.kuzzle.log.warn(
            `The role "${role._id}" gives access to the non-existing action "${action}" for the controller "${roleController}".`);
        }
      });
    });
  }

  /**
   * Fetching roles and check for each of them for invalid plugin rights.
   * If there are some, Kuzzle will log a warning.
   */

  async sanityCheck() {
    const roles = await this.search({}, {});
    
    roles.hits.forEach(role => {
      this.checkRolePluginsRights(role, { force: true });
    });
  }

  /**
   * Given a Role object, delete it from memory and database
   *
   * @param {Role} role
   * @param {object} [options]
   * @returns Promise
   */
  delete (role, options = {}) {
    if (['admin', 'default', 'anonymous'].indexOf(role._id) > -1) {
      return errorsManager.reject('security', 'role', 'cannot_delete');
    }

    return this.kuzzle.repositories.profile
      .searchProfiles([role._id], { from: 0, size: 1 })
      .then(response => {
        if (response.total > 0) {
          return errorsManager.reject('security', 'role', 'in_use', role._id);
        }

        return this.deleteFromDatabase(role._id, options)
          .then(deleteResponse => {
            this.roles.delete(role._id);
            this.kuzzle.emit('core:roleRepository:delete', { _id: role._id });
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
    const serializedRole = {};

    Object.keys(role).forEach(key => {
      if (key !== '_id' && key !== 'restrictedTo') {
        serializedRole[key] = role[key];
      }
    });

    return serializedRole;
  }
}

module.exports = RoleRepository;
