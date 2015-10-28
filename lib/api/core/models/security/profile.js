function Profile () {
  this.name = null;
  this.roles = [];
}


/**
 * @param database
 *
 * @return {boolean}
 */
Profile.prototype.isActionAllowed = function (requestObject, context) {
  var
    result = false;

  if (this.roles === undefined || this.roles.length === 0) {
    return false;
  }

  this.roles.forEach(function (role) {
    if (role.isActionAllowed(requestObject, context) === true) {
      result = true;
      return false;
    }
  });

  return result;
};

module.exports = Profile;
