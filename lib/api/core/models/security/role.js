/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  Sandbox = require('../../sandbox'),
  vm = require('vm'),
  {
    BadRequestError,
    InternalError: KuzzleInternalError,
    PreconditionError
  } = require('kuzzle-common-objects').errors;

const
  _kuzzle = Symbol.for('_kuzzle');

/**
 * @class Role
 */
class Role {
  constructor () {
    this.controllers = {};

    // closures are computed for internal use only.
    this.closures = {};
  }

  /**
   * @param {Request} request
   * @param {Array} restrictedTo
   * @return {Promise.<boolean>}
   */
  isActionAllowed (request, restrictedTo = []) {
    if (!this[_kuzzle]) {
      throw new PreconditionError(`Cannot check permissions on uninitialized role ${this._id}`);
    }

    let
      controllerRights,
      actionRights;
    const
      promises = [],
      path = [];

    if (this.controllers === undefined) {
      return Bluebird.resolve(false);
    }

    // @deprecated - the "memoryStorage" alias should be removed in the next major version
    // Handles the memory storage controller aliases: ms, memoryStorage
    if ((request.input.controller === 'ms' || request.input.controller === 'memoryStorage') && (this.controllers.ms || this.controllers.memoryStorage)) {
      controllerRights = this.controllers.ms || this.controllers.memoryStorage;
      path.push('ms');
    }
    else if (this.controllers[request.input.controller] !== undefined) {
      controllerRights = this.controllers[request.input.controller];
      path.push(request.input.controller);
    }
    else if (this.controllers['*'] !== undefined) {
      controllerRights = this.controllers['*'];
      path.push('*');
    }
    else {
      return Bluebird.resolve(false);
    }

    if (controllerRights.actions === undefined) {
      return Bluebird.resolve(false);
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
      return Bluebird.resolve(false);
    }

    if (typeof actionRights === 'boolean') {
      promises.push(actionRights);
    }
    else if (typeof actionRights === 'object' && actionRights !== null) {
      promises.push(executeClosure(this, this[_kuzzle], path, actionRights, request));
    }
    else {
      return Bluebird.reject(new KuzzleInternalError(`Invalid rights given for role ${this._id}(${path.join('/')}) : ${actionRights}`));
    }

    promises.push(checkRestrictions(request, restrictedTo));

    return Bluebird.all(promises)
      .then(results => results.every(r => r));
  }

