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
  {
    KuzzleError,
    GatewayTimeoutError,
    PluginImplementationError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

let
  pm2Promise = null;

/*
 We use the console to display information, as there may be no logger plugin available while installing/launching
 plugins
 */

/**
 * @class PluginsManager
 * @param kuzzle
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
    this.silent = false;
    this.registeredStrategies = [];
  }

  /**
   * Initialize configured plugin in config/defaultPlugins.json and config/customPlugins.json
   *
   * @param {object} [options]
   * @returns {Promise}
   */
  init(options) {
    this.silent = options && options.silent;
    this.plugins = loadPlugins(this.config, this.kuzzle.rootPath);
  }

  getPluginsFeatures() {
    const pluginConfiguration = {};

    Object.keys(this.plugins).forEach(plugin => {
      const
        pluginInfo = this.plugins[plugin],
        p = {
          name: pluginInfo.name,
          version: pluginInfo.version,
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

      debug('[%s] loading configuration: %a', plugin, p);
    });

    return pluginConfiguration;
  }

  /**
   * Attach events hooks and pipes given by plugins
   */
  run() {
    const pluginsWorker = _.pickBy(this.plugins, plugin => {
      if (plugin.config.threads > 0) {
        if (plugin.object.threadable) {
          return true;
        }

        console.warn(clc.yellow(`[!] [WARNING][Plugin manager]: The plugin "${clc.bold(plugin.name)}" is configured to run as worker but this plugin does not support multi-threading; check "threadable" plugin property; loading it as non worker`)); // eslint-disable-line no-console
      }

      return false;
    });

    if (Object.keys(pluginsWorker).length > 0) {
      pm2Promise = pm2Init(this.workers, pluginsWorker, this.kuzzle.config);
    }

    if (Object.keys(this.plugins).length === 0) {
      return Bluebird.resolve();
    }

    const promises = Object.keys(this.plugins).map(pluginName => {
      const
        plugin = this.plugins[pluginName],
        {
          pipeWarnTime,
          pipeTimeout,
          initTimeout
        } = this.config.common;

      if (plugin.object.threadable && plugin.config.threads) {
        debug('[%s] starting worker with %d threads', pluginName, plugin.config.threads);

        return initWorkers(plugin, pluginName, this.kuzzle.config)
          .timeout(initTimeout)
          .catch(err => Bluebird.reject(new PluginImplementationError(`Unable to start worker plugin "${pluginName}"; ${err.message}`)));
      }


      debug('[%s] starting plugin in "%s" mode', pluginName, plugin.config.privileged ? 'privileged' : 'standard');

      // We sandbox the Promise.resolve into a Promise to be able to catch throwed errors if any
      return new Bluebird((resolve, reject) => {
        // Promise.resolve allows to convert any type of return into a bluebird Promise.
        // It allows to apply a timeout on it
        return Bluebird.resolve(plugin.object.init(
          plugin.config,
          plugin.config.privileged ? new PrivilegedPluginContext(this.kuzzle, pluginName) : new PluginContext(this.kuzzle, pluginName)
        ))
          .timeout(initTimeout)
          .then(initStatus => {
            if (initStatus === false) {
              return reject(new PluginImplementationError(`Something went wrong during the initialization of the plugin "${pluginName}".`));
            }

            if (plugin.object.controllers && !initControllers(this.controllers, this.routes, plugin, pluginName)) {
              return reject(new PluginImplementationError(`Unable to load plugin "${pluginName}": controllers are malformed`));
            }

            if (plugin.object.strategies && !injectAuthentication(this.kuzzle, this.authentications, plugin.object, pluginName)) {
              return reject(new PluginImplementationError(`Unable to load plugin "${pluginName}": authentications strategies are malformed`));
            }

            if (plugin.object.hooks) {
              initHooks(plugin, this.kuzzle);
            }

            if (plugin.object.pipes) {
              initPipes(this, plugin, pipeWarnTime, pipeTimeout);
            }

            debug('[%s] plugin started', pluginName);

            resolve();
          });
      });
    });

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
      .then(modifiedData => {
        // Execute in parallel Hook and Worker because we don't have to wait or execute in a particular order
        return new Bluebird((resolve, reject) => {
          async.parallel([
            callback => triggerWorkers(this.workers, event, modifiedData).asCallback(callback),
            callback => triggerHooks(this.kuzzle, event, modifiedData).asCallback(callback)
          ], err => {
            if (err) {
              return reject(err);
            }

            resolve(modifiedData);
          });
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
 * Start the plugin worker with its configuration with PM2 when the connection is done
 *
 * @param {object} plugin
 * @param {string} pluginName
 * @param {object} kuzzleConfig
 */
function initWorkers (plugin, pluginName, kuzzleConfig) {
  return pm2Promise
    .then(() => {
      const pm2StartPromise = Bluebird.promisify(pm2.start, {context: pm2});

      return pm2StartPromise({
        name: kuzzleConfig.plugins.common.workerPrefix + pluginName,
        script: path.join(__dirname, 'pluginsWorkerWrapper.js'),
        execMode: 'cluster',
        instances: plugin.config.threads,
        killTimeout: plugin.config.killTimeout || 6000,
        maxMemoryRestart: plugin.config.maxMemoryRestart || '1G',
        watch: false
      });
    })
    .catch(err => {
      if (err) {
        return Bluebird.reject(new PluginImplementationError('Error while starting worker plugin: '.concat(pluginName)));
      }
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
            console.error(clc.red(`[x] [ERROR][Plugin manager]: Unable to send data to plugin "${clc.bold(pluginName)}": ${err.stack}`)); // eslint-disable-line no-console
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
 * @param {PluginsManager} manager
 * @param plugin
 * @param pipeWarnTime
 * @param pipeTimeout
 */
function initPipes (manager, plugin, pipeWarnTime, pipeTimeout) {
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
        .forEach(func => registerPipe(manager, plugin, _warnTime, _timeout, pipe, func));
    }
    else if (typeof plugin.object[fn] === 'function') {
      registerPipe(manager, plugin, _warnTime, _timeout, pipe, fn);
    }
  });
}

function initHooks (plugin, kuzzle) {
  _.forEach(plugin.object.hooks, (fn, event) => {
    if (Array.isArray(fn)) {
      fn
        .filter(target => typeof plugin.object[target] === 'function')
        .forEach(func => registerHook(kuzzle, plugin, event, func));
    }
    else if (typeof plugin.object[fn] === 'function') {
      registerHook(kuzzle, plugin, event, fn);
    }
  });
}


function initControllers (controllers, routes, plugin, pluginName) {
  const controllerImported = Object.keys(plugin.object.controllers).every(controller => {
    debug('[%s][%s] starting controller registration', pluginName, controller);

    const
      description = plugin.object.controllers[controller],
      errorControllerPrefix = `[!] [WARNING][Plugin Manager]: Unable to inject controller "${clc.bold(controller)}" from plugin "${clc.bold(pluginName)}":`;

    if (typeof description !== 'object' || description === null || Array.isArray(description)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorControllerPrefix} Incorrect controller description type (expected object, got: "${clc.bold(typeof description)}")`));
      return false;
    }

    return Object.keys(description).every(action => {
      debug('[%s][%s][%s] starting action controller registration', pluginName, controller, action);

      if (typeof description[action] !== 'string' || description[action].length === 0) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorControllerPrefix} Invalid action description (expected non-empty string, got: "${clc.bold(typeof action)}")`));
        return false;
      }

      if (!plugin.object[description[action]] || typeof plugin.object[description[action]] !== 'function') {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorControllerPrefix} Action "${clc.bold(pluginName + '.' + description[action])}" is not a function`));
        return false;
      }

      if (!controllers[`${pluginName}/${controller}`]) {
        controllers[`${pluginName}/${controller}`] = {};
      }

      controllers[`${pluginName}/${controller}`][action] = plugin.object[description[action]].bind(plugin.object);
      return true;
    });
  });

  const allowedVerbs = ['get', 'head', 'post', 'put', 'delete'];

  if (!controllerImported) {
    Object.keys(plugin.object.controllers).forEach(controller => {
      delete controllers[`${pluginName}/${controller}`];
    });

    return false;
  }

  if (plugin.object.routes) {
    return plugin.object.routes.every(route => {
      const errorRoutePrefix = `[!] [WARNING][Plugin Manager]: Unable to inject api route "${clc.bold(route)}" from plugin "${clc.bold(pluginName)}":`;

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
        if (!controllers[`${pluginName}/${route.controller}`]) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Undefined controller "${clc.bold(route.controller)}"`));
          return false;
        }

        if (!controllers[`${pluginName}/${route.controller}`][route.action]) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Undefined action "${clc.bold(route.action)}"`));
          return false;
        }


        if (allowedVerbs.indexOf(route.verb.toLowerCase()) === -1) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorRoutePrefix} Only following http verbs are allowed: "${clc.bold(allowedVerbs.join(', '))}"`));
          return false;
        }

        route.url = '/' + pluginName + route.url;
        route.controller = pluginName + '/' + route.controller;

        debug('[%s] binding HTTP route "%s" to controller "%s"', pluginName, route.url, route.controller);
        routes.push(route);

        return true;
      }
    });
  }

  return true;
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

 * Loads installed plugins in memory
 *
 * @param {object} config - plugins configuration
 * @param {string} rootPath - Kuzzle root directory
 */
