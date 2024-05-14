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
import * as kerror from "../../kerror";
import { cacheDbEnum } from "../cache/cacheDbEnum";

export class ObjectRepository<TObject extends { _id: string }> {
  protected ttl: number;
  protected index: string;
  protected collection: string;
  protected ObjectConstructor: any;
  protected store: any;
  protected cacheDb: cacheDbEnum;

  constructor({ cache = cacheDbEnum.INTERNAL, store = null } = {}) {
    this.ttl = global.kuzzle.config.repositories.common.cacheTTL;
    this.collection = null;
    this.ObjectConstructor = null;
    this.store = store;
    this.index = store ? store.index : global.kuzzle.internalIndex.index;
    this.cacheDb = cache;
  }

  async loadOneFromDatabase(id: string): Promise<TObject> {
    let response;

    try {
      response = await this.store.get(this.collection, id);
    } catch (error) {
      if (error.status === 404) {
        throw kerror.get("services", "storage", "not_found", id);
      }

      throw error;
    }

    if (response._id) {
      const dto = {};

      if (response._source) {
        Object.assign(dto, response._source, { _id: response._id });
      } else {
        Object.assign(dto, response);
      }

      return this.fromDTO(dto);
    }

    return null;
  }

  async loadMultiFromDatabase(ids: string[]): Promise<TObject[]> {
    const { items } = await this.store.mGet(this.collection, ids);

    if (items.length === 0) {
      return [];
    }

    const promises = [];

    for (const item of items) {
      promises.push(
        this.fromDTO({
          ...item._source,
          _id: item._id,
        }),
      );
    }

    const objects = await Promise.all(promises);

    return objects;
  }

  /**
   * Search in database corresponding repository according to a query
   *
   * @param {object} searchBody
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise}
   */
  async search(searchBody, options = {}) {
    const response = await this.store.search(
      this.collection,
      searchBody,
      options,
    );

    return this.formatSearchResults(response);
  }

  /**
   * Scroll over a paginated search request
   */
  async scroll(scrollId: string, ttl?: string | number) {
    const response = await this.store.scroll(scrollId, ttl);

    return this.formatSearchResults(response);
  }

  /**
   * Loads an object from Cache. Returns a promise that resolves either to the
   * retrieved object of null in case it is not found.
   *
   * The opts object currently accepts one optional parameter: key, which forces
   * the cache key to fetch.
   * In case the key is not provided, it defaults to repos/<index>/<collection>/<id>, i.e.: repos/%kuzzle/users/12
   *
   * @param id - The id of the object to get
   * @param options.key - Cache key.
   */
  async loadFromCache(
    id: string,
    options: { key?: string } = {},
  ): Promise<TObject> {
    const key = options.key || this.getCacheKey(id);
    let response;

    try {
      response = await global.kuzzle.ask(`core:cache:${this.cacheDb}:get`, key);

      if (response === null) {
        return null;
      }

      return await this.fromDTO({ ...JSON.parse(response) });
    } catch (err) {
      throw kerror.get("services", "cache", "read_failed", err.message);
    }
  }

  /**
   * Loads an object from Cache or from the Database if not available in Cache.
   * Returns a promise that resolves either to the
   * retrieved object of null in case it is not found.
   *
   * If the object is not found in Cache and found in the Database,
   * it will be written to cache also.
   *
   * The opts object currently accepts one optional parameter: key, which forces
   * the cache key to fetch.
   * In case the key is not provided, it defaults to <collection>/id
   * (e.g. users/12)
   *
   * @param id - The id of the object to get
   * @param options.key - Optional cache key
   */
  async load(id: string, options: { key?: string } = {}): Promise<TObject> {
    if (this.cacheDb === cacheDbEnum.NONE) {
      return this.loadOneFromDatabase(id);
    }

    const object = await this.loadFromCache(id, options);

    if (object === null) {
      if (this.store === null) {
        return null;
      }

      const objectFromDatabase = await this.loadOneFromDatabase(id);

      if (objectFromDatabase !== null) {
        await this.persistToCache(objectFromDatabase);
      }

      return objectFromDatabase;
    }

    await this.refreshCacheTTL(object);

    return object;
  }

  /**
   * Persists the given object in the collection that is attached to the repository.
   *
   * @param object - The object to persist
   * @param options.method -
   * @returns {Promise}
   */
  persistToDatabase(object: TObject, options: any = {}) {
    const method = options.method || "createOrReplace";

    if (method === "create") {
      return this.store.create(
        this.collection,
        this.serializeToDatabase(object),
        { ...options, id: object._id },
      );
    }

    return this.store[method](
      this.collection,
      object._id,
      this.serializeToDatabase(object),
      options,
    );
  }

  /**
   * Given an object with an id, delete it from the configured storage engines
   *
   * @param object - The object to delete
   * @param options.key - if provided, removes the given key instead of the default one (<collection>/<id>)
   */
  async delete(object: TObject, options: any = {}): Promise<void> {
    const promises = [];

    if (this.cacheDb !== cacheDbEnum.NONE) {
      promises.push(this.deleteFromCache(object._id, options));
    }

    if (this.store) {
      promises.push(this.deleteFromDatabase(object._id, options));
    }

    await Promise.all(promises);
  }

  /**
   * Delete repository from database according to its id
   */
  deleteFromDatabase(id: string, options: JSONObject = {}) {
    return this.store.delete(this.collection, id, options);
  }

