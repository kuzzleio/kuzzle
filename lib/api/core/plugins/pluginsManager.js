var
  GatewayTimeoutError = require('kuzzle-common-objects').Errors.gatewayTimeoutError,
  PluginContext = require('./pluginContext'),
  PrivilegedPluginContext = require('./privilegedPluginContext'),
  async = require('async'),
  path = require('path'),
  q = require('q'),
  _ = require('lodash'),
  CircularList = require('easy-circular-list'),
  pm2 = require('pm2'),
  pm2Promise = null,
  workerPrefix = 'kpw:';

/*
 We use the console to display information, as there may be no logger plugin available while installing/launching
 plugins
 */

/*eslint-disable no-console */

module.exports = function PluginsManager (kuzzle) {
  this.kuzzle = kuzzle;
  this.plugins = {};
  this.pipes = {};
  this.controllers = {};
  this.routes = [];
  this.workers = {};
  this.isDummy = false;
  this.isServer = false;
  this.config = kuzzle.config.pluginsManager;

  /**
   * Initialize configured plugin in config/defaultPlugins.json and config/customPlugins.json
   *
   * @param {Boolean} isServer, true if this is a server instance, false for worker instances
   * @param {Boolean} isDummy, true if we are trying to test pluginsManager
   * @returns {Promise}
   */
  this.init = function (isServer, isDummy) {
    this.isDummy = isDummy || false;
    this.isServer = isServer;

    if (this.isDummy) {
      return q();
    }

    return getPluginsList(kuzzle, this.isServer)
      .then(plugins => {
        this.plugins = plugins;
        loadPlugins(this.plugins);
      });
  };

  /**
   * Attach events hooks and pipes given by plugins
   */
  this.run = function () {
    var
      pluginsWorker,
      deferred = q.defer(),
      context = new PluginContext(kuzzle),
      privilegedContext = new PrivilegedPluginContext(kuzzle);

    if (this.isDummy) {
      return q({});
    }

    console.log('Loading plugins...');

    if (this.isServer) {
      pluginsWorker = _.pickBy(this.plugins, plugin => plugin.config.threads !== undefined);

      if (Object.keys(pluginsWorker).length > 0) {
        pm2Promise = pm2Init(this.workers, pluginsWorker, this.isDummy);
      }
    }

    async.forEachOf(this.plugins, (plugin, pluginName, callback) => {
      var
        pipeWarnTime = this.config.pipeWarnTime,
        pipeTimeout = this.config.pipeTimeout;

      if (!plugin.activated) {
        console.log('Plugin', pluginName, 'deactivated. Skipping...');
        callback();
        return true;
      }

      if (plugin.config.threads) {
        if (this.isServer) {
          initWorkers(plugin, pluginName)
            .then(() => {
              callback();
            });
        }

        return true;
      }

      plugin.object.init(
        plugin.config,
        plugin.config.privileged ? privilegedContext : context,
        this.isDummy
      );

      if (plugin.object.hooks) {
        initHooks(plugin, kuzzle);
      }

      if (plugin.object.pipes) {
        initPipes.call(this, this.pipes, plugin, pipeWarnTime, pipeTimeout);
      }

      if (plugin.object.controllers) {
        initControllers(this.controllers, this.routes, plugin, pluginName);
      }

      console.log('Plugin', pluginName, 'started');
      callback();
    }, (err) => {
      if (err) {
        return deferred.reject(err);
      }
      return deferred.resolve({});
    });

    return deferred.promise;
  };

  /**
   * Trigger an event for emit event and chain pipes
   *
   * @param event
   * @param data
   * @returns {Promise}
   */
  this.trigger = function (event, data) {
    var deferred;

    if (this.isDummy) {
      this.kuzzle.emit(event, data);
      return q(data);
    }

    deferred = q.defer();

    triggerPipes.call(this, event, data)
      .then(modifiedData => {

        // Execute in parallel Hook and Worker because we don't have to wait or execute in a particular order
        async.parallel([
          callback => {
            triggerWorkers.call(this, event, modifiedData)
              .then(() => callback())
              .catch((e) => callback(e));
          },
          callback => {
            triggerHooks.call(this, event, modifiedData)
              .then(() => callback())
              .catch((e) => callback(e));
          }
        ], (err) => {
          if (err) {
            return deferred.reject(err);
          }

          deferred.resolve(modifiedData);
        });
      })
      .catch(error => {
        deferred.reject(error);
      });

    return deferred.promise;
  };

 /**
   * Inject plugin controllers within funnel Controller
   */
  this.injectControllers = function () {
    _.forEach(this.controllers, function (controller, name) {
      kuzzle.funnel.controllers[name] = controller();
    });
  };
};


/**
 * Start the plugin worker with its configuration with PM2 when the connection is done
 *
 * @param {Object} plugin
 * @param {String} pluginName
 */
