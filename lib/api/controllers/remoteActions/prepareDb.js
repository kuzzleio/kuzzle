var
  fs = require('fs'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  Promise = require('bluebird'),
  _kuzzle,
  _data = {
    fixtures: {},
    mappings: {}
  },
  _params,
  _files = {
    fixtures: null,
    mappings: null
  };

/**
 * @param {Request} request
 * @returns {Promise}
 */
function prepareDb (request) {
  _params = _kuzzle.config;

  if (request.data.body.fixtures) {
    _files.fixtures = request.data.body.fixtures;
  }
  if (request.data.body.mappings) {
    _files.mappings = request.data.body.mappings;
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Starting DB preparation...');

  return createInternalStructure()
    .then(() => readFile('mappings'))
    .then(() => readFile('fixtures'))
    .then(() => createIndexes())
    .then(() => importMapping())
    .then(() => importFixtures())
    .then(() => {
      _kuzzle.pluginsManager.trigger('log:info', '== DB preparation done.');
      return {databasePrepared: true};
    })
    .catch(error => {
      var kuzzleError = new InternalError(error.message);
      kuzzleError.stack = error.stack;
      _kuzzle.pluginsManager.trigger('log:error', '!! An error occurred during the process.\nHere is the original error message:\n' + error.message);

      throw kuzzleError;
    });
}

/**
 * @returns {Promise}
 */
function createInternalStructure() {
  return createInternalIndex()
    .then(() => createRoleCollection(_params.security.default.role))
    .then(() => createProfileCollection())
    .then(() => createUserCollection());
}

function readFile(which) {
  if (!_files[which] || _files[which] === '') {
    _kuzzle.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    _data[which] = {};
    return Promise.resolve();
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + _files[which] + '...');

  try {
    _data[which] = JSON.parse(fs.readFileSync(_files[which], 'utf8'));
    _kuzzle.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + _files[which] + ' done.');
    return Promise.resolve();
  }
  catch (e) {
    _kuzzle.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + which + ' file located at' + _files[which] + '! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e
    );

    _kuzzle.pluginsManager.trigger('prepareDb:error', new Error('Error while loading the file ' + _files[which]));
    return Promise.reject(new InternalError('Error while loading the file ' + _files[which]));
  }
}

function createIndexes() {
  var promises;

  promises = Object.keys(_data.mappings)
    .concat(Object.keys(_data.fixtures))
    .filter((value, index, self) => {
      return self.indexOf(value) === index;
    })
    .map(index => {
      if (_kuzzle.indexCache.indexes[index]) {
        return Promise.resolve();
      }

      return _kuzzle.funnel.controllers.admin.createIndex(new RequestObject({
        index,
        controller: 'admin',
        action: 'createIndex'
      }))
        .then(response => {
          if (response.error) {
            throw response.error;
          }

          return response.toJson().result;
        });
    });

  return Promise.all(promises)
    .catch(error => {
      _kuzzle.pluginsManager.trigger('prepareDb:error',
        '!! An error occurred during the indexes creation.\nHere is the original error message:\n'+error.message
      );
      throw new InternalError('An error occurred during the indexes creation.\nHere is the original error message:\n'+error.message);
    });
}

function importMapping() {
  var promises = [];

  Object.keys(_data.mappings).forEach(index => {
    Object.keys(_data.mappings[index]).forEach(collection => {
      promises.push(Promise.resolve()
      .then(() => {
        var msg;

        if (!_data.mappings[index][collection].properties) {
          msg = '== Invalid mapping detected: missing required "properties" field';
          _kuzzle.pluginsManager.trigger('log:err', msg);
          return Promise.reject(new InternalError(msg));
        }

        _kuzzle.pluginsManager.trigger('log:info', '== Importing mapping for ' + index + ':' + collection + '...');

        return _kuzzle.funnel.controllers.admin.updateMapping(new RequestObject({
          controller: 'admin',
          action: 'updateMapping',
          index,
          collection,
          body: _data.mappings[index][collection]
        }))
          .then(response => {
            if (response.error) {
              throw response.error;
            }

            return response.toJson().result;
          });
      }));
    });
  });

  return Promise.all(promises);
}

function importFixtures() {
  var promises = [];

  Object.keys(_data.fixtures).forEach(index => {
    Object.keys(_data.fixtures[index]).forEach(collection => {
      promises.push(
        Promise.resolve()
          .then(() => {
            return _kuzzle.funnel.controllers.bulk.import(new RequestObject({
              controller: 'bulk',
              action: 'import',
              index,
              collection,
              body: _data.fixtures[index][collection]
            }))
              .then(response => {
                if (response.error) {
                  throw response.error;
                }

                if (response.status === 206
                  && response.data.body.errors.filter(e => e.status !== 409).length > 0) {
                  throw response.data.body;
                }

                return response.data.body;
              });
          })
      );
    });
  });

  return Promise.all(promises);
}

function createInternalIndex() {
  if (_kuzzle.indexCache && _kuzzle.indexCache.indexes && _kuzzle.indexCache.indexes[_kuzzle.internalEngine.index]) {
    return Promise.resolve();
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Creating Kuzzle internal index...');

  return _kuzzle.internalEngine.createInternalIndex()
    .then(() => {
      _kuzzle.indexCache.add(_kuzzle.internalEngine.index);
    });
}

function createRoleCollection(defaultRoleDefinition) {
  _kuzzle.pluginsManager.trigger('log:info', '== Creating roles collection...');

  if (_kuzzle.indexCache.indexes[_kuzzle.internalEngine.index].indexOf('roles') !== -1) {
    return Promise.resolve();
  }

  return _kuzzle.internalEngine.updateMapping('roles', {
    properties: {
      controllers: {
        enabled: false
      }
    }
  })
    .then(() => {
      _kuzzle.indexCache.add(_kuzzle.internalEngine.index, 'roles');
    })
    .then(() => {
      var promises = ['anonymous', 'default', 'admin'].map(roleId => {
        return Promise.resolve().then(() => {
          _kuzzle.pluginsManager.trigger('log:info', `== Creating default role for ${roleId}...`);
          return _kuzzle.internalEngine.createOrReplace('roles', roleId, defaultRoleDefinition);
        });
      });

      return Promise.all(promises);
    });
}

function createProfileCollection() {
  if (_kuzzle.indexCache.indexes[_kuzzle.internalEngine.index].indexOf('profiles') !== -1) {
    return Promise.resolve();
  }

  _kuzzle.pluginsManager.trigger('log:info', '== Creating profiles collection...');

  return _kuzzle.internalEngine.updateMapping('profiles', {
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

      _kuzzle.indexCache.add(_kuzzle.internalEngine.index, 'profiles');

      promises = ['default', 'anonymous', 'admin'].map(profileId => {
        return Promise.resolve().then(() => {
          _kuzzle.pluginsManager.trigger('log:info', `== Creating default profile for ${profileId}...`);

          return _kuzzle.internalEngine.createOrReplace('profiles', profileId, {
            policies: [{roleId: profileId, allowInternalIndex: true}]
          });
        });
      });

      return Promise.all(promises);
    });
}

function createUserCollection() {
  if (_kuzzle.indexCache.indexes[_kuzzle.internalEngine.index].indexOf('users') !== -1) {
    return Promise.resolve();
  }

  return _kuzzle.internalEngine.updateMapping('users', {
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
      _kuzzle.indexCache.add(_kuzzle.internalEngine.index, 'users');
    });
}

/**
 *
 * @param {Kuzzle} kuzzle
 * @returns {prepareDb}
 */
module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return prepareDb;
};
