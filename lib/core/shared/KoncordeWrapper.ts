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

import { JSONObject } from 'kuzzle-sdk';
import { Koncorde as KoncordeV4, KoncordeOptions, NormalizedFilter } from 'koncorde';
import {
  getCollections,
  getIndexes,
  koncordeTest,
  toKoncordeIndex,
} from '../../util/koncordeCompat';

/**
 * Emulates the normalized object returned by Koncorde v3
 */
export class NormalizedFilterV3 {
  /**
   * Filter Unique Identifier
   *
   * @type {string}
   */
  public id: string;

  /**
   * Data Index Name
   *
   * @type {string}
   */
  public index: string;

  /**
   * Data Collection Name
   *
   * @type {string}
   */
  public collection: string;

  /**
   * Filter converted to its canonical form
   *
   * @type {JSONObject[][]}
   */
  public normalized: JSONObject[][];

  constructor (index: string, collection: string, normalized: JSONObject) {
    this.id = normalized.id;
    this.index = index;
    this.collection = collection;
    this.normalized = normalized.filter;
  }
}

/*
  @deprecated

  Exposes Koncorde v4 through an interface emulating Koncorde v3, to prevent
  breaking changes in Kuzzle.

  This class should either be removed entirely in the next major version, or
  perhaps proposed in a compatibility mode to help clients migrate smoothly.
 */
export class Koncorde {
  private filterIdIndexMap;
  private koncorde;

  constructor (options: JSONObject = {}) {
    const opts: KoncordeOptions = {
      maxConditions: options.maxConditions || options.maxMinTerms || null,
      regExpEngine: options.regExpEngine || null,
      seed: options.seed || null,
    };

    this.koncorde = new KoncordeV4(opts);
    this.filterIdIndexMap = new Map();
  }

  /**
   * Utility method converting a distance value to meters.
   *
   * @param  {string} distance
   * @return {number}
   */
  static convertDistance (distance: string): number {
    return KoncordeV4.convertDistance(distance);
  }

  /**
   * Converts one of the accepted geopoint format into
   * a standardized version
   *
   * @param {Object} obj - object containing a geopoint
   * @returns {Coordinate} or null if no accepted format is found
   */
  static convertGeopoint (point: string|JSONObject): { lat: number; lon: number } {
    return KoncordeV4.convertGeopoint(point);
  }

  /**
   * Returns a boolean indicating if filters exist for a given index-collection
   * pair
   *
   * @param  {string}  index
   * @param  {string}  collection
   * @return {boolean}
   */
  exists (index: string, collection: string): boolean {
    return this.koncorde.getIndexes().includes(toKoncordeIndex(index, collection));
  }

  /**
   * Returns the list of collections associated to an index registered in this
   * Koncorde instance
   *
   * @param  {string}   index
   * @return {string[]}
   */
  getCollections (index: string): string[] {
    return getCollections(this.koncorde, index);
  }

  /**
   * Returns the list of filter identifiers registered on a given
   * index-collection pair
   *
   * @param  {string}   index
   * @param  {string}   collection
   * @return {string[]}
   */
  getFilterIds (index: string, collection: string): string[] {
    return this.koncorde.getFilterIds(toKoncordeIndex(index, collection));
  }

  /**
   * Returns the list of indexes registered in this Koncorde instance
   *
   * @return {string[]}
   */
  getIndexes (): string[] {
    return getIndexes(this.koncorde);
  }

  /**
   * Checks if a filter is registered for the given filter identifier
   *
   * @param {string} filterId
   * @returns {boolean}
   */
  hasFilter (filterId: string): boolean {
    return this.filterIdIndexMap.has(filterId);
  }


  /**
   * Returns a promise resolved if the provided filter are well-formed.
   * The resolved object contains the provided filter in its canonical form,
   * along with the corresponding filter unique identifier.
   *
   * This method does not modify the internal storage. To save a filter, the
   * store method must be called afterward. If you do not need the filter unique
   * identifier prior to save a filter in the engine, then consider using the
   * all-in-one register method instead.
   *
   * @param {string}     index
   * @param {string}     collection
   * @param {JSONObject} filter
   * @return {NormalizedFilterV3}
   */
  async normalize (index: string, collection: string, filter: JSONObject): Promise<NormalizedFilterV3> {
    return new NormalizedFilterV3(
      index,
      collection,
      this.koncorde.normalize(filter, toKoncordeIndex(index, collection)));
  }

  /**
   * Registers a filter to the engine instance. This method is equivalent to
   * executing normalize + store.
   *
   * @param  {string}     index
   * @param  {string}     collection
   * @param  {JSONObject} filter
   * @return {JSONObject}
   */
  async register (index: string, collection: string, filter: JSONObject): Promise<JSONObject> {
    const indexV4 = toKoncordeIndex(index, collection);
    const normalized = this.koncorde.normalize(filter, indexV4);

    return this.store(new NormalizedFilterV3(index, collection, normalized));
  }

  /**
   * Removes all references to a given filter from the engine.
   *
   * @param {string} filterId
   */
  async remove (filterId: string): Promise<void> {
    const index = this.filterIdIndexMap.get(filterId);

    this.koncorde.remove(filterId, index);
    this.filterIdIndexMap.delete(filterId);
  }

  /**
   * Stores a normalized filter (obtained with normalize).
   *
   * @param  {NormalizedFilterV3} normalized
   * @return {JSONObject}
   */
  async store (normalized: NormalizedFilterV3): Promise<JSONObject> {
    const indexV4 = toKoncordeIndex(normalized.index, normalized.collection);

    if (this.koncorde.hasFilterId(normalized.id, indexV4)) {
      return {
        diff: false,
        id: normalized.id,
      };
    }

    const normalizedV4 = new NormalizedFilter(
      normalized.normalized,
      normalized.id,
      indexV4);

    this.koncorde.store(normalizedV4);

    this.filterIdIndexMap.set(normalized.id, indexV4);

    return {
      diff: normalized,
      id: normalized.id,
    };
  }

  /**
   * Test data against filters registered in the engine, returning matching
   * filter identifiers, if any.
   *
   * @param  {string}     index
   * @param  {string}     collection
   * @param  {JSONObject} data
   * @param  {string}     id
   * @return {string[]}
   */
  test (index: string, collection: string, data: JSONObject, id?: string): string[] {
    return koncordeTest(this.koncorde, index, collection, data, id);
  }

  /**
   * Tests the provided filter without storing it in the engine, to check
   * whether it is well-formed or not.
   *
   * @param {JSONObject} filter
   */
  async validate (filter: JSONObject): Promise<void> {
    // encapsulate the v4 validate method into a function returning a promise
    this.koncorde.validate(filter);
  }
}
