var
  ResponseObject = require('../core/models/responseObject'),
  BadRequestError = require('../core/errors/badRequestError');

module.exports = function SecurityController (kuzzle) {

  /**
   * Get a specific role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getRole', requestObject);

    return kuzzle.repositories.role.loadRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
      )
      .then(role => {
        return Promise.resolve(new ResponseObject(requestObject, role || {}));
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:searchRole', requestObject);

    return kuzzle.repositories.role.searchRole(requestObject);
  };

  /**
   * Create or update a Role
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.putRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:putRole', requestObject);

    return kuzzle.repositories.role.validateAndSaveRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
      )
      .then(result => {
        return Promise.resolve(new ResponseObject(requestObject, result));
      });
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteRole', requestObject);

    return kuzzle.repositories.role.deleteRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
    );
  };
};