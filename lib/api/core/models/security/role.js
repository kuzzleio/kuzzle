var
  _ = require('lodash'),
  Promise = require('bluebird'),
  async = require('async'),
  vm = require('vm'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  ParseError = require('kuzzle-common-objects').Errors.parseError,
  Sandbox = require('../../sandbox');

/**
 * @constructor
 */
function Role () {
  this.controllers = {};

  // closures, allowInternalIndex and restrictedTo are computed for internal use only.
  this.closures = {};
  this.allowInternalIndex = false;

  // Injected by Profile.getRoles, contains a profile's policies
  this.restrictedTo = [];
}

function doesIndexExist(index, indexes) {
  return indexes && indexes[index] !== undefined;
}

function doesCollectionExist(index, collection, indexes) {
  return doesIndexExist(index, indexes) && _.includes(indexes[index], collection);
}

/**
 * @param {RequestObject} requestObject
 * @param {Context} context - user's context
 * @param {Kuzzle} kuzzle
 *
 * @returns {Promise}
 */
Role.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  var
    controllerRights,
    actionRights,
    promises = [],
    path = [];

  // explicit actions on internalIndex must be denied if no explicit restriction on internalIndex is set:
  if (requestObject.index === kuzzle.rawParams.internalIndex && !this.allowInternalIndex) {
    return Promise.resolve(false);
  }

  if (this.controllers === undefined) {
    return Promise.resolve(false);
  }

  if (this.controllers[requestObject.controller] !== undefined) {
    controllerRights = this.controllers[requestObject.controller];
    path.push(requestObject.controller);
  }
  else if (this.controllers['*'] !== undefined) {
    controllerRights = this.controllers['*'];
    path.push('*');
  }
  else {
    return Promise.resolve(false);
  }

  if (controllerRights.actions === undefined) {
    return Promise.resolve(false);
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
    return Promise.resolve(false);
  }

  if (requestObject.action === 'createCollection' &&
      !doesIndexExist(requestObject.index, kuzzle.indexCache.indexes)) {
    promises.push(canCreateIndex.call(this, requestObject.index, context, kuzzle));
  }

  if (_.includes(['import', 'create', 'updateMapping', 'createOrReplace'], requestObject.action) &&
      !doesCollectionExist(requestObject.index, requestObject.collection, kuzzle.indexCache.indexes)) {
    promises.push(canCreateCollection.call(this, requestObject.index, requestObject.collection, context, kuzzle));
  }

  if (_.isBoolean(actionRights)) {
    promises.push(Promise.resolve(actionRights));
  } else if (_.isObject(actionRights)) {
    promises.push(executeClosure.call(this, kuzzle, path, actionRights, requestObject, context));
  } else {
    return Promise.reject(new InternalError('Invalid rights given for role ' + this._id + '(' + path.join('/') + ') : ' + actionRights));
  }

  promises.push(checkRestrictions.call(this, requestObject));

  return Promise.all(promises).then(results => _.every(results));
};

/**
 * @param {Object} context
 * @returns {Promise}
 */
Role.prototype.validateDefinition = function (context) {
  if (!_.isObject(this.controllers)) {
    return Promise.reject(new BadRequestError('The "controllers" definition must be an object'));
  }
  if (Object.keys(this.controllers).length === 0) {
    return Promise.reject(new BadRequestError('The "controllers" definition cannot be empty'));
  }

  return new Promise((resolve, reject) => {
    var
      result,
      promises = [];

    result = Object.keys(this.controllers).every(controllerKey => {
      var controllerRights = this.controllers[controllerKey];

      if (!_.isObject(controllerRights)) {
        reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. Must be an object'));
        return false;
      }
      if (Object.keys(controllerRights).length === 0) {
        reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. Cannot be empty'));
        return false;
      }
      if (controllerRights.actions === undefined) {
        reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute missing'));
        return false;
      }
      if (!_.isObject(controllerRights.actions)) {
        reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute must be an object'));
        return false;
      }
      if (Object.keys(controllerRights.actions).length === 0) {
        reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute cannot be empty'));
        return false;
      }

      return Object.keys(controllerRights.actions).every(actionKey => {
        var actionRights = controllerRights.actions[actionKey];

        if (!_.isBoolean(actionRights) && !_.isObject(actionRights)) {
          reject(new BadRequestError('Invalid definition for ' + [controllerKey, actionKey] + '. Must be a boolean or an object'));
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
                $currentUserId: -1,
                args: {}
              },
              code: '(function (requestObject, context, $currentUserId, args) { ' + actionRights.test + '\nreturn false;\n})(requestObject, context, $currentUserId, args)'
            })
              .then(response => {
                var error;

                if (response.result !== undefined && _.isBoolean(response.result)) {
                  return response.result;
                }

                error = new BadRequestError('Invalid definition for ' + [controllerKey, actionKey] + '. Error executing function');
                error.detail = result.err;

                return Promise.reject(error);
              });
          })());
        }

        return true;
      });
    });

    if (result === true) {
      resolve(promises);
    }
  })
  .then(promises => Promise.all(promises))
  .then(() => true);
};

