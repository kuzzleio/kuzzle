/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
      const pluginInternalEngine = new InternalEngine(kuzzle, `%${pluginName}`);
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
            load: userId => kuzzle.repositories.user.load(userId),
            create: (name, profile, info) => createUser(kuzzle, name, profile, info)
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
            createCollection: pluginInternalEngine.bootstrap.createCollection.bind(pluginInternalEngine.bootstrap)
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
 * UserRepositories wrapper to expose user creation to plugins.
 * If "userInfo" does not contain a profile attribute, this function
 * will add one with the value "default"
 *
 * @param {Kuzzle} kuzzle - Kuzzle's user repositories
 * @param {string} name - user name
 * @param {?string} [profile] - profile name
 * @param {object} [userInfo] - the user to be created
 * @returns {Promise<T>}
 */
function createUser(kuzzle, name, profile, userInfo) {
  const userRepository = kuzzle.repositories.user;
  let
    _profile = profile,
    _userInfo = userInfo;

  if (!_userInfo) {
    if (_profile && typeof _profile === 'object') {
      _userInfo = _profile;
      _profile = null;
    }
    else {
      _userInfo = {};
    }
  }

  if (!name || typeof name !== 'string') {
    return Bluebird.reject(new PluginImplementationError('User creation error: "name" argument invalid or missing'));
  }

  if (typeof _userInfo !== 'object' || Array.isArray(_userInfo)) {
    return Bluebird.reject(new PluginImplementationError('User creation error: invalid "info" argument (expected an object)'));
  }

  _userInfo._id = name;
  _userInfo.profileIds = kuzzle.config.security.restrictedProfileIds;
  if (_profile) {
    _userInfo.profileIds = Array.isArray(_profile) ? _profile : [_profile];
  }

  return userRepository.hydrate(new userRepository.ObjectConstructor(), _userInfo)
    .then(user => userRepository.persist(user, {database: {method: 'create'}}))
    /*
     masking the resolved user object to avoid plugin developers having access
     to an internal Kuzzle object
     */
    .then(() => _userInfo);
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
