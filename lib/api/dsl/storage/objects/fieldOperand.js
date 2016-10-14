var
  SortedArray = require('sorted-array'),
  strcmp = require('../../util/stringCompare');

module.exports = function FieldOperand() {
  this.keys = new SortedArray([], (a, b) => strcmp(a.field, b.field));
  this.fields = {};

  return this;
};
