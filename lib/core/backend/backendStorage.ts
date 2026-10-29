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

import type { JSONObject } from "../../types/JSONObject";

import { createNativeStorageClient } from "../../service/storage/builtInDrivers";
import { ApplicationManager } from "./index";

export class BackendStorage extends ApplicationManager {
  private _client: ReturnType<typeof createNativeStorageClient> | null = null;
  private _Client: BackendStorage["StorageClient"] | null = null;

  /**
   * Storage client constructor.
   * (Currently Elasticsearch)
   *
   * @param clientConfig Overload configuration for the underlaying storage client
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  get StorageClient(): new (clientConfig?: any) => any {
    const kuzzle = this._kuzzle;

    this._Client ??= function ESClient(clientConfig: JSONObject = {}) {
      return createNativeStorageClient(kuzzle.config.services.storageEngine, {
        ...kuzzle.config.services.storageEngine.client,
        ...clientConfig,
      });
    } as unknown as BackendStorage["StorageClient"];

    return this._Client;
  }

  /**
   * Access to the underlaying storage engine client.
   * (Currently Elasticsearch)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  get storageClient(): any {
    const kuzzle = this._kuzzle;

    this._client ??= createNativeStorageClient(
      kuzzle.config.services.storageEngine,
      kuzzle.config.services.storageEngine.client,
    );

    return this._client;
  }
}
