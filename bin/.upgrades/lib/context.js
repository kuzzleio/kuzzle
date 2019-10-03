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

const
  fs = require('fs'),
  path = require('path'),
  { version: currentVersion } = require('../../../package.json'),
  rc = require('rc'),
  inquirer = require('./inquirerExtended'),
  Logger = require('./logger');

class Version {
  constructor() {
    this.from = null;
    this.list = [];
  }
}

function loadConfiguration () {
  return rc('kuzzle', '../../../default.config.js');
}

class UpgradeContext {
  constructor(args) {
    this.config = null;
    this.log = new Logger(args);
    this.inquire = inquirer;
    this.version = null;
  }

  async init () {
    this.config = loadConfiguration();

    if (this.config.configs) {
      this.log.notice('Configuration files loaded:');
      this.config.configs.forEach(f => this.log.print(`\t- ${f}`));
    }

    this.version = await this.getVersions();
  }

  reloadConfiguration () {
    this.config = loadConfiguration();
  }

  /**
   * Asks the user the source version to upgrade from
   * @return {Version}
   */
  async getVersions () {
    const version = new Version();

    this.log.notice(`Current Kuzzle version: ${currentVersion}`);

    version.list = fs
      .readdirSync(
        path.resolve(`${__dirname}/../versions`),
        { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.match(/^v\d+$/))
      .map(entry => entry.name)
      .sort((a, b) => parseInt(a[0].substring(1))-parseInt(b[0].substring(1)));

    if (version.list.length === 1) {
      version.from = version.list[0];
    }
    else {
      version.from = await inquirer.direct({
        type: 'list',
        message: 'Migrate from which version',
        choices: version.list,
        default: version.list[version.list.length - 1]
      });

      version.list = version.list.slice(version.list.indexOf(version.from));
    }

    return version;
  }
}

module.exports = UpgradeContext;
