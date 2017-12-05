/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  Bluebird = require('bluebird'),
  Deque = require('denque'),
  AuthController = require('./authController'),
  BulkController = require('./bulkController'),
  CollectionController = require('./collectionController'),
  DocumentController = require('./documentController'),
  IndexController = require('./indexController'),
  MemoryStorageController = require('./memoryStorageController'),
  RealtimeController = require('./realtimeController'),
  SecurityController = require('./securityController'),
  ServerController = require('./serverController'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    ForbiddenError,
    KuzzleError,
    PluginImplementationError,
    ServiceUnavailableError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

/**
 * @class CacheItem
 */
class CacheItem {
  constructor(executor, request, callback) {
    this.request = request;
    this.callback = callback;
    this.executor = executor;
  }
}

/**
 * @class FunnelController
 * @property {object} controllers
 * @param {Kuzzle} kuzzle
 */
class FunnelController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.overloaded = false;
    this.concurrentRequests = 0;
    this.controllers = {};
    this.pluginsControllers = {};
    this.requestsCacheQueue = new Deque();
    this.requestsCacheById = {};
    this.lastOverloadTime = 0;
    this.overloadWarned = false;
    this.lastWarningTime = 0;

    this.lastDumpedErrors = {};

    // used only for core-dump analysis
    this.requestHistory = new Deque();
    this.historized = 0;
  }

  init() {
    this.controllers.auth = new AuthController(this.kuzzle);
    this.controllers.bulk = new BulkController(this.kuzzle);
    this.controllers.collection = new CollectionController(this.kuzzle);
    this.controllers.document = new DocumentController(this.kuzzle);
    this.controllers.index = new IndexController(this.kuzzle);
    this.controllers.memoryStorage = this.controllers.ms = new MemoryStorageController(this.kuzzle);
    this.controllers.realtime = new RealtimeController(this.kuzzle);
    this.controllers.security = new SecurityController(this.kuzzle);
    this.controllers.server = new ServerController(this.kuzzle);

    return Bluebird.resolve();
  }

  loadPluginControllers() {
    this.pluginsControllers = this.kuzzle.pluginsManager.getPluginControllers();
  }

  /**
   * Asks the overload-protection system for a request slot.
   *
   * Returns immediately a truthy value if the request can be
   * executed.
   * 
   * Otherwise, a falsey value is returned, and the caller MUST
   * stop the request execution. 
   * In this case:
   *   - if it can be bufferized, then the request is left untouched
   *     and the executor function will be called later when a slot
   *     becomes available
   *   - if the buffer limit has been reached, a ServiceUnavailable error 
   *     is set to the request. In that case, the executor is free to 
   *     retry submitting the request later, or to abort it and return 
   *     the request as it is
   *
   * @param {String} executor - The name of the function to use to execute the provided 
   *                            request. Must be an exposed function of this object.
   * @param {Request} request - Can be mutated in case of overload error
   * @param {Function} executeCallback - the original callback given to `execute`
   * @returns {boolean}
   */
  getRequestSlot(executor, request, executeCallback) {
    if (this.overloaded) {
      const now = Date.now();

      if (this.requestsCacheQueue.length > this.kuzzle.config.limits.requestsBufferWarningThreshold
        && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)
      ) {
        const overloadPercentage = Math.round(10000 * this.requestsCacheQueue.length / this.kuzzle.config.limits.requestsBufferSize) / 100;
        this.kuzzle.pluginsManager.trigger('core:overload', overloadPercentage);
        this.kuzzle.pluginsManager.trigger('log:warn', `[!WARNING!] Kuzzle overloaded: ${overloadPercentage}%. Delaying requests...`);

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // resolves the callback immediately if a slot is available
    if (this.concurrentRequests < this.kuzzle.config.limits.concurrentRequests) {
      if (this.requestsCacheById[request.id]) {
        delete this.requestsCacheById[request.id];
      }
      return true;
    }

    /*
     If kuzzle is overloaded, check the requests cache.
     There are two possibilities:

     1- the cache limit has not been reached: the request is cached
     and will be played as soon as the config.limits.concurrentRequests
     property allows it

     2- the number of cached requests is equal to the requestsBufferSize property.
     The request is then discarded and an error is returned to the sender
     */
    if (this.requestsCacheQueue.length >= this.kuzzle.config.limits.requestsBufferSize) {
      const error = new ServiceUnavailableError('Request discarded: Kuzzle Server is temporarily overloaded');

      this.kuzzle.pluginsManager.trigger('log:error', error);
      request.setError(error);
      return false;
    }

    if (!this.requestsCacheById[request.id]) {
      this.requestsCacheById[request.id] = new CacheItem(executor, request, executeCallback);
      this.requestsCacheQueue.push(request.id);

      if (!this.overloaded) {
        this.overloaded = true;

        /*
         /!\ Invoking this function here with setTimeout() leads to V8 deoptimizing
         the entire getRequestSlot method (as of node.js 6.9.1),
         because of an "out of bounds" heuristic error (caused by node's
         setTimeout code written in JS? this needs further investigations)

         We get better performances by keeping this method optimized by crankshaft
         even if this means executing this function once for nothing each
         time we start overload mode.
         */
        this._playCachedRequests();
      }
    }

    return false;
  }

  /**
   * Execute the API request by 
   * 1/ asking for a request slot,
   * 2/ verify that the user is still connected
   * 3/ checking if the requesting user has the right credentials
   * 4/ send the request itself to the corresponding controller+action
   *
   * @param {Request} request
   * @param {Function} callback
   * @returns {Number} -1: request delayed, 0: request processing, 1: error 
   */
  execute(request, callback) {
    const processNow = this.getRequestSlot('execute', request, callback);

    if (request.error) {
      // "handleErrorDump" shouldn't need to be called for 503 errors
      callback(request.error, request);
      return 1;
    }
    // request has been cached. Do not process now
    if (!processNow) {
      return -1;
    }

    // if the connection is closed there is no need to execute the request
    // => discarding it
    if (!this.kuzzle.router.isConnectionAlive(request.context)) {
      return 0;
    }

    this.checkRights(request)
      .then(modifiedRequest => this.processRequest(modifiedRequest))
      .then(processResult => callback(null, processResult))
      .catch(err => this._executeError(err, request, true, callback));

    return 0;
  }

  /**
   * Used by mXX actions - Same as execute but bypasses permissions checks
   * @param {Request} request
   * @param {Function} callback
   * @returns {Number} -1: request delayed, 0: request processing, 1: error while trying to get the request slot
   */
  mExecute(request, callback) {
    const processNow = this.getRequestSlot('mExecute', request, callback);

    if (request.error) {
      callback(null, request);
      return 1;
    }

    if (!processNow) {
      return -1;
    }

    this.processRequest(request)
      .then(response => callback(null, response))
      .catch(err => this._executeError(err, request, false, callback));

    return 0;
  }

  /**
   * Checks if an error is worth dumping Kuzzle. If so,
   * creates a dump.
   *
   * @param {KuzzleError|*} err
   */
  handleErrorDump(err) {
    if (this.kuzzle.config.dump.enabled && this.kuzzle.config.dump.handledErrors.enabled) {
      setImmediate(() => {
        const
          lastSeen = Date.now(),
          errorType = typeof err === 'object' && err.name ? err.name : typeof err;

        if (this.kuzzle.config.dump.handledErrors.whitelist.indexOf(errorType) > -1) {
          const request = new Request({
            controller: 'actions',
            action: 'dump',
            body: {}
          });

          // JSON.stringify(new NativeError()) === '{}', i.e. Error, SyntaxError, TypeError, ReferenceError, etc.
          this.kuzzle.pluginsManager.trigger('log:error', err instanceof Error && !(err instanceof KuzzleError)
            ? err.message + '\n' + err.stack
            : err
          );

          // simplify error message to use it in folder dump name
          let errorMessage = err.message;

          if (errorMessage.indexOf('\n') > -1) {
            errorMessage = errorMessage.split('\n')[0];
          }

          errorMessage = errorMessage
            .toLowerCase()
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/[-]+/g, '-')
            .split('-')
            .filter(value => value !== '')
            .join('-');

          request.input.args.suffix = `handled-${errorType.toLocaleLowerCase()}-${errorMessage}`;

          if (!this.lastDumpedErrors[errorType] || this.lastDumpedErrors[errorType] < lastSeen - this.kuzzle.config.dump.handledErrors.minInterval) {
            this.kuzzle.cliController.actions.dump(request);
            this.lastDumpedErrors[errorType] = lastSeen;
          }
        }
      });
    }
  }

  /**
   * Checks if a user has the necessary rights to execute the action
   *
   * @param {Request} request
   * @return {Promise<Request>}
   */
  checkRights(request) {
    return this.kuzzle.repositories.token.verifyToken(request.input.jwt)
      .then(userToken => {
        request.context.token = userToken;

        return this.kuzzle.repositories.user.load(request.context.token.userId);
      })
      .then(user => {
        request.context.user = user;

        return user.isActionAllowed(request);
      })
      .then(isAllowed => {
        if (!isAllowed) {
          let error;

          // anonymous user => we throw a 401 (Unauthorized) error
          if (request.context.token.userId === -1) {
            error = new UnauthorizedError(`Unauthorized action [${request.input.resource.index}/${request.input.resource.collection}/${request.input.controller}/${request.input.action}] for anonymous user`);
          }
          else {
            // logged-in user with insufficient permissions => we throw a 403 (Forbidden) error
            error = new ForbiddenError(`Forbidden action [${request.input.resource.index}/${request.input.resource.collection}/${request.input.controller}/${request.input.action}] for user ${request.context.user._id}`);
          }

          request.setError(error);

          return this.kuzzle.pluginsManager.trigger('request:onUnauthorized', request)
            .finally(() => Bluebird.reject(error));
        }

        return this.kuzzle.pluginsManager.trigger('request:onAuthorized', request);
      });
  }

  /**
   * Executes the request immediately.
   * /!\ To be used only by methods having already passed the overload check.
   *
   * @param {KuzzleRequest} request
   * @return {Promise}
   */
  processRequest(request) {
    const controllers = this.getControllers(request);

    this.kuzzle.statistics.startRequest(request);
    this.concurrentRequests++;
    this._historize(request);

    let modifiedRequest = request;

    return this.kuzzle.pluginsManager.trigger(this.getEventName(request, 'before'), request)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return callController(controllers, newRequest);
      })
      .then(responseData => {
        modifiedRequest.setResult(responseData, {status: request.status === 102 ? 200 : request.status});

        return this.kuzzle.pluginsManager.trigger(this.getEventName(request, 'after'), modifiedRequest);
      })
      .then(newRequest => this.kuzzle.pluginsManager.trigger('request:onSuccess', newRequest))
      .then(newRequest => {
        this.kuzzle.statistics.completedRequest(request);
        return newRequest;
      })
      .catch(error => this.handleProcessRequestError(modifiedRequest, request, controllers, error))
      .finally(() => {
        this.concurrentRequests--;
      });
  }

  /**
   * Exposes API requests execution to plugins
   * 
   * Similar to execute, except that:
   *   - plugin requests do not trigger API events
   *   - plugin requests are not counted towards requests statistics
   *   - plugins can choose to disable the overload protection mechanism
   *   
   * @param {Request} request 
   * @param {boolean} overloadProtect
   * @param {Function} callback
   * @returns {Number} -1: delayed, 0: processing, 1: error
   */
  executePluginRequest(request, overloadProtect, callback) {
    request.clearError();
    request.status = 102;
    
    let controllers;

    try {
      controllers = this.getControllers(request);
    }
    catch(e) {
      callback(e);
      return 1;
    }

    if (overloadProtect) {
      const processNow = this.getRequestSlot('executePluginRequest', request, callback);

      if (request.error) {
        callback(request.error);
        return 1;
      }

      if (!processNow) {
        return -1;
      }
    }

    this._historize(request);

    Bluebird.resolve()
      .then(() => callController(controllers, request))
      .then(response => {
        request.setResult(response, {status: request.status === 102 ? 200 : request.status});
        callback(null, request);
        return null;
      })
      .catch(e => {
        request.setError(e);
        this.handleErrorDump(e);
        callback(e);
        return null;
      });

    return 0;
  }

  handleProcessRequestError(modifiedRequest, request, controllers, error) {
    let _error = error;
    const eventError = this.getEventName(modifiedRequest, 'error');

    if (controllers === this.pluginsControllers && !(error instanceof KuzzleError)) {
      _error = new PluginImplementationError(error);
    }
    modifiedRequest.setError(_error);

    return this.kuzzle.pluginsManager.trigger(eventError, modifiedRequest)
      .then(modifiedRequestError => {
        // If there is no pipe attached on this event, the same request is passed in resolve and we should reject it
        if (modifiedRequestError.error !== null) {
          return Bluebird.reject(modifiedRequest.error);
        }

        this.kuzzle.statistics.completedRequest(request);
        return modifiedRequestError;
      })
      .catch(customError => {
        _error = customError;

        if (controllers === this.pluginsControllers && !(customError instanceof KuzzleError)) {
          _error = new PluginImplementationError(customError);
        }

        modifiedRequest.setError(_error);
        this.kuzzle.statistics.failedRequest(request);

        return this.kuzzle.pluginsManager.trigger('request:onError', modifiedRequest)
          .then(modifiedRequestError => {
            if (modifiedRequestError !== modifiedRequest) {
              return modifiedRequestError;
            }

            return Bluebird.reject(modifiedRequest.error);
          })
          .catch(() => Bluebird.reject(_error));
      });
  }

  /**
   * Helper function meant to normalize event names
   * by retrieving controller aliases' original names.
   *
   * @param {Request} Executed request
   * @param {string} prefix - event prefix
   * @returns {string} event name
   */
  getEventName (request, prefix) {
    const event = request.input.controller === 'memoryStorage' ? 'ms' : request.input.controller;

    return event + ':' + prefix + capitalizeFirstLetter(request.input.action);
  }

  /**
   * Returns the number of remaining requests
   *
   * @returns {number}
   */
  get remainingRequests () {
    return this.concurrentRequests + this.requestsCacheQueue.length;
  }

  /**
   * Returns the controllers object corresponding to the action asked
   * by the request
   *  
   * @param  {Request} request
   * @return {Object} controllers object
   * @throws {BadRequestError} If the asked controller or action is unknown
   */
  getControllers(request) {
    let controllers;

    if (this.controllers[request.input.controller]) {
      controllers = this.controllers;
    }
    else if (this.pluginsControllers[request.input.controller]) {
      controllers = this.pluginsControllers;
    }
    else {
      throw new BadRequestError(`Unknown controller ${request.input.controller}`);
    }

    const action = controllers[request.input.controller][request.input.action];

    if (!action || typeof action !== 'function') {
      throw new BadRequestError(`No corresponding action ${request.input.action} in controller ${request.input.controller}`);
    }

    return controllers;
  }

  /**
   * Populates the given request with the error and calls the callback
   *
   * @param {Error} error
   * @param {Request} request
   * @param {boolean} asError - if set to true, calls the callback with its first argument as error
   * @param {Function} callback
   * @returns {null}
   * @private
   */
  _executeError (error, request, asError, callback) {
    request.setError(error);

    if (asError) {
      callback(error, request);
      this.handleErrorDump(error);
    }
    else {
      callback(null, request);
    }

    return null;
  }

  /**
   * Background task. Checks if there are any requests in cache, and replay them
   * if Kuzzle is not overloaded anymore,
   */
  _playCachedRequests () {
    // If there is room to play bufferized requests, do it now. If not, retry later
    const quantityToInject = Math.min(this.requestsCacheQueue.length, this.kuzzle.config.limits.concurrentRequests - this.concurrentRequests);

    if (quantityToInject > 0) {
      let i; // perf cf https://jsperf.com/bvidis-for-oddities - NOSONAR
      for (i = 0; i < quantityToInject; i++) {
        const cachedItem = this.requestsCacheById[this.requestsCacheQueue.peekFront()];
        if (this[cachedItem.executor](cachedItem.request, cachedItem.callback) === -1) {
          // no slot found again. We stop here and try next time
          break;
        }
        else {
          this.requestsCacheQueue.shift();
        }
      }
    }

    if (this.requestsCacheQueue.length > 0) {
      setTimeout(() => this._playCachedRequests(), 0);
    }
    else {
      const now = Date.now();
      // No request remaining in cache => stop the background task and return to normal behavior
      this.overloaded = false;

      if (this.overloadWarned && (this.lastOverloadTime === 0 || this.lastOverloadTime < now - 500)) {
        this.overloadWarned = false;
        this.kuzzle.pluginsManager.trigger('log:info', 'End of overloaded state. Resuming normal activity.');
        this.lastOverloadTime = now;
      }
    }
  }

  /**
   * Push a request in the history queue, for debugging purposes
   * 
   * @param  {Request} request 
   */
  _historize (request) {
    if (this.historized > this.kuzzle.config.limits.requestsHistorySize) {
      this.requestHistory.shift();
    }
    else {
      this.historized++;
    }

    this.requestHistory.push(request);
  }
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Invoke a controller function, checking that its return
 * value is a Promise. If not, wraps the returned value
 * in a rejected Promise and returns it.
 * 
 * Used to make Kuzzle safe from badly implemented plugins
 * 
 * @param  {Object} controllers
 * @param  {Request} request 
 * @return {Promise}
 */
function callController(controllers, request) {
  const ret = controllers[request.input.controller][request.input.action](request);

  if (!ret || typeof ret.then !== 'function') {
    return Bluebird.reject(new PluginImplementationError(`Unexpected return value from action ${request.input.controller}/${request.input.action}: expected a Promise`));
  }

  return ret;
}

module.exports = FunnelController;
