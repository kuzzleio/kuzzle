/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

/* eslint-disable no-console */

'use strict';

const
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  {
    PreconditionError,
    InternalError: KuzzleInternalError,
    PartialError
  } = require('kuzzle-common-objects').errors,
  pm2 = require('pm2'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  moment = require('moment'),
  dumpme = require('dumpme'),
  zlib = require('zlib'),
  glob = require('glob');


class Janitor {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this._shutdown = 0;
    this._dump = false;
  }

  /**
   * Load roles, profiles and users fixtures into Kuzzle
   *
   * @param {String} filePath
   * @returns {Promise}
   */
  loadSecurities (filePath) {
    return this._loadJson(filePath)
      .then(securities => {
        return this._createSecurity('createOrReplaceRole', securities.roles)
          .then(() => this._createSecurity('createOrReplaceProfile', securities.profiles))
          .then(() => this._deleteUsers(securities.users))
          .then(() => this._createSecurity('createUser', securities.users));
      });
  }

  /**
   * Load database fixtures into Kuzzle
   *
   * @param {String} filePath
   * @returns {Promise}
   */
  loadFixtures (filePath) {
    return this._loadJson(filePath)
      .then(fixtures => {
        const requests = [];

        for (const index of Object.keys(fixtures)) {
          for (const collection of Object.keys(fixtures[index])) {
            requests.push(new Request({
              index,
              collection,
              body: {
                bulkData: fixtures[index][collection]
              }
            }));
          }
        }

        return requests;
      })
      .each(request => {
        return this.kuzzle.services.list.storageEngine.import(request)
          .then(res => {
            if (res.partialErrors && res.partialErrors.length > 0) {
              throw new PartialError(`Some data was not imported for ${request.input.resource.index}/${request.input.resource.collection} (${res.partialErrors.length}/${res.items.length + res.partialErrors.length}).`, res.partialErrors);
            }
          })
          .then(() => {
            const indexRequest = new Request({ index: request.input.resource.index });

            return this.kuzzle.services.list.storageEngine.refreshIndex(indexRequest);
          });
      });
  }

  /**
   * Load database mappings into Kuzzle
   *
   * @param {String} filePath
   * @returns {Promise}
   */
  loadMappings (filePath) {
    return this._loadJson(filePath)
      .then(mappings => {
        const requests = [];

        for (const index of Object.keys(mappings)) {
          for (const collection of Object.keys(mappings[index])) {
            requests.push(new Request({
              index,
              collection,
              body: mappings[index][collection]
            }));
          }
        }

        return requests;
      })
      .each(request => {
        const
          index = request.input.resource.index,
          indexRequest = new Request({index});

        return this.kuzzle.services.list.storageEngine.indexExists(indexRequest)
          .then(exist => {
            if (! exist) {
              return this.kuzzle.services.list.storageEngine.createIndex(indexRequest);
            }
          })
          .then(() => this.kuzzle.services.list.storageEngine.updateMapping(request))
          .then(() => this.kuzzle.services.list.storageEngine.refreshIndex(indexRequest))
          .then(() => {
            const collection = request.input.resource.collection;

            this.kuzzle.indexCache.add(index, collection);

            return null;
          });
      });
  }

  /**
   * Gracefully exits after processing remaining requests
   *
   * @param {Kuzzle} kuzzle
   * @returns {Promise}
   */
  shutdown () {
    // pm2.delete sends a SIGINT signal
    // we keep track of how many shutdowns are asked
    // to detect when pm2 has finished deleting Kuzzle
    // from its tasks list
    this._shutdown++;

    if (this._shutdown > 1) {
      return Bluebird.resolve();
    }

    console.log('Initiating shutdown...');

    return new Bluebird(resolve => {
      this.kuzzle.entryPoints.dispatch('shutdown');

      // Gives time for the proxy to receive the shutdown signal
      // and eventually to receive the last batch of requests to process
      setTimeout(() => this._waitRemainingRequests(resolve), 1000);
    });
  }

  /**
   * Create a dump
   *
   * @param {string} suffix
   * @returns {Promise}
   */
  dump (suffix) {

    return Bluebird.resolve();
    if (this._dump) {
      return Bluebird.reject(new PreconditionError('A dump is already being generated. Skipping.'));
    }

    if (! this.kuzzle.config.dump.enabled) {
      return Bluebird.reject(new PreconditionError('Dump generation is disabled.'));
    }

    let dumpPath;
    this._dump = true;

    return new Bluebird((resolve, reject) => {
      dumpPath = path.join(
        path.normalize(this.kuzzle.config.dump.path),
        moment().format(this.kuzzle.config.dump.dateFormat).concat(`-${suffix}`).substring(0, 200)
      );

      console.log('===========================================================================');
      this._cleanUpHistory();

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
      fs.writeFileSync(path.join(dumpPath, 'config.json'), JSON.stringify(this.kuzzle.config, null, ' ').concat('\n'));

      // dumping plugins configuration
      console.log('> dumping plugins configuration');
      fs.writeFileSync(path.join(dumpPath, 'plugins.json'), JSON.stringify(this.kuzzle.pluginsManager.getPluginsDescription(), null, ' ').concat('\n'));

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
        dumpme(this.kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

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
        return this.kuzzle.statistics.getAllStats(new Request({action: 'getAllStats', controller: 'statistics'}));
      })
      .then(response => {
        fs.writeFileSync(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));

        console.log('Done.');
        console.log('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
        console.log('===========================================================================');
      })
      .then(() => dumpPath)
      .catch(error => {
        // Silently catch scanStream is not a function in the statistics component
        // when kuzzle is running in cluster mode
        console.log(error);
        return Bluebird.resolve(dumpPath);
      })
      .finally(() => {
        this._dump = false;
      });
  }

  _cleanUpHistory() {
    const
      config = this.kuzzle.config.dump,
      dumpPath = path.normalize(this.kuzzle.config.dump.path);

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

  _waitRemainingRequests (resolve) {
    const remaining = this.kuzzle.funnel.remainingRequests;

    if (remaining !== 0) {
      console.log(`Waiting: ${remaining} remaining requests`);
      return setTimeout(() => this._waitRemainingRequests(resolve), 1000);
    }

    resolve();

    pm2.list((listerr, processes) => {
      if (listerr) {
        return this._halt();
      }

      const kuzzleProcess = processes
        .filter(pm2Process => pm2Process.pid === process.pid);

      // not started with PM2 or development mode => exit immediately
      if (kuzzleProcess.length === 0 || kuzzleProcess[0].pm2_env.watch) {
        if (kuzzleProcess.length !== 0) {
          console.log('PM2 Watch activated: restarting Kuzzle');

          return pm2.restart(kuzzleProcess[0].pm_id);
        }

        return this._halt();
      }

      // production mode: ask PM2 to stop & delete Kuzzle to prevent
      // a restart
      pm2.delete(kuzzleProcess[0].pm_id, delerr => {
        console.log('PM2 failed to delete Kuzzle: ', delerr);
        console.log('Exiting anyway.');
      });

      // pm2.delete does not notify when deletion is finished,
      // so we use the shutdown counter to check how many
      // SIGINT signals have been received
      const interval = setInterval(() => {
        if (this._shutdown > 1) {
          clearInterval(interval);
          this._halt();
        }
      }, 200);
    });
  }

  _halt () {
    console.log('Halted.');
    process.exit(0);
  }

  /**
   * Load a json file into a javascript object.
   * It's better than a simple require because we asynchronously read the file
   * and we avoid RCE if a javascript file is provided instead of JSON
   *
   */
  _loadJson (filePath) {
    return new Bluebird((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (error, rawData) => {
        if (error) {
          return reject(error);
        }

        try {
          const data = JSON.parse(rawData);

          resolve(data);
        }
        catch (e) {
          reject(e);
        }
      });
    });
  }

  _createSecurity (action, objects) {
    if (! objects) {
      return Bluebird.resolve();
    }

    return Bluebird.map(Object.keys(objects), _id => {
      const request = new Request({
        action,
        _id,
        controller: 'security',
        refresh: 'wait_for',
        body: objects[_id]
      });

      return this.kuzzle.funnel.processRequest(request);
    });
  }

  _deleteUsers (users) {
    if (! users) {
      return Bluebird.resolve();
    }

    const
      ids = Object.keys(users),
      request = new Request({
        controller: 'security',
        action: 'mDeleteUsers',
        refresh: 'wait_for',
        body: { ids }
      });

    return this.kuzzle.funnel.processRequest(request)
      .catch(error => {
        if (error.status === 206) {
          return null;
        }

        throw error;
      });
  }

}

module.exports = Janitor;
