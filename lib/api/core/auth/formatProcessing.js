/*
 * Copyright 2017 Kaliop SAS
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

    response._source = _.assignIn({}, role);

    delete response._source._id;
    delete response._source.closures;
    delete response._source.restrictedTo;

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

    response._source = _.assignIn({}, profile);
    delete response._source._id;

    return response;
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {Kuzzle} kuzzle
   * @param {User} user
   * @returns {Promise}
   */
  formatUserForSerialization: (kuzzle, user) => {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {

        const response = {_id: triggeredUser._id, _source: triggeredUser};
        delete response._source._id;

        return response;
      });
  }
};
