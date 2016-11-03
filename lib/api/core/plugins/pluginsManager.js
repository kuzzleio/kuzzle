var
  GatewayTimeoutError = require('kuzzle-common-objects').Errors.gatewayTimeoutError,
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  PluginPackagesManager = require('./packages'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  CircularList = require('easy-circular-list'),
  pm2 = require('pm2'),
  pm2Promise = null,
  workerPrefix = 'kpw:';

/*
 We use the console to display information, as there may be no logger plugin available while installing/launching
 plugins
 */

/**
 * @param kuzzle
 * @constructor
 */
function PluginsManager (kuzzle) {
  this.kuzzle = kuzzle;
  this.packages = new PluginPackagesManager(kuzzle);
  this.plugins = {};
  this.pipes = {};
  this.controllers = {};
  this.routes = [];
  this.workers = {};
  this.config = kuzzle.config.plugins;
  this.silent = false;
  this.isInit = false;

  /**
   * Initialize configured plugin in config/defaultPlugins.json and config/customPlugins.json
   *
   * @param {Object} [options]
   * @returns {Promise}
   */
  this.init = function pluginInit (options) {
    this.silent = options && options.silent;

    return this.packages.definitions()
      .then(plugins => {
        this.plugins = plugins;
        loadPlugins(this.plugins);
        this.isInit = true;
      });
  };

  /**
   * Attach events hooks and pipes given by plugins
   */
  this.run = function pluginRun () {
    var
      pluginsWorker;

    pluginsWorker = _.pickBy(this.plugins, plugin => plugin.config.threads !== undefined);

    if (Object.keys(pluginsWorker).length > 0) {
      pm2Promise = pm2Init(this.workers, pluginsWorker, this.kuzzle.config);
    }

    return new Promise((resolve, reject) => {
      async.forEachOf(this.plugins, (plugin, pluginName, callback) => {
        var
          pipeWarnTime = this.config.common.pipeWarnTime,
          pipeTimeout = this.config.common.pipeTimeout;

        if (!plugin.activated) {
          this.silent || console.log('Plugin', pluginName, 'deactivated. Skipping...');   // eslint-disable-line no-console
          callback();
          return true;
        }

        if (plugin.config.threads) {
          initWorkers(plugin, pluginName).then(() => callback());

          return true;
        }

        try {
          plugin.object.init(
            plugin.config,
            plugin.config.privileged ? new PrivilegedPluginContext(kuzzle) : new PluginContext(kuzzle)
          );
        } catch (e) {
          console.warn(`Something went wrong while starting ${pluginName}:`, e.message); // eslint-disable-line no-console
          callback();
          return false;
        }

        if (plugin.object.hooks) {
          initHooks(plugin, kuzzle);
        }

        if (plugin.object.pipes) {
          initPipes.call(this, this.pipes, plugin, pipeWarnTime, pipeTimeout);
        }

        if (plugin.object.controllers) {
          initControllers(this.controllers, this.routes, plugin, pluginName);
        }

        if (plugin.object.scope) {
          injectScope(plugin.object.scope, kuzzle.passport);
        }

        this.silent || console.log('Plugin', pluginName, 'started');  // eslint-disable-line no-console
        callback();
      }, (err) => {
        if (err) {
          return reject(err);
        }
        resolve({});
      });
    });
  };

  /**
   * Trigger an event for emit event and chain pipes
   *
   * @param event
   * @param data
   * @returns {Promise}
   */
  this.trigger = function pluginTrigger (event, data) {
    return triggerPipes.call(this, event, data)
      .then(modifiedData => {
        // Execute in parallel Hook and Worker because we don't have to wait or execute in a particular order
        return new Promise((resolve, reject) => {
          async.parallel([
            callback => triggerWorkers.call(this, event, modifiedData).asCallback(callback),
            callback => triggerHooks.call(this, event, modifiedData).asCallback(callback)
          ], err => {
            if (err) {
              return reject(err);
            }

            resolve(modifiedData);
          });
        });
      });
  };

 /**
   * Inject plugin controllers within funnel Controller
   */
  this.injectControllers = function pluginInjectControllers () {
    _.forEach(this.controllers, (controller, name) => {
      kuzzle.funnel.controllers[name] = controller();
    });
  };
}


/**
 * Start the plugin worker with its configuration with PM2 when the connection is done
 *
 * @param {Object} plugin
 * @param {String} pluginName
 */
function initWorkers (plugin, pluginName) {
  return pm2Promise
    .then(() => {
      var pm2StartPromise = Promise.promisify(pm2.start, {context: pm2});

      return pm2StartPromise({
        name: workerPrefix + pluginName,
        script: path.join(__dirname, 'pluginsWorkerWrapper.js'),
        execMode: 'cluster',
        instances: plugin.config.threads,
        killTimeout: plugin.config.killTimeout || 6000,
        maxMemoryRestart: plugin.config.maxMemoryRestart || '100M',
        watch: false
      });
    })
    .catch(err => {
      if (err) {
        return Promise.reject(new Error('Error with plugin', pluginName, err));
      }
    });
}

/**
 * Initialize the PM2 connection, create the communication bus and listen event.
 * When a worker is started, he sends the event "ready"
 *   Then, we send to this worker its configuration in order to let it initialize
 * When a worker is initialized, he sends the event "initialized"
 *   Then, we add it to the object `workers` with its PM2 id and attached events
 * When a worker is stopped (kill, crash, etc), we catch it with "process:event"
 *   Then, we remove the PM2 id from the list and clean the object `workers` if there is no more process in this cluster
 *
 * @param {Object} workers - contains all cluster name, that contains all PM2 ids and events
 * @param {Object} pluginsWorker - contains all plugin worker defined by user with config
 * @param {Object} kuzzleConfig - Kuzzle configuration, used to construct a plugin context for workers plugins
 * @returns {Promise}
 */
function pm2Init (workers, pluginsWorker, kuzzleConfig) {
  return Promise.fromNode(callback => pm2.connect(callback))
    .then(() => Promise.fromNode(callback => pm2.list(callback)))
    .then(list => {
      var
        names = list
          .filter(process => process.name.indexOf(workerPrefix) !== -1)
          .map(process => process.pm_id);

      return Promise.fromNode(asyncCB => async.each(names, (name, callback) => {
        pm2.delete(name, err => callback(err));
      }, err => asyncCB(err)));
    })
    .then(() => Promise.fromNode(callback => pm2.launchBus(callback)))
    .then(bus => {
      bus.on('ready', packet => {
        var pluginName = packet.process.name.replace(workerPrefix, '');

        if (!pluginsWorker[pluginName] || !pluginsWorker[pluginName].config) {
          return false;
        }

        pm2.sendDataToProcessId(packet.process.pm_id, {
          topic: 'initialize',
          data: {
            config: pluginsWorker[pluginName].config,
            path: pluginsWorker[pluginName].path,
            kuzzleConfig
          }
        }, (err) => {
          if (err) {
            console.error(`Error while sending data to plugin ${pluginName}: ${err}`);  // eslint-disable-line no-console
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
        if (packet.event) {
          if (packet.event === 'exit') {
            if (workers[packet.process.name]) {
              workers[packet.process.name].pmIds.remove(packet.process.pm_id);

              // /!\ We remove it only once from workers, exit event is received twice
              if (workers[packet.process.name].pmIds && workers[packet.process.name].pmIds.getSize() === 0) {
                delete workers[packet.process.name];
              }
            }
          }
        }
      });

      return Promise.resolve();
    })
    .catch(err => Promise.reject('Error with PM2', err));
}

function initPipes (pipes, plugin, pipeWarnTime, pipeTimeout) {
  if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
    pipeWarnTime = plugin.config.pipeWarnTime;
  }
  if (plugin.config && plugin.config.pipeTimeout !== undefined) {
    pipeTimeout = plugin.config.pipeTimeout;
  }

  _.forEach(plugin.object.pipes, (fn, pipe) => {
    if (Array.isArray(fn)) {
      fn
        .filter(target => typeof plugin.object[target] === 'function')
        .forEach(func => registerPipe.call(this, pipes, plugin, pipeWarnTime, pipeTimeout, pipe, func));
    }
    else if (typeof plugin.object[fn] === 'function') {
      registerPipe.call(this, pipes, plugin, pipeWarnTime, pipeTimeout, pipe, fn);
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
  _.forEach(plugin.object.controllers, (controller, controllerName) => {
    if (plugin.object[controller]) {
      controllers[pluginName + '/' + controllerName] = plugin.object[controller].bind(plugin.object);
    }
  });

  if (plugin.object.routes) {
    plugin.object.routes.forEach(route => {
      route.url = '/' + pluginName + route.url;
      route.controller = pluginName + '/' + route.controller;
      routes.push(route);
    });
  }
}

/**
 * Emit event
 *
 * @this PluginsManager
 * @param event
 * @param data
 * @returns {Promise}
 */
function triggerHooks(event, data) {
  this.kuzzle.emit(event, data);

  return Promise.resolve(data);
}

/**
 * Chain call all attached functions plugins on the specific event
 *
 * @this PluginsManager
 * @param event
 * @param data
 * @returns {Promise}
 */
function triggerPipes(event, data) {
  var
    preparedPipes = [],
    wildcardEvent = getWildcardEvent(event);

  if (this.pipes && this.pipes[event] && this.pipes[event].length) {
    preparedPipes = this.pipes[event];
  }

  if (wildcardEvent && this.pipes && this.pipes[wildcardEvent] && this.pipes[wildcardEvent].length) {
    preparedPipes = preparedPipes.concat(this.pipes[wildcardEvent]);
  }

  if (preparedPipes.length === 0) {
    return Promise.resolve(data);
  }

  return new Promise((resolve, reject) => {
    async.waterfall([callback => callback(null, data)].concat(preparedPipes), (error, result) => {
      if (error) {
        return reject(error);
      }

      resolve(result);
    });
  });
}

/**
 * For a specific event, return the corresponding wildcard
 * @example
 *  getWildcardEvent('data:create') // return 'data:*'
 * @param {String} event
 * @returns {String|Boolean} wildcard event
 */
function getWildcardEvent (event) {
  var indexDelimiter = event.indexOf(':');
  if (indexDelimiter !== 1) {
    return event.substring(0, indexDelimiter+1) + '*';
  }

  return false;
}

/**
 * Send the event to next workers for each cluster that have defined the event
 *
 * @this PluginsManager
 * @param {String} event
 * @param {Object} data
 * @returns {Promise}
 */
function triggerWorkers(event, data) {
  var
    wildcardEvent = getWildcardEvent(event);

  if (Object.keys(this.workers).length === 0) {
    return Promise.resolve(data);
  }

  return new Promise((resolve, reject) => {
    async.forEachOf(this.workers, (worker, workerName, callback) => {
      var pmId;

      if (worker.events.indexOf(event) === -1 && worker.events.indexOf(wildcardEvent) === -1) {
        return callback();
      }

      pmId = worker.pmIds.getNext();
      pm2.sendDataToProcessId(pmId, {
        topic: 'trigger',
        data: {
          event: event,
          message: data
        },
        id: pmId
      }, (err, res) => {
        callback(err, res);
      });
    }, (err) => {
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
 * @param plugins - list of installed plugins to load
 */
function loadPlugins(plugins) {
  _.forEach(plugins, (plugin, name) => {
    try {
      plugin.object = new (require(name))();
    }
    catch(e) {
      console.error(`ERROR: Unable to load plugin ${name}: ${e}`);  // eslint-disable-line no-console
      delete plugins[name];
    }
  });
}

/**
 * Register a pipe function on an event
 * @param {Array} pipes - list of registered pipes
 * @param {object} plugin
 * @param {number} warnDelay - delay before a warning is issued
 * @param {number} timeoutDelay - delay after which the function is timed out
 * @param {string} event name
 * @param {function} fn - function to attach
 */
function registerPipe(pipes, plugin, warnDelay, timeoutDelay, event, fn) {
  if (!pipes[event]) {
    pipes[event] = [];
  }

  pipes[event].push((data, callback) => {
    var
      pipeWarnTimer,
      pipeTimeoutTimer;

    if (warnDelay) {
      pipeWarnTimer = setTimeout(() => {
        this.trigger('log:warn', `Pipe plugin ${plugin.name} exceeded ${warnDelay}ms to execute.`);
      }, warnDelay);
    }

    if (timeoutDelay) {
      pipeTimeoutTimer = setTimeout(() => {
        var errorMsg = `Timeout error. Pipe plugin ${plugin.name} exceeded ${timeoutDelay}ms to execute. Aborting pipe`;
        this.trigger('log:error', errorMsg);

        callback(new GatewayTimeoutError(errorMsg));
      }, timeoutDelay);
    }

    plugin.object[fn](data, (err, object) => {
      if (pipeWarnTimer !== undefined) {
        clearTimeout(pipeWarnTimer);
      }
      if (pipeTimeoutTimer !== undefined) {
        clearTimeout(pipeTimeoutTimer);
      }

      callback(err, object);
    });
  });
}

/**
 * Register a listener function on an event
 *
 * @param {object} kuzzle instance
 * @param {object} plugin
 * @param {string} event
 * @param {function} fn - function to attach
 */
function registerHook(kuzzle, plugin, event, fn) {
  kuzzle.on(event, (message) => {
    plugin.object[fn](message, event);
  });
}


/**
 * Injects a plugin's declared scopes into the Kuzzle passport wrapper
 *
 * @param {Object} scope to inject, in the following format: {strategy: [scope, fields}, ...}
 * @param {Object} passport wrapper object
 */
function injectScope(scope, passport) {
  Object.keys(scope).forEach(strategy => {
    // enforcing scope format
    if (typeof strategy === 'string' && Array.isArray(scope[strategy])) {
      passport.injectScope(strategy, scope[strategy]);
    }
  });
}

module.exports = PluginsManager;

