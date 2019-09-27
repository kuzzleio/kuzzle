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
  errorsManager = require('../../../../config/error-codes/throw').wrap('api', 'security');

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
  getPolicies() {
    if (!this[_kuzzle]) {
      errorsManager.throw(
        'cannot_get_roles_for_uninitialized_profile',
        this._id);
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
    if (!Array.isArray(this.policies)) {
      errorsManager.throw('missing_mandatory_policies_attribute');
    }

    if (this.policies.length === 0) {
      errorsManager.throw('empty_policies_attribute');
    }

    let i = 0;
    for (const policy of this.policies) {
      if (!policy.roleId) {
        errorsManager.throw('missing_mandatory_roleId_attribute', i);
      }

      for (const member of Object.keys(policy)) {
        if (member !== 'roleId' && member !== 'restrictedTo') {
          errorsManager.throw('unexpected_attribute_in_policies', i, member);
        }
      }

      if (policy.restrictedTo) {
        if (!Array.isArray(policy.restrictedTo)) {
          errorsManager.throw(
            'attribute_restrictedTo_not_an_array_of_objects',
            i);
        }

        let j = 0;
        for (const restriction of policy.restrictedTo) {
          if (!_.isPlainObject(restriction)) {
            errorsManager.throw('restrictedTo_field_must_be_an_object', i, j);
          }

          if (restriction.index === null || restriction.index === undefined) {
            errorsManager.throw(
              'missing_mandatory_index_attribute_in_restrictedTo_array',
              i,
              j);
          }

          if ( typeof restriction.index !== 'string'
            || restriction.index.length === 0
          ) {
            errorsManager.throw('index_attribute_is_empty_string', i, j);
          }

          if ( restriction.collections !== undefined
            && restriction.collections !== null
          ) {
            if (!Array.isArray(restriction.collections)) {
              errorsManager.throw(
                'attribute_collections_not_an_array_in_retrictedTo',
                i,
                j);
            }

            if (restriction.collections.some(c => typeof c !== 'string' || c.length === 0)) {
              errorsManager.throw(
                'attribute_collections_not_contains_not_only_non_empty_strings',
                i,
                j);
            }
          }

          for (const member of Object.keys(restriction)) {
            if (member !== 'index' && member !== 'collections') {
              errorsManager.throw(
                'unexptected_attribute_in_restrictedTo_array',
                i,
                j,
                member);
            }
          }

          j++;
        }
      }

      i++;
    }
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
