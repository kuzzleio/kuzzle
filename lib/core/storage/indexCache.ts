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

/**
 * One index's collections after a reload: the stored ones, except those whose
 * cached state changed between the snapshot (`was`) and now (`is`), which keep
 * their current state.
 */
function reconcileCollections(
  stored: Set<string>,
  was: Set<string> | undefined,
  is: Set<string> | undefined,
): Set<string> {
  const collections = new Set<string>();

  for (const collection of new Set([
    ...stored,
    ...(was ?? []),
    ...(is ?? []),
  ])) {
    const wasCached = was?.has(collection) ?? false;
    const isCached = is?.has(collection) ?? false;

    if (wasCached === isCached ? stored.has(collection) : isCached) {
      collections.add(collection);
    }
  }

  return collections;
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
   * Return a copy of the cached indexes and collections, to pass to
   * `replaceIndexes` once storage has been read
   */
  snapshotIndexes(): Map<string, Set<string>> {
    return new Map(
      Array.from(this.indexes, ([index, collections]) => [
        index,
        new Set(collections),
      ]),
    );
  }

  /**
   * Replace the cached indexes and collections with the stored ones, except
   * those that changed since `snapshot` was taken: such a change landed while
   * storage was read, and is newer than the read (kuzzle#3040).
   *
   * @param stored - Index name -> its collection names, as storage holds them
   * @param snapshot - Taken by `snapshotIndexes` before storage was read
   */
  replaceIndexes(
    stored: Record<string, string[]>,
    snapshot: Map<string, Set<string>>,
  ): void {
    const current = this.snapshotIndexes();
    const indexes = new Set([
      ...Object.keys(stored),
      ...snapshot.keys(),
      ...current.keys(),
    ]);

    this.indexes.clear();

    for (const index of indexes) {
      const storedCollections = new Set(
        Object.hasOwn(stored, index) ? stored[index] : [],
      );
      const was = snapshot.get(index);
      const is = current.get(index);
      const indexChanged = (was === undefined) !== (is === undefined);

      // Deleted during the read: its collections went with it.
      if (indexChanged && is === undefined) {
        continue;
      }

      const collections = reconcileCollections(storedCollections, was, is);

      if (
        indexChanged ||
        Object.hasOwn(stored, index) ||
        collections.size > 0
      ) {
        this.indexes.set(index, collections);
      }
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
   * Return a copy of the cached collection write locks, to pass to
   * `replaceLocks` once the stored locks have been read
   */
  snapshotLocks(): Map<string, Map<string, CollectionLock>> {
    return new Map(
      Array.from(this.locks, ([index, collections]) => [
        index,
        new Map(collections),
      ]),
    );
  }

  /**
   * Replace the cached collection write locks with the stored ones, except
   * those that changed since `snapshot` was taken: such a change landed while
   * the stored locks were read, and is newer than the read (kuzzle#3040).
   *
   * @param stored - The cluster-wide locks
   * @param snapshot - Taken by `snapshotLocks` before the locks were read
   */
  replaceLocks(
    stored: Map<string, Map<string, CollectionLock>>,
    snapshot: Map<string, Map<string, CollectionLock>>,
  ): void {
    const current = this.snapshotLocks();
    const indexes = new Set([
      ...stored.keys(),
      ...snapshot.keys(),
      ...current.keys(),
    ]);

    this.locks.clear();

    for (const index of indexes) {
      for (const collection of new Set([
        ...(stored.get(index)?.keys() ?? []),
        ...(snapshot.get(index)?.keys() ?? []),
        ...(current.get(index)?.keys() ?? []),
      ])) {
        const was = snapshot.get(index)?.get(collection);
        const is = current.get(index)?.get(collection);
        const lock = was === is ? stored.get(index)?.get(collection) : is;

        if (lock !== undefined) {
          this.setLock(index, collection, lock);
        }
      }
    }
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
