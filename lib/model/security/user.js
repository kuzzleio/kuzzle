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

const Rights = require('./rights');
const Bluebird = require('bluebird');
const _ = require('lodash');
const kerror = require('../../kerror');

/**
 * @class User
 */
class User {
  constructor() {
    this._id = null;
    this.profileIds = [];
  }

  /**
   * @returns {Promise<Profile[]>}
   */
  getProfiles() {
    if (!global.kuzzle) {
      return kerror.reject('security', 'user', 'uninitialized', this._id);
    }

    return global.kuzzle.ask('core:security:profile:mGet', this.profileIds);
  }

  /**
   * @returns {Promise}
   */
  async getRights() {
    const profiles = await this.getProfiles();
    const results = await Bluebird.map(profiles, p => p.getRights());

    const rights = {};

    results.forEach(right => _.assignWith(rights, right, Rights.merge));

    return rights;
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  async isActionAllowed(request) {
    if (this.profileIds === undefined || this.profileIds.length === 0) {
      return false;
    }

    const profiles = await this.getProfiles();
    const result = await Bluebird.map(profiles, p => p.isActionAllowed(request));

    return result.includes(true);
  }
}

module.exports = User;
