/* eslint-disable no-console */

const
  Promise = require('bluebird'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  mkdirp = require('mkdirp'),
  core = require('gcore').gcore,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  moment = require('moment');

var
  _kuzzle;

/**
 * Create a dump
 *
 * @returns {Promise}
 */
function dump (request) {
  var prefix = request.data.body.prefix ? request.data.body.prefix + '-' : '';
  var dumpPath = path.join(
    path.normalize(_kuzzle.config.dump.path),
    prefix.concat(moment().format(_kuzzle.config.dump.dateFormat))
  );

  console.log('Generating dump in '.concat(dumpPath));
  mkdirp.sync(dumpPath);

  // dumping kuzzle configuration
  fs.writeFile(path.join(dumpPath, 'config.json'), JSON.stringify(_kuzzle.config, null, ' ').concat('\n'));

  // dumping plugins configuration
  fs.writeFile(path.join(dumpPath, 'plugins.json'), JSON.stringify(_kuzzle.pluginsManager.plugins, null, ' ').concat('\n'));

  // dumping nodejs configuration
  fs.writeFile(path.join(dumpPath, 'nodejs.json'), JSON.stringify({
    env: process.env,
    config: process.config,
    argv: process.argv,
    versions: process.versions,
    release: process.release,
    moduleLoadList: process.moduleLoadList
  }, null, ' ').concat('\n'));

  // dumping os configuration
  fs.writeFile(path.join(dumpPath, 'os.json'), JSON.stringify({
    platform: os.platform(),
    loadavg: os.loadavg(),
    uptime: os.uptime(),
    cpus: os.cpus(),
    mem: {
      total: os.totalmem(),
      free: os.freemem()
    },
    networkInterfaces: os.networkInterfaces()
  }, null, ' ').concat('\n'));

  // retrieve errors logs
  if (process.env.pm_err_log_path) {
    fs.copy(
      path.dirname(process.env.pm_err_log_path),
      path.join(dumpPath, 'logs')
    );
  }

  // core-dump
  core(path.join(dumpPath, 'core'));

  // copy node binary
  fs.copy(process.argv[0], path.join(dumpPath, 'node'));

  // Kuzzle's stats
  _kuzzle.statistics.getAllStats(new RequestObject({action: 'getAllStats', controller: 'statistics'}))
    .then(response => {
      fs.writeFile(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));
    });

  console.log('Done.');

  return Promise.resolve(dumpPath);
}

/**
 * @param {Kuzzle} kuzzle
 * @returns {dump}
 */
module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return dump;
};
