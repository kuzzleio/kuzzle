var
  GatewayTimeoutError = require('./errors/gatewayTimeoutError'),
  PluginContext = require('./pluginsContext'),
  fs = require('fs'),
  async = require('async'),
  path = require('path'),
  childProcess = require('child_process'),
  q = require('q'),
  _ = require('lodash'),
  pathConfig = path.join(__dirname, '..', '..', '..', 'config');

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
  this.isDummy = false;
  this.isServer = false;
  this.config = kuzzle.config.pluginsManager;

  /**
   * Initialize configured plugin in config/defaultPlugins.json and config/customPlugins.json
   *
   * @param {Boolean} isServer, true if this is a server instance, false for worker instances
   * @param {Boolean} isDummy, true if we are trying to test pluginsManager
   */
  this.init = function (isServer, isDummy) {
    var
      pathDefaultPlugins = path.join(pathConfig, 'defaultPlugins.json'),
      pathCustomPlugins = path.join(pathConfig, 'customPlugins.json'),
      defaultPlugins = require(pathDefaultPlugins),
      customPlugins = {};

    if (!childProcess.hasOwnProperty('execSync')) {
      console.error(' Make sure you\'re using Node version >= 0.12');
      process.exit(1);
    }

    this.isDummy = isDummy;
    this.isServer = isServer;

    if (this.isDummy) {
      return false;
    }

    if (fs.existsSync(pathCustomPlugins)) {
      customPlugins = require(pathCustomPlugins);
    }

    this.plugins = constructList(defaultPlugins, customPlugins, this.isServer);
    loadPlugins(this.plugins);
  };

  /**
   * Attach events hooks and pipes given by plugins
   */
  this.run = function () {
    if (this.isDummy) {
      return false;
    }

    _.forEach(this.plugins, (plugin, pluginName) => {
      var
        context = new PluginContext(kuzzle),
        pipeWarnTime = this.config.pipeWarnTime,
        pipeTimeout = this.config.pipeTimeout;

      if (!plugin.activated) {
        return true;
      }

      console.log('Starting plugin: ', pluginName);

      plugin.object.init(plugin.config, context, this.isDummy);

      if (plugin.object.hooks) {
        _.forEach(plugin.object.hooks, (fn, event) => {
          if (plugin.object[fn]) {
            kuzzle.on(event, function (message) {
              plugin.object[fn](message, event);
            });
          }
        });
      }

      if (plugin.object.pipes) {
        if (plugin.config && plugin.config.pipeWarnTime !== undefined) {
          pipeWarnTime = plugin.config.pipeWarnTime;
        }
        if (plugin.config && plugin.config.pipeTimeout !== undefined) {
          pipeTimeout = plugin.config.pipeTimeout;
        }

        _.forEach(plugin.object.pipes, (fn, pipe) => {
          if (plugin.object[fn]) {
            if (!this.pipes[pipe]) {
              this.pipes[pipe] = [];
            }

            this.pipes[pipe].push((data, callback) => {
              var
                pipeWarnTimer,
                pipeTimeoutTimer;

              if (pipeWarnTime) {
                pipeWarnTimer = setTimeout(() => {
                  this.trigger('log:warn', 'Pipe plugin ' + plugin.name + ' exceeded ' + pipeWarnTime + 'ms to execute.');
                }, pipeWarnTime);
              }

              if (pipeTimeout) {
                pipeTimeoutTimer = setTimeout(() => {
                  var errorMsg = 'Timeout error. Pipe plugin ' + plugin.name + ' exceeded ' + pipeTimeout + 'ms to execute. Aborting pipe';
                  this.trigger('log:error', errorMsg);

                  callback(new GatewayTimeoutError(errorMsg));
                }, pipeTimeout);
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
        });
      }

      if (plugin.object.controllers) {
        _.forEach(plugin.object.controllers, (controller, controllerName) => {
          if (plugin.object[controller]) {
            this.controllers[pluginName+'/'+controllerName] = plugin.object[controller];
          }
        });
      }

      if (plugin.object.routes) {
        async.each(plugin.object.routes, route => {
          route.url = '/_plugin/'+pluginName+route.url;
          route.controller = pluginName+'/'+route.controller;
          this.routes.push(route);
        });
      }

      console.log('Plugin ' + pluginName + ' started');
    });
  };

  /**
   * Trigger an event for emit event and chain pipes
   *
   * @param event
   * @param data
   * @returns {Promise}
   */
  this.trigger = function (event, data) {
    if (this.isDummy) {
      this.kuzzle.emit(event, data);
      return q(data);
    }

    return triggerPipes.call(this, event, data)
      .then(modifiedData => {
        return triggerHooks.call(this, event, modifiedData);
      });
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
    indexDelimiter,
    wildcard;

  indexDelimiter = event.indexOf(':');
  if (indexDelimiter !== 1) {
    wildcard = event.substring(0, indexDelimiter+1) + '*';
  }

  if (this.pipes && this.pipes[event] && this.pipes[event].length) {
    preparedPipes = this.pipes[event];
  }

  if (wildcard && this.pipes && this.pipes[wildcard] && this.pipes[wildcard].length) {
    preparedPipes = preparedPipes.concat(this.pipes[wildcard]);
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

function constructList(defaultPlugins, customPlugins, isServer) {
  var
    allPlugins = _.extend(defaultPlugins, customPlugins),
    pluginsList = {};

  // Load plugins configuration
  _.forEach(allPlugins, function (plugin, name) {
    if (!plugin.name) {
      plugin.name = name;
    }

    if (!plugin.defaultConfig && !plugin.customConfig) {
      plugin.config = {};
      return true;
    }

    if (!plugin.defaultConfig) {
      plugin.config = plugin.customConfig;
      delete plugin.customConfig;
      return true;
    }

    if (!plugin.customConfig) {
      plugin.config = plugin.defaultConfig;
      delete plugin.defaultConfig;
      return true;
    }

    plugin.config = _.extend(plugin.defaultConfig, plugin.customConfig);

    delete plugin.defaultConfig;
    delete plugin.customConfig;
  });


  /*
   Plugins can be loaded by servers or workers. The "loadedBy" property tells by what type of kuzzle instance
   the plugin should be loaded.
   Accepted values: all, server, worker
   Default value: all
   */
  _.forEach(allPlugins, (plugin, name) => {
    if (plugin.config.loadedBy && plugin.config.loadedBy !== 'all' && (plugin.config.loadedBy === 'server') !== isServer) {
      return true;
    }

    pluginsList[name] = plugin;
  });

  return pluginsList;
}

function loadPlugins(plugins) {
  _.forEach(plugins, (plugin, name) => {
    if (!plugin.path) {
      plugin.object = new (require(name))();
    } else {
      plugin.object = new (require(plugin.path))();
    }
  });
}

/*eslint-enable no-console */
