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

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {object}
   */
  serializeProfile: profile => {
    const { _id, ..._source } = profile;

    return { _id, _source };
  },

  /**
   * Serializes profile and transforms it into a POJO
   *
   * @param {Profile} profile
   * @returns {Object}
   */
  serializeRole: role => {
    const _source = {};

    Object.keys(role).forEach(key => {
      if (key !== '_id' && key !== 'restrictedTo') {
        _source[key] = role[key];
      }
    });

    return { _id: role._id, _source };
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {User} user
   * @returns {Object}
   */
  serializeUser: user => {
    const { _id, ..._source } = user;

    return { _id, _source };
  }
};
