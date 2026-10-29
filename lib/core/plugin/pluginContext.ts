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
import _ from "lodash";
import { Koncorde } from "../shared/KoncordeWrapper";
import type { JSONObject } from "../../types/JSONObject";

import { KuzzleRequest, RequestContext, RequestInput } from "../../api/request";
import BaseValidationType from "../validation/baseType";

import * as kerror from "../../kerror";
import {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  KuzzleError,
  InternalError as KuzzleInternalError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../kerror/errors";
import { createNativeStorageClient } from "../../service/storage/builtInDrivers";
import { withLock } from "../../util/distributedLock";
import { Mutex } from "../../util/mutex";
import Promback from "../../util/promback";
import { isPlainObject } from "../../util/safeObject";
import { BackendCluster } from "../backend/backendCluster";
import { EmbeddedSDK } from "../shared/sdk/embeddedSdk";
import { Store } from "../shared/store";
import { storeScopeEnum } from "../storage/storeScopeEnum";
import PluginRepository from "./pluginRepository";
import type { KuzzleLogger } from "kuzzle-logger/dist";
import type { Kuzzle } from "../../kuzzle";

const contextError = kerror.wrap("plugin", "context");

type ESClientConstructor = PluginContext["constructors"]["ESClient"];
type RepositoryConstructor = PluginContext["constructors"]["Repository"];

/**
 * Declared as v2.56.0 declared it. The answers stay `any` because a precise
 * type would break the plugins that read them without narrowing; the options
 * because the implementation hands them to `ObjectRepository`, which takes an
 * object, and narrowing them here would break a call passing anything else.
 */
export interface Repository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  create(document: JSONObject, options: any): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  createOrReplace(document: JSONObject, options: any): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  delete(documentId: string, options: any): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  get(documentId: string): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  mGet(ids: string[]): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  replace(document: JSONObject, options: any): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  search(query: JSONObject, options: any): Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  update(document: JSONObject, options: any): Promise<any>;
}

export class PluginContext {
  public accessors: {
    /**
     * Embedded SDK
     */
    sdk: EmbeddedSDK;

    /**
     * Trigger a custom plugin event
     *
     * A method signature, not a function-typed property, from here down to
     * `log`: a method's parameters are compared bivariantly, so taking
     * `unknown` instead of v2.56.0's `any` neither breaks a call nor an
     * assignment of a function declaring a narrower parameter.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
    trigger(eventName: string, payload: unknown): Promise<any>;

    /**
     * Add or remove strategies dynamically
     */
    strategies: {
      /**
       * Adds a new authentication strategy
       */
      add(name: string, properties: unknown): Promise<void>;

      /**
       * Removes an authentication strategy, preventing new authentications from using it.
       */
      remove: (name: string) => Promise<void>;
    };

    /**
     * Accessor to the Data Validation API
     */
    validation: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
      addType: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
      validate: any;
    };

    /**
     * Execute an API action.
     *
     * @deprecated use "accessors.sdk" instead (unless you need the original context)
     */
    /**
     * Declared as returning a promise, as v2.56.0 declared it — see
     * {@link PluginExecute}.
     */
    execute: PluginExecute;

    /**
     * Adds or removes realtime subscriptions from the backend.
     */
    subscription: {
      /**
       * Registers a new realtime subscription on behalf of a client.
       */
      register: (
        connectionId: string,
        index: string,
        collection: string,
        filters: JSONObject,
      ) => Promise<{ roomId: string }>;

      /**
       * Removes a realtime subscription on an existing `roomId` and `connectionId`
       */
      unregister: (
        connectionId: string,
        roomId: string,
        notify: boolean,
      ) => Promise<void>;
    };

    /**
     * Initializes the plugin's private data storage.
     */
    storage: {
      /**
       * Initializes the plugin storage
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
      bootstrap: (collections: any) => Promise<void>;

      /**
       * Creates a collection in the plugin storage
       */
      createCollection(collection: string, mappings: unknown): Promise<void>;
    };

