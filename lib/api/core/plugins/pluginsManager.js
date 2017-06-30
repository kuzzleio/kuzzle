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
  Request = require('kuzzle-common-objects').Request,
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  CircularList = require('easy-circular-list'),
  fs = require('fs'),
  pm2 = require('pm2'),
  clc = require('cli-color'),
  semver = require('semver'),
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

// This is default manifest for all plugin, can be overriden by "manifest.json" file at root path of each plugin
const DefaultManifest = {
  name: undefined,
  version: '1.0.0',
  threadable: true,
  privileged: false,
  kuzzleVersion: '1.x'
};

let
  pm2Promise = null,
  workersStartedPromise,
  resolveWorkers,
  rejectWorkers;

// Create a global promise to handle plugin worker initialization status
workersStartedPromise = new Bluebird((resolve, reject) => {
  resolveWorkers = resolve;
  rejectWorkers = reject;
});

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
    this.workers = {};
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
  getPluginsFeatures() {
    const pluginConfiguration = {};

    Object.keys(this.plugins).forEach(plugin => {
      const
        pluginInfo = this.plugins[plugin],
        p = {
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
          p.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));
        }

        if (pluginInfo.object.hasOwnProperty('pipes')) {
          p.pipes = _.uniq(Object.keys(pluginInfo.object.pipes));
        }

        if (pluginInfo.object.hasOwnProperty('controllers')) {
          p.controllers = _.uniq(Object.keys(pluginInfo.object.controllers));
          p.controllers = p.controllers.map(item => `${pluginInfo.name}/${item}`);
        }

        if (pluginInfo.object.hasOwnProperty('routes')) {
          p.routes = _.uniq(pluginInfo.object.routes);
        }

        if (pluginInfo.object.hasOwnProperty('strategies')) {
          p.strategies = Object.keys(pluginInfo.object.strategies);
        }
      }
      else {
        console.warn(clc.yellow(`[!] [WARNING][Plugin manager]: Unable to load features from plugin "${clc.bold(plugin)}"`)); // eslint-disable-line no-console
      }

      pluginConfiguration[plugin] = p;

      debug('[%s] reading plugin configuration: %a', plugin, p);
    });

    return pluginConfiguration;
  }

  /**
   * Register plugins feature to Kuzzle
   *
   * @returns {Promise}
   *
   * @throws PluginImplementationError - Throws when an error occurs when registering a plugin
   */
  run() {
    const promises = [workersStartedPromise];
    const pluginsWorker = _.pickBy(this.plugins, plugin => plugin.config.threads > 0);

    if (Object.keys(pluginsWorker).length === 0) {
      resolveWorkers();
    }
    else {
      pm2Promise = pm2Init(this.workers, pluginsWorker, this.kuzzle.config);

      // start all plugin worker in separate thread handled by pm2
      promises.push(...Object.keys(pluginsWorker).map(pluginName => {
        const
          plugin = this.plugins[pluginName],
          { initTimeout } = this.config.common;

        debug('[%s] starting worker with %d threads', plugin.name, plugin.config.threads);

        return initWorkers(plugin, this.config)
          .timeout(initTimeout)
          .catch(err => Bluebird.reject(new PluginImplementationError(`Unable to start worker plugin "${plugin.name}"; ${err.message}`)));
      }));
    }

    if (Object.keys(this.plugins).length === 0) {
      return Bluebird.resolve();
    }

    // register regular plugins features
    promises.push(...Object.keys(this.plugins).map(pluginName => {
      const
        plugin = this.plugins[pluginName],
        {
          pipeWarnTime,
          pipeTimeout,
          initTimeout
        } = this.config.common;

      if (Object.keys(pluginsWorker).indexOf(plugin.name) > -1) {
        // Do not load worker plugins as regular ones
        return Bluebird.resolve();
      }

      debug('[%s] starting plugin in "%s" mode', plugin.name, plugin.config.privileged ? 'privileged' : 'standard');

      // We sandbox the Promise.resolve into a Promise to be able to catch throwed errors if any
      return new Bluebird((resolve, reject) => {
        // Promise.resolve allows to convert any type of return into a bluebird Promise.
        // It allows to apply a timeout on it
        Bluebird.resolve(plugin.object.init(
          plugin.config,
          plugin.config.privileged ? new PrivilegedPluginContext(this.kuzzle, plugin.name) : new PluginContext(this.kuzzle, plugin.name)
        ))
          .timeout(initTimeout)
          .then(initStatus => {
            if (initStatus === false) {
              return reject(new PluginImplementationError(`Something went wrong during initialization of "${plugin.name}" plugin.`));
            }

            if (plugin.object.controllers && !initControllers(this, plugin)) {
              return reject(new PluginImplementationError(`Unable to initialize plugin "${plugin.name}": controllers are malformed`));
            }

            if (plugin.object.strategies && !initAuthentication(this, plugin)) {
              return reject(new PluginImplementationError(`Unable to initialize plugin "${plugin.name}": authentications strategies are malformed`));
            }

            if (plugin.object.hooks) {
              initHooks(this, plugin);
            }

            if (plugin.object.pipes) {
              initPipes(this, plugin, pipeWarnTime, pipeTimeout);
            }

            debug('[%s] plugin started', plugin.name);

            return resolve();
          });
      });
    }));

    return Bluebird.all(promises);
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
      // Execute in parallel Hook and Worker because we don't have to wait or execute in a particular order
      .then(modifiedData => new Bluebird((resolve, reject) => {
        async.parallel([
          callback => triggerWorkers(this.workers, event, modifiedData).asCallback(callback),
          callback => triggerHooks(this.kuzzle, event, modifiedData).asCallback(callback)
        ], err => {
          if (err) {
            return reject(err);
          }

          resolve(modifiedData);
        });
      }));
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

  /**
   * Stops and unregisters plugins workers
   * @returns {Promise}
   */
  shutdownWorkers() {
    const
      names = Object.keys(this.workers),
      workerIds = [];

    if (names.length === 0) {
      return Bluebird.resolve();
    }

    names.forEach(name => {
      this.workers[name].pmIds.getArray().forEach(id => {
        workerIds.push(id);
        pm2.delete(id);
      });
    });

    this.workers = {};

    return new Bluebird(resolve => {
      setTimeout(() => waitForWorkersShutdown(workerIds, resolve), 200);
    });
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
  const pluginsDir = path.resolve(path.join(rootPath, 'plugins/enabled'));
  const loadedPlugins = {};

  const pluginList = fs.readdirSync(pluginsDir)
    .filter(element => {
      const pluginPath = path.join(pluginsDir, element);

      try {
        const elStat = fs.statSync(pluginPath);
        return elStat.isDirectory();
      }
      catch(e) {
        throw new PluginImplementationError(`Unable to load plugin from path "${pluginPath}"; this may occurs with dead symbolic links; ${e.message}`); // eslint-disable-line no-console
      }
    });

  debug('loading plugins: %a', pluginList);

  pluginList.forEach(pluginDirName => {
    const
      pluginPath = path.resolve(pluginsDir, pluginDirName),
      plugin = {
        name: path.basename(pluginPath), // we use only basename of plugin path to allow multi instances of same plugin
        path: pluginPath,
        object: null,
        config: {},
        manifest: Object.assign({}, DefaultManifest)
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

    // check plugin worker prerequisites
    if (plugin.config.threads > 0) {
      if (plugin.manifest.threadable) {
        if (plugin.object.pipes || plugin.object.controllers || plugin.object.routes || plugin.object.strategies) {
          throw new PluginImplementationError(`The plugin "${plugin.name}" is configured to run as worker but this plugin register non threadable features (pipes, controllers, routes, strategies)`);
        }
      }
      else {
        throw new PluginImplementationError(`The plugin "${plugin.name}" is configured to run as worker but this plugin does not support multi-threading; check "threadable" property in manifest.json plugin file`);
      }
    }

    // check plugin privileged prerequisites
    // user need to acknowledge privileged mode in plugin configuration
    if (plugin.config.privileged) {
      if (!plugin.manifest.privileged) {
        throw new PluginImplementationError(`The plugin "${plugin.name}" is configured to run as privileged mode but it does not support privileged mode`);
      }
    }
    else if (plugin.manifest.privileged) {
      throw new PluginImplementationError(`The plugin "${plugin.name}" need to run in privileged mode to work, you have to explicitly set "privileged: true" in it configuration`);
    }

    loadedPlugins[plugin.name] = plugin;
  });

  return loadedPlugins;
}

/**
 * Resolves a promise once the provided workers list are shut down
 *
 * @param {Array} ids - worker identifiers list
 * @param {function} resolve - promise to be resolved
 */
function waitForWorkersShutdown(ids, resolve) {
  pm2.list((listerr, processes) => {
    if (listerr) {
      // PM2 is unreachable, so we resolve
      // the promise immediately
      return resolve();
    }

    const workersDown = processes.every(process => !ids.includes(process.pm_id));

    if (workersDown) {
      return resolve();
    }

    // eslint-disable-next-line no-console
    console.log('Still waiting for worker plugins to shutdown...');
    setTimeout(() => waitForWorkersShutdown(ids, resolve), 200);
  });
}


/**
 * Initialize the PM2 connection, create the communication bus and listen event.
 * When a worker is started, it sends the event "ready"
 *   Then, we send to this worker its configuration in order to let it initialize
 * When a worker is initialized, it sends the event "initialized"
 *   Then, we add it to the object `workers` with its PM2 id and attached events
 * When a worker is stopped (kill, crash, etc), we catch it with "process:event"
 *   Then, we remove the PM2 id from the list and clean the object `workers` if there is no more process in this cluster
 *
 * @param {object} workers - contains all cluster name, that contains all PM2 ids and events
 * @param {object} pluginsWorker - contains all plugin worker defined by user with config
 * @param {object} kuzzleConfig - Kuzzle configuration, used to construct a plugin context for workers plugins
 * @returns {Promise}
 */
function pm2Init (workers, pluginsWorker, kuzzleConfig) {
  return Bluebird.fromNode(callback => pm2.connect(callback))
    .then(() => Bluebird.fromNode(callback => pm2.launchBus(callback)))
    .then(bus => {
      bus.on('ready', packet => {
        const
          pluginName = packet.process.name.replace(kuzzleConfig.plugins.common.workerPrefix, ''),
          kuzConfig = Object.assign({}, kuzzleConfig);

        // object property cannot be serialized
        Object.keys(kuzConfig.plugins).forEach(k => {
          kuzConfig.plugins[k].object = {};
        });

        if (!pluginsWorker[pluginName] || !pluginsWorker[pluginName].config) {
          return false;
        }

        pm2.sendDataToProcessId(packet.process.pm_id, {
          topic: 'initialize',
          data: {
            config: pluginsWorker[pluginName].config,
            path: pluginsWorker[pluginName].path,
            kuzzleConfig: kuzConfig
          }
        }, err => {
          if (err) {
            rejectWorkers(new PluginImplementationError(`Unable to send data to plugin "${pluginName}": ${err.message}`));
          }
        });
      });

      bus.on('initialized', packet => {
        if (!workers[packet.process.name]) {
          workers[packet.process.name] = {pmIds: new CircularList(), events: []};
        }

        if (workers[packet.process.name].events.length === 0) {
          workers[packet.process.name].events = packet.data.events;
        }

        workers[packet.process.name].pmIds.add(packet.process.pm_id);

        resolveWorkers();
      });

      bus.on('process:event', packet => {
        if (packet.event && packet.event === 'exit' && workers[packet.process.name]) {
          workers[packet.process.name].pmIds.remove(packet.process.pm_id);

          // /!\ We remove it only once from workers, exit event is received twice
          if (workers[packet.process.name].pmIds && workers[packet.process.name].pmIds.getSize() === 0) {
            delete workers[packet.process.name];
          }
        }
      });

      return Bluebird.resolve();
    })
    .catch(err => Bluebird.reject('Error with PM2', err));
}

/**
 * Start the plugin worker with its configuration with PM2 when the connection is done
 *
 * @param {object} plugin
 * @param {object} pluginsConfig
 */
function initWorkers (plugin, pluginsConfig) {
  return pm2Promise
    .then(() => {
      const pm2StartPromise = Bluebird.promisify(pm2.start, {context: pm2});

      return pm2StartPromise({
        name: pluginsConfig.common.workerPrefix + plugin.name,
        script: path.join(__dirname, 'pluginsWorkerWrapper.js'),
        execMode: 'cluster',
        instances: plugin.config.threads,
        killTimeout: plugin.config.killTimeout || 6000,
        maxMemoryRestart: plugin.config.maxMemoryRestart || '1G',
        watch: false
      });
    })
    .catch(error => Bluebird.reject(new PluginImplementationError(`Error while starting worker plugin "${plugin.name}"; ${error.message}`)));
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
  const controllerImported = Object.keys(plugin.object.controllers).every(controller => {
    debug('[%s][%s] starting controller registration', plugin.name, controller);

    const
      description = plugin.object.controllers[controller],
      errorControllerPrefix = `[!] [WARNING][Plugin Manager]: Unable to inject controller "${clc.bold(controller)}" from plugin "${clc.bold(plugin.name)}":`;

    if (typeof description !== 'object' || description === null || Array.isArray(description)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorControllerPrefix} Incorrect controller description type (expected object, got: "${clc.bold(typeof description)}")`));
      return false;
    }

    return Object.keys(description).every(action => {
      debug('[%s][%s][%s] starting action controller registration', plugin.name, controller, action);

      if (typeof description[action] !== 'string' || description[action].length === 0) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorControllerPrefix} Invalid action description (expected non-empty string, got: "${clc.bold(typeof action)}")`));
        return false;
      }

      if (!plugin.object[description[action]] || typeof plugin.object[description[action]] !== 'function') {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorControllerPrefix} Action "${clc.bold(plugin.name + '.' + description[action])}" is not a function`));
        return false;
      }

      if (!pluginsManager.controllers[`${plugin.name}/${controller}`]) {
        pluginsManager.controllers[`${plugin.name}/${controller}`] = {};
      }

      pluginsManager.controllers[`${plugin.name}/${controller}`][action] = plugin.object[description[action]].bind(plugin.object);
      return true;
    });
  });

  const allowedVerbs = ['get', 'head', 'post', 'put', 'delete'];

  if (!controllerImported) {
    return false;
  }

  if (plugin.object.routes) {
    return plugin.object.routes.every(route => {
      const errorRoutePrefix = `[!] [WARNING][Plugin Manager]: Unable to inject api route "${clc.bold(JSON.stringify(route))}" from plugin "${clc.bold(plugin.name)}":`;

      const valid = Object.keys(route).every(key => {
        if (['verb', 'url', 'controller', 'action'].indexOf(key) === -1) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Unknown route definition "${clc.bold(key)}"`));
          return false;
        }


        if (typeof route[key] !== 'string' || (route[key].length === 0 && key !== 'url')) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} "${clc.bold(key)}" must be a non-empty string`));
          return false;
        }

        return true;
      });

      if (valid) {
        if (!pluginsManager.controllers[`${plugin.name}/${route.controller}`]) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Undefined controller "${clc.bold(route.controller)}"`));
          return false;
        }

        if (!pluginsManager.controllers[`${plugin.name}/${route.controller}`][route.action]) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Undefined action "${clc.bold(route.action)}"`));
          return false;
        }


        if (allowedVerbs.indexOf(route.verb.toLowerCase()) === -1) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Only following http verbs are allowed: "${clc.bold(allowedVerbs.join(', '))}"`));
          return false;
        }

        route.url = '/' + plugin.name + route.url;
        route.controller = plugin.name + '/' + route.controller;

        debug('[%s] binding HTTP route "%s" to controller "%s"', plugin.name, route.url, route.controller);
        pluginsManager.routes.push(route);

        return true;
      }
    });
  }

  return true;
}

