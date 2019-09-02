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
  SafeBootstrap = require('./safeBootstrap'),
  errorsManager = require('../../../../config/error-codes/throw');

class PluginIndexBootstrap extends SafeBootstrap {
  constructor(pluginName, kuzzle, storageEngine) {
    super(
      kuzzle,
      storageEngine,
      kuzzle.config.plugins.common.bootstrapLockTimeout);

    this.pluginName = pluginName;
  }

  /**
   * @override
   * @param {Array<object>} collections - Collections and mapping to create
   */
  async _boostrapSequence (collections) {
    await this._createCollections(collections);
  }

  /**
   * @override
   */
  _throwLockWaitTimeout () {
    errorsManager.throw(
      'external',
      'internal_engine',
      'plugin_bootstrap_lock_wait_timeout',
      this.pluginName);
  }

  _createCollections (collections) {
    const promises = [];

    for (const [collection, mappings] of Object.entries(collections)) {
      promises.push(this.indexEngine.createCollection(collection, mappings));
    }

    return Promise.all(promises);
  }
}

module.exports = PluginIndexBootstrap;
