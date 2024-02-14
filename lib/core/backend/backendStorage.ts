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

import { Elasticsearch } from "../../service/storage/Elasticsearch";
import { JSONObject } from "../../../index";
import { ApplicationManager } from "./index";

export class BackendStorage extends ApplicationManager {
  private _client: any = null;
  private _Client: new (clientConfig?: any) => any = null;

  /**
   * Storage client constructor.
   * (Currently Elasticsearch)
   *
   * @param clientConfig Overload configuration for the underlaying storage client
   */
  get StorageClient(): new (clientConfig?: any) => any {
    if (!this._Client) {
      this._Client = function ESClient(clientConfig: JSONObject = {}) {
        return this.getElasticsearchClient(clientConfig);
      } as unknown as new (clientConfig?: any) => any;
    }

    return this._Client;
  }

  /**
   * Access to the underlaying storage engine client.
   * (Currently Elasticsearch)
   */
  get storageClient(): any {
    if (!this._client) {
      this._client = this.getElasticsearchClient();
    }

    return this._client;
  }

  getElasticsearchClient(clientConfig?: JSONObject): any {
    return Elasticsearch.buildClient(
      { ...this._kuzzle.config.services.storageEngine.client, ...clientConfig },
      this._kuzzle.config.services.storageEngine.majorVersion,
    );
  }
}
