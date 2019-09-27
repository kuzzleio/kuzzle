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
  errorsManager = require('../../config/error-codes/throw'),
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
      errorsManager.throw(
        'plugins',
        'validation',
        'unable_to_load_manifest',
        this.path);
    }

    if (_.isNil(this.raw.kuzzleVersion)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'missing_kuzzleVersion',
        this.path
      );
    }

    this.kuzzleVersion = this.raw.kuzzleVersion;
    const versionWithoutPrerelease = this.kuzzle.config.version.split('-')[0];

    if (!semver.satisfies(versionWithoutPrerelease, this.kuzzleVersion)) {
      errorsManager.throw(
        'plugins',
        'validation',
        'version_mismatch',
        this.path,
        this.kuzzle.config.version,
        this.kuzzleVersion);
    }

    if (!_.isNil(this.raw.name)) {
      if (typeof this.raw.name !== 'string' || this.raw.name.length === 0) {
        errorsManager.throw(
          'plugins',
          'validation',
          'invalid_name_property',
          this.path);
      }

      this.name = this.raw.name;
    } else {
      errorsManager.throw(
        'plugins',
        'validation',
        'missing_name_property',
        this.path);
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
