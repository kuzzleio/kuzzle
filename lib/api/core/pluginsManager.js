var
  InternalError = require('./errors/internalError'),
  GatewayTimeoutError = require('./errors/gatewayTimeoutError'),
  PluginContext = require('./pluginsContext'),
  fs = require('fs'),
  q = require('q'),
  async = require('async'),
  path = require('path'),
  _ = require('lodash'),
  childProcess = require('child_process'),
  pathConfig = path.join(__dirname, '..', '..', '..', 'config'),
  lockfile = require('proper-lockfile');


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
   * @returns {Promise}
   */
  this.init = function (isServer, isDummy) {
    var
      pathDefaultPlugins = path.join(pathConfig, 'defaultPlugins.json'),
      pathCustomPlugins = path.join(pathConfig, 'customPlugins.json'),
      defaultPlugins,
      updateInProgress = false,
      customPlugins = {},
      deferred;

    this.isDummy = isDummy;
    this.isServer = isServer;

    if (this.isDummy) {
      return q({});
    }

    if (!childProcess.hasOwnProperty('execSync')) {
      console.error('Make sure you\'re using Node version >= 0.12');
      process.exit(1);
    }

    deferred = q.defer();

    /*
     Prevents multiple plugin installations at the same time.
     Delay installation for an instance only if it's installed on the same computer than another one.

     Skip plugin installation if we're locked, as it means that another instance is already updating plugins
     */
    updateInProgress = fs.existsSync('./node_modules.lock');

    lockfile.lock('./node_modules', {retries: 1000}, (err, release) => {
      if (err) {
        return deferred.reject(err);
      }

      defaultPlugins = require(pathDefaultPlugins);

      if (fs.existsSync(pathCustomPlugins)) {
        customPlugins = require(pathCustomPlugins);
      }

      if (!updateInProgress) {
        if (installPlugins.call(this, defaultPlugins)) {
          fs.writeFileSync(pathDefaultPlugins, JSON.stringify(defaultPlugins, null, 2));
        }

        if (installPlugins.call(this, customPlugins, defaultPlugins)) {
          fs.writeFileSync(pathCustomPlugins, JSON.stringify(customPlugins, null, 2));
        }
      }

      release();

      this.plugins = constructList(defaultPlugins, customPlugins, this.isServer);
      loadPlugins(this.plugins);
      deferred.resolve();
    });

    return deferred.promise;
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
      kuzzle.funnel[name] = controller();
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

  if (preparedPipes.length > 0) {
    // Add a fake function in first position for return the 'data' to other chained functions
    preparedPipes.unshift(function (callback) { callback(null, data); });
  }
  else {
    deferred.resolve(data);
    return deferred.promise;
  }

  async.waterfall(preparedPipes, function (error, result) {
    if (error) {
      return deferred.reject(error);
    }

    deferred.resolve(result);
  });

  return deferred.promise;
}

/**
 * Install given plugins
 * @param plugins
 * @param basePlugins
 * @returns {boolean}
 */
function installPlugins(plugins, basePlugins) {
  var
    newInstalled = false,
    pluginInstallId;

  _.forEach(plugins, (plugin, name) => {
    if (plugin.url) {
      pluginInstallId = plugin.url;
    }
    else if (plugin.version) {
      pluginInstallId = name + '@' + plugin.version;
    }
    else {
      console.error('Plugin', name, 'has no version. The version is mandatory if there is no URL.');
      return true;
    }

    if (!needInstall(name, pluginInstallId)) {
      return true;
    }

    newInstalled = true;
    npmInstall(pluginInstallId);
    initConfig.call(this, plugin, name);

    // By default, when a new plugin is installed, the plugin is disabled
    // If in customPlugins the `activated` flag is undefined, we get the `activated` flag from the default one
    if (plugin.activated === undefined) {
      plugin.activated = (basePlugins !== undefined && basePlugins[name] && basePlugins[name].activated === true);
    }
  });

  return newInstalled;
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

/**
 * Execute shell command
 * @param command
 */
function sh(command) {
  return childProcess.execSync(command).toString();
}

/**
 * Install a plugin with NPM
 * @param plugin
 */
function npmInstall(plugin) {
  sh('npm install ' + plugin);
}

/**
 * Initialize the config plugin
 * @param plugin
 * @param name
 * @returns {boolean}
 */
function initConfig(plugin, name) {
  var
    pluginPackage;

  try {
    pluginPackage = require(path.join(getPathPlugin(name), 'package.json'));
  }
  catch (e) {
    console.error(new InternalError('There is a problem with plugin ' + name + '. Check the plugin name'));
  }

  // If there is no information about plugin in the package.json
  if (!pluginPackage.pluginInfo) {
    return false;
  }

  plugin = _.extend(plugin, pluginPackage.pluginInfo);
}

/**
 * Function for detect if the configured plugin must be installed
 * If the plugin is configured with an url from GIT, the plugin is installed each time
 * If the plugin come from NPM, the plugin is installed only if the version is different from the already installed
 *
 * @param name
 * @param from previously installation information with version or git url with branch
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(name, from) {
  var
    packageDefinition,
    packagePath,
    pluginPath = getPathPlugin(name);

  // If we want to install a plugin with git, maybe there is no version and we want to 'pull' the plugin
  if (from.indexOf('git') !== -1) {
    return true;
  }

  if (!fs.existsSync(pluginPath)) {
    return true;
  }

  packagePath = path.join(pluginPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return true;
  }

  packageDefinition = require(path.join(pluginPath, 'package.json'));

  // If version in package.json is different from the version the plugins.json, we want to install the updated plugin
  return (packageDefinition._from !== from);
}

/**
 * Return the real plugin path
 * @param name
 * @returns {String}
 */
function getPathPlugin (name) {
  return path.join(__dirname, '..', '..', '..', 'node_modules', name);
}

function loadPlugins(plugins) {
  _.forEach(plugins, (plugin, name) => {
    plugin.object = new (require(name))();
  });
}

/*eslint-enable no-console */
