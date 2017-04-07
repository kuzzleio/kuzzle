'use strict';

const
  Promise = require('bluebird'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  RequestInput = require('kuzzle-common-objects').models.RequestInput,
  PluginRepository = require('../models/repositories/pluginRepository'),
  InternalEngine = require('../../../services/internalEngine/index'),
  PluginInternalEngineBootstrap = require('../../../services/internalEngine/pluginBootstrap');

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
    let pluginInternalEngine;

    this.accessors = {};
    this.config = kuzzle.config;
    this.constructors = {
      Dsl: require('../../dsl'),
      Request: instantiateRequest,
      RequestContext,
      RequestInput,
      BaseValidationType: require('../validation/baseType')
    };
    this.errors = require('kuzzle-common-objects').errors;

    if (kuzzle instanceof Kuzzle) {
      pluginInternalEngine = new InternalEngine(kuzzle, `%${pluginName}`);
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

      Object.defineProperty(this.accessors, 'registerStrategy', {
        enumerable: true,
        get: () => registerStrategy.bind(kuzzle)
      });

      Object.defineProperty(this.accessors, 'execute', {
        enumerable: true,
        get: () => execute.bind(kuzzle)
      });

      /*
       Sharing only a handful user functions as wrappers for the repositories object
       */
      Object.defineProperty(this.accessors, 'users', {
        enumerable: true,
        get: () => {
          return {
            load: userId => kuzzle.repositories.user.load(userId)
          };
        }
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
            createCollection: pluginInternalEngine.bootstrap.createCollection.bind(pluginInternalEngine.bootstrap),
          };
        }
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

        pluginRepository = new PluginRepository(kuzzle, pluginName, collection);
        pluginRepository.init({databaseEngine: pluginInternalEngine, cacheEngine: null, ObjectConstructor});

        return {
          search: pluginRepository.search.bind(pluginRepository),
          get: pluginRepository.load.bind(pluginRepository),
          mGet: pluginRepository.loadMultiFromDatabase.bind(pluginRepository),
          delete: pluginRepository.delete.bind(pluginRepository),
          create: pluginRepository.create.bind(pluginRepository),
          createOrReplace: pluginRepository.createOrReplace.bind(pluginRepository),
          replace: pluginRepository.replace.bind(pluginRepository),
          update: pluginRepository.update.bind(pluginRepository),
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

      return Promise.resolve(response);
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

      return Promise.reject(err);
    });
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
function instantiateRequest(request, data, options) {
  let target;

  if (!request || !(request instanceof Request)) {
    throw new PluginImplementationError('A Request object must be provided');
  }

  options = options || {};
  Object.assign(options, request.context.toJSON());

  target = new Request(data, options);
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

/**
 * Registers an authentication strategy
 *
 * @this kuzzle
 * @param {function} Strategy - strategy constructor
 * @param {string} name - strategy name
 * @param {object} context - plugin context, used to bind the verify callback
 * @param {function} verify - verification callback
 * @param {object} [options] - strategy optional parameters
 */
function registerStrategy(Strategy, name, context, verify, options = {}) {
  const opts = Object.assign(options, {passReqToCallback: true});

  try {
    this.passport.use(name, new Strategy(opts, verify.bind(context)));
  }
  catch (e) {
    // There might not be any logger active when an authentication plugin registers its strategy
    // eslint-disable-next-line no-console
    console.error(new PluginImplementationError(`Unable to register authentication strategy: ${e.message}`));
  }
}

module.exports = PluginContext;
