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
const Koncorde = require('koncorde');
const {
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
  RequestContext,
  RequestInput,
  Request,
} = require('kuzzle-common-objects');

const { EmbeddedSDK } = require('../shared/sdk/embeddedSdk');
const PluginRepository = require('./pluginRepository');
const IndexStorage = require('../storage/indexStorage');
const Elasticsearch = require('../../service/storage/elasticsearch');
const { isPlainObject } = require('../../util/safeObject');
const Promback = require('../../util/promback');
const kerror = require('../../kerror');

const contextError = kerror.wrap('plugin', 'context');

/**
 * @class PluginContext
 * @property {object} accessors
 * @property {KuzzleConfiguration} config
 * @property {object} constructors
 * @property {object} errors
 */
class PluginContext {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} pluginName
   * @constructor
   */
  constructor(kuzzle, pluginName) {
    // we have a circular dependency between Kuzzle and the plugins.
    // We cannot get Kuzzle constructor from the global scope
    const Kuzzle = require('../../kuzzle');

    this.accessors = {};
    this.config = JSON.parse(JSON.stringify(kuzzle.config));
    this.constructors = {
      BaseValidationType: require('../validation/baseType'),
      Koncorde,
      Request: instantiateRequest,
      RequestContext,
      RequestInput
    };

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

    this.secrets = JSON.parse(JSON.stringify(kuzzle.vault.secrets));

    if (kuzzle instanceof Kuzzle) {
      const
        pluginIndex = `plugin-${pluginName}`.toLowerCase(), // uppercase are forbidden by ES
        pluginIndexStorage = new IndexStorage(
          pluginIndex,
          kuzzle.storageEngine.internal);

      /**
       * @param {string} collection
       * @param {?function} ObjectConstructor
       */
      this.constructors.Repository = function PluginContextRepository (
        collection,
        ObjectConstructor = null
      ) {
        if (! collection) {
          throw contextError.get('missing_collection');
        }
        const pluginRepository = new PluginRepository(
          kuzzle,
          pluginIndex,
          collection);

        pluginRepository.init({
          ObjectConstructor,
          cacheEngine: null,
          indexStorage: pluginIndexStorage
        });

        return {
          create: (...args) => pluginRepository.create(...args),
          createOrReplace: (...args) => pluginRepository.createOrReplace(...args),
          delete: (...args) => pluginRepository.delete(...args),
          get: (...args) => pluginRepository.load(...args),
          mGet: (...args) => pluginRepository.loadMultiFromDatabase(...args),
          replace: (...args) => pluginRepository.replace(...args),
          search: (...args) => pluginRepository.search(...args),
          update: (...args) => pluginRepository.update(...args)
        };
      };

      this.constructors.ESClient = function PluginContextESClient () {
        return Elasticsearch.buildClient(kuzzle.storageEngine.config.client);
      };

      /* context.log ======================================================== */
      Reflect.defineProperty(this, 'log', {
        enumerable: true,
        get: () => {
          return {
            debug: msg => kuzzle.log.debug(`[${pluginName}] ${msg}`),
            error: msg => kuzzle.log.error(`[${pluginName}] ${msg}`),
            info: msg => kuzzle.log.info(`[${pluginName}] ${msg}`),
            silly: msg => kuzzle.log.silly(`[${pluginName}] ${msg}`),
            verbose: msg => kuzzle.log.verbose(`[${pluginName}] ${msg}`),
            warn: msg => kuzzle.log.warn(`[${pluginName}] ${msg}`)
          };
        }
      });

      /* context.accessors ================================================== */

      Reflect.defineProperty(this.accessors, 'storage', {
        enumerable: true,
        get: () => {
          return {
            bootstrap: collections => pluginIndexStorage.init(collections),
            createCollection: (collection, mappings) => (
              pluginIndexStorage.createCollection(collection, { mappings })
            )
          };
        }
      });

      Reflect.defineProperty(this.accessors, 'execute', {
        enumerable: true,
        get: () => (...args) => execute(kuzzle, ...args)
      });

      Reflect.defineProperty(this.accessors, 'validation', {
        enumerable: true,
        get: () => {
          return {
            addType: kuzzle.validation.addType.bind(kuzzle.validation),
            validate: kuzzle.validation.validate.bind(kuzzle.validation)
          };
        }
      });

      Reflect.defineProperty(this.accessors, 'strategies', {
        enumerable: true,
        get: () => {
          return {
            add: curryAddStrategy(kuzzle, pluginName),
            remove: curryRemoveStrategy(kuzzle, pluginName)
          };
        }
      });

      Reflect.defineProperty(this.accessors, 'trigger', {
        enumerable: true,
        get: () => (eventName, payload) => (
          kuzzle.pipe(`plugin-${pluginName}:${eventName}`, payload)
        )
      });

      Reflect.defineProperty(this.accessors, 'sdk', {
        enumerable: true,
        get: () => new EmbeddedSDK(kuzzle)
      });
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
 * @param {Request} request
 * @param {Object} data
 * @param {Object} [options]
 * @returns {Request}
 */
function instantiateRequest(request, data, options = {}) {
  let
    _request = request,
    _data = data,
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

module.exports = PluginContext;
