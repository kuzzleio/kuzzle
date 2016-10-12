var
  SortedArray = require('sorted-array'),
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
   * There can never be more than 1 subfilter for an
   * all-matching filter
   *
   * @param {Object} foPairs
   * @param {Object} testTables
   * @param {Object} subfilter
   */
  this.everything = function (foPairs, testTables, subfilter) {
    foPairs.filter = subfilter.filters[0].id;
  };

  /**
   * Stores a "equals" value into the field-operand structure
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
   * Stores a "exists" value into the field-operand structure
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
   * Stores a "not exists" value into the field-operand structure
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

  return this;
}

module.exports = OperandsStorage;
