/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const
  _ = require('lodash'),
  Policies = require('./policies'),
  Bluebird = require('bluebird'),
  {
    BadRequestError,
    PreconditionError
  } = require('kuzzle-common-objects').errors;

const
  _kuzzle = Symbol.for('_kuzzle');

/**
 * @class Profile
 */
class Profile {
  constructor() {
    this._id = null;
    this.policies = [];
  }

  /**
   * @param {Kuzzle} kuzzle
   *
   * @return {Promise}
   */
  getRoles() {
    if (!this[_kuzzle]) {
      throw new PreconditionError(`Cannot get roles for uninitialized profile ${this._id}`);
    }

    return Bluebird.all(this.policies.map(policy => {
      return this[_kuzzle].repositories.role.load(policy.roleId)
        .then(role => {
          if (policy.restrictedTo) {
            role.restrictedTo = policy.restrictedTo;
          }
          return role;
        });
    }));
  }

  /**
   * @param {Request} request
   * @param {Kuzzle} kuzzle
   * @return {Promise<boolean>}
   */
  isActionAllowed(request) {
    if (this.policies === undefined || this.policies.length === 0) {
      return Bluebird.resolve(false);
    }

    return this.getRoles()
      .then(roles => new Bluebird((resolve, reject) => {
        Bluebird.all(roles.map(role => role.isActionAllowed(request)
          .then(isAllowed => {
            if (isAllowed) {
              resolve(true);
            }
          })
          .catch(reject)
        ))
          .then(results => resolve(results.some(r => r)));
      }));
  }

  /**
   * Validates the Profile format
   *
   * @return {Promise<boolean>}
   */
  validateDefinition() {
    if (!Array.isArray(this.policies)) {
      return Bluebird.reject(new BadRequestError('The roles member must be an array'));
    }

    if (this.policies.length === 0) {
      return Bluebird.reject(new BadRequestError('The roles member array cannot be empty'));
    }

    return Bluebird.resolve(true);
  }

  /**
   * Resolves an array of rights related to the profile's roles.
   *
   * @return {Promise}
   */
  getRights() {
    const profileRights = {};

    return this.getRoles()
      .then(roles => {
        for (const role of roles) {
          let restrictedTo = _.cloneDeep(role.restrictedTo);

          if (restrictedTo === undefined || restrictedTo.length === 0) {
            restrictedTo = [{index: '*', collections: ['*']}];
          }

          for (const controller of Object.keys(role.controllers)) {
            for (const action of Object.keys(role.controllers[controller].actions)) {
              const actionRights = role.controllers[controller].actions[action];

              for (const restriction of restrictedTo) {
                if (restriction.collections === undefined || restriction.collections.length === 0) {
                  restriction.collections = ['*'];
                }

                for (const collection of restriction.collections) {
                  const
                    rightsObject = {},
                    rightsItem = {
                      controller,
                      action,
                      collection,
                      index: restriction.index
                    },
                    rightsKey = this.constructor._hash(rightsItem);

                  rightsItem.value = actionRights;
                  rightsObject[rightsKey] = rightsItem;
                  _.assignWith(profileRights, rightsObject, Policies.merge);
                }
              }
            }
          }
        }

        return profileRights;
      });
  }

  static _hash () {
    return false;
  }
}

module.exports = Profile;

