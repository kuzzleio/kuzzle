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
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

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
   * @param {Object} context
   * @param {Function} callback
   */
  this.execute = function funnelExecute (requestObject, context, callback) {
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

      return processRequest(kuzzle, this.controllers, requestObject, context)
        .then(responseObject => callback(null, responseObject))
        .catch(err => {
          kuzzle.pluginsManager.trigger('log:error', err);
          callback(err, new ResponseObject(requestObject, err));
        })
        .finally(() => this.concurrentRequests--);
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
      return callback(error, new ResponseObject(requestObject, error));
    }

    this.cachedRequests++;
    this.requestsCache.push({requestObject, context, callback});
  };
}

/**
 * Execute the request immediately
 * @param kuzzle
 * @param controllers
 * @param requestObject
 * @param context
 */
function processRequest(kuzzle, controllers, requestObject, context) {
  kuzzle.statistics.startRequest(requestObject);

  return kuzzle.repositories.token.verifyToken(getBearerTokenFromHeaders(requestObject.headers))
    .then(userToken => {
      context.token = userToken;

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
      return kuzzle.repositories.user.load(context.token.userId);
    })
    .then(user => user.isActionAllowed(requestObject, context, kuzzle))
    .then(isAllowed => {
      if (!isAllowed) {
        // anonymous user => we throw a 401 (Unauthorised) error
        if (context.token.userId === -1) {
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
          context.token.userId));
      }

      return controllers[requestObject.controller][requestObject.action](requestObject, context);
    })
    .then(responseObject => {
      kuzzle.statistics.completedRequest(requestObject);
      return responseObject;
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
      funnel.execute(request.requestObject, request.context, request.callback);
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
