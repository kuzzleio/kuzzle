/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
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

import Service from "../service";
import type { storeScopeEnum } from "../../core/storage/storeScopeEnum";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageDriver,
  StorageDriverClass,
} from "../../types/storage/StorageDriver";

/**
 * One storage scope's driver instance, initialized under
 * `services.storageEngine`'s init timeout like every service.
 */
export class StorageService extends Service<StorageEngineElasticsearch> {
  public readonly driver: StorageDriver;

  constructor(
    Driver: StorageDriverClass<unknown, StorageEngineElasticsearch>,
    config: StorageEngineElasticsearch,
    scope: storeScopeEnum,
  ) {
    // The name the init timeout error reports, unchanged since the storage
    // engine was Elasticsearch only.
    super("elasticsearch", config);

    this.driver = new Driver(config, scope);
  }

  protected _initSequence(): Promise<void> {
    return this.driver.init();
  }
}
