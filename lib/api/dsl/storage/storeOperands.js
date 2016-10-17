// Required to load node-interval-tree
require('babel-polyfill');

var
  IntervalTree = require('node-interval-tree');

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
  return this;
}

/**
 * Stores an empty filter in the <f,o> pairs structure
 * There can never be more than 1 filter and subfilter for an
 * all-matching filter, for an index/collection pair
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 */
OperandsStorage.prototype.everything = function everything (foPairs, subfilter) {
  foPairs.fields.all = [subfilter];
};

/**
 * Stores a "equals" condition into the field-operand structure
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 * @param {Object} condition
 */
OperandsStorage.prototype.equals = function equals (foPairs, subfilter, condition) {
  var
    fieldName = Object.keys(condition.value)[0],
    value = condition.value[fieldName];

  if (!foPairs.fields[fieldName]) {
    foPairs.keys.insert(fieldName);
    foPairs.fields[fieldName] = {
      [value]: [subfilter]
    };
  }
  else if (foPairs.fields[fieldName][value]) {
    foPairs.fields[fieldName][value].push(subfilter);
  }
  else {
    foPairs.fields[fieldName][value] = [subfilter];
  }
};

/**
 * Stores a "exists" condition into the field-operand structure
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 * @param {Object} condition
 */
OperandsStorage.prototype.exists = function exists (foPairs, subfilter, condition) {
  var
    fieldName = condition.value.field;

  if (!foPairs.fields[fieldName]) {
    foPairs.keys.insert(fieldName);
    foPairs.fields[fieldName] = [subfilter];
  }
  else {
    foPairs.fields[fieldName].push(subfilter);
  }
};

/**
 * Stores a "not exists" condition into the field-operand structure
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 * @param {Object} condition
 */
OperandsStorage.prototype.notexists = function notexists (foPairs, subfilter, condition) {
  this.exists(foPairs, subfilter, condition);
};

/**
 * Stores a "range" condition into the field-operand structure
 *
 * Stores the range in interval trees for searches in O(log n + m)
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 * @param {Object} condition
 */
OperandsStorage.prototype.range = function range (foPairs, subfilter, condition) {
  var
    field = Object.keys(condition.value)[0],
    args = condition.value[field],
    low = -Infinity,
    high = Infinity;

  /*
   Initializes low and high values depending on condition arguments
   As the interval tree library used only considers inclusive boundaries,
   we need to add or substract an epsilon value to provided arguments
   for lt and gt options.
   */
  Object.keys(args).forEach(a => {
    if (['gt', 'gte'].indexOf(a) !== -1) {
      low = a === 'gt' ? args[a] + 10e-10 : args[a];
    }

    if (['lt', 'lte'].indexOf(a) !== -1) {
      high = a === 'lt' ? args[a] - 10e-10 : args[a];
    }
  });

  if (high < low) {
    return;
  }

  if (!foPairs.fields[field]) {
    foPairs.keys.insert(field);
    foPairs.fields[field] = {
      tree: new IntervalTree(),
      count: 1,
      subfilters: {
        [subfilter.id]: {subfilter, low, high}
      }
    };
  }
  else {
    foPairs.fields[field].subfilters[subfilter.id] = {subfilter, low, high};
    foPairs.fields[field].count++;
  }

  foPairs.fields[field].tree.insert(low, high, subfilter);
};

/**
 * Stores a "not range" condition into the field-operand structure
 *
 * "not range" conditions are stored as an inverted range,
 * meaning that if a user subscribes to the following range:
 *      [min, max]
 * Then we register the following ranges in the tree:
 *      ]-Infinity, min[
 *      ]max, +Infinity[
 *
 * (boundaries are also reversed: inclusive boundaries become
 * exclusive, and vice-versa)
 *
 * Matching is then executed exactly like for "range" conditions.
 * This does not hurt performances as searches in the interval tree
 * is in O(log n)
 *
 * (kudos to @asendra for this neat trick)
 *
 * @param {Object} foPairs
 * @param {Object} subfilter
 * @param {Object} condition
 */
OperandsStorage.prototype.notrange = function notrange (foPairs, subfilter, condition) {
  var
    field = Object.keys(condition.value)[0],
    args = condition.value[field],
    low = -Infinity,
    high = Infinity;

  /*
   Initializes low and high values depending on condition arguments
   As the interval tree library used only considers inclusive boundaries,
   we need to add or substract an epsilon value to provided arguments
   for lte and gte options
   This is the reverse operation than the one done for the "range"
   keyword, as we then invert the searched range.
   */
  Object.keys(args).forEach(a => {
    if (['gt', 'gte'].indexOf(a) !== -1) {
      low = a === 'gte' ? args[a] - 10e-10 : args[a];
    }

    if (['lt', 'lte'].indexOf(a) !== -1) {
      high = a === 'lte' ? args[a] + 10e-10 : args[a];
    }
  });

  if (high < low) {
    return;
  }

  if (!foPairs.fields[field]) {
    foPairs.keys.insert(field);
    foPairs.fields[field] = {
      tree: new IntervalTree(),
      count: 1,
      subfilters: {
        [subfilter.id]: {subfilter, low, high}
      }
    };
  }
  else {
    foPairs.fields[field].subfilters[subfilter.id] = {subfilter, low, high};
    foPairs.fields[field].count++;
  }

  if (low !== -Infinity) {
    foPairs.fields[field].tree.insert(-Infinity, low, subfilter);
  }

  if (high !== +Infinity) {
    foPairs.fields[field].tree.insert(high, +Infinity, subfilter);
  }
};

module.exports = OperandsStorage;
