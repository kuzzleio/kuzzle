/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
const { Kuzzle: KuzzleSDK } = require('kuzzle-sdk');
const {
  Request,
  models: { RequestContext, RequestInput }
} = require('kuzzle-common-objects');

const errorsManager = require('../../../util/errors');
const FunnelProtocol = require('../sdk/funnelProtocol');
const PluginRepository = require('../models/repositories/pluginRepository');
const InternalEngine = require('../../../services/internalEngine/index');
const PluginInternalEngineBootstrap = require('../../../services/internalEngine/pluginBootstrap');
const { deprecateProperties } = require('../../../util/deprecate');
const { isPlainObject } = require('../../../util/safeObject');
const Mutex = require('../../../util/mutex');

const contextError = errorsManager.wrap('plugin', 'context');

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
    this.constructors = deprecateProperties(kuzzle.log, {
      RequestContext,
      RequestInput,
      Koncorde,
      Dsl: Koncorde, // @deprecated, will be removed in v2
      Request: instantiateRequest,
      BaseValidationType: require('../validation/baseType'),
    }, {
      Dsl: 'Koncorde'
    });

    this.errors = require('kuzzle-common-objects').errors;
    this.errorsManager = errorsManager.wrap('plugin', pluginName);

    this.secrets = JSON.parse(JSON.stringify(kuzzle.vault.secrets));

    if (kuzzle instanceof Kuzzle) {
      const
        // Lowercasing the plugin name is needed because Elasticsearch
        // forbids uppercased characters in index names.
        internalEngineIndex = `%plugin:${pluginName}`.toLowerCase(),
        pluginInternalEngine =
          new InternalEngine(kuzzle, internalEngineIndex),
        kuzzleSdk = new KuzzleSDK(new FunnelProtocol(kuzzle.funnel));

      pluginInternalEngine.init(
        new PluginInternalEngineBootstrap(
          pluginName,
          kuzzle,
          pluginInternalEngine));

      Object.defineProperty(this, 'log', {
        enumerable: true,
        get: () => {
          return {
            silly: (...args) => kuzzle.log.silly(...args),
            verbose: (...args) => kuzzle.log.verbose(...args),
            info: (...args) => kuzzle.log.info(...args),
            debug: (...args) => kuzzle.log.debug(...args),
            warn: (...args) => kuzzle.log.warn(...args),
            error: (...args) => kuzzle.log.error(...args)
          };
        }
      });

      Object.defineProperty(this.accessors, 'execute', {
        enumerable: true,
        get: () => (...args) => execute(kuzzle, ...args)
      });

      Object.defineProperty(this.accessors, 'validation', {
        enumerable: true,
        get: () => {
          return {
            addType: kuzzle.validation.addType.bind(kuzzle.validation),
            validate: kuzzle.validation.validate.bind(kuzzle.validation)
          };
        }
      });

      Object.defineProperty(this.accessors, 'storage', {
        enumerable: true,
        get: () => {
          return {
            bootstrap: pluginInternalEngine.bootstrap.all.bind(
              pluginInternalEngine.bootstrap
            ),
            createCollection:
              pluginInternalEngine.bootstrap.createCollection.bind(
                pluginInternalEngine.bootstrap
              )
          };
        }
      });

      Object.defineProperty(this.accessors, 'strategies', {
        enumerable: true,
        get: () => {
          return {
            add: curryAddStrategy(kuzzle, pluginName),
            remove: curryRemoveStrategy(kuzzle, pluginName)
          };
        }
      });

      Object.defineProperty(this.accessors, 'trigger', {
        enumerable: true,
        get: () => curryTrigger(kuzzle, pluginName)
      });

      const throwNotAvailable = name => () => {
        contextError.throw('unavailable_realtime', name);
      };

      const getPluginSdk = sdk => ({
        query: sdk.query.bind(sdk),
        auth: sdk.auth,
        bulk: sdk.bulk,
        collection: sdk.collection,
        document: sdk.document,
        index: sdk.index,
        ms: sdk.ms,
        realtime: Object.assign(sdk.realtime, {
          subscribe: throwNotAvailable('realtime:subscribe'),
          unsubscribe: throwNotAvailable('realtime:unsubscribe')
        }),
        security: sdk.security,
        server: sdk.server
      });

      Object.defineProperty(this.accessors, 'sdk', {
        enumerable: true,
        get: () => {
          const pluginSdk = getPluginSdk(kuzzleSdk);

          pluginSdk.as = user => {
            if (typeof user._id !== 'string') {
              contextError.throw('invalid_user');
            }

            return getPluginSdk(
              new KuzzleSDK(new FunnelProtocol(kuzzle.funnel, user)));
          };

          return pluginSdk;
        }
      });

      /**
       * @param {string} collection
       * @param {?function} ObjectConstructor
       */
      this.constructors.Repository = function PluginContextRepository (
        collection,
        ObjectConstructor = null
      ) {
        let pluginRepository;

        if (!collection) {
          contextError.throw('missing_collection');
        }

        pluginRepository =
          new PluginRepository(kuzzle, internalEngineIndex, collection);
        pluginRepository.init(
          {databaseEngine: pluginInternalEngine,
            cacheEngine: null,
            ObjectConstructor}
        );

        return {
          search: pluginRepository.search.bind(pluginRepository),
          get: pluginRepository.load.bind(pluginRepository),
          mGet: pluginRepository.loadMultiFromDatabase.bind(pluginRepository),
          delete: pluginRepository.delete.bind(pluginRepository),
          create: pluginRepository.create.bind(pluginRepository),
          createOrReplace: pluginRepository.createOrReplace.bind(
            pluginRepository
          ),
          replace: pluginRepository.replace.bind(pluginRepository),
          update: pluginRepository.update.bind(pluginRepository)
        };
      };

      this.constructors.Mutex = function CreateMutex (id, opts) {
        return new Mutex(kuzzle, id, opts);
      };
    }
  }
}

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {Function} [callback]
 */
