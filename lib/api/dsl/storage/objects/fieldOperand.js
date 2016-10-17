var
  SortedArray = require('sorted-array'),
  strcmp = require('../../util/stringCompare');

function FieldOperand() {
  this.keys = new SortedArray([], (a, b) => strcmp(a, b));
  this.fields = {};

  return this;
}

module.exports = FieldOperand;
