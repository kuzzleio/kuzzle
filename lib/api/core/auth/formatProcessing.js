var
  q = require('q');

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {Object}
   */
  formatRoleForSerialization: function (role) {
    var response = {};

    response = {_id: role._id, _source: {}};
    Object.keys(role).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        response._source[key] = role[key];
      }
    });

    return response;
  },

  /**
   * Serializes profile and transforms it into a POJO if hydrate is false
   *
   * @param {Profile} profile
   * @param {boolean} hydrate
   * @returns {Object}
   */
  formatProfileForSerialization: function (kuzzle, profile, hydrate) {
    var response;
console.log('************ profile');
console.dir(profile, {depth: 20});
    if (!hydrate) {
      return profile;
    }
    if (typeof profile === 'string') {
      return kuzzle.repositories.profile.loadProfile(profile)
        .then(hydratedProfile => {
console.log('************ hydratedProfile');
console.dir(hydratedProfile, {depth: 20});
          response = {_id: hydratedProfile._id, _source: {}};
          Object.keys(hydratedProfile).forEach((key) => {
            if (key === 'roles') {
              response._source.roles = hydratedProfile.roles.map((role) => {
                return this.formatRoleForSerialization(role);
              });
            }
            else if (key !== '_id') {
              response._source[key] = hydratedProfile[key];
            }
          });

          return response;
        });
    }
  },

  /**
   * Serializes user and transforms it into a POJO if hydrate is false
   *
   * @param {Kuzzle} kuzzle
   * @param {User} user
   * @param {boolean} hydrate
   * @returns {Object}
   */
  formatUserForSerialization: function (kuzzle, user, hydrate) {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {
        var response = triggeredUser;
console.log('************ triggeredUser');
console.dir(triggeredUser, {depth: 20});

        if (hydrate) {
          response = {_id: triggeredUser._id, _source: {}};
          Object.keys(triggeredUser).forEach((key) => {
            if (key === 'profile') {
              response._source.profile = this.formatProfileForSerialization(kuzzle, triggeredUser.profile, hydrate);
            }
            else if (key !== '_id') {
              response._source[key] = triggeredUser[key];
            }
          });
        }
        return q(response);
      });
  }
};