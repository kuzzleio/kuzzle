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
  stringify = require('json-stable-stringify'),
  Bluebird = require('bluebird'),
  highwayhash = require('highwayhash'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  OperandsStorage = require('./storeOperands'),
  OperandsRemoval = require('./removeOperands'),
  Filter = require('./objects/filter'),
  Subfilter = require('./objects/subfilter'),
  Condition = require('./objects/condition'),
  TestTable = require('./objects/testTable'),
  FieldOperand = require('./objects/fieldOperand'),
  containsOne = require('../util/containsOne');

/**
 * Real-time engine filters storage
 *
 * @class Storage
 * @param {string} hashKey
 */
class Storage {
  constructor (hashKey) {
    this.storeOperand = new OperandsStorage();
    this.removeOperand = new OperandsRemoval();
    this.hashKey = hashKey;

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
    const result = addFilter(this.hashKey, this.filters, index, collection, filters);

    if (!result.created) {
      return {diff: false, id: result.id};
    }

    addFiltersIndex(this.filtersIndex, index, collection, result.id);

    filters.forEach(sf => {
      const sfResult = addSubfilter(this.hashKey, this.filters[result.id], this.subfilters, sf);

      if (sfResult.created) {
        const
          subfilter = this.subfilters[index][collection][sfResult.id],
          addedConditions = addConditions(this.hashKey, subfilter, this.conditions, index, collection, sf);

        addTestTables(this.testTables, subfilter, index, collection);
        addIndexCollectionToObject(this.foPairs, index, collection);

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
            destroy(this.conditions, index, collection, condition.id);
          }
          else {
            condition.subfilters.splice(condition.subfilters.indexOf(subfilter), 1);
          }
        });

        destroy(this.subfilters, index, collection, subfilter.id);
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
   * Removes a filter from test tables and rebuilds the structure if necessary
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filter - filter to be removed
   * @private
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
     including a lot more unsubscriptions to remove, greatly reducing the overall reindex cost
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
    let
      iCond = 0,
      iRemoved = 0,
      iTarget = 0;

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
    const conditions = new Uint8Array(tt.conditions.length - tt.removedConditions.array.length);

    while (iCond < tt.clength && iRemoved < tt.removedConditions.array.length) {
      if (iCond !== tt.removedConditions.array[iRemoved]) {
        conditions[iTarget] = tt.conditions[iCond];
        iTarget++;
      }
      else {
        iRemoved++;
      }

      iCond++;
    }

    if (iCond < tt.clength) {
      conditions.set(tt.conditions.subarray(iCond), iTarget);
    }

    tt.conditions = conditions;

    // refresh subfilters condition index pointers
    const keys = Object.keys(this.subfilters[index][collection]);

    for(let i = 0; i < keys.length; i++) {
      const
        sf = this.subfilters[index][collection][keys[i]],
        cidx = tt.removedConditions.array.findIndex(idx => idx > sf.cidx);

      sf.cidx -= cidx > -1 ? cidx : tt.removedConditions.array.length;
    }

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
    tt.clength -= tt.removedConditions.array.length;
    tt.removedFilters = {};
    tt.removedFiltersCount = 0;
    tt.removedConditions.array = [];
    tt.reindexing = false;
  }

}

/**
 * Adds a filter ID to the index/collection filter references
 *
 * @param {object} fIndexObj
 * @param {string} index
 * @param {string} collection
 * @param {string} id
 */
function addFiltersIndex(fIndexObj, index, collection, id) {
  if (!fIndexObj[index]) {
    fIndexObj[index] = {[collection]: [id]};
  }
  else if (!fIndexObj[index][collection]) {
    fIndexObj[index][collection] = [id];
  }
  else {
    fIndexObj[index][collection].push(id);
  }
}

/**
 * Add a filter to the filters structure.
 * Returns a boolean indicating if the insertion was successful,
 * or, if false, indicating that the filter was already registered
 *
 * @param {string} hashKey
 * @param {object} filtersObj - filters structure
 * @param {string} index
 * @param {string} collection
 * @param {object} filters
 * @return {object} containing a "created" boolean flag and the filter id
 */
function addFilter(hashKey, filtersObj, index, collection, filters) {
  const
    id = highwayhash.asHexString(hashKey, Buffer.from(stringify({
      index,
      collection,
      filters
    }))),
    created = !filtersObj[id];

  if (created) {
    filtersObj[id] = new Filter(id, index, collection, filters);
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
 * @param {string} hashKey
 * @param {object} filtersObj
 * @param {object} subFiltersObj
 * @param {Array} subfilter
 * @return {object}
 */
function addSubfilter(hashKey, filtersObj, subFiltersObj, subfilter) {
  const sfId = highwayhash.asHexString(hashKey, Buffer.from(stringify(subfilter)));
  let created = true;

  addIndexCollectionToObject(subFiltersObj, filtersObj.index, filtersObj.collection);

  if (subFiltersObj[filtersObj.index][filtersObj.collection][sfId]) {
    const sfRef = subFiltersObj[filtersObj.index][filtersObj.collection][sfId];

    created = false;
    sfRef.filters.push(filtersObj);
    filtersObj.subfilters.push(sfRef);
  }
  else {
    subFiltersObj[filtersObj.index][filtersObj.collection][sfId] = new Subfilter(sfId, filtersObj);
    filtersObj.subfilters.push(subFiltersObj[filtersObj.index][filtersObj.collection][sfId]);
  }

  return {created, id: sfId};
}

/**
 * Adds conditions registered in a subfilter to the conditions
 * structure, and link them to the corresponding subfilter structure
 *
 * Returns the list of created conditions
 *
 * @param {string} hashKey
 * @param {object} sfObj - link to the corresponding subfilter in the
 *                         subfilters structure
 * @param {object} condObj - conditions object structure
 * @param {string} index
 * @param {string} collection
 * @param {Array} subfilter - array of conditions
 * @return {Array}
 */
function addConditions(hashKey, sfObj, condObj, index, collection, subfilter) {
  const diff = [];

  addIndexCollectionToObject(condObj, index, collection);

  subfilter.forEach(cond => {
    const
      cId = highwayhash.asHexString(hashKey, Buffer.from(stringify(cond))),
      condLink = condObj[index][collection][cId];

    if (condLink) {
      if (condLink.subfilters.indexOf(sfObj) === -1) {
        condLink.subfilters.push(sfObj);
        sfObj.conditions.push(condLink);
        diff.push(condLink);
      }
    }
    else {
      const keyword = Object.keys(cond).filter(k => k !== 'not')[0];

      condObj[index][collection][cId] = new Condition(cId, sfObj, cond.not ? 'not' + keyword : keyword, cond[keyword]);
      sfObj.conditions.push(condObj[index][collection][cId]);
      diff.push(condObj[index][collection][cId]);
    }
  });

  return diff;
}

/**
 * Updates the test tables with a new subfilter
 *
 * @param {object} testTables reference
 * @param {object} subfilter to be added
 * @param {string} index
 * @param {string} collection
 */
function addTestTables(testTables, subfilter, index, collection) {
  if (!testTables[index]) {
    testTables[index] = {};
  }

  if (!testTables[index][collection]) {
    testTables[index][collection] = new TestTable(subfilter);
  }
  else {
    testTables[index][collection].addSubfilter(subfilter);
  }
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
function addIndexCollectionToObject(obj, index, collection) {
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
function destroy(obj, index, collection, field) {
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

module.exports = Storage;
