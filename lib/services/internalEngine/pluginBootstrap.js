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
  GatewayTimeoutError = require('kuzzle-common-objects').errors.GatewayTimeoutError;

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {InternalEngine} engine
 * @constructor
 */
class PluginInternalEngineBootstrap {
  constructor(pluginName, kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.db = engine;
    this.pluginName = pluginName;
    this.attemptDelay = Math.round(this.kuzzle.config.plugins.common.bootstrapLockTimeout / 10);

    // We make 10 attempts to check if the db resource is still locked.
    // After that, we throw an error and abort Kuzzle's start sequence.
    // But if, for some reason, the lock is never deleted, we have to consider
    // it as outdated, and renew it.
    // This "outdated delay" should be long enough to still abort Kuzzle's
    // lock sequence, but short enough to not imped a production environment
    // for too long.
    this.outdatedDelay = 1.5 * this.kuzzle.config.plugins.common.bootstrapLockTimeout;
    this._lockId = `bootstrap-lock-${kuzzle.constructor.hash(this.pluginName)}`;
  }

  all (collections) {
    return this.lock()
      .then(isLocked => {
        if (isLocked) {
          return this._waitTillUnlocked();
        }

        return this.db.createInternalIndex()
          .then(() => this.createCollections(collections))
          .then(() => this.db.refresh())
          .then(() => {
            this.kuzzle.indexCache.add(this.db.index);
            return this.unlock();
          });
      });
  }

  createCollection (collection, collectionMapping) {
    return this.db.updateMapping(collection, collectionMapping);
  }

  createCollections (collections) {
    return Bluebird.all(Object.keys(collections).map(collection => this.createCollection(collection, collections[collection])));
  }

  unlock () {
    return this.kuzzle.internalEngine.delete('config', this._lockId);
  }

  * _lockGen () {
    try {
      yield this.kuzzle.internalEngine.create('config', this._lockId, {timestamp: Date.now()});
      return false;
    }
    catch (e) {
      // lock found - check if not obsolete or in the future
    }

    const
      lock = yield this.kuzzle.internalEngine.get('config', this._lockId),
      now = Date.now();

    if (lock._source.timestamp < now - this.outdatedDelay || lock._source.timestamp > now) {
      yield this.kuzzle.internalEngine.createOrReplace('config', this._lockId, {timestamp: Date.now()});
      return false;
    }

    return true;
  }

  _waitTillUnlocked (attempts = 0) {
    return this.kuzzle.internalEngine.exists('config', this._lockId)
      .then(isLocked => {
        if (!isLocked) {
          return;
        }

        if (attempts > 10) {
          throw new GatewayTimeoutError(`Plugin ${this.pluginName} bootstrap - lock wait timeout exceeded`);
        }

        return Bluebird.delay(this.attemptDelay)
          .then(() => this._waitTillUnlocked(attempts + 1));
      });
  }
}

PluginInternalEngineBootstrap.prototype.lock = Bluebird.coroutine(PluginInternalEngineBootstrap.prototype._lockGen);

module.exports = PluginInternalEngineBootstrap;
