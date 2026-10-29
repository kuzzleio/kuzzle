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

// The built-in Elasticsearch 7 and 8 drivers (ADR-0003 step 02): today's
// classes as they are, plus the two members of the `StorageDriver` contract
// they lack. Extracted to their own packages at the next major.

import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { ES7 } from "./7/elasticsearch";
import { ES8 } from "./8/elasticsearch";
import type { JSONObject } from "../../types/JSONObject";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageDriver,
  StorageDriverClass,
} from "../../types/storage/StorageDriver";

export class ES7Driver extends ES7 implements StorageDriver {
  static createNativeClient(clientConfig: JSONObject): ClientES7 {
    return new ClientES7(clientConfig);
  }

  init(): Promise<void> {
    return this._initSequence();
  }
}

export class ES8Driver extends ES8 implements StorageDriver {
  static createNativeClient(clientConfig: JSONObject): ClientES8 {
    return new ClientES8(clientConfig);
  }

  init(): Promise<void> {
    return this._initSequence();
  }
}

/** The built-in driver of an Elasticsearch major version */
export function builtInStorageDriver(
  majorVersion: StorageEngineElasticsearch["majorVersion"],
): StorageDriverClass<ClientES7 | ClientES8, StorageEngineElasticsearch> {
  switch (majorVersion) {
    case "7":
      return ES7Driver;
    case "8":
      return ES8Driver;
    default:
      throw new Error("Invalid Elasticsearch version.");
  }
}
