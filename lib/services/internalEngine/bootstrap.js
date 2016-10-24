var
  Promise = require('bluebird'),
  _kuzzle;

/**
 *
 * @param kuzzle
 * @param engine {InternalEngine}
 * @constructor
 */
function InternalEngineBootstrap (kuzzle, engine) {
  _kuzzle = kuzzle;
  this.engine = engine || _kuzzle.internalEngine;
}

/**
 * Bootstraps Kuzzle storage engine
 * Creates the internal index and collections if needed
 *
 * @returns {Promise.<T>}
 */
InternalEngineBootstrap.prototype.all = function internalEngineBootstrapAll () {
  return this.engine.createInternalIndex()
    .then(() => this.createCollections())
    .then(() => this.engine.refresh())
    .then(() => Promise.resolve(_kuzzle.indexCache.add(this.engine.index)))
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
    .then(() => this.createUsersCollection());
};

InternalEngineBootstrap.prototype.createRolesCollection = function internalEngineBootstrapCreateRolesCollection () {
  if (_kuzzle.indexCache.exists(this.engine.index, 'roles')) {
    return Promise.resolve();
  }

  return this.engine.updateMapping('roles', {
    properties: {
      controllers: {enabled: false}
    }
  })
    .then(() => {
      var promises = ['anonymous', 'default', 'admin'].map(roleId => {
        return this.engine.createOrReplace('roles', roleId, _kuzzle.config.security.default.role);
      });

      _kuzzle.indexCache.add(this.engine.index, 'roles');

      return Promise.all(promises);
    });
};

InternalEngineBootstrap.prototype.createPluginsCollection = function internalEngineBootstrapCreatePluginsCollection () {
  if (_kuzzle.indexCache.exists(this.engine.index, 'plugins')) {
    return Promise.resolve();
  }

  return this.engine.updateMapping('plugins', {
    properties: {
      config: {enabled: false}
    }
  });
};

InternalEngineBootstrap.prototype.createProfilesCollection = function internalEngineBootstrapCreateProfilesCollection () {
  if (_kuzzle.indexCache.exists(this.engine.index, 'profiles')) {
    return Promise.resolve();
  }

  return this.engine.updateMapping('profiles', {
    properties: {
      policies: {
        properties: {
          _id: {
            index: 'not_analyzed',
            type: 'string'
          }
        }
      }
    }
  })
    .then(() => {
      var promises;

      _kuzzle.indexCache.add(this.engine.index, 'profiles');

      promises = ['default', 'anonymous', 'admin'].map(profileId => {
        return this.engine.createOrReplace('profiles', profileId, {
          policies: [{roleId: profileId, allowInternalIndex: true}]
        });
      });

      return Promise.all(promises);
    });
};

InternalEngineBootstrap.prototype.createUsersCollection = function internalEngineBootstrapCreateUsersCollection () {
  if (_kuzzle.indexCache.exists(this.engine.index, 'users')) {
    return Promise.resolve();
  }

  return this.engine.updateMapping('users', {
    properties: {
      profileIds: {
        index: 'not_analyzed',
        type: 'string'
      },
      password: {
        index: 'no',
        type: 'string'
      }
    }
  })
    .then(() => {
      _kuzzle.indexCache.add(this.engine.index, 'users');
    });
};

InternalEngineBootstrap.prototype.adminExists = function internalEngineBootstrapAdminExists () {
  return this.engine.search('users', {query: {in: {profileIds: ['admin']}}}, 0, 0)
    .then(response => (response.hits.total > 0));
};

module.exports = InternalEngineBootstrap;
