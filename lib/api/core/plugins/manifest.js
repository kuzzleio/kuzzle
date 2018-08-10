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
 * This class initializes itself using a manifest.json file
 *
 * @deprecated  - the "fallback" argument is deprecated: there will be no
 * fallback if a manifest.json file is missing in the next major release of
 * Kuzzle. For now, the fallback is a function receiving this instance as
 * an argument, and is in charge of updating it accordingly
 *
 * @param {Kuzzle} kuzzle       - Kuzzle instance
 * @param {string} pluginPath   - Absolute path to the plugin directory
 * @param {Function} [fallback] - Fallback function, if no manifest.json is found
 */
class Manifest {
  constructor(kuzzle, pluginPath, fallback = null) {
    this.path = pluginPath;
    this.name = null;
    this.privileged = false;

    // Only Kuzzle 1.x should support plugins without a kuzzleVersion property set
    this.kuzzleVersion = '>=1.0.0 <2.0.0';

    let raw;
    try {
      raw = require(path.resolve(this.path, 'manifest.json'));
    } catch (e) {
      // @deprecated
      if (fallback !== null) {
        console.warn(`[${this.path}] Plugins without a manifest.json file are deprecated.`);
        fallback(this);
        return this;
      }

      throw new PluginImplementationError(e);
    }

    if (!_.isNil(raw.privileged)) {
      if (typeof raw.privileged !== 'boolean') {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid "privileged" property: expected a boolean, got a ${typeof raw.privileged}`);
      }
      this.privileged = raw.privileged;
    }

    if (!_.isNil(raw.kuzzleVersion)) {
      if (typeof raw.kuzzleVersion !== 'string' || raw.kuzzleVersion.length === 0) {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid "kuzzleVersion" property: expected a non-empty string`);
      }
      this.kuzzleVersion = raw.kuzzleVersion;
    } else {
      console.warn(`[${pluginPath}/manifest.json] No "kuzzleVersion" property found: assuming the target is Kuzzle v1`);
    }

    if (!_.isNil(raw.name)) {
      if (typeof raw.name !== 'string' || raw.name.length === 0) {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid "name" property: expected a non-empty string`);
      }

      // Plugin names are used to create a database index, and those cannot
      // contain upercased caracters. We should also limit the
      // characters set to the standard \w regexp, minus uppercased
      // characters, and with the widely used '-' char
      if (!/^[a-z0-9_-]+$/.test(raw.name)) {
        throw new PluginImplementationError(`[${this.path}/manifest.json] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores`);
      }

      this.name = raw.name;
    } else {
      throw new PluginImplementationError(`[${this.path}/manifest.json] A "name" property is required"`);
    }

    // check for kuzzle core version prerequisite
    if (!semver.satisfies(kuzzle.config.version, this.kuzzleVersion)) {
      throw new PluginImplementationError(`[${this.path}/manifest.json] Version mismatch: current Kuzzle version ${kuzzle.config.version} does not match the plugin requirements (${this.kuzzleVersion})`);
    }

    return this;
  }
}

module.exports = Manifest;