function initWorkers (plugin, pluginName) {
  return pm2Promise
    .then(() => {
      return q.ninvoke(pm2, 'start', {
        name: workerPrefix + pluginName,
        script: path.join(__dirname, 'pluginsWorkerWrapper.js'),
        'exec_mode': 'cluster',
        instances: plugin.config.threads,
        'kill_timeout': plugin.config.killTimeout || 6000,
        'max_memory_restart': plugin.config.maxMemoryRestart || '100M',
        watch: false
      });
    })
    .catch(err => {
      if (err) {
        return q.reject(new Error('Error with plugin', pluginName, err));
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
 * @param {Object} workers contains all cluster name, that contains all PM2 ids and events
 * @param {Object} pluginsWorker contains all plugin worker defined by user with config
 * @param {Boolean} isDummy
 * @returns {Promise}
 */
function pm2Init (workers, pluginsWorker, isDummy) {
  return q.ninvoke(pm2, 'connect')
    .then(() => q.ninvoke(pm2, 'list'))
    .then(list => {
      var
        deferred = q.defer(),
        names = list
          .filter(process => process.name.indexOf(workerPrefix) !== -1)
          /*jshint -W106 */
          .map(process => process.pm_id);
          /*jshint +W106 */

      async.each(names, (name, callback) => {
        pm2.delete(name, err => callback(err));
      }, deferred.makeNodeResolver());

      return deferred.promise;
    })
    .then(() => q.ninvoke(pm2, 'launchBus'))
    .then(bus => {
      bus.on('ready', packet => {
        var pluginName = packet.process.name.replace(workerPrefix, '');

        if (!pluginsWorker[pluginName] || !pluginsWorker[pluginName].config) {
          return false;
        }

        /*jshint -W106 */
        pm2.sendDataToProcessId(packet.process.pm_id, {
        /*jshint +W106 */
          topic: 'initialize',
          data: {
            config: pluginsWorker[pluginName].config,
            isDummy: isDummy,
            path: pluginsWorker[pluginName].path,
            kuzzleConfig: this.kuzzle.config
          }
        }, (err) => {
          if (err) {
            console.error(`Error while sending data to plugin ${pluginName}: ${err}`);
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

        /*jshint -W106 */
        workers[packet.process.name].pmIds.add(packet.process.pm_id);
        /*jshint +W106 */
      });

      bus.on('process:event', function(packet) {
        if (packet.event) {
          if (packet.event === 'exit') {
            if (workers[packet.process.name]) {
              /*jshint -W106 */
              workers[packet.process.name].pmIds.remove(packet.process.pm_id);
              /*jshint +W106 */

              // /!\ We remove it only once from workers, exit event is received twice
              if (workers[packet.process.name].pmIds && workers[packet.process.name].pmIds.getSize() === 0) {
                delete workers[packet.process.name];
              }
            }
          }
        }
      });

      return q();
    })
    .catch(err => {
      return q.reject('Error with PM2', err);
    });
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
 * @param event
 * @param data
 * @returns {Promise}
 */
function triggerHooks(event, data) {
  this.kuzzle.emit(event, data);

  return q(data);
}

/**
 * Chain call all attached functions plugins on the specific event
 * @param event
 * @param data
 * @returns {Promise}
 */
function triggerPipes(event, data) {
  var
    deferred = q.defer(),
    preparedPipes = [],
    wildcardEvent = getWildcardEvent(event);

  if (this.pipes && this.pipes[event] && this.pipes[event].length) {
    preparedPipes = this.pipes[event];
  }

  if (wildcardEvent && this.pipes && this.pipes[wildcardEvent] && this.pipes[wildcardEvent].length) {
    preparedPipes = preparedPipes.concat(this.pipes[wildcardEvent]);
  }

  if (preparedPipes.length === 0) {
    deferred.resolve(data);
    return deferred.promise;
  }

  async.waterfall([function (callback) { callback(null, data); }].concat(preparedPipes), function (error, result) {
    if (error) {
      return deferred.reject(error);
    }

    deferred.resolve(result);
  });

  return deferred.promise;
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
 * @param {String} event
 * @param {*} data
 * @returns {*} data
 */
function triggerWorkers(event, data) {
  var
    deferred = q.defer(),
    wildcardEvent = getWildcardEvent(event);

  if (Object.keys(this.workers).length === 0) {
    return q(data);
  }

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
      return deferred.reject(err);
    }

    deferred.resolve(data);
  });

  return deferred.promise;
}

/**
 * Retrieve the plugins list from the database and returns it,
 * along with their configuration
 *
 * @param kuzzle
 * @param isServer
 * @returns {Promise}
 */
function getPluginsList(kuzzle, isServer) {
  var
    plugins = {};

  return kuzzle.internalEngine
    .search(kuzzle.config.pluginsManager.dataCollection)
    .then(result => {
      result.hits.forEach(p => {
        if (!p._source.config.loadedBy) {
          p._source.config.loadedBy = 'all';
        }

        if (p._source.config.loadedBy === 'all' || (p._source.config.loadedBy === 'server') === isServer) {
          plugins[p._id] = p._source;
        }
      });

      return plugins;
    });
}

/**
 * Loads installed plugins in memory
 *
 * @param plugins - list of installed plugins to load
 */
function loadPlugins(plugins) {
  _.forEach(plugins, (plugin, name) => {
    if (!plugin.path) {
      plugin.object = new (require(name))();
    } else {
      plugin.object = new (require(plugin.path))();
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

    plugin.object[fn](data, function (err, object) {
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
  kuzzle.on(event, function (message) {
    plugin.object[fn](message, event);
  });
}

/*eslint-enable no-console */
