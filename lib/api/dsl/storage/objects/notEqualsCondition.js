function NotEqualsCondition (value, subfilter) {
  this.value = value;
  this.subfilters = [subfilter];
}

module.exports = NotEqualsCondition;