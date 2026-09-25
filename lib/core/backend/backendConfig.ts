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

import _ from "lodash";

import * as kerror from "../../kerror";
import type { Backend } from "./index";
import { ApplicationManager } from "./index";
import type {
  IKuzzleConfiguration,
  KuzzleConfigurationOverrides,
} from "../../types/config/KuzzleConfiguration";
import { loadConfig } from "../../config/index";

const runtimeError = kerror.wrap("plugin", "runtime");

/**
 * `content` is declared here, as an accessor pair, rather than as a field of
 * the class: read, it is the whole configuration, which it is once loaded;
 * assigned, it takes a `Partial` one, which is what v2.56.0 declared it as.
 * Code compiled against that assigns one, and must still compile; reads no
 * longer need `?.` at every level. At runtime it is the plain property the
 * constructor assigns, as it always was — an interface adds no accessor.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- see above: types only, the class declares no `content`
export interface BackendConfig {
  /**
   * Configuration content.
   */
  get content(): IKuzzleConfiguration;
  set content(content: Partial<IKuzzleConfiguration>);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- see the interface above
export class BackendConfig extends ApplicationManager {
  constructor(application: Backend) {
    super(application);

    this.content = loadConfig();
  }

  /**
   * Sets a configuration value
   *
   * @deprecated use app.config.content instead
   *
   * @param path - Path to the configuration key (lodash style)
   * @param value - Value for the configuration key
   */
  set(path: string, value: any) {
    if (this._application.started) {
      throw runtimeError.get("already_started", "config");
    }

    _.set(this.content, path, value);
  }

  /**
   * Merges a configuration object into the current configuration
   *
   * @deprecated use app.config.content instead
   *
   * @param config - Configuration object to merge
   */
  merge(config: KuzzleConfigurationOverrides) {
    if (this._application.started) {
      throw runtimeError.get("already_started", "config");
    }

    this.content = _.merge(this.content, config);
  }
}
