var
  _ = require('lodash'),
  q = require('q'),
  async = require('async'),
  vm = require('vm'),
  BadRequestError = require('../../errors/badRequestError'),
  RequestObject = require('../requestObject'),
  InternalError = require('../../errors/internalError'),
  Sandbox = require('../../sandbox'),
  internalIndex = require('rc')('kuzzle').internalIndex;

function Role () {
  this.indexes = {};
  this.closures = {};
}

function doesIndexExist(requestObject, indexes) {
  return indexes && indexes[requestObject.index] !== undefined;
}

function doesCollectionExist(requestObject, indexes) {
  return indexes && _.contains(indexes[requestObject.index], requestObject.collection);
}

/**
 * @param requestObject
 * @param context - user's context
 * @param indexes - list of existing indexes/collections
 * @param {Kuzzle} kuzzle
 *
 * @returns {Promise}
 */
Role.prototype.isActionAllowed = function (requestObject, context, indexes, kuzzle) {
  var
    indexRights,
    collectionRights,
    controllerRights,
    actionRights,
    path = [];

  if (this.indexes === undefined) {
    return q(false);
  }

  /*
   Security controller's routes are only applicable on the internal index.
   Therefore, the "index" argument is not expected in the request object.
    */
  if (requestObject.controller === 'security' && !this.indexes[internalIndex]) {
    return q(false);
  }

  if (this.indexes[requestObject.index] !== undefined) {
    indexRights = this.indexes[requestObject.index];
    path.push(requestObject.index);
  }
  // Wildcards doesn't resolve the internal index. The internal index must always be set explicitly
  else if (this.indexes['*'] !== undefined && internalIndex !== requestObject.index) {
    indexRights = this.indexes['*'];
    path.push('*');
  }
  else {
    return q(false);
  }

  if (requestObject.action === 'createIndex' &&
    this.indexes._canCreate !== undefined &&
    !this.indexes._canCreate) {
    return q(false);
  }

  if (requestObject.action === 'deleteIndex' &&
    indexRights._canDelete !== undefined &&
    !indexRights._canDelete) {
    return q(false);
  }

  if (!doesIndexExist(requestObject, indexes) &&
    this.indexes._canCreate !== undefined &&
    !this.indexes._canCreate &&
    _.contains(['import', 'create', 'createCollection', 'updateMapping', 'createOrReplace'], requestObject.action)) {
    return q(false);
  }


  if (indexRights.collections === undefined) {
    return q(false);
  }

  if (indexRights.collections[requestObject.collection] !== undefined) {
    collectionRights = indexRights.collections[requestObject.collection];
    path.push(requestObject.collection);
  }
  else if (indexRights.collections['*'] !== undefined) {
    collectionRights = indexRights.collections['*'];
    path.push('*');
  }
  else {
    return q(false);
  }
  if (requestObject.action === 'deleteCollection' &&
    collectionRights._canDelete !== undefined &&
    !collectionRights._canDelete) {
    return q(false);
  }

  if (!doesCollectionExist(requestObject, indexes) &&
    indexRights.collections._canCreate !== undefined &&
    !indexRights.collections._canCreate &&
    _.contains(['import', 'create', 'createCollection', 'updateMapping', 'createOrReplace'], requestObject.action)) {
    return q(false);
  }

  if (collectionRights.controllers === undefined) {
    return q(false);
  }

  if (collectionRights.controllers[requestObject.controller] !== undefined) {
    controllerRights = collectionRights.controllers[requestObject.controller];
    path.push(requestObject.controller);
  }
  else if (collectionRights.controllers['*'] !== undefined) {
    controllerRights = collectionRights.controllers['*'];
    path.push('*');
  }
  else {
    return q(false);
  }

  if (controllerRights.actions === undefined) {
    return q(false);
  }

  if (controllerRights.actions[requestObject.action] !== undefined) {
    actionRights = controllerRights.actions[requestObject.action];
    path.push(requestObject.action);
  }
  else if (controllerRights.actions['*'] !== undefined) {
    actionRights = controllerRights.actions['*'];
    path.push('*');
  }
  else {
    return q(false);
  }

  if (_.isBoolean(actionRights)) {
    // the role configuration is set to a static boolean. We return it as-is.
    return q(actionRights);
  }

  if (_.isObject(actionRights)) {
    // the role configuration is an object with a function in attribute `test`. We assume it can be (almost) safely run
    // as it should have previously been validated during creation.

    return executeClosure.call(this, kuzzle, path, actionRights, requestObject, context);
  }

  throw (new InternalError('Invalid rights given for role ' + this._id + '(' + path.join('/') + ') : ' + actionRights));
};

