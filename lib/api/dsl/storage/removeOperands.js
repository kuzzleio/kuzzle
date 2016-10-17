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
  return this;
}

/**
 * Removes an empty filter from the structure
 *
 * The condition
 * @param {Object} foPairs
 * @param {String} index
 * @param {String} collection
 */
OperandsRemoval.prototype.everything = function everything (foPairs, index, collection) {
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
OperandsRemoval.prototype.equals = function equals (foPairs, index, collection, subfilter, condition) {
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
 * @param {String} [keyword]
 */
OperandsRemoval.prototype.exists = function exists (foPairs, index, collection, subfilter, condition, keyword) {
  var
    operand,
    fieldName = condition.value.field;

  keyword = keyword || 'exists';
  operand = foPairs[index][collection][keyword];

  if (operand.fields[fieldName].length > 1) {
    operand.fields[fieldName].splice(operand.fields[fieldName].indexOf(subfilter), 1);
  }
  else if (operand.keys.array.length > 1) {
    delete operand.fields[fieldName];
    operand.keys.remove(fieldName);
  }
  else {
    destroy(foPairs, index, collection, keyword);
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
OperandsRemoval.prototype.notexists = function notexists (foPairs, index, collection, subfilter, condition) {
  this.exists(foPairs, index, collection, subfilter, condition, 'notexists');
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
OperandsRemoval.prototype.range = function range (foPairs, index, collection, subfilter, condition) {
  var
    operand = foPairs[index][collection].range,
    field = Object.keys(condition.value)[0],
    info;

  if (operand.fields[field].count > 1) {
    info = operand.fields[field].subfilters[subfilter.id];
    operand.fields[field].tree.remove(info.low, info.high, info.subfilter);
    operand.fields[field].count--;
    delete operand.fields[field].subfilters[subfilter.id];
  }
  else if (operand.keys.array.length > 1) {
    delete operand.fields[field];
    operand.keys.remove(field);
  }
  else {
    destroy(foPairs, index, collection, 'range');
  }
};

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
