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
 * What `snapshotIndexes` returns, to pass to `replaceIndexes` once storage has
 * been read
 */
export interface IndexSnapshot {
  /** The change counter when the snapshot was taken */
  readonly stamp: number;
}

/**
 * The `changedAt` key of an index, or of one of its collections. Storage names
 * never hold a NUL character.
 */
function entryKey(index: string, collection?: string): string {
  return collection === undefined ? index : `${index}\u0000${collection}`;
}

export class IndexCache {
  /**
   * Index map: each entry holds a set of collection names
   *
   * Map<index, Set<collection>>
   */
  private readonly indexes = new Map<string, Set<string>>();

  /**
   * How many times an index or a collection left the cache: `learn` compares
   * it with the value read before storage was, to tell whether a removal landed
   * during the read
   */
  private removalCount = 0;

  /**
   * How many times an index or a collection entered or left the cache, to
   * tell whether anything changed since storage was last read (kuzzle#3140)
   */
  private changeCount = 0;

  /**
   * Index or collection (`entryKey`) -> the change counter right after it last
   * entered or left the cache. `replaceIndexes` keeps the cached state of
   * every entry changed since its snapshot: comparing states instead missed an
   * entry changed twice during the read (removed then re-created), which
   * looks unchanged (kuzzle#3126).
   *
   * Only needed while a snapshot is open: emptied when the last one closes.
   */
  private readonly changedAt = new Map<string, number>();

  /** Snapshots taken and not passed to `replaceIndexes` nor released yet */
  private readonly openSnapshots = new Set<IndexSnapshot>();

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
    this.recordChange(index);

    return true;
  }

  /**
   * Cache a new collection
   */
  addCollection(index: string, collection: string): void {
    this.addIndex(index);

    const collections = this.getCollections(index);

    if (!collections.has(collection)) {
      collections.add(collection);
      this.recordChange(index, collection);
    }
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
    this.removalCount++;
    this.recordChange(index);
  }

  /**
   * Remove a collection from the cache
   */
  removeCollection(index: string, collection: string) {
    const collections = this.indexes.get(index);

    if (collections) {
      collections.delete(collection);
    }

    this.removalCount++;
    this.recordChange(index, collection);
  }

  /**
   * Removals so far, to pass to `learn` once storage has been read
   */
  get removals(): number {
    return this.removalCount;
  }

  /**
   * Changes so far: additions and removals alike
   */
  get changes(): number {
    return this.changeCount;
  }

  /**
   * Add the stored indexes and collections this cache misses, unless one was
   * removed since `removals` was read: the read may then predate that removal,
   * and would bring back what a peer deleted (kuzzle#3121).
   *
   * Never removes anything: unlike `replaceIndexes`, it only catches up with
   * creations whose cluster broadcast has not reached this node yet.
   *
   * @param stored - Index name -> its collection names, as storage holds them
   * @param removals - Read from `removals` before storage was
   */
  learn(stored: Record<string, string[]>, removals: number): void {
    if (removals !== this.removalCount) {
      return;
    }

    for (const [index, collections] of Object.entries(stored)) {
      this.addIndex(index);

      for (const collection of collections) {
        this.addCollection(index, collection);
      }
    }
  }

  /**
   * Mark the cache's state before storage is read: pass the snapshot to
   * `replaceIndexes` once storage has been read, or to `releaseSnapshot` if
   * the read failed
   */
  snapshotIndexes(): IndexSnapshot {
    const snapshot = { stamp: this.changeCount };

    this.openSnapshots.add(snapshot);

    return snapshot;
  }

  /**
   * Close a snapshot `replaceIndexes` will not get. Releasing it twice is
   * harmless.
   */
  releaseSnapshot(snapshot: IndexSnapshot): void {
    this.openSnapshots.delete(snapshot);

    if (this.openSnapshots.size === 0) {
      this.changedAt.clear();
    }
  }

  /**
   * Replace the cached indexes and collections with the stored ones, except
   * those that changed since `snapshot` was taken: such a change landed while
   * storage was read, and is newer than the read (kuzzle#3040), even when the
   * entry changed back since (kuzzle#3126). Closes the snapshot.
   *
   * @param stored - Index name -> its collection names, as storage holds them
   * @param snapshot - Taken by `snapshotIndexes` before storage was read
   */
  replaceIndexes(
    stored: Record<string, string[]>,
    snapshot: IndexSnapshot,
  ): void {
    const current = this.copyIndexes();
    const changed = (index: string, collection?: string) =>
      (this.changedAt.get(entryKey(index, collection)) ?? -1) > snapshot.stamp;
    const next = new Map<string, Set<string>>();

    for (const index of new Set([...Object.keys(stored), ...current.keys()])) {
      const cached = current.get(index);

      // Created or deleted during the read: so were its collections.
      if (changed(index)) {
        if (cached !== undefined) {
          next.set(index, new Set(cached));
        }

        continue;
      }

      const storedCollections = new Set(
        Object.hasOwn(stored, index) ? stored[index] : [],
      );
      const collections = new Set<string>();

      for (const collection of new Set([
        ...storedCollections,
        ...(cached ?? []),
      ])) {
        if (
          changed(index, collection)
            ? (cached?.has(collection) ?? false)
            : storedCollections.has(collection)
        ) {
          collections.add(collection);
        }
      }

      if (Object.hasOwn(stored, index) || collections.size > 0) {
        next.set(index, collections);
      }
    }

    this.indexes.clear();
    this.removalCount++;
    this.changeCount++;

    for (const [index, collections] of next) {
      this.indexes.set(index, collections);
    }

    // What this reload changed is newer than the read of a concurrent one.
    this.recordReplacement(current, next, snapshot);
    this.releaseSnapshot(snapshot);
  }

  /**
   * Assert that the provided index exists
   *
   * @throws If the index does not exist
   */
  assertIndexExists(index: string) {
    this.getCollections(index);
  }

  private copyIndexes(): Map<string, Set<string>> {
    return new Map(
      Array.from(this.indexes, ([index, collections]) => [
        index,
        new Set(collections),
      ]),
    );
  }

  /**
   * Count a change, and remember when it touched this entry while a snapshot
   * is open
   */
  private recordChange(index: string, collection?: string): void {
    this.changeCount++;

    if (this.openSnapshots.size > 0) {
      this.changedAt.set(entryKey(index, collection), this.changeCount);
    }
  }

  /**
   * Record, as changes, the entries `replaceIndexes` added or removed
   */
  private recordReplacement(
    before: Map<string, Set<string>>,
    after: Map<string, Set<string>>,
    closing: IndexSnapshot,
  ): void {
    // No other snapshot open: nothing will read these.
    if (![...this.openSnapshots].some((snapshot) => snapshot !== closing)) {
      return;
    }

    for (const index of new Set([...before.keys(), ...after.keys()])) {
      const was = before.get(index);
      const is = after.get(index);

      if ((was === undefined) !== (is === undefined)) {
        this.recordChange(index);
        continue;
      }

      for (const collection of new Set([...(was ?? []), ...(is ?? [])])) {
        if (
          (was?.has(collection) ?? false) !== (is?.has(collection) ?? false)
        ) {
          this.recordChange(index, collection);
        }
      }
    }
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
