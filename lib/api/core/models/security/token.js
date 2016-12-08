/**
 * @constructor
 */
function Token () {
  this._id = null;
  this.expiresAt = null;
  this.ttl = null;
  this.userId = null;
  this.connectionId = null;
}

module.exports = Token;
