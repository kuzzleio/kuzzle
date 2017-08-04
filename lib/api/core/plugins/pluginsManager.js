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
  debug = require('../../../kuzzleDebug')('kuzzle:plugins'),
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  fs = require('fs'),
  semver = require('semver'),
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

// This is default manifest for all plugin, can be overriden by "manifest.json" file at root path of each plugin
const defaultManifest = {
  privileged: false,
  kuzzleVersion: '1.x'
};

/*
 We use the console to display information, as there may be no logger plugin available while installing/launching
 plugins
 */

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
    this.authentications = {};
    this.routes = [];
    this.config = kuzzle.config.plugins;
    this.registeredStrategies = [];
  }

  /**
   * Load plugin located in "plugins/enabled" folder
   *
   * @throws PluginImplementationError - Throws when an error occurs when loading a plugin
   */
  init() {
    this.plugins = loadPlugins(this.config, this.kuzzle.config.version, this.kuzzle.rootPath);
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
          name: pluginInfo.name,
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
          description.controllers = description.controllers.map(item => `${pluginInfo.name}/${item}`);
        }

        if (pluginInfo.object.hasOwnProperty('routes')) {
          description.routes = _.uniq(pluginInfo.object.routes);
        }

        if (pluginInfo.object.hasOwnProperty('strategies')) {
          description.strategies = Object.keys(pluginInfo.object.strategies);
        }
      }
      else {
        // eslint-disable-next-line no-console
        console.warn(`[Plugin manager]: Unable to load features from plugin "${plugin}"`);
      }

      pluginsDescription[description.name] = description;

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


      debug('[%s] starting plugin in "%s" mode', plugin.name, plugin.config.privileged ? 'privileged' : 'standard');

      return Bluebird.resolve(plugin.object.init(
          plugin.config,
          plugin.config.privileged ? new PrivilegedPluginContext(this.kuzzle, plugin.name) : new PluginContext(this.kuzzle, plugin.name)
        ))
        .timeout(initTimeout)
        .then(initStatus => {
          if (initStatus === false) {
            throw new PluginImplementationError(`Something went wrong during initialization of "${plugin.name}" plugin.`);
          }

          if (plugin.object.controllers) {
            initControllers(this, plugin);
          }

          if (plugin.object.strategies) {
            initAuthentication(this, plugin);
          }

          if (plugin.object.hooks) {
            initHooks(this, plugin);
          }

          if (plugin.object.pipes) {
            initPipes(this, plugin, pipeWarnTime, pipeTimeout);
          }

          debug('[%s] plugin started', plugin.name);
        });
    }));
  }

  /**
   * Trigger an event for emit event and chain pipes
   *
   * @param {string} event
   * @param {*} data
   * @returns {Promise}
   */
  trigger(event, data) {
    debug('trigger "%s" event', event);

    return triggerPipes(this.pipes, event, data)
      .then(modifiedData => triggerHooks(this.kuzzle, event, modifiedData));
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
    return this.authentications[strategyName].strategy.config.fields;
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {boolean}
   */
  hasStrategyMethod (strategyName, methodName) {
    return Boolean(this.authentications[strategyName].methods[methodName]);
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {function}
   */
  getStrategyMethod (strategyName, methodName) {
    return this.authentications[strategyName].methods[methodName];
  }

  /**
   * Returns the list of registered passport strategies
   * @returns {string[]}
   */
  listStrategies () {
    return this.registeredStrategies;
  }
}

/**
 * Loads installed plugins in memory
 *
 * @param {object} config - plugins configuration
 * @param {number} kuzzleVersion
 * @param {string} rootPath - Kuzzle root directory
 * @returns {object} list of loaded plugin
 */
function loadPlugins(config, kuzzleVersion, rootPath) {
  const
    pluginsDir = path.resolve(path.join(rootPath, 'plugins/enabled')),
    loadedPlugins = {};

  let pluginList = [];

  try {
    pluginList = fs.readdirSync(pluginsDir);
  }
  catch(e) {
    throw new PluginImplementationError(`Unable to load plugins from directory "${pluginsDir}"; ${e.message}`);
  }

  pluginList = pluginList.filter(element => {
    const pluginPath = path.join(pluginsDir, element);

    try {
      return fs.statSync(pluginPath).isDirectory();
    }
    catch(e) {
      throw new PluginImplementationError(`Unable to load plugin from path "${pluginPath}"; ${e.message}`);
    }
  });

  debug('loading plugins: %a', pluginList);

  pluginList.forEach(pluginDirName => {
    let packageJson;
    const pluginPath = path.resolve(pluginsDir, pluginDirName);

    try {
      packageJson = require(path.resolve(pluginPath, 'package.json'));
    }
    catch(e) {
      throw new PluginImplementationError(`Unable to load plugin from path "${pluginDirName}"; No package.json found.`);
    }

    if (loadedPlugins[packageJson.name]) {
      throw new PluginImplementationError(`A plugin named ${packageJson.name} already exists`);
    }

    const
      plugin = {
        name: packageJson.name,
        path: pluginPath,
        object: null,
        config: {},
        manifest: Object.assign({}, defaultManifest)
      };

    debug('[%s] loading plugin from directory "%s"', plugin.name, plugin.path);

    try {
      plugin.manifest = Object.assign(plugin.manifest, require(path.resolve(plugin.path, 'manifest.json')));
    }
    catch(e) {
      // do nothing, simply use default manifest
    }

    // check for kuzzle core version prerequisite
    if (!semver.satisfies(kuzzleVersion, plugin.manifest.kuzzleVersion)) {
      throw new PluginImplementationError(`Unable to validate plugin "${plugin.name}"; required kuzzle version (${plugin.manifest.kuzzleVersion}) does not satisfies current: ${kuzzleVersion}`);
    }

    // check for existing custom configuration
    plugin.config = config[plugin.name] || plugin.config;

    // load plugin object
    try {
      const PluginClass = require(plugin.path);
      plugin.object = new PluginClass();
    } catch (e) {
      throw new PluginImplementationError(`Unable to require plugin "${plugin.name}" from directory "${plugin.path}"; ${e.message}`);
    }

    // check plugin privileged prerequisites
    // user need to acknowledge privileged mode in plugin configuration
    if (plugin.config.privileged) {
      if (!plugin.manifest.privileged) {
        throw new PluginImplementationError(`The plugin "${plugin.name}" is configured to run in privileged mode, but it does not seem to support it`);
      }
    }
    else if (plugin.manifest.privileged) {
      throw new PluginImplementationError(`The plugin "${plugin.name}" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration`);
    }

    loadedPlugins[plugin.name] = plugin;
  });

  return loadedPlugins;
}

/**
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @param {number} pipeWarnTime
 * @param {number} pipeTimeout
 */
function initPipes (pluginsManager, plugin, pipeWarnTime, pipeTimeout) {
  let
    _warnTime = pipeWarnTime,
    _timeout = pipeTimeout;

  if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
    _warnTime = plugin.config.pipeWarnTime;
  }
  if (plugin.config && plugin.config.pipeTimeout !== undefined) {
    _timeout = plugin.config.pipeTimeout;
  }

  _.forEach(plugin.object.pipes, (fn, pipe) => {
    if (Array.isArray(fn)) {
      fn
        .filter(target => typeof plugin.object[target] === 'function')
        .forEach(func => registerPipe(pluginsManager, plugin, _warnTime, _timeout, pipe, func));
    }
    else if (typeof plugin.object[fn] === 'function') {
      registerPipe(pluginsManager, plugin, _warnTime, _timeout, pipe, fn);
    }
  });
}