/**
 * @param {PluginsManager} pluginsManager
 * @param {object} plugin
 * @return {boolean} return true if authentication strategies was successfully injected
 */
function initAuthentication(pluginsManager, plugin) {
  const
    mandatoryMethods = ['exists', 'create', 'update', 'delete', 'validate', 'verify'],
    errorPrefix = `[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "${clc.bold(plugin.name)}":`;
  let valid = true;

  if (!isObject(plugin.object.strategies) || Object.keys(plugin.object.strategies).length === 0) {
    // eslint-disable-next-line no-console
    console.warn(clc.yellow(`${errorPrefix} The plugin must provide an object "${clc.bold('strategies')}".`));

    return false;
  }

  Object.keys(plugin.object.strategies).forEach(strategyName => {
    /** @type AuthenticationStrategy */
    const strategy = plugin.object.strategies[strategyName];
    if (!isObject(strategy)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} The plugin must provide an object for strategy "${clc.bold(strategyName)}".`));
      valid = false;

      return;
    }

    if (pluginsManager.registeredStrategies.indexOf(strategyName) !== -1) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} An authentication strategy "${clc.bold(strategyName)}" has already been registered.`));
      valid = false;

      return;
    }

    if (!isObject(strategy.methods)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} The plugin must provide a "${clc.bold('methods')}" object in strategies['${clc.bold(strategyName)}'] property.`));
      valid = false;
    }
    else {
      mandatoryMethods.forEach(methodName => {
        if (!isString(strategy.methods[methodName])) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorPrefix} The plugin must provide a method "${clc.bold(methodName)}" in strategy configuration.`));
          valid = false;

          return;
        }

        if (!isFunction(plugin.object[strategy.methods[methodName]])) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods[methodName])}" must be a function.`));
          valid = false;
        }
      });

      if (strategy.methods.getInfo && (!isString(strategy.methods.getInfo) || !isFunction(plugin.object[strategy.methods.getInfo]))) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods.getInfo)}" must be a function.`));
        valid = false;
      }

      if (strategy.methods.getById && (!isString(strategy.methods.getById) || !isFunction(plugin.object[strategy.methods.getById]))) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods.getById)}" must be a function.`));
        valid = false;
      }

      if (strategy.methods.afterRegister && (!isString(strategy.methods.afterRegister) || !isFunction(plugin.object[strategy.methods.afterRegister]))) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods.afterRegister)}" must be a function.`));
        valid = false;
      }
    }

    if (!isObject(strategy.config)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} The plugin must provide a "${clc.bold('config')}" object in strategies['${clc.bold(strategyName)}'] property.`));
      valid = false;
    }
    else {
      if (!isFunction(strategy.config.constructor)) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The constructor of the strategy "${clc.bold(strategyName)}" must be a function.`));
        valid = false;
      }

      if (!isObject(strategy.config.strategyOptions)) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The "${clc.bold('strategyOptions')}" of the strategy "${clc.bold(strategyName)}" must be an object.`));
        valid = false;
      }

      if (!isObject(strategy.config.authenticateOptions)) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The "${clc.bold('authenticateOptions')}" of the strategy "${clc.bold(strategyName)}" must be an object.`));
        valid = false;
      }

      if (!strategy.config.fields || !Array.isArray(strategy.config.fields)) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The "${clc.bold('fields')}" of the strategy "${clc.bold(strategyName)}" must be an array.`));
        valid = false;
      }

    }
  });

  if (valid) {
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

      try {
        registerStrategy(pluginsManager, plugin, strategyName);
        pluginsManager.kuzzle.passport.injectAuthenticateOptions(strategyName, strategy.config.authenticateOptions || {});
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e.message);

        valid = false;
      }
    });
  }

  return valid;
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
    // There might not be any logger active when an authentication plugin registers its strategy
    // eslint-disable-next-line no-console
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
 * Send the event to next workers for each cluster that have defined the event
 *
 * @param {object} workers
 * @param {string} event
 * @param {object} data
 * @returns {Promise}
 */
function triggerWorkers(workers, event, data) {
  const wildcardEvent = getWildcardEvent(event);

  if (Object.keys(workers).length === 0) {
    return Bluebird.resolve(data);
  }

  return new Bluebird((resolve, reject) => {
    async.forEachOf(workers, (worker, workerName, callback) => {
      if (worker.events.indexOf(event) === -1 && worker.events.indexOf(wildcardEvent) === -1) {
        return callback();
      }

      const dataToSend = data instanceof Request ? data.serialize() : data;
      const pmId = worker.pmIds.getNext();
      pm2.sendDataToProcessId(pmId, {
        topic: 'trigger',
        data: {
          event,
          message: dataToSend
        },
        id: pmId
      }, callback);
    }, err => {
      if (err) {
        return reject(err);
      }

      resolve(data);
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
