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

const { isNil } = require('lodash');
const kerror = require('../../kerror');
const { has, isPlainObject } = require('../../util/safeObject');

const assertionError = kerror.wrap('api', 'assert');

/**
 * @class Role
 */
class Role {
  constructor () {
    this.controllers = {};
  }

  /**
   * @param {Request} request
   * @param {Array} restrictedTo
   * @returns {boolean}
   */
  isActionAllowed (request, restrictedTo = []) {
    if (!global.kuzzle) {
      throw kerror.get('security', 'role', 'uninitialized', this._id);
    }

    if (isNil(this.controllers)) {
      return false;
    }

    let controllerRights;

    // @deprecated - the "memoryStorage" alias should be removed in the next
    // major version
    // Handles the memory storage controller aliases: ms, memoryStorage
    if ((request.input.controller === 'ms' || request.input.controller === 'memoryStorage')
      && (this.controllers.ms || this.controllers.memoryStorage)
    ) {
      controllerRights = this.controllers.ms || this.controllers.memoryStorage;
    }
    else if (has(this.controllers, request.input.controller)) {
      controllerRights = this.controllers[request.input.controller];
    }
    else if (this.controllers['*'] !== undefined) {
      controllerRights = this.controllers['*'];
    }
    else {
      return false;
    }

    if (controllerRights.actions === undefined) {
      return false;
    }

    let actionRights;

    if (has(controllerRights.actions, request.input.action)) {
      actionRights = controllerRights.actions[request.input.action];
    }
    else if (controllerRights.actions['*'] !== undefined) {
      actionRights = controllerRights.actions['*'];
    }
    else {
      return false;
    }

    if (typeof actionRights !== 'boolean' || !actionRights) {
      return false;
    }

    return checkRestrictions(request, restrictedTo);
  }

  /**
   * @returns {Promise}
   */
  async validateDefinition () {
    if (isNil(this.controllers)) {
      throw assertionError.get('missing_argument', 'controllers');
    }

    if (!isPlainObject(this.controllers)) {
      throw assertionError.get('invalid_type', 'controllers', 'object');
    }

    if (Object.keys(this.controllers).length === 0) {
      throw assertionError.get('empty_argument', 'controllers');
    }

    Object
      .entries(this.controllers)
      .forEach(entry => this.validateControllerRights(...entry));
  }

  /**
   * Verifies that a controller rights definition is correct
   *
   * @param  {Array.<string, Object>}
   * @throws If the controller definition is invalid
   */
  validateControllerRights (name, controller) {
    if (!isPlainObject(controller)) {
      throw assertionError.get('invalid_type', name, 'object');
    }

    if (Object.keys(controller).length === 0) {
      throw assertionError.get('empty_argument', name);
    }

    if (!has(controller, 'actions')) {
      throw assertionError.get('missing_argument', name);
    }

    if (!isPlainObject(controller.actions)) {
      throw assertionError.get('invalid_type', `${name}.actions`, 'object');
    }

    if (Object.keys(controller.actions).length === 0) {
      throw assertionError.get('empty_argument', `${name}.actions`);
    }

    for (const [actionName, action] of Object.entries(controller.actions)) {
      if (typeof action !== 'boolean') {
        throw assertionError.get('invalid_type', `${name}.actions.${actionName}`, 'boolean');
      }
    }
  }

  /**
   * Checks if current role allows to log in
   *
   * @returns {boolean}
   */
  canLogIn () {
    for (const controllerKey of ['auth', '*']) {
      if (this.controllers[controllerKey]) {
        const controller = this.controllers[controllerKey];

        for (const actionKey of ['login', '*']) {
          const action = controller.actions[actionKey];

          if (typeof action === 'boolean' && action) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

/**
 * @param {Request} request
 * @param {object} restriction a restriction object on an index
 * @returns {Boolean}
 */
function checkIndexRestriction(request, restriction) {
  if (restriction.index !== request.input.resource.index) {
    return false;
  }

  // if no collections given on the restriction, the action is allowed for all
  // collections:
  if (!restriction.collections || restriction.collections.length === 0) {
    return true;
  }

  // If the request's action does not refer to a collection, the restriction
  // is useless for this action (=> ignored):
  if (!request.input.resource.collection) {
    return true;
  }

  return restriction.collections.indexOf(request.input.resource.collection) > -1;
}

/**
 * @param {Request} request
 * @param {Array} restrictedTo
 * @returns {Boolean} resolves to a Boolean value
 */
function checkRestrictions(request, restrictedTo) {
  // If no restrictions, we allow the action:
  if (restrictedTo.length === 0) {
    return true;
  }

  // If the request's action does not refer to an index, restrictions are useless for this action (=> ignore them):
  if (!request.input.resource.index) {
    return true;
  }

  return restrictedTo
    .some(restriction => checkIndexRestriction(request, restriction));
}

module.exports = Role;
