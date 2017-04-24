/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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

const MIN_TIME_BEFORE_DUMP_PREV_ERROR = 60000;

/**
 * @class CacheItem
 */
class CacheItem {
  constructor(request, callback) {
    this.request = request;
    this.callback = callback;
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
    this.requestsCache = new Deque();
    this.cachedItems = 0;
    this.lastOverloadTime = 0;
    this.overloadWarned = false;
    this.lastWarningTime = 0;

    this.lastDumpedErrors = {};

    // used only for core-dump analysis
    this.pendingRequests = {};

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

    this.pluginsControllers = this.kuzzle.pluginsManager.getPluginControllers();
  }

  /**
   * Asks the overload-protection system for a request slot.
   *
   * Resolves the callback with the provided request once
   * the request can be processed.
   *
   * Rejects it with a ServiceUnavailable error if Kuzzle is overloaded
   * and if the buffer limit has been reached
   *
   * @param {Request} request
   * @param {Function} callback
   */
  getRequestSlot(request, callback) {
    this.pendingRequests[request.id] = request;

    if (this.overloaded) {
      const now = Date.now();

      if ((this.cachedItems > this.kuzzle.config.limits.requestsBufferWarningThreshold) && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)) {
        const overloadPercentage = Math.round(10000 * this.cachedItems / this.kuzzle.config.limits.requestsBufferSize) / 100;
        this.kuzzle.pluginsManager.trigger('core:overload', overloadPercentage);
        this.kuzzle.pluginsManager.trigger('log:warn', `[!WARNING!] Kuzzle overloaded: ${overloadPercentage}%. Delaying requests...`);

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // resolves the callback immediately if a slot is available
    if (this.concurrentRequests < this.kuzzle.config.limits.concurrentRequests) {
      return callback(null);
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
    if (this.cachedItems >= this.kuzzle.config.limits.requestsBufferSize) {
      const error = new ServiceUnavailableError('Request discarded: Kuzzle Server is temporarily overloaded');

      this.kuzzle.pluginsManager.trigger('log:error', error);
      request.setError(error);
      return callback(error);
    }

    this.cachedItems++;
    this.requestsCache.push(new CacheItem(request, callback));

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
      playCachedRequests(this.kuzzle, this);
    }
  }

  /**
   * Execute the API request by 1/ asking for a request slot,
   * 2/ checking if the requesting user has the right credentials
   * and 3/ send the request itself to the corresponding
   * controller+action
   *
   * @param {Request} request
   * @param {Function} callback
   */
  execute(request, callback) {
    this.getRequestSlot(request, overloadError => {
      if (overloadError) {
        // "handleErrorDump" shouldn't need to be called for 503 errors
        return callback(overloadError, request);
      }

      this.checkRights(request)
        .then(modifiedRequest => this.processRequest(modifiedRequest))
        .then(processResult => callback(null, processResult))
        .catch(err => {
          // JSON.stringify(new NativeError()) === '{}', i.e. Error, SyntaxError, TypeError, ReferenceError, etc.
          this.kuzzle.pluginsManager.trigger('log:error', err instanceof Error && !(err instanceof KuzzleError)
            ? err.message + '\n' + err.stack
            : err
          );

          request.setError(err);
          callback(err, request);

          this.handleErrorDump(err);

          return null;
        });

      return null;
    });
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

          // simplify error message to use it in folder dump name
          let errorMessage = err.message;

          if (errorMessage.indexOf('\n') > -1) {
            errorMessage = errorMessage.split('\n')[0];
          }

          errorMessage = errorMessage.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '-').replace(/[-]+/g, '-').split('-');
          errorMessage = errorMessage.filter(value => value !== '').join('-');

          request.input.body.suffix = 'handled-'.concat(errorType.toLowerCase(), '-', errorMessage);

          if (!this.lastDumpedErrors[request.input.body.suffix] || this.lastDumpedErrors[request.input.body.suffix] < lastSeen - MIN_TIME_BEFORE_DUMP_PREV_ERROR) {
            this.kuzzle.cliController.actions.dump(request);
            this.lastDumpedErrors[request.input.body.suffix] = lastSeen;
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

        return user.isActionAllowed(request, this.kuzzle);
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

          return triggerEvent(this.kuzzle, request, 'request:onUnauthorized')
            .finally(() => Bluebird.reject(error));
        }

        return triggerEvent(this.kuzzle, request, 'request:onAuthorized');
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
    let controllers;

    if (this.controllers[request.input.controller]) {
      controllers = this.controllers;
    }
    else if (this.pluginsControllers[request.input.controller]) {
      controllers = this.pluginsControllers;
    }
    else {
      delete this.pendingRequests[request.id];
      throw new BadRequestError(`Unknown controller ${request.input.controller}`);
    }

    const action = controllers[request.input.controller][request.input.action];

    if (!action || typeof action !== 'function') {
      delete this.pendingRequests[request.id];
      throw new BadRequestError(`No corresponding action ${request.input.action} in controller ${request.input.controller}`);
    }

    this.kuzzle.statistics.startRequest(request);
    this.concurrentRequests++;

    if (this.historized > this.kuzzle.config.limits.requestsHistorySize) {
      this.requestHistory.shift();
    }
    else {
      this.historized++;
    }

    this.requestHistory.push(request);

    const beforeEvent = this.getEventName(request.input.controller, 'before', request.input.action);
    let modifiedRequest = request;

    return triggerEvent(this.kuzzle, request, beforeEvent)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return controllers[request.input.controller][request.input.action](newRequest);
      })
      .then(responseData => {
        const afterEvent = this.getEventName(request.input.controller, 'after', request.input.action);
        modifiedRequest.setResult(responseData, {status: request.status === 102 ? 200 : request.status});

        return triggerEvent(this.kuzzle, modifiedRequest, afterEvent);
      })
      .then(newRequest => {
        this.kuzzle.statistics.completedRequest(request);

        // do not trigger global events on plugins' subrequests
        if (newRequest.origin === null) {
          return triggerEvent(this.kuzzle, newRequest, 'request:onSuccess');
        }

        return newRequest;
      })
      .catch(error => {
        let _error = error;

        this.kuzzle.statistics.failedRequest(request);

        if (controllers === this.pluginsControllers && !(error instanceof KuzzleError)) {
          _error = new PluginImplementationError(error);
        }

        // do not trigger global events on plugins' subrequests
        if (modifiedRequest.origin === null) {
          return triggerEvent(this.kuzzle, modifiedRequest, 'request:onError')
            .finally(() => Bluebird.reject(_error));
        }

        return Bluebird.reject(_error);
      })
      .finally(() => {
        this.concurrentRequests--;
        delete this.pendingRequests[request.id];
      });
  }

  /**
   * Helper function meant to normalize event names
   * by retrieving controller aliases' original names.
   *
   * @param {string} controller name or alias
   * @param {string} prefix - event prefix
   * @param {string} action - executed action
   * @returns {string} event name
   */
  getEventName(controller, prefix, action) {
    const event = controller === 'memoryStorage' ? 'ms' : controller;

    return event + ':' + prefix + capitalizeFirstLetter(action);
  }
}