module.exports = Role;

function canCreateIndex(index, context, kuzzle) {
  var
    rq = {
      controller: 'admin',
      action: 'createIndex',
      index: index
    };

  return this.isActionAllowed(rq, context, kuzzle);
}


function canCreateCollection(index, collection, context, kuzzle) {
  var
    rq = {
      controller: 'admin',
      action: 'createCollection',
      index: index,
      collection: collection
    };

  return this.isActionAllowed(rq, context, kuzzle);
}

/**
 * @this {Role}
 * @param {RequestObject} requestObject the requestObject
 * @returns {Promise|Promise} resolves to a Boolean value
 */
function checkRestrictions(requestObject) {
  // If no restrictions, we allow the action:
  if (this.restrictedTo.length === 0) {
    return Promise.resolve(true);
  }

  // If the request's action does not refer to an index, restrictions are useless for this action (=> ignore them):
  if (!requestObject.index || requestObject.index === null || requestObject.index === undefined) {
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    async.some(this.restrictedTo, (restriction, callback) => {
      callback(null, checkIndexRestriction(requestObject, restriction));
    }, (error, result) => {
      resolve(result);
    });
  });
}

/**
 * @param {RequestObject} requestObject
 * @param {Object} restriction a restriction object on an index
 * @returns {Boolean}
 */
function checkIndexRestriction(requestObject, restriction) {
  if (restriction.index !== requestObject.index) {
    return false;
  }

  // if no collections given on the restriction, the action is allowed for all collections:
  if (!restriction.collections || restriction.collections.length === 0) {
    return true;
  }

  // If the request's action does not refer to a collection, the restriction is useless for this action (=> ignored):
  if (!requestObject.collection || requestObject.collection === null || requestObject.collection === undefined) {
    return true;
  }

  return _.includes(restriction.collections, requestObject.collection);
}