  /**
   * @returns {Promise.<boolean>}
   */
  validateDefinition () {
    if (typeof this.controllers !== 'object' || this.controllers === null) {
      return Bluebird.reject(new BadRequestError('The "controllers" definition must be an object'));
    }
    if (Object.keys(this.controllers).length === 0) {
      return Bluebird.reject(new BadRequestError('The "controllers" definition cannot be empty'));
    }

    return new Bluebird((resolve, reject) => {
      const promises = [];

      const result = Object.keys(this.controllers).every(controllerKey => {
        const controllerRights = this.controllers[controllerKey];

        if (typeof controllerRights !== 'object' || controllerRights === null) {
          reject(new BadRequestError(`Invalid definition for [${controllerKey}]: must be an object`));
          return false;
        }
        if (Object.keys(controllerRights).length === 0) {
          reject(new BadRequestError(`Invalid definition for [${controllerKey}]: cannot be empty`));
          return false;
        }
        if (controllerRights.actions === undefined) {
          reject(new BadRequestError(`Invalid definition for [${controllerKey}]: "actions" attribute missing`));
          return false;
        }
        if (typeof controllerRights.actions !== 'object' || controllerRights.actions === null) {
          reject(new BadRequestError(`Invalid definition for [${controllerKey}]: "actions" attribute must be an object`));
          return false;
        }
        if (Object.keys(controllerRights.actions).length === 0) {
          reject(new BadRequestError(`Invalid definition for [${controllerKey}]: "actions" attribute cannot be empty`));
          return false;
        }

        return Object.keys(controllerRights.actions).every(actionKey => {
          const actionRights = controllerRights.actions[actionKey];

          if (actionRights === null || (['object', 'boolean'].indexOf(typeof actionRights) === -1 || Array.isArray(actionRights))) {
            reject(new BadRequestError(`Invalid definition for [${controllerKey}, ${actionKey}]: must be a boolean or an object`));
            return false;
          }

          if (typeof actionRights === 'object') {
            if (!actionRights.test) {
              reject(new BadRequestError(`Invalid definition for ${[controllerKey, actionKey]}. Permissions defined as closures must have a "test" element.`));
              return false;
            }

            promises.push((() => {
              const sandBox = new Sandbox();

              return sandBox.run({
                sandbox: {
                  $request: new Request({}),
                  $currentUserId: -1,
                  args: {}
                },
                code: `(function ($request, $currentUserId, args) { ${actionRights.test}\nreturn false;\n})($request, $currentUserId, args)`
              })
                .then(response => {
                  if (response.result !== undefined && _.isBoolean(response.result)) {
                    return response.result;
                  }

                  const error = new BadRequestError(`Invalid definition for [${controllerKey}, ${actionKey}]: error executing function`);
                  error.details = result.err;

                  return Bluebird.reject(error);
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
      .then(promises => Bluebird.all(promises))
      .then(() => true);
  }

  /**
   * Checks if current role allows to log in
   *
   * @param {boolean} closureAsYes - If set to true, returns true if the login check is done via a closure
   * @returns {boolean}
   */
  canLogIn (closureAsYes = false) {
    for (const controllerKey of ['auth', '*']) {
      if (this.controllers[controllerKey]) {
        const controller = this.controllers[controllerKey];
        for (const actionKey of ['login', '*']) {
          if (controller.actions[actionKey]) {
            if (typeof controller.actions[actionKey] === 'boolean' && controller.actions[actionKey]) {
              return true;
            }
            if (closureAsYes && controller.actions[actionKey].test) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
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

  return Bluebird.resolve({});
}

/**
 * @param {Kuzzle} kuzzle
 * @param {object} argsDefinitions
 * @returns {Promise}
 */
function buildClosureArgs (kuzzle, argsDefinitions) {
  const result = {};

  return Bluebird.all(Object.keys(argsDefinitions).map(arg => factoryFunctionClosure(kuzzle, arg, argsDefinitions[arg])
    .then(val => {
      result[arg] = val;
    })
  ))
    .then(() => result);
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

  return restriction.collections.indexOf(request.input.resource.collection) > -1;
}

/**
 * @param {Request} request
 * @param {Array} restrictedTo
 * @returns {Boolean} resolves to a Boolean value
 */
function checkRestrictions(request, restrictedTo) {
  // If no restrictions, we allow the action:
  if (restrictedTo.length === 0) {
    return true;
  }

  // If the request's action does not refer to an index, restrictions are useless for this action (=> ignore them):
  if (!request.input.resource.index) {
    return true;
  }

  return restrictedTo.some(restriction => checkIndexRestriction(request, restriction));
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
  let
    error,
    argsDefinitions = {},
    message;
  const pathstr = path.join('/');

  if (typeof actionRights.test !== 'string') {
    error = new BadRequestError(`Error parsing rights for role ${role._id} (${pathstr}) : ${actionRights}`);
    error.details = 'Missing or malformed "test" attribute (string required)';
    return Bluebird.reject(error);
  }

  if (role.closures[pathstr] === undefined) {
    role.closures[pathstr] = {};
  }

  if (actionRights.args && Object.keys(actionRights.args).length > 0 && !role.closures[pathstr].getArgsDefinitions) {
    try {
      const args = JSON.stringify(actionRights.args)
        .replace(/"\$(request\.[a-zA-Z0-9_\-.]*[a-zA-Z0-9])"/g, '$1')
        .replace('"$currentId"', 'request.input.resource._id');

      // eslint-disable-next-line no-eval
      role.closures[pathstr].getArgsDefinitions = global.eval(`(function (request) {return ${args};})`);
    }
    catch (err) {
      error = new BadRequestError(`Error parsing rights for role ${role._id} (${pathstr}) : ${actionRights.args}`);
      error.details = err;

      return Bluebird.reject(error);
    }
  }

  if (role.closures[pathstr].getArgsDefinitions) {
    argsDefinitions = role.closures[pathstr].getArgsDefinitions(request);
  }

  return buildArgsForContext(kuzzle, argsDefinitions)
    .then(args => {
      const sandboxContextObject = {
        args,
        console,
        $request: request,
        $currentUserId: request.context.userId
      };

      const sandboxContext = vm.createContext(sandboxContextObject);

      if (!role.closures[pathstr].test) {
        try {
          role.closures[pathstr].test = new vm.Script(`(function ($request, $currentUserId, args) {
            ${actionRights.test};
            return false;
          })($request, $currentUserId, args)`);
        }
        catch (err) {
          message = `Error parsing closure rights for role ${role._id} (${pathstr}): ${actionRights.test}`;

          kuzzle.log.error(message);
          error = new BadRequestError(message);
          error.details = err;

          return Bluebird.reject(error);
        }
      }

      return role.closures[pathstr].test.runInContext(sandboxContext);
    })
    .then(result => {
      if (typeof result !== 'boolean') {
        message = `Error during rights action closure execution (${pathstr}): ${actionRights.test}`;

        kuzzle.log.error(message);
        error = new BadRequestError(message);
        error.details = `Closure result is not a boolean value: ${result}`;

        return Bluebird.reject(error);
      }

      return result;
    })
    .catch(err => {
      message = `Error during executing rights action closure (${pathstr}): ${err.message}`;

      kuzzle.log.error(message);
      error = new BadRequestError(message);
      error.details = err;

      return Bluebird.reject(error);
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
  if (!argDefinition.collection || !argDefinition.index || !argDefinition.action || Object.keys(argDefinition.action).length === 0) {
    kuzzle.log.error(`Bad format in closure rights for ${argName}`);
    return Bluebird.resolve({});
  }

  const methodName = Object.keys(argDefinition.action)[0];

  if (['get', 'mget', 'search'].indexOf(methodName) === -1) {
    kuzzle.log.error(`Try to use an unauthorized function (${methodName}) in closure rights check`);
    return Bluebird.resolve({});
  }

  const request = new Request({
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

  return kuzzle.services.list.storageEngine[methodName](request)
    .then(response => {
      if (response.hits) {
        return response.hits.map(document => ({
          content: document._source,
          id: document._id
        }));
      }

      return {
        content: response._source,
        id: response._id
      };
    })
    .catch(e => {
      kuzzle.log.error(`Error during storageEngine execution for ${methodName} with ${JSON.stringify(argDefinition)}: ${e.message}`);
      return {};
    });
}

module.exports = Role;


