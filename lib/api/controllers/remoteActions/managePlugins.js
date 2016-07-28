var
  fs = require('fs'),
  rimraf = require('rimraf'),
  path = require('path'),
  Promise = require('bluebird'),
  childProcess = require('child_process'),
  lockfile = require('proper-lockfile'),
  _ = require('lodash'),
  _kuzzle;

function pluginsManager(requestObject) {
  var
    plugin = requestObject.data._id,
    options = requestObject.data.body,
    lockPromisified = Promise.promisify(lockfile.lock),
    releaseLock = () => {};

  // Prevents multiple 'kuzzle install' to install plugins at the same time.
  return lockPromisified('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000})
    .then(release => {
      releaseLock = release;
      return initializeInternalIndex();
    })
    .then(() => {
      if (options.list) {
        return getPluginsList();
      }
        
      if (options.install) {
        if (plugin) {
          _kuzzle.pluginsManager.trigger('log:info', `███ kuzzle-plugins: Installing plugin ${plugin}...`);
        }
        else {
          _kuzzle.pluginsManager.trigger('log:info', '███ kuzzle-plugins: Starting plugins installation...');
        }

        return installPlugins(plugin, options);
      }

      if (options.get) {
        return getPluginConfiguration(plugin);
      }

      if (options.set) {
        return setPluginConfiguration(plugin, options.set);
      }

      if (options.importConfig) {
        return importPluginConfiguration(plugin, options.importConfig);
      }

      if (options.unset) {
        return unsetPluginConfiguration(plugin, options.unset);
      }

      if (options.replace) {
        return replacePluginConfiguration(plugin, options.replace);
      }

      if (options.remove) {
        return removePlugin(plugin);
      }

      if (options.activate) {
        return _kuzzle.internalEngine
          .update(_kuzzle.config.pluginsManager.dataCollection, plugin, {activated: true})
          .then(() => getPluginConfiguration(plugin));
      }

      if (options.deactivate) {
        return _kuzzle.internalEngine
          .update(_kuzzle.config.pluginsManager.dataCollection, plugin, {activated: false})
          .then(() => getPluginConfiguration(plugin));
      }

      return Promise.resolve();
    })
    .then(response => {
      releaseLock();
      return response;
    })
    .catch(error => {
      _kuzzle.pluginsManager.trigger('log:error', error);
      releaseLock();

      /*
       If elasticsearch returns with a "Service temporary unavailable" error,
       we retry until it's ready
       */
      if (error.status === 503) {
        _kuzzle.pluginsManager.trigger('log:warn', 'The database seems to not be ready yet. Retrying in 5s...');
        return new Promise((resolve) => {
          setTimeout(() => {
            pluginsManager(requestObject)
              .then(() => {
                resolve();
              });
          }, 5000);
        });
      }

      return Promise.reject(error);
    });
}

/**
 * Creates the internalIndex in the Kuzzle database, if it
 * doesn't already exists
 */
function initializeInternalIndex () {
  return _kuzzle.internalEngine.createInternalIndex()
    .then(() => {
      /*
       Disables mapping on the 'config' object to avoid conflicts
       between different plugins
       */
      return _kuzzle.internalEngine.updateMapping(
        _kuzzle.config.pluginsManager.dataCollection,
        {
          properties: {
            config: {
              enabled: false
            }
          }
        }
      );
    })
    .catch(err => {
      // ignoring error if it's raised because the index already exists
      if (err.status === 400) {
        return Promise.resolve();
      }

      return Promise.reject(err);
    });
}

/**
 * Returns the list of plugins to install
 * The returned list is in the following format:
 *   [
 *     "plugin-name": {
 *       "how to": "get this plugin"
 *     }
 *   ]
 *
 * @param {Object} db - database service
 * @param {Object} cfg - Kuzzle configuration
 * @returns Promise
 */
function getPluginsList() {
  return _kuzzle.internalEngine
    .search(_kuzzle.config.pluginsManager.dataCollection)
    .then(result => {
      var plugins = {};

      if (result.total === 0) {
        return _kuzzle.config.pluginsManager.defaultPlugins;
      }

      result.hits.forEach(p => {
        plugins[p._id] = p._source;
      });

      return plugins;
    });
}

/**
 * Install plugins and load their configuration into the database
 *
 * @param plugin to install. May be undefined (install all listed plugins)
 * @param options - arguments supplied by the user on the command-line
 * @param dbService - handler to Kuzzle's database
 * @param kuzzleConfiguration - Kuzzle configuratioin
 * @returns {Promise}
 */
function installPlugins(plugin, options) {
  var
    p = {},
    pluginsListPromise,
    pluginsList;

  if (plugin) {
    p[plugin] = {};
    ['npmVersion', 'gitUrl', 'path'].forEach(tag => {
      if (options[tag] !== undefined) {
        p[plugin][tag] = options[tag];
      }
    });

    p[plugin].activated = options.activated;

    pluginsListPromise = Promise.resolve(p);
  }
  else {
    pluginsListPromise = getPluginsList();
  }

  return pluginsListPromise
    .then(plugins => {
      pluginsList = plugins;
      if (_.isEmpty(plugins)) {
        return Promise.resolve();
      }
      return acquirePlugins(plugins);
    })
    .then(() => {
      _kuzzle.pluginsManager.trigger('log:info', '███ kuzzle-plugins: Updating plugins configuration...');
      return updatePluginsConfiguration(pluginsList);
    });
}

/**
 * Import a configuration from a given file for a given plugin
 * @param db
 * @param plugin
 * @param filePath
 * @param {Object} kuzzleConfiguration
 */
function importPluginConfiguration(plugin, filePath) {
  var
    content;

  try {
    content = fs.readFileSync(filePath, 'UTF-8');
  } catch (err) {
    return Promise.reject(new Error(`Error opening file ${filePath}: ${err.message}`));
  }

  try {
    content = JSON.parse(content);
  }
  catch (err) {
    return Promise.reject(new Error(`Unable to parse ${filePath}: ${err}`));
  }

  return _kuzzle.internalEngine.get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(res => {
      res._source.config = content;
      return _kuzzle.internalEngine.createOrReplace(_kuzzle.config.pluginsManager.dataCollection, plugin, res._source);
    })
    .catch(err => {
      var error = new Error(`Plugin ${plugin} not found`);
      error.stack = err.stack;

      throw error;
    });
}

/**
 * Create a lock file to prevent downloading multiple times plugins if there is more than one worker
 */
function createLock(pluginPath) {
  fs.closeSync(fs.openSync(path.join(pluginPath, 'lock'), 'w'));
}

/**
 * Download given plugins
 * @param plugins
 * @returns {Promise} resolved once all plugins are downloaded
 */
function acquirePlugins(plugins) {
  var
    promises = [];

  _.forEach(plugins, (plugin, name) => {
    var
      installViaNpm = true,
      errorMessage;
    
    if (plugin.path) {
      _kuzzle.pluginsManager.trigger('log:warn', `███ kuzzle-plugins: Plugin ${name} uses local plugin. Config will be overridden with local changes.`);
      installViaNpm = false;
    }
    else if (!plugin.gitUrl && !plugin.npmVersion) {
      errorMessage = `███ kuzzle-plugins: Plugin ${name} provides no means of installation. Expected: path, git URL or npm version`;
      _kuzzle.pluginsManager.trigger('log:error', errorMessage);
      throw new Error(errorMessage);
    }

    if (!needInstall(plugin, name)) {
      _kuzzle.pluginsManager.trigger('log:info', '███ kuzzle-plugins: Plugin', name, 'is already installed. Skipping...');
      return true;
    }

    if (installViaNpm) {
      promises.push(npmInstall(plugin, name));
    }
  });
  return Promise.all(promises);
}

/**
 * Install a plugin with NPM
 * Returns a promise resolved once the plugin has been installed
 *
 * @param {string} plugin - plugin infos
 * @param {string} name - plugin name
 * @returns {Promise}
 */
function npmInstall(plugin, name) {
  var uri;

  if (plugin.gitUrl) {
    uri = plugin.gitUrl;
  } else if (plugin.npmVersion) {
    uri = name + '@' + plugin.npmVersion;
  } else {
    uri = name;
  }
  _kuzzle.pluginsManager.trigger('log:info', `███ kuzzle-plugins: Downloading plugin: ${uri}`);

  return new Promise((resolve, reject) => {
    childProcess.exec('npm install ' + uri, (err, stdout, stderr) => {
      if (err) {
        _kuzzle.pluginsManager.trigger('log:error', `Plugin download error. Full log:\n${stderr}`);
        return reject(err);
      }

      _kuzzle.pluginsManager.trigger('log:info', `███ kuzzle-plugins: Plugin ${uri} downloaded`);
      if (plugin.gitUrl) {
        createLock(getPluginPath(plugin, name));
      }
      resolve();
    });
  });
}

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @param db - database service client
 * @param collection in which the plugin configuration must be stored
 * @param plugins list
 * @returns {Promise}
 */
function updatePluginsConfiguration(plugins) {
  var promises = [];

  _.forEach(plugins, (plugin, name) => {
    var
      pluginPackage,
      pluginConfiguration;

    try {
      if (plugin.path) {
        pluginPackage = require(path.join(plugin.path, 'package.json'));
      }
      else {
        pluginPackage = require(path.join(getPluginPath(plugin, name), 'package.json'));
      }
    }
    catch (e) {
      _kuzzle.pluginsManager.trigger('log:error',
        'There is a problem with plugin ' + name + '. Check the plugin installation directory');
      promises.push(Promise.reject(e));
      return false;
    }

    // If there is no information about plugin in the package.json
    if (!pluginPackage.pluginInfo) {
      return false;
    }

    pluginConfiguration = _.extend(plugin, pluginPackage.pluginInfo);
    if (pluginConfiguration.defaultConfig) {
      pluginConfiguration.config = pluginConfiguration.defaultConfig;
      delete pluginConfiguration.defaultConfig;
    }

    // By default, when a new plugin is installed, the plugin is activated
    if (pluginConfiguration.activated === undefined) {
      pluginConfiguration.activated = true;
    }
    promises.push(_kuzzle.internalEngine.createOrReplace(
      _kuzzle.config.pluginsManager.dataCollection, 
      name, 
      pluginConfiguration
    ));
  });

  return Promise.all(promises);
}

/**
 * Detects if the configured plugin must be installed
 * If the plugin is configured with an url from GIT, the plugin is installed every time
 *   to ensure getting the latest release
 * If the plugin come from NPM or , the plugin is installed only if the required version
 *   is different from the version of the already installed plugin
 *
 * @param plugin
 * @param name
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(plugin, name) {
  var
    packageDefinition,
    packagePath,
    lockPath,
    pluginPath = getPluginPath(plugin, name);

  // If we want to install a plugin with git, maybe there is no version and we want to 'pull' the plugin
  if (plugin.gitUrl) {
    lockPath = path.join(pluginPath, 'lock');
    // Check if the plugin was installed in the current hour, if not then we install it again in case of update
    if (fs.existsSync(lockPath)) {
      if (new Date(fs.statSync(lockPath).mtime) > new Date() - 3600000 === true) {
        return false;
      }
      fs.unlinkSync(lockPath);
    }
    return true;
  }

  if (plugin.path) {
    return false;
  }

  packagePath = path.join(pluginPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return true;
  }

  packageDefinition = require(path.join(pluginPath, 'package.json'));

  // If version in package.json is different from the version the plugins.json, we want to install the updated plugin
  return (packageDefinition._from !== name + '@' + plugin.npmVersion);
}

/**
 * Return the real plugin path
 * @param plugin
 * @param name
 * @returns {String}
 */
function getPluginPath (plugin, name) {
  if (plugin.path) {
    return plugin.path;
  }
  return path.join(__dirname, '..', '..', '..', '..', 'node_modules', name);
}

/**
 * Dumps a plugin's configuration on the standard output.
 *
 * @param {string} plugin name
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function getPluginConfiguration(plugin) {
  return _kuzzle.internalEngine
    .get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(result => result._source);
}

/**
 * Sets a new plugin property
 *
 * @param {string} plugin
 * @param {string} property - expected: stringified JSON object
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function setPluginConfiguration(plugin, property) {
  var jsonProperty;

  try {
    jsonProperty = JSON.parse(property);
  }
  catch (err) {
    return Promise.reject(new Error('Unable to parse ' + property + '. Expected: JSON Object\n' + err));
  }

  return _kuzzle.internalEngine
    .get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(result => {
      var newConfiguration = result._source;
      _.extend(newConfiguration.config, jsonProperty);
      return _kuzzle.internalEngine.update(_kuzzle.config.pluginsManager.dataCollection, plugin, newConfiguration);
    })
    .then(() => getPluginConfiguration(plugin));
}

/**
 * Removes a property from a plugin configuration
 *
 * @param {string} plugin
 * @param {string} property to be removed
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function unsetPluginConfiguration(plugin, property) {
  return _kuzzle.internalEngine
    .get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(result => {
      var config = result._source;

      if (config.config[property] === undefined) {
        return Promise.reject(new Error('Property ' + property + ' not found in the plugin configuration'));
      }

      delete config.config[property];
      return _kuzzle.internalEngine.replace(_kuzzle.config.pluginsManager.dataCollection, plugin, config);
    })
    .then(() => getPluginConfiguration(plugin));
}

/**
 * Replace a plugin configuration by a new content
 *
 * @param {string} plugin
 * @param {string} content
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function replacePluginConfiguration(plugin, content) {
  var jsonProperty;

  try {
    jsonProperty = JSON.parse(content);
  }
  catch (err) {
    return Promise.reject(new Error('Unable to parse the new plugin configuration. Expected: JSON Object\n' + err));
  }

  return _kuzzle.internalEngine
    .get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(result => {
      result._source.config = jsonProperty;
      return _kuzzle.internalEngine.replace(_kuzzle.config.pluginsManager.dataCollection, plugin, result._source);
    })
    .then(() => getPluginConfiguration(plugin));
}

/**
 * Removes a plugin
 *
 * @param {string} plugin
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function removePlugin(plugin) {
  var
    installedLocally,
    rimrafPromise = Promise.promisify(rimraf);

  return _kuzzle.internalEngine
    .get(_kuzzle.config.pluginsManager.dataCollection, plugin)
    .then(result => {
      // Plugins imported using --path should not be deleted
      installedLocally = (result._source.npmVersion || result._source.gitUrl);
      return _kuzzle.internalEngine.delete(_kuzzle.config.pluginsManager.dataCollection, plugin);
    })
    .then(() => {
      _kuzzle.pluginsManager.trigger('log:info', `███ [plugins] Plugin ${plugin} configuration deleted`);
      if (installedLocally) {
        try {
          return rimrafPromise(getPluginPath({}, plugin));
        }
        catch (err) {
          return Promise.reject(new Error('Unable to remove the plugin module: ' + err));
        }
      }
    })
    .then(() => {
      return {installedLocally};
    });
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return pluginsManager;
};
