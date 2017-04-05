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

'use strict';

const Bluebird = require('bluebird');

/**
 *
 * @class InternalEngineBootstrap
 * @param kuzzle
 * @param engine {InternalEngine}
 */
class InternalEngineBootstrap {
  constructor(kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.db = engine || kuzzle.internalEngine;
  }


  /**
   * Bootstraps Kuzzle storage engine
   * Creates the internal index and collections if needed
   *
   * @returns {Promise.<T>}
   */
  all() {
    return this.db.createInternalIndex()
      .then(() => this.createCollections())
      .then(() => this.db.refresh())
      .then(() => Bluebird.resolve(this.kuzzle.indexCache.add(this.db.index)))
      .catch(error => {
        // plugin manager is not initialized yet, cannot use the logger
        console.error(error, error.stack);  // eslint-disable-line no-console
        throw error;
      });
  }

  createCollections() {
    return this.createPluginsCollection()
      .then(() => this.createRolesCollection())
      .then(() => this.createProfilesCollection())
      .then(() => this.createUsersCollection())
      .then(() => this.createValidationCollection(this.kuzzle.config.validation));
  }

  createRolesCollection() {
    if (this.kuzzle.indexCache.exists(this.db.index, 'roles')) {
      return Bluebird.resolve();
    }

    return this.db.updateMapping('roles', {
      properties: {
        controllers: {
          enabled: false
        }
      }
    })
      .then(() => {
        const promises = ['anonymous', 'default', 'admin']
          .map(roleId => this.db.createOrReplace('roles', roleId, this.kuzzle.config.security.default.role));

        this.kuzzle.indexCache.add(this.db.index, 'roles');

        return Bluebird.all(promises);
      });
  }

  createPluginsCollection() {
    if (this.kuzzle.indexCache.exists(this.db.index, 'plugins')) {
      return Bluebird.resolve();
    }

    return this.db.updateMapping('plugins', {
      properties: {
        config: {
          enabled: false
        }
      }
    });
  }

  createProfilesCollection() {
    if (this.kuzzle.indexCache.exists(this.db.index, 'profiles')) {
      return Bluebird.resolve();
    }

    return this.db.updateMapping('profiles', {
      properties: {
        policies: {
          properties: {
            roleId: {
              type: 'keyword'
            }
          }
        }
      }
    })
      .then(() => {
        this.kuzzle.indexCache.add(this.db.index, 'profiles');

        const promises = ['default', 'anonymous', 'admin'].map(profileId => {
          return this.db.createOrReplace('profiles', profileId, {
            policies: [{roleId: profileId}]
          });
        });

        return Bluebird.all(promises);
      });
  }

  createUsersCollection() {
    if (this.kuzzle.indexCache.exists(this.db.index, 'users')) {
      return Bluebird.resolve();
    }

    return this.db.updateMapping('users', {
      properties: {
        profileIds: {
          type: 'keyword'
        },
        password: {
          index: false,
          type: 'keyword'
        }
      }
    })
      .then(() => {
        this.kuzzle.indexCache.add(this.db.index, 'users');
      });
  }

  createValidationCollection(validationConfiguration) {
    if (this.kuzzle.indexCache.exists(this.db.index, 'validations')) {
      return Bluebird.resolve();
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
    }).then(() => {
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

      return Bluebird.resolve();
    })
      .then(() => {
        this.kuzzle.indexCache.add(this.db.index, 'validations');
      });
  }

  adminExists() {
    return this.db.search('users', {query: {terms: {profileIds: ['admin']}}}, {from: 0, size: 0})
      .then(response => (response.total > 0));
  }
}

module.exports = InternalEngineBootstrap;
