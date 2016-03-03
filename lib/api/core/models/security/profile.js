var
  BadRequestError = require('../../errors/badRequestError'),
  q = require('q'),
  _ = require('lodash');

function Profile () {
  this._id = null;
  this.roles = [];
}


/**
 * @param {RequestObject} requestObject
 * @param context
 * @param indexes
 * @param {Kuzzle} kuzzle
 *
 * @return {boolean}
 */
Profile.prototype.isActionAllowed = function (requestObject, context, indexes, kuzzle) {
  if (this.roles === undefined || this.roles.length === 0) {
    return false;
  }

  return this.roles.some(function (role) {
    return role.isActionAllowed(requestObject, context, indexes, kuzzle);
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
