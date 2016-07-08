/**
 * @constructor
 */
function Token () {
  this._id = null;
  this.expiresAt = null;
  this.ttl = null;
  this.userId = null;
}

module.exports = Token;
