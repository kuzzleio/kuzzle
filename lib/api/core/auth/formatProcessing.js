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

const _ = require('lodash');

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {object}
   */
  formatRoleForSerialization: role => {
    const response = {_id: role._id};

    response._source = _.omit(role, ['_id', 'closures', 'restrictedTo']);

    response._meta = role._kuzzle_info || {};

    return response;
  },

  /**
   * Serializes profile and transforms it into a POJO
   *
   * @param {Profile} profile
   * @returns {object}
   */
  formatProfileForSerialization: profile => {
    const response = {_id: profile._id};

    response._source = _.omit(profile, ['_id']);

    response._meta = profile._kuzzle_info || {};

    return response;
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {Kuzzle} kuzzle
   * @param {User|object} user
   * @returns {Promise}
   */
  formatUserForSerialization: (kuzzle, user) => {
    /**
     * @deprecated This event is deprecated since v1.0.0
     */
    return kuzzle.pipe('security:formatUserForSerialization', user)
      .then(triggeredUser => ({
        _id: triggeredUser._id,
        _source: _.omit(triggeredUser, ['_id']),
        _meta: triggeredUser._kuzzle_info || {}
      }));
  }
};
