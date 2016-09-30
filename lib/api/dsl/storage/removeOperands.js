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
   * Removes a "equals" value from a field-operand pair
   *
   * The condition
   * @param {Object} foPairs
   * @param {String} index
   * @param {String} collection
   * @param {Object} condition
   */
  this.equals = function (foPairs, index, collection, condition) {
    var
      operand = foPairs[index][collection].equals,
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      pair = operand[fieldName];

    if (pair.conditions.length === 1) {
      destroy(foPairs, index, collection, 'equals', fieldName);
    }
    else {
      pair.conditions.splice(pair.conditions.indexOf(condition), 1);

      if (pair.values[value].length > 1) {
        pair.values[value].splice(pair.values[value].indexOf(condition), 1);
      }
      else {
        delete pair.values[value];
      }
    }
  };

  return this;
}

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
