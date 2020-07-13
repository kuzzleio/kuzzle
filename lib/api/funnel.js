/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const Bluebird = require('bluebird');
const Deque = require('denque');
const { errors: { KuzzleError } } = require('kuzzle-common-objects');

const AdminController = require('./controller/admin');
const AuthController = require('./controller/auth');
const BulkController = require('./controller/bulk');
const CollectionController = require('./controller/collection');
const DocumentController = require('./controller/document');
const IndexController = require('./controller/index');
const MemoryStorageController = require('./controller/memoryStorage');
const RealtimeController = require('./controller/realtime');
const SecurityController = require('./controller/security');
const ServerController = require('./controller/server');
const documentEventAliases = require('../config/documentEventAliases');
const DocumentExtractor = require('./documentExtractor');
const sdkCompatibility = require('../config/sdkCompatibility');
const RateLimiter = require('./rateLimiter');
const kerror = require('../kerror');

const debug = require('../util/debug')('kuzzle:funnel');
const processError = kerror.wrap('api', 'process');

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
 * @class Funnel
 */
class Funnel {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.overloaded = false;
    this.concurrentRequests = 0;
    this.controllers = new Map();
    this.requestsCacheQueue = new Deque();
    this.requestsCacheById = new Map();
    this.lastOverloadTime = 0;
    this.overloadWarned = false;
    this.lastWarningTime = 0;
    this.shuttingDown = false;
    this.rateLimiter = new RateLimiter(kuzzle);

    this.lastDumpedErrors = {};
    this.loadDocumentEventAliases();

