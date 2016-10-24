var
  SortedArray = require('sorted-array'),
  strcmp = require('../../util/stringCompare');

function FieldOperand() {
  this.keys = new SortedArray([], strcmp);
  this.fields = {};
  this.custom = {};

  return this;
}

module.exports = FieldOperand;
