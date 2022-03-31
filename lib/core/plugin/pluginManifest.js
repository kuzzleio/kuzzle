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

const _ = require('lodash');

const kerror = require('../../kerror').wrap('plugin', 'manifest');
const AbstractManifest = require('../shared/abstractManifest');

class PluginManifest extends AbstractManifest {
  constructor (pluginPath) {
    super(pluginPath);
    this.privileged = false;
  }

  load () {
    super.load();

    // Ensure ES will accept the plugin name as index
    if (! /^[\w-]+$/.test(this.name)) {
      throw kerror.get('invalid_name', this.path);
    }

    if (! _.isNil(this.raw) && ! _.isNil(this.raw.privileged)) {
      if (typeof this.raw.privileged !== 'boolean') {
        throw kerror.get(
          'invalid_privileged',
          this.path,
          typeof this.raw.privileged);
      }
      this.privileged = this.raw.privileged;
    }
  }
}

module.exports = PluginManifest;