    /**
     * Cluster accessor
     * @type {BackendCluster}
     */
    cluster: BackendCluster;

    /**
     * Current Kuzzle node unique identifier
     */
    nodeId: string;

    /**
     * The Kuzzle instance itself.
     *
     * Only present for plugins declared `privileged` in their manifest:
     * `PrivilegedPluginContext` is what sets it.
     */
    kuzzle?: Kuzzle;
  };

  public config: JSONObject;

  public constructors: {
    /**
     * @todo need documentation
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
    BaseValidationType: any;
    /**
     * @deprecated import directly: `import { Koncorde } from 'kuzzle'`
     */
    Koncorde: typeof Koncorde;
    /**
     * Mutex class
     */
    Mutex: typeof Mutex;
    /**
     * Plugin private storage space
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
    Repository: new (collection: string, objectConstructor: any) => Repository;
    /**
     * Instantiate a new Request from the original one, or from raw data.
     */
    Request: PluginRequestConstructor;
    /**
     * @deprecated import directly: `import { RequestContext } from 'kuzzle'`
     */
    RequestContext: typeof RequestContext;
    /**
     * @deprecated import directly: `import { RequestInput } from 'kuzzle'`
     */
    RequestInput: typeof RequestInput;

    /**
     * Constructor for Elasticsearch SDK Client
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
    ESClient: new () => any;
  };

  /**
   * @deprecated import directly: `import { BadRequestError, ... } from 'kuzzle'`
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  public errors: any;

  /**
   * Errors manager
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  public kerror: any;

  /**
   * @deprecated use `PluginContext.kerror` instead
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  public errorsManager: any;

  /**
   * Decrypted secrets from Kuzzle Vault
   */
  public secrets: JSONObject;

  /**
   * Logger instance
   */
  public logger: KuzzleLogger;

  /**
   * Internal Logger
   */
  public log: {
    debug(message: unknown): void;
    error(message: unknown): void;
    info(message: unknown): void;
    silly(message: unknown): void;
    verbose(message: unknown): void;
    warn(message: unknown): void;
  };

  constructor(pluginName: string) {
    this.config = JSON.parse(JSON.stringify(global.kuzzle.config));

    Object.freeze(this.config);

    // @deprecated - backward compatibility only
    this.errors = {
      BadRequestError,
      ExternalServiceError,
      ForbiddenError,
      GatewayTimeoutError,
      InternalError: KuzzleInternalError,
      KuzzleError,
      NotFoundError,
      PartialError,
      PluginImplementationError,
      PreconditionError,
      ServiceUnavailableError,
      SizeLimitError,
      TooManyRequestsError,
      UnauthorizedError,
    };
    this.kerror = kerror.wrap("plugin", pluginName);

    // @deprecated - backward compatibility only
    this.errorsManager = this.kerror;

    /* context.secrets ====================================================== */

    this.secrets = JSON.parse(JSON.stringify(global.kuzzle.vault.secrets));

    Object.freeze(this.secrets);

    // uppercase are forbidden by ES
    const pluginIndex = `plugin-${pluginName}`.toLowerCase();

    /* context.constructors =============================================== */

    const pluginStore = new Store(pluginIndex, storeScopeEnum.PRIVATE);

    // eslint-disable-next-line no-inner-declarations
    function PluginContextRepository(
      collection: string,
      ObjectConstructor: (new () => unknown) | null = null,
    ) {
      if (!collection) {
        throw contextError.get("missing_collection");
      }

      const pluginRepository = new PluginRepository(pluginStore, collection);

      pluginRepository.init({
        ObjectConstructor: ObjectConstructor ?? undefined,
      });

      return {
        create: (...args) => pluginRepository.create(...args),
        createOrReplace: (...args) => pluginRepository.createOrReplace(...args),
        delete: (...args) => pluginRepository.delete(...args),
        get: (...args) => pluginRepository.load(...args),
        mGet: (...args) => pluginRepository.loadMultiFromDatabase(...args),
        replace: (...args) => pluginRepository.replace(...args),
        search: (...args) => pluginRepository.search(...args),
        update: (...args) => pluginRepository.update(...args),
      } as Repository;
    }

    function PluginContextESClient() {
      return createNativeStorageClient(
        global.kuzzle.config.services.storageEngine,
        global.kuzzle.config.services.storageEngine.client,
      );
    }

    this.constructors = {
      BaseValidationType,
      // Plain functions called with `new`, like `Request` below: each returns
      // an object, so `new` yields that object.
      ESClient: PluginContextESClient as unknown as ESClientConstructor,
      Koncorde,
      Mutex: Mutex,
      Repository: PluginContextRepository as unknown as RepositoryConstructor,
      // A plain function called with `new`: it returns an object, so `new`
      // yields that object — which is what plugins have always relied on.
      Request: instantiateRequest as unknown as PluginRequestConstructor,
      RequestContext,
      RequestInput,
    };

    Object.freeze(this.constructors);

    this.logger = globalThis.kuzzle.log.child(`${pluginName}`);

    /* context.log ======================================================== */
    // @deprecated backward compatibility only
    this.log = {
      debug: (msg) => this.logger.debug(`[${pluginName}] ${msg}`),
      error: (msg) => this.logger.error(`[${pluginName}] ${msg}`),
      info: (msg) => this.logger.info(`[${pluginName}] ${msg}`),
      silly: (msg) => this.logger.trace(`[${pluginName}] ${msg}`),
      verbose: (msg) => this.logger.trace(`[${pluginName}] ${msg}`),
      warn: (msg) => this.logger.warn(`[${pluginName}] ${msg}`),
    };

    Object.freeze(this.log);

    /* context.accessors ================================================== */

    this.accessors = {
      cluster: new BackendCluster(),
      execute,
      nodeId: global.nodeId,
      sdk: new EmbeddedSDK(),
      storage: {
        bootstrap: (collections) => pluginStore.init(collections),
        createCollection: (collection, mappings) =>
          pluginStore.createCollection(collection, { mappings }),
      },
      strategies: {
        add: curryAddStrategy(pluginName),
        remove: curryRemoveStrategy(pluginName),
      },
      subscription: {
        register: (connectionId, index, collection, filters) => {
          const request = new KuzzleRequest(
            {
              action: "subscribe",
              body: filters,
              collection,
              controller: "realtime",
              index,
            },
            {
              connectionId: connectionId,
            },
          );
          return global.kuzzle.ask("core:realtime:subscribe", request);
        },
        unregister: (connectionId, roomId, notify) =>
          global.kuzzle.ask(
            "core:realtime:unsubscribe",
            connectionId,
            roomId,
            notify,
          ),
      },
      trigger: (eventName, payload) =>
        global.kuzzle.pipe(`plugin-${pluginName}:${eventName}`, payload),
      validation: {
        addType: global.kuzzle.validation.addType.bind(
          global.kuzzle.validation,
        ),
        validate: global.kuzzle.validation.validate.bind(
          global.kuzzle.validation,
        ),
      },
    };

    // @todo freeze the "accessors" object once we don't have
    // the PriviledgedContext anymore
  }
}

