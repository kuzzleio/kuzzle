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

const kerror = require("../../kerror").wrap("services", "storage");
const ClientAdapter = require("./clientAdapter");
const scopeEnum = require("./storeScopeEnum");

class StorageEngine {
  constructor() {
    // Storage client for public indexes only
    this.public = new ClientAdapter(scopeEnum.PUBLIC);

    // Storage client for private indexes only
    this.private = new ClientAdapter(scopeEnum.PRIVATE);
  }

  /**
   * Initialize storage clients and perform integrity checks
   *
   * @returns {Promise}
   */
  async init() {
    await Bluebird.all([this.public.init(), this.private.init()]);

    const privateIndexes = await this.private.cache.listIndexes();

    for (const publicIndex of await this.public.cache.listIndexes()) {
      if (privateIndexes.includes(publicIndex)) {
        throw kerror.get("index_already_exists", "public", publicIndex);
      }
    }

    global.kuzzle.log.info("[✔] Storage initialized");
  }
}

module.exports = StorageEngine;
