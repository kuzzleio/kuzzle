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

'use strict';

const
  Bluebird = require('bluebird'),
  { Request } = require('kuzzle-common-objects'),
  errorsManager = require('../../util/errors'),
  { assertIsObject } = require('../../util/requestAssertions'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  moment = require('moment'),
  dumpme = require('dumpme'),
  zlib = require('zlib'),
  glob = require('glob'),
  runShutdown = require('../../util/shutdown');

class Janitor {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this._dump = false;
  }

  /**
   * Load roles, profiles and users fixtures into Kuzzle
   *
   * @param {object} securities
   * @returns {Promise}
   */
  loadSecurities (securities = {}) {
    return Bluebird.resolve()
      .then(() => {
        assertIsObject(securities);
        return this._createSecurity('createOrReplaceRole', securities.roles);
      })
      .then(() => this._createSecurity('createOrReplaceProfile', securities.profiles))
      .then(() => this._deleteUsers(securities.users))
      .then(() => this._createSecurity('createUser', securities.users));
  }

  /**
   * Load database fixtures into Kuzzle
   *
   * @param {String} fixtures
   * @returns {Promise}
   */
  loadFixtures (fixtures = {}) {
    return Bluebird.resolve()
      .then(() => {
        assertIsObject(fixtures);

        const requests = [];

        for (const index of Object.keys(fixtures)) {
          assertIsObject(fixtures[index]);

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
              errorsManager.throw(
                'services',
                'storage',
                'import_failed',
                res.partialErrors);
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
   * @param {String} mappings
   * @returns {Promise}
   */
  loadMappings (mappings = {}) {
    return Bluebird.resolve()
      .then(() => {
        assertIsObject(mappings);

        const requests = [];

        for (const index of Object.keys(mappings)) {
          assertIsObject(mappings[index]);

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

            return null;
          })
          .then(() => this.kuzzle.services.list.storageEngine.createCollection(request))
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
    return runShutdown(this.kuzzle);
  }

  /**
   * Create a dump
   *
   * @param {string} suffix
   * @returns {Promise}
   */
  dump (suffix) {
    if (this._dump) {
      return errorsManager.reject('api', 'process', 'action_locked', 'dump');
    }

    let dumpPath;
    this._dump = true;

    return new Bluebird((resolve, reject) => {
      dumpPath = path.join(
        path.normalize(this.kuzzle.config.dump.path),
        moment().format(this.kuzzle.config.dump.dateFormat).concat(`-${suffix}`).substring(0, 200)
      );

      this.kuzzle.log.info('===========================================================================');
      this._cleanUpHistory();

      this.kuzzle.log.info(`Generating dump in ${dumpPath}`);
      try {
        fs.mkdirsSync(dumpPath);
      }
      catch (e) {
        const message = e.message.startsWith('EEXIST') ?
          'Dump directory already exists. Skipping..' :
          `Unknown error while trying to create dump folder: ${e.message}`;

        this.kuzzle.log.error(message);
        return reject(new Error(message));
      }

      // dumping kuzzle information
      this.kuzzle.log.info('> dumping kuzzle configuration');
      fs.writeFileSync(
        path.join(dumpPath, 'kuzzle.json'),
        JSON.stringify(
          {
            version: require('../../../package.json').version,
            config: this.kuzzle.config
          },
          null,
          ' ')
          .concat('\n'));

      // dumping plugins configuration
      this.kuzzle.log.info('> dumping plugins configuration');
      fs.writeFileSync(
        path.join(dumpPath, 'plugins.json'),
        JSON
          .stringify(this.kuzzle.pluginsManager.getPluginsDescription(), null, ' ')
          .concat('\n'));

      // dumping nodejs configuration
      this.kuzzle.log.info('> dumping nodejs configuration');
      fs.writeFileSync(path.join(dumpPath, 'nodejs.json'), JSON.stringify({
        env: process.env,
        config: process.config,
        argv: process.argv,
        versions: process.versions,
        release: process.release,
        moduleLoadList: process.moduleLoadList
      }, null, ' ').concat('\n'));

      // dumping os configuration
      this.kuzzle.log.info('> dumping os configuration');
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
      this.kuzzle.log.info('> dumping std err/out');
      if (!process.env.pm_err_log_path && !process.env.pm_log_path) {
        this.kuzzle.log.info('... no log found');
        return resolve();
      }

      const logDir = path.dirname(process.env.pm_err_log_path || process.env.pm_log_path);

      if (!logDir) {
        return resolve();
      }

      fs.readdir(logDir, (err, files) => {
        if (err) {
          return reject(
            errorsManager.getFrom(
              err,
              'core',
              'fatal',
              'unreadable_log_dir',
              logDir,
              err));
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
        this.kuzzle.log.info('> generating core-dump');
        dumpme(this.kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

        // Gzip the core
        glob(`${dumpPath}/core*`, (err, res) => {
          if (err) {
            this.kuzzle.log.error(err);
            return reject(err);
          }

          if (!res[0]) {
            this.kuzzle.log.info('> warning: could not generate dump');
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
        this.kuzzle.log.info('> copy node binary');
        fs.copySync(process.execPath, path.join(dumpPath, 'node'));

        // dumping Kuzzle's stats
        this.kuzzle.log.info('> dumping kuzzle\'s stats');
        return this.kuzzle.statistics.getAllStats(new Request({action: 'getAllStats', controller: 'statistics'}));
      })
      .then(response => {
        fs.writeFileSync(path.join(dumpPath, 'statistics.json'), JSON.stringify(response.hits, null, ' ').concat('\n'));

        this.kuzzle.log.info('Done.');
        this.kuzzle.log.info('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
        this.kuzzle.log.info('===========================================================================');
      })
      .then(() => dumpPath)
      .catch(error => {
        // Silently catch scanStream is not a function in the statistics component
        // when kuzzle is running in cluster mode
        this.kuzzle.log.error(error);
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

  _createSecurity (action, objects) {
    if (! objects) {
      return Bluebird.resolve();
    }

    try {
      assertIsObject(objects);
    } catch (e) {
      return Bluebird.reject(e);
    }

    return Bluebird.map(Object.keys(objects), _id => {
      assertIsObject(objects[_id]);

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