/**
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 */
function initHooks (pluginsManager, plugin) {
  _.forEach(plugin.object.hooks, (fn, event) => {
    if (Array.isArray(fn)) {
      fn
        .filter(target => typeof plugin.object[target] === 'function')
        .forEach(func => registerHook(pluginsManager, plugin, event, func));
    }
    else if (typeof plugin.object[fn] === 'function') {
      registerHook(pluginsManager, plugin, event, fn);
    }
  });
}

/**
 * Init plugin controllers
 *
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @returns {boolean}
 */
function initControllers (pluginsManager, plugin) {
  Object.keys(plugin.object.controllers).forEach(controller => {
    debug('[%s][%s] starting controller registration', plugin.name, controller);

    const
      description = plugin.object.controllers[controller],
      errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.name}":`;

    if (!isObject(description)) {
      throw new PluginImplementationError(`${errorControllerPrefix} Incorrect controller description type (expected object, got: "${typeof description}")`);
    }

    Object.keys(description).forEach(action => {
      debug('[%s][%s][%s] starting action controller registration', plugin.name, controller, action);

      if (typeof description[action] !== 'string' || description[action].length === 0) {
        throw new PluginImplementationError(`${errorControllerPrefix} Invalid action description (expected non-empty string, got: "${typeof action}")`);
      }

      if (!isFunction(plugin.object[description[action]])) {
        throw new PluginImplementationError(`${errorControllerPrefix} Action "${plugin.name + '.' + description[action]}" is not a function`);
      }

      if (!pluginsManager.controllers[`${plugin.name}/${controller}`]) {
        pluginsManager.controllers[`${plugin.name}/${controller}`] = {};
      }

      pluginsManager.controllers[`${plugin.name}/${controller}`][action] = plugin.object[description[action]].bind(plugin.object);
    });
  });

  const allowedVerbs = ['get', 'head', 'post', 'put', 'delete'];

  if (plugin.object.routes) {
    plugin.object.routes.forEach(route => {
      const errorRoutePrefix = `Unable to inject api route "${JSON.stringify(route)}" from plugin "${plugin.name}":`;

      Object.keys(route).forEach(key => {
        if (['verb', 'url', 'controller', 'action'].indexOf(key) === -1) {
          throw new PluginImplementationError(`${errorRoutePrefix} Unknown route definition "${key}"`);
        }

        if (typeof route[key] !== 'string' || (route[key].length === 0 && key !== 'url')) {
          throw new PluginImplementationError(`${errorRoutePrefix} "${key}" must be a non-empty string`);
        }
      });

      if (!pluginsManager.controllers[`${plugin.name}/${route.controller}`]) {
        throw new PluginImplementationError(`${errorRoutePrefix} Undefined controller "${route.controller}"`);
      }

      if (!pluginsManager.controllers[`${plugin.name}/${route.controller}`][route.action]) {
        throw new PluginImplementationError(`${errorRoutePrefix} Undefined action "${route.action}"`);
      }


      if (allowedVerbs.indexOf(route.verb.toLowerCase()) === -1) {
        throw new PluginImplementationError(`${errorRoutePrefix} Only following http verbs are allowed: "${allowedVerbs.join(', ')}"`);
      }

      route.url = '/' + plugin.name + route.url;
      route.controller = plugin.name + '/' + route.controller;

      debug('[%s] binding HTTP route "%s" to controller "%s"', plugin.name, route.url, route.controller);
      pluginsManager.routes.push(route);
    });
  }
}