  /**
   * Persists the given ObjectConstructor object in cache.
   *
   * @param object - The object to persist
   * @param options.key - if provided, stores the object to the given key instead of the default one (<collection>/<id>)
   * @param options.ttl - if provided, overrides the default ttl set on the repository for the current operation
   */
  async persistToCache(
    object: TObject,
    options: { key?: string; ttl?: number } = {},
  ): Promise<TObject> {
    const key = options.key || this.getCacheKey(object._id);
    const value = JSON.stringify(this.serializeToCache(object));
    const ttl = options.ttl ?? this.ttl;

    await global.kuzzle.ask(`core:cache:${this.cacheDb}:store`, key, value, {
      ttl,
    });

    return object;
  }

  /**
   * Removes the object from the Cache Engine
   *
   * @param id
   * @param options.key - if provided, stores the object to the given key instead of the default one (<collection>/<id>)
   */
  async deleteFromCache(id: string, options: { key?: string } = {}) {
    const key = options.key || this.getCacheKey(id);

    await global.kuzzle.ask(`core:cache:${this.cacheDb}:del`, key);
  }

  /**
   * @param object
   * @param options.key - if provided, stores the object to the given key instead of the default one (<collection>/<id>)
   * @param options.ttl - if provided, overrides the default ttl set on the repository for the current operation
   */
  refreshCacheTTL(
    object: JSONObject,
    options: { key?: string; ttl?: number } = {},
  ) {
    const key = options.key || this.getCacheKey(object._id);
    let ttl;

    if (options.ttl !== undefined) {
      ttl = options.ttl;
    } else if (object.ttl !== undefined) {
      // if a TTL has been defined at the entry creation, we should
      // use it
      ttl = object.ttl;
    } else {
      ttl = this.ttl;
    }

    if (ttl > 0) {
      return global.kuzzle.ask(`core:cache:${this.cacheDb}:expire`, key, ttl);
    }

    return global.kuzzle.ask(`core:cache:${this.cacheDb}:persist`, key);
  }

  /**
   * @param object
   * @param options.key - if provided, stores the object to the given key instead of the default one (<collection>/<id>)
   */
  async expireFromCache(object: TObject, options: { key?: string } = {}) {
    const key = options.key || this.getCacheKey(object._id);

    await global.kuzzle.ask(`core:cache:${this.cacheDb}:expire`, key, -1);
  }

  /**
   * Serializes the object before being persisted to cache.
   *
   * @param object - The object to serialize
   */
  serializeToCache(object: TObject) {
    return this.toDTO(object);
  }

  /**
   * Serializes the object before being persisted to the database.
   *
   * @param object - The object to serialize
   */
  serializeToDatabase(object: TObject): Omit<TObject, "_id"> {
    const dto = this.toDTO(object);
    delete dto._id;
    return dto;
  }

  /**
   * @param {string} id
   */
  getCacheKey(id: string): string {
    return `repos/${this.index}/${this.collection}/${id}`;
  }

  /**
   * @param {object} dto
   * @returns {Promise<ObjectConstructor>}
   */
  async fromDTO(dto: JSONObject): Promise<TObject> {
    const o = new this.ObjectConstructor();
    Object.assign(o, dto);

    return o;
  }

  /**
   * @param {ObjectConstructor} o
   * @returns {object}
   */
  toDTO(o: TObject): any {
    return { ...o };
  }

  /**
   * Recursively delete all objects in repository with a scroll
   *
   * @param {object} options - ES options (refresh)
   * @param {object} part
   * @returns {Promise<integer>} total deleted objects
   */
  async truncate(options) {
    // Allows safe overrides, as _truncate is called recursively
    return this._truncate(options);
  }

  /**
   * Do not override this: this function calls itself.
   */
  private async _truncate(options, part = null) {
    if (part === null) {
      const objects = await this.search(
        {},
        { refresh: options.refresh, scroll: "5s", size: 100 },
      );
      const deleted = await this.truncatePart(objects, options);

      if (objects.hits.length < objects.total) {
        const total = await this._truncate(options, {
          fetched: objects.hits.length,
          scrollId: objects.scrollId,
          total: objects.total,
        });

        return deleted + total;
      }

      return deleted;
    }

    const objects = await this.scroll(part.scrollId, "5s");
    const deleted = await this.truncatePart(objects, options);

    part.fetched += objects.hits.length;

    if (part.fetched < part.total) {
      part.scrollId = objects.scrollId;

      const total = await this._truncate(options, part);
      return deleted + total;
    }

    return deleted;
  }

  /**
   * @param {Array} objects
   * @param {object} options
   * @returns {Promise<integer>} count of deleted objects
   */
  private async truncatePart(objects, options) {
    const promises = [];

    const processObject = async (object) => {
      // profile and role repositories have protected objects, we can't delete
      // them
      const protectedObjects =
        ["profiles", "roles"].indexOf(this.collection) !== -1
          ? ["admin", "default", "anonymous"]
          : [];

      if (protectedObjects.indexOf(object._id) !== -1) {
        return 0;
      }

      const loaded = await this.load(object._id);
      await this.delete(loaded, options);

      return 1;
    };

    for (const hit of objects.hits) {
      promises.push(processObject(hit));
    }

    const results = await Promise.all(promises);

    return results.reduce((total, deleted) => total + deleted, 0);
  }

  /**
   * Given a raw search response from ES, returns a {total: int, hits: []} object
   * @param {object} raw
   * @returns {Promise<object>}
   * @private
   */
  private async formatSearchResults(raw) {
    const result = {
      aggregations: raw.aggregations,
      hits: [],
      scrollId: raw.scrollId,
      total: raw.total,
    };

    if (raw.hits && raw.hits.length > 0) {
      const promises = [];

      for (const hit of raw.hits) {
        promises.push(
          this.fromDTO({
            ...hit._source,
            _id: hit._id,
          }),
        );
      }

      result.hits = await Promise.all(promises);
    }

    return result;
  }
}
