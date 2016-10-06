var
  SortedArray = require('sorted-array');

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
   * @param {Object} subfilter
   */
  this.everything = function (foPairs, subfilter) {
    foPairs.subfilter = subfilter;
  };

  /**
   * Stores a "equals" value into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.equals = function (foPairs, subfilter, condition) {
    var
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName];

    if (!foPairs[fieldName]) {
      foPairs[fieldName] = {
        count: 1,
        values: {
          [value]: [subfilter.id]
        }
      };
    }
    else {
      if (foPairs[fieldName].values[value]) {
        foPairs[fieldName].values[value].push(subfilter.id);
      }
      else {
        foPairs[fieldName].count++;
        foPairs[fieldName].values[value] = [subfilter.id];
      }
    }
  };

  /**
   * Stores a "exists" value into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.exists = function (foPairs, subfilter, condition) {
    var
      fieldName = condition.value.field;

    if (!foPairs.fields || !foPairs.keys) {
      foPairs.keys = new SortedArray([]);
      foPairs.fields = {};
    }

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = [subfilter.id];
    }
    else {
      foPairs.fields[fieldName].push(subfilter.id);
    }
  };

  /**
   * Stores a "not exists" value into the field-operand structure
   *
   * @param {Object} foPairs
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.notexists = function (foPairs, subfilter, condition) {
    var
      field = condition.value.field,
      idx;

    if (!foPairs.mapping) {
      foPairs.mapping = new SortedArray([], (a, b) => {
        if (a.field === b.field) {
          return 0;
        }

        return a.field < b.field ? -1 : 1;
      });
    }

    idx = foPairs.mapping.search[{field}];

    if (idx === undefined) {
      foPairs.mapping.insert({field, subfilters: [subfilter.id]});
    }
    else {
      foPairs.mapping.array[idx].subfilters.push(subfilter.id);
    }
  };

  return this;
}

module.exports = OperandsStorage;
