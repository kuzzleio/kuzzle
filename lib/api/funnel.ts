/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import Bluebird from "bluebird";
import Deque from "denque";
import * as Cookie from "cookie";
import get from "lodash/get";

import kuzzleStateEnum from "../kuzzle/kuzzleStateEnum";
import { KuzzleError } from "../kerror/errors";
import apiControllers = require("./controllers");
import {
  documentEventAliases,
  EventAliases,
} from "../config/documentEventAliases";
import DocumentExtractor = require("./documentExtractor");
import sdkCompatibility from "../config/sdkCompatibility.json";
import RateLimiter = require("./rateLimiter");
import * as kerror from "../kerror";
import createDebug = require("../util/debug");
import { has } from "../util/safeObject";
import { HttpStream } from "../types";
import { Logger } from "../kuzzle/Logger";
import { NativeController } from "./controllers/baseController";
import { KuzzleRequest } from "./request";

const {
  AdminController,
  AuthController,
  BulkController,
  ClusterController,
  CollectionController,
  DebugController,
  DocumentController,
  IndexController,
  MemoryStorageController,
  RealtimeController,
  SecurityController,
  ServerController,
} = apiControllers;

const debug = createDebug("kuzzle:funnel");
const processError = kerror.wrap("api", "process");

// Actions of the auth controller that does not necessite to verify the token
// when cookie auth is active
const SKIP_TOKEN_VERIF_ACTIONS = new Set(["login", "checkToken", "logout"]);

type ThrottledFn = (request: KuzzleRequest) => void;
type ExecuteCallback = (error: Error | null, request: KuzzleRequest) => void;

/**
 * @class PendingRequest
 */
class PendingRequest {
  public request: KuzzleRequest;
  public fn: ThrottledFn;
  public context: unknown;

  constructor(request: KuzzleRequest, fn: ThrottledFn, context: unknown) {
    this.request = request;
    this.fn = fn;
    this.context = context;
  }
}

interface SdkRequirements {
  min?: number | string;
  max?: number | string;
}

type DocumentEventAliases = EventAliases & {
  mirrorList: Record<string, string>;
};

/**
 * @class Funnel
 */
class Funnel {
  public overloaded = false;
  public concurrentRequests = 0;
  public controllers: Map<string, NativeController> = new Map();
  public pendingRequestsQueue: Deque<string> = new Deque();
  public pendingRequestsById: Map<string, PendingRequest> = new Map();
  public lastOverloadTime = 0;
  public overloadWarned = false;
  public lastWarningTime = 0;
  public rateLimiter: RateLimiter = new RateLimiter();
  public lastDumpedErrors: Record<string, number> = {};
  public sdkCompatibility: Record<string, SdkRequirements> = sdkCompatibility;
  public documentEventAliases: DocumentEventAliases;
  public logger: Logger;

  constructor() {
    this.loadDocumentEventAliases();

    this.logger = global.kuzzle.log.child("api:funnel");
  }

  init() {
    /**
     * Returns true if the controller is one of Kuzzle native's one
     *
     * @param {String} name
     *
     * @returns {Boolean}
     */
    global.kuzzle.onAsk("kuzzle:api:funnel:controller:isNative", (name) =>
      this.isNativeController(name),
    );

    /**
     * Returns inner metrics from the Funnel
     * @returns {Object}
     */
    global.kuzzle.onAsk("kuzzle:api:funnel:metrics", () => this.metrics());

    this.rateLimiter.init();

    this.controllers.set("auth", new AuthController());
    this.controllers.set("bulk", new BulkController());
    this.controllers.set("cluster", new ClusterController());
    this.controllers.set("collection", new CollectionController());
    this.controllers.set("debug", new DebugController());
    this.controllers.set("document", new DocumentController());
    this.controllers.set("index", new IndexController());
    this.controllers.set("realtime", new RealtimeController());
    this.controllers.set("security", new SecurityController());
    this.controllers.set("server", new ServerController());
    this.controllers.set("admin", new AdminController());

    const msController = new MemoryStorageController();
    this.controllers.set("memoryStorage", msController);
    this.controllers.set("ms", msController);

    const initPromises = Array.from(this.controllers.keys()).map((ctrl) =>
      this.controllers.get(ctrl).init(),
    );

    return Bluebird.all(initPromises);
  }

