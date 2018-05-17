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
        Bluebird.map(roles, role => role.isActionAllowed(request))
          .then(results => resolve(results.some(r => r)))
          .catch(reject);
      }));
  }

  /**
   * Validates the Profile format
   *
   * @return {Promise<boolean>}
   */
  validateDefinition() {
    if (!Array.isArray(this.policies)) {
      return Bluebird.reject(new BadRequestError('The "policies" attribute is mandatory and must be an array'));
    }

    if (this.policies.length === 0) {
      return Bluebird.reject(new BadRequestError('The "policies" attribute array cannot be empty'));
    }

    let i = 0;
    for (const policy of this.policies) {
      if (!policy.roleId) {
        return Bluebird.reject(new BadRequestError(`policies[${i}] Missing mandatory attribute "roleId"`));
      }

      for (const member of Object.keys(policy)) {
        if (member !== 'roleId' && member !== 'restrictedTo') {
          return Bluebird.reject(new BadRequestError(`policies[${i}] Unexpected attribute "${member}". Valid attributes are "roleId" and "restrictedTo"`));
        }
      }

      if (policy.restrictedTo) {
        if (!Array.isArray(policy.restrictedTo)) {
          return Bluebird.reject(new BadRequestError(`policies[${i}] Expected "restrictedTo" to be an array of objects`));
        }

        let j = 0;
        for (const restriction of policy.restrictedTo) {
          if (restriction === null || typeof restriction !== 'object' || Array.isArray(restriction)) {
            return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] should be an object`));
          }

          if (restriction.index === null || restriction.index === undefined) {
            return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Missing mandatory attribute "index"`));
          }

          if (typeof restriction.index !== 'string' || restriction.index.length === 0) {
            return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Attribute "index" must be a non-empty string value`));
          }

          if (restriction.collections !== undefined && restriction.collections !== null) {
            if (!Array.isArray(restriction.collections)) {
              return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Attribute "collections" must be of type "array"`));
            }

            if (restriction.collections.some(c => typeof c !== 'string' || c.length === 0)) {
              return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Attribute "collections" can only contain non-empty string values`));
            }
          }

          for (const member of Object.keys(restriction)) {
            if (member !== 'index' && member !== 'collections') {
              return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Unexpected attribute "${member}". Valid attributes are "index" and "collections"`));
            }
          }

          j++;
        }
      }

      i++;
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

