var
  BadRequestError = require('../../errors/badRequestError'),
  q = require('q'),
  _ = require('lodash'),
  async = require('async');

function Profile () {
  this._id = null;
  this.roles = [];
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */

Profile.prototype.getRoles = function (kuzzle) {
  if (!this._roles) {
    this._roles = kuzzle.repositories.list.role.loadRoles(this.roles);
  }
  return this._roles;
}
/**
 * @param {RequestObject} requestObject
 * @param context
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */
Profile.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  var
    deferred = q.defer();

  if (this.roles === undefined || this.roles.length === 0) {
    return q(false);
  }

  async.some(this.roles, (role, callback) => {
    role.isActionAllowed(requestObject, context, kuzzle)
      .then(isAllowed => {
        callback(isAllowed);
      });
  }, result => {
    deferred.resolve(result);
  });

  return deferred.promise;
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
