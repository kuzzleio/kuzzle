class OperandMatch {

  /**
   * @param {Matcher} matcher
   */
  constructor (matcher) {
    this.matcher = matcher;
  }

  get store () {
    return this.matcher.store.foPairs;
  }

  match () {
    throw new Error('not implemented');
  }

}

module.exports = OperandMatch;
