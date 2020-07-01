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

const Bluebird = require('bluebird');
const { Request } = require('kuzzle-common-objects');
const path = require('path');
const fs = require('fs');
const os = require('os');
const moment = require('moment');
const dumpme = require('dumpme');
const zlib = require('zlib');

const kerror = require('../kerror');

class DumpGenerator {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this._dump = false;
  }

  /**
   * Create a dump
   *
   * @param {string} suffix
   * @returns {Promise}
   */
  async dump (suffix) {
    if (this._dump) {
      throw kerror.get('api', 'process', 'action_locked', 'dump');
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
      fs.mkdirSync(dumpPath, { recursive: true });
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

    // core-dump
    this.kuzzle.log.info('> generating core-dump');
    dumpme(this.kuzzle.config.dump.gcore || 'gcore', `${dumpPath}/core`);

    // Gzip the core
    try {
      const corefiles = this._listFilesMatching(dumpPath, 'core');

      if (corefiles[0]) {
        const readStream = fs.createReadStream(corefiles[0]);
        const writeStream = fs.createWriteStream(`${dumpPath}/core.gz`);

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
    fs.copyFileSync(process.execPath, path.join(dumpPath, 'node'));

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
      const corefiles = this._listFilesMatching(path.normalize(dumps[i].path), 'core');

      if (corefiles[0]) {
        fs.unlinkSync(corefiles[0]);
      }
    }
  }

  _listFilesMatching (directory, start) {
    return fs.readdirSync(directory)
      .filter(entry => (
        fs.lstatSync(`${directory}/${entry}`).isFile() && entry.startsWith(start)
      ))
      .map(file => path.join(directory, file));
  }
}

module.exports = DumpGenerator;
