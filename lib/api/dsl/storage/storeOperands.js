// Required to load node-interval-tree
require('babel-polyfill');

var
  SortedArray = require('sorted-array'),
  IntervalTree = require('node-interval-tree'),
  strcmp = require('../util/stringCompare');

/**
 * Exposes a sets of methods meant to store operands in
 * the DSL keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point directly
 * to the right index/collection/keyword part of the structure
 *
 * @constructor
 */
function OperandsStorage () {
  /**
   * Stores an empty filter in the <f,o> pairs structure
   * There can never be more than 1 filter and subfilter for an
   * all-matching filter, for an index/collection pair
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   */
  this.everything = function (foPairs, testTables, subfilter) {
    foPairs.filter = subfilter.filters[0].id;
  };

  /**
   * Stores a "equals" condition into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.equals = function (foPairs, testTables, subfilter, condition) {
    var
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      item = {
        id: subfilter.id,
        cidx: [testTables.subfilters[subfilter.id].cidx],
        fidx: [testTables.subfilters[subfilter.id].fidx]
      };

    if (!foPairs[fieldName]) {
      foPairs[fieldName] = {
        count: 1,
        values: {
          [value]: [item]
        }
      };
    }
    else {
      if (foPairs[fieldName].values[value]) {
        foPairs[fieldName].values[value].push(item);
      }
      else {
        foPairs[fieldName].count++;
        foPairs[fieldName].values[value] = [item];
      }
    }
  };

  /**
   * Stores a "exists" condition into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.exists = function (foPairs, testTables, subfilter, condition) {
    var
      fieldName = condition.value.field;

    if (!foPairs.fields || !foPairs.keys) {
      foPairs.keys = new SortedArray([]);
      foPairs.fields = {};
    }

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = {
        subfilters: [subfilter.id],
        cidx: [testTables.subfilters[subfilter.id].cidx],
        fidx: [testTables.subfilters[subfilter.id].fidx]
      };
    }
    else {
      foPairs.fields[fieldName].subfilters.push(subfilter.id);
      foPairs.fields[fieldName].cidx.push(testTables.subfilters[subfilter.id].cidx);
      foPairs.fields[fieldName].fidx.push(testTables.subfilters[subfilter.id].fidx);
    }
  };

  /**
   * Stores a "not exists" condition into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.notexists = function (foPairs, testTables, subfilter, condition) {
    var
      field = condition.value.field,
      idx;

    if (!foPairs.mapping) {
      foPairs.mapping = new SortedArray([], (a, b) => strcmp(a.field, b.field));
    }

    idx = foPairs.mapping.search[{field}];

    if (idx === undefined) {
      foPairs.mapping.insert({
        field,
        subfilters: [subfilter.id],
        cidx: [testTables.subfilters[subfilter.id].cidx],
        fidx: [testTables.subfilters[subfilter.id].fidx]});
    }
    else {
      foPairs.mapping.array[idx].subfilters.push(subfilter.id);
      foPairs.mapping.array[idx].cidx.push(testTables.subfilters[subfilter.id].cidx);
      foPairs.mapping.array[idx].fidx.push(testTables.subfilters[subfilter.id].fidx);
    }
  };

  /**
   * Stores a "range" condition into the field-operand structure
   *
   * Stores the range in interval trees for searches in O(log n + m)
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.range = function (foPairs, testTables, subfilter, condition) {
    var
      field = Object.keys(condition.value)[0],
      args = condition.value[field],
      low = -Infinity,
      high = Infinity,
      idx;

    /*
     Initializes low and high values depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract Number.MIN_VALUE to provided arguments
     for lt and gt options.
     */
    Object.keys(args).forEach(a => {
      if (['gt', 'gte'].indexOf(a) !== -1) {
        low = a === 'gt' ? args[a] - Number.MIN_VALUE : args[a];
      }

      if (['lt', 'lte'].indexOf(a) !== -1) {
        high = a === 'lt' ? args[a] + Number.MIN_VALUE : args[a];
      }
    });

    if (high < low) {
      return;
    }

    if (!foPairs.fields || !foPairs.keys) {
      foPairs.fields = {};
      foPairs.keys = [];
    }

    if (!foPairs.fields[field]) {
      idx = 0;

      foPairs.keys.push(field);
      foPairs.fields[field] = {
        tree: new IntervalTree(),
        subfilters: {
          [subfilter.id]: {
            index: 0,
            low,
            high
          }
        },
        cIndexes: [testTables.subfilters[subfilter.id].cidx],
        fIndexes: [testTables.subfilters[subfilter.id].fidx]
      };
    }
    else {
      idx = foPairs.fields[field].cIndexes.length;

      foPairs.fields[field].subfilters[subfilter.id] = {
        index: idx,
        low,
        high
      };

      foPairs.fields[field].cIndexes.push(testTables.subfilters[subfilter.id].cidx);
      foPairs.fields[field].fIndexes.push(testTables.subfilters[subfilter.id].fidx);
    }

    foPairs.fields[field].tree.insert(low, high, idx);
  };

  return this;
}

module.exports = OperandsStorage;