function execute (kuzzle, request, callback) {
  let
    error,
    resolve,
    reject,
    deferred;

  if (callback && typeof callback !== 'function') {
    error = contextError.get('invalid_callback', typeof callback);
    kuzzle.log.error(error);
    return Bluebird.reject(error);
  }

  if (!callback) {
    deferred = new Bluebird((res, rej) => {
      resolve = res;
      reject = rej;
    });
  }

  if (!request || !(request instanceof Request)) {
    error = contextError.get('missing_request');

    if (callback) {
      return callback(error);
    }

    reject(error);
    return deferred;
  }

  if (request.input.controller === 'realtime'
    && ['subscribe', 'unsubscribe'].includes(request.input.action)
  ) {
    const err = contextError.get('unavailable_realtime', request.input.action);

    if (callback) {
      return callback(err);
    }

    return Bluebird.reject(err);
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
      if (callback) {
        return callback(null, request);
      }

      resolve(request);
    })
    .catch(err => {
      if (callback) {
        return callback(err);
      }
      reject(err);
    });

  if (!callback) {
    return deferred;
  }
}

/**
 * Returns a currified version of kuzzle.pipe
 * The pluginName param
 * is injected in the returned function as it is prepended to the custom event
 * name. This is done to avoid colliding with the kuzzle native events.
 *
 * @param  {Kuzzle} kuzzle
 * @param  {String} pluginName The name of the plugin calling trigger.
 * @return {Function}          A trigger function that makes some checks on the
 *                             event name and prepends the plugin name to the
 *                             event name.
 */
function curryTrigger (kuzzle, pluginName) {
  /**
   * @this   {Kuzzle}
   * @param  {String} eventName The name of the custom event to trigger.
   * @param  {Object} payload   The payload of the event.
   */
  return function trigger (eventName, payload) {
    if (eventName.indexOf(':') !== -1) {
      kuzzle.log.error(contextError.get('invalid_event', eventName));
      return;
    }

    kuzzle.pipe(`plugin-${pluginName}:${eventName}`, payload);
  };
}

/**
 * Instantiates a new Request object, using the provided one
 * to set the context informations
 *
 * @throws
 * @param {Request} request
 * @param {Object} data
 * @param {Object} [options]
 * @return {Request}
 */
function instantiateRequest(request, data, options = {}) {
  let
    _request = request,
    _data = data,
    _options = options;

  if (!_request) {
    contextError.throw('missing_request_data');
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
 * @return {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryAddStrategy(kuzzle, pluginName) {
  return function addStrategy(name, strategy) {
    return new Bluebird((resolve, reject) => {
      // strategy constructors cannot be used directly to dynamically
      // add new strategies, because they cannot
      // be serialized and propagated to other cluster nodes
      // so if a strategy is not defined using an authenticator, we have
      // to reject the call
      if ( !isPlainObject(strategy)
        || !isPlainObject(strategy.config)
        || typeof strategy.config.authenticator !== 'string'
      ) {
        return reject(contextError.get(
          'missing_authenticator',
          pluginName,
          name));
      }

      try {
        kuzzle.pluginsManager.registerStrategy(pluginName, name, strategy);
      } catch (err) {
        return reject(err);
      }

      kuzzle.pipe('core:auth:strategyAdded', {name, strategy, pluginName})
        .then(() => resolve())
        .catch(err => reject(err));
    });
  };
}

/**
 * Returns a currified function of pluginsManager.unregisterStrategy
 *
 * @param  {Kuzzle} kuzzle
 * @param  {string} pluginName
 * @return {function} function taking a strategy name and properties,
 *                    registering it into kuzzle, and returning
 *                    a promise
 */
function curryRemoveStrategy(kuzzle, pluginName) {
  return function removeStrategy(name) {
    return new Bluebird((resolve, reject) => {
      try {
        kuzzle.pluginsManager.unregisterStrategy(pluginName, name);
      } catch (err) {
        return reject(err);
      }

      kuzzle.pipe('core:auth:strategyRemoved', {name, pluginName})
        .then(() => resolve())
        .catch(err => reject(err));
    });
  };
}

module.exports = PluginContext;
