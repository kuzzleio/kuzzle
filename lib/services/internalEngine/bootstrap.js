'use strict';

const Promise = require('bluebird');
let _kuzzle;

/**
 *
 * @param kuzzle
 * @param engine {InternalEngine}
 * @constructor
 */
function InternalEngineBootstrap (kuzzle, engine) {
  _kuzzle = kuzzle;
  this.db = engine || _kuzzle.internalEngine;
}

/**
 * Bootstraps Kuzzle storage engine
 * Creates the internal index and collections if needed
 *
 * @returns {Promise.<T>}
 */
InternalEngineBootstrap.prototype.all = function internalEngineBootstrapAll () {
  return this.db.createInternalIndex()
    .then(() => this.createCollections())
    .then(() => this.db.refresh())
    .then(() => Promise.resolve(_kuzzle.indexCache.add(this.db.index)))
    .catch(error => {
      // plugin manager is not initialized yet, cannot use the logger
      console.error(error, error.stack);  // eslint-disable-line no-console
      throw error;
    });
};

InternalEngineBootstrap.prototype.createCollections = function internalEngineBootstrapCreateCollections () {
  return this.createPluginsCollection()
    .then(() => this.createRolesCollection())
    .then(() => this.createProfilesCollection())
    .then(() => this.createUsersCollection())
    .then(() => this.createValidationCollection(_kuzzle.config.validation));
};

InternalEngineBootstrap.prototype.createRolesCollection = function internalEngineBootstrapCreateRolesCollection () {
  if (_kuzzle.indexCache.exists(this.db.index, 'roles')) {
    return Promise.resolve();
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
        return this.db.createOrReplace('roles', roleId, _kuzzle.config.security.default.role);
      });

      _kuzzle.indexCache.add(this.db.index, 'roles');

      return Promise.all(promises);
    });
};

InternalEngineBootstrap.prototype.createPluginsCollection = function internalEngineBootstrapCreatePluginsCollection () {
  if (_kuzzle.indexCache.exists(this.db.index, 'plugins')) {
    return Promise.resolve();
  }

  return this.db.updateMapping('plugins', {
    properties: {
      config: {
        enabled: false
      }
    }
  });
};

InternalEngineBootstrap.prototype.createProfilesCollection = function internalEngineBootstrapCreateProfilesCollection () {
  if (_kuzzle.indexCache.exists(this.db.index, 'profiles')) {
    return Promise.resolve();
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
      _kuzzle.indexCache.add(this.db.index, 'profiles');

      const promises = ['default', 'anonymous', 'admin'].map(profileId => {
        return this.db.createOrReplace('profiles', profileId, {
          policies: [{roleId: profileId}]
        });
      });

      return Promise.all(promises);
    });
};

InternalEngineBootstrap.prototype.createUsersCollection = function internalEngineBootstrapCreateUsersCollection () {
  if (_kuzzle.indexCache.exists(this.db.index, 'users')) {
    return Promise.resolve();
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
      _kuzzle.indexCache.add(this.db.index, 'users');
    });
};

InternalEngineBootstrap.prototype.createValidationCollection = function internalEngineBootstrapCreateValidationCollection (validationConfiguration) {
  if (_kuzzle.indexCache.exists(this.db.index, 'validations')) {
    return Promise.resolve();
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Creating validation collection...');

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
          promises.push(_kuzzle.internalEngine.createOrReplace('validations', `${indexName}#${collectionName}`, {
            index: indexName,
            collection: collectionName,
            validation: validationConfiguration[indexName][collectionName]
          }));
        });
      });

      return Promise.all(promises);
    }

    return Promise.resolve();
  })
    .then(() => {
      _kuzzle.indexCache.add(this.db.index, 'validations');
    });
};

InternalEngineBootstrap.prototype.adminExists = function internalEngineBootstrapAdminExists () {
  return this.db.search('users', {query: {terms: {profileIds: ['admin']}}}, {from: 0, size: 0})
    .then(response => (response.total > 0));
};

module.exports = InternalEngineBootstrap;
