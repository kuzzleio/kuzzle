/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
  Policies = require('./policies'),
  Bluebird = require('bluebird'),
  async = require('async'),
  _ = require('lodash');

/**
 * @class User
 */
class User {
  constructor() {
    this._id = null;
    this.profileIds = [];
  }

  /**
   * @param {Kuzzle} kuzzle
   *
   * @return {Promise}
   */
  getProfiles(kuzzle) {
    return kuzzle.repositories.profile.loadProfiles(this.profileIds);
  }

  /**
   * @return {Promise}
   */
  getRights(kuzzle) {
    return this.getProfiles(kuzzle)
      .then(profiles => {
        const promises = profiles.map(profile => profile.getRights(kuzzle));

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
   * @param {Kuzzle} kuzzle
   * @returns {*}
   */
  isActionAllowed(request, kuzzle) {
    if (this.profileIds === undefined || this.profileIds.length === 0) {
      return Bluebird.resolve(false);
    }

    return this.getProfiles(kuzzle)
      .then(profiles => {
        return new Bluebird((resolve, reject) => {
          async.some(profiles, (profile, callback) => {
            profile.isActionAllowed(request, kuzzle).asCallback(callback);
          }, (error, result) => {
            if (error) {
              return reject(error);
            }

            resolve(result);
          });
        });
      });
  }
}

module.exports = User;
