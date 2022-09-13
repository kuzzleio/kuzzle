/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

"use strict";

const Bluebird = require("bluebird");

const kerror = require("../kerror");

/**
 * Services base class
 *
 */
class Service {
  constructor(name, config) {
    this._name = name;
    this._config = config;
    this._initTimeout =
      config.initTimeout ||
      global.kuzzle.config.services.common.defaultInitTimeout;
  }

  get config() {
    return this._config;
  }

  get name() {
    return this._name;
  }

  /**
   * Call _initSequence to initialize the service
   * and throw an error if timeout exceed
   *
   * @returns {Promise}
   */
  init() {
    return Bluebird.resolve(this._initSequence())
      .timeout(this._initTimeout)
      .catch((e) => {
        if (e instanceof Bluebird.TimeoutError) {
          throw kerror.get("core", "fatal", "service_timeout", this._name);
        }

        throw e;
      });
  }

  /**
   * @abstract
   * @returns {Promise}
   */
  _initSequence() {
    throw new Error("Not implemented");
  }

  /**
   * @abstract
   * @returns {Promise}
   */
  info() {
    throw new Error("Not implemented");
  }
}

module.exports = Service;