function loadPlugins(config, rootPath) {
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
    const pluginPath = path.resolve(pluginsDir, pluginDirName);
    let
      plugin = null,
      packageExists = true;

    try {
      fs.accessSync(path.resolve(pluginPath, 'package.json'));
    }
    catch(e) {
      packageExists = false;
    }

    try {
      const loader = packageExists ? loadPluginFromPackageJson : loadPluginFromDirectory;

      plugin = loader(path.resolve(pluginsDir, pluginDirName), config);
    } catch (e) {
      throw new PluginImplementationError(`Unable to load plugin "${pluginDirName}"; ${e.stack}`);
    }

    loadedPlugins[plugin.name] = plugin;
  });

  return loadedPlugins;
}

function loadPluginFromPackageJson(pluginPath, config) {
  const packageJson = require(path.resolve(pluginPath, 'package.json'));
  const PluginClass = require(pluginPath);

  debug('[%s] loading plugin from package.json file in directory "%s"', packageJson.name, pluginPath);

  return {
    name: packageJson.name,
    object: new PluginClass(),
    config: config[packageJson.name] || {},
    path: pluginPath
  };
}

function loadPluginFromDirectory(pluginPath, config) {
  const PluginClass = require(pluginPath);
  const pluginName = path.basename(pluginPath);

  debug('[%s] loading plugin from directory "%s"', pluginName, pluginPath);

  return {
    name: pluginName,
    object: new PluginClass(),
    config: config[pluginName] || {},
    path: pluginPath
  };
}

