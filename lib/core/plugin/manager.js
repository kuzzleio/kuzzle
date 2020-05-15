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

const path = require('path');
const Bluebird = require('bluebird');
const _ = require('lodash');
const fs = require('fs');

const kerror = require('../../kerror');
const didYouMean = require('../../util/didYouMean');
const debug = require('../../util/debug')('kuzzle:plugins');
const { errors: { KuzzleError } } = require('kuzzle-common-objects');
const { has, get, isPlainObject } = require('../../util/safeObject');
const { BaseController } = require('../../api/controller/base');

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
    this.kuzzle = kuzzle;

    this.plugins = new Map();

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

  /**
   * Load plugin located in "plugins/enabled" folder and from CLI arguments
   *
   * @param  {Array.<string>} plugins - Plugins passed as CLI arguments
   * @throws PluginImplementationError - Throws when an error occurs when loading a plugin
   */
  init (additionalPlugins = []) {
    this.plugins = this.loadPlugins(additionalPlugins);
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
    return this.plugins.has(pluginName);
  }

  /**
   * Used to dump loaded plugin feature into serverInfo route / cli
   *
   * @returns {object}
   */
  getPluginsDescription () {
    const pluginsDescription = {};

    for (const plugin of this.plugins.values()) {

      const description = {
        controllers: [],
        hooks: [],
        manifest: plugin.manifest,
        pipes: [],
        routes: [],
        strategies: [],
        version: plugin.version
      };

      if (plugin.instance) {
        if (has(plugin.instance, 'hooks')) {
          description.hooks = _.uniq(Object.keys(plugin.instance.hooks));
        }

        if (has(plugin.instance, 'pipes')) {
          description.pipes = _.uniq(Object.keys(plugin.instance.pipes));
        }

        if (has(plugin.instance, 'controllers')) {
          description.controllers = _
            .uniq(Object.keys(plugin.instance.controllers))
            .map(controller => `${plugin.name}/${controller}`);
        }

        if (has(plugin.instance, 'routes')) {
          description.routes = _.uniq(plugin.instance.routes);
        }

        if (has(plugin.instance, 'strategies')) {
          description.strategies = Object.keys(plugin.instance.strategies);
        }
      }
      else {
        this.kuzzle.log.warn(
          `[Plugin manager]: Unable to load features from plugin "${plugin.name}"`
        );
      }

      pluginsDescription[plugin.name] = description;

      debug('[%s] reading plugin configuration: %a', plugin, description);
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
  async run () {
    if (this.plugins.size === 0) {
      return;
    }

    // register regular plugins features
    const loadPlugins = [];

    for (const plugin of this.plugins.values()) {
      const { pipeWarnTime, pipeTimeout, initTimeout } = this.config.common;

      debug(
        '[%s] starting plugin in "%s" mode',
        plugin.name,
        plugin.config.privileged ? 'privileged' : 'standard');

      const promise = Bluebird
        .resolve((async () => {
          await plugin.instance.init(plugin.config, plugin.context);

          return true;
        })()) // @todo why?
        .timeout(initTimeout, `Plugin "${plugin.name} initialization timed out after ${initTimeout}ms. Try to increase the configuration "plugins.common.initTimeout".`)
        .then(initStatus => {
          if (! initStatus) {
            throw runtimeError.get('failed_init', plugin.name);
          }

          plugin.initCalled = true;

          if (! _.isEmpty(plugin.instance.controllers)) {
            this._initControllers(plugin);
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
            this._initPipes(plugin, pipeWarnTime, pipeTimeout);
          }

          debug('[%s] plugin started', plugin.name);
        });

      loadPlugins.push(promise);
    }

    await Promise.all(loadPlugins);
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

    const plugin = this.plugins.get(pluginName.toLowerCase());

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
   * @param {string|function} fn - function to attach
   */
  registerPipe (plugin, warnDelay, event, fn) {
    const _fn = typeof fn === 'function' ? fn : plugin.object[fn];
    const name = plugin.manifest.name;

    debug('[%s] registering pipe on event "%s"', name, event);

    const wrapper = (...data) => {
      const now = warnDelay ? Date.now() : null;
      const callback = data.pop();

      const cb = (error, result) => {
        if (warnDelay) {
          const elapsed = Date.now() - now;

          if (elapsed > warnDelay) {
            this.kuzzle.log.warn(`[${name}] pipe for event '${event}' is slow (${elapsed}ms)`);
          }
        }

        callback(error, result);
      };

      try {
        const pipeResponse = data.length === 0
          ? _fn(null, cb)
          : _fn(...data, cb);

        if ( typeof pipeResponse === 'object'
          && pipeResponse !== null
          && typeof pipeResponse.then === 'function'
          && typeof pipeResponse.catch === 'function'
        ) {
          pipeResponse
            .then(result => cb(null, result))
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
    // only add the strategy to the strategies object if the init method
    // has not been called
    const plugin = this.plugins.get(pluginName);

    if (! plugin.initCalled) {
      plugin.instance.strategies = plugin.instance.strategies || {};
      plugin.instance.strategies[strategyName] = strategy;

      return;
    }

    const errorPrefix = `[${plugin.name}] Strategy ${strategyName}:`;
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
      methods[methodName] = (...args) => {
        return new Bluebird((resolve, reject) => {
          try {
            resolve(
              plugin.instance[strategy.methods[methodName]].bind(
                plugin.instance)(...args));
          }
          catch (error) {
            reject(error instanceof KuzzleError
              ? error
              : runtimeError.getFrom(error, 'unexpected_error', error.message));
          }
        });
      };
    }

    const
      opts = Object.assign(
        {},
        strategy.config.strategyOptions,
        { passReqToCallback: true }),

      verifyAdapter = (...args) => {
        const
          callback = args[args.length - 1],
          ret = plugin.instance[strategy.methods.verify](...args.slice(0, -1));

        // catching plugins returning non-thenable content
        if (!ret || !_.isFunction(ret.then)) {
          callback(strategyError.get('invalid_verify_return', errorPrefix, ret));
          return;
        }

        let message = null;

        ret
          .then(result => {
            if (result === false) {
              return false;
            }

            if (!isPlainObject(result)) {
              throw strategyError.get('invalid_verify_resolve', errorPrefix);
            }

            if (result.kuid !== null && result.kuid !== undefined) {
              if (typeof result.kuid === 'string') {
                return this.kuzzle.repositories.user.load(result.kuid);
              }

              throw strategyError.get(
                'invalid_kuid',
                errorPrefix,
                typeof result.kuid);
            }

            if (result.message && typeof result.message === 'string') {
              message = result.message;
            }
            else {
              message = `Unable to log in using the strategy "${strategyName}"`;
            }

            return false;
          })
          .then(result => {
            if (result === null) {
              throw strategyError.get('unknown_kuid', errorPrefix);
            }

            callback(null, result, { message });
            return null;
          })
          .catch(error => callback(error));
      };

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
    const methodsList = getMethods(plugin.object);
    let _warnTime = pipeWarnTime;

    if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
      _warnTime = plugin.config.pipeWarnTime;
    }

    for (const [event, fn] of Object.entries(plugin.object.pipes)) {
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

        this.registerPipe(plugin, _warnTime, event, target);
      }
    }
  }

  /**
   * @param {object} plugin
   */
  _initHooks (plugin) {
    const methodsList = getMethods(plugin.instance);

    _.forEach(plugin.instance.hooks, (fn, event) => {
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

        debug('[%s] register hook on event "%s"', plugin.manifest.name, event);

        this.kuzzle.registerPluginHook(event, typeof target === 'function'
          ? target
          : plugin.object[target].bind(plugin.object));
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
    Object.keys(plugin.instance.controllers).forEach(controller => {
      debug(
        '[%s][%s] starting controller registration',
        plugin.name,
        controller);

      const
        methodsList = getMethods(plugin.instance),
        controllerName = `${plugin.name}/${controller}`,
        description = plugin.instance.controllers[controller],
        errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.name}":`;

      if (!isPlainObject(description)) {
        throw controllerError.get(
          'invalid_description',
          errorControllerPrefix,
          typeof description);
      }

      Object.keys(description).forEach(action => {
        debug(
          '[%s][%s][%s] starting action controller registration',
          plugin.name,
          controller,
          action);

        if ( typeof description[action] !== 'function'
          && typeof plugin.instance[description[action]] !== 'function'
        ) {
          const suggestion = typeof description[action] === 'string'
            ? didYouMean(description[action], methodsList)
            : '';

          throw controllerError.get(
            'invalid_action',
            errorControllerPrefix,
            controller,
            action,
            suggestion);
        }

        let apiController = this.controllers.get(controllerName);

        if (!apiController) {
          apiController = new BaseController();
          this.controllers.set(controllerName, apiController);
        }

        if (typeof description[action] === 'function') {
          apiController._addAction(action, description[action]);
        }
        else {
          apiController._addAction(
            action,
            plugin.instance[description[action]].bind(plugin.instance));
        }
      });
    });

    const
      httpVerbs = ['get', 'head', 'post', 'put', 'delete', 'patch'],
      routeProperties = ['verb', 'url', 'controller', 'action'],
      controllerNames = Object.keys(plugin.instance.controllers);

    if (plugin.instance.routes) {
      plugin.instance.routes.forEach(route => {
        const
          controllerName = `${plugin.name}/${route.controller}`,
          errorRoutePrefix = `Unable to inject API route "${JSON.stringify(route)}" from plugin "${plugin.name}":`;

        Object.keys(route).forEach(key => {
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
        });

        const apiController = this.controllers.get(controllerName);

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

        debug(
          '[%s] binding HTTP route "%s" to controller "%s"',
          plugin.name,
          route.url,
          route.controller);

        route.url = `/${plugin.name}${route.url}`;
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
    // @todo put in plugin.errorPrefix
    const errorPrefix = `[${plugin.name}]:`;

    if ( !isPlainObject(plugin.instance.strategies)
      || _.isEmpty(plugin.instance.strategies)
    ) {
      throw strategyError.get('invalid_definition', errorPrefix);
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
    const errorPrefix = `[${plugin.name}]:`;

    if (!isPlainObject(plugin.object.authenticators)) {
      throw kerror.get('plugin', 'authenticators', 'not_an_object', errorPrefix);
    }

    for (const authenticator of Object.keys(plugin.object.authenticators)) {
      if (!isConstructor(plugin.object.authenticators[authenticator])) {
        throw kerror.get(
          'plugin',
          'authenticators',
          'invalid_authenticator',
          errorPrefix,
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
  loadPlugins (additionalPlugins = []) {
    const loadedPlugins = new Map();

    let plugins = [];

    try {
      plugins = fs.readdirSync(this.pluginsEnabledDir).map(name => (
        path.join(this.pluginsEnabledDir, name)
      ));
    }
    catch (e) {
      throw assertionError.get(
        'invalid_plugins_dir',
        this.pluginsEnabledDir,
        e.message);
    }

    // Add CLI enabled plugins.
    // See CLI `start` command `--enable-plugins` option.
    if (additionalPlugins.length > 0) {
      plugins = additionalPlugins
        .filter(additionalPlugin => ! plugins.some(p => p.includes(additionalPlugin)))
        .map(additionalPlugin => path.join(this.pluginsAvailableDir, additionalPlugin))
        .concat(plugins);
    }

    debug('loading plugins: %a', plugins);

    for (const relativePluginPath of plugins) {
      const plugin = Plugin.loadFromDirectory(this.kuzzle, relativePluginPath);

      if (loadedPlugins.has(plugin.name)) {
        throw assertionError.get('name_already_exists', plugin.name);
      }

      loadedPlugins.set(plugin.name, plugin);
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
