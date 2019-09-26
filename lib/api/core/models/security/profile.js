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
  Rights = require('./rights'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../../../util/errors');

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
  }

  /**
   * @param {Kuzzle} kuzzle
   *
   * @return {Promise}
   */
  getPolicies() {
    if (!this[_kuzzle]) {
      errorsManager.throw('security', 'profile', 'uninitialized', this._id);
    }

    return Bluebird.all(this.policies.map(policy => {
      return this[_kuzzle].repositories.role.load(policy.roleId)
        .then(role => {
          return {role, restrictedTo: policy.restrictedTo};
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

    return this.getPolicies()
      .then(policies => Bluebird.map(
        policies,
        policy => policy.role.isActionAllowed(request, policy.restrictedTo)))
      .then(results => results.includes(true));
  }

  /**
   * Validates the Profile format
   *
   * @return {Promise}
   */
  async validateDefinition() {
    if (!this.policies) {
      return assertionError.reject('missing_argument', 'policies');
    }

    if (!Array.isArray(this.policies)) {
      return assertionError.reject('invalid_type', 'policies', 'object[]');
    }

    if (this.policies.length === 0) {
      return assertionError.reject('empty_argument', 'policies');
    }

    let i = 0;
    for (const policy of this.policies) {
      if (!policy.roleId) {
        return assertionError.reject('missing_argument', `policies[${i}].roleId`);
      }

      for (const member of Object.keys(policy)) {
        if (member !== 'roleId' && member !== 'restrictedTo') {
          return assertionError.reject(
            'unexpected_argument',
            `policies[${i}].${member}`,
            '"roleId", "restrictedTo"');
        }
      }

      if (policy.restrictedTo) {
        if (!Array.isArray(policy.restrictedTo)) {
          return assertionError.reject(
            'invalid_type',
            `policies[${i}].restrictedTo`,
            'object[]');
        }

        let j = 0;
        for (const restriction of policy.restrictedTo) {
          if (restriction === null || typeof restriction !== 'object' || Array.isArray(restriction)) {
            return assertionError.reject(
              'invalid_type',
              `policies[${i}].restrictedTo[${restriction}]`,
              'object');
          }

          if (restriction.index === null || restriction.index === undefined) {
            return assertionError.reject(
              'missing_argument',
              `policies[${i}].restrictedTo[${j}].index`);
          }

          if (typeof restriction.index !== 'string' || restriction.index.length === 0) {
            return assertionError.reject(
              'invalid_type',
              `policies[${i}].restrictedTo[${j}].index`,
              'string');
          }

          if ( restriction.collections !== undefined
            && restriction.collections !== null
            && ( !Array.isArray(restriction.collections)
              || restriction.collections.some(c => typeof c !== 'string' || c.length === 0))
          ) {
            return assertionError.reject(
              'invalid_type',
              `policies[${i}].restrictedTo[${j}].collections`,
              'string[]');
          }

          for (const member of Object.keys(restriction)) {
            if (member !== 'index' && member !== 'collections') {
              return assertionError.reject(
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

    return Bluebird.resolve(true);
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
            restrictedTo = [{index: '*', collections: ['*']}];
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
                      controller,
                      action,
                      collection,
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
}

module.exports = Profile;

