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
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      operand = foPairs[index][collection].equals;

    if (operand.fields[fieldName][value].length > 1) {
      operand.fields[fieldName][value].splice(operand.fields[fieldName][value].indexOf(subfilter), 1);
    }
    else if (Object.keys(operand.fields[fieldName]).length > 1) {
      delete operand.fields[fieldName][value];
    }
    else if (operand.keys.array.length > 1) {
      operand.keys.remove(fieldName);
      delete operand.fields[fieldName];
    }
    else {
      destroy(foPairs, index, collection, 'equals');
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
      fieldName = condition.value.field;

    console.dir(foPairs, {depth: null});

    if (operand.fields[fieldName].length > 1) {
      operand.fields[fieldName].splice(operand.fields[fieldName].indexOf(subfilter), 1);
    }
    else if (operand.keys.array.length > 1) {
      delete operand.fields[fieldName];
      operand.keys.remove(fieldName);
    }
    else {
      destroy(foPairs, index, collection, 'exists');
    }


    console.log('====');
    console.dir(foPairs, {depth: null});
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
 * @param operand
 */
function destroy(foPairs, index, collection, operand) {
  if (Object.keys(foPairs[index][collection]).length === 1) {
    if (Object.keys(foPairs[index]).length === 1) {
      delete foPairs[index];
    }
    else {
      delete foPairs[index][collection];
    }
  }
  else {
    delete foPairs[index][collection][operand];
  }
}

module.exports = OperandsRemoval;
