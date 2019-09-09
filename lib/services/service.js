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
  Bluebird = require('bluebird'),
  errorsManager = require('../config/error-codes/throw');

/**
 * Services base class
 *
 */
class Service {

  constructor (name, kuzzle, config) {
    this._name = name;
    this._kuzzle = kuzzle;
    this._config = config;
    this._initTimeout = config.initTimeout
      || kuzzle.config.services.common.defaultInitTimeout;
  }

  get config () {
    return this._config;
  }

  get name () {
    return this._name;
  }

  /**
   * Call _initSequence to initialize the service
   * and throw an error if timeout exceed
   *
   * @return {Promise}
   */
  init () {
    return new Bluebird((resolve, reject) => {
      const timeoutHandle = setTimeout(
        () => {
          reject(errorsManager.getError(
            'external',
            'common',
            'service_initialization_timeout',
            this._name,
            this._initTimeout));
        },
        this._initTimeout);

      Bluebird.resolve()
        .then(() => this._initSequence())
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutHandle));
    });
  }

  /**
   * @abstract
   * @returns {Promise}
   */
  _initSequence () {
    throw new Error('Not implemented');
  }

  /**
   * @abstract
   * @returns {Promise}
   */
  info () {
    throw new Error('Not implemented');
  }

  getError (error, ...placeholders) {
    return errorsManager.getError('external', this._name, error, ...placeholders);
  }

  throw (error, ...placeholders) {
    throw this.getError(error, ...placeholders);
  }

  reject (error, ...placeholders) {
    return Bluebird.reject(this.getError(error, ...placeholders));
  }
}

module.exports = Service;
