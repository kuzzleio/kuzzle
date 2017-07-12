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
      Dsl: require('../../dsl'),
      Request: instantiateRequest,
      BaseValidationType: require('../validation/baseType')
    };
    this.errors = require('kuzzle-common-objects').errors;

    if (kuzzle instanceof Kuzzle) {
      const
        internalEngineIndex = `%plugin:${pluginName}`,
        pluginInternalEngine = new InternalEngine(kuzzle, internalEngineIndex);

      pluginInternalEngine.init(new PluginInternalEngineBootstrap(kuzzle, pluginInternalEngine));

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
        get: () => execute.bind(kuzzle)
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

      Object.defineProperty(this.accessors, 'trigger', {
        enumerable: true,
        get: () => curryTrigger(pluginName).bind(kuzzle)
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
 * @this {Kuzzle}
 * @param {Request} request
 * @param {function} callback
 */
function execute (request, callback) {
  const kuzzle = this;

  return kuzzle.funnel.processRequest(request)
    .then(response => {
      if (callback) {
        try {
          callback(null, response);
        }
        catch (e) {
          kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError(`Uncatched error by a plugin callback: ${e}`));
        }

        return;
      }

      return Bluebird.resolve(response);
    })
    .catch(err => {
      request.setError(err);
      kuzzle.funnel.handleErrorDump(err);

      if (callback) {
        try {
          callback(err, request);
        }
        catch (e) {
          kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError(`Uncatched error by a plugin callback: ${e}`));
          kuzzle.pluginsManager.trigger('log:error', `Previous error: ${err}`);
        }
        return;
      }

      return Bluebird.reject(err);
    });
}

/**
 * Returns a currified version of pluginsManager.trigger. The pluginName param
 * is injected in the returned function as it is pre-pended to the custom event
 * name. This is done to avoid colliding with the kuzzle native events.
 *
 * @param  {String} pluginName The name of the plugin calling trigger.
 * @return {Function}          A trigger function that makes some checks on the
 *                             event name and prepends the plugin name to the
 *                             event name.
 */
function curryTrigger (pluginName) {
  /**
   * @this   {Kuzzle}
   * @param  {String} eventName The name of the custom event to trigger.
   * @param  {Object} payload   The payload of the event.
   */
  return function trigger (eventName, payload) {
    const kuzzle = this;

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
  if (!request || !(request instanceof Request)) {
    throw new PluginImplementationError('A Request object must be provided');
  }

  Object.assign(options, request.context.toJSON());

  const target = new Request(data, options);
  target.origin = target.previous = request;

  // forward informations from the provided request object
  ['_id', 'index', 'collection'].forEach(resource => {
    if (!target.input.resource[resource]) {
      target.input.resource[resource] = request.input.resource[resource];
    }
  });

  Object.keys(request.input.args).forEach(arg => {
    if (!target.input.args[arg]) {
      target.input.args[arg] = request.input.args[arg];
    }
  });

  if (!target.input.jwt) {
    target.input.jwt = request.input.jwt;
  }

  return target;
}

module.exports = PluginContext;