/**
 * Background task. Checks if there are any requests in cache, and replay them
 * if Kuzzle is not overloaded anymore,
 *
 * @param kuzzle
 * @param {FunnelController} funnel
 */
function playCachedRequests(kuzzle, funnel) {
  // If there is room to play bufferized requests, do it now. If not, retry later
  const quantityToInject = Math.min(funnel.cachedItems, kuzzle.config.limits.concurrentRequests - funnel.concurrentRequests);

  if (quantityToInject > 0) {
    for (let i = 0; i < quantityToInject; i++) {
      const cachedItem = funnel.requestsCache.shift();
      funnel.execute(cachedItem.request, cachedItem.callback);
    }

    funnel.cachedItems -= quantityToInject;
  }

  if (funnel.cachedItems > 0) {
    setTimeout(() => playCachedRequests(kuzzle, funnel), 0);
  } else {
    const now = Date.now();
    // No request remaining in cache => stop the background task and return to normal behavior
    funnel.overloaded = false;

    if (funnel.overloadWarned && (funnel.lastOverloadTime === 0 || funnel.lastOverloadTime < now - 500)) {
      funnel.overloadWarned = false;
      kuzzle.pluginsManager.trigger('log:info', 'End of overloaded state. Resuming normal activity.');
      funnel.lastOverloadTime = now;
    }
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
 * Triggers an event if the request has not already
 * emitted it during its lifecycle
 *
 * @param {Kuzzle} kuzzle
 * @param {KuzzleRequest} request
 * @param {string} event
 * @return {Promise.<KuzzleRequest>}
 */
function triggerEvent(kuzzle, request, event) {
  if (request.hasTriggered(event)) {
    return Bluebird.resolve(request);
  }

  request.triggers(event);
  return kuzzle.pluginsManager.trigger(event, request);
}

module.exports = FunnelController;
