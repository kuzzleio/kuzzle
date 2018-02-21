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
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Role = require('./role'),
  Policies = require('./policies'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  async = require('async');

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
  getRoles(kuzzle) {
    const promises = this.policies.map(policy => {
      return kuzzle.repositories.role.loadRole(policy.roleId)
        .then(loadedRole => _.assignIn(new Role(), loadedRole, policy));
    });

    return Bluebird.all(promises);
  }

  /**
   * @param {Request} request
   * @param {Kuzzle} kuzzle
   * @return {Promise<boolean>}
   */
  isActionAllowed(request, kuzzle) {
    if (this.policies === undefined || this.policies.length === 0) {
      return Bluebird.resolve(false);
    }

    return this.getRoles(kuzzle)
      .then(roles => {
        return new Bluebird(resolve => {
          async.some(roles, (role, callback) => {
            role.isActionAllowed(request, kuzzle)
              .then(isAllowed => callback(null, isAllowed));
          }, (error, result) => resolve(result));
        });
      });
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
          if (typeof restriction !== 'object') {
            return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] should be an object`));
          }
          if (!restriction.index) {
            return Bluebird.reject(new BadRequestError(`policies[${i}].restrictedTo[${j}] Missing mandatory attribute "index"`));
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
  getRights(kuzzle) {
    const profileRights = {};

    return this.getRoles(kuzzle)
      .then(roles => {
        roles.forEach(role => {
          let restrictedTo = _.cloneDeep(role.restrictedTo);

          if (restrictedTo === undefined || restrictedTo.length === 0) {
            restrictedTo = [{index: '*', collections: ['*']}];
          }

          Object.keys(role.controllers).forEach(controller => {
            Object.keys(role.controllers[controller].actions).forEach(action => {
              const actionRights = role.controllers[controller].actions[action];

              restrictedTo.forEach(restriction => {
                if (restriction.collections === undefined || restriction.collections.length === 0) {
                  restriction.collections = ['*'];
                }

                restriction.collections.forEach(collection => {
                  const
                    rightsObject = {},
                    rightsItem = {
                      controller,
                      action,
                      collection,
                      index: restriction.index
                    },
                    rightsKey = kuzzle.constructor.hash(rightsItem);

                  rightsItem.value = actionRights;
                  rightsObject[rightsKey] = rightsItem;
                  _.assignWith(profileRights, rightsObject, Policies.merge);
                });
              });
            });
          });
        });
      })
      .then(() => profileRights);
  }
}

module.exports = Profile;

