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
  _ = require('lodash'),
  { PluginImplementationError } = require('kuzzle-common-objects').errors,
  path = require('path'),
  semver = require('semver');

/* eslint-disable no-console */

/**
 * Abstract class used to load a manifest.json file.
 * Used as a base for plugins and protocols.
 *
 * @param {Kuzzle} kuzzle       - Kuzzle instance
 * @param {string} pluginPath   - Absolute path to the plugin directory
 */
class AbstractManifest {
  constructor(kuzzle, pluginPath) {
    this.kuzzle = kuzzle;
    this.path = pluginPath;
    this.manifestPath = path.resolve(this.path, 'manifest.json');
    this.name = null;
    this.privileged = false;
    this.kuzzleVersion = null;
  }

  load() {
    let raw;

    try {
      raw = require(this.manifestPath);
    } catch (e) {
      throw new PluginImplementationError(`[${this.path}] Unable to load the file 'manifest.json'`);
    }

    if (!_.isNil(raw.privileged)) {
      if (typeof raw.privileged !== 'boolean') {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid "privileged" property: expected a boolean, got a ${typeof raw.privileged}`);
      }
      this.privileged = raw.privileged;
    }

    if (_.isNil(raw.kuzzleVersion)) {
      console.warn(`[${this.path}/manifest.json] No "kuzzleVersion" property found: assuming the target is Kuzzle v1`);
      // Only Kuzzle 1.x should support plugins or protocols
      // without a kuzzleVersion property set
      this.kuzzleVersion = '>=1.0.0 <2.0.0';
    } else {
      this.kuzzleVersion = raw.kuzzleVersion;
    }

    if (!semver.satisfies(this.kuzzle.config.version, this.kuzzleVersion)) {
      throw new PluginImplementationError(`[${this.path}/manifest.json] Version mismatch: current Kuzzle version ${this.kuzzle.config.version} does not match the manifest requirements (${this.kuzzleVersion})`);
    }

    if (!_.isNil(raw.name)) {
      if (typeof raw.name !== 'string' || raw.name.length === 0) {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid "name" property: expected a non-empty string`);
      }

      this.name = raw.name;
    } else {
      throw new PluginImplementationError(`[${this.path}/manifest.json] A "name" property is required"`);
    }
  }
}

module.exports = AbstractManifest;
