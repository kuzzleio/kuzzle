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
  errorsManager = require('../../config/error-codes/throw').wrap(
    'plugin',
    'manifest'),
  path = require('path'),
  semver = require('semver');

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
    this.kuzzleVersion = null;
    this.raw = null;
  }

  load() {
    try {
      this.raw = require(this.manifestPath);
    } catch (e) {
      errorsManager.throw('cannot_load', this.path);
    }

    if (_.isNil(this.raw.kuzzleVersion)) {
      this.kuzzle.log.warn(`[${this.path}/manifest.json] No "kuzzleVersion" property found: assuming the target is Kuzzle v1`);

      // Only Kuzzle v1 should support plugins or protocols
      // without a kuzzleVersion property set
      this.kuzzleVersion = '>=1.0.0 <2.0.0';
    } else {
      this.kuzzleVersion = this.raw.kuzzleVersion;
    }

    if (!semver.satisfies(this.kuzzle.config.version, this.kuzzleVersion)) {
      errorsManager.throw(
        'version_mismatch',
        this.path,
        this.kuzzle.config.version,
        this.kuzzleVersion);
    }

    if (!_.isNil(this.raw.name)) {
      if (typeof this.raw.name !== 'string' || this.raw.name.length === 0) {
        errorsManager.throw('invalid_name', this.path);
      }

      this.name = this.raw.name;
    }
    else {
      errorsManager.throw('missing_name', this.path);
    }
  }

  /**
   * This object can be stringified and exported, most notably by the
   * server:info API route
   * It's important that only relevant properties are stringified, to
   * prevent circular JSONs (especially with the kuzzle object ref) and
   * to prevent leaking important information
   *
   * @return {Object}
   */
  toJSON() {
    return {
      name: this.name,
      path: this.path,
      kuzzleVersion: this.kuzzleVersion
    };
  }
}

module.exports = AbstractManifest;
