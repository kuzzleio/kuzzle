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

export class IndexCache {
  /**
   * Index map: each entry holds a set of collection names
   *
   * Map<index, Set<collection>>
   */
  private indexes = new Map<string, Set<string>>();

  constructor() {
    this.indexes = new Map();
  }

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
    const collections = this.indexes.get(index);

    collections.add(collection);
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
    this.assertIndexExists(index);

    return Array.from(this.indexes.get(index));
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
    if (!this.indexes.has(index)) {
      throw storageError.get("unknown_index", index);
    }
  }

  /**
   * Assert that the provided index and collection exist
   */
  assertCollectionExists(index: string, collection: string) {
    this.assertIndexExists(index);

    if (!this.indexes.get(index).has(collection)) {
      throw storageError.get("unknown_collection", index, collection);
    }
  }
}
