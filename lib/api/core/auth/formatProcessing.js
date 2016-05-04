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
  formatProfileForSerialization: function (profile, hydrate) {
    var response;

    if (!hydrate) {
      return profile;
    }

    response = {_id: profile._id, _source: {}};
    Object.keys(profile).forEach((key) => {
      if (key === 'roles') {
        response._source.roles = profile.roles.map((role) => {
          return this.formatRoleForSerialization(role);
        });
      }
      else if (key !== '_id') {
        response._source[key] = profile[key];
      }
    });

    return response;
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

        if (hydrate) {
          response = {_id: triggeredUser._id, _source: {}};
          Object.keys(triggeredUser).forEach((key) => {
            if (key === 'profile') {
              response._source.profile = this.formatProfileForSerialization(triggeredUser.profile, hydrate);
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