/**
 * `context.accessors.execute`, as v2.56.0 declared it.
 *
 * Without a callback (or with `null`), the answer is a promise of the
 * request. With a callback — called as `callback(error, request)` — the
 * answer goes there, and **nothing is returned at runtime** (`null`): the
 * declared promise does not exist in that form, so do not chain on it. It is
 * declared all the same because v2.56.0 declared it so, and code compiled
 * against that (`execute(request, callback).then(...)`) must still compile;
 * a `Promise | null` return made every `await execute(request)` of a
 * `strict` plugin a compile error.
 */
export type PluginExecute = (
  request: KuzzleRequest,
  callback?: unknown,
) => Promise<KuzzleRequest>;

/**
 * @param {KuzzleRequest} request
 * @param {Function} [callback]
 */
function execute(
  request: KuzzleRequest,
  callback?: unknown,
): Promise<KuzzleRequest>;
/**
 * The implementation says what it really returns: `null` in callback mode.
 * The signature above is the declared one — see {@link PluginExecute}.
 */
function execute(
  request: KuzzleRequest,
  callback?: unknown,
): Promise<KuzzleRequest> | null {
  // `null` means "no callback", as `undefined` does: plugins pass it to ask
  // for a promise explicitly.
  if (
    callback !== undefined &&
    callback !== null &&
    !isPrombackCallback(callback)
  ) {
    const error = contextError.get("invalid_callback", typeof callback);
    global.kuzzle.log.error(error);
    return Bluebird.reject(error);
  }

  const promback = new Promback<KuzzleRequest>(
    isPrombackCallback(callback) ? callback : null,
  );

  if (!request || _.isEmpty(request)) {
    return asRequestPromise(
      promback.reject(contextError.get("missing_request")),
      request,
    );
  }

  if (
    request.input.controller === "realtime" &&
    request.input.action !== null &&
    ["subscribe", "unsubscribe"].includes(request.input.action)
  ) {
    return asRequestPromise(
      promback.reject(
        contextError.get("unavailable_realtime", request.input.action),
      ),
      request,
    );
  }

  request.clearError();
  request.status = 102;

  global.kuzzle.funnel
    .executePluginRequest(request)
    .then((result) => {
      // No status: a pending 102 becomes 200, any other is kept.
      request.response.configure({ result });

      promback.resolve(request);
    })
    .catch((err) => {
      promback.reject(err);
    });

  return asRequestPromise(promback.deferred, request);
}

