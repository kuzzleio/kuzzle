'use strict';

var
  Promise = require('bluebird'),
  MemoryStorageController = require('./memoryStorageController'),
  WriteController = require('./writeController'),
  ReadController = require('./readController'),
  SubscribeController = require('./subscribeController'),
  BulkController = require('./bulkController'),
  AdminController = require('./adminController'),
  SecurityController = require('./securityController'),
  AuthController = require('./authController'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  Request = require('kuzzle-common-objects').Request;

const MIN_TIME_BEFORE_DUMP_PREV_ERROR = 60000;

/**
 * @property {object} controllers
 * @param {Kuzzle} kuzzle
 */
function FunnelController (kuzzle) {
  this.overloaded = false;
  this.concurrentRequests = 0;
  this.cachedRequests = 0;
  this.controllers = {};
  this.requestsCache = [];
  this.lastOverloadTime = 0;
  this.overloadWarned = false;
  this.lastWarningTime = 0;

  this.lastDumpedErrors = {};

  // used only for core-dump analysis
  this.pendingRequests = {};

  // used only for core-dump analysis
  this.requestHistory = [];

  this.init = function funnelInit () {
    this.controllers.admin = new AdminController(kuzzle);
    this.controllers.auth = new AuthController(kuzzle);
    this.controllers.bulk = new BulkController(kuzzle);
    this.controllers.memoryStorage = this.controllers.ms = new MemoryStorageController(kuzzle);
    this.controllers.read = new ReadController(kuzzle);
    this.controllers.security = new SecurityController(kuzzle);
    this.controllers.subscribe = new SubscribeController(kuzzle);
    this.controllers.write = new WriteController(kuzzle);

    kuzzle.pluginsManager.injectControllers();
  };

  /**
   * Execute the right controller/action
   *
   * @param {Request} request
   * @param {Function} callback
   */
  this.execute = function funnelExecute (request, callback) {
    var
      error,
      overloadPercentage,
      now;

    if (this.overloaded) {
      now = Date.now();
      if ((this.cachedRequests > kuzzle.config.server.warningRetainedRequestsLimit) && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)) {
        overloadPercentage = Math.round(10000 * this.cachedRequests / kuzzle.config.server.maxRetainedRequests) / 100;
        kuzzle.pluginsManager.trigger('server:overload', overloadPercentage);
        kuzzle.pluginsManager.trigger('log:warn', '[!WARNING!] Kuzzle overloaded: ' + overloadPercentage + '%. Delaying requests...');

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // execute the request immediately if kuzzle is not overloaded
    if (this.concurrentRequests < kuzzle.config.server.maxConcurrentRequests) {
      this.concurrentRequests++;

      this.pendingRequests[request.id] = request;

      processRequest(kuzzle, this, request)
        .then(processResult => callback(null, processResult))
        .catch(err => {
          kuzzle.pluginsManager.trigger('log:error', err);

          request.setError(err);
          callback(err, request.response);

          this.handleErrorDump(err);

          return null;
        })
        .finally(() => {
          this.concurrentRequests--;
          delete this.pendingRequests[request.id];
        });

      return null;
    }

    /*
      If kuzzle is overloaded, check the requests cache.
      There are two possibilities:
        1- the cache limit has not been reached. A warning is emitted, and the
           request is cached and will be played as soon as the maxConcurrentRequests
           property allows it

        2- the number of cached requests is equal to the maxRetainedRequests property.
           The request is then discarded and an error is returned to the sender
     */
    if (!this.overloaded) {
      this.overloaded = true;
      setTimeout(() => playCachedRequests(kuzzle, this), 10);
    }

    if (this.cachedRequests >= kuzzle.config.server.maxRetainedRequests) {
      error = new ServiceUnavailableError('Request discarded: Kuzzle Server is temporarily overloaded');

      kuzzle.pluginsManager.trigger('log:error', error);

      request.setError(error);

      callback(error, request.response);

      return null;
    }

    this.cachedRequests++;
    this.requestsCache.push({request, callback});
  };

  this.handleErrorDump = function funnelHandleErrorDump (err) {
    if (kuzzle.config.dump.enabled && kuzzle.config.dump.handledErrors.enabled) {
      setImmediate(() => {
        var
          lastSeen = Date.now(),
          request,
          errorType,
          errorMessage;

        errorType = typeof err === 'object' && err.name ? err.name : typeof err;

        if (kuzzle.config.dump.handledErrors.whitelist.indexOf(errorType) > -1) {
          request = new Request({
            controller: 'actions',
            action: 'dump',
            body: {}
          });

          // simplify error message to use it in folder dump name
          errorMessage = err.message;
          if (errorMessage.indexOf('\n') > -1) {
            errorMessage = errorMessage.split('\n')[0];
          }
          errorMessage = errorMessage.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '-').replace(/[-]+/g, '-').split('-');
          errorMessage = errorMessage.filter(value => value !== '').join('-');

          request.data.body.suffix = 'handled-'.concat(errorType.toLowerCase(), '-', errorMessage);

          if (!this.lastDumpedErrors[request.data.body.suffix] || this.lastDumpedErrors[request.data.body.suffix] < lastSeen - MIN_TIME_BEFORE_DUMP_PREV_ERROR) {
            kuzzle.cliController.actions.dump(request);
            this.lastDumpedErrors[request.data.body.suffix] = lastSeen;
          }
        }
      });
    }
  };
}

/**
 * Execute the request immediately
 * @param {Kuzzle} kuzzle
 * @param {FunnelController} funnel
 * @param {Request} request
 */
function processRequest(kuzzle, funnel, request) {
  var controllers = funnel.controllers;

  kuzzle.statistics.startRequest(request);

  if (funnel.requestHistory.length > kuzzle.config.server.maxRequestHistorySize) {
    funnel.requestHistory.shift();
  }

  funnel.requestHistory.push(request);

  if (
    !controllers[request.input.controller]
    || !controllers[request.input.controller][request.input.action]
    || typeof controllers[request.input.controller][request.input.action] !== 'function'
  ) {
    return Promise.reject(new BadRequestError(`No corresponding action ${request.input.action} in controller ${request.input.controller}`));
  }

  return kuzzle.repositories.token.verifyToken(request.input.jwt)
    .then(userToken => {
      request.context.token = userToken;
    })
    .then(() => {
      return kuzzle.repositories.user.load(request.input.token.userId);
    })
    .then(user => user.isActionAllowed(request, kuzzle))
    .then(isAllowed => {
      var
        modifiedRequest,
        input = request.input,
        beforeEvent = getEventName(input.controller, 'before', input.action),
        afterEvent = getEventName(input.controller, 'after', input.action);

      if (!isAllowed) {
        // anonymous user => we throw a 401 (Unauthorised) error
        if (request.context.token.userId === -1) {
          return Promise.reject(new UnauthorizedError(
            `Unauthorized action [${input.index}/${input.collection}/${input.controller}/${input.action}] for anonymous user`)
          );
        }
        // logged-in user with insufficient permissions => we throw a 403 (Forbidden) error
        return Promise.reject(new ForbiddenError(
          `Forbidden action [${input.index}/${input.collection}/${input.controller}/${input.action}] for user ${request.context.token.userId}`)
        );
      }

      return kuzzle.pluginsManager.trigger(beforeEvent, request)
        .then(newRequest => {
          modifiedRequest = newRequest;

          return controllers[request.input.controller][request.input.action](newRequest);
        })
        .then(responseData => {
          modifiedRequest.setResult(responseData);

          return kuzzle.pluginsManager.trigger(afterEvent, modifiedRequest);
        });
    })
    .then(newRequest => {
      kuzzle.statistics.completedRequest(request);
      return newRequest;
    })
    .catch(error => {
      kuzzle.statistics.failedRequest(request);
      return Promise.reject(error);
    });
}

/**
 * Background task. Checks if there are any requests in cache, and replay them
 * if Kuzzle is not overloaded anymore,
 *
 * @param kuzzle
 * @param {FunnelController} funnel
 */
function playCachedRequests(kuzzle, funnel) {
  var
    cachedItem,
    now;

  if (funnel.cachedRequests > 0) {
    // If there is room to play bufferized requests, do it now. If not, retry later
    if (funnel.concurrentRequests < kuzzle.config.server.maxConcurrentRequests) {
      cachedItem = funnel.requestsCache.shift();
      funnel.cachedRequests--;
      funnel.execute(cachedItem.request, cachedItem.callback);
      return process.nextTick(() => playCachedRequests(kuzzle, funnel));
    }

    setTimeout(() => playCachedRequests(kuzzle, funnel), 10);
  } else {
    // No request remaining in cache => stop the background task and return to normal behavior
    funnel.overloaded = false;
    now = Date.now();

    if (funnel.overloadWarned && (funnel.lastOverloadTime === 0 || funnel.lastOverloadTime < now - 500)) {
      funnel.overloadWarned = false;
      kuzzle.pluginsManager.trigger('log:info', 'End of overloaded state. Resuming normal activity.');
      funnel.lastOverloadTime = now;
    }
  }
}

function getEventName(controller, prefix, action) {
  return controller + ':' + prefix + capitalizeFirstLetter(action);
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = FunnelController;