  loadDocumentEventAliases() {
    this.documentEventAliases = documentEventAliases as DocumentEventAliases;
    this.documentEventAliases.mirrorList = {};

    for (const [alias, aliasedActions] of Object.entries(
      documentEventAliases.list,
    )) {
      for (const aliasOf of aliasedActions) {
        this.documentEventAliases.mirrorList[aliasOf] = alias;
      }
    }
  }

  /**
   * Emits the "core:overload" event and logs a warning when the pending-request
   * queue crosses its warning threshold — rate-limited to once per 500ms.
   */
  private _warnOverload() {
    const now = Date.now();

    if (
      this.pendingRequestsQueue.length <=
        global.kuzzle.config.limits.requestsBufferWarningThreshold ||
      (this.lastWarningTime !== 0 && this.lastWarningTime >= now - 500)
    ) {
      return;
    }

    const overloadPercentage =
      Math.round(
        (10000 * this.pendingRequestsQueue.length) /
          global.kuzzle.config.limits.requestsBufferSize,
      ) / 100;
    global.kuzzle.emit("core:overload", overloadPercentage);
    this.logger.warn(
      `[!WARNING!] Kuzzle overloaded: ${overloadPercentage}%. Delaying requests...`,
    );

    this.overloadWarned = true;
    this.lastWarningTime = now;
  }

  /**
   * Asks the overload-protection system for an execution slot.
   *
   * Returns immediately true if the request can be
   * executed.
   *
   * Otherwise, false is returned, and the caller MUST
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
   * @param {Function} fn - The function to be executed as soon as the slot is
   *                        available.
   * @param {Object} context - The execution context of the `fn` param.
   * @param {String} request - The request object that will be passed as
   *                           argument to `fn`.
   * @returns {Boolean} - A boolean telling whether the request has been
   *                      immediately executed or not.
   */
  throttle(fn: ThrottledFn, context: unknown, request: KuzzleRequest) {
    if (global.kuzzle.state === kuzzleStateEnum.SHUTTING_DOWN) {
      throw processError.get("shutting_down");
    }

    if (global.kuzzle.state === kuzzleStateEnum.NOT_ENOUGH_NODES) {
      throw processError.get("not_enough_nodes");
    }

    const isRequestFromDebugSession = get(
      request,
      "context.connection.misc.internal.debugSession",
      false,
    );

    if (this.overloaded) {
      this._warnOverload();
    }

    if (
      this.concurrentRequests < global.kuzzle.config.limits.concurrentRequests
    ) {
      if (this.pendingRequestsById.has(request.internalId)) {
        this.pendingRequestsById.delete(request.internalId);
      }
      // Execute fn immediately, since the slot is available
      fn.call(context, request);
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
    if (
      this.pendingRequestsQueue.length >=
        global.kuzzle.config.limits.requestsBufferSize &&
      !isRequestFromDebugSession
    ) {
      const error = processError.get("overloaded");
      global.kuzzle.emit("log:error", error);
      this.logger.error(error);
      throw error;
    }

    if (!this.pendingRequestsById.has(request.internalId)) {
      this.pendingRequestsById.set(
        request.internalId,
        new PendingRequest(request, fn, context),
      );

      if (isRequestFromDebugSession) {
        // Push at the front to prioritize debug requests
        this.pendingRequestsQueue.unshift(request.internalId);
      } else {
        this.pendingRequestsQueue.push(request.internalId);
      }

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
        this._playPendingRequests();
      }
    }

    return false;
  }

