var
  ResponseObject = require('../core/models/responseObject');

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
        if (role && role.closures) {
          delete role.closures;
        }

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

    return kuzzle.repositories.role.searchRole(requestObject)
      .then((response) => {
        if (requestObject.data.body.hydrate && response.data.body && response.data.body.hits) {
          response.data.body.hits = response.data.body.hits.map(role => {
            var parsedRole = {};

            parsedRole._id = role._id;
            parsedRole._source = {indexes: role.indexes};

            return parsedRole;
          });
        }

        return Promise.resolve(response);
      });
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