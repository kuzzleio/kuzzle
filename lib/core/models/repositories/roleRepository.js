/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  errorsManager = require('../../../util/errors');

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
   * @returns Promise
   */
  load (id) {
    if (!id) {
      return errorsManager.reject(
        'api',
        'assert',
        'missing_argument',
        'roleId'
      );
    }
    if (typeof id !== 'string') {
      return errorsManager.reject(
        'api',
        'assert',
        'invalid_type',
        'roleId',
        '<string>'
      );
    }

    if (this.roles.has(id)) {
      return Bluebird.resolve(this.roles.get(id));
    }

    return this.loadOneFromDatabase(id)
      .then(role => {
        this.roles.set(role._id, role);

        return role;
      });
  }

  /**
   * @override
   */
  loadOneFromDatabase (id) {
    return super.loadOneFromDatabase(id)
      .catch(err => {
        if (err.status === 404) {
          errorsManager.throw('security', 'role', 'not_found', id);
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
    return this.search({ query: {} }, { from: 0, size: 1000 })
      .then(res => {
        const result = {
          hits: res.hits,
          total: res.total
        };

        if (controllers && Array.isArray(controllers)) {
          result.hits = res.hits.filter(role =>
            Object.keys(role.controllers)
              .some(key => key === '*' || controllers.includes(key))
          );
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
  validateAndSaveRole (role, options) {

    return role
      .validateDefinition()
      .then(() => {
        if (role._id === 'anonymous' && !role.canLogIn()) {
          errorsManager.throw('security', 'role', 'login_required');
        }

        this.kuzzle.emit('core:roleRepository:save', {
          _id: role._id,
          controllers: role.controllers
        });
      })
      .then(() => this.checkRoleNativeRights(role))
      .then(() => {
        const force = options ? options.force : false;
        this.checkRolePluginsRights(role, force);
      })
      .then(() => this.persistToDatabase(role, options))
      .then(() => this.loadOneFromDatabase(role._id))
      .then(updatedRole => {
        this.roles.set(role._id, updatedRole);
        return updatedRole;
      });
  }

  /**
   * Given a Role object, checks if its controllers and actions exist.
   *
   * @param {Role} role
   */
  checkRoleNativeRights(role) {
    const roleRightsError = errorsManager.wrap('security', 'role');
    Object.keys(role.controllers).forEach(roleController => {
      if (roleController !== '*' && !this.kuzzle.funnel.controllers.has(roleController)) {
        if (roleController.split('/').length > 1) {
          // Meaning this is a plugin controller. So we skip it.
          return;
        }
        roleRightsError.throw('unknown_controller', role._id, roleController);
      }
      if (roleController === '*') {
        this.kuzzle.funnel.controllers.forEach(controller => {
          Object.keys(role.controllers['*'].actions).forEach(action => {
            if (action !== '*' && !controller._isAction(action)) {
              roleRightsError.throw('unknown_controller_action', role._id, action, controller);
            }
          });
        });
      }
      else {
        const controller = this.kuzzle.funnel.controllers.get(roleController);
        const actions = Object.keys(role.controllers[roleController].actions); 
        actions.forEach(action => {
          if (action !== '*' && !controller._isAction(action)) {
            roleRightsError.throw('unknown_controller_action', role._id, action, roleController);
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
  checkRolePluginsRights(role, force = false) {
    const roleRightsError = errorsManager.wrap('security', 'role');
    Object.keys(role.controllers).forEach(roleController => {
      if (roleController.split('/').length === 1) {
        // Meaning this is not a plugin controller. So we skip it.
        return;
      }
      const pluginName = roleController.split('/')[0];
      const pluginController = roleController.split('/')[1];
      const availablePlugins = Object.keys(this.kuzzle.pluginsManager.plugins);
      if (!availablePlugins.includes(pluginName)) {
        if (!force) {
          roleRightsError.throw('unavailable_plugin', role._id, pluginName);
        }
        this.kuzzle.log.warn(`[!WARNING!] Trying to set role "${role._id}" with plugin "${pluginName}" which doesn't exist or is not enabled.`);
        return;
      }
      const roleActions = Object.keys(role.controllers[`${pluginName}/${pluginController}`].actions);
      const pluginControllers = Object.keys(this.kuzzle.pluginsManager.plugins[pluginName].object.controllers);
      if (pluginController !== '*' && !pluginControllers.includes(pluginController)) {
        if (!force) {
          roleRightsError.throw('unavailable_controller_plugin', role._id, pluginController, pluginName);
        }
        this.kuzzle.log.warn(`[!WARNING!] Role "${role._id}" gives access to the non-existing controller "${pluginController}" in the plugin "${pluginName}".`);
        return;
      }
      const pluginActions = [];
      this.kuzzle.pluginsManager.plugins[pluginName].object.routes.forEach(route => {
        pluginActions.push(route.action);
      });
      roleActions.forEach(action => {
        if (action !== '*' && !pluginActions.includes(action)) {
          if (!force) {
            roleRightsError.throw('unavailable_action_plugin', role._id, action, pluginController, pluginName);
          }
          this.kuzzle.log.warn(`[!WARNING!] The role "${role._id}" gives access to the non-existing action "${action}" for the controller "${pluginController}" in the plugin "${pluginName}".`);
          return;
        }
      });
    });
    return;
  }

  /**
   * Fetching roles and check for each of them for invalid plugin rights.
   * If there are some, Kuzzle will log a warning.
   */

  checkAllRolePluginsRights() {
    return this.search({}, {})
      .then(roles => roles.hits.forEach(role => {
        this.checkRolePluginsRights(role, true);
      })
      );
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
