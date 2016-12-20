var _ = require('lodash');

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {object}
   */
  formatRoleForSerialization: function formatRoleForSerialization (role) {
    var response = {_id: role._id};

    response._source = _.assignIn({}, role);

    delete response._source._id;
    delete response._source.closures;
    delete response._source.allowInternalIndex;
    delete response._source.restrictedTo;

    return response;
  },

  /**
   * Serializes profile and transforms it into a POJO
   *
   * @param {Profile} profile
   * @returns {object}
   */
  formatProfileForSerialization: function formatProfileForSerialization (profile) {
    var response = {_id: profile._id};

    response._source = _.assignIn({}, profile);
    delete response._source._id;

    return response;
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {Kuzzle} kuzzle
   * @param {User} user
   * @returns {Promise}
   */
  formatUserForSerialization: function formatUserForSerialization (kuzzle, user) {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {

        var response = {_id: triggeredUser._id, _source: triggeredUser};
        delete response._source._id;
        
        return response;
      });
  }
};