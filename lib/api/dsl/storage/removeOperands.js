/**
 * Exposes a sets of methods meant to store operands in
 * the DSL keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point to
 * the root of the structure. This allows cleaning up the
 * entire object when removing conditions
 *
 * @constructor
 */
function OperandsRemoval () {
  /**
   * Removes an empty filter from the structure
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   */
  this.everything = function (foPairs, index, collection) {
    destroy(foPairs, index, collection, 'everything');
  };

  /**
   * Removes a "equals" value from the field-operand structure
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.equals = function (foPairs, index, collection, subfilter, condition) {
    var
      operand = foPairs[index][collection].equals,
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      pair = operand[fieldName];

    if (pair.values[value].length > 1) {
      pair.values[value].splice(pair.values[value].findIndex(item => item.id === subfilter.id), 1);
    }
    else if (pair.count === 1) {
      destroy(foPairs, index, collection, 'equals', fieldName);
    }
    else {
      delete pair.values[value];
      pair.count--;
    }
  };

  /**
   * Removes a "exists" value from the field-operand structure
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.exists = function (foPairs, index, collection, subfilter, condition) {
    var
      operand = foPairs[index][collection].exists,
      fieldName = condition.value.field,
      idx;

    if (operand.keys.length > 1) {
      if (operand.fields[fieldName].length > 1) {
        idx = operand.fields[fieldName].subfilters.indexOf(subfilter.id);
        operand.fields[fieldName].subfilters.splice(idx, 1);
        operand.fields[fieldName].cidx.splice(idx, 1);
        operand.fields[fieldName].fidx.splice(idx, 1);
      }
      else {
        delete operand.fields[fieldName];
        operand.keys.remove(fieldName);
      }
    }
    else {
      destroy(foPairs, index, collection, 'exists', fieldName);
    }
  };

  /**
   * Removes a "not exists" value from the field-operand structure
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.notexists = function (foPairs, index, collection, subfilter, condition) {
    var
      operand = foPairs[index][collection].notexists,
      field = condition.value.field,
      item = operand.mapping.array[operand.mapping.search({field})],
      idx;

    if (item.subfilters.length > 1) {
      idx = item.subfilters.indexOf(subfilter.id);
      item.subfilters.splice(idx, 1);
      item.cidx.splice(idx, 1);
      item.fidx.splice(idx, 1);
    }
    else if (operand.mapping.array.length > 1) {
      operand.mapping.remove({field});
    }
    else {
      destroy(foPairs, index, collection, 'notexists', 'mapping');
    }
  };

  /**
   * Removes a "range" value from the field-operand structure
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   * @param {Object} subfilter
   * @param {Object} condition
   */
  this.range = function (foPairs, index, collection, subfilter, condition) {

  };

  return this;
}

/**
 * Performs a cascading removal of a field-operand pair
 *
 * @param foPairs
 * @param index
 * @param collection
 * @param keyword
 * @param [fieldName]
 */
function destroy(foPairs, index, collection, keyword, fieldName) {
  if (Object.keys(foPairs[index][collection][keyword]).length === 1) {
    if (Object.keys(foPairs[index][collection]).length === 1) {
      if (Object.keys(foPairs[index]).length === 1) {
        delete foPairs[index];
      }
      else {
        delete foPairs[index][collection];
      }
    }
    else {
      delete foPairs[index][collection][keyword];
    }
  }
  else {
    delete foPairs[index][collection][keyword][fieldName];
  }
}

module.exports = OperandsRemoval;
