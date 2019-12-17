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
  Rights = require('./rights'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  errorsManager = require('../../../util/errors');

const
  _kuzzle = Symbol.for('_kuzzle');

/**
 * @class User
 */
class User {
  constructor() {
    this._id = null;
    this.profileIds = [];
  }

  /**
   * @return {Promise<Profile[]>}
   */
  getProfiles() {
    if (!this[_kuzzle]) {
      return errorsManager.reject('security', 'user', 'uninitialized', this._id);
    }

    return this[_kuzzle].repositories.profile.loadProfiles(this.profileIds);
  }

  /**
   * @return {Promise}
   */
  getRights() {
    return this.getProfiles()
      .then(profiles => Bluebird.map(profiles, profile => profile.getRights()))
      .then(results => {
        const rights = {};

        results.forEach(right => _.assignWith(rights, right, Rights.merge));

        return rights;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  isActionAllowed(request) {
    if (this.profileIds === undefined || this.profileIds.length === 0) {
      return Bluebird.resolve(false);
    }

    return this.getProfiles()
      .then(profiles => Bluebird.map(
        profiles,
        profile => profile.isActionAllowed(request)))
      .then(results => results.includes(true));
  }
}

module.exports = User;
