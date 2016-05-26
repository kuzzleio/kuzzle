var
  BadRequestError = require('../../errors/badRequestError'),
  q = require('q'),
  _ = require('lodash'),
  md5 = require('crypto-md5'),
  async = require('async');

function Profile () {
  this._id = null;
  this.roles = [];
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

/**
 * Resolves an array of policies related to the profile's roles.
 *
 * @return {Promise}
 */
Profile.prototype.getPolicies = function() {
  var policies = {};

  this.roles.forEach(role => {
    Object.keys(role.controllers).forEach(controller => {
      var restrictedTo = _.cloneDeep(role.restrictedTo);

      Object.keys(role.controllers[controller].actions).forEach(action => {
        var actionRights = role.controllers[controller].actions[action];

        if (restrictedTo === undefined || restrictedTo.length === 0) {
          restrictedTo = [{index: '*', collections: ['*']}];
        }

        restrictedTo.forEach(restriction => {
          if (restriction.collections === undefined || restriction.collections.length === 0) {
            restriction.collections = ['*'];
          }

          restriction.collections.forEach(collection => {
            var
              policyObject = {},
              policy = {
                controller: controller,
                action: action,
                index: restriction.index,
                collection: collection
              },
              policyKey = md5(JSON.stringify(policy));

            policy.value = actionRights;
            policyObject[policyKey] = policy;
            policies = _.assignWith(policies, policyObject, mergePolicies);
          });
        });
      });
    });
  });

  return q(policies);
};

module.exports = Profile;

/**
 * Merge function for policies
 * @param existing policy object
 * @param new policy object to merge
 *
 * @return the merged policy object
 */
function mergePolicies(currentPolicy, newPolicy) {
  if (newPolicy.value === 'allowed') {
    return newPolicy;
  }
  if (newPolicy.value === true) {
    newPolicy.value = 'allowed';
    return newPolicy;
  }

  if (currentPolicy !== undefined) {
    if (currentPolicy.value === 'allowed') {
      newPolicy.value = 'allowed';
      return newPolicy;
    }
    if (currentPolicy.value === true) {
      newPolicy.value = 'allowed';
      return newPolicy;
    }
  }

  if (newPolicy.value === 'conditional') {
    return newPolicy;
  }
  if (_.isObject(newPolicy.value)) {
    newPolicy.value = 'conditional';
    return newPolicy;
  }

  if (currentPolicy !== undefined) {
    if (currentPolicy.value === 'conditional') {
      newPolicy.value = 'conditional';
      return newPolicy;
    }
    if (_.isObject(currentPolicy.value)) {
      newPolicy.value = 'conditional';
      return newPolicy;
    }
  }

  // if neithe the current policy or the new policy has "allowed" or "conditional" value,
  // the action is denied.
  newPolicy.value = 'denied';
  return newPolicy;
}