/**
 * Register a pipe function on an event
 * @param {PluginsManager} manager
 * @param {object} plugin
 * @param {number} warnDelay - delay before a warning is issued
 * @param {number} timeoutDelay - delay after which the function is timed out
 * @param {string} event name
 * @param {function} fn - function to attach
 */
function registerPipe(manager, plugin, warnDelay, timeoutDelay, event, fn) {
  debug('[%s] register pipe on event "%s"', plugin.name, event);

  if (!manager.pipes[event]) {
    manager.pipes[event] = [];
  }

  manager.pipes[event].push((data, callback) => {
    let
      pipeWarnTimer,
      pipeTimeoutTimer,
      timedOut = false;

    if (warnDelay) {
      pipeWarnTimer = setTimeout(() => {
        manager.trigger('log:warn', `Pipe plugin ${plugin.name} exceeded ${warnDelay}ms to execute.`);
      }, warnDelay);
    }

    if (timeoutDelay) {
      pipeTimeoutTimer = setTimeout(() => {
        const errorMsg = `Timeout error. Pipe plugin ${plugin.name} exceeded ${timeoutDelay}ms to execute. Aborting pipe`;
        manager.trigger('log:error', errorMsg);

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
 * @param {object} kuzzle instance
 * @param {object} plugin
 * @param {string} event
 * @param {string} fn - function to attach
 */
function registerHook(kuzzle, plugin, event, fn) {
  debug('[%s] register hook on event "%s"', plugin.name, event);

  kuzzle.on(event, message => {
    try {
      plugin.object[fn](message, event);
    }
    catch (error) {
      throw new PluginImplementationError(error);
    }
  });
}

/**
 * @param {Kuzzle} kuzzle
 * @param {object} authentications
 * @param {object} plugin
 * @param {string} pluginName
 * @return {boolean} return true if authentication strategies was successfully injected
 */
function injectAuthentication(kuzzle, authentications, plugin, pluginName) {
  const
    mandatoryMethods = ['exists', 'create', 'update', 'delete', 'validate', 'verify'],
    errorPrefix = `[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "${clc.bold(pluginName)}":`;
  let valid = true;

  if (!isObject(plugin.strategies) || Object.keys(plugin.strategies).length === 0) {
    // eslint-disable-next-line no-console
    console.warn(clc.yellow(`${errorPrefix} The plugin must provide an object "${clc.bold('strategies')}".`));

    return false;
  }

  Object.keys(plugin.strategies).forEach(strategyName => {
    /** @type AuthenticationStrategy */
    const strategy = plugin.strategies[strategyName];
    if (!isObject(strategy)) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} The plugin must provide an object for strategy "${clc.bold(strategyName)}".`));
      valid = false;

      return;
    }

    if (kuzzle.pluginsManager.registeredStrategies.indexOf(strategyName) !== -1) {
      // eslint-disable-next-line no-console
      console.warn(clc.yellow(`${errorPrefix} An authentication strategy "${clc.bold(strategyName)}" has already been registered.`));
      throw new PluginImplementationError(`[Plugin Manager] An authentication strategy "${strategyName}" has already been registered.`);
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

        if (!isFunction(plugin[strategy.methods[methodName]])) {
          // eslint-disable-next-line no-console
          console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods[methodName])}" must be a function.`));
          valid = false;
        }
      });

      if (strategy.methods.getInfo && (!isString(strategy.methods.getInfo) || !isFunction(plugin[strategy.methods.getInfo]))) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods.getInfo)}" must be a function.`));
        valid = false;
      }

      if (strategy.methods.getById && (!isString(strategy.methods.getById) || !isFunction(plugin[strategy.methods.getById]))) {
        // eslint-disable-next-line no-console
        console.warn(clc.yellow(`${errorPrefix} The plugin property "${clc.bold(strategy.methods.getById)}" must be a function.`));
        valid = false;
      }

      if (strategy.methods.afterRegister && (!isString(strategy.methods.afterRegister) || !isFunction(plugin[strategy.methods.afterRegister]))) {
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

  if (!valid) {
    return valid;
  }

  Object.keys(plugin.strategies).forEach(strategyName => {
    const
      strategy = plugin.strategies[strategyName],
      methods = {};

    Object.keys(strategy.methods).filter(name => name !== 'verify').forEach(methodName => {
      methods[methodName] = (...args) => {
        return new Bluebird((resolve, reject) => {
          try {
            resolve(plugin[strategy.methods[methodName]].bind(plugin)(...args));
          }
          catch (error) {
            reject(error instanceof KuzzleError ? error : new PluginImplementationError(error));
          }
        });
      };
    });

    authentications[strategyName] = {
      strategy,
      methods
    };

    try {
      registerStrategy(kuzzle, plugin, authentications, strategyName);
      kuzzle.passport.injectAuthenticateOptions(strategyName, strategy.config.authenticateOptions || {});
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e.message);

      valid = false;
    }
  });

  return valid;
}

