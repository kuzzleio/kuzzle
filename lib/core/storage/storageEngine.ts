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

import { ClientAdapter } from "./clientAdapter";
import { VirtualIndex } from "../../service/storage/virtualIndex";
import { scopeEnum } from "./storeScopeEnum";

import * as kuzzleError from "../../kerror";
const kerror = kuzzleError.wrap("services", "storage");

export class StorageEngine {
  publicClient: ClientAdapter = null;
  privateClient: ClientAdapter = null;
  virtualIndex: VirtualIndex;

  get public(){
    return this.publicClient;
  }

  get private(){
    return this.privateClient;
  }

  // to be mocked in Unit Test
  static initClientAdapters(scopeEnum : string, virtualIndex: VirtualIndex){
    return new ClientAdapter( scopeEnum, virtualIndex);
  }

  constructor(virtualIndex: VirtualIndex) {
    this.virtualIndex = virtualIndex;

    // Storage client for public indexes only
    this.publicClient = StorageEngine.initClientAdapters(scopeEnum.PUBLIC, this.virtualIndex);

    // Storage client for private indexes only
    this.privateClient = StorageEngine.initClientAdapters(
      scopeEnum.PRIVATE,
      this.virtualIndex
    );
  }

  /**
   * Initialize storage clients and perform integrity checks
   *
   * @returns {Promise}
   */
  async init() {
    await Promise.all([this.publicClient.init(), this.privateClient.init()]);

    const privateIndexes = await this.privateClient.cache.listIndexes();

    for (const publicIndex of await this.publicClient.cache.listIndexes()) {
      if (privateIndexes.includes(publicIndex)) {
        throw kerror.get("index_already_exists", "public", publicIndex);
      }
    }
    global.kuzzle.log.info("[✔] Storage initialized");
  }

  async initAfterCluster() {
    await Promise.all([
      this.publicClient.initAfterCluster(),
      this.privateClient.initAfterCluster(),
    ]);
  }
}
