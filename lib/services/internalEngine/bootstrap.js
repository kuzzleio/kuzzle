'use strict';

const
  Bluebird = require('bluebird'),
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
      return Bluebird.resolve();
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
        const promises = ['anonymous', 'default', 'admin'].map(roleId => {
          return this.db.createOrReplace('roles', roleId, this.kuzzle.config.security.default.role);
        });

        this.kuzzle.indexCache.add(this.db.index, 'roles');

        return Bluebird.all(promises);
      });
  }

  createPluginsCollection () {
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

  createProfilesCollection () {
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

  createUsersCollection () {
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

  createValidationCollection (validationConfiguration) {
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
}

InternalEngineBootstrap.prototype.all = Bluebird.coroutine(InternalEngineBootstrap.prototype._allGen);

InternalEngineBootstrap.prototype.getJWTSecret = Bluebird.coroutine(InternalEngineBootstrap.prototype._getJWTSecretGen);

InternalEngineBootstrap.prototype.lock = Bluebird.coroutine(InternalEngineBootstrap.prototype._lockGen);


module.exports = InternalEngineBootstrap;
