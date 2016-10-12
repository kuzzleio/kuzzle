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
  this.engine = engine;
}

/**
 * Bootstraps Kuzzle storage engine
 * Creates the internal index and collections if needed
 *
 * @returns {Promise.<T>}
 */
InternalEngineBootstrap.prototype.all = function () {
  return this.engine.createInternalIndex()
    .then(() => this.createCollections())
    .then(() => this.engine.refresh())
    .then(() => _kuzzle.indexCache.add(this.engine.index))
    .catch(error => {
      // plugin manager is not initialized yet, cannot use the logger
      console.error(error, error.stack);  // eslint-disable-line no-console
      throw error;
    });
};

InternalEngineBootstrap.prototype.createCollections = function () {
  return this.createPluginsCollection()
    .then(() => this.createRoleCollection())
    .then(() => this.createProfileCollection())
    .then(() => this.createUsersCollection());
};

InternalEngineBootstrap.prototype.createRoleCollection = function () {
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
        return this.engine.createOrReplace('roles', roleId, _kuzzle.config.security.default);
      });

      _kuzzle.indexCache.add(this.engine.index, 'roles');

      return Promise.all(promises);
    });
};

InternalEngineBootstrap.prototype.createPluginsCollection = function () {
  if (_kuzzle.indexCache.exists(this.engine.index, 'plugins')) {
    return Promise.resolve();
  }

  return this.engine.updateMapping('plugins', {
    properties: {
      config: {enabled: false}
    }
  });
};

InternalEngineBootstrap.prototype.createProfileCollection = function () {
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

InternalEngineBootstrap.prototype.createUsersCollection = function () {
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

InternalEngineBootstrap.prototype.adminExists = function () {
  return this.engine.search('users', {query: {in: {profileIds: ['admin']}}})
    .then(response => (response.hits > 0));
};

module.exports = InternalEngineBootstrap;
