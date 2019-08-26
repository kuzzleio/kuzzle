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
  _ = require('lodash'),
  errorsManager = require('../../../../config/error-codes/throw')
    .wrap('api', 'security');

const
  _kuzzle = Symbol.for('_kuzzle');

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
   * @return {boolean}
   */
  isActionAllowed (request, restrictedTo = []) {
    if (!this[_kuzzle]) {
      errorsManager.throw(
        'cannot_check_permissions_on_uninitialized_role',
        this._id);
    }

    if (this.controllers === undefined) {
      return false;
    }

    let
      controllerRights,
      actionRights;
    const
      path = [];

    // @deprecated - the "memoryStorage" alias should be removed in the next
    // major version
    // Handles the memory storage controller aliases: ms, memoryStorage
    if ((request.input.controller === 'ms' || request.input.controller === 'memoryStorage')
      && (this.controllers.ms || this.controllers.memoryStorage)
    ) {
      controllerRights = this.controllers.ms || this.controllers.memoryStorage;
      path.push('ms');
    }
    else if (this.controllers[request.input.controller] !== undefined) {
      controllerRights = this.controllers[request.input.controller];
      path.push(request.input.controller);
    }
    else if (this.controllers['*'] !== undefined) {
      controllerRights = this.controllers['*'];
      path.push('*');
    }
    else {
      return false;
    }

    if (controllerRights.actions === undefined) {
      return false;
    }

    if (controllerRights.actions[request.input.action] !== undefined) {
      actionRights = controllerRights.actions[request.input.action];
      path.push(request.input.action);
    }
    else if (controllerRights.actions['*'] !== undefined) {
      actionRights = controllerRights.actions['*'];
      path.push('*');
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
    if (!_.isPlainObject(this.controllers)) {
      errorsManager.throw('controllers_definition_not_an_object');
    }

    if (Object.keys(this.controllers).length === 0) {
      errorsManager.throw('empty_controllers_definition');
    }

    Object.entries(this.controllers).forEach(this.validateControllerRights);
  }

  /**
   * Verifies that a controller rights definition is correct
   *
   * @param  {Array.<string, Object>}
   * @throws If the controller definition is invalid
   */
  validateControllerRights ([name, controller]) {
    if (!_.isPlainObject(controller)) {
      errorsManager.throw('controller_definition_not_an_object', name);
    }

    if (Object.keys(controller).length === 0) {
      errorsManager.throw('empty_controller_definition', name);
    }

    if (controller.actions === undefined) {
      errorsManager.throw(
        'actions_attribute_missing_in_controller_definition',
        name);
    }

    if (!_.isPlainObject(controller.actions)) {
      errorsManager.throw(
        'actions_attribute_not_an_object_in_controller_definition',
        name);
    }

    if (Object.keys(controller.actions).length === 0) {
      errorsManager.throw(
        'actions_attribute_empty_in_controller_definition',
        name);
    }

    for (const [actionName, action] of Object.entries(controller.actions)) {
      if (typeof action !== 'boolean') {
        errorsManager.throw(
          'invalid_type_in_definition_for_controller_action',
          name,
          actionName);
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
