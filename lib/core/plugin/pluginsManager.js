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

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const Bluebird = require('bluebird');
const _ = require('lodash');

const kerror = require('../../kerror');
const didYouMean = require('../../util/didYouMean');
const { kebabCase } = require('../../util/inflector');
const debug = require('../../util/debug')('kuzzle:plugins');
const { KuzzleError } = require('kuzzle-common-objects');
const { has, get, isPlainObject } = require('../../util/safeObject');
const { BaseController } = require('../../api/controller/base');
const Plugin = require('./plugin');

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');
const strategyError = kerror.wrap('plugin', 'strategy');
const controllerError = kerror.wrap('plugin', 'controller');

/**
 * @class PluginsManager
 * @param {Kuzzle} kuzzle
 */
class PluginsManager {
  constructor(kuzzle) {
    Reflect.defineProperty(this, 'kuzzle', {
      value: kuzzle
    });

    this._plugins = new Map();

    // Map.<controller, BaseController instance >
    this.controllers = new Map();

    this.strategies = {};
    this.routes = [];
    this.pluginsEnabledDir = path.resolve(
      path.join(this.kuzzle.rootPath, 'plugins', 'enabled'));
    this.pluginsAvailableDir = path.resolve(
      path.join(this.kuzzle.rootPath, 'plugins', 'available'));

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

    // @deprecated - Warn about the pipeTimeout configuration being obsolete
    if (this.config.common.pipeTimeout) {
      this.kuzzle.log.warn('The configuration "plugins.common.pipeTimeout" has been deprecated and is now unused. It can be safely removed from configuration files');
    }
  }

  set application (plugin) {
    assert(this._plugins.size === 0, 'The application plugin can only be set before every other plugins are loaded');
    assert(plugin.application, 'The application plugin must have the "application" property equals to true');

    this._plugins.set(plugin.name, plugin);
  }

  get plugins () {
    return Array.from(this._plugins.values())
      .filter(plugin => ! plugin.application);
  }

  get application () {
    return Array.from(this._plugins.values()).find(plugin => plugin.application);
  }

  /**
   * Giving a controller name, tells if exists
   *
   * @param {string} controller
   * @returns {Boolean}
   */
  isController (controller) {
    return this.controllers.has(controller);
  }

  /**
   * Giving a controller name and an action, tells if action exists
   *
   * @param {string} controller
   * @param {string} action
   * @returns {Boolean}
   */
  isAction (controller, action) {
    return this.getActions(controller).includes(action);
  }

  /**
   * Giving a controller name, returns its actions
   *
   * @param {string} controller
   * @returns {Array}
   */
  getActions (controller) {
    return Array.from(this.controllers.get(controller)._actions);
  }

  /**
   * Returns an array filled with controller names
   *
   * @returns {Array}
   */
  getControllerNames () {
    return Array.from(this.controllers.keys());
  }

  /**
   * Giving a plugin name, tell if it exists
   *
   * @param {string} pluginName
   * @returns {boolean}
   */

  exists (pluginName) {
    return this._plugins.has(pluginName);
  }

  /**
   * Used to dump loaded plugin feature into serverInfo route / cli
   *
   * @returns {object}
   */
  getPluginsDescription () {
    const pluginsDescription = {};

    for (const plugin of this.plugins) {
      pluginsDescription[plugin.name] = plugin.info();

      debug('[%s] reading plugin configuration: %a', plugin, pluginsDescription[plugin.name]);
    }

    return pluginsDescription;
  }

