var
  fs = require('fs'),
  RequestObject = require('./core/models/requestObject.js'),
  InternalError = require('./core/errors/internalError'),
  async = require('async'),
  q = require('q'),
  rc = require('rc'),
  env = {
    fixtures: 'FIXTURES',
    mappings: 'DEFAULT_MAPPING'
  };

module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;
  this.data = {};
  this.params = rc('kuzzle');

  this.defaultRoleDefinition = this.params.roleWithoutAdmin;

  if (kuzzle.isServer) {
    kuzzle.pluginsManager.trigger('log:info', '== Starting DB preparation...');
    return createInternalStructure.call(this)
      .then(() => {
        return readFile.call(this, 'mappings');
      })
      .then(() => {
        return readFile.call(this, 'fixtures');
      })
      .then(() => {
        return createIndexes.call(this);
      })
      .then(() => {
        return importMapping.call(this);
      })
      .then(() => {
        return importFixtures.call(this);
      })
      .then(() => {
        kuzzle.pluginsManager.trigger('log:info', '== DB preparation done.');
      });
  }

  return q();
};

function createInternalStructure () {
  var requestObject = new RequestObject({controller: 'admin', action: 'createIndex', index: this.kuzzle.config.internalIndex});

  if (this.kuzzle.indexCache.indexes[this.kuzzle.config.internalIndex]) {
    return q();
  }

  this.kuzzle.pluginsManager.trigger('log:info', '== Creating Kuzzle internal index...');

  return this.kuzzle.pluginsManager.trigger('prepareDb:createInternalIndex', requestObject)
    .then(newRequestObject => this.kuzzle.workerListener.add(newRequestObject))
    .then(() => {
      this.kuzzle.indexCache.add(this.kuzzle.config.internalIndex);

      this.kuzzle.pluginsManager.trigger('log:info', '== Creating roles collection...');

      requestObject = new RequestObject({
        controller: 'admin',
        action: 'updateMapping',
        index: this.kuzzle.config.internalIndex,
        collection: 'roles',
        body: {
          properties: {
            indexes: {
              enabled: false
            }
          }
        }
      });

      return this.kuzzle.pluginsManager.trigger('prepareDb:updateMappingRoles', requestObject);
    })
    .then(newRequestObject => this.kuzzle.workerListener.add(newRequestObject))
    .then(() => {
      this.kuzzle.indexCache.add(this.kuzzle.config.internalIndex, 'roles');

      this.kuzzle.pluginsManager.trigger('log:info', '== Creating profiles collection...');

      requestObject = new RequestObject({
        controller: 'admin',
        action: 'updateMapping',
        index: this.kuzzle.config.internalIndex,
        collection: 'profiles',
        body: {
          properties: {
            roles: {
              index: 'not_analyzed',
              type: 'string'
            }
          }
        }
      });

      return this.kuzzle.pluginsManager.trigger('data:updateMappingProfiles', requestObject);
    })
    .then(newRequestObject => this.kuzzle.workerListener.add(newRequestObject))
    .then(() => {
      this.kuzzle.indexCache.add(this.kuzzle.config.internalIndex, 'profiles');
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating users collection...');

      requestObject = new RequestObject({
        controller: 'admin',
        action: 'updateMapping',
        index: this.kuzzle.config.internalIndex,
        collection: 'users',
        body: {
          properties: {
            profile: {
              index: 'not_analyzed',
              type: 'string'
            },
            password: {
              index: 'no',
              type: 'string'
            }
          }
        }
      });

      return this.kuzzle.pluginsManager.trigger('data:updateMappingUsers', requestObject);
    })
    .then(newRequestObject => this.kuzzle.workerListener.add(newRequestObject))
    .then(() => this.kuzzle.indexCache.add(this.kuzzle.config.internalIndex, 'users'))
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default role for anonymous...');

      this.defaultRoleDefinition._id = 'anonymous';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: this.defaultRoleDefinition
      });


      return this.kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    })
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default role for default...');

      this.defaultRoleDefinition._id = 'default';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: this.defaultRoleDefinition
      });

      return this.kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    })
    .then(() => {
      this.kuzzle.indexCache.add(this.kuzzle.config.internalIndex, 'roles');
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default role for admin...');

      this.defaultRoleDefinition._id = 'admin';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: this.defaultRoleDefinition
      });


      return this.kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    })
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for default...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'default', roles: [ 'default' ]}
      });


      return this.kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for anonymous...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'anonymous', roles: [ 'anonymous' ]}
      });

      return this.kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for admin...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'admin', roles: [ 'admin' ]}
      });

      return this.kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    });

}

