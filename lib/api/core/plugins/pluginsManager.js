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
  debug = require('../../../kuzzleDebug')('kuzzle:plugins'),
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  fs = require('fs'),
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError
  } = require('kuzzle-common-objects').errors,
  Manifest = require('./manifest');

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
    this.pluginsDir = path.resolve(path.join(this.kuzzle.rootPath, 'plugins/enabled'));

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
   * Load plugin located in "plugins/enabled" folder
   *
   * @throws PluginImplementationError - Throws when an error occurs when loading a plugin
   */
  init() {
    this.plugins = this.load();
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
        if (pluginInfo.object.hasOwnProperty('hooks')) {
          description.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));
        }

        if (pluginInfo.object.hasOwnProperty('pipes')) {
          description.pipes = _.uniq(Object.keys(pluginInfo.object.pipes));
        }

        if (pluginInfo.object.hasOwnProperty('controllers')) {
          description.controllers = _.uniq(Object.keys(pluginInfo.object.controllers));
          description.controllers = description.controllers.map(item => `${pluginInfo.manifest.name}/${item}`);
        }

        if (pluginInfo.object.hasOwnProperty('routes')) {
          description.routes = _.uniq(pluginInfo.object.routes);
        }

        if (pluginInfo.object.hasOwnProperty('strategies')) {
          description.strategies = Object.keys(pluginInfo.object.strategies);
        }
      }
      else {
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


      debug('[%s] starting plugin in "%s" mode', plugin.manifest.name, plugin.config.privileged ? 'privileged' : 'standard');

      return Bluebird.resolve(plugin.object.init(
        plugin.config,
        plugin.config.privileged ? new PrivilegedPluginContext(this.kuzzle, plugin.manifest.name) : new PluginContext(this.kuzzle, plugin.manifest.name)
      ))
        .timeout(initTimeout)
        .then(initStatus => {
          if (initStatus === false) {
            throw new PluginImplementationError(`Something went wrong during initialization of "${plugin.manifest.name}" plugin.`);
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

          return reject(new PluginImplementationError(error));
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
      throw new PluginImplementationError(`${errorPrefix} expected the strategy description to be an object, got: ${strategy}`);
    }

    if (!_.isPlainObject(strategy.methods)) {
      throw new PluginImplementationError(`${errorPrefix} expected a "methods" property of type "object", got: ${strategy.methods}`);
    }

    const pluginObject = this.plugins[pluginName].object;

    // required methods check
    ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
      if (!_.isString(strategy.methods[methodName])) {
        throw new PluginImplementationError(`${errorPrefix} expected a "${methodName}" property of type "string", got: ${strategy.methods[methodName]}`);
      }

      if (!_.isFunction(pluginObject[strategy.methods[methodName]])) {
        throw new PluginImplementationError(`${errorPrefix} the strategy method "${strategy.methods[methodName]}" must point to an exposed function`);
      }
    });

    // optional methods check
    ['getInfo', 'getById', 'afterRegister' ].forEach(name => {
      const optionalMethodName = strategy.methods[name];

      if (!_.isNil(optionalMethodName)) {
        if (!_.isString(optionalMethodName)) {
          throw new PluginImplementationError(`${errorPrefix} expected the "${name}" property to be of type "string", got: ${optionalMethodName}`);
        }

        if (!_.isFunction(pluginObject[optionalMethodName])) {
          throw new PluginImplementationError(`${errorPrefix} the strategy method "${optionalMethodName}" must point to an exposed function`);
        }
      }
    });

    if (!_.isPlainObject(strategy.config)) {
      throw new PluginImplementationError(`${errorPrefix} expected a "config" property of type "object", got: ${strategy.config}`);
    }

    // @deprecated since version 1.4.0
    // Note: since "constructor" is a reserved keyword, and since
    // any object, even POJOs, have a default constructor, we need
    // to consider a native function to be an unspecified "constructor"
    // property
    if (!_.isNil(strategy.config.constructor) && !_.isNative(strategy.config.constructor)) {
      if (!_.isNil(strategy.config.authenticator)) {
        throw new PluginImplementationError(`${errorPrefix} the "authenticator" and "constructor" parameters cannot both be set`);
      }

      if (isConstructor(strategy.config.constructor)) {
        this.kuzzle.log.warn(`${errorPrefix} the strategy "constructor" property is deprecated, please use "authenticator" instead (see https://tinyurl.com/y7boozbk)`);
      } else {
        throw new PluginImplementationError(`${errorPrefix} invalid "constructor" property value: constructor expected`);
      }
    } else if (!_.isString(strategy.config.authenticator)) {
      throw new PluginImplementationError(`${errorPrefix} expected an "authenticator" property of type "string", got: ${strategy.config.authenticator}`);
    } else if (!this.authenticators[pluginName] || !this.authenticators[pluginName][strategy.config.authenticator]) {
      throw new PluginImplementationError(`${errorPrefix} unknown authenticator value: ${strategy.config.authenticator}`);
    }

    for (const opt of ['strategyOptions', 'authenticateOptions']) {
      const obj = strategy.config[opt];

      if (!_.isNil(obj) && !_.isPlainObject(obj)) {
        throw new PluginImplementationError(`${errorPrefix} expected the "${opt}" property to be of type "object", got: ${obj}`);
      }
    }

    if (!_.isNil(strategy.config.fields) && !Array.isArray(strategy.config.fields)) {
      throw new PluginImplementationError(`${errorPrefix} expected the "fields" property to be of type "array", got: ${strategy.config.fields}`);
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
          callback(new GatewayTimeoutError(errorMsg));
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
      }
      catch (error) {
        if (error instanceof KuzzleError) {
          return cb(error);
        }

        cb(new PluginImplementationError(
          `Plugin ${name} pipe for event '${event}' threw a non-Kuzzle error: ${error}`));
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
      }
      catch (error) {
        throw new PluginImplementationError(error);
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
    for (const methodName of Object.keys(strategy.methods).filter(name => name !== 'verify')) {
      methods[methodName] = (...args) => {
        return new Bluebird((resolve, reject) => {
          try {
            resolve(plugin.object[strategy.methods[methodName]].bind(plugin.object)(...args));
          }
          catch (error) {
            reject(error instanceof KuzzleError ? error : new PluginImplementationError(error));
          }
        });
      };
    }

    const
      opts = Object.assign({}, strategy.config.strategyOptions, {passReqToCallback: true}),
      verifyAdapter = (...args) => {
        const
          callback = args[args.length - 1],
          ret = plugin.object[strategy.methods.verify](...args.slice(0, -1));

        // catching plugins returning non-thenable content
        if (!ret || !_.isFunction(ret.then)) {
          return callback(new PluginImplementationError(`${errorPrefix} expected the "verify" to return a Promise, got: `));
        }

        let message = null;

        ret
          .then(result => {
            if (result === false) {
              return false;
            }

            if (!_.isPlainObject(result)) {
              throw new PluginImplementationError(`${errorPrefix} invalid authentication strategy result`);
            }

            if (result.kuid !== null && result.kuid !== undefined) {
              if (typeof result.kuid === 'string') {
                return this.kuzzle.repositories.user.load(result.kuid);
              }

              throw new PluginImplementationError(`${errorPrefix} invalid authentication kuid returned: expected a string, got a ${typeof result.kuid}`);
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
              throw new PluginImplementationError(`${errorPrefix} returned an unknown Kuzzle user identifier`);
            }

            callback(null, result, {message});
            return null;
          })
          .catch(error => callback(error));
      };

    try {
      const
        Ctor = _.get(this.authenticators, [pluginName, strategy.config.authenticator], strategy.config.constructor),
        instance = new Ctor(opts, verifyAdapter);

      this.strategies[strategyName] = {strategy, methods, owner: pluginName};
      this.kuzzle.passport.use(strategyName, instance, strategy.config.authenticateOptions);

      if (methods.afterRegister) {
        methods.afterRegister(instance);
      }
    }
    catch (e) {
      throw new PluginImplementationError(`${errorPrefix}: ${e.message}.`);
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
        throw new PluginImplementationError(`Cannot remove strategy ${strategyName}: owned by another plugin`);
      }

      delete this.strategies[strategyName];
      this.kuzzle.passport.unuse(strategyName);
    }
    else {
      throw new PluginImplementationError(`Cannot remove strategy ${strategyName}: strategy does not exist`);
    }
  }

  /**
   * @param {object} plugin
   * @param {number} pipeWarnTime
   * @param {number} pipeTimeout
   */
  _initPipes (plugin, pipeWarnTime, pipeTimeout) {
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
        if (typeof target !== 'function' && typeof plugin.object[target] !== 'function') {
          throw new PluginImplementationError(`Unable to configure pipe for event '${event}' with provided method. ${target} should be a plugin method name, or a function.`);
        }

        this.registerPipe(plugin, _warnTime, _timeout, event, target);
      }
    });
  }

  /**
   * @param {object} plugin
   */
  _initHooks (plugin) {
    _.forEach(plugin.object.hooks, (fn, event) => {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        if (typeof target !== 'function' && typeof plugin.object[target] !== 'function') {
          throw new PluginImplementationError(`Unable to configure hook for event '${event}' with provided method. ${target} should be a plugin method name, or a function.`);
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
      debug('[%s][%s] starting controller registration', plugin.manifest.name, controller);

      const
        description = plugin.object.controllers[controller],
        errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.manifest.name}":`;

      if (!_.isPlainObject(description)) {
        throw new PluginImplementationError(`${errorControllerPrefix} Incorrect controller description type (expected object, got: "${typeof description}")`);
      }

      Object.keys(description).forEach(action => {
        debug('[%s][%s][%s] starting action controller registration', plugin.manifest.name, controller, action);

        if (typeof description[action] !== 'function' && typeof plugin.object[description[action]] !== 'function') {
          throw new PluginImplementationError(`${errorControllerPrefix} Action for '${controller}:${action}' is not a function`);
        }

        if (!this.controllers[`${plugin.manifest.name}/${controller}`]) {
          this.controllers[`${plugin.manifest.name}/${controller}`] = {};
        }

        if (typeof description[action] === 'function') {
          this.controllers[`${plugin.manifest.name}/${controller}`][action] = description[action];
        } else {
          this.controllers[`${plugin.manifest.name}/${controller}`][action] = plugin.object[description[action]].bind(plugin.object);
        }
      });
    });

    const allowedVerbs = ['get', 'head', 'post', 'put', 'delete', 'patch'];

    if (plugin.object.routes) {
      plugin.object.routes.forEach(route => {
        const errorRoutePrefix = `Unable to inject api route "${JSON.stringify(route)}" from plugin "${plugin.manifest.name}":`;

        Object.keys(route).forEach(key => {
          if (['verb', 'url', 'controller', 'action'].indexOf(key) === -1) {
            throw new PluginImplementationError(`${errorRoutePrefix} Unknown route definition "${key}"`);
          }

          if (typeof route[key] !== 'string' || (route[key].length === 0 && key !== 'url')) {
            throw new PluginImplementationError(`${errorRoutePrefix} "${key}" must be a non-empty string`);
          }
        });

        if (!this.controllers[`${plugin.manifest.name}/${route.controller}`]) {
          throw new PluginImplementationError(`${errorRoutePrefix} Undefined controller "${route.controller}"`);
        }

        if (!this.controllers[`${plugin.manifest.name}/${route.controller}`][route.action]) {
          throw new PluginImplementationError(`${errorRoutePrefix} Undefined action "${route.action}"`);
        }

        if (allowedVerbs.indexOf(route.verb.toLowerCase()) === -1) {
          throw new PluginImplementationError(`${errorRoutePrefix} Only following http verbs are allowed: "${allowedVerbs.join(', ')}"`);
        }

        route.url = '/' + plugin.manifest.name + route.url;
        route.controller = plugin.manifest.name + '/' + route.controller;

        debug('[%s] binding HTTP route "%s" to controller "%s"', plugin.manifest.name, route.url, route.controller);
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

    if (!_.isPlainObject(plugin.object.strategies) || _.isEmpty(plugin.object.strategies)) {
      throw new PluginImplementationError(`${errorPrefix} the exposed "strategies" plugin property must be a non-empty object`);
    }

    for (const name of Object.keys(plugin.object.strategies)) {
      this.registerStrategy(plugin.manifest.name, name, plugin.object.strategies[name]);
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
        throw new PluginImplementationError(`${errorPrefix} the exposed "authenticators" plugin property must be of type "object"`);
      }

      for (const authenticator of Object.keys(plugin.object.authenticators)) {
        if (!isConstructor(plugin.object.authenticators[authenticator])) {
          throw new PluginImplementationError(`${errorPrefix} invalid authenticator ${authenticator}: expected a constructor`);
        }
      }

      this.authenticators[plugin.manifest.name] = Object.assign({}, plugin.object.authenticators);
    }
  }

  /**
   * Load detected plugins in memory
   *
   * @returns {object} list of loaded plugin
   */
  load() {
    const loadedPlugins = {};

    let plugins = [];
    try {
      plugins = fs.readdirSync(this.pluginsDir);
    }
    catch(e) {
      throw new PluginImplementationError(`Unable to load plugins from directory "${this.pluginsDir}"; ${e.message}`);
    }

    for (const plugin of plugins) {
      const pluginPath = path.join(this.pluginsDir, plugin);

      try {
        fs.statSync(pluginPath).isDirectory();
      }
      catch(e) {
        throw new PluginImplementationError(`Unable to load plugin from path "${pluginPath}"; ${e.message}`);
      }
    }

    debug('loading plugins: %a', plugins);

    for (const relativePluginPath of plugins) {
      const
        pluginPath = path.resolve(this.pluginsDir, relativePluginPath),
        manifest = new Manifest(this.kuzzle, pluginPath);

      manifest.load();

      const
        plugin = {
          manifest,
          object: null,
          config: this.config[manifest.name] || {}
        };

      // load plugin object
      try {
        const PluginClass = require(pluginPath);
        plugin.object = new PluginClass();
      } catch (e) {
        if (e.message.match(/not a constructor/i)) {
          throw new PluginImplementationError(`Plugin ${plugin.manifest.name} is not a constructor`);
        }

        throw new PluginImplementationError(e);
      }

      // check if the plugin exposes a "init" method
      if (typeof plugin.object.init !== 'function') {
        throw new PluginImplementationError(`[${plugin.manifest.name}] No "init" method found.`);
      }

      // check plugin privileged prerequisites
      // user need to acknowledge privileged mode in plugin configuration
      if (plugin.config.privileged) {
        if (!plugin.manifest.privileged) {
          throw new PluginImplementationError(`The plugin "${plugin.manifest.name}" is configured to run in privileged mode, but it does not seem to support it`);
        }
      }
      else if (plugin.manifest.privileged) {
        throw new PluginImplementationError(`The plugin "${plugin.manifest.name}" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration`);
      }

      if (loadedPlugins[plugin.manifest.name]) {
        throw new PluginImplementationError(`A plugin named ${plugin.manifest.name} already exists`);
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

module.exports = PluginsManager;
