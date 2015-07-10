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

    kuzzle.emit('data:deleteCollection', requestObject);

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

    kuzzle.emit('data:putMapping', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {
    return kuzzle.services.list.readEngine.getMapping(requestObject.data);
  };

};