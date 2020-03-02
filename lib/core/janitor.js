/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
  errorsManager = require('../util/errors'),
  { assertIsObject } = require('../util/requestAssertions'),
  runShutdown = require('../util/shutdown'),
  path = require('path'),
  fs = require('fs-extra'),
  os = require('os'),
  moment = require('moment'),
  dumpme = require('dumpme'),
  zlib = require('zlib'),
  _ = require('lodash'),
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
   * @param {object} securities
   * @returns {Promise}
   */
  async loadSecurities (securities = {}) {
    assertIsObject(securities);
    await this._createSecurity('createOrReplaceRole', securities.roles);
    await this._createSecurity('createOrReplaceProfile', securities.profiles);
    await this._deleteUsers(securities.users);
    await this._createSecurity('createUser', securities.users);
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

        const importArgs = [];

        for (const index of Object.keys(fixtures)) {
          assertIsObject(fixtures[index]);

          for (const collection of Object.keys(fixtures[index])) {
            importArgs.push([index, collection, fixtures[index][collection]]);
          }
        }

        return importArgs;
      })
      .each(args => {
        const [ index, collection, bulkData ] = args;

        return this.kuzzle.storageEngine.public.import(
          index,
          collection,
          bulkData,
          { refresh: 'wait_for' }
        )
          .then(({ errors }) => {
            if (errors.length > 0) {
              throw errorsManager.get(
                'services',
                'storage',
                'import_failed',
                errors);
            }
          });
      });
  }

  /**
   * Load database mappings into Kuzzle
   *
   * @param {String} mappings
   * @returns {Promise}
   */
  loadMappings (collectionMappings = {}) {
    return Bluebird.resolve()
      .then(() => {
        assertIsObject(collectionMappings);

        const collections = [];

        for (const index of Object.keys(collectionMappings)) {
          assertIsObject(collectionMappings[index]);

          for (const collection of Object.keys(collectionMappings[index])) {
            collections.push({
              collection,
              index,
              mappings: collectionMappings[index][collection]
            });
          }
        }

        return collections;
      })
      .each(({ index, collection, mappings }) => {
        return this.kuzzle.storageEngine.public.indexExists(index)
          .then(exist => {

            if (! exist) {
              return this.kuzzle.storageEngine.public.createIndex(index);
            }

            return null;
          })
          .then(() => this.kuzzle.storageEngine.public.createCollection(
            index,
            collection,
            { mappings })
          );
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
  async dump (suffix) {
    if (this._dump) {
      throw errorsManager.get('api', 'process', 'action_locked', 'dump');
    }

    this._dump = true;

    const dumpPath = path.join(
      path.normalize(this.kuzzle.config.dump.path),
      moment()
        .format(this.kuzzle.config.dump.dateFormat)
        .concat(`-${suffix}`)
        .substring(0, 200));

    this.kuzzle.log.info('='.repeat(79));
    this.kuzzle.log.info(`Generating dump in ${dumpPath}`);
    this._cleanUpHistory();

    try {
      fs.mkdirsSync(dumpPath);
    }
    catch (e) {
      const message = e.message.startsWith('EEXIST') ?
        'Dump directory already exists. Skipping..' :
        `Unable to create dump folder: ${e.message}`;

      this.kuzzle.log.error(message);
      throw new Error(message);
    }

    // dump kuzzle information
    this.kuzzle.log.info('> dumping kuzzle configuration');
    fs.writeFileSync(
      path.join(dumpPath, 'kuzzle.json'),
      JSON
        .stringify(
          {
            config: this.kuzzle.config,
            version: require('../../package.json').version
          },
          null,
          ' ')
        .concat('\n'));

    // dump plugins configuration
    this.kuzzle.log.info('> dumping plugins configuration');
    fs.writeFileSync(
      path.join(dumpPath, 'plugins.json'),
      JSON
        .stringify(this.kuzzle.pluginsManager.getPluginsDescription(), null, ' ')
        .concat('\n'));

    // dump Node.js configuration
    this.kuzzle.log.info('> dumping Node.js configuration');
    fs.writeFileSync(
      path.join(dumpPath, 'nodejs.json'),
      JSON
        .stringify(
          {
            argv: process.argv,
            config: process.config,
            env: process.env,
            moduleLoadList: process.moduleLoadList,
            release: process.release,
            versions: process.versions
          },
          null,
          ' ')
        .concat('\n'));

    // dump os configuration
    this.kuzzle.log.info('> dumping os configuration');
    fs.writeFileSync(
      path.join(dumpPath, 'os.json'),
      JSON
        .stringify(
          {
            cpus: os.cpus(),
            loadavg: os.loadavg(),
            mem: {
              free: os.freemem(),
              total: os.totalmem()
            },
            networkInterfaces: os.networkInterfaces(),
            platform: os.platform(),
            uptime: os.uptime()
          },
          null,
          ' ')
        .concat('\n'));

    // dump std err/out
    this.kuzzle.log.info('> dumping std err/out');
    await this._dumpLogs(dumpPath);

    // core-dump
    this.kuzzle.log.info('> generating core-dump');
    dumpme(this.kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

    // Gzip the core
    try {
      const corefiles = glob.sync(`${dumpPath}/core*`);

      if (corefiles[0]) {
        const
          readStream = fs.createReadStream(corefiles[0]),
          writeStream = fs.createWriteStream(`${dumpPath}/core.gz`);

        await new Bluebird(resolve => readStream
          .pipe(zlib.createGzip())
          .pipe(writeStream)
          .on('finish', () => {
            // rm the original core file
            try {
              fs.unlinkSync(corefiles[0]);
            }
            catch (e) {
              this.kuzzle.log.warn(`> unable to clean up core file ${corefiles[0]}`);
            }
            resolve();
          }));
      }
      else {
        this.kuzzle.log.warn('> could not generate dump');
      }
    }
    catch (error) {
      this.kuzzle.log.error(error);
    }

    // copy node binary
    this.kuzzle.log.info('> copy node binary');
    fs.copySync(process.execPath, path.join(dumpPath, 'node'));

    // dumping Kuzzle's stats
    this.kuzzle.log.info('> dumping kuzzle\'s stats');
    const statistics = await this.kuzzle.statistics.getAllStats(
      new Request({action: 'getAllStats', controller: 'statistics'}));

    fs.writeFileSync(
      path.join(dumpPath, 'statistics.json'),
      JSON.stringify(statistics.hits, null, ' ').concat('\n'));

    this.kuzzle.log.info('Done.');
    this.kuzzle.log.info('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
    this.kuzzle.log.info('='.repeat(79));

    this._dump = false;
    return dumpPath;
  }

  _cleanUpHistory () {
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
        _id,
        action,
        body: objects[_id],
        controller: 'security',
        refresh: 'wait_for'
      });

      return this.kuzzle.funnel.processRequest(request);
    });
  }

  async _deleteUsers (users) {
    if (_.isEmpty(users)) {
      return;
    }

    const ids = Object.keys(users);

    const mGetUsers = new Request({
      action: 'mGetUsers',
      body: { ids },
      controller: 'security'
    });

    const { result } = await this.kuzzle.funnel.processRequest(mGetUsers);

    const existingUsers = result.hits.map(({ _id }) => _id);

    if (existingUsers.length === 0) {
      return;
    }

    // Only delete users who exists to avoid errors in the logs
    const mDeleteUsers = new Request({
      action: 'mDeleteUsers',
      body: { ids: existingUsers },
      controller: 'security',
      refresh: 'wait_for'
    });

    await this.kuzzle.funnel.processRequest(mDeleteUsers);
  }

  async _dumpLogs (dumpPath) {
    if (!process.env.pm_err_log_path && !process.env.pm_log_path) {
      this.kuzzle.log.info('... no log found');
      return;
    }

    const logDir = path.dirname(process.env.pm_err_log_path || process.env.pm_log_path);

    if (!logDir) {
      return;
    }

    let files;

    try {
      files = fs.readdirSync(logDir);
    }
    catch (error) {
      throw errorsManager.getFrom(
        error,
        'core',
        'fatal',
        'unreadable_log_dir',
        logDir,
        error);
    }

    let fileStats;

    try {
      fileStats = await Bluebird.all(
        files.map(async file => {
          const stats = await Bluebird.promisify(fs.stat)(path.join(logDir, file));
          return {path: path.join(logDir, file), stats};
        }));
    }
    catch (error) {
      this.kuzzle.log.error(`fileStats: ${error.message}`);
      return;
    }

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

      promises.push(new Bluebird(res => {
        fs.createReadStream(statFile.path)
          .pipe(zlib.createGzip())
          .pipe(fs.createWriteStream(path.join(dumpPath, 'logs', `${root}.gz`)))
          .on('finish', () => res());
      }));
    }

    await Bluebird.all(promises);
  }
}

module.exports = Janitor;
