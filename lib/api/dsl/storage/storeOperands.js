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
   * Stores a "equals" value from a field-operand pair
   *
   * The condition
   * @param {Object} foPairs
   * @param {Object} condition
   */
  this.equals = function (foPairs, condition) {
    var
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName];

    if (!foPairs[fieldName]) {
      foPairs[fieldName] = {
        conditions: [condition],
        values: {
          [value]: [condition]
        }
      };
    }
    else {
      foPairs[fieldName].conditions.push(condition);

      if (foPairs[fieldName].values[value]) {
        foPairs[fieldName].values[value].push(condition);
      }
      else {
        foPairs[fieldName].values[value] = [condition];
      }
    }
  };

  return this;
}
module.exports = OperandsStorage;
