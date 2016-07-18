var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  Role = require('./role'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  md5 = require('crypto-md5'),
  async = require('async');

function Profile () {
  this._id = null;
  this.policies = [];
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */

Profile.prototype.getRoles = function (kuzzle) {
  var promises;
  promises = this.policies.map(policy => {
    return kuzzle.repositories.role.loadRole(policy.roleId)
      .then(loadedRole => _.assignIn(new Role(), loadedRole, policy));
  });

  return Promise.all(promises);
};

/**
 * @param {RequestObject} requestObject
 * @param {Context} context
 * @param {Kuzzle} kuzzle
 *
 * @return Promise
 */
Profile.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  if (this.policies === undefined || this.policies.length === 0) {
    return Promise.resolve(false);
  }

  return this.getRoles(kuzzle)
    .then(roles => {
      return new Promise(resolve => {
        async.some(roles, (role, callback) => {
          role.isActionAllowed(requestObject, context, kuzzle)
            .then(isAllowed => callback(isAllowed));
        }, result => resolve(result));
      });
    });
};

/**
 * Validates the Profile format
 *
 * @return {Promise}
 */
Profile.prototype.validateDefinition = function () {
  if (!_.isArray(this.policies)) {
    return Promise.reject(new BadRequestError('The roles member must be an array'));
  }

  if (this.policies.length === 0) {
    return Promise.reject(new BadRequestError('The roles member array cannot be empty'));
  }

  return Promise.resolve(true);
};

/**
 * Resolves an array of rights related to the profile's roles.
 *
 * @return {Promise}
 */
Profile.prototype.getRights = function(kuzzle) {
  var profileRights = {};

  return this.getRoles(kuzzle)
    .then(roles => {
      roles.forEach(role => {
        var restrictedTo = _.cloneDeep(role.restrictedTo);

        if (restrictedTo === undefined || restrictedTo.length === 0) {
          restrictedTo = [{index: '*', collections: ['*']}];
        }

        Object.keys(role.controllers).forEach(controller => {
          Object.keys(role.controllers[controller].actions).forEach(action => {
            var actionRights = role.controllers[controller].actions[action];

            restrictedTo.forEach(restriction => {
              if (restriction.collections === undefined || restriction.collections.length === 0) {
                restriction.collections = ['*'];
              }

              restriction.collections.forEach(collection => {
                var
                  rightsObject = {},
                  rightsItem = {
                    controller: controller,
                    action: action,
                    index: restriction.index,
                    collection: collection
                  },
                  rightsKey = md5(JSON.stringify(rightsItem));

                rightsItem.value = actionRights;
                rightsObject[rightsKey] = rightsItem;
                _.assignWith(profileRights, rightsObject, mergeRights);
              });
            });
          });
        });
      });
    })
    .then(() => profileRights);
};

module.exports = Profile;

/**
 * Merge function for rights
 * @param {{value: String}} prev existing rights object
 * @param {{value: String}} cur new rights object to merge
 *
 * @return {{value: String}} the merged rights object
 */
function mergeRights(prev, cur) {
  if (cur.value === 'allowed') {
    return cur;
  }
  if (cur.value === true) {
    cur.value = 'allowed';
    return cur;
  }

  if (prev !== undefined) {
    if (prev.value === 'allowed') {
      cur.value = 'allowed';
      return cur;
    }
    if (prev.value === true) {
      cur.value = 'allowed';
      return cur;
    }
  }

  if (cur.value === 'conditional') {
    return cur;
  }
  if (_.isObject(cur.value)) {
    cur.value = 'conditional';
    return cur;
  }

  if (prev !== undefined) {
    if (prev.value === 'conditional') {
      cur.value = 'conditional';
      return cur;
    }
    if (_.isObject(prev.value)) {
      cur.value = 'conditional';
      return cur;
    }
  }

  // if neither the current rights or the new rights has "allowed" or "conditional" value,
  // the action is denied.
  cur.value = 'denied';
  return cur;
}

