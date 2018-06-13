/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const
  Bluebird = require('bluebird'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  Request = require('kuzzle-common-objects').Request,
  PluginRepository = require('../models/repositories/pluginRepository'),
  InternalEngine = require('../../../services/internalEngine/index'),
  PluginInternalEngineBootstrap = require('../../../services/internalEngine/pluginBootstrap'),
  {RequestContext, RequestInput} = require('kuzzle-common-objects').models;

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
    this.config = kuzzle.config;
    this.constructors = {
      RequestContext,
      RequestInput,
      Dsl: require('koncorde'),
      Request: instantiateRequest,
      BaseValidationType: require('../validation/baseType')
    };
    this.errors = require('kuzzle-common-objects').errors;

    if (kuzzle instanceof Kuzzle) {
      const
        // Lowercasing the plugin name is needed because Elasticsearch
        // forbids uppercased characters in index names.
        internalEngineIndex = `%plugin:${pluginName}`.toLowerCase(),
        pluginInternalEngine = new InternalEngine(kuzzle, internalEngineIndex);

      pluginInternalEngine.init(new PluginInternalEngineBootstrap(pluginName, kuzzle, pluginInternalEngine));

      Object.defineProperty(this, 'log', {
        enumerable: true,
        get: () => {
          return {
            silly: msg => kuzzle.pluginsManager.trigger('log:silly', msg),
            verbose: msg => kuzzle.pluginsManager.trigger('log:verbose', msg),
            info: msg => kuzzle.pluginsManager.trigger('log:info', msg),
            debug: msg => kuzzle.pluginsManager.trigger('log:debug', msg),
            warn: msg => kuzzle.pluginsManager.trigger('log:warn', msg),
            error: msg => kuzzle.pluginsManager.trigger('log:error', msg)
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
            validate: kuzzle.validation.validationPromise.bind(kuzzle.validation)
          };
        }
      });

      Object.defineProperty(this.accessors, 'storage', {
        enumerable: true,
        get: () => {
          return {
            bootstrap: pluginInternalEngine.bootstrap.all.bind(pluginInternalEngine.bootstrap),
            createCollection: pluginInternalEngine.bootstrap.createCollection.bind(pluginInternalEngine.bootstrap)
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

      /**
       * @param {string} collection
       * @param {?function} ObjectConstructor
       */
      this.constructors.Repository = function PluginContextRepository (collection, ObjectConstructor = null) {
        let pluginRepository;

        if (!collection) {
          throw new PluginImplementationError('The collection must be specified.');
        }

        pluginRepository = new PluginRepository(kuzzle, internalEngineIndex, collection);
        pluginRepository.init({databaseEngine: pluginInternalEngine, cacheEngine: null, ObjectConstructor});

        return {
          search: pluginRepository.search.bind(pluginRepository),
          get: pluginRepository.load.bind(pluginRepository),
          mGet: pluginRepository.loadMultiFromDatabase.bind(pluginRepository),
          delete: pluginRepository.delete.bind(pluginRepository),
          create: pluginRepository.create.bind(pluginRepository),
          createOrReplace: pluginRepository.createOrReplace.bind(pluginRepository),
          replace: pluginRepository.replace.bind(pluginRepository),
          update: pluginRepository.update.bind(pluginRepository)
        };
      };
    }
  }
}

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {boolean} [overloadProtect]
 * @param {Function} [callback]
 */
function execute (kuzzle, request, callback) {
  let
    error,
    resolve,
    reject,
    deferred;

  if (callback && typeof callback !== 'function') {
    error = new PluginImplementationError(`Invalid argument: Expected callback to be a function, received "${typeof callback}"`);
    kuzzle.pluginsManager.trigger('log:error', error);
    return Bluebird.reject(error);
  }

  if (!callback) {
    deferred = new Bluebird((res, rej) => {
      resolve = res;
      reject = rej;
    });
  }

  if (!request || !(request instanceof Request)) {
    error = new PluginImplementationError('Invalid argument: a Request object must be supplied');
    if (callback) {
      return callback(error);
    }

    reject(error);
    return deferred;
  }

  kuzzle.funnel.executePluginRequest(request, (err, response) => {
    if (callback) {
      try {
        callback(err, response);
      }
      catch (e) {
        kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError(e));

        if (err) {
          kuzzle.pluginsManager.trigger('log:error', `Previous error: ${err}`);
        }
      }
    }
    else {
      if (err) {
        return reject(err);
      }

      resolve(response);
    }
  });

  if (!callback) {
    return deferred;
  }
}

/**
 * Returns a currified version of pluginsManager.trigger. The pluginName param
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
      kuzzle.pluginsManager.trigger(
        'log:error',
        new PluginImplementationError(`Custom event invalid name (${eventName}). Colons are not allowed in custom events.`)
      );
      return;
    }

    kuzzle.pluginsManager.trigger(`plugin-${pluginName}:${eventName}`, payload);
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
    throw new PluginImplementationError('A Request object and/or request data must be provided');
  }

  if (!(_request instanceof Request)) {
    if (_data) {
      _options = _data;
    }

    _data = _request;
    _request = null;
  }
  else {
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
      target.input.volatile = Object.assign({}, _request.input.volatile, _data.volatile);
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
      try {
        kuzzle.pluginsManager.registerStrategy(pluginName, name, strategy);
      }
      catch(err) {
        return reject(err);
      }

      kuzzle.pluginsManager.trigger('core:auth:strategyAdded', {name, strategy, pluginName})
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
      }
      catch(err) {
        return reject(err);
      }

      kuzzle.pluginsManager.trigger('core:auth:strategyRemoved', {name, pluginName})
        .then(() => resolve())
        .catch(err => reject(err));
    });
  };
}

module.exports = PluginContext;