/**
 * Registers an authentication strategy
 *
 * @param {Kuzzle} kuzzle
 * @param {object} plugin
 * @param {object<string, object>} authentications
 * @param {string} name - strategy name
 */
function registerStrategy(kuzzle, plugin, authentications, name) {
  const
    {
      strategy,
      methods
    } = authentications[name],
    opts = Object.assign(strategy.config.strategyOptions || {}, {passReqToCallback: true}),
    verifyAdapter = (...args) => {
      const callback = args[args.length - 1];
      return plugin[strategy.methods.verify](...args.slice(0, -1))
        .then(result => {
          if (result && typeof result === 'object') {
            if (result.kuid && typeof result.kuid === 'string') {
              kuzzle.repositories.user.load(result.kuid)
                .then(user => {
                  if (user === null) {
                    callback(new PluginImplementationError(`The strategy "${name}" returned an unknown Kuzzle user identifier.`));
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
              callback(null, false, `Was not able to log in with strategy "${name}"`);
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

    kuzzle.passport.use(name, constructedStrategy);
    kuzzle.pluginsManager.registeredStrategies.push(name);

    if (methods.afterRegister) {
      methods.afterRegister(constructedStrategy);
    }
  }
  catch (e) {
    // There might not be any logger active when an authentication plugin registers its strategy
    // eslint-disable-next-line no-console
    throw new PluginImplementationError(`[Plugin Manager] Unable to register "${name}" authentication strategy: ${e.message}.`);
  }
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

module.exports = PluginsManager;
