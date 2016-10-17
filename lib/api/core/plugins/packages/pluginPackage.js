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

PluginPackage.prototype.setDefinition = function (definition) {
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

PluginPackage.prototype.dbConfiguration = function () {
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

PluginPackage.prototype.updateDbConfiguration = function (config) {
  return this.kuzzle.internalEngine.createOrReplace('plugins', this.name, {
    version: this.version,
    activated: this.activated,
    config
  })
    .then(response => response._source);
};

PluginPackage.prototype.setActivate = function (activated) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition && !definition.deleted) {
        this.activated = activated === undefined || activated;
        return this.updateDbConfiguration(definition.config);
      }

      return {deleted: true};
    });
};

PluginPackage.prototype.localConfiguration = function () {
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

PluginPackage.prototype.isInstalled = function () {
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

PluginPackage.prototype.needsInstall = function () {
  if (!this.isInstalled()) {
    return Promise.resolve(true);
  }

  return this.dbConfiguration()
    .then(config => {
      if (config.deleted) {
        return false;
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

PluginPackage.prototype.needsToBeDeleted = function () {
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

PluginPackage.prototype.localVersion = function () {
  var
    pkgjson = require(`${this.kuzzle.rootPath}/node_modules/${this.name}/package.json`);

  return pkgjson.version;
};

PluginPackage.prototype.install = function () {
  var
    package = this.name;

  if (this.path) {
    package = this.path;
  }
  if (this.url) {
    package = this.url;
  }

  if (this.version) {
    if (/\.git$/.test(package)) {
      package += '#' + this.version;
    }
    else if (!/^https?:\/\//.test(package)) {
      package += '@' + this.version;
    }
  }

  return new Promise((resolve, reject) => {
    exec(`npm install ${package}`, (error, stdout, stderr) => {
      if (error) {
        return reject({error, stderr});
      }

      resolve(stdout);
    });
  })
    .then(() => {
      this.version = this.localVersion();
    })
    .then(() => this.updateDbConfiguration(this.localConfiguration()));
};

PluginPackage.prototype.delete = function () {
  return this.kuzzle.internalEngine.createOrReplace('plugins', this.name, {deleted: true})
    .then(() => Promise.promisify(rimraf)(`${this.kuzzle.rootPath}/node_modules/${this.name}`))
    .then(() => {
      this.deleted = true;
      return { acknowledged: true };
    });
};

PluginPackage.prototype.setConfigurationProperty = function (property) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition.deleted) {
        return Promise.resolve({_source: {deleted: true}});
      }

      return this.updateDbConfiguration(_.extend(definition.config, property));
    })
    .then(response => response._source);
};

PluginPackage.prototype.unsetConfigurationProperty = function (key) {
  return this.dbConfiguration()
    .then(definition => {
      if (definition && definition.deleted) {
        return Promise.resolve({_source: {deleted: true}});
      }

      if (definition.config[key] === undefined) {
        return Promise.reject(new BadRequestError(`Property ${key} not found in plugin configuration`));
      }

      delete definition.config[key];

      return this.updateDbConfiguration(definition.config);
    })
    .then(response => response._source);
};

PluginPackage.prototype.importConfigurationFromFile = function (path) {
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
    return Promise.reject(new BadRequestError(`Unable to parse ${path}: ${err}`));
  }

  return this.updateDbConfiguration(content)
    .then(response => response._source);
};

module.exports = PluginPackage;


