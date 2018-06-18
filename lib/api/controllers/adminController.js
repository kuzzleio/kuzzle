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
  {
    InternalError: KuzzleInternalError,
    BadRequestError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  {
    assertArgsHasAttribute
  } = require('../../util/requestAssertions'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  moment = require('moment'),
  dumpme = require('dumpme'),
  zlib = require('zlib'),
  glob = require('glob');

let
  _dump = false,
  _shutdown = false;

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Reset the internal storage components (internalEngine index, cache and memory storage)
   */
  resetKuzzleData () {
    this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle reset initiated: this may take a while...');

    deleteObjects(this.kuzzle, 'user', {})
      .then(() => this.kuzzle.internalEngine.deleteIndex())
      .then(() => this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle internal database deleted'))
      .then(() => this.kuzzle.services.list.internalCache.flushdb())
      .then(() => {
        this.kuzzle.indexCache.remove(this.kuzzle.internalEngine.index);
        this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle internal cache flushed');

        return this.kuzzle.internalEngine.bootstrap.all();
      });

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset Redis cache
   */
  resetCache (request) {
    assertArgsHasAttribute(request, 'database');

    const
      database = request.input.args.database,
      cacheEngine = this.kuzzle.services.list[database];

    if (! (cacheEngine !== undefined && typeof cacheEngine.flushdb === 'function')) {
      throw new BadRequestError(`Database ${database} not found`);
    }

    cacheEngine.flushdb();

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset all roles, profiles and users
   */
  resetSecurity () {
    const options = {
      refresh: 'wait_for'
    };

    deleteObjects(this.kuzzle, 'user', options)
      .then(() => deleteObjects(this.kuzzle, 'profile', options))
      .then(() => deleteObjects(this.kuzzle, 'role', options))
      .then(() => this.kuzzle.internalEngine.bootstrap.createDefaultProfiles())
      .then(() => this.kuzzle.internalEngine.bootstrap.createDefaultRoles());

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset all indexes created by users
   */
  resetDatabase () {
    const indexes = Object.keys(this.kuzzle.indexCache.indexes).filter(idx => idx[0] !== '%');

    Bluebird.map(indexes, index => {
      const request = new Request({ index });

      return this.kuzzle.services.list.storageEngine.deleteIndex(request)
        .then(() => delete this.kuzzle.indexCache.indexes[index]);
    });

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Generate a dump
   */
  dump (request) {
    if (_dump) {
      throw new BadRequestError('A dump is already being generated. Skipping.');
    }

    const suffix = request.input.args.suffix ? `-${request.input.args.suffix}` : '';

    generateDump(this.kuzzle, suffix);
    
    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Shutdown Kuzzle
   */
  shutdown () {
    if (_shutdown) {
      throw new BadRequestError('Kuzzle is already shutting down.');
    }

    _shutdown = true;

    process.kill(process.pid, 'SIGTERM');

    return Bluebird.resolve({ acknowledge: true });
  }

}

/**
 * @param {Kuzzle} kuzzle
 * @param {string} objectType - must be an existent repository name
 * @param {object} options - options for ES request
 * @param {object} part
 * @param {Promise<undefined>}
 */
function deleteObjects(kuzzle, objectType, options, part = null) {
  if (kuzzle.repositories[objectType] === undefined) {
    throw new KuzzleInternalError(`Unknown objectType ${objectType}, must be one of ${Object.keys(kuzzle.repositories).join(', ')}`);
  }

  if (part === null) {
    return kuzzle.repositories[objectType].search({}, {scroll: '10m', size: 100})
      .then(objects => {
        return deleteObjectsPart(kuzzle, objectType, objects, options)
          .then(() => {
            if (objects.hits.length < objects.total) {
              return deleteObjects(kuzzle, objectType, options, {
                total: objects.total,
                deleted: objects.hits.length,
                scrollId: objects.scrollId
              });
            }

            return null;
          });
      });
  }

  return kuzzle.repositories[objectType].scroll(part.scrollId, '10m')
    .then(objects => {
      return deleteObjectsPart(kuzzle, objectType, objects, options)
        .then(() => {
          part.deleted += objects.hits.length;
          if (part.deleted < part.total) {
            part.scrollId = objects.scrollId;
            return deleteObjects(kuzzle, objectType, options, part);
          }

          return null;
        });
    });
}

function deleteObjectsPart (kuzzle, objectType, objects, options) {
  return Bluebird.map(objects.hits, object => {
    const protectedObjects = objectType === 'user' ? [] : ['admin', 'default', 'anonymous'];

    if (protectedObjects.indexOf(object._id) !== -1) {
      return Bluebird.resolve();
    }

    const request = new Request({ _id: object._id });
    request.input.args = options;

    // Some metaprogramming spell to handle deleteUser, deleteRole and deleteProfile actions on securityController
    const securityController = kuzzle.funnel.controllers.security;
    const action = `delete${objectType.charAt(0).toUpperCase()}${objectType.slice(1)}`;

    return securityController[action].apply(securityController, [request]); // eslint-disable-line no-useless-call
  });
}

/**
 * Create a dump
 *
 * @param {Kuzzle} kuzzle
 * @param {string} suffix
 * @returns {Promise}
 */
/* eslint-disable no-console */
function generateDump (kuzzle, suffix) {
  let dumpPath;
  _dump = true;

  return new Bluebird((resolve, reject) => {
    dumpPath = path.join(
      path.normalize(kuzzle.config.dump.path),
      moment().format(kuzzle.config.dump.dateFormat).concat(suffix).substring(0, 200)
    );

    console.log('===========================================================================');
    cleanUpHistory(kuzzle);

    console.log(`Generating dump in ${dumpPath}`);
    try {
      fs.mkdirsSync(dumpPath);
    }
    catch (e) {
      if (e.message.startsWith('EEXIST')) {
        console.log('Dump directory already exists. Skipping..');
        return reject('Dump directory already exists. Skipping..');
      }

      console.log('ERROR: unknown error while trying to create dump folder');
      return reject(`ERROR: unknown error while trying to create dump folder: ${e.message}`);
    }

    // dumping kuzzle configuration
    console.log('> dumping kuzzle configuration');
    fs.writeFileSync(path.join(dumpPath, 'config.json'), JSON.stringify(kuzzle.config, null, ' ').concat('\n'));

    // dumping plugins configuration
    console.log('> dumping plugins configuration');
    fs.writeFileSync(path.join(dumpPath, 'plugins.json'), JSON.stringify(kuzzle.pluginsManager.getPluginsDescription(), null, ' ').concat('\n'));

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
    if (!process.env.pm_err_log_path && !process.env.pm_log_path) {
      console.log('... no log found');
      return resolve();
    }

    const logDir = path.dirname(process.env.pm_err_log_path || process.env.pm_log_path);
    fs.readdir(logDir, (err, files) => {
      if (err) {
        return reject(new KuzzleInternalError('... error reading log directory'));
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
          reject(`fileStats: ${e.message}`);
        });
    });
  })
    .then(() => new Bluebird((resolve, reject) => {
      // core-dump
      console.log('> generating core-dump');
      dumpme(kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

      // Gzip the core
      glob(`${dumpPath}/core*`, (err, res) => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        if (!res[0]) {
          console.log('> warning: could not generate dump');
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
              resolve(e.message);
            }
          });
      });
    }))
    .then(() => {
      // copy node binary
      console.log('> copy node binary');
      fs.copySync(process.execPath, path.join(dumpPath, 'node'));

      // dumping Kuzzle's stats
      console.log('> dumping kuzzle\'s stats');
      return kuzzle.statistics.getAllStats(new Request({action: 'getAllStats', controller: 'statistics'}));
    })
    .then(response => {
      fs.writeFileSync(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));

      console.log('Done.');
      console.log('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
      console.log('===========================================================================');
    })
    .then(() => dumpPath)
    .finally(() => {
      _dump = false;
    });
}

function cleanUpHistory(kuzzle) {
  const
    config = kuzzle.config.dump,
    dumpPath = path.normalize(kuzzle.config.dump.path);

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

    fs.removeSync(dir);
  }

  for (let i = 0; i < dumps.length - config.history.coredump; i++) {
    const corefiles = glob.sync(`${path.normalize(dumps[i].path)}/core*`);
    if (corefiles[0]) {
      fs.unlinkSync(corefiles[0]);
    }
  }
}

module.exports = AdminController;
