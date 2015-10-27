var
  q = require('q'),
  kuzzle = require('../../../../../lib');

function Profile () {
  this.name = null;
  this.roles = [];
}


/**
 * @param database
 *
 * @return {boolean}
 */
Profile.prototype.isActionAllowed = function (database, collection, controller, action, requestObject) {
  var
    result = true;

  this.roles.forEach(function (role) {
    if (role.isActionAllowed(database, collection, controller, action, requestObject) === false) {
      result = false;
      return false;
    }
  });

  return result;
};

module.exports = Profile;
