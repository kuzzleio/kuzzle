var
  fs = require('fs'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  async = require('async'),
  q = require('q'),
  _kuzzle;

/**
 * @typedef {{kuzzle: Kuzzle, defaultRoleDefinition: *, files: {fixtures: *, mapping: *}, data: *}} PrepareDb
 */

/**
 * @this {PrepareDb}
 * @param {Request} request
 * @returns {Promise}
 */
function prepareDb (request) {
  /** @type {Kuzzle} */

  if (_kuzzle.isServer) {
    this.data = {};
    this.params = _kuzzle.rawParams;
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

    _kuzzle.pluginsManager.trigger('log:info', '== Starting DB preparation...');

    return createInternalStructure.call(this)
      .then(() => readFile.call(this, 'mappings'))
      .then(() => readFile.call(this, 'fixtures'))
      .then(() => createIndexes.call(this))
      .then(() => importMapping.call(this))
      .then(() => importFixtures.call(this))
      .then(() => {
        _kuzzle.pluginsManager.trigger('log:info', '== DB preparation done.');
        return {databasePrepared: true};
      })
      .catch(error => {
        var kuzzleError = new InternalError(error.message);
        kuzzleError.stack = error.stack;
        _kuzzle.pluginsManager.trigger('log:error', '!! An error occured during the process.\nHere is the original error object:\n', error);

        throw kuzzleError;
      });
  }

  return q({isWorker: true});
};

/**
 * @this {PrepareDb}
 * @returns {Promise}
 */
function createInternalStructure() {
  return createInternalIndex(_kuzzle)
    .then(() => createRoleCollection(_kuzzle, this.defaultRoleDefinition))
    .then(() => createProfileCollection(_kuzzle))
    .then(() => createUserCollection(_kuzzle));
}

/**
 * @this {PrepareDb}
 */
function readFile(which) {

  if (!this.files[which] || this.files[which] === '') {
    _kuzzle.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    this.data[which] = {};
    return q();
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + this.files[which] + '...');

  try {
    this.data[which] = JSON.parse(fs.readFileSync(this.files[which], 'utf8'));
    _kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + this.files[which] + ' done.');
    return q();
  }
  catch (e) {
    _kuzzle.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + which + ' file located at' + this.files[which] + '! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e
    );

    _kuzzle.pluginsManager.trigger('prepareDb:error', new Error('Error while loading the file ' + this.files[which]));
    return q.reject(new InternalError('Error while loading the file ' + this.files[which]));
  }
}

/**
 * @this {PrepareDb}
 */
function createIndexes() {
  var deferred = q.defer();

  async.map(
    Object.keys(this.data.mappings).concat(Object.keys(this.data.fixtures)),
    (index, callback) => {
      var requestObject = new RequestObject({controller: 'admin', action: 'createIndex', index: index});

      if (_kuzzle.indexCache.indexes[index]) {
        callback(null, true);

      } else {

        _kuzzle.pluginsManager.trigger('prepareDb:createFixturesIndex', requestObject)
          .then(newRequestObject => {
            return _kuzzle.workerListener.add(newRequestObject);
          })
          .then(() => {
            _kuzzle.pluginsManager.trigger('log:info', '== index "' + index + '" created.');
            _kuzzle.indexCache.add(index);
            callback(null, true);
          })
          .catch((error) => {
            _kuzzle.pluginsManager.trigger('log:error', '!! index "' + index + '" not created: ' + JSON.stringify(error));
            callback(error);
          });
      }

    },
    (error) => {
      _kuzzle.pluginsManager.trigger('log:info', '== Index creation process terminated.');

      if (error) {
        _kuzzle.pluginsManager.trigger('prepareDb:error',
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

/**
 * @this {PrepareDb}
 */
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
        _kuzzle.pluginsManager.trigger('log:err', msg);
        return callbackCollection(msg);
      }

      _kuzzle.pluginsManager.trigger('log:info', '== Importing mapping for ' + index + ':' + collection + '...');

      requestObject = new RequestObject({
        controller: 'admin',
        action: 'updateMapping',
        index: index,
        collection: collection,
        body: this.data.mappings[index][collection]
      });

      _kuzzle.pluginsManager.trigger('prepareDb:importMapping', requestObject)
        .then(newRequestObject => {
          return _kuzzle.workerListener.add(newRequestObject);
        })
        .then(() => callbackCollection())
        .catch(response => callbackCollection('Mapping import error ' + response.message));

    }, error => callbackIndex(error));
  }, error => {
    if (error) {
      _kuzzle.pluginsManager.trigger('log:error', 'An error occured during the mappings import.\nHere is the original error object:\n', error);
      return deferred.reject(new InternalError(error));
    }

    _kuzzle.pluginsManager.trigger('log:info', '== All mapping imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}

/**
 * @this {PrepareDb}
 */
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

      _kuzzle.pluginsManager.trigger('log:info', '== Importing fixtures for collection ' + index + ':' + collection + '...');

      _kuzzle.pluginsManager.trigger('prepareDb:importFixtures', requestObject)
        .then(newRequestObject => _kuzzle.workerListener.add(newRequestObject))
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
      _kuzzle.pluginsManager.trigger('log:error', '== Fixture import error: ' + error.message);
      return deferred.reject(new InternalError(error));
    }

    _kuzzle.pluginsManager.trigger('log:info', '== All fixtures imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}

/**
 * @this {PrepareDb}
 */
function createInternalIndex(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'createIndex',
    index: kuzzle.config.internalIndex
  });

  if (kuzzle.indexCache && kuzzle.indexCache.indexes && kuzzle.indexCache.indexes[kuzzle.config.internalIndex]) {
    return q();
  }

  kuzzle.pluginsManager.trigger('log:info', '== Creating Kuzzle internal index...');

  return kuzzle.pluginsManager.trigger('prepareDb:createInternalIndex', requestObject)
    .then(newRequestObject => kuzzle.workerListener.add(newRequestObject))
    .then(() => kuzzle.indexCache.add(kuzzle.config.internalIndex));
}

/**
 * @this {PrepareDb}
 */
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

/**
 * @this {PrepareDb}
 */
function createProfileCollection(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'updateMapping',
    index: kuzzle.config.internalIndex,
    collection: 'profiles',
    body: {
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
        body: {_id: 'default', policies: [ {_id: 'default', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for anonymous...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'anonymous', policies: [ {_id:'anonymous', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    })
    .then(() => {
      kuzzle.pluginsManager.trigger('log:info', '== Creating default profile for admin...');

      requestObject = new RequestObject({
        controller: 'security',
        action: 'createOrReplaceProfile',
        body: {_id: 'admin', policies: [ {_id:'admin', allowInternalIndex: true} ]}
      });

      return kuzzle.funnel.controllers.security.createOrReplaceProfile(requestObject, {});
    });
}

/**
 * @this {PrepareDb}
 */
function createUserCollection(kuzzle) {
  var requestObject = new RequestObject({
    controller: 'admin',
    action: 'updateMapping',
    index: kuzzle.config.internalIndex,
    collection: 'users',
    body: {
      properties: {
        profileId: {
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

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return prepareDb;
}
