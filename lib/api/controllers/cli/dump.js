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

let
  _lock = false,
  _kuzzle;

/**
 * Create a dump
 *
 * @param {Request} request
 * @param {Function} statusUpdate 
 * @returns {Promise}
 */
// eslint-disable-next-line no-console
function dump (request, statusUpdate = console.log) {
  if (_lock) {
    statusUpdate('A dump is already being generated. Skipping.');
    return Bluebird.resolve();
  }

  let dumpPath;
  _lock = true;

  return new Bluebird((resolve, reject) => {
    const suffix = request && request.input.args.suffix ? '-' + request.input.args.suffix : '';
    dumpPath = path.join(
      path.normalize(_kuzzle.config.dump.path),
      moment().format(_kuzzle.config.dump.dateFormat).concat(suffix)
    );

    statusUpdate('===========================================================================');
    cleanUpHistory(statusUpdate);

    statusUpdate(`Generating dump in ${dumpPath}`);
    try {
      fs.mkdirsSync(dumpPath);
    }
    catch (e) {
      if (e.message.startsWith('EEXIST')) {
        statusUpdate('Dump directory already exists. Skipping..');
        return resolve();
      }

      statusUpdate('ERROR: unknown error while trying to create dump folder');
      statusUpdate(e);
      return reject();
    }

    // dumping kuzzle configuration
    statusUpdate('> dumping kuzzle configuration');
    fs.writeFileSync(path.join(dumpPath, 'config.json'), JSON.stringify(_kuzzle.config, null, ' ').concat('\n'));

    // dumping plugins configuration
    statusUpdate('> dumping plugins configuration');
    fs.writeFileSync(path.join(dumpPath, 'plugins.json'), JSON.stringify(_kuzzle.pluginsManager.getPluginsDescription(), null, ' ').concat('\n'));

    // dumping nodejs configuration
    statusUpdate('> dumping nodejs configuration');
    fs.writeFileSync(path.join(dumpPath, 'nodejs.json'), JSON.stringify({
      env: process.env,
      config: process.config,
      argv: process.argv,
      versions: process.versions,
      release: process.release,
      moduleLoadList: process.moduleLoadList
    }, null, ' ').concat('\n'));

    // dumping os configuration
    statusUpdate('> dumping os configuration');
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
    statusUpdate('> dumping std err/out');
    if (!process.env.pm_err_log_path && !process.env.pm_log_path) {
      statusUpdate('... no logs found');
      return resolve();
    }

    const logDir = path.dirname(process.env.pm_err_log_path || process.env.pm_log_path);
    fs.readdir(logDir, (err, files) => {
      if (err) {
        statusUpdate('... error reading log directory');
        return resolve();
      }

      Bluebird.all(files.map(file => Bluebird.promisify(fs.stat)(path.join(logDir, file))
        .then(stats => {
          return {
            path: path.join(logDir, file),
            stats
          };
        }))
      )
        .then(fileStats => {
          const keep = {};

          for (const statFile of fileStats) {
            const root = path.basename(statFile.path).replace(/(-\d+)?\.[^.]+$/, '');
            if (!keep[root] || keep[root].stats.ctime < statFile.stats.ctime) {
              keep[root] = statFile;
            }
          }

          const promises = [];
          for (const root of Object.keys(keep)) {
            const statFile = keep[root];

            fs.ensureDirSync(path.join(dumpPath, 'logs'));
            // eslint-disable-next-line no-loop-func
            promises.push(new Bluebird(res => {
              fs.createReadStream(statFile.path)
                .pipe(zlib.createGzip())
                .pipe(fs.createWriteStream(path.join(dumpPath, 'logs', root + '.gz')))
                .on('finish', () => {
                  res();
                });
            }));
          }
          return Bluebird.all(promises);
        })
        .then(() => {
          resolve();
        })
        .catch(e => {
          statusUpdate('fileStats', e);
          resolve();
        });
    });
  })
    .then(() => new Bluebird((resolve, reject) => {
      // core-dump
      statusUpdate('> generating core-dump');
      dumpme(_kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

      // Gzip the core
      glob(`${dumpPath}/core*`, (err, res) => {
        if (err) {
          statusUpdate(err);
          return reject(err);
        }

        if (!res[0]) {
          statusUpdate('> warning: could not generate dump');
          return resolve();
        }

        const readStream = fs.createReadStream(res[0]);
        const writeStream = fs.createWriteStream(`${dumpPath}/core.gz`);

        readStream
          .pipe(zlib.createGzip())
          .pipe(writeStream)
          .on('finish', () => {
            // rm the original core file
            try {
              fs.unlinkSync(res[0]);
              resolve();
            }
            catch (e) {
              resolve();
            }
          });
      });
    }))
    .then(() => {
      // copy node binary
      statusUpdate('> copy node binary');
      fs.copySync(process.execPath, path.join(dumpPath, 'node'));

      // dumping Kuzzle's stats
      statusUpdate('> dumping kuzzle\'s stats');
      return _kuzzle.statistics.getAllStats(new Request({action: 'getAllStats', controller: 'statistics'}));
    })
    .then(response => {
      fs.writeFileSync(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));

      statusUpdate('Done.');
      statusUpdate('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
      statusUpdate('===========================================================================');
    })
    .then(() => dumpPath)
    .finally(() => {
      _lock = false;
    });
}

function cleanUpHistory(statusUpdate) {
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

    statusUpdate(`> removing dump directory from history: ${dir}`);
    fs.removeSync(dir);
  }

  for (let i = 0; i < dumps.length - config.history.coredump; i++) {
    const corefiles = glob.sync(`${path.normalize(dumps[i].path)}/core*`);
    if (corefiles[0]) {
      fs.unlinkSync(corefiles[0]);
    }
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