/**
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @return {boolean} return true if authentication strategies was successfully injected
 */
function initAuthentication(pluginsManager, plugin) {
  const
    mandatoryMethods = ['exists', 'create', 'update', 'delete', 'validate', 'verify'],
    errorPrefix = `Unable to inject strategies from plugin "${plugin.name}":`;

  if (!isObject(plugin.object.strategies) || Object.keys(plugin.object.strategies).length === 0) {
    throw new PluginImplementationError(`${errorPrefix} The plugin must provide an object "strategies".`);
  }

  Object.keys(plugin.object.strategies).forEach(strategyName => {
    /** @type AuthenticationStrategy */
    const strategy = plugin.object.strategies[strategyName];

    if (!isObject(strategy)) {
      throw new PluginImplementationError(`${errorPrefix} The plugin must provide an object for strategy "${strategyName}".`);
    }

    if (pluginsManager.registeredStrategies.indexOf(strategyName) !== -1) {
      throw new PluginImplementationError(`${errorPrefix} An authentication strategy "${strategyName}" has already been registered.`);
    }

    if (!isObject(strategy.methods)) {
      throw new PluginImplementationError(`${errorPrefix} The plugin must provide a "methods" object in strategies['${strategyName}'] property.`);
    }
    else {
      mandatoryMethods.forEach(methodName => {
        if (!isString(strategy.methods[methodName])) {
          throw new PluginImplementationError(`${errorPrefix} The plugin must provide a method "${methodName}" in strategy configuration.`);
        }

        if (!isFunction(plugin.object[strategy.methods[methodName]])) {
          throw new PluginImplementationError(`${errorPrefix} The plugin property "${strategy.methods[methodName]}" must be a function.`);
        }
      });

      if (strategy.methods.getInfo && (!isString(strategy.methods.getInfo) || !isFunction(plugin.object[strategy.methods.getInfo]))) {
        throw new PluginImplementationError(`${errorPrefix} The plugin property "${strategy.methods.getInfo}" must be a function.`);
      }

      if (strategy.methods.getById && (!isString(strategy.methods.getById) || !isFunction(plugin.object[strategy.methods.getById]))) {
        throw new PluginImplementationError(`${errorPrefix} The plugin property "${strategy.methods.getById}" must be a function.`);
      }

      if (strategy.methods.afterRegister && (!isString(strategy.methods.afterRegister) || !isFunction(plugin.object[strategy.methods.afterRegister]))) {
        throw new PluginImplementationError(`${errorPrefix} The plugin property "${strategy.methods.afterRegister}" must be a function.`);
      }
    }

    if (!isObject(strategy.config)) {
      throw new PluginImplementationError(`${errorPrefix} The plugin must provide a "config" object in strategies['${strategyName}'] property.`);
    }
    else {
      if (!isFunction(strategy.config.constructor)) {
        throw new PluginImplementationError(`${errorPrefix} The constructor of the strategy "${strategyName}" must be a function.`);
      }

      if (!isObject(strategy.config.strategyOptions)) {
        throw new PluginImplementationError(`${errorPrefix} The "strategyOptions" of the strategy "${strategyName}" must be an object.`);
      }

      if (!isObject(strategy.config.authenticateOptions)) {
        throw new PluginImplementationError(`${errorPrefix} The "authenticateOptions" of the strategy "${strategyName}" must be an object.`);
      }

      if (!strategy.config.fields || !Array.isArray(strategy.config.fields)) {
        throw new PluginImplementationError(`${errorPrefix} The "fields" of the strategy "${strategyName}" must be an array.`);
      }
    }
  });

  Object.keys(plugin.object.strategies).forEach(strategyName => {
    const
      strategy = plugin.object.strategies[strategyName],
      methods = {};

    Object.keys(strategy.methods).filter(name => name !== 'verify').forEach(methodName => {
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
    });

    pluginsManager.authentications[strategyName] = {
      strategy,
      methods
    };

    registerStrategy(pluginsManager, plugin, strategyName);
    pluginsManager.kuzzle.passport.injectAuthenticateOptions(strategyName, strategy.config.authenticateOptions || {});
  });
}


