var _ = require('lodash');

module.exports = {
  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {Object}
   */
  formatRoleForSerialization: function (_role) {
    var role = _.assignIn({_id: _role._id}, {_source: _role});
    delete role._source._id;
    return role;
  },

  /**
   * Serializes profile and transforms it into a POJO
   *
   * @param {Profile} profile
   * @returns {Object}
   */
  formatProfileForSerialization: function (profile) {
    var response;

    response = {_id: profile._id, _source: profile};
    delete response._source._id;

    return response;
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {Kuzzle} kuzzle
   * @param {User} user
   * @returns {Object}
   */
  formatUserForSerialization: function (kuzzle, user) {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {

        var response = {_id: triggeredUser._id, _source: triggeredUser};
        delete response._source._id;
        
        return response;
      });
  }
};