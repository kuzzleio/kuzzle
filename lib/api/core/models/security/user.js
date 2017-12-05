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

'use strict';

const
  Policies = require('./policies'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  {
    PreconditionError
  } = require('kuzzle-common-objects').errors;

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
      throw new PreconditionError(`Cannot get profiles for non-initialized user ${this._id}`);
    }

    return this[_kuzzle].repositories.profile.loadProfiles(this.profileIds);
  }

  /**
   * @return {Promise}
   */
  getRights() {
    return this.getProfiles()
      .then(profiles => {
        const promises = profiles.map(profile => profile.getRights());

        return Bluebird.all(promises)
          .then(results => {
            const rights = {};

            results.forEach(right => _.assignWith(rights, right, Policies.merge));

            return Bluebird.resolve(rights);
          });
      });
  }

  /**
   * @param {Request} request
   * @returns {*}
   */
  isActionAllowed(request) {
    if (this.profileIds === undefined || this.profileIds.length === 0) {
      return Bluebird.resolve(false);
    }

    return this.getProfiles()
      .then(profiles => new Bluebird((resolve, reject) => {
        Bluebird.all(profiles.map(profile => profile.isActionAllowed(request)
          .then(isAllowed => {
            if (isAllowed) {
              resolve(true);
            }
          })
          .catch(reject)
        ))
          .then(results => resolve(results.some(r => r)));
      }));
  }
}

module.exports = User;
