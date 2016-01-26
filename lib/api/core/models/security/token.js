function Token () {
  this._id = null;
  this.expiresAt = null;
  this.ttl = null;
  this.user = null;
}

module.exports = Token;