/**
 * @this {Role}
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
    argsDefinitions = {},
    message;

  if (typeof actionRights.test !== 'string') {
    error = new ParseError(`Error parsing rights for role ${this._id} (${path.join('/')}) : ${actionRights}`);
    error.details = 'Missing or malformed "test" attribute (string required)';
    return Promise.reject(error);
  }

  if (this.closures[path] === undefined) {
    this.closures[path] = {};
  }

  if (actionRights.args && Object.keys(actionRights.args).length > 0 && !this.closures[path].getArgsDefinitions) {
    try {
      /* jshint evil: true */
      /* eslint-disable no-eval */
      this.closures[path].getArgsDefinitions = global.eval('(function (requestObject) {return ' +
        JSON
          .stringify(actionRights.args)
          .replace(/"\$(requestObject\.[a-zA-Z0-9_\-.]*[a-zA-Z0-9])"/g, '$1')
          .replace('"$currentId"', 'requestObject.data._id') +
        ';})');
      /* jshint evil: false */
      /* eslint-enable no-eval */
    }
    catch (err) {
      error = new ParseError('Error parsing rights for role ' + this._id + ' (' + path.join('/') + ') :' + actionRights);
      error.details = err;

      return Promise.reject(error);
    }
  }

  if (this.closures[path].getArgsDefinitions) {
    argsDefinitions = this.closures[path].getArgsDefinitions(requestObject);
  }

  return buildArgsForContext.call(kuzzle, argsDefinitions)
    .then(args => {
      var sandboxContextObject = {
        $requestObject: requestObject,
        context: context,
        $currentUserId: context.token.userId,
        args: args
      };

      sandboxContext = vm.createContext(sandboxContextObject);

      if (!this.closures[path].test) {
        try {
          sandboxScript = new vm.Script('(function ($requestObject, context, $currentUserId, args) { ' +
            actionRights.test +
            '\nreturn false;\n })($requestObject, context, $currentUserId, args)');

          this.closures[path].test = sandboxScript;
        }
        catch (err) {
          message = `Error parsing closure rights for role ${this._id} (${path.join('/')}): ${actionRights}`;

          kuzzle.pluginsManager.trigger('log:error', message);
          error = new ParseError(message);
          error.details = err;

          return Promise.reject(error);
        }
      }

      return this.closures[path].test.runInContext(sandboxContext);
    })
    .then(result => {
      if (! _.isBoolean(result)) {
        message = `Error during executing rights action closure (${path.join('/')}): ${actionRights}`;

        kuzzle.pluginsManager.trigger('log:error', message);
        error = new ParseError(message);
        error.details = `Closure result is not a boolean value: ${result}`;

        return Promise.reject(error);
      }

      return result;
    })
    .catch((err) => {
      message = `Error during executing rights action closure (${path.join('/')}): ${err.message}`;

      kuzzle.pluginsManager.trigger('log:error', message);
      error = new ParseError(message);
      error.details = err;

      return Promise.reject(error);
    });
}

/**
 * @this {Role}
 * @param {Object} argsDefinitions
 * @returns {Promise}
 */
function buildArgsForContext (argsDefinitions) {
  if (Object.keys(argsDefinitions).length > 0) {
    return buildClosureArgs.call(this, argsDefinitions);
  }

  return Promise.resolve({});
}

/**
 * @this {Role}
 * @param {Object} argsDefinitions
 * @returns {Promise}
 */
function buildClosureArgs (argsDefinitions) {
  var
    argsFunctions = {};

  // Build the object that will be passed to parallel
  _.forEach(argsDefinitions, (argDefinition, argName) => {
    argsFunctions[argName] = factoryFunctionClosure.call(this, argName, argDefinition);
  });

  return new Promise(resolve => {
    async.parallel(argsFunctions, (error, results) => {
      if (error) {
        // In case we have an error we want to return an empty object because the error can come from readEngine
        return resolve({});
      }

      resolve(results);
    });
  });
}

/**
 * Return a function built for async.parallel with the right action on readEngine
 *
 * @this {Kuzzle}
 * @param {String} argName - the argument name set by user (i.e.: document, documents...)
 * @param {Object} argDefinition - definition set by user. Like {collection: 'messages', index: 'chat', action: { get: '$currentId' }}
 * @returns {Function} the function that will execute a get/mget/search on readEngine
 */
function factoryFunctionClosure (argName, argDefinition) {
  var methodName;

  if (!argDefinition.collection || !argDefinition.index || !argDefinition.action || Object.keys(argDefinition.action).length === 0) {
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
        body: {
          ids: argDefinition.action[methodName]
        }
      };
    }
    else if (methodName === 'search') {
      requestObject.data = {
        body: argDefinition.action[methodName]
      };
    }
    else if (methodName === 'get') {
      requestObject.data = {
        id: argDefinition.action[methodName]
      };
    }

    this.services.list.readEngine[methodName](requestObject)
      .then(response => {
        if (response.hits) {
          return callback(null, response.hits.map(document => {
            return {content: document._source, id: document._id};
          }));
        }

        callback(null, {content: response._source, id: response._id});
      })
      .catch((e) => {
        this.pluginsManager.trigger('log:error', `Error during readEngine execution for ${methodName} with ${JSON.stringify(argDefinition)}: ${e.message}`);
        return callback(null, {});
      });
  };
}
