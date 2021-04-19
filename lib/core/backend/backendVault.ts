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

import vault from '../../kuzzle/vault';
import kerror from '../../kerror';
import { JSONObject } from '../../../index';
import { ApplicationManager } from './index';

const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendVault extends ApplicationManager {
  private decrypted = false;
  private _secrets: JSONObject;

  /**
   * Secret key to decrypt encrypted secrets.
   */
  set key (key: string) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'vault');
    }

    this._application._vaultKey = key;
  }

  /**
   * File containing encrypted secrets
   */
  set file (file: string) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'vault');
    }

    this._application._secretsFile = file;
  }

  /**
   * Decrypted secrets
   */
  get secrets () : JSONObject {
    // We need to load the secrets before Kuzzle start so we can use them
    // in the configuration (e.g. configure ES X-Pack credentials)
    if (! this._application.started && ! this.decrypted) {
      const kuzzleVault = vault.load(this._application._vaultKey, this._application._secretsFile);
      this._secrets = kuzzleVault.secrets;
    }

    if (this._application.started) {
      return this._kuzzle.vault.secrets;
    }

    return this._secrets;
  }
}