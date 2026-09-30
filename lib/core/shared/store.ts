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

import * as kerror from "../../kerror";
import type { StoreCollectionsDefinition } from "../../types";
import { promiseAllN } from "../../util/async";
import { getESIndexDynamicSettings } from "../../util/esRequest";
import { Mutex } from "../../util/mutex";
import type { storeScopeEnum } from "../storage/storeScopeEnum";

/**
 * The store methods that are nothing but an ask on a
 * `core:storage:<scope>:<suffix>` event taking the index as its first
 * argument, mapped to that suffix.
 *
 * The constructor's loop is driven by this map, so the 23 `core:storage:` event
 * strings are written once rather than once per method. `multiSearch` and
 * `scroll` are deliberately absent: they are the two that do not take the
 * index, and the constructor assigns them by hand.
 */
const INDEXED_ASK_SUFFIXES = {
  count: "document:count",
  create: "document:create",
  createCollection: "collection:create",
  createOrReplace: "document:createOrReplace",
  delete: "document:delete",
  deleteByQuery: "document:deleteByQuery",
  deleteCollection: "collection:delete",
  deleteFields: "document:deleteFields",
  deleteIndex: "index:delete",
  exists: "document:exist",
  get: "document:get",
  getMapping: "mappings:get",
  getSettings: "collection:settings:get",
  mExecute: "document:mExecute",
  mGet: "document:mGet",
  refreshCollection: "collection:refresh",
  replace: "document:replace",
  search: "document:search",
  truncateCollection: "collection:truncate",
  update: "document:update",
  updateByQuery: "document:updateByQuery",
  updateCollection: "collection:update",
  updateMapping: "mappings:update",
} as const;

type StoreAskMethod = (...args: any[]) => Promise<any>;

/**
 * Wrapper around the document store.
 * Once instantiated, this class can only access the index passed in the
 * constructor
 */
export class Store {
  /**
   * Every member below up to `updateMapping` is written by the constructor
   * through `Reflect.set` over `INDEXED_ASK_SUFFIXES`, which no annotation
   * makes visible to the compiler — hence the definite-assignment assertions.
   * Adding a name here without adding it there yields `undefined is not a
   * function` at the first call, which is what the shared suffix map exists to
   * make unlikely.
   */
  public count!: StoreAskMethod;
  public create!: StoreAskMethod;
  public createCollection!: StoreAskMethod;
  public createOrReplace!: StoreAskMethod;
  public delete!: StoreAskMethod;
  public deleteByQuery!: StoreAskMethod;
  public deleteCollection!: StoreAskMethod;
  public deleteFields!: StoreAskMethod;
  public deleteIndex!: StoreAskMethod;
  public exists!: StoreAskMethod;
  public get!: StoreAskMethod;
  public getMapping!: StoreAskMethod;
  public getSettings!: StoreAskMethod;
  public mExecute!: StoreAskMethod;
  public mGet!: StoreAskMethod;
  public refreshCollection!: StoreAskMethod;
  public replace!: StoreAskMethod;
  public search!: StoreAskMethod;
  public truncateCollection!: StoreAskMethod;
  public update!: StoreAskMethod;
  public updateByQuery!: StoreAskMethod;
  public updateCollection!: StoreAskMethod;
  public updateMapping!: StoreAskMethod;

  // The two that do NOT take the index, and are therefore assigned directly.
  public multiSearch: StoreAskMethod;
  public scroll: StoreAskMethod;

  public index: string;
  public scope: storeScopeEnum;

  /**
   * `protected`, and not `readonly`: `InternalIndexHandler` has always
   * replaced it with a child logger of its own in its constructor. The
   * JavaScript could do that through a `private` declaration; saying so is
   * what lets the subclass compile.
   */
  protected logger = global.kuzzle.log.child("core:shared:store");

