var
  crypto = require('crypto'),
  stringify = require('json-stable-stringify'),
  Promise = require('bluebird'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  OperandsStorage = require('./storeOperands'),
  OperandsRemoval = require('./removeOperands');

/**
 * Real-time engine filters storage
 * @constructor
 */
function Storage () {
  this.storeOperand = new OperandsStorage();
  this.removeOperand = new OperandsRemoval();

  /**
   * Index/Collection => filters link table
   *
   * @type {Object}
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
   * @type {Object}
   *
   * @example
   *  {
   *    filterId: {
   *      id: filterId,
   *      index: 'index',
   *      collection: 'collection',
   *      subfilters: [subfilter1, subfilter3, subfilter4]
   *    },
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
   * @type {Object}
   *
   * @example
   *  {
   *    index: {
   *      collection: {
   *        subfilterId: {
   *          id: subfilterId,
   *          filters: [filter1, filter2, filter...],
   *          conditions: [conditionId1, conditionId2, ...]
   *        }
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
   * @type {Object}
   *
   * @example
   *  {
   *    index: {
   *      collection: {
   *        conditionId: {
   *          id: conditionId,
   *          subfilters: [subfilter1, subfilter2, ...],
   *          keyword: 'DSL keyword',
   *          value: // DSL keyword specific
   *        }
   *      }
   *    }
   *  }
   */
  this.conditions = {};

  /**
   * Contains field-operand pairs to be tested
   * A field-operand pair is a DSL keyword applied to a document field
   *
   * @type {Object}
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
   * @type {Object}
   *
   * @example
   *  {
   *    index: {
   *      collection: {
   *        subfilters: {
   *          subfilterId: {
   *            cidx: <conditions count array index>,
   *            fidx: [<filter Ids array indexes>]
   *          },
   *          subfilterId: {
   *            cidx: <conditions count array index>,
   *            fidx: <filter Ids array index>
   *          },
   *          ...
   *        },
   *        filters: {
   *          filterId: fidx
   *        },
   *        conditionsCount: [<cidx1>, <cidx2>, <cidx3>, ...],
   *        filterIds: ['filterId', 'filterId', ...]
   *      }
   *    }
   *  }
   */
  this.testTables = {};

  /**
   * Decomposes and stores a normalized filter
   *
   * @param {string} index
   * @param {string} collection
   * @param {Array} filters
   * @return {Object}
   */
  this.store = function (index, collection, filters) {
    var
      diff = false,
      result;

    result = addFilter(this.filters, index, collection, filters);

    if (!result.created) {
      return {diff, id: result.id, filter: filters};
    }

    addFiltersIndex(this.filtersIndex, index, collection, result.id);

    filters.forEach(sf => {
      var
        sfResult = addSubfilter(this.filters[result.id], this.subfilters, sf),
        addedConditions,
        subfilter = this.subfilters[index][collection][sfResult.id];

      if (sfResult.created) {
        diff = diff !== false ? diff.push(filters) : [filters];
        addedConditions = addConditions(subfilter, this.conditions, index, collection, sf);

        addTestTables(this.testTables, subfilter, index, collection, sfResult.id);

        addIndexCollectionToObject(this.foPairs, index, collection);

        addedConditions.forEach(cond => {
          if (!this.foPairs[index][collection][cond.keyword]) {
            this.foPairs[index][collection][cond.keyword] = {};
          }

          this.storeOperand[cond.keyword](this.foPairs[index][collection][cond.keyword], subfilter, cond);
        });
      }
    });

    return {diff, id: result.id, filter: filters};
  };

  /**
   * Remove a filter ID from the storage
   * @param {string} filterId
   * @return {Promise}
   */
  this.remove = function (filterId) {
    var
      index,
      collection;

    if (!this.filters[filterId]) {
      return Promise.reject(new NotFoundError(`Unable to remove filter "${filterId}": filter not found`));
    }

    index = this.filters[filterId].index;
    collection = this.filters[filterId].collection;

    this.filters[filterId].subfilters.forEach(subfilter => {
      if (subfilter.filters.length === 1) {
        subfilter.conditions.forEach(condition => {
          if (condition.subfilters.length === 1) {
            this.removeOperand[condition.keyword](this.foPairs, index, collection, subfilter, condition);
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

    removeFromTestTables(this.testTables, index, collection, this.filters[filterId]);

    if (this.filtersIndex[index][collection].length === 1) {
      if (Object.keys(this.filtersIndex[index]).length === 1) {
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

    return Promise.resolve();
  };

  return this;
}

/**
 * Adds a filter ID to the index/collection filter references
 *
 * @param {Object} fIndexObj
 * @param {String} index
 * @param {String} collection
 * @param {String} id
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
 * @param {Object} filtersObj - filters structure
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters
 * @return {Object} containing a "created" boolean flag and the filter id
 */
function addFilter(filtersObj, index, collection, filters) {
  var
    id = crypto.createHash('md5').update(stringify({
      index,
      collection,
      filters
    })).digest('hex'),
    created = !filtersObj[id];

  if (created) {
    filtersObj[id] = {
      id,
      index,
      collection,
      subfilters: []
    };
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
 * @param {Object} filtersObj
 * @param {Object} subFiltersObj
 * @param {Array} subfilter
 * @return {Object}
 */
function addSubfilter(filtersObj, subFiltersObj, subfilter) {
  var
    sfId = crypto.createHash('md5').update(stringify(subfilter)).digest('hex'),
    sfRef,
    created = true;

  addIndexCollectionToObject(subFiltersObj, filtersObj.index, filtersObj.collection);

  if (subFiltersObj[filtersObj.index][filtersObj.collection][sfId]) {
    sfRef = subFiltersObj[filtersObj.index][filtersObj.collection][sfId];

    if (sfRef.filters.indexOf(filtersObj) !== -1) {
      created = false;
    }
    else {
      sfRef.filters.push(filtersObj);
      filtersObj.subfilters.push(sfRef);
    }
  }
  else {
    subFiltersObj[filtersObj.index][filtersObj.collection][sfId] = {
      id: sfId,
      filters: [filtersObj],
      conditions: []
    };
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
 * @param {Object} sfObj - link to the corresponding subfilter in the
 *                         subfilters structure
 * @param {Object} condObj - conditions object structure
 * @param {string} index
 * @param {string} collection
 * @param {Array} subfilter - array of conditions
 * @return {Array}
 */
function addConditions(sfObj, condObj, index, collection, subfilter) {
  var diff = [];

  addIndexCollectionToObject(condObj, index, collection);

  subfilter.forEach(cond => {
    var
      cId = crypto.createHash('md5').update(stringify(cond)).digest('hex'),
      condLink = condObj[index][collection][cId],
      keyword;

    if (condLink) {
      if (condLink.subfilters.indexOf(sfObj) === -1) {
        condLink.subfilters.push(sfObj);
        sfObj.conditions.push(condLink);
        diff.push(condLink);
      }
    }
    else {
      keyword = Object.keys(cond).filter(k => k !== 'not')[0];

      condObj[index][collection][cId] = {
        id: cId,
        subfilters: [sfObj],
        keyword: cond.not ? 'not' + keyword : keyword,
        value: cond[keyword],
      };
      sfObj.conditions.push(condObj[index][collection][cId]);
      diff.push(condObj[index][collection][cId]);
    }
  });

  return diff;
}

/**
 * Updates the test tables with a new subfilter
 *
 * @param {Object} testTables reference
 * @param {Object} subfilter to be added
 * @param {string} index
 * @param {string} collection
 * @param {string} id - subfilter unique identifier
 */
function addTestTables(testTables, subfilter, index, collection, id) {
  addIndexCollectionToObject(testTables, index, collection);

  if (!testTables[index][collection].subfilters) {

    testTables[index][collection] = {
      subfilters: {
        [id]: {
          cidx: 0,
          fidx: []
        }
      },
      filters: {

      },
      conditionsCount: [subfilter.conditions.length],
      filterIds: []
    };

    subfilter.filters.forEach(f => {
      testTables[index][collection].filters[f.id] = testTables[index][collection].filterIds.length;
      testTables[index][collection].subfilters[id].fidx.push(testTables[index][collection].filterIds.length);
      testTables[index][collection].filterIds.push(f.id);
    });
  }
  else if (!testTables[index][collection].subfilters[id]) {
    testTables[index][collection].subfilters[id] = {
      cidx: testTables[index][collection].conditionsCount.length,
      fidx: []
    };

    testTables[index][collection].conditionsCount.push(subfilter.conditions.length);

    // filling up the filters tables
    subfilter.filters.forEach(f => {
      var idx = testTables[index][collection].filters[f.id];

      if (idx === undefined) {
        testTables[index][collection].filters[f.id] = testTables[index][collection].filterIds.length;
        testTables[index][collection].subfilters[id].fidx.push(testTables[index][collection].filterIds.length);
        testTables[index][collection].filterIds.push(f.id);
      }
      else {
        testTables[index][collection].subfilters[id].fidx.push(idx);
      }
    });
  }
}

/**
 * Many storage objects separate data by index and collection.
 * This function avoids repetition of code by initializing an
 * object with an index and collection
 *
 * @param {Object} obj - object to update
 * @param {String} index
 * @param {String} collection
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
 * Removes a filter from test tables and rebuilds the structure if necessary
 *
 * @param {Object} testTables - test tables object to mutate
 * @param {String} index
 * @param {String} collection
 * @param {Object} filter - filter to be removed
 */
function removeFromTestTables(testTables, index, collection, filter) {
  if (testTables[index][collection].filterIds.length === 1) {
    if (Object.keys(testTables[index]).length === 1) {
      delete testTables[index];
    }
    else {
      delete testTables[index][collection]
    }

    return;
  }

  filter.subfilters.forEach(sf => {
    var deletedIndex = testTables[index][collection].subfilters[sf.id].cidx;

    delete testTables[index][collection].subfilters[sf.id];
    testTables[index][collection].conditionsCount.splice(deletedIndex, 1);

    // rebuilding array indexes references
    Object.keys(testTables[index][collection].subfilters).forEach(sfref => {
      if (testTables[index][collection].subfilters[sfref].cidx > deletedIndex) {
        testTables[index][collection].subfilters[sfref].cidx--;
      }
    });
  });

  testTables[index][collection].filterIds.splice(testTables[index][collection].filters[filter.id], 1);
  delete testTables[index][collection].filters[filter.id];
}

/**
 * Removes a field from an object. If the collection containing it
 * is empty after the removal, this function deletes it too.
 * Same goes for the index.
 *
 * @param {Object} obj - object containing the field to remove
 * @param {String} index
 * @param {String} collection
 * @param {String} field
 */
function destroy(obj, index, collection, field) {
  if (Object.keys(obj[index][collection]).length === 1) {
    if (Object.keys(obj[index]).length === 1) {
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
