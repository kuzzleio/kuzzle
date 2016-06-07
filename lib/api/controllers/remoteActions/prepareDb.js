var
  fs = require('fs'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  async = require('async'),
  q = require('q'),
  rc = require('rc');

module.exports = function PrepareDb (kuzzle, request) {
  this.kuzzle = kuzzle;

  if (this.kuzzle.isServer) {
    this.data = {};
    this.params = rc('kuzzle');
    this.files = {
      fixtures: null,
      mappings: null
    };

    if (request.data.body.fixtures) {
      this.files.fixtures = request.data.body.fixtures;
    }
    if (request.data.body.mappings) {
      this.files.mappings = request.data.body.mappings;
    }

    this.defaultRoleDefinition = this.params.roleWithoutAdmin;

    this.kuzzle.pluginsManager.trigger('log:info', '== Starting DB preparation...');

    return createInternalStructure.call(this)
      .then(() => readFile.call(this, 'mappings'))
      .then(() => readFile.call(this, 'fixtures'))
      .then(() => createIndexes.call(this))
      .then(() => importMapping.call(this))
      .then(() => importFixtures.call(this))
      .then(() => {
        this.kuzzle.pluginsManager.trigger('log:info', '== DB preparation done.');
        return {databasePrepared: true};
      })
      .catch(error => {
        var kuzzleError = new InternalError(error.message);
        kuzzleError.stack = error.stack;
        this.kuzzle.pluginsManager.trigger('log:error', '!! An error occured during the process.\nHere is the original error object:\n', error);

        throw kuzzleError;
      });
  }

  return q({isWorker: true});
};

function createInternalStructure() {
  return createInternalIndex(this.kuzzle)
    .then(() => createRoleCollection(this.kuzzle, this.defaultRoleDefinition))
    .then(() => createProfileCollection(this.kuzzle))
    .then(() => createUserCollection(this.kuzzle));
}

function readFile(which) {

  if (!this.files[which] || this.files[which] === '') {
    this.kuzzle.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    this.data[which] = {};
    return q();
  }

  this.kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + this.files[which] + '...');

  try {
    this.data[which] = JSON.parse(fs.readFileSync(this.files[which], 'utf8'));
    this.kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + this.files[which] + ' done.');
    return q();
  }
  catch (e) {
    this.kuzzle.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + which + ' file located at' + this.files[which] + '! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e
    );

    this.kuzzle.pluginsManager.trigger('prepareDb:error', new Error('Error while loading the file ' + this.files[which]));
    return q.reject(new InternalError('Error while loading the file ' + this.files[which]));
  }
}

function createIndexes() {
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

function importMapping() {
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
        action: 'updateMapping',
        index: index,
        collection: collection,
        body: this.data.mappings[index][collection]
      });

      this.kuzzle.pluginsManager.trigger('prepareDb:importMapping', requestObject)
        .then(newRequestObject => {
          return this.kuzzle.workerListener.add(newRequestObject);
        })
        .then(() => callbackCollection())
        .catch(response => callbackCollection('Mapping import error ' + response.message));

    }, error => callbackIndex(error));
  }, error => {
    if (error) {
      this.kuzzle.pluginsManager.trigger('log:error', 'An error occured during the mappings import.\nHere is the original error object:\n', error);
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
          if (response.errors.filter(e => e.status !== 409).length === 0) {
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

function createInternalIndex(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'createIndex',
    index: kuzzle.config.internalIndex
  });

  if (kuzzle.indexCache.indexes[kuzzle.config.internalIndex]) {
    return q();
  }

  kuzzle.pluginsManager.trigger('log:info', '== Creating Kuzzle internal index...');

  return kuzzle.pluginsManager.trigger('prepareDb:createInternalIndex', requestObject)
    .then(newRequestObject => kuzzle.workerListener.add(newRequestObject))
    .then(() => kuzzle.indexCache.add(kuzzle.config.internalIndex))
    .catch(error => {
      console.log('***********************', error);
    });
}

function createRoleCollection(kuzzle, defaultRoleDefinition) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'updateMapping',
    index: kuzzle.config.internalIndex,
    collection: 'roles',
    body: {
      properties: {
        controllers: {
          enabled: false
        }
      }
    }
  });

  if (kuzzle.indexCache.indexes[kuzzle.config.internalIndex].indexOf('roles') !== -1) {
    return q();
  }

  kuzzle.pluginsManager.trigger('log:info', '== Creating roles collection...');

  return kuzzle.pluginsManager.trigger('prepareDb:updateMappingRoles', requestObject)
    .then(newRequestObject => kuzzle.workerListener.add(newRequestObject))
    .then(() => kuzzle.indexCache.add(kuzzle.config.internalIndex, 'roles'))
    .then(() => {
      kuzzle.indexCache.add(kuzzle.config.internalIndex, 'roles');
      kuzzle.pluginsManager.trigger('log:info', '== Creating default role for anonymous...');
      defaultRoleDefinition._id = 'anonymous';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: defaultRoleDefinition
      });

      return kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default role for default...');

      defaultRoleDefinition._id = 'default';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: defaultRoleDefinition
      });

      return kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default role for admin...');

      defaultRoleDefinition._id = 'admin';

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceRole',
        body: defaultRoleDefinition
      });

      return kuzzle.funnel.controllers.security.createOrReplaceRole(requestObject, {});
    });
}

function createProfileCollection(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'updateMapping',
    index: kuzzle.config.internalIndex,
    collection: 'profiles',
    body: {
      properties: {
        roles: {
          properties: {
            _id: {
              index: 'not_analyzed',
              type: 'string'
            }
          }
        }
      }
    }
  });

  if (kuzzle.indexCache.indexes[kuzzle.config.internalIndex].indexOf('profiles') !== -1) {
    return q();
  }

  kuzzle.pluginsManager.trigger('log:info', '== Creating profiles collection...');

  return kuzzle.pluginsManager.trigger('prepareDb:updateMappingProfiles', requestObject)
    .then(newRequestObject => kuzzle.workerListener.add(newRequestObject))
    .then(() => {
      kuzzle.indexCache.add(kuzzle.config.internalIndex, 'profiles');
      kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for default...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'default', roles: [ {_id: 'default', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for anonymous...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'anonymous', roles: [ {_id:'anonymous', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for admin...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'admin', roles: [ {_id:'admin', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    });
}

function createUserCollection(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'updateMapping',
    index: kuzzle.config.internalIndex,
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

  if (kuzzle.indexCache.indexes[kuzzle.config.internalIndex].indexOf('users') !== -1) {
    return q();
  }

  kuzzle.pluginsManager.trigger('log:info', '== Creating users collection...');

  return kuzzle.pluginsManager.trigger('prepareDb:updateMappingUsers', requestObject)
    .then(newRequestObject => kuzzle.workerListener.add(newRequestObject))
    .then(() => kuzzle.indexCache.add(kuzzle.config.internalIndex, 'users'));
}
