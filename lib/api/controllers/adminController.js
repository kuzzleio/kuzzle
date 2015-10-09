var
  q = require('q');

module.exports = function AdminController (kuzzle) {

  /**
   * Delete the entire collection and associate mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.deleteCollection = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:deleteCollection', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.putMapping = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:putMapping', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {

    kuzzle.pluginsManager.trigger('data:getMapping', requestObject);

    return kuzzle.services.list.readEngine.getMapping(requestObject);
  };

};