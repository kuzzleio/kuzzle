var
  fs = require('fs'),
  rimraf = require('rimraf'),
  path = require('path'),
  q = require('q'),
  childProcess = require('child_process'),
  lockfile = require('proper-lockfile'),
  _ = require('lodash'),
  clc = require('cli-color'),
  defaultConfig = require('rc')('kuzzle'),
  DatabaseService = require('../../lib/services/internalEngine');

var
  clcError = clc.red,
  clcNotice = clc.cyan,
  clcOk = clc.green.bold;

/* eslint-disable no-console */

module.exports = function pluginsManager (plugin, options) {
  var
    dbService,
    kuzzleConfiguration;

  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-plugins: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  checkOptions(plugin, options);

  kuzzleConfiguration = require('../../lib/config')(defaultConfig);
  dbService = new DatabaseService({config: kuzzleConfiguration});
  dbService.init();

  // Prevents multiple 'kuzzle install' to install plugins at the same time.
  lockfile.lock('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000, stale: 60000, update: 10000}, (err, release) => {
    if (err) {
      console.error(clcError('███ kuzzle-plugins: Unable to acquire lock: '), err);
      process.exit(1);
    }

    initializeInternalIndex(dbService, kuzzleConfiguration)
      .then(() => {
        if (options.install) {
          if (plugin) {
            console.log('███ kuzzle-plugins: Installing plugin ' + plugin + '...');
          }
          else {
            console.log('███ kuzzle-plugins: Starting plugins installation...');
          }

          return installPlugins(plugin, options, dbService, kuzzleConfiguration);
        }

        if (options.get) {
          return getPluginConfiguration(plugin, dbService, kuzzleConfiguration);
        }

        if (options.set) {
          return setPluginConfiguration(plugin, options.set, dbService, kuzzleConfiguration);
        }

        if (options.unset) {
          return unsetPluginConfiguration(plugin, options.unset, dbService, kuzzleConfiguration);
        }

        if (options.replace) {
          return replacePluginConfiguration(plugin, options.replace, dbService, kuzzleConfiguration);
        }

        if (options.remove) {
          return removePlugin(plugin, dbService, kuzzleConfiguration);
        }

        if (options.activate) {
          return dbService
            .update(kuzzleConfiguration.pluginsManager.dataCollection, plugin, {activated: true})
            .then(() => getPluginConfiguration(plugin, dbService, kuzzleConfiguration));
        }

        if (options.deactivate) {
          return dbService
            .update(kuzzleConfiguration.pluginsManager.dataCollection, plugin, {activated: false})
            .then(() => getPluginConfiguration(plugin, dbService, kuzzleConfiguration));
        }
      })
      .then(() => {
        release();

        if (!plugin) {
          console.log(clcOk('███ kuzzle-plugins: Plugins installed'));
        }

        process.exit(0);
      })
      .catch(error => {
        release();

        /*
         If elasticsearch returns with a "Service temporary unavailable" error,
         we retry until it's ready
         */
        if (error.status === 503) {
          console.log('The database seems to not be ready yet. Retrying in 5s...');
          return setTimeout(() => pluginsManager(plugin, options), 5000);
        }

        console.error(clcError('Error: '), error);
        process.exit(error.status);
      });
  });
};

/**
 * Creates the internalIndex in the Kuzzle database, if it
 * doesn't already exists
 *
 * @param db
 * @param indexName
 */