/** Whether a plugin handed `accessors.execute` something callable. */
function isPrombackCallback(
  value: unknown,
): value is (error: unknown, result?: KuzzleRequest) => void {
  return typeof value === "function";
}

/**
 * What `execute` answers, from a `Promback`'s deferred.
 *
 * `deferred` is null in callback mode — the caller gets its answer that way,
 * and the JavaScript returned that null — and otherwise settles on
 * `KuzzleRequest | undefined`, because `Promback.resolve()` may be called
 * with nothing. This one is always settled with the request it was handed,
 * so mapping through it is what turns the union into the contract.
 */
function asRequestPromise(
  deferred: Bluebird<KuzzleRequest | undefined> | null,
  request: KuzzleRequest,
): Bluebird<KuzzleRequest> | null {
  return deferred === null ? null : deferred.then(() => request);
}

/**
 * Copies the three routing fields a plugin's request inherits from the one it
 * was built from.
 *
 * Through `input.args`, which is what `input.resource`'s own deprecation
 * notice points at and what those accessors read and write anyway — the loop
 * this replaces asked `RequestResource` for an index signature it does not
 * have.
 */
function inheritResource(target: KuzzleRequest, source: KuzzleRequest): void {
  const to = target.input.args;
  const from = source.input.args;

  for (const field of ["_id", "index", "collection"]) {
    if (!to[field] && from[field]) {
      to[field] = from[field];
    }
  }
}

/**
 * Instantiates a new Request object, using the provided one
 * to set the context informations
 *
 * @throws
 * @param {Request} request
 * @param {Object} data
 * @param {Object} [options]
 * @returns {Request}
 */
/**
 * `context.constructors.Request`'s two call shapes: from an original request,
 * whose context and input the new one inherits, or from raw request data.
 */
export type PluginRequestConstructor = {
  new (
    request: KuzzleRequest,
    data?: JSONObject,
    options?: JSONObject,
  ): KuzzleRequest;
  new (data: JSONObject, options?: JSONObject): KuzzleRequest;
};