  constructor(index: string, scope: storeScopeEnum) {
    this.index = index;
    this.scope = scope;

    for (const [method, suffix] of Object.entries(INDEXED_ASK_SUFFIXES)) {
      const event = `core:storage:${scope}:${suffix}`;

      // `method` is a runtime key over the mapping above, so a plain
      // `this[method] = ...` cannot be typed without an index signature that
      // would swallow every real member — the trade-off TD-28 settled with
      // `Reflect.set` in `memoryStorageController` and `baseController`.
      Reflect.set(this, method, (...args: any[]) =>
        global.kuzzle.ask(event, this.index, ...args),
      );
    }

    // the scroll and multiSearch method are special: they doesn't need an index parameter
    // we keep them for ease of use
    this.scroll = (scrollId: string, opts: any) =>
      global.kuzzle.ask(
        `core:storage:${scope}:document:scroll`,
        scrollId,
        opts,
      );

    this.multiSearch = (targets: any, searchBody: any, opts: any) =>
      global.kuzzle.ask(
        `core:storage:${scope}:document:multiSearch`,
        targets,
        searchBody,
        opts,
      );
  }

  /**
   * Initialize the index, and creates provided collections
   */
  async init(collections: StoreCollectionsDefinition = {}): Promise<void> {
    const creatingMutex = new Mutex(`Store.init(${this.index})`, {
      timeout: 0,
      ttl: 30000,
    });

    if (await creatingMutex.lock()) {
      try {
        await this.createCollections(collections, {
          indexCacheOnly: false,
        });
      } finally {
        await creatingMutex.unlock();
      }
    } else {
      await creatingMutex.wait({ timeout: -1 });

      await this.createCollections(collections, {
        indexCacheOnly: true,
      });
    }
  }

  /**
   * Creates collections with the provided mappings
   *
   * @param {Object} collections - collections with mappings
   *
   * @returns {Promise}
   */
  createCollections(
    collections: StoreCollectionsDefinition,
    { indexCacheOnly = false } = {},
  ): Promise<any> {
    return promiseAllN(
      Object.entries(collections).map(([collection, config]) => async () => {
        // @deprecated
        if (!(config.mappings !== undefined && config.settings !== undefined)) {
          // @deprecated
          return global.kuzzle.ask(
            `core:storage:${this.scope}:collection:create`,
            this.index,
            collection,
            { mappings: config },
            { indexCacheOnly },
          );
        }

        // @deprecated
        const isConfigDeprecated =
          config.settings.number_of_shards === undefined &&
          config.settings.number_of_replicas === undefined;

        if (indexCacheOnly) {
          return global.kuzzle.ask(
            `core:storage:${this.scope}:collection:create`,
            this.index,
            collection,
            // @deprecated
            isConfigDeprecated ? { mappings: config.mappings } : config,
            { indexCacheOnly },
          );
        }

        const exist = await global.kuzzle.ask(
          `core:storage:${this.scope}:collection:exist`,
          this.index,
          collection,
        );

        if (exist) {
          // @deprecated
          const dynamicSettings = isConfigDeprecated
            ? null
            : getESIndexDynamicSettings(config.settings);

          const existingSettings = await global.kuzzle.ask(
            `core:storage:${this.scope}:collection:settings:get`,
            this.index,
            collection,
          );

          if (
            !isConfigDeprecated &&
            parseInt(existingSettings.number_of_shards) !==
              config.settings.number_of_shards
          ) {
            if (global.NODE_ENV === "development") {
              throw kerror.get(
                "storage",
                "wrong_collection_number_of_shards",
                collection,
                this.index,
                this.scope,
                "number_of_shards",
                config.settings.number_of_shards,
                existingSettings.number_of_shards,
              );
            }
            this.logger.warn(
              `Attempt to recreate an existing collection ${collection} of index ${this.index} of scope ${this.scope} with non matching static setting : number_of_shards at ${config.settings.number_of_shards} while existing one is at ${existingSettings.number_of_shards}`,
            );
          }

          return global.kuzzle.ask(
            `core:storage:${this.scope}:collection:create`,
            this.index,
            collection,
            // @deprecated
            isConfigDeprecated
              ? { mappings: config.mappings }
              : { mappings: config.mappings, settings: dynamicSettings },
            { indexCacheOnly: true },
          );
        }

        return global.kuzzle.ask(
          `core:storage:${this.scope}:collection:create`,
          this.index,
          collection,
          // @deprecated
          isConfigDeprecated ? { mappings: config.mappings } : config,
          { indexCacheOnly },
        );
      }),
      10,
    );
  }
}
