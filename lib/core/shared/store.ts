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
import { StoreCollectionsDefinition } from "../../types";
import { promiseAllN } from "../../util/async";
import { getESIndexDynamicSettings } from "../../util/esRequest";
import { Mutex } from "../../util/mutex";
import { storeScopeEnum } from "../storage/storeScopeEnum";

/**
 * Wrapper around the document store.
 * Once instantiated, this class can only access the index passed in the
 * constructor
 */
export class Store {
  public count: (...args: any[]) => Promise<any>;
  public create: (...args: any[]) => Promise<any>;
  public createCollection: (...args: any[]) => Promise<any>;
  public createOrReplace: (...args: any[]) => Promise<any>;
  public delete: (...args: any[]) => Promise<any>;
  public deleteByQuery: (...args: any[]) => Promise<any>;
  public deleteCollection: (...args: any[]) => Promise<any>;
  public deleteFields: (...args: any[]) => Promise<any>;
  public deleteIndex: (...args: any[]) => Promise<any>;
  public exists: (...args: any[]) => Promise<any>;
  public get: (...args: any[]) => Promise<any>;
  public getMapping: (...args: any[]) => Promise<any>;
  public getSettings: (...args: any[]) => Promise<any>;
  public mExecute: (...args: any[]) => Promise<any>;
  public mGet: (...args: any[]) => Promise<any>;
  public multiSearch: (...args: any[]) => Promise<any>;
  public refreshCollection: (...args: any[]) => Promise<any>;
  public replace: (...args: any[]) => Promise<any>;
  public search: (...args: any[]) => Promise<any>;
  public scroll: (...args: any[]) => Promise<any>;
  public truncateCollection: (...args: any[]) => Promise<any>;
  public update: (...args: any[]) => Promise<any>;
  public updateByQuery: (...args: any[]) => Promise<any>;
  public updateCollection: (...args: any[]) => Promise<any>;
  public updateMapping: (...args: any[]) => Promise<any>;

  public index: string;
  public scope: storeScopeEnum;

  private readonly logger = global.kuzzle.log.child("core:shared:store");

  constructor(index: string, scope: storeScopeEnum) {
    this.index = index;
    this.scope = scope;

    const methodsMapping: Record<string, string> = {
      count: `core:storage:${scope}:document:count`,
      create: `core:storage:${scope}:document:create`,
      createCollection: `core:storage:${scope}:collection:create`,
      createOrReplace: `core:storage:${scope}:document:createOrReplace`,
      delete: `core:storage:${scope}:document:delete`,
      deleteByQuery: `core:storage:${scope}:document:deleteByQuery`,
      deleteCollection: `core:storage:${scope}:collection:delete`,
      deleteFields: `core:storage:${scope}:document:deleteFields`,
      deleteIndex: `core:storage:${scope}:index:delete`,
      exists: `core:storage:${scope}:document:exist`,
      get: `core:storage:${scope}:document:get`,
      getMapping: `core:storage:${scope}:mappings:get`,
      getSettings: `core:storage:${scope}:collection:settings:get`,
      mExecute: `core:storage:${scope}:document:mExecute`,
      mGet: `core:storage:${scope}:document:mGet`,
      refreshCollection: `core:storage:${scope}:collection:refresh`,
      replace: `core:storage:${scope}:document:replace`,
      search: `core:storage:${scope}:document:search`,
      truncateCollection: `core:storage:${scope}:collection:truncate`,
      update: `core:storage:${scope}:document:update`,
      updateByQuery: `core:storage:${scope}:document:updateByQuery`,
      updateCollection: `core:storage:${scope}:collection:update`,
      updateMapping: `core:storage:${scope}:mappings:update`,
    };

    for (const [method, event] of Object.entries(methodsMapping)) {
      this[method] = (...args: any[]) =>
        global.kuzzle.ask(event, this.index, ...args);
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
