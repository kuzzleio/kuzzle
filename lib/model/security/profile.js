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

const _ = require('lodash');
const Bluebird = require('bluebird');

const Rights = require('./rights');
const kerror = require('../../kerror');
const { isPlainObject } = require('../../util/safeObject');

const assertionError = kerror.wrap('api', 'assert');

/**
 * @class Profile
 */
class Profile {
  constructor() {
    this._id = null;
    this.policies = [];
    this.rateLimit = 0;
  }

  /**
   * @param {Kuzzle} kuzzle
   *
   * @returns {Promise}
   */
  async getPolicies() {
    if (!global.kuzzle) {
      throw kerror.get('security', 'profile', 'uninitialized', this._id);
    }

    return Bluebird.map(this.policies, async ({restrictedTo, roleId}) => {
      const role = await global.kuzzle.ask('core:security:role:get', roleId);
      return {restrictedTo, role};
    });
  }

  /**
   * @param {Request} request
   * @param {Kuzzle} kuzzle
   * @returns {Promise<boolean>}
   */
  async isActionAllowed(request) {
    if (this.policies === undefined || this.policies.length === 0) {
      return false;
    }

    const policies = await this.getPolicies();

    const results = await Bluebird.map(
      policies,
      policy => policy.role.isActionAllowed(request, policy.restrictedTo));

    return results.includes(true);
  }

  /**
   * Validates the Profile format
   *
   * @param {Object} [options]
   * @param {boolean} [options.strict] - If true, only allows resctrictions on
   *                                     existing indexes/collections
   * @returns {Promise}
   */
  async validateDefinition({ strict = false } = {}) {
    this.validateRateLimit();

    if (!this.policies) {
      throw assertionError.get('missing_argument', 'policies');
    }

    if (!Array.isArray(this.policies)) {
      throw assertionError.get('invalid_type', 'policies', 'object[]');
    }

    if (this.policies.length === 0) {
      throw assertionError.get('empty_argument', 'policies');
    }

    let i = 0;
    for (const policy of this.policies) {
      if (!policy.roleId) {
        throw assertionError.get('missing_argument', `policies[${i}].roleId`);
      }

      for (const member of Object.keys(policy)) {
        if (member !== 'roleId' && member !== 'restrictedTo') {
          throw assertionError.get(
            'unexpected_argument',
            `policies[${i}].${member}`,
            '"roleId", "restrictedTo"');
        }
      }

      if (policy.restrictedTo) {
        if (!Array.isArray(policy.restrictedTo)) {
          throw assertionError.get(
            'invalid_type',
            `policies[${i}].restrictedTo`,
            'object[]');
        }

        let j = 0;
        for (const restriction of policy.restrictedTo) {
          if (!isPlainObject(restriction)) {
            throw assertionError.get(
              'invalid_type',
              `policies[${i}].restrictedTo[${restriction}]`,
              'object');
          }

          if (restriction.index === null || restriction.index === undefined) {
            throw assertionError.get(
              'missing_argument',
              `policies[${i}].restrictedTo[${j}].index`);
          }

          if (strict) {
            const indexExists = await global.kuzzle.ask(
              'core:storage:public:index:exist',
              restriction.index);

            if (!indexExists) {
              throw kerror.get(
                'services',
                'storage',
                'unknown_index',
                restriction.index);
            }
          }

          if ( restriction.collections !== undefined
            && restriction.collections !== null
          ) {
            if (!Array.isArray(restriction.collections)) {
              throw assertionError.get(
                'invalid_type',
                `policies[${i}].restrictedTo[${j}].collections`,
                'string[]');
            }

            if (strict) {
              const invalidCollections = [];
              for (const collection of restriction.collections) {
                const isValid = await global.kuzzle.ask(
                  'core:storage:public:collection:exist',
                  restriction.index,
                  collection);

                if (!isValid) {
                  invalidCollections.push(collection);
                }
              }

              if (invalidCollections.length > 0) {
                throw kerror.get(
                  'services',
                  'storage',
                  'unknown_collection',
                  restriction.index,
                  invalidCollections);
              }
            }
          }

          for (const member of Object.keys(restriction)) {
            if (member !== 'index' && member !== 'collections') {
              throw assertionError.get(
                'unexpected_argument',
                `policies[${i}].restrictedTo[${j}].${member}`,
                '"index", "collections"');
            }
          }

          j++;
        }
      }

      i++;
    }

    return true;
  }

  /**
   * Resolves an array of rights related to the profile's roles.
   *
   * @returns {Promise}
   */
  async getRights () {
    const profileRights = {};

    const policies = await this.getPolicies();

    for (const policy of policies) {
      const role = policy.role;
      let restrictedTo = _.cloneDeep(policy.restrictedTo);

      if (restrictedTo === undefined || restrictedTo.length === 0) {
        restrictedTo = [{collections: ['*'], index: '*'}];
      }

      for (const [controller, rights] of Object.entries(role.controllers)) {
        for (const [action, actionRights] of Object.entries(rights.actions)) {
          for (const restriction of restrictedTo) {
            if (restriction.collections === undefined
              || restriction.collections.length === 0
            ) {
              restriction.collections = ['*'];
            }

            for (const collection of restriction.collections) {
              const rightsItem = {
                action,
                collection,
                controller,
                index: restriction.index,
                value: actionRights
              };
              const rightsObject = {
                [this.constructor._hash(rightsItem)]: rightsItem
              };

              _.assignWith(profileRights, rightsObject, Rights.merge);
            }
          }
        }
      }
    }

    return profileRights;
  }

  static _hash () {
    return false;
  }

  validateRateLimit () {
    if (this.rateLimit === null || this.rateLimit === undefined) {
      this.rateLimit = 0;
    }

    if ( typeof this.rateLimit !== 'number'
      || !Number.isInteger(this.rateLimit)
    ) {
      throw assertionError.get('invalid_type', 'rateLimit', 'integer');
    }

    if (this.rateLimit < 0) {
      throw assertionError.get('invalid_argument', 'rateLimit', 'positive integer, or zero');
    }
  }
}

module.exports = Profile;