    this.sdkCompatibility = sdkCompatibility;
  }

  init () {
    this.kuzzle.on('kuzzle:shutdown', () => ( this.shuttingDown = true ));

    this.rateLimiter.init();

    this.controllers.set('auth', new AuthController(this.kuzzle));
    this.controllers.set('bulk', new BulkController(this.kuzzle));
    this.controllers.set('collection', new CollectionController(this.kuzzle));
    this.controllers.set('document', new DocumentController(this.kuzzle));
    this.controllers.set('index', new IndexController(this.kuzzle));
    this.controllers.set('realtime', new RealtimeController(this.kuzzle));
    this.controllers.set('security', new SecurityController(this.kuzzle));
    this.controllers.set('server', new ServerController(this.kuzzle));
    this.controllers.set('admin', new AdminController(this.kuzzle));

    const msController = new MemoryStorageController(this.kuzzle);
    this.controllers.set('memoryStorage', msController);
    this.controllers.set('ms', msController);

    const initPromises = Array.from(this.controllers.keys())
      .map(ctrl => this.controllers.get(ctrl).init());

    return Bluebird.all(initPromises);
  }

  loadDocumentEventAliases() {
    this.documentEventAliases = documentEventAliases;
    this.documentEventAliases.mirrorList = {};

    Object.keys(documentEventAliases.list).forEach(alias => {
      documentEventAliases.list[alias].forEach(aliasOf => {
        this.documentEventAliases.mirrorList[aliasOf] = alias;
      });
    });
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
  getRequestSlot (executor, request, executeCallback) {
    if (this.shuttingDown) {
      request.setError(processError.get('shutting_down'));
      return false;
    }

    if (this.overloaded) {
      const now = Date.now();

      if (this.requestsCacheQueue.length > this.kuzzle.config.limits.requestsBufferWarningThreshold
        && (this.lastWarningTime === 0 || this.lastWarningTime < now - 500)
      ) {
        const overloadPercentage = Math.round(
          10000 *
            this.requestsCacheQueue.length /
            this.kuzzle.config.limits.requestsBufferSize) /
            100;
        this.kuzzle.emit('core:overload', overloadPercentage);
        this.kuzzle.log.warn(`[!WARNING!] Kuzzle overloaded: ${overloadPercentage}%. Delaying requests...`);

        this.overloadWarned = true;
        this.lastWarningTime = now;
      }
    }

    // resolves the callback immediately if a slot is available
    if (this.concurrentRequests < this.kuzzle.config.limits.concurrentRequests) {
      if (this.requestsCacheById.has(request.internalId)) {
        this.requestsCacheById.delete(request.internalId);
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
      const error = processError.get('overloaded');
      this.kuzzle.emit('log:error', error);
      this.kuzzle.log.error(error);
      request.setError(error);
      return false;
    }

    if (!this.requestsCacheById.has(request.internalId)) {
      this.requestsCacheById.set(
        request.internalId,
        new CacheItem(executor, request, executeCallback));
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
  execute (request, callback) {
    if (!request.input.controller || !request.input.controller.length) {
      callback(
        kerror.get('api', 'assert', 'missing_argument', 'controller'),
        request);
      return 1;
    }

    if (!request.input.action || !request.input.action.length) {
      callback(
        kerror.get('api', 'assert', 'missing_argument', 'action'),
        request);
      return 1;
    }

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
      debug('Client connection dead: dropping request: %a', request.input);
      callback(processError.get('connection_dropped'), request);
      return 1;
    }

    debug('Starting request %s:%s [%s]: %j', request.input.controller, request.input.action, request.id, request.input);

    let _request;

    this.kuzzle.asyncStore.run(() => {
      this.kuzzle.asyncStore.set('REQUEST', request);

      this.checkRights(request)
        .then(modifiedRequest => {
          _request = modifiedRequest;
          return this.rateLimiter.isAllowed(_request);
        })
        .then(allowed => {
          if (!allowed) {
            throw processError.get('too_many_requests');
          }

          return this.processRequest(_request);
        })
        .then(processResult => {
          debug('Request %s successfully executed. Result: %a',
            request.id,
            processResult);

          callback(null, processResult);

          // disables a bluebird warning in dev. mode triggered when
          // a promise is created and not returned
          return null;
        })
        .catch(err => {
          debug('Error processing request %s: %a', request.id, err);
          return this._executeError(err, request, true, callback);
        });
    });

    return 0;
  }

  /**
   * Checks if an error is worth dumping Kuzzle. If so,
   * creates a dump.
   *
   * @param {KuzzleError|*} err
   */
  handleErrorDump (err) {
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
            err instanceof Error && !(err instanceof KuzzleError)
              ? `${err.message}\n${err.stack}`
              : err);

          if (!this.lastDumpedErrors[errorType]
            || this.lastDumpedErrors[errorType] < now - handledErrors.minInterval
          ) {
            // simplify error message to use it in folder dump name
            let errorMessage = err.message;

            if (errorMessage.indexOf('\n') > -1) {
              errorMessage = errorMessage.split('\n')[0];
            }

            errorMessage = errorMessage
              .toLowerCase()
              .replace(/[^a-zA-Z0-9-_]/g, '-')
              .split('-')
              .filter(value => value !== '')
              .join('-');

            this.kuzzle.dump(`handled-${errorType.toLocaleLowerCase()}-${errorMessage}`);
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
   * @returns {Promise<Request>}
   */
  async checkRights (request) {
    request.context.token = await this.kuzzle.ask(
      'core:security:token:verify',
      request.input.jwt);

    const userId = request.context.token.userId;

    request.context.user = await this.kuzzle.ask(
      'core:security:user:get',
      userId);

    if (! await request.context.user.isActionAllowed(request)) {
      // anonymous user => 401 (Unauthorized) error
      // logged-in user with insufficient permissions => 403 (Forbidden) error
      const error = kerror.get(
        'security',
        'rights',
        userId === '-1' ? 'unauthorized' : 'forbidden',
        request.input.controller,
        request.input.action,
        request.context.user._id);

      request.setError(error);

      await this.kuzzle.pipe('request:onUnauthorized', request);
      throw error;
    }

    return this.kuzzle.pipe('request:onAuthorized', request);
  }

  /**
   * Executes the request immediately.
   * /!\ To be used only by methods having already passed the overload check.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async processRequest (request) {
    const controller = this.getController(request);

    this.kuzzle.statistics.startRequest(request);
    this.concurrentRequests++;

    let _request = request;

    try {
      await this._checkSdkVersion(_request);
      _request = await this.performDocumentAlias(_request, 'before');
      _request = await this.kuzzle.pipe(
        this.getEventName(_request, 'before'),
        _request);

      const responseData = await doAction(controller, _request);

      _request.setResult(
        responseData,
        { status: _request.status === 102 ? 200 : _request.status });

      if (!this.isNativeController(_request.input.controller) && !_request.response.raw) {
        // check if the plugin response can be serialized
        try {
          JSON.stringify(responseData);
        }
        catch (e) {
          _request.setResult(null);
          throw kerror.get('plugin', 'controller', 'unserializable_response');
        }
      }

      _request = await this.kuzzle.pipe(
        this.getEventName(_request, 'after'),
        _request);

      _request = await this.performDocumentAlias(_request, 'after');
      _request = await this.kuzzle.pipe('request:onSuccess', _request);
      this.kuzzle.statistics.completedRequest(_request);
    }
    catch (error) {
      return this.handleProcessRequestError(_request, _request, error);
    }
    finally {
      this.concurrentRequests--;
    }

    return _request;
  }

  /**
   * Triggers generic:document:* events
   *
   * @warning Critical code section
   *
   * @param {KuzzleRequest} request
   * @param {String} prefix
   *
   * @returns {Promise<KuzzleRequest>}
   */
  async performDocumentAlias (request, prefix) {
    const { controller, action } = request.input;
    const mustTrigger =
      controller === 'document'
      && this.documentEventAliases.mirrorList[action]
      && ( prefix !== 'before'
        || !this.documentEventAliases.notBefore.includes(action));

    if (!mustTrigger) {
      return request;
    }

    const alias = this.documentEventAliases.mirrorList[action];
    const event = `${this.documentEventAliases.namespace}:${prefix}${capitalize(alias)}`;
    const extractor = new DocumentExtractor(request);

    const documents = await this.kuzzle.pipe(event, extractor.extract(), request);

    return extractor.insert(documents);
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
  async executePluginRequest (request) {
    try {
      return await doAction(this.getController(request), request);
    }
    catch (e) {
      this.handleErrorDump(e);
      throw e;
    }
  }

  async handleProcessRequestError (modifiedRequest, request, error) {
    let _error = this._wrapError(request, error);
    modifiedRequest.setError(_error);

    try {
      const updated = await this.kuzzle.pipe(
        this.getEventName(modifiedRequest, 'error'),
        modifiedRequest);

      // If there is no pipe attached on this event, the same request is
      // passed in resolve and we should reject it
      if (updated.error !== null) {
        throw updated.error;
      }
      // Pipe recovered from the error: returned the new result
      return updated;
    }
    catch (err) {
      _error = this._wrapError(request, err);
    }

    // Handling the error thrown by the error pipe
    modifiedRequest.setError(_error);
    this.kuzzle.statistics.failedRequest(request);

    try {
      const updated = await this.kuzzle.pipe('request:onError', modifiedRequest);

      if (updated === modifiedRequest) {
        throw modifiedRequest.error;
      }

      return updated;
    }
    catch (err) {
      throw this._wrapError(request, err);
    }
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
    const event =
      request.input.controller === 'memoryStorage'
        ? 'ms'
        : request.input.controller;

    return`${event}:${prefix}${capitalize(request.input.action)}`;
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
   * @returns {Object} controller object
   * @throws {BadRequestError} If the asked controller or action is unknown
   */
  getController (request) {
    for (const controllers of [this.controllers, this.kuzzle.pluginsManager.controllers]) {
      const controller = controllers.get(request.input.controller);

      if (controller) {
        if (controller._isAction(request.input.action)) {
          return controller;
        }

        throw processError.get('action_not_found', request.input.action);
      }
    }

    throw processError.get('controller_not_found', request.input.controller);
  }

  /**
   * Tell if the controller is a native controller or not
   * @param  {String}  controller
   * @returns {Boolean}
   */
  isNativeController (controller) {
    return this.controllers.has(controller);
  }

  /**
   * If the request is coming from an official SDK,
   * then checks the compatibility of the SDK against current Kuzzle version.
   *
   * @param {Request} request
   *
   * @throws
   */
  _checkSdkVersion (request) {
    const
      sdkVersion = request.input.volatile && request.input.volatile.sdkVersion,
      sdkName = request.input.volatile && request.input.volatile.sdkName;

    // sdkVersion property is only used by Kuzzle v1 SDKs
    if (sdkVersion) {
      throw processError.get('incompatible_sdk_version', sdkVersion, 'Kuzzle v2');
    }

    if (! sdkName || typeof sdkName !== 'string') {
      return;
    }

    const
      separatorIdx = sdkName.indexOf('@'),
      name = sdkName.substr(0, separatorIdx),
      version = sdkName.substr(separatorIdx + 1);

    if (name.length === 0 || version.length === 0) {
      return;
    }

    const requirements = this.sdkCompatibility[name];
    if (! requirements) {
      return;
    }

    if (! satisfiesMajor(version, requirements)) {
      const hint = `min: ${requirements.min || 'none'}, max: ${requirements.max || 'none'}`;

      throw processError.get('incompatible_sdk_version', version, hint);
    }
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
    const quantityToInject = Math.min(
      this.requestsCacheQueue.length,
      this.kuzzle.config.limits.concurrentRequests - this.concurrentRequests);

    if (quantityToInject > 0) {
      for (let i = 0; i < quantityToInject; i++) {
        const cachedItem =
          this.requestsCacheById.get(this.requestsCacheQueue.peekFront());

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

      if ( this.overloadWarned
        && (this.lastOverloadTime === 0 || this.lastOverloadTime < now - 500)
      ) {
        this.overloadWarned = false;
        this.kuzzle.log.info('End of overloaded state. Resuming normal activity.');
        this.lastOverloadTime = now;
      }
    }
  }

  /**
   * Eventually wrap an error into a PluginImplementationError
   * @param  {Request} request
   * @param  {Error} error
   * @returns {KuzzleError}
   */
  _wrapError (request, error) {
    if (!this.isNativeController(request) && !(error instanceof KuzzleError)) {
      return kerror.getFrom(
        error,
        'plugin',
        'runtime',
        'unexpected_error',
        error.message);
    }

    return error;
  }
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalize (string) {
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
 * @returns {Promise}
 */
function doAction (controller, request) {
  const ret = controller[request.input.action](request);

  if (!ret || typeof ret.then !== 'function') {
    return kerror.reject(
      'plugin',
      'controller',
      'invalid_action_response',
      request.input.controller,
      request.input.action);
  }

  return ret;
}

/**
 * Very straightforward function to check only if the version satisfies
 * the major version requirements
 *
 * @param {String} version
 * @param {Object} requirements
 *
 * @returns {Boolean}
 */
function satisfiesMajor (version, requirements) {
  let
    maxRequirement = true,
    minRequirement = true;

  if (requirements.min) {
    minRequirement = version[0] >= requirements.min.toString();
  }

  if (requirements.max) {
    maxRequirement = version[0] <= requirements.max.toString();
  }

  return maxRequirement && minRequirement;
}


module.exports = Funnel;
