/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* eslint-disable no-console */

const
  Bluebird = require('bluebird'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  Request = require('kuzzle-common-objects').Request,
  moment = require('moment'),
  dumpme = require('dumpme'),
  zlib = require('zlib'),
  glob = require('glob');

let _kuzzle;

/**
 * Create a dump
 *
 * @param {Request} request
 * @returns {Promise}
 */
function dump (request) {
  return new Bluebird(resolve => {
    const suffix = request && request.input.args.suffix ? '-' + request.input.args.suffix : '';
    const dumpPath = path.join(
      path.normalize(_kuzzle.config.dump.path),
      moment().format(_kuzzle.config.dump.dateFormat).concat(suffix)
    );

    console.log('===========================================================================');
    cleanUpHistory();

    console.log('Generating dump in '.concat(dumpPath));
    fs.mkdirsSync(dumpPath);

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
        path.join(dumpPath, 'logs'),
        {
          preserveTimestamps: true
        }
      );
    }
    else if (process.env.pm_log_path) {
      fs.copySync(
        path.dirname(process.env.pm_log_path),
        path.join(dumpPath, 'logs'),
        {
          preserveTimestamps: true
        }
      );
    }
    else {
      console.log('... no logs found');
    }

    // core-dump
    console.log('> generating core-dump');
    dumpme(_kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

    // Gzip the core
    glob(`${dumpPath}/core*`, (err, res) => {
      if (err) {
        console.error(err);
        return;
      }

      const readStream = fs.createReadStream(res[0]);
      const writeStream = fs.createWriteStream(`${dumpPath}/core.gz`);

      readStream
        .pipe(zlib.createGzip())
        .pipe(writeStream)
        .on('finish', () => {
          // rm the original core file
          fs.unlink(res[0]);
        });
    });

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

    resolve(dumpPath);
  });
}

function cleanUpHistory() {
  const
    config = _kuzzle.config.dump,
    dumpPath = path.normalize(_kuzzle.config.dump.path);

  try {
    fs.accessSync(dumpPath, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
  }
  catch(e) {
    return;
  }

  const dumps = fs.readdirSync(dumpPath)
    .map(file => {
      const filepath = `${dumpPath}/${file}`;
      return {path: filepath, stat: fs.statSync(filepath)};
    })
    .filter(prop => prop.stat.isDirectory())
    .sort((a, b) => {
      if (a.stat.birthtime.getTime() === b.stat.birthtime.getTime()) {
        return 0;
      }

      return a.stat.birthtime < b.stat.birthtime ? -1 : 1;
    });

  while (dumps.length >= config.history.reports) {
    const dir = dumps.shift().path;

    console.log(`> removing dump directory from history: ${dir}`);
    fs.removeSync(dir);
  }

  const corefiles = dumps
    .filter(dir => {
      try {
        fs.accessSync(`${dir.path}/core`);
        return true;
      }
      catch (e) {
        return false;
      }
    })
    .map(dir => `${dir.path}/core`);

  while (corefiles.length >= config.history.coredump) {
    const core = corefiles.shift();

    console.log(`> removing coredump from history: ${core}`);
    fs.removeSync(core);
  }
}

/**
 * @param {Kuzzle} kuzzle
 * @returns {dump}
 */
module.exports = function remoteDump (kuzzle) {
  _kuzzle = kuzzle;
  return dump;
};
