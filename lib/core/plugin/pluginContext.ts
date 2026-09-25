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
import type { JSONObject } from "kuzzle-sdk";

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
import { Elasticsearch } from "../../service/storage/Elasticsearch";
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

export interface Repository {
  create(document: JSONObject, options: any): Promise<any>;

  createOrReplace(document: JSONObject, options: any): Promise<any>;

  delete(documentId: string, options: any): Promise<any>;

  get(documentId: string): Promise<any>;

  mGet(ids: string[]): Promise<any>;

  replace(document: JSONObject, options: any): Promise<any>;

  search(query: JSONObject, options: any): Promise<any>;

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
     */
    trigger: (eventName: string, payload: any) => Promise<any>;

    /**
     * Add or remove strategies dynamically
     */
    strategies: {
      /**
       * Adds a new authentication strategy
       */
      add: (name: string, properties: any) => Promise<void>;

      /**
       * Removes an authentication strategy, preventing new authentications from using it.
       */
      remove: (name: string) => Promise<void>;
    };

    /**
     * Accessor to the Data Validation API
     */
    validation: {
      addType: any;
      validate: any;
    };

    /**
     * Execute an API action.
     *
     * @deprecated use "accessors.sdk" instead (unless you need the original context)
     */
    /**
     * Overloaded on the callback, because the return value depends on it:
     * without one (or with `null`) the answer is a promise; with one, the
     * caller gets its answer there and `null` is returned, which is what this
     * has always done. A single `Promise | null` signature made every
     * `await execute(request)` of a `strict` plugin a compile error.
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
      bootstrap: (collections: any) => Promise<void>;

      /**
       * Creates a collection in the plugin storage
       */
      createCollection: (collection: string, mappings: any) => Promise<void>;
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
    ESClient: new () => any;
  };

  /**
   * @deprecated import directly: `import { BadRequestError, ... } from 'kuzzle'`
   */
  public errors: any;

  /**
   * Errors manager
   */
  public kerror: any;

  /**
   * @deprecated use `PluginContext.kerror` instead
   */
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
    debug: (message: any) => void;
    error: (message: any) => void;
    info: (message: any) => void;
    silly: (message: any) => void;
    verbose: (message: any) => void;
    warn: (message: any) => void;
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
      ObjectConstructor: any = null,
    ) {
      if (!collection) {
        throw contextError.get("missing_collection");
      }

      const pluginRepository = new PluginRepository(pluginStore, collection);

      pluginRepository.init({ ObjectConstructor });

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

    function PluginContextESClient(): any {
      return Elasticsearch.buildClient(
        global.kuzzle.config.services.storageEngine.client,
      );
    }

    this.constructors = {
      BaseValidationType,
      ESClient: PluginContextESClient as any,
      Koncorde,
      Mutex: Mutex,
      Repository: PluginContextRepository as unknown as new (
        collection: string,
        objectConstructor: any,
      ) => Repository,
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
 * `context.accessors.execute`'s call shapes. The callback is called as
 * `callback(error, request)`; it is typed as taking `never` so that a
 * callback of any signature is accepted, as v2.56.0's `any` did.
 */
export type PluginExecute = {
  (request: KuzzleRequest, callback?: null): Promise<KuzzleRequest>;
  (request: KuzzleRequest, callback: (...args: never[]) => unknown): null;
  (request: KuzzleRequest, callback?: unknown): Promise<KuzzleRequest> | null;
};

/**
 * @param {KuzzleRequest} request
 * @param {Function} [callback]
 */
function execute(
  request: KuzzleRequest,
  callback?: null,
): Promise<KuzzleRequest>;
function execute(
  request: KuzzleRequest,
  callback: (...args: never[]) => unknown,
): null;
function execute(
  request: KuzzleRequest,
  callback?: unknown,
): Promise<KuzzleRequest> | null;
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

    const mutex = new Mutex("auth:strategies:add", { ttl: 30000 });

    await mutex.lock();

    try {
      // @todo use Plugin.checkName to ensure format
      global.kuzzle.pluginsManager.registerStrategy(pluginName, name, strategy);

      return await global.kuzzle.pipe("core:auth:strategyAdded", {
        name,
        pluginName,
        strategy,
      });
    } finally {
      await mutex.unlock();
    }
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
    const mutex = new Mutex("auth:strategies:remove", { ttl: 30000 });

    await mutex.lock();

    try {
      global.kuzzle.pluginsManager.unregisterStrategy(pluginName, name);
      return await global.kuzzle.pipe("core:auth:strategyRemoved", {
        name,
        pluginName,
      });
    } finally {
      await mutex.unlock();
    }
  };
}