/**
 * @param {Object} context
 * @returns {*}
 */
Role.prototype.validateDefinition = function (context) {
  var
    deferred = q.defer(),
    promises = [],
    args = {};

  if (!_.isObject(this.indexes)) {
    return q.reject(new BadRequestError('The index definition must be an object'));
  }
  if (_.isEmpty(this.indexes)) {
    return q.reject(new BadRequestError('The index definition cannot be empty'));
  }

  Object.keys(this.indexes).every(indexKey => {
    var indexRights = this.indexes[indexKey];

    if (indexKey === '_canCreate') {
      if (!_.isBoolean(indexRights)) {
        deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Must be an boolean'));
        return false;
      }

      return true;
    }

    if (!_.isObject(indexRights)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Must be an object'));
      return false;
    }
    if (_.isEmpty(indexRights)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Cannot be empty'));
      return false;
    }
    if (indexRights.collections === undefined) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute missing'));
      return false;
    }
    if (!_.isObject(indexRights.collections)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute must be an object'));
      return false;
    }
    if (_.isEmpty(indexRights.collections)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute cannot be empty'));
      return false;
    }

    Object.keys(indexRights.collections).every(collectionKey => {
      var collectionRights = indexRights.collections[collectionKey];

      if (collectionKey === '_canCreate') {
        if (!_.isBoolean(collectionRights)) {
          deferred.reject(new BadRequestError('Invalid index definition for ' + [indexKey, collectionKey] + '. Must be an boolean'));
          return false;
        }

        return true;
      }

      if (!_.isObject(collectionRights)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. Must be an object'));
        return false;
      }
      if (_.isEmpty(collectionRights)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. Cannot be empty'));
        return false;
      }
      if (collectionRights.controllers === undefined) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute missing'));
        return false;
      }
      if (!_.isObject(collectionRights.controllers)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute must be an object'));
        return false;
      }
      if (_.isEmpty(collectionRights.controllers)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute cannot be empty'));
        return false;
      }

      Object.keys(collectionRights.controllers).every(controllerKey => {
        var controllerRights = collectionRights.controllers[controllerKey];

        if (!_.isObject(controllerRights)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. Must be an object'));
          return false;
        }
        if (_.isEmpty(controllerRights)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. Cannot be empty'));
          return false;
        }
        if (controllerRights.actions === undefined) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute missing'));
          return false;
        }
        if (!_.isObject(controllerRights.actions)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute must be an object'));
          return false;
        }
        if (_.isEmpty(controllerRights.actions)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute cannot be empty'));
          return false;
        }

        Object.keys(controllerRights.actions).every(actionKey => {
          var actionRights = controllerRights.actions[actionKey];

          if (!_.isBoolean(actionRights) && !_.isObject(actionRights)) {
            deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey, actionKey] + '. Must be a boolean or an object'));
            return false;
          }

          if (_.isObject(actionRights) && actionRights.test) {

            promises.push((function () {
              var
                sandBox = new Sandbox();

              return sandBox.run({
                sandbox: {
                  requestObject: {
                    index: 'index',
                    collection: 'collection',
                    controller: 'controller',
                    action: 'action',
                    data: {
                      _id: -1,
                      body: {
                        a: true
                      }
                    }
                  },
                  context: {
                    connection: {type: context.connection.type},
                    token: context.token
                  },
                  args: {}
                },
                code: '(function (requestObject, context, args) { ' + actionRights.test + '\nreturn false;\n})(requestObject, context, args)'
              })
              .then(result => {
                var error;

                if (result.result !== undefined && _.isBoolean(result.result)) {
                  return q(result.result);
                }

                error = new BadRequestError('Invalid definition for '+ [indexKey, collectionKey, controllerKey, actionKey] + '. Error executing function');
                error.detail = result.err;

                return q.reject(error);
              });
            })());
          }

          return true;
        });

        return true;
      });

      return true;
    });

    return true;
  });

  if (promises.length > 0) {
    q.all(promises)
      .then(() => {
        deferred.resolve(true);
      })
      .catch(error => {
        deferred.reject(error);
      });
  }
  else {
    deferred.resolve(true);
  }

  return deferred.promise;
};

module.exports = Role;


/**
 * @param {Kuzzle} kuzzle
 * @param {Array} path
 * @param {Object} actionRights
 * @param {RequestObject} requestObject
 * @param {Object} context
 * @returns {Promise}
 */
