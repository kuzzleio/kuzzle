var
  _ = require('lodash'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  compareVersions = require('compare-versions'),
  exec = require('child_process').exec,
  fs = require('fs'),
  Promise = require('bluebird'),
  rimraf = require('rimraf');

function PluginPackage (kuzzle, name, definition) {
  this.kuzzle = kuzzle;
  this.name = name;

  this.activated = true;

  if (definition) {
    this.setDefinition(definition);
  }
}

PluginPackage.prototype.setDefinition = function pluginPackageSetDefinition (definition) {
  [
    'path',
    'gitUrl',
    'url',
    'npmVersion',
    'version',
    'activated'
  ].forEach(k => {
    if (definition[k] !== undefined) {
      switch (k) {
        case 'gitUrl':
          this.url = definition[k];
          break;
        case 'npmVersion':
          this.version = definition[k];
          break;
        default:
          this[k] = definition[k];
      }
    }
  });

  return this;
};

PluginPackage.prototype.dbConfiguration = function pluginPackageDbConfiguration () {
  return this.kuzzle.internalEngine.get('plugins', this.name)
    .then(response => {
      var config = response._source;

      if (config.npmVersion) {
        if (config.version === undefined) {
          config.version = config.npmVersion;
        }
        delete config.npmVersion;
      }

      if (config.gitUrl) {
        if (config.url === undefined) {
          config.url = config.gitUrl;
        }
        delete config.gitUrl;
      }

      return config;
    });
};

PluginPackage.prototype.updateDbConfiguration = function pluginPackageUpdateDbConfiguration (config) {
  return this.kuzzle.internalEngine.createOrReplace('plugins', this.name, {
    version: this.version,
    activated: this.activated,
    config
  })
    .then(response => response._source);
};

PluginPackage.prototype.setActivate = function pluginPackageSetActivate (activated) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition && !definition.deleted) {
        this.activated = activated === undefined || activated;
        return this.updateDbConfiguration(definition.config);
      }

      return {deleted: true};
    });
};

PluginPackage.prototype.localConfiguration = function pluginPackageLocalConfiguration () {
  var
    config = {},
    pkgjson;

  try {
    pkgjson = require(`${this.kuzzle.rootPath}/node_modules/${this.name}/package.json`);
  }
  catch (e) {
    // do nothing
  }
  // default config from plugin package.json
  if (pkgjson && pkgjson.pluginInfo && pkgjson.pluginInfo.defaultConfig) {
    config = pkgjson.pluginInfo.defaultConfig;
  }

  // allow default plugin configuration to be overridden by kuzzle
  if (this.kuzzle.config.plugins[this.name] && this.kuzzle.config.plugins[this.name].config) {
    config = _.merge(config, this.kuzzle.config.plugins[this.name].config);
  }

  return config;
};

PluginPackage.prototype.isInstalled = function pluginPackageIsInstalled () {
  var
    isInstalled = false;

  try {
    require(`${this.kuzzle.rootPath}/node_modules/${this.name}/package.json`);
    isInstalled = true;
  }
  catch (error) {
    // do nothing
  }

  return isInstalled;
};

PluginPackage.prototype.needsInstall = function pluginPackageNeedsInstall () {
  if (!this.isInstalled()) {
    return Promise.resolve(true);
  }

  return this.dbConfiguration()
    .then(config => {
      if (config.deleted) {
        return false;
      }
      if (!config.version) {
        return true;
      }
      return compareVersions(config.version, this.localVersion()) > 0;
    })
    .catch(error => {
      if (error.message === 'Not Found') {
        return true;
      }

      throw error;
    });
};

PluginPackage.prototype.needsToBeDeleted = function pluginPackageNeedsToBeDeleted () {
  if (!this.isInstalled()) {
    return Promise.resolve(false);
  }

  return this.dbConfiguration()
    .then(config => Boolean(config.deleted))
    .catch(error => {
      if (error.message === 'Not Found') {
        return false;
      }

      throw error;
    });
};

