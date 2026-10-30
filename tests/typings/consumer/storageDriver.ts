/**
 * A storage driver, written the way a driver package writes one (ADR-0003):
 * the core only, plus the `stats` capability its manifest declares, against
 * the contract `kuzzle` exports.
 */

import type {
  JSONObject,
  StorageCapability,
  StorageDriver,
  StorageDriverClass,
  StorageDriverManifest,
  StorageInfo,
  StorageSearchResult,
  StorageStats,
} from "kuzzle";
import type { KuzzleError } from "kuzzle";
import { STORAGE_CAPABILITIES, storageError, storeScopeEnum } from "kuzzle";

type NativeClient = { ping(): Promise<boolean> };

export const manifest: StorageDriverManifest = {
  capabilities: ["stats"],
  kuzzleVersion: ">=2.61.0 <3",
};

export const declared: readonly StorageCapability[] = STORAGE_CAPABILITIES;

const notImplemented = async (): Promise<never> => {
  throw new Error("not implemented");
};

export class MemoryDriver implements StorageDriver {
  private readonly client: NativeClient;

  static createNativeClient(clientConfig: JSONObject): NativeClient {
    return { ping: async () => clientConfig.offline !== true };
  }

  constructor(
    private readonly config: JSONObject,
    private readonly scope: storeScopeEnum,
  ) {
    this.client = MemoryDriver.createNativeClient(config);
  }

  async init(): Promise<void> {
    await this.client.ping();
  }

  async info(): Promise<StorageInfo> {
    return { type: "memory", version: String(this.config.version ?? "1") };
  }

  async stats(): Promise<StorageStats> {
    return { indexes: [], size: 0 };
  }

  translateKoncordeFilters(filters: JSONObject): JSONObject {
    return filters;
  }

  async getSchema(): Promise<Record<string, string[]>> {
    return this.scope === storeScopeEnum.PRIVATE ? { kuzzle: [] } : {};
  }

  async search(): Promise<StorageSearchResult> {
    return { hits: [{ _id: "a", _source: {} }], total: 1 };
  }

  async scroll(): Promise<StorageSearchResult> {
    return { hits: [], total: 0 };
  }

  async exists(): Promise<boolean> {
    return false;
  }

  // Kuzzle's own storage errors, whatever the engine
  async get(index: string, collection: string, id: string): Promise<never> {
    const error: KuzzleError = storageError.get(
      "not_found",
      id,
      index,
      collection,
    );

    throw error;
  }

  async count(): Promise<number> {
    return 0;
  }

  async deleteIndexes(indexes: string[] = []): Promise<string[]> {
    return indexes;
  }

  createIndex = notImplemented;
  deleteIndex = notImplemented;
  createCollection = notImplemented;
  deleteCollection = notImplemented;
  truncateCollection = notImplemented;
  refreshCollection = notImplemented;
  getMapping = notImplemented;
  getSettings = notImplemented;
  mGet = notImplemented;
  mExists = notImplemented;
  create = notImplemented;
  createOrReplace = notImplemented;
  update = notImplemented;
  upsert = notImplemented;
  replace = notImplemented;
  delete = notImplemented;
  deleteFields = notImplemented;
  mCreate = notImplemented;
  mCreateOrReplace = notImplemented;
  mUpdate = notImplemented;
  mUpsert = notImplemented;
  mReplace = notImplemented;
  mDelete = notImplemented;
  import = notImplemented;
  deleteByQuery = notImplemented;
  mExecute = notImplemented;
}

// What the package exports, as Kuzzle loads it.
export const Driver: StorageDriverClass<NativeClient> = MemoryDriver;