  /**
   * Execute the API request by
   * 1/ check domain from origin header
   * 2/ asking for a request slot,
   * 3/ verify that the user is still connected
   * 4/ checking if the requesting user has the right credentials
   * 5/ send the request itself to the corresponding controller+action
   *
   * @param {Request} request
   * @param {Function} callback
   * @returns {Number} -1: request delayed, 0: request processing, 1: error
   */
  execute(request: KuzzleRequest, callback: ExecuteCallback) {
    if (!request.input.controller?.length) {
      callback(
        kerror.get("api", "assert", "missing_argument", "controller"),
        request,
      );
      return 1;
    }

    if (!request.input.action?.length) {
      callback(
        kerror.get("api", "assert", "missing_argument", "action"),
        request,
      );
      return 1;
    }

    // If there is a body, retrieve the targets if any
    const targets = request.getArray("targets", []);
    /**
     * Only index and collection as a pair or the targets parameter is allowed at the same time
     * otherwise we throw an error because we don't know which one to use to verify the rights
     */
    if (
      targets.length > 0 &&
      (request.input.args.index || request.input.args.collection)
    ) {
      callback(
        kerror.get(
          "api",
          "assert",
          "mutually_exclusive",
          "index, collection",
          "targets",
        ),
        request,
      );
      return 1;
    }

    if (
      request.input.headers &&
      has(request.input.headers, "origin") &&
      !this._isOriginAuthorized(request.input.headers.origin)
    ) {
      debug(
        "Reject request, unauthorized origin %s",
        request.input.headers.origin,
      );
      return this._executeError(
        kerror.get(
          "api",
          "process",
          "unauthorized_origin",
          request.input.headers.origin,
        ),
        request,
        true,
        callback,
      );
    }

    try {
      const executing = this.throttle(
        (req) => this._executeThrottled(req, callback),
        this,
        request,
      );

      return executing ? 0 : -1;
    } catch (error) {
      request.setError(error);
      callback(error, request);
      return 1;
    }
  }

  /**
   * Runs a request that has been granted an execution slot by the
   * overload-protection system. Extracted from `execute` verbatim.
   *
   * @param request - the very request `execute` handed to `throttle`
   */
  private _executeThrottled(
    request: KuzzleRequest,
    callback: ExecuteCallback,
  ): void {
    // if the connection is closed there is no need to execute the request
    // => discarding it
    if (!global.kuzzle.router.isConnectionAlive(request.context)) {
      debug("Client connection dead: dropping request: %a", request.input);
      callback(processError.get("connection_dropped"), request);
      return;
    }

    debug(
      "Starting request %s:%s [%s]: %j",
      request.input.controller,
      request.input.action,
      request.id,
      request.input,
    );

    global.kuzzle.asyncStore.run(() => {
      global.kuzzle.asyncStore.set("REQUEST", request);
      global.kuzzle
        .pipe("request:beforeExecution", request)
        .then((modifiedRequest) =>
          this._dispatch(request, modifiedRequest, callback),
        )
        .catch((err) => {
          debug("Error processing request %s: %a", request.id, err);
          return this._reportExecutionError(err, request, callback);
        });
    });
  }

  /**
   * Rights check -> rate limit -> controller action, then reports the outcome
   * through `callback`. Extracted from `execute` verbatim.
   *
   * @param request - the original request (the rate-limit branch inspects it,
   *                  not the pipe-modified one)
   * @param modifiedRequest - the "request:beforeExecution" pipe result
   */
  private _dispatch(
    request: KuzzleRequest,
    modifiedRequest: KuzzleRequest,
    callback: ExecuteCallback,
  ) {
    let _request: KuzzleRequest;

    return this.checkRights(modifiedRequest)
      .then((newModifiedRequest) => {
        _request = newModifiedRequest;
        return this.rateLimiter.isAllowed(_request);
      })
      .then((allowed) => {
        if (!allowed) {
          if (
            request.input.controller === "auth" &&
            request.input.action === "login"
          ) {
            throw processError.get("too_many_logins_requests");
          }
          throw processError.get("too_many_requests");
        }

        return this.processRequest(_request);
      })
      .then((processResult) => {
        debug(
          "Request %s successfully executed. Result: %a",
          modifiedRequest.id,
          processResult,
        );

        return global.kuzzle
          .pipe("request:afterExecution", {
            request: _request,
            result: processResult,
            success: true,
          })
          .then((pipeEvent) => {
            callback(null, pipeEvent.result);

            // disables a bluebird warning in dev. mode triggered when
            // a promise is created and not returned
            return null;
          });
      })
      .catch((err) => {
        debug("Error processing request %s: %a", modifiedRequest.id, err);
        return this._reportExecutionError(err, modifiedRequest, callback);
      });
  }

