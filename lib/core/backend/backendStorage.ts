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

import { Client } from "@elastic/elasticsearch";

import { Elasticsearch } from "../../service/storage/elasticsearch";
import { JSONObject } from "../../../index";
import { ApplicationManager, Backend } from "./index";

export class BackendStorage extends ApplicationManager {
  private _client: Client = null;
  private _Client: new (clientConfig?: any) => Client = null;

  constructor(application: Backend) {
    super(application);
  }

  /**
   * Storage client constructor.
   * (Currently Elasticsearch)
   *
   * @param clientConfig Overload configuration for the underlaying storage client
   */
  get StorageClient(): new (clientConfig?: any) => Client {
    if (!this._Client) {
      const kuzzle = this._kuzzle;

      this._Client = function ESClient(clientConfig: JSONObject = {}) {
        return Elasticsearch.buildClient({
          ...kuzzle.config.services.storageEngine.client,
          ...clientConfig,
        });
      } as any;
    }

    return this._Client;
  }

  /**
   * Access to the underlaying storage engine client.
   * (Currently Elasticsearch)
   */
  get storageClient(): Client {
    if (!this._client) {
      this._client = Elasticsearch.buildClient(
        this._kuzzle.config.services.storageEngine.client
      );
    }
    return this._client;
  }
}