/**
 * Register a pipe function on an event
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @param {number} warnDelay - delay before a warning is issued
 * @param {number} timeoutDelay - delay after which the function is timed out
 * @param {string} event name
 * @param {function} fn - function to attach
 */
function registerPipe(pluginsManager, plugin, warnDelay, timeoutDelay, event, fn) {
  debug('[%s] register pipe on event "%s"', plugin.name, event);

  if (!pluginsManager.pipes[event]) {
    pluginsManager.pipes[event] = [];
  }

  pluginsManager.pipes[event].push((data, callback) => {
    let
      pipeWarnTimer,
      pipeTimeoutTimer,
      timedOut = false;

    if (warnDelay) {
      pipeWarnTimer = setTimeout(() => {
        pluginsManager.trigger('log:warn', `Pipe plugin ${plugin.name} exceeded ${warnDelay}ms to execute.`);
      }, warnDelay);
    }

    if (timeoutDelay) {
      pipeTimeoutTimer = setTimeout(() => {
        const errorMsg = `Timeout error. Pipe plugin ${plugin.name} exceeded ${timeoutDelay}ms to execute. Aborting pipe`;
        pluginsManager.trigger('log:error', errorMsg);

        timedOut = true;
        callback(new GatewayTimeoutError(errorMsg));
      }, timeoutDelay);
    }

    try {
      plugin.object[fn](data, (err, object) => {
        if (pipeWarnTimer !== undefined) {
          clearTimeout(pipeWarnTimer);
        }
        if (pipeTimeoutTimer !== undefined) {
          clearTimeout(pipeTimeoutTimer);
        }

        if (!timedOut) {
          callback(err, object);
        }
      });
    }
    catch (error) {
      throw new PluginImplementationError(error);
    }
  });
}

