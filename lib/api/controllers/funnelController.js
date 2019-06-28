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
  AdminController = require('./adminController'),
  {
    errors: {
      BadRequestError,
      ForbiddenError,
      KuzzleError,
      PluginImplementationError,
      ServiceUnavailableError,
      UnauthorizedError
    }
  } = require('kuzzle-common-objects');

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
    this.controllers.admin = new AdminController(this.kuzzle);

    const initPromises = Object.keys(this.controllers)
      .map(ctrl => this.controllers[ctrl].init());

    return Bluebird.all(initPromises);
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
        this.kuzzle.emit('core:overload', overloadPercentage);
        this.kuzzle.log.warn(`[!WARNING!] Kuzzle overloaded: ${overloadPercentage}%. Delaying requests...`);

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // resolves the callback immediately if a slot is available
    if (this.concurrentRequests < this.kuzzle.config.limits.concurrentRequests) {
      if (this.requestsCacheById[request.internalId]) {
        delete this.requestsCacheById[request.internalId];
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

      this.kuzzle.log.error(error);
      request.setError(error);
      return false;
    }

    if (!this.requestsCacheById[request.internalId]) {
      this.requestsCacheById[request.internalId] = new CacheItem(executor, request, executeCallback);
      this.requestsCacheQueue.push(request.internalId);

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
      .then(processResult => {
        callback(null, processResult);

        // disables a bluebird warning in dev. mode triggered when
        // a promise is created and not returned
        return null;
      })
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
    const handledErrors = this.kuzzle.config.dump.handledErrors;

    if (this.kuzzle.config.dump.enabled && handledErrors.enabled) {
      setImmediate(() => {
        const errorType = typeof err === 'object' && err.name ?
          err.name :
          typeof err;

        if (handledErrors.whitelist.indexOf(errorType) > -1) {
          const now = Date.now();

          // JSON.stringify(new NativeError()) === '{}'
          // i.e. Error, SyntaxError, TypeError, ReferenceError, etc.
          this.kuzzle.log.error(
            err instanceof Error && !(err instanceof KuzzleError) ?
              err.message + '\n' + err.stack :
              err);

          if (
            !this.lastDumpedErrors[errorType] ||
            this.lastDumpedErrors[errorType] < now - handledErrors.minInterval
          ) {
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

            this.kuzzle.janitor.dump(
              `handled-${errorType.toLocaleLowerCase()}-${errorMessage}`);
          }

          this.lastDumpedErrors[errorType] = now;
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

          return this.kuzzle.pipe('request:onUnauthorized', request)
            .finally(() => Bluebird.reject(error));
        }

        return this.kuzzle.pipe('request:onAuthorized', request);
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
    const controller = this.getController(request);

    this.kuzzle.statistics.startRequest(request);
    this.concurrentRequests++;

    let modifiedRequest = request;

    return this.kuzzle.pipe(this.getEventName(request, 'before'), request)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return doAction(controller, newRequest);
      })
      .then(responseData => {
        modifiedRequest.setResult(responseData, {status: request.status === 102 ? 200 : request.status});

        if (!this.isNativeController(modifiedRequest) && !modifiedRequest.response.raw) {
          // check if the plugin response can be serialized
          try {
            JSON.stringify(responseData);
          }
          catch (e) {
            modifiedRequest.setResult(null);
            throw new PluginImplementationError('Unable to serialize response. Are you trying to return the request?');
          }
        }

        return this.kuzzle.pipe(this.getEventName(request, 'after'), modifiedRequest);
      })
      .then(newRequest => this.kuzzle.pipe('request:onSuccess', newRequest))
      .then(newRequest => {
        this.kuzzle.statistics.completedRequest(request);
        return newRequest;
      })
      .catch(error => this.handleProcessRequestError(modifiedRequest, request, error))
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
   *   - the overload protection mechanism is disabled
   *
   * @param {Request} request
   * @returns {Promise}
   */
  executePluginRequest(request) {
    return Bluebird.resolve()
      .then(() => doAction(this.getController(request), request))
      .catch(e => {
        this.handleErrorDump(e);
        return Bluebird.reject(e);
      });
  }

  handleProcessRequestError(modifiedRequest, request, error) {
    let _error = error;
    const eventError = this.getEventName(modifiedRequest, 'error');

    if (!this.isNativeController(request) && !(error instanceof KuzzleError)) {
      _error = new PluginImplementationError(error);
    }
    modifiedRequest.setError(_error);

    return this.kuzzle.pipe(eventError, modifiedRequest)
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

        if (!this.isNativeController(request)
          && !(customError instanceof KuzzleError)) {
          _error = new PluginImplementationError(customError);
        }

        modifiedRequest.setError(_error);
        this.kuzzle.statistics.failedRequest(request);

        return this.kuzzle.pipe('request:onError', modifiedRequest)
          .then(modifiedRequestError => {
            if (modifiedRequestError !== modifiedRequest) {
              return modifiedRequestError;
            }

            return Bluebird.reject(modifiedRequest.error);
          })
          .catch(err => {
            if (err instanceof KuzzleError) {
              throw err;
            }

            throw new PluginImplementationError(err);
          });
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

    return event + ':' + prefix + capitalize(request.input.action);
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
   * Return the controller corresponding to the action asked by the request
   *
   * @param  {Request} request
   * @return {Object} controller object
   * @throws {BadRequestError} If the asked controller or action is unknown
   */
  getController(request) {
    const {controller, action} = request.input;

    let target;

    if (this.controllers[controller]) {
      if (this.controllers[controller].isAction(action)) {
        target = this.controllers[controller];
      }
    } else if (this.pluginsControllers[controller]) {
      if (this.pluginsControllers[controller][action]) {
        target = this.pluginsControllers[controller];
      }
    } else {
      throw new BadRequestError(`Unknown controller ${controller}`);
    }

    if (!target) {
      throw new BadRequestError(
        `No corresponding action ${action} in controller ${controller}`);
    }

    return target;
  }

  /**
   * Tell if the request accesses to a native controller or not
   * @param  {Request}  request
   * @return {Boolean}
   */
  isNativeController(request) {
    return Boolean(this.controllers[request.input.controller]);
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
        this.kuzzle.log.info('End of overloaded state. Resuming normal activity.');
        this.lastOverloadTime = now;
      }
    }
  }
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Execute a controller action, checking that its return
 * value is a Promise. If not, wraps the returned value
 * in a rejected Promise and returns it.
 *
 * Used to make Kuzzle safe from badly implemented plugins
 *
 * @param  {Object} controller
 * @param  {Request} request
 * @return {Promise}
 */
function doAction(controller, request) {
  const ret = controller[request.input.action](request);

  if (!ret || typeof ret.then !== 'function') {
    return Bluebird.reject(new PluginImplementationError(`Unexpected return value from action ${request.input.controller}/${request.input.action}: expected a Promise`));
  }

  return ret;
}

module.exports = FunnelController;
