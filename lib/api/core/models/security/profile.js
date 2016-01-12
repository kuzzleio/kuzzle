var
  BadRequestError = require('../../errors/badRequestError'),
  _ = require('lodash');

function Profile () {
  this._id = null;
  this.roles = [];
}


/**
 * @param requestObject
 * @param context
 * @param indexes
 *
 * @return {boolean}
 */
Profile.prototype.isActionAllowed = function (requestObject, context, indexes) {
  var result = false;

  if (this.roles === undefined || this.roles.length === 0) {
    return false;
  }

  result = this.roles.some(function (role) {
    return role.isActionAllowed(requestObject, context, indexes);
  });

  return result;
};

Profile.prototype.validateDefinition = function (context) {
  if (!_.isArray(this.roles)) {
    return Promise.reject(new BadRequestError('The roles member must be an array'));
  }

  if (_.isEmpty(this.roles)) {
    return Promise.reject(new BadRequestError('The roles member array cannot be empty'));
  }

  return Promise.resolve(true);
};

module.exports = Profile;
