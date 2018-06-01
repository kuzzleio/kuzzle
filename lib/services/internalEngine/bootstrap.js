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
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError,
  crypto = require('crypto');

const
  lockId = 'bootstrap-lock',
  jwtSecretId = 'security.jwt.secret';

class InternalEngineBootstrap {
  /**
   * @param kuzzle
   * @param engine {InternalEngine}
   * @constructor
   */
  constructor (kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.db = engine || this.kuzzle.internalEngine;
  }

  /**
   * Bootstraps Kuzzle storage engine
   * Creates the internal index and collections if needed
   */
  * _allGen () {
    const isLocked = yield this.lock();

    if (isLocked) {
      yield this.getJWTSecret();
      return this._waitTillUnlocked();
    }

    yield this.db.createInternalIndex();
    yield this.createCollections();
    yield this.getJWTSecret();
    yield this.db.refresh();

    this.kuzzle.indexCache.add(this.db.index);

    yield this.unLock();

    return Bluebird.resolve();
  }

  createCollections () {
    return this.createPluginsCollection()
      .then(() => this.createRolesCollection())
      .then(() => this.createProfilesCollection())
      .then(() => this.createUsersCollection())
      .then(() => this.createValidationCollection(this.kuzzle.config.validation));
  }

  createRolesCollection () {
    return this.kuzzle.indexCache.exists(this.db.index, 'roles', false)
      .then(exists => {
        if (exists) {
          return;
        }

        const mapping = {
          properties: {
            controllers: {
              enabled: false
            }
          }
        };

        return this.db.updateMapping('roles', mapping)
          .then(() => {
            const promises = ['anonymous', 'default', 'admin']
              .map(roleId => this.db.createOrReplace('roles', roleId, this.kuzzle.config.security.default.role));

            this.kuzzle.indexCache.add(this.db.index, 'roles');

            return Bluebird.all(promises);
          });
      });
  }

  createPluginsCollection () {
    return this.kuzzle.indexCache.exists(this.db.index, 'plugins', false)
      .then(exists => {
        if (exists) {
          return;
        }

        return this.db.updateMapping('plugins', {
          properties: {
            config: {
              enabled: false
            }
          }
        });
      });
  }

  createProfilesCollection () {
    return this.kuzzle.indexCache.exists(this.db.index, 'profiles', false)
      .then(exists => {
        if (exists) {
          return;
        }

        const mapping = {
          properties: {
            policies: {
              properties: {
                roleId: {
                  type: 'keyword'
                }
              }
            }
          }
        };

        return this.db.updateMapping('profiles', mapping)
          .then(() => {
            this.kuzzle.indexCache.add(this.db.index, 'profiles');

            const promises = ['default', 'anonymous', 'admin'].map(profileId => {
              return this.db.createOrReplace('profiles', profileId, {
                policies: [{roleId: profileId}]
              });
            });

            return Bluebird.all(promises);
          });
      });
  }

  createUsersCollection () {
    return this.kuzzle.indexCache.exists(this.db.index, 'users', false)
      .then(exists => {
        if (exists) {
          return;
        }

        const mapping = {
          properties: {
            profileIds: {
              type: 'keyword'
            }
          }
        };

        return this.db.updateMapping('users', mapping)
          .then(() => this.kuzzle.indexCache.add(this.db.index, 'users'));
      });
  }

  createValidationCollection (validationConfiguration) {
    return this.kuzzle.indexCache.exists(this.db.index, 'validations', false)
      .then(exists => {
        if (exists) {
          return;
        }

        this.kuzzle.pluginsManager.trigger('log:info', '== Creating validation collection...');

        return this.db.updateMapping('validations', {
          properties: {
            index: {
              type: 'keyword'
            },
            collection: {
              type: 'keyword'
            },
            validation: {
              enabled: false
            }
          }
        });
      })
      .then(() => {
        if (validationConfiguration) {
          const promises = [];

          Object.keys(validationConfiguration).forEach(indexName => {
            Object.keys(validationConfiguration[indexName]).forEach(collectionName => {
              // createOrReplace instead of create to avoid mess on concurency
              // TODO fix with a lock instead
              promises.push(this.kuzzle.internalEngine.createOrReplace('validations', `${indexName}#${collectionName}`, {
                index: indexName,
                collection: collectionName,
                validation: validationConfiguration[indexName][collectionName]
              }));
            });
          });

          return Bluebird.all(promises);
        }

        return null;
      })
      .then(() => this.kuzzle.indexCache.add(this.db.index, 'validations'));
  }

  * _getJWTSecretGen () {
    if (this.kuzzle.config.security.jwt.secret !== null) {
      return this.kuzzle.config.security.jwt.secret;
    }

    // try to create first to avoid collisions
    try {
      const seed = crypto.randomBytes(512).toString('hex');
      yield this.db.create('config', jwtSecretId, {seed});
      this.kuzzle.config.security.jwt.secret = seed;
    }
    catch(e) {
      const response = yield this.db.get('config', jwtSecretId);
      this.kuzzle.config.security.jwt.secret = response._source.seed;
    }
  }

  adminExists () {
    return this.db.search('users', {query: {terms: {profileIds: ['admin']}}}, {from: 0, size: 0})
      .then(response => (response.total > 0));
  }

  /**
   * Checks if Kuzzle is already being bootstraped.
   * If not set a lock.
   * Returns true if the bootstrap is locked, false otherwise.
   *
   * @generator
   * @private
   * @returns {boolean}
   */
  * _lockGen () {
    let lock;

    try {
      yield this.db.create('config', lockId, {timestamp: Date.now()});
      return false;
    }
    catch (e) {
      // lock exists - try to get it and check if it is old enough to erase it
    }

    lock = yield this.db.get('config', lockId);
    if (lock._source.timestamp < Date.now() - 30000) {
      yield this.db.createOrReplace('config', lockId, {timestamp: Date.now()});
      return false;
    }

    return true;
  }

  unLock () {
    return this.db.delete('config', lockId);
  }

  _waitTillUnlocked (attempts = 0) {
    return this.db.exists('config', lockId)
      .then(isLocked => {
        if (!isLocked) {
          return;
        }

        if (attempts > 10) {
          throw new KuzzleInternalError('Internal engine bootstrap - lock wait timeout exceeded');
        }

        return Bluebird.delay(Math.round(this.kuzzle.config.services.internalEngine.bootstrapLockTimeout / 10))
          .then(() => this._waitTillUnlocked(attempts + 1));
      });

  }
}

InternalEngineBootstrap.prototype.all = Bluebird.coroutine(InternalEngineBootstrap.prototype._allGen);

InternalEngineBootstrap.prototype.getJWTSecret = Bluebird.coroutine(InternalEngineBootstrap.prototype._getJWTSecretGen);

InternalEngineBootstrap.prototype.lock = Bluebird.coroutine(InternalEngineBootstrap.prototype._lockGen);


module.exports = InternalEngineBootstrap;
