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

const storageError = kerror.wrap("services", "storage");

/**
 * A collection write lock: while it is held, the storage layer rejects every
 * action writing to the collection, and serves reads as usual.
 */
export interface CollectionLock {
  /** Who holds the lock (e.g. a plugin name), the only one who can release it */
  owner: string;
  /** Why the collection is locked, quoted in the error writers receive */
  reason: string;
  /** Lock timestamp (Epoch-millis) */
  lockedAt: number;
}

export class IndexCache {
  /**
   * Index map: each entry holds a set of collection names
   *
   * Map<index, Set<collection>>
   */
  private readonly indexes = new Map<string, Set<string>>();

  /**
   * Collection write locks, a local copy of the cluster-wide state (see
   * `ClientAdapter`): checking a lock on every write must not cost a round
   * trip to Redis.
   *
   * Map<index, Map<collection, CollectionLock>>
   */
  private readonly locks = new Map<string, Map<string, CollectionLock>>();

  /**
   * Cache a new index
   *
   * @return true if an index was added, false if there is no modification
   */
  addIndex(index: string): boolean {
    if (this.indexes.has(index)) {
      return false;
    }

    this.indexes.set(index, new Set());

    return true;
  }

  /**
   * Cache a new collection
   */
  addCollection(index: string, collection: string): void {
    this.addIndex(index);

    this.getCollections(index).add(collection);
  }

  /**
   * Check an index existence
   */
  hasIndex(index: string): boolean {
    return this.indexes.has(index);
  }

  /**
   * Check a collection existence
   */
  hasCollection(index: string, collection: string): boolean {
    const collections = this.indexes.get(index);

    if (!collections) {
      return false;
    }

    return collections.has(collection);
  }

  /**
   * Return the list of cached indexes
   */
  listIndexes(): string[] {
    return Array.from(this.indexes.keys());
  }

  /**
   * Return the list of an index collections
   *
   * @throws If the provided index does not exist
   */
  listCollections(index: string): string[] {
    return Array.from(this.getCollections(index));
  }

  /**
   * Remove an index from the cache
   */
  removeIndex(index: string): void {
    this.indexes.delete(index);
  }

  /**
   * Remove a collection from the cache
   */
  removeCollection(index: string, collection: string) {
    const collections = this.indexes.get(index);

    if (collections) {
      collections.delete(collection);
    }
  }

  /**
   * Assert that the provided index exists
   *
   * @throws If the index does not exist
   */
  assertIndexExists(index: string) {
    this.getCollections(index);
  }

  /**
   * Answers an index's collections, or throws if the index is not cached.
   *
   * One lookup for both questions: `has()` followed by `get()` left every
   * caller holding an invariant the Map had already been asked about, one line
   * away from the answer.
   */
  private getCollections(index: string): Set<string> {
    const collections = this.indexes.get(index);

    if (collections === undefined) {
      throw storageError.get("unknown_index", index);
    }

    return collections;
  }

  /**
   * Assert that the provided index and collection exist
   */
  assertCollectionExists(index: string, collection: string) {
    if (!this.getCollections(index).has(collection)) {
      throw storageError.get("unknown_collection", index, collection);
    }
  }

  /**
   * Cache a collection write lock, replacing the one it may already hold
   */
  setLock(index: string, collection: string, lock: CollectionLock): void {
    let collections = this.locks.get(index);

    if (collections === undefined) {
      collections = new Map();
      this.locks.set(index, collections);
    }

    collections.set(collection, lock);
  }

  /**
   * Remove a collection write lock from the cache
   */
  removeLock(index: string, collection: string): void {
    const collections = this.locks.get(index);

    if (collections) {
      collections.delete(collection);

      if (collections.size === 0) {
        this.locks.delete(index);
      }
    }
  }

  /**
   * Remove every cached collection write lock
   */
  clearLocks(): void {
    this.locks.clear();
  }

  /**
   * Return a collection write lock, or null if the collection is not locked
   */
  getLock(index: string, collection: string): CollectionLock | null {
    return this.locks.get(index)?.get(collection) ?? null;
  }

  /**
   * Assert that the provided collection is not write-locked
   *
   * @throws If the collection is locked
   */
  assertCollectionWritable(index: string, collection: string): void {
    const lock = this.getLock(index, collection);

    if (lock !== null) {
      throw storageError.get(
        "collection_locked",
        index,
        collection,
        lock.owner,
        lock.reason,
      );
    }
  }

  /**
   * Assert that none of the provided index collections is write-locked
   *
   * @throws If one of the index collections is locked
   */
  assertIndexWritable(index: string): void {
    const collections = this.locks.get(index);

    if (collections === undefined) {
      return;
    }

    for (const collection of collections.keys()) {
      this.assertCollectionWritable(index, collection);
    }
  }
}
