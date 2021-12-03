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

import _ from 'lodash';

import kerror from '../../kerror';
import kuzzleConfig from '../../config';
import { JSONObject } from '../../../index';
import { ApplicationManager, Backend } from './index';
import { KuzzleConfiguration } from '../../types/config/KuzzleConfiguration';
import config from '../../config/defaultTsConfig';
import { load } from '../../config/index.js'

const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendConfig extends ApplicationManager {
  /**
   * Configuration content
   */
  public content: KuzzleConfiguration;

  constructor (application: Backend) {
    super(application);

    this.content = load();
  }

  /**
   * Sets a configuration value
   *
   * @param path - Path to the configuration key (lodash style)
   * @param value - Value for the configuration key
   */
  set (path: string, value: any) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'config');
    }

    _.set(this.content, path, value);
  }

  /**
   * Merges a configuration object into the current configuration
   *
   * @param config - Configuration object to merge
   */
  merge (config: KuzzleConfiguration) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'config');
    }

    this.content = _.merge(this.content, config);
  }
}