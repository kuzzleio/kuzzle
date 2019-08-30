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


const
  errorsManager = require('../../../config/error-codes/throw'),
  didYouMean = require('../../../util/didYouMean'),
  debug = require('../../../kuzzleDebug')('kuzzle:plugins'),
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  fs = require('fs'),
  { KuzzleError } = require('kuzzle-common-objects').errors,
  Manifest = require('./manifest'),
  { loadPluginsErrors } = require('../../../config/error-codes');

/**
 * @class PluginsManager
 * @param {Kuzzle} kuzzle
 */
class PluginsManager {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.plugins = {};
    this.pipes = {};
    this.controllers = {};
    this.strategies = {};
    this.routes = [];
    this.pluginsDir = path.resolve(
      path.join(this.kuzzle.rootPath, 'plugins/enabled'));

    /**
     * @example
     * {
     *   pluginName: {
     *     authName: <constructor>,
     *     authname2: <constructor>,
     *     ...
     *   },
     *   pluginName2: {
     *     ...
     *   }
     * }
     *
     * This structure prevents authenticator names collisions between
     * multiple auth. plugins
     */
    this.authenticators = {};

    this.config = kuzzle.config.plugins;
  }

  /**
   * Load plugin located in "plugins/enabled" folder and from CLI arguments
   * 
   * @param  {Array.<string>} plugins - Plugins passed as CLI arguments
   * @throws PluginImplementationError - Throws when an error occurs when loading a plugin
   */
  init(additionalPlugins = []) {
    this.plugins = this.load(additionalPlugins);
  }

  /**
   * Used to dump loaded plugin feature into serverInfo route / cli
   *
   * @returns {object}
   */
  getPluginsDescription() {
    const pluginsDescription = {};

    Object.keys(this.plugins).forEach(plugin => {
      const
        pluginInfo = this.plugins[plugin],
        description = {
          version: pluginInfo.version,
          manifest: pluginInfo.manifest,
          hooks: [],
          pipes: [],
          controllers: [],
          routes: [],
          strategies: []
        };

      if (pluginInfo.object) {
        if (_.has(pluginInfo.object, 'hooks')) {
          description.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));
        }

        if (_.has(pluginInfo.object, 'pipes')) {
          description.pipes = _.uniq(Object.keys(pluginInfo.object.pipes));
        }

        if (_.has(pluginInfo.object, 'controllers')) {
          description.controllers = _
            .uniq(Object.keys(pluginInfo.object.controllers))
            .map(item => `${pluginInfo.manifest.name}/${item}`);
        }

        if (_.has(pluginInfo.object, 'routes')) {
          description.routes = _.uniq(pluginInfo.object.routes);
        }

        if (_.has(pluginInfo.object, 'strategies')) {
          description.strategies = Object.keys(pluginInfo.object.strategies);
        }
      } else {
        this.kuzzle.log.warn(`[Plugin manager]: Unable to load features from plugin "${plugin}"`);
      }

      pluginsDescription[description.manifest.name] = description;

      debug('[%s] reading plugin configuration: %a', plugin, description);
    });

    return pluginsDescription;
  }

  /**
   * Register plugins feature to Kuzzle
   *
   * @returns {Promise}
   *
   * @throws PluginImplementationError - Throws when an error occurs when registering a plugin
   */
  run() {
    if (Object.keys(this.plugins).length === 0) {
      return Bluebird.resolve();
    }

    // register regular plugins features
    return Bluebird.all(Object.keys(this.plugins).map(pluginName => {
      const
        plugin = this.plugins[pluginName],
        {
          pipeWarnTime,
          pipeTimeout,
          initTimeout
        } = this.config.common;


      debug(
        '[%s] starting plugin in "%s" mode',
        plugin.manifest.name,
        plugin.config.privileged ? 'privileged' : 'standard');

      return Bluebird
        .resolve(plugin.object.init(
          plugin.config,
          plugin.config.privileged
            ? new PrivilegedPluginContext(this.kuzzle, plugin.manifest.name)
            : new PluginContext(this.kuzzle, plugin.manifest.name)))
        .timeout(initTimeout)
        .then(initStatus => {
          if (initStatus === false) {
            errorsManager.throw(
              'plugins',
              'validation',
              'plugin_initialization_failed',
              plugin.manifest.name);
          }

          if (plugin.object.controllers) {
            this._initControllers(plugin);
          }

          if (plugin.object.authenticators) {
            this._initAuthenticators(plugin);
          }

          if (plugin.object.strategies) {
            this._initStrategies(plugin);
          }

          if (plugin.object.hooks) {
            this._initHooks(plugin);
          }

          if (plugin.object.pipes) {
            this._initPipes(plugin, pipeWarnTime, pipeTimeout);
          }

          debug('[%s] plugin started', plugin.manifest.name);
        });
    }));
  }

  /**
   * Emit a "pipe" event, returning a promise resolved once all registered
   * pipe listeners have finished processing the provided data.
   *
   * Each listener has to resolve its promise with an updated version of the
   * provided data, which is then passed to the next listener, and so on in
   * series until the last listener resolves.
   *
   * @param  {Array.<string>} events
   * @param  {*} data
   * @return {Promise.<*>}
   */
  pipe(events, data, ...info) {
    debug('trigger "%s" event', events);

    const preparedPipes = [cb => cb(null, data, ...info)];

    let i; // NOSONAR
    for (i = 0; i < events.length; i++) {
      const event = events[i];

      if (this.pipes[event]) {
        for (const pipe of this.pipes[event]) {
          preparedPipes.push(pipe);
        }
      }
    }

    if (preparedPipes.length === 1) {
      return Bluebird.resolve(data);
    }

    return new Bluebird((resolve, reject) => {
      async.waterfall(preparedPipes, (error, result) => {
        if (error) {
          if (error instanceof KuzzleError) {
            return reject(error);
          }

          return reject(errorsManager.getError('plugins', 'runtime', 'plugin_error', error));
        }

        resolve(result);
      });
    });
  }

  /**
   * Inject plugin controllers within funnel Controller
   * @returns {object}
   */
  getPluginControllers() {
    const controllers = {};

    _.forEach(this.controllers, (controller, name) => {
      controllers[name] = controller;
    });

    return controllers;
  }

  /**
   * @param {string} strategyName
   * @returns {string[]}
   */
  getStrategyFields (strategyName) {
    return this.strategies[strategyName].strategy.config.fields || [];
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {boolean}
   */
  hasStrategyMethod (strategyName, methodName) {
    return Boolean(this.strategies[strategyName].methods[methodName]);
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {function}
   */
  getStrategyMethod (strategyName, methodName) {
    return this.strategies[strategyName].methods[methodName];
  }

  /**
   * Returns the list of registered passport strategies
   * @returns {string[]}
   */
  listStrategies () {
    return Object.keys(this.strategies);
  }

  /**
   * Checks if a strategy is well-formed
   *
   * @param {string} pluginName
   * @param {string} strategyName
   * @param {object} strategy
   * @throws {PluginImplementationError} If the strategy is invalid
   */
  validateStrategy (pluginName, strategyName, strategy) {
    const errorPrefix = `[${pluginName}] Strategy ${strategyName}:`;

    if (!_.isPlainObject(strategy)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'strategy_description_type',
        errorPrefix,
        strategy);
    }

    if (!_.isPlainObject(strategy.methods)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'methods_property_type',
        errorPrefix,
        strategy.methods);
    }

    const pluginObject = this.plugins[pluginName].object;

    // required methods check
    ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
      if (!_.isString(strategy.methods[methodName])) {
        errorsManager.throw(
          'plugins',
          'validation',
          'methodname_property_type',
          errorPrefix,
          methodName,
          strategy.methods[methodName]);
      }

      if (!_.isFunction(pluginObject[strategy.methods[methodName]])) {
        errorsManager.throw(
          'plugins',
          'validation',
          'invalid_strategy_method',
          errorPrefix,
          strategy.methods[methodName]);
      }
    });

    // optional methods check
    ['getInfo', 'getById', 'afterRegister'].forEach(name => {
      const optionalMethodName = strategy.methods[name];

      if (!_.isNil(optionalMethodName)) {
        if (!_.isString(optionalMethodName)) {
          errorsManager.throw(
            'plugins',
            'validation',
            'invalid_property_type',
            errorPrefix,
            name,
            optionalMethodName);
        }

        if (!_.isFunction(pluginObject[optionalMethodName])) {
          errorsManager.throw(
            'plugins',
            'validation',
            'invalid_strategy_method',
            errorPrefix,
            optionalMethodName);
        }
      }
    });

    if (!_.isPlainObject(strategy.config)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'missing_config_property',
        errorPrefix,
        strategy.config);
    }

    // @deprecated since version 1.4.0
    // Note: since "constructor" is a reserved keyword, and since
    // any object, even POJOs, have a default constructor, we need
    // to consider a native function to be an unspecified "constructor"
    // property
    if (!_.isNil(strategy.config.constructor) && !_.isNative(strategy.config.constructor)) {
      if (!_.isNil(strategy.config.authenticator)) {
        errorsManager.throw(
          'plugins',
          'validation',
          'cannot_set_ctor_and_authenticator',
          errorPrefix);
      }

      if (isConstructor(strategy.config.constructor)) {
        this.kuzzle.log.warn(`${errorPrefix} the strategy "constructor" property is deprecated, please use "authenticator" instead (see https://tinyurl.com/y7boozbk)`);
      } else {
        errorsManager.throw(
          'plugins',
          'validation',
          'invalid_constructor_property_value',
          errorPrefix);
      }
    } else if (!_.isString(strategy.config.authenticator)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'authenticator_property_type',
        errorPrefix,
        strategy.config.authenticator);
    } else if (!this.authenticators[pluginName] || !this.authenticators[pluginName][strategy.config.authenticator]) {
      errorsManager.throw(
        'plugins',
        'validation',
        'unknown_authenticator_value',
        errorPrefix,
        strategy.config.authenticator);
    }

    for (const opt of ['strategyOptions', 'authenticateOptions']) {
      const obj = strategy.config[opt];

      if (!_.isNil(obj) && !_.isPlainObject(obj)) {
        errorsManager.throw(
          'plugins',
          'validation',
          'expected_object_type',
          errorPrefix,
          opt,
          obj);
      }
    }

    if (!_.isNil(strategy.config.fields) && !Array.isArray(strategy.config.fields)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'invalid_fields_property_type',
        errorPrefix,
        strategy.config.fields);
    }
  }

  /**
   * Register a pipe function on an event
   *
   * @param {object} plugin
   * @param {number} warnDelay - delay before a warning is issued
   * @param {number} timeoutDelay - delay after which the function is timed out
   * @param {string} event name
   * @param {string|function} fn - function to attach
   */
  registerPipe(plugin, warnDelay, timeoutDelay, event, fn) {
    debug('[%s] register pipe on event "%s"', plugin.manifest.name, event);

    if (!this.pipes[event]) {
      this.pipes[event] = [];
    }

    this.pipes[event].push((data, ...info) => {
      const callback = info.pop();
      const name = plugin.manifest.name;
      let
        pipeWarnTimer,
        pipeTimeoutTimer,
        timedOut = false;

      if (warnDelay) {
        pipeWarnTimer = setTimeout(() => {
          this.kuzzle.log.warn(`Plugin ${name} pipe for event '${event}' exceeded ${warnDelay}ms to execute.`);
        }, warnDelay);
      }

      const errorMsg = `Timeout error. Plugin ${name} pipe for event '${event}' exceeded ${timeoutDelay}ms to execute. Aborting.`;
      if (timeoutDelay) {
        pipeTimeoutTimer = setTimeout(() => {
          this.kuzzle.log.error(errorMsg);

          timedOut = true;
          callback(errorsManager.getError('plugins', 'runtime', 'register_pipe_timeout', errorMsg));
        }, timeoutDelay);
      }

      const cb = (err, pipeResponse, ...info2) => {
        if (pipeWarnTimer !== undefined) {
          clearTimeout(pipeWarnTimer);
        }
        if (pipeTimeoutTimer !== undefined) {
          clearTimeout(pipeTimeoutTimer);
        }

        if (!timedOut) {
          callback(err, pipeResponse, ...info2);
        }
      };

      try {
        const pipeResponse = (typeof fn === 'function')
          ? fn(data, ...info, cb)
          : plugin.object[fn](data, ...info, cb);

        if (typeof pipeResponse === 'object'
          && pipeResponse !== null
          && typeof pipeResponse.then === 'function'
          && typeof pipeResponse.catch === 'function'
        ) {
          pipeResponse
            .then(request => cb(null, request))
            .catch(error => cb(error));
        }
      } catch (error) {
        if (error instanceof KuzzleError) {
          return cb(error);
        }

        cb(errorsManager.getError(
          'plugins',
          'runtime',
          'plugin_threw_non_kuzzle_error',
          name,
          event,
          error));
      }
    });
  }

  /**
   * Register a listener function on an event
   *
   * @param {object} plugin
   * @param {string} event
   * @param {string|function} fn - function to attach
   */
  registerHook(plugin, event, fn) {
    debug('[%s] register hook on event "%s"', plugin.manifest.name, event);

    this.kuzzle.on(event, message => {
      try {
        if (typeof fn === 'function') {
          fn(message, event);
        } else {
          plugin.object[fn](message, event);
        }
      } catch (error) {
        errorsManager.throw('plugins', 'runtime', 'plugin_error', error);
      }
    });
  }

  /**
   * Register an authentication strategy.
   *
   * @param {string} pluginName - plugin name
   * @param {string} strategyName - strategy name
   * @param {object} strategy - strategy properties
   * @throws {PluginImplementationError} If the strategy is invalid or if registration fails
   */
  registerStrategy(pluginName, strategyName, strategy) {
    const errorPrefix = `[${pluginName}] Strategy ${strategyName}:`;
    this.validateStrategy(pluginName, strategyName, strategy);

    if (this.strategies[strategyName]) {
      this.unregisterStrategy(pluginName, strategyName);
    }

    const
      plugin = this.plugins[pluginName],
      methods = {};

    // wrap plugin methods to force their context and to
    // convert uncaught exception into PluginImplementationError
    // promise rejections
    for (const methodName of Object.keys(strategy.methods).filter(
      name => name !== 'verify')
    ) {
      methods[methodName] = (...args) => {
        return new Bluebird((resolve, reject) => {
          try {
            resolve(
              plugin.object[strategy.methods[methodName]].bind(
                plugin.object)(...args)
            );
          } catch (error) {
            reject(
              error instanceof KuzzleError
                ? error
                : errorsManager.getError('plugins', 'runtime', 'plugin_error', error)
            );
          }
        });
      };
    }

    const
      opts = Object.assign(
        {},
        strategy.config.strategyOptions,
        {passReqToCallback: true}
      ),
      verifyAdapter = (...args) => {
        const
          callback = args[args.length - 1],
          ret = plugin.object[strategy.methods.verify](...args.slice(0, -1));

        // catching plugins returning non-thenable content
        if (!ret || !_.isFunction(ret.then)) {
          return callback(errorsManager.getError(
            'plugins',
            'runtime',
            'verify_dont_return_promise',
            errorPrefix,
            ret));
        }

        let message = null;

        ret
          .then(result => {
            if (result === false) {
              return false;
            }

            if (!_.isPlainObject(result)) {
              errorsManager.throw(
                'plugins',
                'runtime',
                'invalid_authentication_strategy_result',
                errorPrefix);
            }

            if (result.kuid !== null && result.kuid !== undefined) {
              if (typeof result.kuid === 'string') {
                return this.kuzzle.repositories.user.load(result.kuid);
              }
              errorsManager.throw(
                'plugins',
                'runtime',
                'invalid_authentication_kuid',
                errorPrefix,
                typeof result.kuid);
            }

            if (result.message && typeof result.message === 'string') {
              message = result.message;
            } else {
              message = `Unable to log in using the strategy "${strategyName}"`;
            }

            return false;
          })
          .then(result => {
            if (result === null) {
              errorsManager.throw(
                'plugins',
                'runtime',
                'unknown_kuzzle_user_identifier',
                errorPrefix);
            }

            callback(null, result, {message});
            return null;
          })
          .catch(error => callback(error));
      };

    try {
      const
        Ctor = _.get(
          this.authenticators,
          [pluginName, strategy.config.authenticator],
          strategy.config.constructor),
        instance = new Ctor(opts, verifyAdapter);

      this.strategies[strategyName] = {strategy, methods, owner: pluginName};
      this.kuzzle.passport.use(
        strategyName,
        instance,
        strategy.config.authenticateOptions
      );

      if (methods.afterRegister) {
        methods.afterRegister(instance);
      }
    } catch (e) {
      errorsManager.throw('plugins', 'runtime', 'plugin_error', `${errorPrefix}: ${e.message}.`);
    }
  }

  /**
   * Unregister
   * @param {string} pluginName
   * @param  {string} strategyName
   * @throws {PluginImplementationError} If not the owner of the strategy or if strategy
   *                                     does not exist
   */
  unregisterStrategy (pluginName, strategyName) {
    const strategy = this.strategies[strategyName];

    if (strategy) {
      if (strategy.owner !== pluginName) {
        errorsManager.throw(
          'plugins',
          'runtime',
          'cannot_remove_others_plugin_strategy',
          strategyName);
      }

      delete this.strategies[strategyName];
      this.kuzzle.passport.unuse(strategyName);
    } else {
      errorsManager.throw(
        'plugins',
        'runtime',
        'cannot_remove_unexistant_strategy',
        strategyName);
    }
  }

  /**
   * @param {object} plugin
   * @param {number} pipeWarnTime
   * @param {number} pipeTimeout
   */
  _initPipes (plugin, pipeWarnTime, pipeTimeout) {
    const methodsList = getMethods(plugin.object);

    let
      _warnTime = pipeWarnTime,
      _timeout = pipeTimeout;

    if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
      _warnTime = plugin.config.pipeWarnTime;
    }
    if (plugin.config && plugin.config.pipeTimeout !== undefined) {
      _timeout = plugin.config.pipeTimeout;
    }

    _.forEach(plugin.object.pipes, (fn, event) => {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if (typeof target !== 'function'
          && typeof plugin.object[target] !== 'function'
        ) {
          let message = `Unable to configure pipe for event "${event}" with provided method. "${target}" should be a plugin method name, or a function.`;

          if (typeof target === 'string') {
            message += didYouMean(target, methodsList);
          }

          errorsManager.throw('plugins', 'runtime', 'plugin_error', message);
        }

        this.registerPipe(plugin, _warnTime, _timeout, event, target);
      }
    });
  }

  /**
   * @param {object} plugin
   */
  _initHooks (plugin) {
    const methodsList = getMethods(plugin.object);

    _.forEach(plugin.object.hooks, (fn, event) => {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if (
          typeof target !== 'function'
          && typeof plugin.object[target] !== 'function'
        ) {
          let message = `Unable to configure hook for event "${event}" with provided method. "${target}" should be a plugin method name, or a function.`;

          if (typeof target === 'string') {
            message += didYouMean(target, methodsList);
          }

          errorsManager.throw('plugins', 'runtime', 'plugin_error', message);
        }

        this.registerHook(plugin, event, target);
      }
    });
  }

  /**
   * Init plugin controllers
   *
   * @param {object} plugin
   * @returns {boolean}
   */
  _initControllers (plugin) {
    Object.keys(plugin.object.controllers).forEach(controller => {
      debug(
        '[%s][%s] starting controller registration',
        plugin.manifest.name,
        controller);

      const
        methodsList = getMethods(plugin.object),
        controllerName = `${plugin.manifest.name}/${controller}`,
        description = plugin.object.controllers[controller],
        errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.manifest.name}":`;

      if (!_.isPlainObject(description)) {
        errorsManager.throw(
          'plugins',
          'validation',
          'incorrect_controller_description_type',
          errorControllerPrefix,
          typeof description);
      }

      Object.keys(description).forEach(action => {
        debug(
          '[%s][%s][%s] starting action controller registration',
          plugin.manifest.name, controller,
          action);

        if (
          typeof description[action] !== 'function'
          && typeof plugin.object[description[action]] !== 'function'
        ) {
          let message = `${errorControllerPrefix} Action for "${controller}:${action}" is not a function.`;

          if (typeof description[action] === 'string') {
            message += didYouMean(description[action], methodsList);
          }
          errorsManager.throw('plugins', 'runtime', 'plugin_error', message);
        }

        if (!this.controllers[controllerName]) {
          this.controllers[controllerName] = {};
        }

        if (typeof description[action] === 'function') {
          this.controllers[controllerName][action] = description[action];
        } else {
          this.controllers[controllerName][action] =
            plugin.object[description[action]].bind(plugin.object);
        }
      });
    });

    const
      httpVerbs = ['get', 'head', 'post', 'put', 'delete', 'patch'],
      routeProperties = ['verb', 'url', 'controller', 'action'],
      controllerNames = Object.keys(plugin.object.controllers);

    if (plugin.object.routes) {
      plugin.object.routes.forEach(route => {
        const
          controllerName = `${plugin.manifest.name}/${route.controller}`,
          errorRoutePrefix = `Unable to inject api route "${JSON.stringify(route)}" from plugin "${plugin.manifest.name}":`;

        Object.keys(route).forEach(key => {
          if (routeProperties.indexOf(key) === -1) {
            errorsManager.throw(
              'plugins',
              'validation',
              'unknown_property_key_in_route_definition',
              errorRoutePrefix,
              key,
              didYouMean(key, routeProperties));
          }

          if (typeof route[key] !== 'string'
            || (route[key].length === 0 && key !== 'url')
          ) {
            errorsManager.throw(
              'plugins',
              'validation',
              'key_cannot_be_empty_string',
              errorRoutePrefix,
              key);
          }
        });

        if (!this.controllers[controllerName]) {
          errorsManager.throw(
            'plugins',
            'validation',
            'undefined_controller',
            errorRoutePrefix,
            route.controller,
            didYouMean(route.controller, controllerNames));
        }

        if (!this.controllers[controllerName][route.action]) {
          const actionNames = Object.keys(this.controllers[controllerName]);
          errorsManager.throw(
            'plugins',
            'validation',
            'undefined_action',
            errorRoutePrefix,
            route.action,
            didYouMean(route.action, actionNames));
        }

        if (httpVerbs.indexOf(route.verb.toLowerCase()) === -1) {
          errorsManager.throw(
            'plugins',
            'validation',
            'http_verb_not_allowed',
            errorRoutePrefix,
            httpVerbs.join(', '),
            didYouMean(route.verb, httpVerbs));
        }

        debug(
          '[%s] binding HTTP route "%s" to controller "%s"',
          plugin.manifest.name,
          route.url,
          route.controller);

        route.url = `/${plugin.manifest.name}${route.url}`;
        route.controller = controllerName;

        this.routes.push(route);
      });
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initStrategies (plugin) {
    const errorPrefix = `[${plugin.manifest.name}]:`;

    if (
      !_.isPlainObject(plugin.object.strategies)
      || _.isEmpty(plugin.object.strategies)
    ) {
      errorsManager.throw(
        'plugins',
        'validation',
        'strategies_plugin_property_empty',
        errorPrefix);
    }

    for (const name of Object.keys(plugin.object.strategies)) {
      this.registerStrategy(
        plugin.manifest.name,
        name,
        plugin.object.strategies[name]);
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initAuthenticators (plugin) {
    const errorPrefix = `[${plugin.manifest.name}]:`;

    // @todo the _.isNil test need to be removed as soon as the
    // "strategy.config.constructor" property is no longer supported
    if (!_.isNil(plugin.object.authenticators)) {
      if (!_.isPlainObject(plugin.object.authenticators)) {
        errorsManager.throw(
          'plugins',
          'validation',
          'authenticators_plugin_property_not_an_object',
          errorPrefix);
      }

      for (const authenticator of Object.keys(plugin.object.authenticators)) {
        if (!isConstructor(plugin.object.authenticators[authenticator])) {
          errorsManager.throw(
            'plugins',
            'validation',
            'invalid_authenticator',
            errorPrefix,
            authenticator);
        }
      }

      this.authenticators[plugin.manifest.name] = Object.assign(
        {},
        plugin.object.authenticators);
    }
  }

  /**
   * Load detected plugins in memory
   *
   * @returns {object} list of loaded plugin
   */
  load(additionalPlugins = []) {
    const 
      loadedPlugins = {},
      getPluginDir = plugin => {
        return additionalPlugins.includes(plugin)
          ? path.resolve(path.join(this.kuzzle.rootPath, 'plugins/available'))
          : this.pluginsDir;
      };

    let plugins = [];

    try {
      plugins = fs.readdirSync(this.pluginsDir);
    } catch (e) {
      errorsManager.throw(
        'plugins',
        'runtime',
        'unable_to_load_plugin_from_directory',
        this.pluginsDir,
        e.message);
    }

    // Add CLI enabled plugins.
    // See CLI `start` command `--enable-plugins` option.
    plugins = additionalPlugins
      .filter(plugin => !plugins.includes(plugin))
      .concat(plugins);

    for (const plugin of plugins) {
      const
        pluginDir = getPluginDir(plugin),
        pluginPath = path.join(pluginDir, plugin);

      try {
        fs.statSync(pluginPath).isDirectory();
      } catch (e) {
        errorsManager.throw(
          'plugins',
          'runtime',
          'unable_to_load_plugin_from_path',
          pluginPath,
          e.message);
      }
    }

    debug('loading plugins: %a', plugins);

    for (const relativePluginPath of plugins) {
      const
        pluginDir = getPluginDir(relativePluginPath),
        pluginPath = path.resolve(pluginDir, relativePluginPath),
        manifest = new Manifest(this.kuzzle, pluginPath);

      
      manifest.load();

      const
        plugin = {
          manifest,
          object: null,
          config: this.config[manifest.name]
            ? JSON.parse(JSON.stringify(this.config[manifest.name]))
            : {}
        };

      // load customs errors configuration file
      if (plugin.manifest.raw.errors) {
        try {
          const pluginCode = this.config[plugin.manifest.name] && this.config[plugin.manifest.name].pluginCode
            ? this.config[plugin.manifest.name]._pluginCode
            : 0x00;
          loadPluginsErrors(plugin.manifest.raw, pluginCode);
          this.kuzzle.log.info(`[${plugin.manifest.name}] Custom errors successfully loaded.`);
        } catch (err) {
          if (err.message.match(/Error configuration file/i)
              || err instanceof SyntaxError
          ) {
            errorsManager.throw(
              'plugins',
              'runtime',
              'errors_configuration_file',
              plugin.manifest.name,
              err.message);
          } else {
            throw err;
          }
        }
      }

      // load plugin object
      try {
        const PluginClass = require(pluginPath);
        plugin.object = new PluginClass();
      } catch (e) {
        if (e.message.match(/not a constructor/i)) {
          errorsManager.throw(
            'plugins',
            'runtime',
            'plugin_is_not_a_constructor',
            plugin.manifest.name);
        }

        errorsManager.throw('plugins', 'runtime', 'plugin_error', e);
      }

      // check if the plugin exposes a "init" method
      if (typeof plugin.object.init !== 'function') {
        errorsManager.throw(
          'plugins',
          'runtime',
          'init_method_not_found',
          plugin.manifest.name);
      }

      // check plugin privileged prerequisites
      // user need to acknowledge privileged mode in plugin configuration
      if (plugin.config.privileged) {
        if (!plugin.manifest.privileged) {
          errorsManager.throw(
            'plugins',
            'runtime',
            'privileged_mode_not_supported',
            plugin.manifest.name);
        }
      } else if (plugin.manifest.privileged) {
        errorsManager.throw(
          'plugins',
          'runtime',
          'privileged_mode_not_setted',
          plugin.manifest.name);
      }

      if (loadedPlugins[plugin.manifest.name]) {
        errorsManager.throw(
          'plugins',
          'runtime',
          'plugin_name_already_exists',
          plugin.manifest.name);
      }

      loadedPlugins[plugin.manifest.name] = plugin;
    }

    return loadedPlugins;
  }
}

/**
 * Test if the provided argument is a constructor or not
 *
 * @param  {*} arg
 * @return {Boolean}
 */
function isConstructor (arg) {
  try {
    Reflect.construct(Object, [], arg);
  } catch (e) {
    return false;
  }

  return true;
}

function getMethods (object) {
  const prototype = Object.getPrototypeOf(object);

  const instanceMethods = Object.getOwnPropertyNames(prototype)
    .filter(method => ['init', 'constructor'].indexOf(method) === -1);

  const objectMethods = Object.getOwnPropertyNames(object)
    .filter(key => typeof object[key] === 'function');

  return [...instanceMethods, ...objectMethods];
}

module.exports = PluginsManager;