function executeClosure (kuzzle, path, actionRights, requestObject, context) {
  var
    sandboxContext,
    sandboxScript,
    error,
    args = {},
    argsDefinitions = {};

  if (this.closures[path] === undefined) {
    this.closures[path] = {};
  }

  if (actionRights.args && !this.closures[path].getArgsDefinitions) {
    try {
      /* jshint evil: true */
      this.closures[path].getArgsDefinitions = eval('(function (requestObject) {return ' +
        JSON.stringify(actionRights.args).replace('"$currentId"', 'requestObject.data._id') +
        ';})');
      /* jshint evil: false */
    }
    catch (err) {
      error = new InternalError('Error parsing rights for role ' + this._id + ' (' + path.join('/') + ') :' + actionRights);
      error.details = err;

      throw (error);
    }
  }

  if (this.closures[path].getArgsDefinitions) {
    argsDefinitions = this.closures[path].getArgsDefinitions(requestObject);
  }

  return buildArgsForContext.call(kuzzle, argsDefinitions)
    .then(args => {
      sandboxContext = vm.createContext({ requestObject: requestObject, context: context, args: args });

      if (!this.closures[path].test) {
        try {
          sandboxScript = new vm.Script('(function (requestObject, context, args) { ' + actionRights.test + '\nreturn false;\n })(requestObject, context, args)');
          this.closures[path].test = sandboxScript;
        }
        catch (err) {
          var message = `Error parsing rights for role ${this._id} (${path.join('/')}): ${actionRights}`;

          kuzzle.pluginsManager.trigger('log:error', message);
          error = new InternalError(message);
          error.details = err;

          throw (error);
        }
      }

      return this.closures[path].test.runInContext(sandboxContext);
    })
    .catch((e) => {
      var message = `Error during executing rights action closure (${path.join('/')}): ${e.message}`;

      kuzzle.pluginsManager.trigger('log:error', message);
      error = new InternalError(message);
      error.details = err;

      throw (error);
    });
}

/**
 *
 * @param argsDefinitions
 * @returns {Promise}
 */
function buildArgsForContext (argsDefinitions) {
  var
    deferred = q.defer();

  if (!_.isEmpty(argsDefinitions)) {
    return buildClosureArgs.call(this, argsDefinitions);
  }

  deferred.resolve({});
  return deferred.promise;
}

/**
 * @param {Object} argsDefinitions
 * @returns {Promise}
 */
function buildClosureArgs (argsDefinitions) {
  var
    deferred = q.defer(),
    argsFunctions = {};

  // Build the object that will be passed to parallel
  _.forEach(argsDefinitions, (argDefinition, argName) => {
    argsFunctions[argName] = factoryFunctionClosure.call(this, argName, argDefinition);
  });

  async.parallel(argsFunctions, (error, results) => {
    if (error) {
      // In case we have an error we want to return an empty object because the error can come from readEngine
      return deferred.resolve({});
    }

    deferred.resolve(results);
  });

  return deferred.promise;
}

/**
 * Return a function built for async.parallel with the right action on readEngine
 * @param {String} argName - the argument name set by user (i.e.: document, documents...)
 * @param {Object} argDefinition - definition set by user. Like {collection: 'messages', index: 'chat', action: { get: '$currentId' }}
 * @returns {Function} the function that will execute a get/mget/search on readEngine
 */
function factoryFunctionClosure (argName, argDefinition) {
  var methodName;

  if (!argDefinition.collection || !argDefinition.index || !argDefinition.action || _.isEmpty(argDefinition.action)) {
    this.pluginsManager.trigger('log:error', `Bad format in closure rights for ${argName}`);
    return callback => callback(null, {});
  }

  methodName = Object.keys(argDefinition.action)[0];

  if (['get', 'mget', 'search'].indexOf(methodName) === -1) {
    this.pluginsManager.trigger('log:error', `Try to use an unauthorized function (${methodName}) in closure rights check`);
    return callback => callback(null, {});
  }

  return callback => {
    var requestObject = new RequestObject({
      controller: 'read',
      action: methodName,
      collection: argDefinition.collection,
      index: argDefinition.index
    });

    if (methodName === 'mget') {
      requestObject.data = {
        ids: argDefinition.action[methodName]
      };
    }
    else if (methodName === 'search') {
      requestObject.data = argDefinition.action[methodName];
    }
    else if (methodName === 'get') {
      requestObject.data = {
        id: argDefinition.action[methodName]
      };
    }

    this.services.list.readEngine[methodName](requestObject)
      .then(responseObject => {
        if (responseObject.data.hits) {
          return callback(null, responseObject.data.hits);
        }

        callback(null, {content: responseObject.data.body._source, id: responseObject.data.body._id});
      })
      .catch((e) => {
        return callback(null, {});
      });
  };
}