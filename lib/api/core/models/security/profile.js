function Profile () {
  this._id = null;
  this.roles = [];
}


/**
 * @param requestObject
 * @param context
 *
 * @return {boolean}
 */
Profile.prototype.isActionAllowed = function (requestObject, context) {
  var result = false;

  if (this.roles === undefined || this.roles.length === 0) {
    return false;
  }

  result = this.roles.some(function (role) {
    return role.isActionAllowed(requestObject, context);
  });

  return result;
};

module.exports = Profile;
