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
  AbstractManifest = require('../../abstractManifest');

class Manifest extends AbstractManifest {
  constructor(kuzzle, pluginPath, protocol) {
    super(kuzzle, pluginPath);
    this.protocol = protocol;
  }

  load() {
    // @deprecated - there will be no fallback if no manifest.json file can be found
    try {
      fs.accessSync(this.manifestPath, fs.constants.R_OK);
    } catch (e) {
      if (this.protocol.protocol) {
        // eslint-disable-next-line no-console
        console.warn(`[${this.path}] Protocols without a manifest.json file are deprecated.`);
        this.name = this.protocol.protocol;
        return;
      }
      // else let the parent class throw its own exception
    }

    super.load();
  }
}

module.exports = Manifest;