  /**
   * Fires "request:afterExecution" in failure mode, then reports the (possibly
   * pipe-rewritten) error through `callback`. Extracted from `execute` verbatim
   * — both of its catch blocks did exactly this.
   */
  private _reportExecutionError(
    error: Error,
    request: KuzzleRequest,
    callback: ExecuteCallback,
  ) {
    return global.kuzzle
      .pipe("request:afterExecution", {
        error,
        request,
        success: false,
      })
      .then((pipeEvent) =>
        this._executeError(pipeEvent.error, pipeEvent.request, true, callback),
      );
  }

  /**
   * Checks if an error is worth dumping Kuzzle. If so,
   * creates a dump.
   *
   * @param {KuzzleError|*} err
   */
  handleErrorDump(err: Error | KuzzleError) {
    const handledErrors = global.kuzzle.config.dump.handledErrors;

    if (global.kuzzle.config.dump.enabled && handledErrors.enabled) {
      setImmediate(() => {
        const errorType =
          typeof err === "object" && err.name ? err.name : typeof err;

        if (handledErrors.whitelist.includes(errorType)) {
          const now = Date.now();

          // JSON.stringify(new NativeError()) === '{}'
          // i.e. Error, SyntaxError, TypeError, ReferenceError, etc.
          this.logger.error(
            err instanceof Error && !(err instanceof KuzzleError)
              ? `${err.message}\n${err.stack}`
              : err,
          );

          if (
            !this.lastDumpedErrors[errorType] ||
            this.lastDumpedErrors[errorType] < now - handledErrors.minInterval
          ) {
            // simplify error message to use it in folder dump name
            let errorMessage = err.message;

            if (errorMessage.includes("\n")) {
              errorMessage = errorMessage.split("\n")[0];
            }

            errorMessage = errorMessage
              .toLowerCase()
              .replace(/[^a-zA-Z0-9-_]/g, "-")
              .split("-")
              .filter((value) => value !== "")
              .join("-");

            global.kuzzle.dump(
              `handled-${errorType.toLocaleLowerCase()}-${errorMessage}`,
            );
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
  async checkRights(request: KuzzleRequest): Promise<KuzzleRequest> {
    if (
      !global.kuzzle.config.http.cookieAuthentication &&
      request.getBoolean("cookieAuth")
    ) {
      throw kerror.get("security", "cookie", "unsupported");
    }

    const skipTokenVerification = this._applyCookieAuthToken(request);

    try {
      // If the verification should be skipped, we pass a null token,
      // this way the verification will be made as anonymous
      const token = skipTokenVerification ? null : request.input.jwt;

      request.context.token = await global.kuzzle.ask(
        "core:security:token:verify",
        token,
      );
    } catch (error) {
      await global.kuzzle.pipe("request:onUnauthorized", request);
      throw error;
    }

    const userId = request.context.token.userId;

    request.context.user = await global.kuzzle.ask(
      "core:security:user:get",
      userId,
    );

    // If we have a token, link the connection with the token,
    // this way the connection can be notified when the token has expired.
    if (
      global.kuzzle.config.internal.notifiableProtocols.includes(
        request.context.connection.protocol,
      )
    ) {
      global.kuzzle.tokenManager.link(
        request.context.token,
        request.context.connection.id,
      );
    }

    if (!(await request.context.user.isActionAllowed(request))) {
      // anonymous user => 401 (Unauthorized) error
      // logged-in user with insufficient permissions => 403 (Forbidden) error
      const error = kerror.get(
        "security",
        "rights",
        userId === "-1" ? "unauthorized" : "forbidden",
        request.input.controller,
        request.input.action,
        request.context.user._id,
      );

      request.setError(error);

      await global.kuzzle.pipe("request:onUnauthorized", request);
      throw error;
    }

    if (
      global.kuzzle.config.plugins.common.failsafeMode &&
      !this._isLogin(request) &&
      !request.context.user.profileIds.includes("admin")
    ) {
      await global.kuzzle.pipe("request:onUnauthorized", request);
      throw kerror.get("security", "rights", "failsafe_mode_admin_only");
    }

    return global.kuzzle.pipe("request:onAuthorized", request);
  }

  /**
   * When cookie authentication is enabled, promotes the request's auth-token
   * cookie to `request.input.jwt`. Extracted from `checkRights` verbatim.
   *
   * @returns whether token verification must be skipped (anonymous check)
   */
  private _applyCookieAuthToken(request: KuzzleRequest): boolean {
    // When the Support of Cookie as Authentication Token is enabled we check if an auth token cookie is present
    // When a request is made with cookieAuth set to true
    // We try to use the auth token cookie if present as auth token
    // otherwise check for auth token as input
    if (!request.input.headers || !has(request.input.headers, "cookie")) {
      return false;
    }

    let cookie;
    try {
      cookie = Cookie.parse(request.input.headers.cookie);
    } catch (error) {
      throw kerror.get("security", "cookie", "invalid");
    }

    // if cookie is present and not null, and a token is present we should throw because we don't know which one to use
    if (!cookie.authToken || cookie.authToken === "null") {
      return false;
    }

    if (!global.kuzzle.config.http.cookieAuthentication) {
      throw kerror.get("security", "cookie", "unsupported");
    }

    if (request.input.jwt) {
      throw kerror.get(
        "security",
        "token",
        "verification_error",
        "Both token and cookie are present, could not decide which one to use",
      );
    }

    request.input.jwt = cookie.authToken;

    return (
      request.getBoolean("cookieAuth") &&
      request.input.controller === "auth" &&
      SKIP_TOKEN_VERIF_ACTIONS.has(request.input.action)
    );
  }

  _isLogin(request: KuzzleRequest) {
    return (
      request.input.controller === "auth" && request.input.action === "login"
    );
  }

  /**
   * Executes the request immediately.
   * /!\ To be used only by methods having already passed the overload check.
   *
   * @param {KuzzleRequest} request
   * @returns {Promise}
   */
  async processRequest(request: KuzzleRequest): Promise<KuzzleRequest> {
    const controller = this.getController(request);

    global.kuzzle.statistics.startRequest(request);
    this.concurrentRequests++;

    let _request = request;

    try {
      this._checkSdkVersion(_request);
      _request = await global.kuzzle.pipe("request:onExecution", _request);
      _request = await this.performDocumentAlias(_request, "before");
      _request = await global.kuzzle.pipe(
        this.getEventName(_request, "before"),
        _request,
      );

      const responseData = await doAction(controller, _request);

      const status = _request.status === 102 ? 200 : _request.status;
      _request.setResult(responseData, { status }); // NOSONAR: TD-20 (#2688)

      if (
        !this.isNativeController(_request.input.controller) &&
        !_request.response.raw
      ) {
        // check if the plugin response can be serialized
        try {
          if (!(responseData instanceof HttpStream)) {
            JSON.stringify(responseData);
          }
        } catch (e) {
          _request.setResult(null); // NOSONAR: TD-20 (#2688)
          throw kerror.get("plugin", "controller", "unserializable_response");
        }
      }

      _request = await global.kuzzle.pipe(
        this.getEventName(_request, "after"),
        _request,
      );

      _request = await this.performDocumentAlias(_request, "after");
      _request = await global.kuzzle.pipe("request:onSuccess", _request);
      global.kuzzle.statistics.completedRequest(_request);
    } catch (error) {
      return this.handleProcessRequestError(_request, _request, error);
    } finally {
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
  async performDocumentAlias(
    request: KuzzleRequest,
    prefix: string,
  ): Promise<KuzzleRequest> {
    const { controller, action } = request.input;
    const mustTrigger =
      controller === "document" &&
      this.documentEventAliases.mirrorList[action] &&
      (prefix !== "before" ||
        !this.documentEventAliases.notBefore.includes(action));

    if (!mustTrigger) {
      return request;
    }

    const alias = this.documentEventAliases.mirrorList[action];
    const event = `${this.documentEventAliases.namespace}:${prefix}${capitalize(
      alias,
    )}`;
    const extractor = new DocumentExtractor(request);

    const documents = await global.kuzzle.pipe(
      event,
      extractor.extract(),
      request,
    );

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
   * @param {KuzzleRequest} request
   * @returns {Promise}
   */
  async executePluginRequest(request: KuzzleRequest) {
    if (request.input.triggerEvents) {
      let error;
      let res;
      try {
        const { result } = await this.processRequest(request);
        debug(
          "Request %s successfully executed. Result: %a",
          request.id,
          result,
        );
        res = result;
        return { ...result };
      } catch (e) {
        error = e;
        debug("Error processing request %s: %a", request.id, error);
      } finally {
        global.kuzzle.pipe("request:afterExecution", {
          error: error,
          request: request,
          result: res,
          success: error === undefined,
        });
      }
    }
    try {
      return await doAction(this.getController(request), request);
    } catch (e) {
      this.handleErrorDump(e);
      throw e;
    }
  }

  async handleProcessRequestError(
    modifiedRequest: KuzzleRequest,
    request: KuzzleRequest,
    error: Error,
  ) {
    let _error = this._wrapError(request, error);
    modifiedRequest.setError(_error);

    try {
      const updated = await global.kuzzle.pipe(
        this.getEventName(modifiedRequest, "error"),
        modifiedRequest,
      );

      // If there is no pipe attached on this event, the same request is
      // passed in resolve and we should reject it
      if (updated.error !== null) {
        throw updated.error;
      }
      // Pipe recovered from the error: returned the new result
      return updated;
    } catch (err) {
      _error = this._wrapError(request, err);
    }

    // Handling the error thrown by the error pipe
    modifiedRequest.setError(_error);
    global.kuzzle.statistics.failedRequest(request);

    try {
      const updated = await global.kuzzle.pipe(
        "request:onError",
        modifiedRequest,
      );

      if (updated === modifiedRequest) {
        throw modifiedRequest.error;
      }

      return updated;
    } catch (err) {
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
  getEventName(request: KuzzleRequest, prefix: string): string {
    const event =
      request.input.controller === "memoryStorage"
        ? "ms"
        : request.input.controller;

    return `${event}:${prefix}${capitalize(request.input.action)}`;
  }

  /**
   * Returns the number of remaining requests
   *
   * @returns {number}
   */
  get remainingRequests() {
    return this.concurrentRequests + this.pendingRequestsQueue.length;
  }

  /**
   * Return the controller corresponding to the action asked by the request
   *
   * @param  {Request} request
   * @returns {Object} controller object
   * @throws {BadRequestError} If the asked controller or action is unknown
   */
  getController(request: KuzzleRequest): NativeController {
    for (const controllers of [
      this.controllers,
      global.kuzzle.pluginsManager.controllers,
    ]) {
      const controller = controllers.get(request.input.controller);

      if (controller) {
        if (controller._isAction(request.input.action)) {
          return controller;
        }

        throw processError.get(
          "action_not_found",
          request.input.controller,
          request.input.action,
        );
      }
    }

    throw processError.get("controller_not_found", request.input.controller);
  }

  /**
   * Tell if the controller is a native controller or not
   * @param  {String}  controller
   * @returns {Boolean}
   */
  isNativeController(controller: string): boolean {
    return this.controllers.has(controller);
  }

  /**
   * Returns inner metrics from the Funnel
   * @returns {Object}
   */
  metrics() {
    return {
      concurrentRequests: this.concurrentRequests,
      pendingRequests: this.pendingRequestsQueue.length,
    };
  }

  /**
   * If the request is coming from an official SDK,
   * then checks the compatibility of the SDK against current Kuzzle version.
   *
   * @param {Request} request
   *
   * @throws
   */
  _checkSdkVersion(request: KuzzleRequest): void {
    if (!global.kuzzle.config.server.strictSdkVersion) {
      return;
    }

    const sdkVersion = request.input.volatile?.sdkVersion;
    const sdkName = request.input.volatile?.sdkName;

    // sdkVersion property is only used by Kuzzle v1 SDKs
    if (sdkVersion) {
      throw processError.get(
        "incompatible_sdk_version",
        sdkVersion,
        "Kuzzle v2",
      );
    }

    if (!sdkName || typeof sdkName !== "string") {
      return;
    }

    const separatorIdx = sdkName.indexOf("@"),
      name = sdkName.substring(0, separatorIdx),
      version = sdkName.substring(separatorIdx + 1);

    if (name.length === 0 || version.length === 0) {
      return;
    }

    const requirements = this.sdkCompatibility[name];
    if (!requirements) {
      return;
    }

    if (!satisfiesMajor(version, requirements)) {
      const hint = `min: ${requirements.min || "none"}, max: ${
        requirements.max || "none"
      }`;

      throw processError.get("incompatible_sdk_version", version, hint);
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
  _executeError(
    error: Error,
    request: KuzzleRequest,
    asError: boolean,
    callback: ExecuteCallback,
  ): null {
    request.setError(error);

    if (asError) {
      callback(error, request);
      this.handleErrorDump(error);
    } else {
      callback(null, request);
    }

    return null;
  }

  /**
   * Background task. Checks if there are any requests in cache, and replay them
   * if Kuzzle is not overloaded anymore,
   */
  _playPendingRequests() {
    // If there is room to play bufferized requests, do it now. If not, retry later
    const quantityToInject = Math.min(
      this.pendingRequestsQueue.length,
      global.kuzzle.config.limits.concurrentRequests - this.concurrentRequests,
    );

    if (quantityToInject > 0) {
      for (let i = 0; i < quantityToInject; i++) {
        const pendingItem = this.pendingRequestsById.get(
          this.pendingRequestsQueue.peekFront(),
        );

        try {
          if (
            this.throttle(
              pendingItem.fn,
              pendingItem.context,
              pendingItem.request,
            )
          ) {
            this.pendingRequestsQueue.shift();
          } else {
            break;
          }
        } catch (error) {
          break;
        }
      }
    }

    if (this.pendingRequestsQueue.length > 0) {
      setTimeout(() => this._playPendingRequests(), 0);
    } else {
      const now = Date.now();
      // No request remaining in cache => stop the background task and return to normal behavior
      this.overloaded = false;

      if (
        this.overloadWarned &&
        (this.lastOverloadTime === 0 || this.lastOverloadTime < now - 500)
      ) {
        this.overloadWarned = false;
        this.logger.info("End of overloaded state. Resuming normal activity.");
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
  _wrapError(request: KuzzleRequest, error: Error): Error {
    // TD-21 (https://github.com/kuzzleio/kuzzle/issues/2687):
    // `isNativeController` expects a controller NAME, but a whole
    // request is passed here — so the guard is always false and every
    // non-KuzzleError gets wrapped as a plugin error, native controllers
    // included. Fixing it changes behaviour (and the specs encode the current
    // one), so the conversion preserves it and casts explicitly.
    if (
      !this.isNativeController(request as unknown as string) &&
      !(error instanceof KuzzleError)
    ) {
      return kerror.getFrom(
        error,
        "plugin",
        "runtime",
        "unexpected_error",
        error.message,
      );
    }

    return error;
  }

  /**
   * Verifies if requests sent from a specific origin are allowed
   * @param {string} origin
   * @returns
   */
  _isOriginAuthorized(origin: string): boolean {
    const httpConfig = global.kuzzle.config.http;

    if (!origin) {
      return true;
    }

    if (global.kuzzle.config.internal.allowAllOrigins) {
      return true;
    }

    if (httpConfig.accessControlAllowOriginUseRegExp) {
      for (const re of httpConfig.accessControlAllowOrigin as RegExp[]) {
        if (re.test(origin)) {
          return true;
        }
      }
      return false;
    }

    return (httpConfig.accessControlAllowOrigin as string[]).includes(origin);
  }
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalize(string: string): string {
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
function doAction(controller: NativeController, request: KuzzleRequest) {
  const ret = controller[request.input.action](request);

  if (!ret || typeof ret.then !== "function") {
    return kerror.reject(
      "plugin",
      "controller",
      "invalid_action_response",
      request.input.controller,
      request.input.action,
    );
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
function satisfiesMajor(
  version: string,
  requirements: SdkRequirements,
): boolean {
  let maxRequirement = true,
    minRequirement = true;

  if (requirements.min) {
    minRequirement = version[0] >= requirements.min.toString();
  }

  if (requirements.max) {
    maxRequirement = version[0] <= requirements.max.toString();
  }

  return maxRequirement && minRequirement;
}

export = Funnel;
