var
  _ = require('lodash'),
  q = require('q'),
  async = require('async'),
  vm = require('vm'),
  BadRequestError = require('../../errors/badRequestError'),
  RequestObject = require('../requestObject'),
  InternalError = require('../../errors/internalError'),
  ParseError = require('../../errors/parseError'),
  Sandbox = require('../../sandbox'),
  internalIndex = require('rc')('kuzzle').internalIndex;

function Role () {
  this.controllers = {};
  this.closures = {};
}

function doesIndexExist(requestObject, indexes) {
  return indexes && indexes[requestObject.index] !== undefined;
}

function doesCollectionExist(requestObject, indexes) {
  return indexes && _.includes(indexes[requestObject.index], requestObject.collection);
}

function isInternalIndexAllowed(restrictions) {
  var
    isAllowed = false;

  async.some(restrictions, (restriction, callback) => {
      callback(restriction.index === internalIndex);
  }, result => {
    isAllowed = result;
  });
  return isAllowed;
}

/**
 * @param requestObject
 * @param context - user's context
 * @param restrictions - role's restrictions on indexes/collections
 * @param {Kuzzle} kuzzle
 *
 * @returns {Promise}
 */
Role.prototype.isActionAllowed = function (requestObject, context, restrictions, kuzzle) {
  var
    controllerRights,
    actionRights,
    path = [];

  // explicit actions on internalIndex must be denied if no explicit restriction on internalIndex is set:
  if (requestObject.index === internalIndex && !isInternalIndexAllowed(restrictions)) {
    return q(false);
  }

  if (this.controllers === undefined) {
    return q(false);
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

  if (_.isBoolean(actionRights) || _.isObject(actionRights)) {
    // the role configuration is an object with a function in attribute `test`. We assume it can be (almost) safely run
    // as it should have previously been validated during creation.

    return executeClosure.call(this, kuzzle, path, actionRights, requestObject, context)
    .then(actionRights => {
      if (! actionRights) {
        return q(false);
      }
      // the role configuration is true. We check if it matches restrictions on indexes/collections.
      return checkRestrictions(requestObject, restrictions);
    });
  }

  return q.reject(new InternalError('Invalid rights given for role ' + this._id + '(' + path.join('/') + ') : ' + actionRights));
};

/**
 * @param {Object} context
 * @returns {*}
 */
Role.prototype.validateDefinition = function (context) {
  var
    deferred = q.defer(),
    promises = [];

  if (!_.isObject(this.controllers)) {
    return q.reject(new BadRequestError('The "controllers" definition must be an object'));
  }
  if (_.isEmpty(this.controllers)) {
    return q.reject(new BadRequestError('The "controllers" definition cannot be empty'));
  }

  Object.keys(this.controllers).every(controllerKey => {
    var controllerRights = this.controllers[controllerKey];

    if (!_.isObject(controllerRights)) {
      deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. Must be an object'));
      return false;
    }
    if (_.isEmpty(controllerRights)) {
      deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. Cannot be empty'));
      return false;
    }
    if (controllerRights.actions === undefined) {
      deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute missing'));
      return false;
    }
    if (!_.isObject(controllerRights.actions)) {
      deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute must be an object'));
      return false;
    }
    if (_.isEmpty(controllerRights.actions)) {
      deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey] + '. `actions` attribute cannot be empty'));
      return false;
    }

    Object.keys(controllerRights.actions).every(actionKey => {
      var actionRights = controllerRights.actions[actionKey];

      if (!_.isBoolean(actionRights) && !_.isObject(actionRights)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [controllerKey, actionKey] + '. Must be a boolean or an object'));
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
          .then(result => {
            var error;

            if (result.result !== undefined && _.isBoolean(result.result)) {
              return q(result.result);
            }

            error = new BadRequestError('Invalid definition for '+ [controllerKey, actionKey] + '. Error executing function');
            error.detail = result.err;

            return q.reject(error);
          });
        })());
      }

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
 * @param {RequestObject} the requestObject
 * @param {Array} restrictions list
 * @returns {Promise} resolves to a Boolean value
 */
function checkRestrictions(requestObject, restrictions) {
  var isAllowed = false;

  // If no restrictions, we allow the action:
  if (_.isEmpty(restrictions)) {
    return q(true);
  }

  // If the request's action does not refer to an index, restrictions are useless for this action (=> ignore them):
  if (!requestObject.index || requestObject.index === null || requestObject.index === undefined) {
    return q(true);
  }

  async.some(restrictions, (restriction, callback) => {
      callback(checkIndexRestriction(requestObject, restriction));
  }, result => {
    isAllowed = result;
  });

  return q(isAllowed);
}

/**
 * @param {RequestObject} requestObject
 * @param {Object} a restriction object on an index
 * @returns {Boolean}
 */
function checkIndexRestriction(requestObject, restriction) {
  if (restriction.index !== requestObject.index) {
    return false;
  }

  // if no collections given on the restriction, the action is allowed for all collections:
  if (_.isEmpty(restriction.collections)) {
    return true;
  }

  // If the request's action does not refer to a collcetion, the restriction is useless for this action (=> ignored):
  if (!requestObject.collection || requestObject.collection === null || requestObject.collection === undefined ) {
    return true;
  }

  return _.includes(restriction.collections, requestObject.collection);
}

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
    argsDefinitions = {},
    message;

  if (_.isBoolean(actionRights)) {
    return q(actionRights);
  }

  if (this.closures[path] === undefined) {
    this.closures[path] = {};
  }

  if (actionRights.args && !_.isEmpty(actionRights.args) && !this.closures[path].getArgsDefinitions) {
    try {
      /* jshint evil: true */
      /* eslint-disable no-eval */
      this.closures[path].getArgsDefinitions = global.eval('(function (requestObject) {return ' +
        JSON
          .stringify(actionRights.args)
          .replace(/"\$(requestObject\.data\.[a-zA-Z0-9_\-.]*[a-zA-Z0-9])"/g, '$1')
          .replace('"$currentId"', 'requestObject.data._id') +
        ';})');
      /* jshint evil: false */
      /* eslint-enable no-eval */
    }
    catch (err) {
      error = new ParseError('Error parsing rights for role ' + this._id + ' (' + path.join('/') + ') :' + actionRights);
      error.details = err;

      return q.reject(error);
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
        $currentUserId: context.token.user._id,
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

          return q.reject(error);
        }
      }

      return this.closures[path].test.runInContext(sandboxContext);
    })
    .catch((err) => {
      message = `Error during executing rights action closure (${path.join('/')}): ${err.message}`;

      kuzzle.pluginsManager.trigger('log:error', message);
      error = new ParseError(message);
      error.details = err;

      return q.reject(error);
    });
}

/**
 *
 * @param argsDefinitions
 * @returns {Promise}
 */
function buildArgsForContext (argsDefinitions) {
  if (!_.isEmpty(argsDefinitions)) {
    return buildClosureArgs.call(this, argsDefinitions);
  }

  return q({});
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
