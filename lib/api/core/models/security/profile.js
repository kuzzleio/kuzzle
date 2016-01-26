var
  BadRequestError = require('../../errors/badRequestError'),
  q = require('q'),
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
  if (this.roles === undefined || this.roles.length === 0) {
    return false;
  }

  return this.roles.some(function (role) {
    return role.isActionAllowed(requestObject, context, indexes);
  });
};

Profile.prototype.validateDefinition = function () {
  if (!_.isArray(this.roles)) {
    return q.reject(new BadRequestError('The roles member must be an array'));
  }

  if (_.isEmpty(this.roles)) {
    return q.reject(new BadRequestError('The roles member array cannot be empty'));
  }

  return q(true);
};

module.exports = Profile;