function readFile(which) {
  var
    envVar = env[which];

  if (!process.env[envVar] || process.env[envVar] === '') {
    this.kuzzle.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    this.data[which] = {};
    return q();
  }

  this.kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + '...');

  try {
    this.data[which] = JSON.parse(fs.readFileSync(process.env[envVar], 'utf8'));
    this.kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + ' done.');
    return q();
  }
  catch (e) {
    this.kuzzle.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + process.env[envVar] + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    this.kuzzle.pluginsManager.trigger('prepareDb:error', new Error('Error while loading the file ' + process.env[envVar]));
    return q.reject(new InternalError('Error while loading the file ' + process.env[envVar]));
  }
}

function createIndexes () {
  var deferred = q.defer();

  async.map(
    Object.keys(this.data.mappings).concat(Object.keys(this.data.fixtures)),
    (index, callback) => {
      var requestObject = new RequestObject({controller: 'admin', action: 'createIndex', index: index});

      if (this.kuzzle.indexCache.indexes[index]) {
        callback(null, true);

      } else {

        this.kuzzle.pluginsManager.trigger('prepareDb:createFixturesIndex', requestObject)
          .then(newRequestObject => {
            return this.kuzzle.workerListener.add(newRequestObject);
          })
          .then(() => {
            this.kuzzle.pluginsManager.trigger('log:info', '== index "' + index + '" created.');
            this.kuzzle.indexCache.add(index);
            callback(null, true);
          })
          .catch((error) => {
            this.kuzzle.pluginsManager.trigger('log:error', '!! index "' + index + '" not created: ' + JSON.stringify(error));
            callback(error);
          });
      }

    }, 
    (error) => {
      this.kuzzle.pluginsManager.trigger('log:info', '== Index creation process terminated.');

      if (error) {
        this.kuzzle.pluginsManager.trigger('prepareDb:error',
          '!! An error occured during the indexes creation.\nHere is the original error message:\n'+error.message
        );

        deferred.reject(new InternalError('An error occured during the indexes creation.\nHere is the original error message:\n'+error.message));
        return deferred.promise;
      }

      return deferred.resolve();
    }
  );

  return deferred.promise;
}

function importMapping () {
  var
    deferred = q.defer();

  async.each(Object.keys(this.data.mappings), (index, callbackIndex) => {
    async.each(Object.keys(this.data.mappings[index]), (collection, callbackCollection) => {
      var
        requestObject,
        msg;

      if (!this.data.mappings[index][collection].properties) {
        msg = '== Invalid mapping detected: missing required "properties" field';
        this.kuzzle.pluginsManager.trigger('log:err', msg);
        return callbackCollection(msg);
      }

      this.kuzzle.pluginsManager.trigger('log:info', '== Importing mapping for ' + index + ':' + collection + '...');

      requestObject = new RequestObject({
        controller: 'admin',
        index: index,
        collection: collection,
        body: this.data.mappings[index][collection]
      });

      this.kuzzle.pluginsManager.trigger('prepareDb:importMapping', requestObject)
        .then(newRequestObject => {
          return this.kuzzle.workerListener.add(newRequestObject);
        })
        .then(() => callbackCollection())
        .catch(response => callbackCollection('Mapping import error' + response.message));
    }, error => callbackIndex(error));
  }, error => {
    if (error) {
      return deferred.reject(new InternalError(error));
    }

    this.kuzzle.pluginsManager.trigger('log:info', '== All mapping imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}

function importFixtures() {
  var
    deferred = q.defer();

  async.each(Object.keys(this.data.fixtures), (index, callbackIndex) => {
    async.each(Object.keys(this.data.fixtures[index]), (collection, callback) => {
      var
        fixture = {
          controller: 'bulk',
          action: 'import',
          index: index,
          collection: collection,
          body: this.data.fixtures[index][collection]
        },
        requestObject = new RequestObject(fixture);

      this.kuzzle.pluginsManager.trigger('log:info', '== Importing fixtures for collection ' + index + ':' + collection + '...');

      this.kuzzle.pluginsManager.trigger('prepareDb:importFixtures', requestObject)
        .then(newRequestObject => this.kuzzle.workerListener.add(newRequestObject))
        .then(() => callback())
        .catch(response => {
          // 206 = partial errors
          if (response.status !== 206) {
            return callback(response.message);
          }

          // We need to filter "Document already exists" errors
          if (response.errors.filter(e => { return e.status !== 409; }).length === 0) {
            callback();
          } else {
            callback(response.message);
          }
        });
    }, function (error) {
      callbackIndex(error);
    });
  }, error => {
    if (error) {
      this.kuzzle.pluginsManager.trigger('log:error', '== Fixture import error: ' + error.message);
      return deferred.reject(new InternalError(error));
    }

    this.kuzzle.pluginsManager.trigger('log:info', '== All fixtures imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}
