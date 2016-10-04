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
          [value]: [subfilter]
        }
      };
    }
    else {
      if (foPairs[fieldName].values[value]) {
        foPairs[fieldName].values[value].push(subfilter);
      }
      else {
        foPairs[fieldName].count++;
        foPairs[fieldName].values[value] = [subfilter];
      }
    }
  };

  return this;
}
module.exports = OperandsStorage;
