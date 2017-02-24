'use strict';

const
  _ = require('lodash'),
  Promise = require('bluebird'),
  async = require('async'),
  vm = require('vm'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  ParseError = require('kuzzle-common-objects').errors.ParseError,
  Request = require('kuzzle-common-objects').Request,
  Sandbox = require('../../sandbox');

/**
 * @constructor
 */
function Role () {
  this.controllers = {};

  // closures and restrictedTo are computed for internal use only.
  this.closures = {};

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
 * @param {Request} request
 * @param {Kuzzle} kuzzle
 * @return Promise
 */
Role.prototype.isActionAllowed = function roleIsActionAllowed (request, kuzzle) {
  var
    controllerRights,
    actionRights,
    promises = [],
    path = [];

  // explicit actions on internalIndex must be denied if no explicit restriction on internalIndex is set:
  if (request.input.resource.index === kuzzle.internalEngine.index && !this.allowInternalIndex) {
    return Promise.resolve(false);
  }

  if (this.controllers === undefined) {
    return Promise.resolve(false);
  }

  if (this.controllers[request.input.controller] !== undefined) {
    controllerRights = this.controllers[request.input.controller];
    path.push(request.input.controller);
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

  if (controllerRights.actions[request.input.action] !== undefined) {
    actionRights = controllerRights.actions[request.input.action];
    path.push(request.input.action);
  }
  else if (controllerRights.actions['*'] !== undefined) {
    actionRights = controllerRights.actions['*'];
    path.push('*');
  }
  else {
    return Promise.resolve(false);
  }

  if (request.input.action === 'createCollection' && !doesIndexExist(request.input.resource.index, kuzzle.indexCache.indexes)) {
    let newRequest = new Request ({
      controller: 'admin',
      action: 'createIndex',
      index: request.input.resource.index
    }, request.context);

    promises.push(this.isActionAllowed(newRequest, kuzzle));
  }

  if (_.includes(['import', 'create', 'updateMapping', 'createOrReplace'], request.input.action) &&
      !doesCollectionExist(request.input.resource.index, request.input.resource.collection, kuzzle.indexCache.indexes)) {
    let newRequest = new Request ({
      controller: 'admin',
      action: 'createCollection',
      index: request.input.resource.index,
      collection: request.input.resource.collection
    }, request.context);

    promises.push(this.isActionAllowed(newRequest, kuzzle));
  }

  if (_.isBoolean(actionRights)) {
    promises.push(Promise.resolve(actionRights));
  } else if (_.isObject(actionRights)) {
    promises.push(executeClosure(this, kuzzle, path, actionRights, request));
  } else {
    return Promise.reject(new InternalError('Invalid rights given for role ' + this._id + '(' + path.join('/') + ') : ' + actionRights));
  }

  promises.push(checkRestrictions(this, request));

  return Promise.all(promises).then(results => _.every(results));
};

/**
 * @returns {Promise}
 */
Role.prototype.validateDefinition = function roleValidateDefinition () {
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
          promises.push((function roleValidateDefinitionSandbox () {
            var sandBox = new Sandbox();

            return sandBox.run({
              sandbox: {
                $request: new Request({}),
                $currentUserId: -1,
                args: {}
              },
              code: '(function ($request, $currentUserId, args) { ' + actionRights.test + '\nreturn false;\n})($request, $currentUserId, args)'
            })
              .then(response => {
                var error;

                if (response.result !== undefined && _.isBoolean(response.result)) {
                  return response.result;
                }

                error = new BadRequestError('Invalid definition for ' + [controllerKey, actionKey] + '. Error executing function');
                error.details = result.err;

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

/**
 * @param {Role} role
 * @param {Request} request
 * @returns {Promise<Boolean>} resolves to a Boolean value
 */
function checkRestrictions(role, request) {
  // If no restrictions, we allow the action:
  if (role.restrictedTo.length === 0) {
    return Promise.resolve(true);
  }

  // If the request's action does not refer to an index, restrictions are useless for this action (=> ignore them):
  if (!request.input.resource.index || request.input.resource.index === null || typeof request.input.resource.index === 'undefined') {
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    async.some(role.restrictedTo, (restriction, callback) => {
      callback(null, checkIndexRestriction(request, restriction));
    }, (error, result) => {
      resolve(result);
    });
  });
}

/**
 * @param {Request} request
 * @param {object} restriction a restriction object on an index
 * @returns {Boolean}
 */
function checkIndexRestriction(request, restriction) {
  if (restriction.index !== request.input.resource.index) {
    return false;
  }

  // if no collections given on the restriction, the action is allowed for all collections:
  if (!restriction.collections || restriction.collections.length === 0) {
    return true;
  }

  // If the request's action does not refer to a collection, the restriction is useless for this action (=> ignored):
  if (!request.input.resource.collection) {
    return true;
  }

  return _.includes(restriction.collections, request.input.resource.collection);
}

/**
 * @param {Role} role
 * @param {Kuzzle} kuzzle
 * @param {Array} path
 * @param {object} actionRights
 * @param {Request} request
 * @returns {Promise}
 */
function executeClosure (role, kuzzle, path, actionRights, request) {
  var
    sandboxContext,
    sandboxScript,
    error,
    argsDefinitions = {},
    message;

  if (typeof actionRights.test !== 'string') {
    error = new ParseError(`Error parsing rights for role ${role._id} (${path.join('/')}) : ${actionRights}`);
    error.details = 'Missing or malformed "test" attribute (string required)';
    return Promise.reject(error);
  }

  if (role.closures[path] === undefined) {
    role.closures[path] = {};
  }

  if (actionRights.args && Object.keys(actionRights.args).length > 0 && !role.closures[path].getArgsDefinitions) {
    try {
      /* eslint-disable no-eval */
      role.closures[path].getArgsDefinitions = global.eval('(function (request) {return ' +
        JSON.stringify(actionRights.args)
          .replace(/"\$(request\.[a-zA-Z0-9_\-.]*[a-zA-Z0-9])"/g, '$1')
          .replace('"$currentId"', 'request.input.resource._id') +
        ';})');
      /* eslint-enable no-eval */
    }
    catch (err) {
      error = new ParseError(`Error parsing rights for role ${role._id} (${path.join('/')}) : ${actionRights.args}`);
      error.details = err;

      return Promise.reject(error);
    }
  }

  if (role.closures[path].getArgsDefinitions) {
    argsDefinitions = role.closures[path].getArgsDefinitions(request);
  }

  return buildArgsForContext(kuzzle, argsDefinitions)
    .then(args => {
      var sandboxContextObject = {
        $request: request,
        $currentUserId: request.context.userId,
        args: args
      };

      sandboxContext = vm.createContext(sandboxContextObject);

      if (!role.closures[path].test) {
        try {
          sandboxScript = new vm.Script('(function ($request, $currentUserId, args) { ' +
            actionRights.test +
            '\nreturn false;\n })($request, $currentUserId, args)');

          role.closures[path].test = sandboxScript;
        }
        catch (err) {
          message = `Error parsing closure rights for role ${role._id} (${path.join('/')}): ${actionRights.test}`;

          kuzzle.pluginsManager.trigger('log:error', message);
          error = new ParseError(message);
          error.details = err;

          return Promise.reject(error);
        }
      }

      return role.closures[path].test.runInContext(sandboxContext);
    })
    .then(result => {
      if (! _.isBoolean(result)) {
        message = `Error during rights action closure execution (${path.join('/')}): ${actionRights.test}`;

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
 * @param {Kuzzle} kuzzle
 * @param {object} argsDefinitions
 * @returns {Promise}
 */
function buildArgsForContext (kuzzle, argsDefinitions) {
  if (Object.keys(argsDefinitions).length > 0) {
    return buildClosureArgs(kuzzle, argsDefinitions);
  }

  return Promise.resolve({});
}

/**
 * @param {Kuzzle} kuzzle
 * @param {object} argsDefinitions
 * @returns {Promise}
 */
function buildClosureArgs (kuzzle, argsDefinitions) {
  var argsFunctions = {};

  // Build the object that will be passed to parallel
  _.forEach(argsDefinitions, (argDefinition, argName) => {
    argsFunctions[argName] = factoryFunctionClosure(kuzzle, argName, argDefinition);
  });

  return new Promise(resolve => {
    async.parallel(argsFunctions, (error, results) => {
      if (error) {
        // In case we have an error we want to return an empty object because the error can come from storageEngine
        return resolve({});
      }

      resolve(results);
    });
  });
}

/**
 * Returns a function built for async.parallel with the right action on storageEngine
 *
 * @param {Kuzzle} kuzzle
 * @param {string} argName - the argument name set by user (i.e.: document, documents...)
 * @param {object} argDefinition - definition set by user. Like {collection: 'messages', index: 'chat', action: { get: '$currentId' }}
 * @returns {Function} the function that will execute a get/mget/search on storageEngine
 */
function factoryFunctionClosure (kuzzle, argName, argDefinition) {
  var methodName;

  if (!argDefinition.collection || !argDefinition.index || !argDefinition.action || Object.keys(argDefinition.action).length === 0) {
    kuzzle.pluginsManager.trigger('log:error', `Bad format in closure rights for ${argName}`);
    return callback => callback(null, {});
  }

  methodName = Object.keys(argDefinition.action)[0];

  if (['get', 'mget', 'search'].indexOf(methodName) === -1) {
    kuzzle.pluginsManager.trigger('log:error', `Try to use an unauthorized function (${methodName}) in closure rights check`);
    return callback => callback(null, {});
  }

  return callback => {
    var request = new Request({
      action: methodName,
      collection: argDefinition.collection,
      index: argDefinition.index
    });

    if (methodName === 'mget') {
      request.input.body = {
        ids: argDefinition.action[methodName]
      };
    }
    else if (methodName === 'search') {
      request.input.body = argDefinition.action[methodName];
    }
    else if (methodName === 'get') {
      request.input.resource._id = argDefinition.action[methodName];
    }

    kuzzle.services.list.storageEngine[methodName](request)
      .then(response => {
        if (response.hits) {
          return callback(null, response.hits.map(document => {
            return {content: document._source, id: document._id};
          }));
        }

        callback(null, {content: response._source, id: response._id});
      })
      .catch((e) => {
        kuzzle.pluginsManager.trigger('log:error', `Error during storageEngine execution for ${methodName} with ${JSON.stringify(argDefinition)}: ${e.message}`);
        return callback(null, {});
      });
  };
}