PluginPackage.prototype.localVersion = function pluginPackageLocalVersion () {
  var
    pkgjson;

  try {
    pkgjson = require(`${this.kuzzle.rootPath}/node_modules/${this.name}/package.json`);
  } catch (e) {
    throw new Error('Wooops! Something went wrong while trying to read the '
    + 'plugin version from local package. This may be due to a malformed '
    + 'npm installation.', e.message);
  }

  return pkgjson.version;
};

PluginPackage.prototype.install = function pluginPackageInstall () {
  var
    pkg = this.name;

  if (this.path) {
    pkg = this.path;
  }
  if (this.url) {
    pkg = this.url;
  }

  if (this.version) {
    if (/\.git$/.test(pkg)) {
      pkg += '#' + this.version;
    }
    else if (!/^https?:\/\//.test(pkg)) {
      pkg += '@' + this.version;
    }
  }

  return Promise.promisify(exec)(`npm install ${pkg}`)
    .then(stdout => {
      var regex = /^([a-zA-Z0-9_\-]+)@([0-9.]+) node_modules\/[a-zA-Z0-9_\-]+$/;

      /*
         when using another installation method than npm repository,
         we cannot determine the plugin name from the installation
         options only.

         The only way for the time being is to parse the npm install
         response to get it.
      */
      return stdout.split(/\r?\n/)
        .reverse()
        .some(line => {
          var
            r = regex.exec(line),
            wrongNameMsg;

          if (r) {
            wrongNameMsg = `WARNING: Given plugin name "${this.name}" does not match its packages.json name "${r[1]}".\n`
              + `If you installed this plugin by other means than the CLI, please update Kuzzle configuration to use proper name "${r[1]}".`;

            if (this.name && this.name !== r[1]) {
              // the provided name does not match the one from the packages.json
              if (this.kuzzle.pluginsManager.isInit) {
                // the plugin manager is init. We are most likely running action for the remote controller
                // and need to inform the user back
                throw new BadRequestError(wrongNameMsg);
              }
              else {
                console.warn(wrongNameMsg); // eslint-disable-line no-console
              }
            }

            this.name = r[1];
            this.version = r[2];
            return true;
          }

          return false;
        });
    })
    .then((detectedVersionFromStdout) => {
      if (!detectedVersionFromStdout) {
        this.version = this.localVersion();
      }
      if (!this.version) {
        throw new Error('An error occurred while detecting the installed version.');
      }
      this.config = this.localConfiguration();
      return this.updateDbConfiguration(this.config);
    })
    .then(() => {
      return {
        name: this.name,
        version: this.version,
        config: this.config
      };
    });
};

PluginPackage.prototype.delete = function pluginPackageDelete () {
  return this.kuzzle.internalEngine.createOrReplace('plugins', this.name, {deleted: true})
    .then(() => Promise.promisify(rimraf)(`${this.kuzzle.rootPath}/node_modules/${this.name}`))
    .then(() => {
      this.deleted = true;
      return { acknowledged: true };
    });
};

PluginPackage.prototype.setConfigurationProperty = function pluginPackageSetConfigurationProperty (property) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition.deleted) {
        return Promise.resolve({deleted: true});
      }

      return this.updateDbConfiguration(_.extend(definition.config, property));
    });
};

PluginPackage.prototype.unsetConfigurationProperty = function pluginPackageUnsetConfigurationProperty (key) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition && definition.deleted) {
        return Promise.resolve({deleted: true});
      }

      if (definition.config[key] === undefined) {
        return Promise.reject(new BadRequestError(`Property ${key} not found in plugin configuration`));
      }

      delete definition.config[key];

      return this.updateDbConfiguration(definition.config);
    });
};

PluginPackage.prototype.importConfigurationFromFile = function pluginPackageImportConfigurationFromFile (path) {
  var
    content;

  try {
    content = fs.readFileSync(path, 'UTF-8');
  } catch (err) {
    return Promise.reject(new BadRequestError(`Error opening file ${path}: ${err.message}`));
  }

  try {
    content = JSON.parse(content);
  }
  catch (err) {
    return Promise.reject(new BadRequestError(`Unable to parse ${path}: ${err.message}`));
  }

  return this.updateDbConfiguration(content)
    .then(response => response._source);
};

module.exports = PluginPackage;


