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
  _ = require('lodash'),
  Rights = require('./rights'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../../util/errors'),
  { isPlainObject } = require('../../../util/safeObject');

const
  _kuzzle = Symbol.for('_kuzzle'),
  assertionError = errorsManager.wrap('api', 'assert');

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
   * @return {Promise}
   */
  getPolicies() {
    if (!this[_kuzzle]) {
      throw errorsManager.get('security', 'profile', 'uninitialized', this._id);
    }

    return Bluebird.all(this.policies.map(policy => {
      return this[_kuzzle].repositories.role.load(policy.roleId)
        .then(role => {
          return {restrictedTo: policy.restrictedTo, role};
        });
    }));
  }

  /**
   * @param {Request} request
   * @param {Kuzzle} kuzzle
   * @return {Promise<boolean>}
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
   * @return {Promise}
   */
  async validateDefinition() {
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

          if (!this[_kuzzle].storageEngine.internal.isIndexNameValid(restriction.index)) {
            throw errorsManager.get(
              'services',
              'storage',
              'invalid_index_name',
              restriction.index);
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

            const invalid = restriction.collections.find(c => {
              return !this[_kuzzle].storageEngine.internal
                .isCollectionNameValid(c);
            });

            if (invalid) {
              throw errorsManager.get(
                'services',
                'storage',
                'invalid_collection_name',
                invalid);
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
   * @return {Promise}
   */
  getRights() {
    const profileRights = {};

    return this.getPolicies()
      .then(policies => {
        for (const policy of policies) {
          const role = policy.role;
          let restrictedTo = _.cloneDeep(policy.restrictedTo);

          if (restrictedTo === undefined || restrictedTo.length === 0) {
            restrictedTo = [{collections: ['*'], index: '*'}];
          }

          for (const controller of Object.keys(role.controllers)) {
            for (const action of Object.keys(role.controllers[controller].actions)) {
              const actionRights = role.controllers[controller].actions[action];

              for (const restriction of restrictedTo) {
                if (restriction.collections === undefined
                  || restriction.collections.length === 0
                ) {
                  restriction.collections = ['*'];
                }

                for (const collection of restriction.collections) {
                  const
                    rightsItem = {
                      action,
                      collection,
                      controller,
                      index: restriction.index,
                      value: actionRights
                    },
                    rightsObject = {
                      [this.constructor._hash(rightsItem)]: rightsItem
                    };

                  _.assignWith(profileRights, rightsObject, Rights.merge);
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