function initializeInternalIndex(db, kuzzleConfiguration) {
  return db
    .createInternalIndex()
    .then(() => {
      /*
        Disables mapping on the 'config' object to avoid conflicts
        between different plugins
       */
      return db.updateMapping(
        kuzzleConfiguration.pluginsManager.dataCollection,
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
        return q();
      }

      return q.reject(err);
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
function getPluginsList(db, cfg) {
  return db
    .search(cfg.pluginsManager.dataCollection)
    .then(result => {
      var plugins = {};

      if (result.total === 0) {
        return cfg.pluginsManager.defaultPlugins;
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
function installPlugins(plugin, options, dbService, kuzzleConfiguration) {
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

    pluginsListPromise = q(p);
  }
  else {
    pluginsListPromise = getPluginsList(dbService, kuzzleConfiguration);
  }

  return pluginsListPromise
    .then(plugins => {
      pluginsList = plugins;
      return acquirePlugins(plugins);
    })
    .then(() => {
      console.log('███ kuzzle-plugins: Updating plugins configuration...');

      return updatePluginsConfiguration(
        dbService,
        kuzzleConfiguration.pluginsManager.dataCollection,
        pluginsList);
    });
}

/**
 * Download given plugins
 * @param plugins
 * @returns {Promise} resolved once all plugins are downloaded
 */
function acquirePlugins(plugins) {
  var
    installViaNpm = true,
    pluginInstallId,
    promises = [];

  _.forEach(plugins, (plugin, name) => {
    if (plugin.path) {
      console.log('███ kuzzle-plugins: Plugin', name, 'uses local plugin. Config will be overrided with local changes.');
      installViaNpm = false;
    }
    else if (plugin.gitUrl) {
      pluginInstallId = plugin.gitUrl;
    }
    else if (plugin.npmVersion) {
      pluginInstallId = name + '@' + plugin.npmVersion;
    }
    else {
      console.error(clcError('███ kuzzle-plugins: Plugin'), name, 'provides no means of installation. Expected: path, git URL or npm version');
      process.exit(1);
    }

    if (!plugin.path && !needInstall(plugin, name, pluginInstallId)) {
      console.log('███ kuzzle-plugins: Plugin', name, 'is already installed. Skipping...');
      return true;
    }

    if (installViaNpm) {
      promises.push(npmInstall(name, pluginInstallId));
    }
  });

  return q.all(promises);
}

/**
 * Install a plugin with NPM
 * Returns a promise resolved once the plugin has been installed
 *
 * @param {string} name - plugin name
 * @param {string} installId - argument provided to NPM to install the plugin
 * @returns {Promise}
 */
function npmInstall(name, installId) {
  var deferred = q.defer();

  console.log('███ kuzzle-plugins: Downloading plugin: ', name);

  childProcess.exec('npm install ' + installId, (err, stdout, stderr) => {
    if (err) {
      console.error(`Plugin download error. Full log:\n${stderr}`);
      return deferred.reject(err);
    }

    console.log('███ kuzzle-plugins: Plugin', name, 'downloaded');
    deferred.resolve();
  });

  return deferred.promise;
}

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @param db - database service client
 * @param collection in which the plugin configuration must be stored
 * @param plugins list
 * @returns {boolean}
 */
function updatePluginsConfiguration(db, collection, plugins) {
  var promises = [];

  _.forEach(plugins, (plugin, name) => {
    var
      pluginPackage,
      pluginConfiguration;

    try {
      pluginPackage = require(path.join(getPathPlugin(plugin, name), 'package.json'));
    }
    catch (e) {
      console.error(clcError('███ kuzzle-plugins:'), 'There is a problem with plugin ' + name + '. Check the plugin installation directory');
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

    promises.push(db.createOrReplace(collection, name, pluginConfiguration));
  });

  return q.all(promises);
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
 * @param from previously installation information with version or git url with branch
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(plugin, name, from) {
  var
    packageDefinition,
    packagePath,
    pluginPath = getPathPlugin(plugin, name);

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
 * @param plugin
 * @param name
 * @returns {String}
 */
function getPathPlugin (plugin, name) {
  if (plugin.path) {
    return plugin.path;
  }
  return path.join(__dirname, '..', '..', 'node_modules', name);
}

/**
 * Check the command-line validity.
 * Either this function completes successfully, or it exits the program
 * with a non-zero error code.
 *
 * @param plugin name
 * @param options provided on the command-line (commander object)
 */
function checkOptions(plugin, options) {
  var
    requiredOptions,
    installOptions;

  // Check if at least one of the action option is supplied
  requiredOptions = [0, 'install', 'remove', 'get', 'set', 'replace', 'unset', 'activate', 'deactivate']
    .reduce((p, c) => {
      return p + (options[c] !== undefined);
    });

  if (requiredOptions > 1) {
    console.error(clcError('Only one plugin action is allowed'));
    process.exit(1);
  }
  else if (requiredOptions === 0) {
    console.error(clcError('A plugin action is required'));
    /*
     options.help() also exits the program, but with an error code of zero
     A non-zero error code is preferred to allow scripts to fail
     */
    options.outputHelp();
    process.exit(1);
  }

  // --install is the only option working without specifying a plugin name
  if (!plugin && !options.install) {
    console.error(clcError('A plugin [name] is required for this operation'));
    process.exit(1);
  }

  // Checking mutually exclusive --install options
  installOptions = [0, 'npmVersion', 'gitUrl', 'path'].reduce((p, c) => {
    return p + (options[c] !== undefined);
  });

  if (installOptions > 0 && !options.install) {
    console.error(clcNotice('Options --npmVersion, --path and --gitUrl only work with --install. Ignoring them from now on.'))
  }
  else if (installOptions > 1) {
    console.error(clcError('Options --npmVersion, --path and --gitUrl are mutually exclusive'));
    process.exit(1);
  }
  else if (installOptions === 0 && options.install && plugin) {
    console.error(clcError('An installation configuration must be provided, with --npmVersion, --gitUrl or --path'));
    process.exit(1);
  }
}

/**
 * Dumps a plugin's configuration on the standard output.
 *
 * @param {string} plugin name
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function getPluginConfiguration(plugin, db, cfg) {
  return db
    .get(cfg.pluginsManager.dataCollection, plugin)
    .then(result => {
      console.dir(result._source, {depth: null});
      return result._source;
    });
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
function setPluginConfiguration(plugin, property, db, cfg) {
  var jsonProperty;

  try {
    jsonProperty = JSON.parse(property);
  }
  catch (err) {
    return q.reject(new Error('Unable to parse ' + property + '. Expected: JSON Object\n' + err));
  }

  return db
    .get(cfg.pluginsManager.dataCollection, plugin)
    .then(result => {
      var newConfiguration = result._source;
      _.extend(newConfiguration.config, jsonProperty);
      return db.update(cfg.pluginsManager.dataCollection, plugin, newConfiguration);
    })
    .then(() => getPluginConfiguration(plugin, db, cfg));
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
function unsetPluginConfiguration(plugin, property, db, cfg) {
  return db
    .get(cfg.pluginsManager.dataCollection, plugin)
    .then(result => {
      var config = result._source;

      if (!config.config[property]) {
        return q.reject(new Error('Property ' + property + ' not found in the plugin configuration'));
      }

      delete config.config[property];
      return db.replace(cfg.pluginsManager.dataCollection, plugin, config);
    })
    .then(() => getPluginConfiguration(plugin, db, cfg));
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
function replacePluginConfiguration(plugin, content, db, cfg) {
  var jsonProperty;

  try {
    jsonProperty = JSON.parse(content);
  }
  catch (err) {
    return q.reject(new Error('Unable to parse the new plugin configuration. Expected: JSON Object\n' + err));
  }

  return db
    .get(cfg.pluginsManager.dataCollection, plugin)
    .then(result => {
      result._source.config = jsonProperty;
      return db.replace(cfg.pluginsManager.dataCollection, plugin, result._source);
    })
    .then(() => getPluginConfiguration(plugin, db, cfg));
}

/**
 * Removes a plugin
 *
 * @param {string} plugin
 * @param {object} db - kuzzle database handler
 * @param {object} cfg - kuzzle configuration
 * @returns {Promise}
 */
function removePlugin(plugin, db, cfg) {
  var installedLocally;

  return db
    .get(cfg.pluginsManager.dataCollection, plugin)
    .then(result => {
      // Plugins imported using --path should not be deleted
      installedLocally = (result._source.npmVersion || result._source.gitUrl);

      return db.delete(cfg.pluginsManager.dataCollection, plugin);
    })
    .then(() => {
      var
        moduleDirectory;

      console.log('███ kuzzle-plugins: Plugin configuration deleted');

      if (installedLocally) {
        try {
          moduleDirectory = require.resolve(plugin);

          // instead of the module entry file, we need its installation directory
          moduleDirectory = moduleDirectory.substr(0, moduleDirectory.indexOf(plugin)) + '/' + plugin;
          return q.denodeify(rimraf)(moduleDirectory);
        }
        catch (err) {
          return q.reject(new Error('Unable to remove the plugin module: ' + err));
        }
      }
    })
    .then(() => {
      if (installedLocally) {
        console.log('███ kuzzle-plugins: Plugin directory deleted');
      }
    });
}