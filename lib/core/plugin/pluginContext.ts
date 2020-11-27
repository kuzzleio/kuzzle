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

import Bluebird from 'bluebird';
import Koncorde from 'koncorde';
import { Client } from '@elastic/elasticsearch';
import { JSONObject } from 'kuzzle-sdk';

import { EmbeddedSDK } from '../shared/sdk/embeddedSdk';
import PluginRepository from './pluginRepository';
import Store from '../shared/store';
import Elasticsearch from '../../service/storage/elasticsearch';
import { isPlainObject } from '../../util/safeObject';
import Promback from '../../util/promback';
import kerror from '../../kerror';
import storeScopeEnum from '../storage/storeScopeEnum';
import {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError as KuzzleInternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../kerror/errors';
import {
  RequestContext,
  RequestInput,
  Request,
} from '../../api/request';
import { InternalLogger } from '../../types';

const contextError = kerror.wrap('plugin', 'context');

export type Repository = {
 create(document: JSONObject, options: JSONObject): Promise<JSONObject>;

 createOrReplace(document: JSONObject, options: JSONObject): Promise<JSONObject>;

 delete(documentId: string, options: JSONObject): Promise<JSONObject>;

 get(documentId: string): Promise<any>;

 mGet(ids: string[]): Promise<any>;

 replace(document: JSONObject, options: JSONObject): Promise<JSONObject>;

 search(query: JSONObject, options: JSONObject): Promise<any>;

 scroll(query: JSONObject, options: JSONObject): Promise<any>;

 update(document: JSONObject, options: JSONObject): Promise<JSONObject>;
}

export type PluginStrategy = {
  /**
   * Adds a new authentication strategy
   */
  add: (name: string, properties: any) => Promise<void>,

  /**
   * Removes an authentication strategy, preventing new authentications from using it.
   */
  remove: (name: string) => Promise<void>
};

export type PluginStorage = {
  /**
   * Initializes the plugin storage
   */
  bootstrap: (collections: JSONObject) => Promise<void>,

  /**
   * Creates a collection in the plugin storage
   */
  createCollection: (collection: string, mappings: JSONObject) => Promise<void>
};

export type Subscription = {
  /**
   * Registers a new realtime subscription on behalf of a client.
   */
  register: (connectionId: string, index: string, collection: string, filters: JSONObject) => Promise<{ roomId: string }>,

  /**
   * Removes a realtime subscription on an existing `roomId` and `connectionId`
   */
  unregister: (connectionId: string, roomId: string, notify: boolean) => Promise<void>
};

export type DataValidation = {
  addType: (ValidationType: BaseValidationType) => Promise<any>,
  validate: (request: Request, verbose: boolean) => Promise<any>
};

export type PluginContextAccessors = {
  /**
   * Embedded SDK
   */
  sdk: EmbeddedSDK,

  /**
   * Triggers a custom plugin event
   */
  trigger: (eventName: string, ...any) => Promise<any>,

  /**
   * Add or remove strategies dynamically
   */
  strategies: PluginStrategy,

  /**
   * Accessor to the Data Validation API
   */
  validation: DataValidation,

  /**
   * Execute an API action.
   */
  execute: (request: Request, callback?: any) => Promise<Request>,

  /**
   * Adds or removes realtime subscriptions from the backend.
   */
  subscription: Subscription,

  /**
   * Initializes the plugin's private data storage.
   */
  storage: PluginStorage
};


/**
 * @todo need documentation
 */
export type BaseValidationType = any;

export type PluginContextConstructors = {
  /**
   * @todo need documentation
   */
  BaseValidationType: new (...any) => BaseValidationType;
  /**
   * @deprecated import directly: `import { Koncorde } from 'kuzzle'`
   */
  Koncorde: Koncorde;
  /**
   * Plugin private storage space
   */
  Repository: new (collection: string, objectConstructor: any) => Repository;
  /**
   * Instantiate a new Request from the original one.
   */
  Request: Request;
  /**
   * @deprecated import directly: `import { RequestContext } from 'kuzzle'`
   */
  RequestContext: RequestContext;
  /**
   * @deprecated import directly: `import { RequestInput } from 'kuzzle'`
   */
  RequestInput: RequestInput;

  /**
   * Constructor for Elasticsearch SDK Client
   */
  ESClient: new () => Client
};

export class PluginContext {
  public accessors: PluginContextAccessors;

  public config: JSONObject;

  public constructors: PluginContextConstructors;

  /**
   * @deprecated import directly: `import { BadRequestError, ... } from 'kuzzle'`
   */
  private errors: any;

  /**
   * Errors manager
   */
  public kerror: any;

  /**
   * @deprecated use `PluginContext.kerror` instead
   */
  private errorsManager: any;

  /**
   * Decrypted secrets from Kuzzle Vault
   */
  public secrets: JSONObject;

  /**
   * Internal Logger
   */
  public log: InternalLogger;

  constructor (kuzzle, pluginName) {
    // we have a circular dependency between Kuzzle and the plugins.
    // We cannot get Kuzzle constructor from the global scope
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Kuzzle = require('../../kuzzle');

    this.config = JSON.parse(JSON.stringify(kuzzle.config));

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
    this.kerror = kerror.wrap('plugin', pluginName);

    // @deprecated - backward compatibility only
    this.errorsManager = this.kerror;

    /* context.secrets ====================================================== */

    this.secrets = JSON.parse(JSON.stringify(kuzzle.vault.secrets));

    Object.freeze(this.secrets);

    if (kuzzle instanceof Kuzzle) {
      // uppercase are forbidden by ES
      const pluginIndex = `plugin-${pluginName}`.toLowerCase();

      /* context.constructors =============================================== */

      const pluginStore = new Store(
        kuzzle,
        pluginIndex,
        storeScopeEnum.PRIVATE);

      // eslint-disable-next-line no-inner-declarations
      function PluginContextRepository (
        collection: string,
        ObjectConstructor: any = null
      ) {
        if (! collection) {
          throw contextError.get('missing_collection');
        }

        const pluginRepository = new PluginRepository(
          kuzzle,
          pluginStore,
          collection);

        pluginRepository.init({ ObjectConstructor });

        return {
          create: (...args) => pluginRepository.create(...args),
          createOrReplace: (...args) => pluginRepository.createOrReplace(...args),
          delete: (...args) => pluginRepository.delete(...args),
          get: (...args) => pluginRepository.load(...args),
          mGet: (...args) => pluginRepository.loadMultiFromDatabase(...args),
          replace: (...args) => pluginRepository.replace(...args),
          search: (...args) => pluginRepository.search(...args),
          scroll: (...args) => pluginRepository.scroll(...args),
          update: (...args) => pluginRepository.update(...args)
        } as Repository;
      }

      // eslint-disable-next-line no-inner-declarations
      function PluginContextESClient () {
        return Elasticsearch
          .buildClient(kuzzle.config.services.storageEngine.client);
      }

      this.constructors = {
        BaseValidationType: require('../validation/baseType'),
        ESClient: PluginContextESClient as unknown as new () => Client,
        Koncorde: Koncorde as any,
        Repository: PluginContextRepository as unknown as new (collection: string, objectConstructor: any) => Repository,
        Request: instantiateRequest as any,
        RequestContext: RequestContext as any,
        RequestInput: RequestInput as any,
      };

      Object.freeze(this.constructors);

      /* context.log ======================================================== */

      this.log = {
        debug: msg => kuzzle.log.debug(`[${pluginName}] ${msg}`),
        error: msg => kuzzle.log.error(`[${pluginName}] ${msg}`),
        info: msg => kuzzle.log.info(`[${pluginName}] ${msg}`),
        verbose: msg => kuzzle.log.verbose(`[${pluginName}] ${msg}`),
        warn: msg => kuzzle.log.warn(`[${pluginName}] ${msg}`)
      };

      Object.freeze(this.log);

      /* context.accessors ================================================== */

      this.accessors = {
        execute: (request, callback) => execute(kuzzle, request, callback),
        sdk: new EmbeddedSDK(kuzzle),
        storage: {
          bootstrap: collections => pluginStore.init(collections),
          createCollection: (collection, mappings) => (
            pluginStore.createCollection(collection, { mappings })
          )
        },
        strategies: {
          add: curryAddStrategy(kuzzle, pluginName),
          remove: curryRemoveStrategy(kuzzle, pluginName)
        },
        subscription: {
          register: (connectionId, index, collection, filters) => {
            const request = new Request(
              {
                action: 'subscribe',
                body: filters,
                collection,
                controller: 'realtime',
                index,
              },
              {
                connectionId: connectionId,
              });
            return kuzzle.ask(
              'core:realtime:subscribe',
              request
            );
          },
          unregister: (connectionId, roomId, notify) =>
            kuzzle.ask(
              'core:realtime:unsubscribe',
              connectionId, roomId, notify
            )
        },
        trigger: (eventName, ...payload) => (
          kuzzle.pipe(`plugin-${pluginName}:${eventName}`, ...payload)
        ),
        validation: {
          addType: kuzzle.validation.addType.bind(kuzzle.validation),
          validate: kuzzle.validation.validate.bind(kuzzle.validation)
        },
      };

      // @todo freeze the "accessors" object once we don't have
      // the PriviledgedContext anymore
    }
  }
}

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {Function} [callback]
 */
function execute (kuzzle, request, callback) {
  if (callback && typeof callback !== 'function') {
    const error = contextError.get('invalid_callback', typeof callback);
    kuzzle.log.error(error);
    return Bluebird.reject(error);
  }

  const promback = new Promback(callback);

  if (!request || !(request instanceof Request)) {
    return promback.reject(contextError.get('missing_request'));
  }

  if ( request.input.controller === 'realtime'
    && ['subscribe', 'unsubscribe'].includes(request.input.action)
  ) {
    return promback.reject(
      contextError.get('unavailable_realtime', request.input.action));
  }

  request.clearError();
  request.status = 102;

  kuzzle.funnel.executePluginRequest(request)
    .then(result => {
      request.setResult(
        result,
        {
          status: request.status === 102 ? 200 : request.status
        }
      );

      promback.resolve(request);
    })
    .catch(err => {
      promback.reject(err);
    });

  return promback.deferred;
}

/**
 * Instantiates a new Request object, using the provided one
 * to set the context informations
 *
 * @throws
 * @param {Request} originalRequest
 * @param {Object} requestPayload
 * @param {Object} [options]
 * @returns {Request}
 */
function instantiateRequest(originalRequest, requestPayload, options = {}) {
  let
    _request = originalRequest,
    _data = requestPayload,
    _options = options;

  if (!_request) {
    throw contextError.get('missing_request_data');
  }

  if (!(_request instanceof Request)) {
    if (_data) {
      _options = _data;
    }

    _data = _request;
    _request = null;
  } else {
    Object.assign(_options, _request.context.toJSON());
  }

  const target = new Request(_data, _options);

  // forward informations if a request object was supplied
  if (_request) {
    for (const resource of ['_id', 'index', 'collection']) {
      if (!target.input.resource[resource]) {
        target.input.resource[resource] = _request.input.resource[resource];
      }
    }

    for (const arg of Object.keys(_request.input.args)) {
      if (target.input.args[arg] === undefined) {
        target.input.args[arg] = _request.input.args[arg];
      }
    }

    if (!_data || _data.jwt === undefined) {
      target.input.jwt = _request.input.jwt;
    }

    if (_data) {
      target.input.volatile = Object.assign(
        {},
        _request.input.volatile,
        _data.volatile);
    } else {
      target.input.volatile = _request.input.volatile;
    }
  }

  return target;
}

/**
 * Returns a currified function of pluginsManager.registerStrategy
 *
 * @param  {Kuzzle} kuzzle
 * @param  {string} pluginName
 * @returns {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryAddStrategy(kuzzle, pluginName) {
  return async function addStrategy(name, strategy) {
    // strategy constructors cannot be used directly to dynamically
    // add new strategies, because they cannot
    // be serialized and propagated to other cluster nodes
    // so if a strategy is not defined using an authenticator, we have
    // to reject the call
    if ( !isPlainObject(strategy)
      || !isPlainObject(strategy.config)
      || typeof strategy.config.authenticator !== 'string'
    ) {
      throw contextError.get('missing_authenticator', pluginName, name);
    }
    // @todo use Plugin.checkName to ensure format
    kuzzle.pluginsManager.registerStrategy(pluginName, name, strategy);

    return kuzzle.pipe(
      'core:auth:strategyAdded',
      {name, pluginName, strategy});
  };
}

/**
 * Returns a currified function of pluginsManager.unregisterStrategy
 *
 * @param  {Kuzzle} kuzzle
 * @param  {string} pluginName
 * @returns {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryRemoveStrategy(kuzzle, pluginName) {
  // either async or catch unregisterStrategy exceptions + return a rejected
  // promise
  return async function removeStrategy(name) {
    kuzzle.pluginsManager.unregisterStrategy(pluginName, name);
    return kuzzle.pipe('core:auth:strategyRemoved', {name, pluginName});
  };
}
