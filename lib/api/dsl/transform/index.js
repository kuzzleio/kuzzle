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
  Standardizer = require('./standardize'),
  Canonical = require('./canonical'),
  {
    KuzzleError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

/**
 * Checks that provided filters are valid,
 * standardizes them by reducing the number of used keywords
 * and converts these filters in canonical form
 *
 * @class Transformer
 */
class Transformer {
  constructor() {
    this.standardizer = new Standardizer();
    this.canonical = new Canonical();
  }

  /**
   * Checks, standardizes and converts filters in canonical form
   *
   * @param {object} filters
   * @return {Promise}
   */
  normalize(filters) {
    return this.standardizer.standardize(filters)
      .then(standardized => {
        try {
          return this.canonical.convert(standardized);
        }
        catch (e) {
          if (e instanceof KuzzleError) {
            return Bluebird.reject(e);
          }

          return Bluebird.reject(new KuzzleInternalError(e));
        }
      });
  }

  /**
   * Performs a simple filter check to validate it, without converting
   * it to canonical form
   *
   * @param {object} filters
   * @return {Promise}
   */
  check(filters) {
    return this.standardizer.standardize(filters).then(() => true);
  }
}

/**
 * @type {Transformer}
 */
module.exports = Transformer;
