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

const fs = require('fs');
const path = require('path');

const rc = require('rc');

const inquirer = require('./inquirerExtended');
const Logger = require('./logger');

const defaultConfiguration = require('../../../lib/config/default.config');
const { version: currentVersion } = require('../../../package.json');

class Version {
  constructor() {
    this.from = null;
    this.list = [];
  }
}

class UpgradeContext {
  constructor(args) {
    // copy constructor
    if (args instanceof UpgradeContext) {
      this.config = args.config;
      this.log = args.log;
      this.inquire = args.inquire;
      this.version = args.version;
      this.argv = args.argv;
    }
    else {
      this.config = null;
      this.log = new Logger(args);
      this.inquire = inquirer;
      this.version = null;
      this.argv = args;
    }
  }

  async init () {
    await this.loadConfiguration();

    if (this.config.configs) {
      this.log.ok('Configuration files loaded:');
      this.config.configs.forEach(f => this.log.print(`\t- ${f}`));
    }

    this.version = await this.getVersions();
  }

  async loadConfiguration () {
    let cfg;

    try {
      cfg = rc('kuzzle', JSON.parse(JSON.stringify(defaultConfiguration)));
      this.config = cfg;
      return;
    }
    catch (e) {
      this.log.error(`Cannot load configuration files: ${e.message}`);
      if (this.config === null) {
        this.log.error('Check your configuration files, and restart the upgrade script.');
        process.exit(1);
      }
    }

    // If we are here, this means that an error was thrown, due to a change made
    // to configuration files *during* the upgrade (probably because a version
    // upgrade asked the user to modify their configuration files manually)
    // To prevent aborting unnecessarily during the upgrade process, we ask the
    // user to fix the situation
    const retry = await this.inquire.direct({
      default: true,
      message: 'Retry?',
      type: 'confirm'
    });

    if (!retry) {
      this.log.error('Aborted by user action.');
      process.exit(1);
    }

    await this.loadConfiguration();
  }

  /**
   * Asks the user the source version to upgrade from
   * @returns {Version}
   */
  async getVersions () {
    const version = new Version();

    this.log.print(`Current Kuzzle version: ${currentVersion}`);

    version.list = fs
      .readdirSync(
        path.resolve(`${__dirname}/../versions`),
        { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.match(/^v\d+$/))
      .map(entry => entry.name)
      .sort((a, b) => parseInt(a[0].substring(1)) - parseInt(b[0].substring(1)));

    if (version.list.length === 1) {
      version.from = version.list[0];
    }
    else {
      version.from = await inquirer.direct({
        choices: version.list,
        default: version.list[version.list.length - 1],
        message: 'Migrate from which version',
        type: 'list'
      });

      version.list = version.list.slice(version.list.indexOf(version.from));
    }

    return version;
  }
}

module.exports = UpgradeContext;
