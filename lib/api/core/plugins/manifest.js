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
  { PluginImplementationError } = require('kuzzle-common-objects').errors,
  path = require('path'),
  fs = require('fs'),
  AbstractManifest = require('../abstractManifest');

class Manifest extends AbstractManifest {
  load() {
    let fallback = false;

    // @deprecated - there will be no fallback if no manifest.json file can be found
    try {
      fs.accessSync(this.manifestPath, fs.constants.R_OK);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.path}] Plugins without a manifest.json file are deprecated.`);
      fallback = true;
      this.fallback();
    }

    if (!fallback) {
      super.load();
    }

    // Plugin names are used to create a database index, and those cannot
    // contain upercased caracters. We should also limit the
    // characters set to the standard \w regexp, minus uppercased
    // characters, and with the widely used '-' char
    if (!/^[a-z0-9_-]+$/.test(this.name)) {
      throw new PluginImplementationError(`[${this.path}] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores`);
    }
  }

  fallback() {
    let packageJson;

    try {
      packageJson = require(path.resolve(this.path, 'package.json'));
    }
    catch(e) {
      throw new PluginImplementationError(`[${this.path}] No package.json file found.`);
    }

    if (typeof packageJson.name !== 'string' || !packageJson.name.length) {
      throw new PluginImplementationError(`[${this.path}] No "name" property provided in package.json`);
    }

    // We need to ignore the case of plugin names while checking for name conflicts,
    // because we have to lowercase the name of the plugin to create a dedicated
    // Elasticsearch index.
    this.name = packageJson.name.toLowerCase();
  }
}

module.exports = Manifest;