/**
 * Register a listener function on an event
 *
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @param {string} event
 * @param {string} fn - function to attach
 */
function registerHook(pluginsManager, plugin, event, fn) {
  debug('[%s] register hook on event "%s"', plugin.name, event);

  pluginsManager.kuzzle.on(event, message => {
    try {
      plugin.object[fn](message, event);
    }
    catch (error) {
      throw new PluginImplementationError(error);
    }
  });
}

/**
 * Registers an authentication strategy
 *
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @param {string} strategyName - strategy name
 */
function registerStrategy(pluginsManager, plugin, strategyName) {
  const
    {
      strategy,
      methods
    } = pluginsManager.authentications[strategyName],
    opts = Object.assign(strategy.config.strategyOptions || {}, {passReqToCallback: true}),
    verifyAdapter = (...args) => {
      const callback = args[args.length - 1];
      return plugin.object[strategy.methods.verify](...args.slice(0, -1))
        .then(result => {
          if (result && typeof result === 'object') {
            if (result.kuid && typeof result.kuid === 'string') {
              pluginsManager.kuzzle.repositories.user.load(result.kuid)
                .then(user => {
                  if (user === null) {
                    callback(new PluginImplementationError(`The strategy "${strategyName}" returned an unknown Kuzzle user identifier.`));
                  }
                  else {
                    callback(null, user);
                  }
                })
                .catch(error => callback(error));
            }
            else if (result.message && typeof result.message === 'string') {
              callback(null, false, result);
            }
            else {
              callback(null, false, `Was not able to log in with strategy "${strategyName}"`);
            }
          }
          else {
            callback(new UnauthorizedError('Login failed.'));
          }
        })
        .catch(error => callback(error));
    };

  try {
    const constructedStrategy = new strategy.config.constructor(opts, verifyAdapter);

    pluginsManager.kuzzle.passport.use(strategyName, constructedStrategy);
    pluginsManager.registeredStrategies.push(strategyName);

    if (methods.afterRegister) {
      methods.afterRegister(constructedStrategy);
    }
  }
  catch (e) {
    throw new PluginImplementationError(`Unable to register "${strategyName}" authentication strategy: ${e.message}.`);
  }
}


/**
 * Emit event
 *
 * @param {EventEmitter} emitter
 * @param {string} event
 * @param {*} data
 * @returns {Promise}
 */
function triggerHooks(emitter, event, data) {
  emitter.emit(event, data);

  return Bluebird.resolve(data);
}

/**
 * Chain call all attached functions plugins on the specific event
 *
 * @param {object} pipes
 * @param {string} event
 * @param {*} data
 * @returns {Promise}
 */
function triggerPipes(pipes, event, data) {
  let preparedPipes = [];
  const wildcardEvent = getWildcardEvent(event);

  if (pipes && pipes[event] && pipes[event].length) {
    preparedPipes = pipes[event];
  }

  if (wildcardEvent && pipes && pipes[wildcardEvent] && pipes[wildcardEvent].length) {
    preparedPipes = preparedPipes.concat(pipes[wildcardEvent]);
  }

  if (preparedPipes.length === 0) {
    return Bluebird.resolve(data);
  }

  return new Bluebird((resolve, reject) => {
    async.waterfall([callback => callback(null, data)].concat(preparedPipes), (error, result) => {
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
 * For a specific event, return the corresponding wildcard
 * @example
 *  getWildcardEvent('data:create') // return 'data:*'
 * @param {string} event
 * @returns {String} wildcard event
 */
function getWildcardEvent (event) {
  const indexDelimiter = event.indexOf(':');
  if (indexDelimiter !== 1) {
    return event.substring(0, indexDelimiter+1) + '*';
  }

  return null;
}

/**
 * @param {object|*} object
 * @returns {boolean}
 */
function isObject(object) {
  return object && typeof object === 'object' && !Array.isArray(object);
}

/**
 *
 * @param {function|*} func
 * @returns {boolean}
 */
function isFunction(func) {
  return func && typeof func === 'function';
}

/**
 * @param {string|*} string
 * @returns {boolean}
 */
function isString(string) {
  return string && typeof string === 'string';
}

module.exports = PluginsManager;
