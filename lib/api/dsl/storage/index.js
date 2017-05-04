/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

'use strict';

const
  Bluebird = require('bluebird'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  OperandsStorage = require('./storeOperands'),
  OperandsRemoval = require('./removeOperands'),
  Filter = require('./objects/filter'),
  Subfilter = require('./objects/subfilter'),
  Condition = require('./objects/condition'),
  TestTable = require('./objects/testTable'),
  FieldOperand = require('./objects/fieldOperand'),
  containsOne = require('../util/containsOne');

// placeholder for Kuzzle.hash function.
// cannot be required on class declaration due to require cycling dependencies
// and cannot be defined inside a class block either
let _hash; // NOSONAR

/**
 * Real-time engine filters storage
 *
 * @class Storage
 */
class Storage {

  constructor () {
    this.storeOperand = new OperandsStorage();
    this.removeOperand = new OperandsRemoval();

    /**
     * Index/Collection => filters link table
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: [filterid1, filterid2, ...]
     *    }
     *  }
     */
    this.filtersIndex = {};

    /**
     * Filter => Subfilter link table
     * A filter is made of subfilters. Each subfilter is to be tested
     * against OR operands, meaning if at least 1 subfilter matches, the
     * whole filter matches.
     *
     * @type {object}
     *
     * @example
     *  {
     *    filterId: <Filter>,
     *    filterId: <Filter>,
     *    ...
     *  }
     */
    this.filters = {};

    /**
     * Subfilters link table
     *
     * A subfilter is a set of conditions to be tested against
     * AND operands. If at least 1 condition returns false, then
     * the whole subfilter is false.
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: {
     *        subfilterId: <Subfilter>,
     *        subfilterId: <Subfilter>,
     *        ...
     *      }
     *    }
     *  }
     */
    this.subfilters = {};

    /**
     * Conditions description
     * A condition is made of a DSL keyword, a document field name, and
     * the associated test values
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: {
     *        conditionId: <Condition>,
     *        conditionId: <Condition>,
     *        ...
     *      }
     *    }
     *  }
     */
    this.conditions = {};

    /**
     * Contains field-operand pairs to be tested
     * A field-operand pair is a DSL keyword applied to a document field
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: {
     *        [operandName]: {
     *          <operand specific storage>
     *        }
     *      }
     *    }
     *  }
     */
    this.foPairs = {};

    /**
     * Contains reference tables.
     * Each time a document is to be matched against registered
     * filters, the corresponding reference tables is duplicated
     * and is used to keep track of validated conditions and
     * filters
     *
     * The filterIds table is used to link the validated filters
     * table with their corresponding ids, to minimize object
     * lookups when building large sets of matching filter IDs
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: <TestTable>
     *    }
     *  }
     */
    this.testTables = {};

    // we cannot directly use Kuzzle.hash in class description due to require cycling loops
    if (_hash === undefined) {
      _hash = require('../../kuzzle').hash;
    }
  }

  /**
   * Decomposes and stores a normalized filter
   *
   * @param {string} index
   * @param {string} collection
   * @param {Array} filters
   * @return {object}
   */
  store (index, collection, filters) {
    const result = this._addFilter(index, collection, filters);

    if (!result.created) {
      return {diff: false, id: result.id};
    }

    this._addFiltersIndex(index, collection, result.id);

    filters.forEach(sf => {
      const sfResult = this._addSubfilter(this.filters[result.id], sf);

      if (sfResult.created) {
        const
          subfilter = this.subfilters[index][collection][sfResult.id],
          addedConditions = this._addConditions(subfilter, index, collection, sf);

        this._addTestTables(subfilter, index, collection);
        Storage.addIndexCollectionToObject(this.foPairs, index, collection);

        addedConditions.forEach(cond => {
          if (!this.foPairs[index][collection][cond.keyword]) {
            this.foPairs[index][collection][cond.keyword] = new FieldOperand();
          }

          this.storeOperand[cond.keyword](this.foPairs[index][collection][cond.keyword], subfilter, cond);
        });
      }
    });

    // ref https://github.com/kuzzleio/kuzzle/issues/740
    const filter = this.filters[result.id];
    if (filter.fidx === -1) {
      filter.fidx = this.testTables[index][collection].filtersCount;
      this.testTables[index][collection].filtersCount++;
    }

    return {diff: {
      ftAdd: {
        i: index,
        c: collection,
        f: filters
      }
    }, id: result.id};
  }

  /**
   * Remove a filter ID from the storage
   * @param {string} filterId
   * @return {Promise<*>}
   */
  remove (filterId) {
    if (!this.filters[filterId]) {
      return Bluebird.reject(new NotFoundError(`Unable to remove filter "${filterId}": filter not found`));
    }

    const {index, collection} = this.filters[filterId];

    this._removeFromTestTables(index, collection, this.filters[filterId]);

    this.filters[filterId].subfilters.forEach(subfilter => {
      if (subfilter.filters.length === 1) {
        subfilter.conditions.forEach(condition => {
          this.removeOperand[condition.keyword](this.foPairs, index, collection, subfilter, condition);

          if (condition.subfilters.length === 1) {
            Storage.destroy(this.conditions, index, collection, condition.id);
          }
          else {
            condition.subfilters.splice(condition.subfilters.indexOf(subfilter), 1);
          }
        });

        Storage.destroy(this.subfilters, index, collection, subfilter.id);
      }
      else {
        subfilter.filters.splice(subfilter.filters.indexOf(this.filters[filterId]), 1);
      }
    });

    if (this.filtersIndex[index][collection].length === 1) {
      if (containsOne(this.filtersIndex[index])) {
        delete this.filtersIndex[index];
      }
      else {
        delete this.filtersIndex[index][collection];
      }
    }
    else {
      this.filtersIndex[index][collection].splice(this.filtersIndex[index][collection].indexOf(filterId), 1);
    }

    delete this.filters[filterId];

    return Bluebird.resolve();
  }

  /**
   * Adds a filter ID to the index/collection filter references
   *
   * @param {string} index
   * @param {string} collection
   * @param {string} id
   */
  _addFiltersIndex (index, collection, id) {
    if (!this.filtersIndex[index]) {
      this.filtersIndex[index] = {[collection]: [id]};
    }
    else if (!this.filtersIndex[index][collection]) {
      this.filtersIndex[index][collection] = [id];
    }
    else {
      this.filtersIndex[index][collection].push(id);
    }
  }

  /**
   * Add a filter to the filters structure.
   * Returns a boolean indicating if the insertion was successful,
   * or, if false, indicating that the filter was already registered
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filters
   * @return {object} containing a "created" boolean flag and the filter id
   */
  _addFilter (index, collection, filters) {
    const
      id = _hash({
        index,
        collection,
        filters
      }),
      created = !this.filters[id];

    if (created) {
      this.filters[id] = new Filter(id, index, collection, filters);
    }

    return {created, id};
  }

  /**
   * Adds a subfilter to the subfilters structure.
   * Link it to the corresponding filter
   *
   * Return value contains the "created" boolean indicating
   * if the subfilter has been created or updated.
   * If false, nothing changed.
   *
   * @param {Array} subfilter
   * @return {object}
   */
  _addSubfilter (filter, subfilter) {
    const sfId = _hash(subfilter);
    let created = true;

    Storage.addIndexCollectionToObject(this.subfilters, filter.index, filter.collection);

    if (this.subfilters[filter.index][filter.collection][sfId]) {
      const sfRef = this.subfilters[filter.index][filter.collection][sfId];

      created = false;
      sfRef.filters.push(filter);
      filter.subfilters.push(sfRef);
    }
    else {
      this.subfilters[filter.index][filter.collection][sfId] = new Subfilter(sfId, filter);
      filter.subfilters.push(this.subfilters[filter.index][filter.collection][sfId]);
    }

    return {created, id: sfId};
  }

  /**
   * Adds conditions registered in a subfilter to the conditions
   * structure, and link them to the corresponding subfilter structure
   *
   * Returns the list of created conditions
   *
   * @param {object} subfilter - link to the corresponding subfilter in the
   *                         subfilters structure
   * @param {string} index
   * @param {string} collection
   * @param {Array} conditions - array of conditions
   * @return {Array}
   */
  _addConditions (subfilter, index, collection, conditions) {
    const diff = [];

    Storage.addIndexCollectionToObject(this.conditions, index, collection);

    conditions.forEach(cond => {
      const
        cId = _hash(cond),
        condLink = this.conditions[index][collection][cId];

      if (condLink) {
        if (condLink.subfilters.indexOf(subfilter) === -1) {
          condLink.subfilters.push(subfilter);
          subfilter.conditions.push(condLink);
          diff.push(condLink);
        }
      }
      else {
        const keyword = Object.keys(cond).filter(k => k !== 'not')[0];

        this.conditions[index][collection][cId] = new Condition(cId, subfilter, cond.not ? 'not' + keyword : keyword, cond[keyword]);
        subfilter.conditions.push(this.conditions[index][collection][cId]);
        diff.push(this.conditions[index][collection][cId]);
      }
    });

    return diff;
  }

  /**
   * Updates the test tables with a new subfilter
   *
   * @param {object} subfilter to be added
   * @param {string} index
   * @param {string} collection
   */
  _addTestTables (subfilter, index, collection) {
    if (!this.testTables[index]) {
      this.testTables[index] = {};
    }

    if (!this.testTables[index][collection]) {
      this.testTables[index][collection] = new TestTable(subfilter);
    }
    else {
      this.testTables[index][collection].addSubfilter(subfilter);
    }
  }

  /**
   * Removes a filter from test tables and rebuilds the structure if necessary
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filter - filter to be removed
   */
  _removeFromTestTables (index, collection, filter) {
    const tt = this.testTables[index][collection];

    if (tt.removedFilters[filter.id]) {
      return;
    }

    tt.removedFilters[filter.id] = true;
    tt.removedFiltersCount++;

    if (tt.removedFiltersCount === tt.filtersCount) {
      if (containsOne(this.testTables[index])) {
        delete this.testTables[index];
      }
      else {
        delete this.testTables[index][collection];
      }

      return;
    }

    // Declaring "i" inside the "for" statement downgrades
    // performances by a factor of 3 to 4
    // Should be fixed in later V8 versions
    // (tested on Node 6.9.x)
    let i; // NOSONAR

    for(i = 0; i < filter.subfilters.length; i++) {
      if (filter.subfilters[i].filters.length === 1) {
        tt.removedConditions.insert(filter.subfilters[i].cidx);
      }
    }

    /*
     Perform a reindex only if the number of deleted conditions is greater
     than 10% of the total number of registered conditions

     In that case, we flag the reindex operation and launch it a few seconds
     after that. This allows large unsubscriptions activity to finish.
     Best case scenario: the test table is removed altogether, thus avoiding reindexation.
     Worst case scenario: we still have a reindexation to perform, but luckily
     including a lot more unsubscriptions to remove, greatly recucing the overall reindex cost
     */
    if (!tt.reindexing && tt.removedConditions.array.length > tt.clength / 10) {
      tt.reindexing = true;
      setTimeout(() => this._reindexTestTable(index, collection), 5000);
    }
  }

  /**
   * Performs a reindexation of a test table
   *
   * @param {string} index
   * @param {string} collection
   */
  _reindexTestTable (index, collection) {
    /*
     * Since the reindexation has been triggered, the test table might have been
     * destroyed
     */
    if (!this.testTables[index] || !this.testTables[index][collection] || !this.testTables[index][collection].reindexing) {
      return;
    }

    const tt = this.testTables[index][collection];

    /*
     * If there is a huge increase in new subscriptions, we should postpone the
     * reindexation to a later time.
     */
    if (tt.removedConditions.array.length < tt.clength / 10) {
      return;
    }

    // rebuild conditions index
    const
      conditionKeys = Object.keys(this.subfilters[index][collection]),
      conditions = new Uint8Array(tt.conditions.length);

    for (let i = 0; i < conditionKeys.length; i++) {
      const
        key = conditionKeys[i],
        sf = this.subfilters[index][collection][key];

      conditions[i] = sf.conditions.length;
      sf.cidx = i;
    }
    tt.conditions = conditions;
    tt.clength = conditionKeys.length;

    // rebuild filter index pointers
    if (tt.removedFiltersCount) {
      for (let i = 0; i < Object.keys(this.filtersIndex[index][collection]).length; i++) {
        const
          filterId = this.filtersIndex[index][collection][i],
          filter = this.filters[filterId];

        filter.fidx = i;
      }
    }

    // updates the test table indicators
    tt.filtersCount = Object.keys(this.filtersIndex[index][collection]).length;
    tt.removedFilters = {};
    tt.removedFiltersCount = 0;
    tt.removedConditions.array = [];
    tt.reindexing = false;
  }

  /**
   * Many storage objects separate data by index and collection.
   * This function avoids repetition of code by initializing an
   * object with an index and collection
   *
   * @param {object} obj - object to update
   * @param {string} index
   * @param {string} collection
   */
  static addIndexCollectionToObject (obj, index, collection) {
    if (!obj[index]) {
      obj[index] = { [collection]: {} };
    }
    else if (!obj[index][collection]) {
      obj[index][collection] = {};
    }
  }

  /**
   * Removes a field from an object. If the collection containing it
   * is empty after the removal, this function deletes it too.
   * Same goes for the index.
   *
   * @param {object} obj - object containing the field to remove
   * @param {string} index
   * @param {string} collection
   * @param {string} field
   */
  static destroy (obj, index, collection, field) {
    if (containsOne(obj[index][collection])) {
      if (containsOne(obj[index])) {
        delete obj[index];
      }
      else {
        delete obj[index][collection];
      }
    }
    else {
      delete obj[index][collection][field];
    }
  }

}

module.exports = Storage;
