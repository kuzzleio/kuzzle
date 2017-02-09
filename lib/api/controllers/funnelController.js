'use strict';

var
  Promise = require('bluebird'),
  Deque = require('denque'),
  AuthController = require('./authController'),
  BulkController = require('./bulkController'),
  CollectionController = require('./collectionController'),
  DocumentController = require('./documentController'),
  IndexController = require('./indexController'),
  KuzzleError = require('kuzzle-common-objects').errors.KuzzleError,
  MemoryStorageController = require('./memoryStorageController'),
  RealtimeController = require('./realtimeController'),
  SecurityController = require('./securityController'),
  ServerController = require('./serverController'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  Request = require('kuzzle-common-objects').Request;

const MIN_TIME_BEFORE_DUMP_PREV_ERROR = 60000;

class CacheItem {
  constructor(request, callback) {
    this.request = request;
    this.callback = callback;
  }
}

/**
 * @property {object} controllers
 * @param {Kuzzle} kuzzle
 */
function FunnelController (kuzzle) {
  this.overloaded = false;
  this.concurrentRequests = 0;
  this.controllers = {};
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

  this.init = function funnelInit () {
    this.controllers.auth = new AuthController(kuzzle);
    this.controllers.bulk = new BulkController(kuzzle);
    this.controllers.collection = new CollectionController(kuzzle);
    this.controllers.document = new DocumentController(kuzzle);
    this.controllers.index = new IndexController(kuzzle);
    this.controllers.memoryStorage = this.controllers.ms = new MemoryStorageController(kuzzle);
    this.controllers.realtime = new RealtimeController(kuzzle);
    this.controllers.security = new SecurityController(kuzzle);
    this.controllers.server = new ServerController(kuzzle);

    kuzzle.pluginsManager.injectControllers();
  };

  /**
   * Execute the right controller/action
   *
   * @param {Request} request
   * @param {Function} callback
   */
  this.execute = function funnelExecute (request, callback) {
    if (this.overloaded) {
      let now = Date.now();

      if ((this.cachedItems > kuzzle.config.server.warningRetainedRequestsLimit) && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)) {
        let overloadPercentage = Math.round(10000 * this.cachedItems / kuzzle.config.server.maxRetainedRequests) / 100;
        kuzzle.pluginsManager.trigger('core:overload', overloadPercentage);
        kuzzle.pluginsManager.trigger('log:warn', '[!WARNING!] Kuzzle overloaded: ' + overloadPercentage + '%. Delaying requests...');

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // execute the request immediately if kuzzle is not overloaded
    if (this.concurrentRequests < kuzzle.config.server.maxConcurrentRequests) {
      this.concurrentRequests++;

      this.pendingRequests[request.id] = request;

      this.checkRights(request)
        .then(() => this.processRequest(request))
        .then(processResult => callback(null, processResult))
        .catch(err => {
          // JSON.stringify(new NativeError()) === '{}', i.e. Error, SyntaxError, TypeError, ReferenceError, etc.
          kuzzle.pluginsManager.trigger('log:error', err instanceof Error && !(err instanceof KuzzleError)
            ? err.message + '\n' + err.stack
            : err
          );

          request.setError(err);
          callback(err, request);

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

     1- the cache limit has not been reached: the request is cached
     and will be played as soon as the maxConcurrentRequests
     property allows it

     2- the number of cached requests is equal to the maxRetainedRequests property.
     The request is then discarded and an error is returned to the sender
     */
    if (this.cachedItems >= kuzzle.config.server.maxRetainedRequests) {
      const error = new ServiceUnavailableError('Request discarded: Kuzzle Server is temporarily overloaded');

      kuzzle.pluginsManager.trigger('log:error', error);
      request.setError(error);
      callback(error, request);
      return null;
    }

    this.cachedItems++;
    this.requestsCache.push(new CacheItem(request, callback));

    if (!this.overloaded) {
      this.overloaded = true;

      /*
       /!\ Invoking this function here with setTimeout() leads to V8 deoptimizing
       the entire funnelExecute method (as of node.js 6.9.1),
       because of an "out of bounds" heuristic error (caused by node's
       setTimeout code written in JS? this needs further investigations)

       We get better performances by keeping this method optimized by crankshaft
       even if this means executing this function once for nothing each
       time we start overload mode.
       */
      playCachedRequests(kuzzle, this);
    }
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

          request.input.body.suffix = 'handled-'.concat(errorType.toLowerCase(), '-', errorMessage);

          if (!this.lastDumpedErrors[request.data.body.suffix] || this.lastDumpedErrors[request.data.body.suffix] < lastSeen - MIN_TIME_BEFORE_DUMP_PREV_ERROR) {
            kuzzle.cliController.actions.dump(request);
            this.lastDumpedErrors[request.data.body.suffix] = lastSeen;
          }
        }
      });
    }
  };

  /**
   * Checks if a user has the necessary rights to execute the action
   *
   * @param {Request} request
   * @return {Promise<Boolean>}
   */
  this.checkRights = function checkRights (request) {
    return kuzzle.repositories.token.verifyToken(request.input.jwt)
      .then(userToken => {
        request.context.token = userToken;

        return kuzzle.repositories.user.load(request.context.token.userId);
      })
      .then(user => {
        request.context.user = user;

        return user.isActionAllowed(request, kuzzle);
      })
      .then(isAllowed => {
        if (!isAllowed) {
          // anonymous user => we throw a 401 (Unauthorised) error
          if (request.context.token.userId === -1) {
            return Promise.reject(new UnauthorizedError(
              `Unauthorized action [${request.input.resource.index}/${request.input.resource.collection}/${request.input.controller}/${request.input.action}] for anonymous user`)
            );
          }
          // logged-in user with insufficient permissions => we throw a 403 (Forbidden) error
          return Promise.reject(new ForbiddenError(
            `Forbidden action [${request.input.resource.index}/${request.input.resource.collection}/${request.input.controller}/${request.input.action}] for user ${request.context.user._id}`)
          );
        }
      });
  };

  /**
   * Execute the request immediately
   * @param {KuzzleRequest} request
   * @return {Promise}
   */
  this.processRequest = function processRequest(request) {
    if (
      !this.controllers[request.input.controller]
      || !this.controllers[request.input.controller][request.input.action]
      || typeof this.controllers[request.input.controller][request.input.action] !== 'function'
    ) {
      return Promise.reject(new BadRequestError(`No corresponding action ${request.input.action} in controller ${request.input.controller}`));
    }

    kuzzle.statistics.startRequest(request);

    if (this.historized > kuzzle.config.server.maxRequestHistorySize) {
      this.requestHistory.shift();
    }
    else {
      this.historized++;
    }

    this.requestHistory.push(request);

    let
      beforeEvent = this.getEventName(request.input.controller, 'before', request.input.action),
      modifiedRequest;

    return kuzzle.pluginsManager.trigger(beforeEvent, request)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.controllers[request.input.controller][request.input.action](newRequest);
      })
      .then(responseData => {
        let afterEvent = this.getEventName(request.input.controller, 'after', request.input.action);

        modifiedRequest.setResult(responseData, {status: request.status === 102 ? 200 : request.status});

        return kuzzle.pluginsManager.trigger(afterEvent, modifiedRequest);
      })
      .then(newRequest => {
        kuzzle.statistics.completedRequest(request);

        return newRequest;
      })
      .catch(error => {
        kuzzle.statistics.failedRequest(request);
        return Promise.reject(error);
      });
  };

  this.getEventName = function getEventName(controller, prefix, action) {
    var event = controller === 'memoryStorage' ? 'ms' : controller;

    return event + ':' + prefix + capitalizeFirstLetter(action);
  };
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
  let quantityToInject = funnel.cachedItems > 0 ?
    Math.min(funnel.cachedItems, kuzzle.config.server.maxConcurrentRequests - funnel.concurrentRequests)
    : 0;


  for(let i = 0; i < quantityToInject; i++) {
    let cachedItem = funnel.requestsCache.shift();
    funnel.execute(cachedItem.request, cachedItem.callback);
  }

  funnel.cachedItems -= quantityToInject;

  if (funnel.cachedItems > 0) {
    setTimeout(() => playCachedRequests(kuzzle, funnel), 0);
  } else {
    let now = Date.now();
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

module.exports = FunnelController;
