/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import * as kerror from '../../kerror';
import { has, isPlainObject } from '../../util/safeObject';
import { binarySearch } from '../../util/array';
import { ControllerRight, ControllerRights } from '../../types/ControllerRights';
import { KuzzleRequest } from '../../../index';
import { OptimizedPolicyRestrictions } from '../../types/PolicyRestrictions';

const assertionError = kerror.wrap('api', 'assert');

/**
 * @class Role
 */
export class Role {
  public controllers: ControllerRights;
  public _id: string;

  constructor () {
    this.controllers = {};
  }

  /**
   * @param {Request} request
   * @returns {boolean}
   */
  isActionAllowed (request: KuzzleRequest): boolean {
    if (! global.kuzzle) {
      throw kerror.get('security', 'role', 'uninitialized', this._id);
    }

    if (this.controllers === undefined || this.controllers === null) {
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

    if (typeof actionRights !== 'boolean' || ! actionRights) {
      return false;
    }

    return true;
  }

  /**
   * @returns {Promise}
   */
  async validateDefinition () {
    if (this.controllers === undefined || this.controllers === null) {
      throw assertionError.get('missing_argument', `${this._id}.controllers`);
    }

    if (! isPlainObject(this.controllers)) {
      throw assertionError.get('invalid_type', `${this._id}.controllers`, 'object');
    }

    if (Object.keys(this.controllers).length === 0) {
      throw assertionError.get('empty_argument', `${this._id}.controllers`);
    }

    Object
      .entries(this.controllers)
      .forEach(entry => this.validateControllerRights(...entry));
  }


  /**
   * @param {String} index
   * @param {String} collection
   * @param {Map<string, string[]>} restrictedTo Restricted indexes
   * @returns {Boolean} resolves to a Boolean value
   */
  checkRestrictions (index: string, collection: string, restrictedTo: OptimizedPolicyRestrictions): boolean {
    // If no restrictions, we allow the action:
    if (! restrictedTo || restrictedTo.size === 0) {
      return true;
    }

    // If the request's action does not refer to an index, restrictions are
    // useless for this action (=> ignore them)
    if (! index) {
      return true;
    }

    // If the index is not in the restrictions, the action is not allowed
    if (! restrictedTo.has(index)) {
      return false;
    }

    const collections = restrictedTo.get(index);

    // if no collections given on the restriction, the action is allowed for all
    // collections:
    if (! collections || collections.length === 0) {
      return true;
    }

    // Find collection index in array
    // If the collection is not in the array, the action is not allowed
    // The array must be sorted for binary search to work
    const indexOfCollection = binarySearch(collections, (collectionName) => {
      if (collection > collectionName) {
        return 1;
      }
      return collection < collectionName ? -1 : 0;
    });

    return indexOfCollection > -1; // Collection found
  }

  /**
   * Verifies that a controller rights definition is correct
   *
   * @param  {Array.<string, Object>}
   * @throws If the controller definition is invalid
   */
  validateControllerRights (name: string, controller: ControllerRight) {
    if (! isPlainObject(controller)) {
      throw assertionError.get('invalid_type', name, 'object');
    }

    if (Object.keys(controller).length === 0) {
      throw assertionError.get('empty_argument', name);
    }

    if (! has(controller, 'actions')) {
      throw assertionError.get('missing_argument', name);
    }

    if (! isPlainObject(controller.actions)) {
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
  canLogIn (): boolean {
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
