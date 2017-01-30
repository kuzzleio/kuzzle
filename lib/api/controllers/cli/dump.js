'use strict';

/* eslint-disable no-console */

var
  Promise = require('bluebird'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  mkdirp = require('mkdirp'),
  Request = require('kuzzle-common-objects').Request,
  moment = require('moment'),
  dumpme = require('dumpme'),
  _kuzzle;

/**
 * Create a dump
 *
 * @param {Request} request
 * @returns {Promise}
 */
function dump (request) {
  const suffix = request && request.input.args.suffix ? '-' + request.input.args.suffix : '';
  const dumpPath = path.join(
    path.normalize(_kuzzle.config.dump.path),
    moment().format(_kuzzle.config.dump.dateFormat).concat(suffix)
  );

  console.log('===========================================================================');
  console.log('Generating dump in '.concat(dumpPath));
  mkdirp.sync(dumpPath);

  // dumping kuzzle configuration
  console.log('> dumping kuzzle configuration');
  fs.writeFileSync(path.join(dumpPath, 'config.json'), JSON.stringify(_kuzzle.config, null, ' ').concat('\n'));

  // dumping plugins configuration
  console.log('> dumping plugins configuration');
  fs.writeFileSync(path.join(dumpPath, 'plugins.json'), JSON.stringify(_kuzzle.pluginsManager.getPluginsFeatures(), null, ' ').concat('\n'));

  // dumping nodejs configuration
  console.log('> dumping nodejs configuration');
  fs.writeFileSync(path.join(dumpPath, 'nodejs.json'), JSON.stringify({
    env: process.env,
    config: process.config,
    argv: process.argv,
    versions: process.versions,
    release: process.release,
    moduleLoadList: process.moduleLoadList
  }, null, ' ').concat('\n'));

  // dumping os configuration
  console.log('> dumping os configuration');
  fs.writeFileSync(path.join(dumpPath, 'os.json'), JSON.stringify({
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

  // dumping std err/out
  console.log('> dumping std err/out');
  if (process.env.pm_err_log_path) {
    fs.copySync(
      path.dirname(process.env.pm_err_log_path),
      path.join(dumpPath, 'logs')
    );
  } else if (process.env.pm_log_path) {
    fs.copySync(
      path.dirname(process.env.pm_log_path),
      path.join(dumpPath, 'logs')
    );
  }

  // core-dump
  console.log('> generating core-dump');
  dumpme(_kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

  // copy node binary
  console.log('> copy node binary');
  fs.copySync(process.argv[0], path.join(dumpPath, 'node'));

  // dumping Kuzzle's stats
  console.log('> dumping kuzzle\'s stats');
  _kuzzle.statistics.getAllStats(new Request({action: 'getAllStats', controller: 'statistics'}))
    .then(response => {
      fs.writeFileSync(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));
    });

  console.log('Done.');
  console.log('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
  console.log('===========================================================================');

  return Promise.resolve(dumpPath);
}

/**
 * @param {Kuzzle} kuzzle
 * @returns {dump}
 */
module.exports = function remoteDump (kuzzle) {
  _kuzzle = kuzzle;
  return dump;
};
