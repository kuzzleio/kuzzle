function NotEqualsCondition (value, flags, subfilter) {
  this.regexp = new RegExp(value, flags);
  this.stringValue = this.regexp.toString();
  this.subfilters = [subfilter];
}

module.exports = NotEqualsCondition;