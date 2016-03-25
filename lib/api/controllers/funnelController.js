var
  q = require('q'),
  WriteController = require('./writeController'),
  ReadController = require('./readController'),
  SubscribeController = require('./subscribeController'),
  BulkController = require('./bulkController'),
  AdminController = require('./adminController'),
  SecurityController = require('./securityController'),
  AuthController = require('./authController'),
  BadRequestError = require('../core/errors/badRequestError'),
  UnauthorizedError = require('../core/errors/unauthorizedError');

// Constants
var
  REQUESTQUEUE = 'requestQueue';

module.exports = function FunnelController (kuzzle) {
  this.concurrentRequests = 0;
  this.retainedRequests = 0;
  this.lastWarningTime = 0;
  this.controllers = {};

  this.init = function () {
    this.controllers.write = new WriteController(kuzzle);
    this.controllers.read = new ReadController(kuzzle);
    this.controllers.subscribe = new SubscribeController(kuzzle);
    this.controllers.bulk = new BulkController(kuzzle);
    this.controllers.admin = new AdminController(kuzzle);
    this.controllers.security = new SecurityController(kuzzle);
    this.controllers.auth = new AuthController(kuzzle);

    kuzzle.pluginsManager.injectControllers();
  };

  /**
   * Execute in parallel all tests to check if the object is well constructed
   * Then generate a requestId if not provided and execute the right controller/action
   *
   * @param {RequestObject} requestObject
   * @param {Object} context
   * @param {Function} callback
   */
  this.execute = function (requestObject, context, callback) {
    var now;

    // execute the request immediately if kuzzle is not overloaded
    if (this.concurrentRequests <= kuzzle.config.request.maxConcurrentRequests) {
      this.concurrentRequests++;

      return processRequest(kuzzle, this.controllers, requestObject, context)
        .then(responseObject => callback(null, responseObject))
        .catch(error => callback(error))
        .finally(() => this.concurrentRequests--);
    }

    /*
     if kuzzle is overloaded, print a warning and store the request in cache,
     to be executed at a later time
     */
    now = Date.now();
    if (this.lastWarningTime === 0 || this.lastWarningTime < now - 1000) {
      kuzzle.pluginsManager.trigger('log:warn', '[!WARNING!] Kuzzle overloaded. Delaying requests...');
      this.lastWarningTime = now;
    }

    kuzzle.services.list.queryCache.push(REQUESTQUEUE, {request: requestObject, context: context});
  };
};

/**
 * Execute the request immediately
 * @param kuzzle
 * @param controllers
 * @param requestObject
 * @param context
 */
function processRequest(kuzzle, controllers, requestObject, context) {
  //kuzzle.statistics.startRequest(requestObject);

  return kuzzle.repositories.token.verifyToken(getBearerTokenFromHeaders(requestObject.headers))
    .then(userToken => {
      context.token = userToken;

      return requestObject.checkInformation();
    })
    .then(() => {
      if (!controllers[requestObject.controller] ||
        !controllers[requestObject.controller][requestObject.action] ||
        typeof controllers[requestObject.controller][requestObject.action] !== 'function') {
        return q.reject(new BadRequestError('No corresponding action ' + requestObject.action + ' in controller ' + requestObject.controller));
      }

      // check if the current user is allowed to process
      return context.token.user.profile.isActionAllowed(requestObject, context, kuzzle.indexCache.indexes, kuzzle);
    })
    .then(isAllowed => {
      if (!isAllowed) {
        return q.reject(new UnauthorizedError('Unauthorized action [' +
          requestObject.index + '/' +
          requestObject.collection + '/' +
          requestObject.controller + '/' +
          requestObject.action + '] for user ' +
          context.token.user._id, 401));
      }

      return controllers[requestObject.controller][requestObject.action](requestObject, context);
    })
    .then(responseObject => {
      //kuzzle.statistics.completedRequest(requestObject);
      return responseObject;
    })
    .catch(error => {
      //kuzzle.statistics.failedRequest(requestObject);
      return q.reject(error);
    });
}

/**
 * Extract the Bearer token from the given headers
 * @param {Object} headers
 * @returns {*}
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
