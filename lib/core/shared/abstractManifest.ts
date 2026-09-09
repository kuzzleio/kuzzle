/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import { JSONObject } from "kuzzle-sdk";
import { isNil } from "lodash";
import * as path from "node:path";
import * as semver from "semver";

import { wrap } from "../../kerror";
import "../../types/Global";

const kerror = wrap("plugin", "manifest");

/**
 * Abstract class used to load a manifest.json file.
 * Used as a base for plugins and protocols.
 *
 * @param {Kuzzle} kuzzle       - Kuzzle instance
 * @param {string} pluginPath   - Absolute path to the plugin directory
 */
class AbstractManifest {
  public path: string;
  public manifestPath: string;
  public name: string | null;
  public kuzzleVersion: string | null;
  public raw: JSONObject | null;

  constructor(pluginPath: string) {
    this.path = pluginPath;

    this.manifestPath = path.resolve(this.path, "manifest.json");
    this.name = null;
    this.kuzzleVersion = null;
    this.raw = null;
  }

  load() {
    try {
      this.raw = require(this.manifestPath);
    } catch (e) {
      throw kerror.get("cannot_load", this.manifestPath, (e as Error).message);
    }

    if (isNil(this.raw.kuzzleVersion)) {
      throw kerror.get("missing_version", this.manifestPath);
    }

    this.kuzzleVersion = this.raw.kuzzleVersion;

    if (
      !semver.satisfies(global.kuzzle.config.version, this.kuzzleVersion, {
        includePrerelease: true,
      })
    ) {
      throw kerror.get(
        "version_mismatch",
        this.path,
        global.kuzzle.config.version,
        this.kuzzleVersion,
      );
    }

    if (!isNil(this.raw.name)) {
      if (typeof this.raw.name !== "string" || this.raw.name.length === 0) {
        throw kerror.get("invalid_name_type", this.manifestPath);
      }

      this.name = this.raw.name;
    } else {
      throw kerror.get("missing_name", this.manifestPath);
    }
  }

  /**
   * This object can be stringified and exported, most notably by the
   * server:info API action
   * It's important that only relevant properties are stringified, to
   * prevent circular JSONs (especially with the kuzzle object ref) and
   * to prevent leaking important information
   *
   * @returns {Object}
   */
  toJSON(): JSONObject {
    return {
      kuzzleVersion: this.kuzzleVersion,
      name: this.name,
      path: this.path,
    };
  }
}

export = AbstractManifest;
