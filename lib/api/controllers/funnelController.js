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
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  UnauthorizedError = require('kuzzle-common-objects').Errors.unauthorizedError,
  ForbiddenError = require('kuzzle-common-objects').Errors.forbiddenError,
  ServiceUnavailableError = require('kuzzle-common-objects').Errors.serviceUnavailableError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

const MIN_TIME_BEFORE_DUMP_PREV_ERROR = 60000;

/**
 * @property {Object} controllers
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
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @param {Function} callback
   */
  this.execute = function funnelExecute (requestObject, userContext, callback) {
    var
      error,
      overloadPercentage,
      now;

    if (this.overloaded) {
      now = Date.now();
      if ((this.cachedRequests > kuzzle.config.server.warnRetainedRequestsLimit) && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)) {
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

      this.pendingRequests[requestObject.requestId] = requestObject;

      processRequest(kuzzle, this.controllers, requestObject, userContext)
        .then(response => callback(null, response.responseObject))
        .catch(err => {
          kuzzle.pluginsManager.trigger('log:error', err);
          callback(err, new ResponseObject(requestObject, err));

          this.handleErrorDump(err);

          return null;
        })
        .finally(() => {
          this.concurrentRequests--;
          delete this.pendingRequests[requestObject.requestId];
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
      callback(error, new ResponseObject(requestObject, error));

      return null;
    }

    this.cachedRequests++;
    this.requestsCache.push({requestObject, userContext, callback});
  };

  this.handleErrorDump = function funnelHandleErrorDump (err) {
    if (kuzzle.config.dump.handledErrors.enabled) {
      setImmediate(() => {
        var
          lastSeen = Date.now(),
          request,
          errorType,
          errorMessage;

        errorType = typeof err === 'object' && err.name ? err.name : typeof err;

        if (kuzzle.config.dump.handledErrors.whitelist.indexOf(errorType) > -1) {
          request = new RequestObject({
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

          request.data.body.sufix = 'handled-'.concat(errorType.toLowerCase(), '-', errorMessage);

          if (!this.lastDumpedErrors[request.data.body.sufix] || this.lastDumpedErrors[request.data.body.sufix] < lastSeen - MIN_TIME_BEFORE_DUMP_PREV_ERROR) {
            kuzzle.cliController.actions.dump(request);
            this.lastDumpedErrors[request.data.body.sufix] = lastSeen;
          }
        }
      });
    }
  };
}

/**
 * Execute the request immediately
 * @param {Kuzzle} kuzzle
 * @param {Object} controllers
 * @param {RequestObject} requestObject
 * @param userContext
 */
function processRequest(kuzzle, controllers, requestObject, userContext) {
  kuzzle.statistics.startRequest(requestObject);

  return kuzzle.repositories.token.verifyToken(getBearerTokenFromHeaders(requestObject.headers))
    .then(userToken => {
      userContext.token = userToken;

      return requestObject.checkInformation();
    })
    .then(() => {
      if (
        !controllers[requestObject.controller]
        || !controllers[requestObject.controller][requestObject.action]
        || typeof controllers[requestObject.controller][requestObject.action] !== 'function'
      ) {
        return Promise.reject(new BadRequestError('No corresponding action ' + requestObject.action + ' in controller ' + requestObject.controller));
      }
      return kuzzle.repositories.user.load(userContext.token.userId);
    })
    .then(user => user.isActionAllowed(requestObject, userContext, kuzzle))
    .then(isAllowed => {
      if (!isAllowed) {
        // anonymous user => we throw a 401 (Unauthorised) error
        if (userContext.token.userId === -1) {
          return Promise.reject(new UnauthorizedError('Unauthorized action [' +
            requestObject.index + '/' +
            requestObject.collection + '/' +
            requestObject.controller + '/' +
            requestObject.action + '] for anonymous user'));
        }
        // logged-in user with insufficient permissions => we throw a 403 (Forbidden) error
        return Promise.reject(new ForbiddenError('Forbidden action [' +
          requestObject.index + '/' +
          requestObject.collection + '/' +
          requestObject.controller + '/' +
          requestObject.action + '] for user ' +
          userContext.token.userId));
      }

      return controllers[requestObject.controller][requestObject.action](requestObject, userContext);
    })
    .then(response => {
      kuzzle.statistics.completedRequest(requestObject);
      return response;
    })
    .catch(error => {
      kuzzle.statistics.failedRequest(requestObject);
      return Promise.reject(error);
    });
}

/**
 * Extract the Bearer token from the given headers
 * @param {Object} headers
 * @returns {String}
 */
function getBearerTokenFromHeaders(headers) {
  var
    r;

  if (headers !== undefined && headers.authorization !== undefined) {
    r = /^Bearer (.+)$/.exec(headers.authorization);
    if (r !== null && r[1].trim() !== '') {
      return r[1].trim();
    }
  }

  return null;
}

/**
 * Background task. Checks if there are any requests in cache, and replay them
 * if Kuzzle is not overloaded anymore,
 *
 * @param kuzzle
 * @param funnel
 */
function playCachedRequests(kuzzle, funnel) {
  var
    request,
    now;

  if (funnel.cachedRequests > 0) {
    // If there is room to play bufferized requests, do it now. If not, retry later
    if (funnel.concurrentRequests < kuzzle.config.server.maxConcurrentRequests) {
      request = funnel.requestsCache.shift();
      funnel.cachedRequests--;
      funnel.execute(request.requestObject, request.userContext, request.callback);
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

module.exports = FunnelController;