function instantiateRequest(
  request: KuzzleRequest | JSONObject | null,
  data?: JSONObject,
  options: JSONObject = {},
) {
  if (!request) {
    throw contextError.get("missing_request_data");
  }

  // Two call shapes: `(request, data, options)` and `(data, options)`. The
  // first argument is what tells them apart, and reassigning it — which is
  // what the JavaScript did — throws away the narrowing that `instanceof`
  // had just established.
  let _request: KuzzleRequest | null;
  let _data: JSONObject | undefined;
  let _options: JSONObject;

  if (request instanceof KuzzleRequest) {
    _request = request;
    _data = data;
    _options = options;

    Object.assign(_options, _request.context.toJSON());
  } else {
    _request = null;
    _data = request;
    _options = data ?? options;
  }

  const target = new KuzzleRequest(_data, _options);

  // forward informations if a request object was supplied
  if (_request !== null) {
    inheritInput(target, _request, _data);
  }

  return target;
}

/**
 * Copies onto `target` what it did not receive of its own: the routing
 * fields, the arguments, the token and the volatile data.
 */
function inheritInput(
  target: KuzzleRequest,
  source: KuzzleRequest,
  data?: JSONObject,
): void {
  inheritResource(target, source);

  for (const arg of Object.keys(source.input.args)) {
    if (target.input.args[arg] === undefined) {
      target.input.args[arg] = source.input.args[arg];
    }
  }

  if (data?.jwt === undefined && source.input.jwt !== null) {
    target.input.jwt = source.input.jwt;
  }

  if (data) {
    target.input.volatile = {
      ...source.input.volatile,
      ...data.volatile,
    };
  } else if (source.input.volatile !== null) {
    target.input.volatile = source.input.volatile;
  }
}

/**
 * Lock options of `auth:strategies:add` and `auth:strategies:remove`: wait
 * as long as it takes, as the deprecated `Mutex` did (no acquisition
 * timeout), with the same 30 s TTL — now refreshed while the strategy is
 * being added or removed.
 */
const STRATEGY_LOCK = {
  retryAttempts: Number.POSITIVE_INFINITY,
  ttl: 30000,
};

/**
 * Returns a currified function of pluginsManager.registerStrategy
 *
 * @param  {string} pluginName
 * @returns {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryAddStrategy(pluginName: string) {
  return async function addStrategy(name: string, strategy: unknown) {
    // strategy constructors cannot be used directly to dynamically
    // add new strategies, because they cannot
    // be serialized and propagated to other cluster nodes
    // so if a strategy is not defined using an authenticator, we have
    // to reject the call
    if (
      !isPlainObject(strategy) ||
      !isPlainObject(strategy.config) ||
      typeof strategy.config.authenticator !== "string"
    ) {
      throw contextError.get("missing_authenticator", pluginName, name);
    }

    return withLock(
      "auth:strategies:add",
      async () => {
        // @todo use Plugin.checkName to ensure format
        global.kuzzle.pluginsManager.registerStrategy(
          pluginName,
          name,
          strategy,
        );

        return global.kuzzle.pipe("core:auth:strategyAdded", {
          name,
          pluginName,
          strategy,
        });
      },
      STRATEGY_LOCK,
    );
  };
}

/**
 * Returns a currified function of pluginsManager.unregisterStrategy
 *
 * @param  {string} pluginName
 * @returns {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryRemoveStrategy(pluginName: string) {
  // either async or catch unregisterStrategy exceptions + return a rejected
  // promise
  return async function removeStrategy(name: string) {
    return withLock(
      "auth:strategies:remove",
      async () => {
        global.kuzzle.pluginsManager.unregisterStrategy(pluginName, name);

        return global.kuzzle.pipe("core:auth:strategyRemoved", {
          name,
          pluginName,
        });
      },
      STRATEGY_LOCK,
    );
  };
}
