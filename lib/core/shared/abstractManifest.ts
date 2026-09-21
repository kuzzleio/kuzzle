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

import type { JSONObject } from "kuzzle-sdk";
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

  /**
   * Reads and validates the manifest, and answers the two fields it
   * establishes.
   *
   * Returning them is what lets a caller use them as strings: the fields stay
   * nullable because they are null until this runs, and `plugin.ts` reads
   * them through `?.` for exactly that reason.
   */
  load(): { kuzzleVersion: string; name: string } {
    // Read into a local: `this.raw` is the nullable field, and the six checks
    // below each re-read it.
    let raw: JSONObject;

    try {
      // The manifest of a plugin or protocol loaded from disk: the path is
      // only known at runtime.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      raw = require(this.manifestPath);
    } catch (e) {
      throw kerror.get("cannot_load", this.manifestPath, (e as Error).message);
    }

    this.raw = raw;

    if (isNil(raw.kuzzleVersion)) {
      throw kerror.get("missing_version", this.manifestPath);
    }

    const kuzzleVersion: string = raw.kuzzleVersion;

    this.kuzzleVersion = kuzzleVersion;

    if (
      !semver.satisfies(global.kuzzle.config.version, kuzzleVersion, {
        includePrerelease: true,
      })
    ) {
      throw kerror.get(
        "version_mismatch",
        this.path,
        global.kuzzle.config.version,
        kuzzleVersion,
      );
    }

    if (isNil(raw.name)) {
      throw kerror.get("missing_name", this.manifestPath);
    }

    if (typeof raw.name !== "string" || raw.name.length === 0) {
      throw kerror.get("invalid_name_type", this.manifestPath);
    }

    this.name = raw.name;

    return { kuzzleVersion, name: raw.name };
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
