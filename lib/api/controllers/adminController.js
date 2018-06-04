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
  Bluebird = require('bluebird'),
  os = require('os'),
  {
    ServiceUnavailableError,
    ExternalServiceError,
    BadRequestError
  } = require('kuzzle-common-objects').errors,
  {
    assertHasBody,
    assertHasId,
    assertBodyHasAttribute,
    assertHasIndexAndCollection,
    assertBodyAttributeType,
    assertArgsHasAttribute
  } = require('../../util/requestAssertions');

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Reset
   */
  resetKuzzleData (request) {

  }

  /**
   * Reset Redis cache
   */
  resetCache (request) {
    assertArgsHasAttribute(request, 'database');

    const
      database = request.input.args.database,
      cacheEngine = this.kuzzle.services.list[database];

    if (cacheEngine === undefined) {
      throw new BadRequestError(`Database ${database} not found`));
    }

    return Bluebird((resolve, reject) => cacheEngine.flushdb(error => err ? reject(error) : resolve()));
  }

  /**
   * Reset all roles, profiles and users
   */
  resetSecurity (request) {

  }

  /**
   * Reset all indexes
   */
  resetDatabase (request) {

  }

  /**
   * Reset a plugin internal storage
   */
  resetPluginStorage (request) {

  }

  /**
   * Shutdown Kuzzle
   */
  shutdown (request) {

  }

}

module.exports = AdminController;
