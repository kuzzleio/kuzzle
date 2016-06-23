var
  q = require('q'),
  _ = require('lodash');

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {Object}
   */
  formatRoleForSerialization: function (role) {
/*    var response = {};

    response = {_id: role._id, _source: {}};
    Object.keys(role).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        response._source[key] = role[key];
      }
    });

    return response;*/
    return role;
  },

  /**
   * Serializes profile and transforms it into a POJO if hydrate is false
   *
   * @param {Profile} profile
   * @param {boolean} hydrate
   * @returns {Object}
   */
  formatProfileForSerialization: function (profile) {
    var response;
    /*
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

     return response;*/
    response = _.assignIn({}, {_id: profile._id, _source: profile});
    delete response._source._id;
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
  formatUserForSerialization: function (kuzzle, user) {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {
/*        if (typeof triggeredUser.profile === 'string') {
          return kuzzle.repositories.profile.loadProfile(triggeredUser.profile)
            .then(profile => {
              triggeredUser.profile = profile;
              return q(triggeredUser);
            });
        }*/
        console.log('triggered',triggeredUser)
        console.log('user',user)
        var response = _.assignIn({}, {_id: triggeredUser._id, _source: triggeredUser})
        delete response._source._id;
        return q(response);
      })
/*      .then(triggeredUser => {
        var
          response = triggeredUser;

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
      })*/;
  }
};