  /**
   * Register plugins feature to Kuzzle
   *
   * @returns {Promise}
   *
   * @throws PluginImplementationError - Throws when an error occurs when registering a plugin
   */
  init (plugins = {}) {
    this._plugins = new Map([
      ...this.loadPlugins(plugins),
      ...this._plugins]);

    this.kuzzle.on('plugin:hook:loop-error', ({ error, pluginName }) => {
      this.kuzzle.log.error(`[${pluginName}] Infinite loop detected on event "hook:onError": ${error}`);
    });

    this.kuzzle.on('hook:onError', ({ error, event, pluginName }) => {
      this.kuzzle.log.error(`[${pluginName}] Error executing hook on "${event}": ${error}${error.stack}`);
    });

    // register regular plugins features
    const loadPlugins = [];

    for (const plugin of this._plugins.values()) {
      if (plugin.application) {
        plugin.init(plugin.name);
      }

      const { pipeWarnTime, initTimeout } = this.config.common;

      debug(
        '[%s] starting plugin in "%s" mode',
        plugin.name,
        plugin.config.privileged ? 'privileged' : 'standard');

      const promise = Bluebird
        .resolve((async () => {
          try {
            await plugin.instance.init(plugin.config, plugin.context);
          }
          catch (error) {
            throw runtimeError.get('failed_init', plugin.name, error);
          }
        })())
        .timeout(initTimeout, `${plugin.logPrefix} Initialization timed out after ${initTimeout}ms. Try to increase the configuration "plugins.common.initTimeout".`)
        .then(async () => {
          plugin.initCalled = true;

          if ( ! _.isEmpty(plugin.instance.controllers)
            && ! _.isEmpty(plugin.instance.api))
          {
            throw assertionError.get('duplicated_api_definition');
          }

          if (! _.isEmpty(plugin.instance.controllers)) {
            this._initControllers(plugin);
          }

          if (! _.isEmpty(plugin.instance.api)) {
            await this._initApi(plugin);
          }

          if (! _.isEmpty(plugin.instance.authenticators)) {
            this._initAuthenticators(plugin);
          }

          if (! _.isEmpty(plugin.instance.strategies)) {
            this._initStrategies(plugin);
          }

          if (! _.isEmpty(plugin.instance.hooks)) {
            this._initHooks(plugin);
          }

          if (! _.isEmpty(plugin.instance.pipes)) {
            this._initPipes(plugin, pipeWarnTime);
          }

          debug('[%s] plugin started', plugin.name);

          return null;
        });

      loadPlugins.push(promise);
    }

    return Promise.all(loadPlugins);
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
    const strategy = get(this.strategies, strategyName);
    return strategy && has(strategy.methods, methodName);
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

    if (!isPlainObject(strategy)) {
      throw strategyError.get('invalid_description', errorPrefix, strategy);
    }

    if (!isPlainObject(strategy.methods)) {
      throw strategyError.get('invalid_methods', errorPrefix, strategy.methods);
    }

    const plugin = this._plugins.get(pluginName.toLowerCase());

    // required methods check
    ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
      if (!_.isString(strategy.methods[methodName])) {
        throw strategyError.get(
          'invalid_method_type',
          errorPrefix,
          methodName,
          strategy.methods[methodName]);
      }

      if (!_.isFunction(plugin.instance[strategy.methods[methodName]])) {
        throw strategyError.get(
          'missing_method_function',
          errorPrefix,
          strategy.methods[methodName]);
      }
    });

    // optional methods check
    ['getInfo', 'getById', 'afterRegister'].forEach(name => {
      const optionalMethodName = strategy.methods[name];

      if (!_.isNil(optionalMethodName)) {
        if (!_.isString(optionalMethodName)) {
          throw strategyError.get(
            'invalid_method_type',
            errorPrefix,
            name,
            optionalMethodName);
        }

        if (!_.isFunction(plugin.instance[optionalMethodName])) {
          throw strategyError.get(
            'missing_method_function',
            errorPrefix,
            optionalMethodName);
        }
      }
    });

    if (!isPlainObject(strategy.config)) {
      throw strategyError.get('invalid_config', errorPrefix, strategy.config);
    }

    if (typeof strategy.config.authenticator !== 'string') {
      throw strategyError.get(
        'invalid_authenticator',
        errorPrefix,
        strategy.config.authenticator);
    }
    else if (!this.authenticators[pluginName]
      || !this.authenticators[pluginName][strategy.config.authenticator]
    ) {
      throw strategyError.get(
        'unknown_authenticator',
        errorPrefix,
        strategy.config.authenticator);
    }

    for (const optionName of ['strategyOptions', 'authenticateOptions']) {
      const options = strategy.config[optionName];

      if (!_.isNil(options) && !isPlainObject(options)) {
        throw strategyError.get('invalid_option', errorPrefix, optionName, options);
      }
    }

    if (!_.isNil(strategy.config.fields) && !Array.isArray(strategy.config.fields)) {
      throw strategyError.get('invalid_fields', errorPrefix, strategy.config.fields);
    }
  }

  /**
   * Register a pipe function on an event
   *
   * @param {object} plugin
   * @param {number} warnDelay - delay before a warning is issued
   * @param {string} event name
   * @param {Function} handler - function to attach
   */
  registerPipe (plugin, warnDelay, event, handler) {
    debug('[%s] registering pipe on event "%s"', plugin.name, event);

    const wrapper = (...data) => {
      const now = warnDelay ? Date.now() : null;
      const callback = data.pop();

      const cb = (error, result) => {
        if (warnDelay) {
          const elapsed = Date.now() - now;

          if (elapsed > warnDelay) {
            this.kuzzle.log.warn(`${plugin.logPrefix} pipe for event '${event}' is slow (${elapsed}ms)`);
          }
        }

        callback(error, result);
      };

      try {
        const pipeResponse = data.length === 0
          ? handler(null, cb)
          : handler(...data, cb);

        if ( typeof pipeResponse === 'object'
          && pipeResponse !== null
          && typeof pipeResponse.then === 'function'
          && typeof pipeResponse.catch === 'function'
        ) {
          pipeResponse
            .then(result => {
              cb(null, result);
              return null; // prevents a false-positive bluebird warning
            })
            .catch(error => cb(error));
        }
      }
      catch (error) {
        cb(error instanceof KuzzleError
          ? error
          : runtimeError.getFrom(error, 'unexpected_error', error.message));
      }
    };

    this.kuzzle.registerPluginPipe(event, wrapper);
  }

  /**
   * Registers an authentication strategy.
   * If the plugin init method has not been called yet, add the strategy to
   * the plugin.instance.strategies object.
   *
   * @param {string} pluginName - plugin name
   * @param {string} strategyName - strategy name
   * @param {object} strategy - strategy properties
   * @throws {PluginImplementationError} If the strategy is invalid or if
   *                                     registration fails
   */
  registerStrategy (pluginName, strategyName, strategy) {
    // prior to Kaaf, plugin names can contains upper case
    const plugin = this._plugins.get(pluginName.toLowerCase());

    // only add the strategy to the strategies object if the init method
    // has not been called
    if (! plugin.initCalled) {
      plugin.instance.strategies = plugin.instance.strategies || {};
      plugin.instance.strategies[strategyName] = strategy;

      return;
    }

    this.validateStrategy(plugin.name, strategyName, strategy);

    if (has(this.strategies, strategyName)) {
      this.unregisterStrategy(plugin.name, strategyName);
    }

    const methods = {};

    // wrap plugin methods to force their context and to
    // convert uncaught exception into PluginImplementationError
    // promise rejections
    for (const methodName of Object.keys(strategy.methods).filter(
      name => name !== 'verify')
    ) {
      methods[methodName] = async (...args) => {
        try {
          const boundFunction = plugin.instance[strategy.methods[methodName]]
            .bind(plugin.instance);

          return await boundFunction(...args);
        }
        catch (error) {
          if (error instanceof KuzzleError) {
            throw error;
          }

          throw runtimeError.getFrom(error, 'unexpected_error', error.message);
        }
      };
    }

    const opts = {
      ...strategy.config.strategyOptions,
      passReqToCallback: true
    };

    const verifyAdapter = this.wrapStrategyVerify(
      plugin.logPrefix,
      strategyName,
      plugin.instance[strategy.methods.verify].bind(plugin.instance));

    try {
      const
        Ctor = this.authenticators[plugin.name][strategy.config.authenticator],
        instance = new Ctor(opts, verifyAdapter);

      this.strategies[strategyName] = { methods, owner: plugin.name, strategy };
      this.kuzzle.passport.use(
        strategyName,
        instance,
        strategy.config.authenticateOptions);

      if (methods.afterRegister) {
        methods.afterRegister(instance);
      }
    }
    catch (e) {
      throw strategyError.getFrom(
        e,
        'failed_registration',
        strategyName,
        e.message);
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
        throw strategyError.get('unauthorized_removal', strategyName);
      }

      delete this.strategies[strategyName];
      this.kuzzle.passport.unuse(strategyName);
    }
    else {
      throw strategyError.get('strategy_not_found', strategyName);
    }
  }

  /**
   * @param {object} plugin
   * @param {number} pipeWarnTime
   */
  _initPipes (plugin, pipeWarnTime) {
    const methodsList = getMethods(plugin.instance);
    let _warnTime = pipeWarnTime;

    if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
      _warnTime = plugin.config.pipeWarnTime;
    }

    for (const [event, fn] of Object.entries(plugin.instance.pipes)) {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if ( typeof target !== 'function'
          && typeof plugin.instance[target] !== 'function'
        ) {
          const message = typeof target === 'string'
            ? didYouMean(target, methodsList)
            : '';

          throw assertionError.get('invalid_pipe', event, target, message);
        }

        let handler = target;

        if (typeof target === 'string') {
          // @deprecated - warn about using a string representing an instance method
          this.kuzzle.log.warn(`${plugin.logPrefix} Defining pipe handler using a string is deprecated. Pass a function instead.`);

          handler = plugin.instance[target].bind(plugin.instance);
        }

        // if the function handler is a plugin instance method,
        // bound the context to the plugin instance
        if (target.name && typeof plugin.instance[target.name] === 'function') {
          handler = target.bind(plugin.instance);
        }

        this.registerPipe(plugin, _warnTime, event, handler);
      }
    }
  }

  /**
   * @param {object} plugin
   */
  _initHooks (plugin) {
    const methodsList = getMethods(plugin.instance);

    for (const [event, fn] of Object.entries(plugin.instance.hooks)) {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if ( typeof target !== 'function'
          && typeof plugin.instance[target] !== 'function'
        ) {
          const message = typeof target === 'string'
            ? didYouMean(target, methodsList)
            : '';

          throw assertionError.get('invalid_hook', event, target, message);
        }

        debug('[%s] register hook on event "%s"', plugin.name, event);

        let handler = target;

        // @deprecated - warn about using a string representing an instance method
        if (typeof target === 'string') {
          this.kuzzle.log.warn(`${plugin.logPrefix} Defining hook handler using a string is deprecated. Pass a function instead.`);

          handler = plugin.instance[target].bind(plugin.instance);
        }

        // if the function handler is a plugin instance method,
        // bound the context to the plugin instance
        if (target.name && typeof plugin.instance[target.name] === 'function') {
          handler = target.bind(plugin.instance);
        }

        this.kuzzle.registerPluginHook(plugin.name, event, handler);
      }
    }
  }

  async _initApi (plugin) {
    for (const [controller, definition] of Object.entries(plugin.instance.api)) {
      debug(
        '[%s][%s] starting api controller registration',
        plugin.name,
        controller);

      if (await this.kuzzle.ask('kuzzle:api:funnel:controller:isNative', controller)) {
        throw assertionError.get(
          'invalid_controller_definition',
          controller,
          'Native controllers cannot be overriden');
      }

      Plugin.checkControllerDefinition(controller, definition);

      for (const [action, { http, handler } ] of Object.entries(definition.actions)) {
        let apiController = this.controllers.get(controller);

        if (! apiController) {
          apiController = new BaseController();
          this.controllers.set(controller, apiController);
        }

        apiController._addAction(action, handler);

        const httpRoutes = http || [];

        // Define default HTTP route if none have been provided
        if (httpRoutes.length === 0) {
          httpRoutes.push(
            {
              path: `${kebabCase(controller)}/${kebabCase(action)}`,
              verb: 'get',
            }
          );
        }

        for (const httpRoute of httpRoutes) {
          debug(
            '[%s] binding HTTP route "%s" to controller "%s"',
            plugin.name,
            httpRoute.path,
            controller);

          const routePath = httpRoute.path.charAt(0) === '/'
            ? httpRoute.path
            : `/_/${httpRoute.path}`;

          this.routes.push({
            action,
            controller,
            path: routePath,
            verb: httpRoute.verb
          });
        }
      }
    }
  }

  /**
   * Init plugin controllers
   *
   * @param {object} plugin
   * @returns {boolean}
   */
  _initControllers (plugin) {
    // @deprecated - warn about using the obsolete "controllers" object
    if (!_.isEmpty(plugin.instance.controllers)) {
      this.kuzzle.log.warn(`${plugin.logPrefix} Defining controllers using the "controllers" object is deprecated. You should use the "api" object instead.`);
    }

    for (const controller of Object.keys(plugin.instance.controllers)) {
      debug(
        '[%s][%s] starting controller registration',
        plugin.name,
        controller);

      const methodsList = getMethods(plugin.instance);
      const controllerName = `${plugin.name}/${controller}`;
      const definition = plugin.instance.controllers[controller];
      const errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.name}":`;

      if (!isPlainObject(definition)) {
        // @todo deprecate all those errors and use plugin.assert.invalid_controller_definition
        throw controllerError.get(
          'invalid_description',
          errorControllerPrefix,
          typeof definition);
      }

      for (const action of Object.keys(definition)) {
        debug(
          '[%s][%s][%s] starting action controller registration',
          plugin.name,
          controller,
          action);

        if ( typeof definition[action] !== 'function'
          && typeof plugin.instance[definition[action]] !== 'function'
        ) {
          const suggestion = typeof definition[action] === 'string'
            ? didYouMean(definition[action], methodsList)
            : '';

          throw controllerError.get(
            'invalid_action',
            errorControllerPrefix,
            controller,
            action,
            suggestion);
        }

        let apiController = this.controllers.get(controllerName);

        if (! apiController) {
          apiController = new BaseController();
          this.controllers.set(controllerName, apiController);
        }

        if (typeof definition[action] === 'function') {
          apiController._addAction(action, definition[action]);
        }
        else {
          apiController._addAction(
            action,
            plugin.instance[definition[action]].bind(plugin.instance));
        }
      }
    }

    const httpVerbs = ['get', 'head', 'post', 'put', 'delete', 'patch', 'options'];
    const routeProperties = ['verb', 'url', 'controller', 'action', 'path'];
    const controllerNames = Object.keys(plugin.instance.controllers);

    // @deprecated - warn about using the obsolete "routes" object
    if (!_.isEmpty(plugin.instance.routes)) {
      this.kuzzle.log.warn(`${plugin.logPrefix} Defining routes using the "routes" object is deprecated. You should use the "api" object instead.`);
    }

    for (const route of (plugin.instance.routes || [])) {
      const controller = `${plugin.name}/${route.controller}`;
      const errorRoutePrefix = `Unable to inject API route "${JSON.stringify(route)}" from plugin "${plugin.name}":`;

      for (const key of Object.keys(route)) {
        if (routeProperties.indexOf(key) === -1) {
          throw controllerError.get(
            'unexpected_route_property',
            errorRoutePrefix,
            key,
            didYouMean(key, routeProperties));
        }

        if ( typeof route[key] !== 'string'
          || route[key].length === 0 && key !== 'url'
        ) {
          throw controllerError.get('invalid_route_property', errorRoutePrefix, key);
        }
      }

      const apiController = this.controllers.get(controller);

      if (!apiController) {
        throw controllerError.get(
          'undefined_controller',
          errorRoutePrefix,
          route.controller,
          didYouMean(route.controller, controllerNames));
      }

      if (!apiController._isAction(route.action)) {
        const actionNames = Array.from(apiController._actions);
        throw controllerError.get(
          'undefined_action',
          errorRoutePrefix,
          route.action,
          didYouMean(route.action, actionNames));
      }

      if (httpVerbs.indexOf(route.verb.toLowerCase()) === -1) {
        throw controllerError.get(
          'unsupported_verb',
          errorRoutePrefix,
          httpVerbs.join(', '),
          didYouMean(route.verb, httpVerbs));
      }

      // @deprecated route.url is deprecated
      route.path = route.path || route.url;

      debug(
        '[%s] binding HTTP route "%s" to controller "%s"',
        plugin.name,
        route.path,
        route.controller);

      // @deprecated "/_plugin" prefix is deprecated for plugin routes
      this.routes.push({
        action: route.action,
        controller,
        path: `/_plugin/${plugin.name}${route.path}`,
        verb: route.verb
      });

      const routePath = route.path.charAt(0) === '/'
        ? `/_${route.path}`
        : `/_/${plugin.name}/${route.path}`;

      this.routes.push({
        action: route.action,
        controller,
        path: routePath,
        verb: route.verb
      });
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initStrategies (plugin) {
    if ( !isPlainObject(plugin.instance.strategies)
      || _.isEmpty(plugin.instance.strategies)
    ) {
      throw strategyError.get('invalid_definition', plugin.logPrefix);
    }

    for (const name of Object.keys(plugin.instance.strategies)) {
      this.registerStrategy(
        plugin.name,
        name,
        plugin.instance.strategies[name]);
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initAuthenticators (plugin) {
    if (!isPlainObject(plugin.instance.authenticators)) {
      throw kerror.get('plugin', 'authenticators', 'not_an_object', plugin.logPrefix);
    }

    for (const authenticator of Object.keys(plugin.instance.authenticators)) {
      if (!isConstructor(plugin.instance.authenticators[authenticator])) {
        throw kerror.get(
          'plugin',
          'authenticators',
          'invalid_authenticator',
          plugin.logPrefix,
          authenticator);
      }
    }

    this.authenticators[plugin.name] = Object.assign(
      {},
      plugin.instance.authenticators);
  }

  /**
   * Load detected plugins in memory
   *
   * @returns {object} list of loaded plugin
   */
  loadPlugins (plugins = {}) {
    const loadedPlugins = new Map();

    // first load plugins from Backend.plugin.use
    for (const [name, { plugin: instance, manifest }] of Object.entries(plugins)) {
      const plugin = new Plugin(this.kuzzle, instance, { name });

      // the plugin cluster can be loaded in the startup script
      // and we need the manifest
      plugin.manifest = manifest;

      plugin.init(name);

      if (loadedPlugins.has(plugin.name)) {
        throw assertionError.get('name_already_exists', plugin.name);
      }

      loadedPlugins.set(plugin.name, plugin);
    }

    // then try to load plugins from the filesystem
    if (! fs.existsSync(this.pluginsEnabledDir)) {
      return loadedPlugins;
    }

    let pluginsPath = [];

    try {
      pluginsPath = fs.readdirSync(this.pluginsEnabledDir)
        .map(name => path.join(this.pluginsEnabledDir, name))
        .filter(filePath => fs.statSync(filePath).isDirectory());
    }
    catch (e) {
      throw assertionError.get(
        'invalid_plugins_dir',
        this.pluginsEnabledDir,
        e.message);
    }

    debug('loading plugins: %a', pluginsPath);

    for (const relativePluginPath of pluginsPath) {
      const plugin = Plugin.loadFromDirectory(this.kuzzle, relativePluginPath);

      plugin.init(plugin.manifest.raw.name);

      if (loadedPlugins.has(plugin.name)) {
        throw assertionError.get('name_already_exists', plugin.name);
      }

      loadedPlugins.set(plugin.name, plugin);
    }

    return loadedPlugins;
  }

  /**
   * Wraps a strategy plugin's verify function.
   *
   * @param {String} pluginName
   * @param {String} strategyName
   * @param {Function} verifyMethod - Strategy plugin's verify method
   * @returns {Function}
   */
  wrapStrategyVerify (pluginName, strategyName, verifyMethod) {
    const prefix = `${pluginName} Strategy ${strategyName}:`;

    return async (...args) => {
      const callback = args[args.length - 1];
      const ret = verifyMethod(...args.slice(0, -1));

      // catching plugins returning non-thenable content
      // @todo - with async/await we might consider allowing non-promise results
      if (!ret || !_.isFunction(ret.then)) {
        callback(strategyError.get('invalid_verify_return', prefix, ret));
        return;
      }

      let result;

      try {
        result = await ret;
      }
      catch (e) {
        callback(e);
        return;
      }

      if (result === false) {
        callback(null, result, {message: null});
        return;
      }

      if (!isPlainObject(result)) {
        callback(strategyError.get('invalid_verify_resolve', prefix));
        return;
      }

      if (result.kuid !== null && result.kuid !== undefined) {
        if (typeof result.kuid === 'string') {
          try {
            const user = await this.kuzzle.ask(
              'core:security:user:get',
              result.kuid);

            callback(null, user);
          }
          catch (e) {
            if (e.id === 'security.user.not_found') {
              callback(strategyError.get('unknown_kuid', prefix));
            }
            else {
              callback(e);
            }
          }

          return;
        }

        callback(strategyError.get('invalid_kuid', prefix, typeof result.kuid));
        return;
      }

      let message;
      if (result.message && typeof result.message === 'string') {
        message = result.message;
      }
      else {
        message = `Unable to log in using the strategy "${strategyName}"`;
      }

      callback(null, false, { message });
    };
  }
}

/**
 * Test if the provided argument is a constructor or not
 *
 * @param  {*} arg
 * @returns {Boolean}
 */
function isConstructor (arg) {
  try {
    Reflect.construct(Object, [], arg);
  }
  catch (e) {
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
