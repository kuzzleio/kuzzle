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

import { JSONObject } from "kuzzle-sdk";
import { merge } from "lodash";

import { NotFoundError } from "../../kerror/errors";
import { cacheDbEnum } from "../cache/cacheDbEnum";
import { ObjectRepository } from "../shared/ObjectRepository";

/**
 * A plugin's private-storage document.
 *
 * `ObjectRepository` requires `_id` on its type parameter, but the plugin-facing
 * `Repository` contract passes a bare `JSONObject` — a document being created
 * legitimately has no id yet. The public methods below therefore take
 * `JSONObject` and assert the shape at the one place the base needs it, which
 * is also exactly where the runtime has always read `object._id`.
 */
type PluginDocument = JSONObject & { _id: string };

interface PluginRepositoryOptions {
  ObjectConstructor?: new () => unknown;
}

class PluginRepository extends ObjectRepository<PluginDocument> {
  constructor(store: unknown, collection: string) {
    super({ cache: cacheDbEnum.NONE, store });

    this.collection = collection;
    this.ObjectConstructor = Object;
  }

  init(options?: PluginRepositoryOptions): void {
    if (options && typeof options === "object" && !Array.isArray(options)) {
      if (options.ObjectConstructor) {
        this.ObjectConstructor = options.ObjectConstructor;
      }
    }
  }

  /**
   * Serializes the object before being persisted to database.
   */
  serializeToDatabase(data: PluginDocument): JSONObject {
    // avoid the data var mutation
    const result = merge({}, data);

    delete result._id;

    return result;
  }

  create(object: JSONObject, options: JSONObject = {}) {
    return this.persistToDatabase(object as PluginDocument, {
      method: "create",
      ...options,
    });
  }

  createOrReplace(object: JSONObject, options: JSONObject = {}) {
    return this.persistToDatabase(object as PluginDocument, {
      method: "createOrReplace",
      ...options,
    });
  }

  replace(object: JSONObject, options: JSONObject = {}) {
    return this.persistToDatabase(object as PluginDocument, {
      method: "replace",
      ...options,
    });
  }

  update(object: JSONObject, options: JSONObject = {}) {
    return this.persistToDatabase(object as PluginDocument, {
      method: "update",
      ...options,
    });
  }

  /**
   * If we load a user that does not exists, we have to resolve the promise with
   * null instead of throwing NotFoundError
   */
  load(documentId: string): Promise<PluginDocument> {
    return super.load(documentId).catch((error) => {
      if (this.collection === "users" && error instanceof NotFoundError) {
        return null;
      }

      throw error;
    });
  }

  /**
   * Unlike its base, this one deletes by id — the shape a plugin holds.
   */
  delete(
    documentId: string | PluginDocument,
    options: JSONObject = {},
  ): Promise<void> {
    const _id = typeof documentId === "string" ? documentId : documentId._id;

    return super.delete({ _id }, options);
  }
}

export = PluginRepository;
