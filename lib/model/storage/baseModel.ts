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

import Bluebird from "bluebird";
import { JSONObject } from "kuzzle-sdk";

/**
 * Minimal shape of a model class handled by {@link BaseModel.register}.
 */
interface RegisterableModel {
  fields: string[];
  prototype: object;
}

/**
 * Plain document shape as stored/returned by the internal index.
 */
interface StorageDocument {
  _id: string;
  _source: JSONObject;
}

class BaseModel {
  __id: string | null;
  __source: JSONObject;
  declare __persisted: boolean;

  constructor(_source: JSONObject = {}, _id: string | null = null) {
    this.__id = null;
    this.__source = {};

    Reflect.defineProperty(this, "__persisted", {
      value: false,
      writable: true,
    });

    this._id = _id;
    this._source = _source;
  }

  // static private methods ====================================================

  /**
   * Register a new model
   *
   * @param ModelClass
   */
  static register(ModelClass: RegisterableModel): void {
    if (this !== BaseModel) {
      throw new Error("Incorrect usage of BaseModel.register");
    }

    // Define getters and setters for Model fields
    for (const field of ModelClass.fields) {
      Reflect.defineProperty(ModelClass.prototype, field, {
        get() {
          return this.__source[field];
        },
        set(value) {
          this.__source[field] = value;
        },
      });
    }
  }

  // Public methods ============================================================

  /**
   * Save the current instance in the database.
   *  - use update if the instance already exists
   *  - use create otherwise
   *
   * @param options - userId (null), refresh (undefined)
   */
  async save({
    userId = null,
    refresh,
  }: {
    userId?: string | null;
    refresh?: boolean | string;
  } = {}): Promise<void> {
    if (!this.__persisted) {
      const { _id, _source } = await global.kuzzle.internalIndex.create(
        (this.constructor as typeof BaseModel).collection,
        this._source,
        { id: this._id, refresh, userId },
      );

      this._id = _id;
      this._source = _source;
      this.__persisted = true;
    } else {
      await global.kuzzle.internalIndex.update(
        (this.constructor as typeof BaseModel).collection,
        this._id,
        this._source,
        { refresh, userId },
      );
    }
  }

  /**
   * Delete the current instance from the database.
   *  - call the _afterDelete hook after deletion
   *
   * @param options - refresh (undefined)
   */
  async delete({
    refresh,
  }: { refresh?: boolean | string } = {}): Promise<void> {
    if (!this.__persisted) {
      return;
    }

    await global.kuzzle.internalIndex.delete(
      (this.constructor as typeof BaseModel).collection,
      this._id,
      { refresh },
    );

    await this._afterDelete();

    this.__persisted = false;
  }

  /**
   * Returns a plain object representing the instance
   */
  serialize(): { _id: string | null; _source: JSONObject } {
    return {
      _id: this._id,
      _source: this._source,
    };
  }

  // Protected methods =========================================================

  /**
   * Hook called in the delete method after deletion from the database
   */
  async _afterDelete(): Promise<void> {
    return null;
  }

  // Getter/Setter =============================================================

  get _id(): string | null {
    return this.__id;
  }

  set _id(_id: string | null) {
    this.__id = _id;
  }

  get _source(): JSONObject {
    return this.__source;
  }

  set _source(_source: JSONObject) {
    for (const key of Object.keys(_source)) {
      if ((this.constructor as typeof BaseModel).fields.includes(key)) {
        this.__source[key] = _source[key];
      }
    }
  }

  // Static public methods =====================================================

  /**
   * Loads an instance from the database
   *
   * @param id
   */
  static async load(id: string): Promise<BaseModel> {
    const result = await global.kuzzle.internalIndex.get(this.collection, id);

    return this._instantiateFromDb(result);
  }

  /**
   * Deletes all instances matching the given query.
   *  - the instance delete method will be called on each occurence
   *
   * @param query - Search query (e.g. { match_all: {} })
   * @param options - refresh (undefined)
   */
  static async deleteByQuery(
    query: JSONObject,
    { refresh }: { refresh?: boolean | string } = {},
  ): Promise<void> {
    const { documents } = await global.kuzzle.internalIndex.deleteByQuery(
      this.collection,
      query,
    );

    await Bluebird.map(
      documents,
      (document) =>
        this._instantiateFromDb(document as StorageDocument)._afterDelete(),
      { concurrency: 10 },
    ); // limits the load on storage services

    if (refresh) {
      await global.kuzzle.internalIndex.refreshCollection(this.collection);
    }
  }

  /**
   * Returns instances matching the given query
   *
   * @param searchBody
   * @param options - from, size, scroll
   *
   * @returns Array of instances
   */
  static async search(
    searchBody: JSONObject,
    options?: JSONObject,
  ): Promise<BaseModel[]> {
    const resp = await global.kuzzle.internalIndex.search(
      this.collection,
      searchBody,
      options,
    );
    return resp.hits.map((hit) => this._instantiateFromDb(hit));
  }

  /**
   * Deletes all instances of the collection
   *
   * @param options - refresh (undefined)
   */
  static truncate({
    refresh,
  }: { refresh?: boolean | string } = {}): Promise<void> {
    return this.deleteByQuery({ match_all: {} }, { refresh });
  }
  // ? This looks not in use anymore ?
  static batchExecute(
    query: JSONObject,
    callback: (...args: unknown[]) => unknown,
  ) {
    return global.kuzzle.internalIndex.mExecute(
      this.collection,
      query,
      callback,
    );
  }

  /**
   * Must be overriden by children
   */
  static get collection(): string {
    throw new Error("Model.collection must be defined");
  }

  /**
   * Must be overriden by children
   */
  static get fields(): string[] {
    throw new Error("Model.fields must be defined");
  }

  // Static protected methods ==================================================

  /**
   * Instantiate the model from a document
   *
   * @param document - { _id, _source }
   */
  static _instantiateFromDb({ _id, _source }: StorageDocument): BaseModel {
    const model = new this(_source, _id); // NOSONAR

    model.__persisted = true;

    return model;
  }
}

export = BaseModel;
