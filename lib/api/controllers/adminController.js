var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

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

  /**
   * Returns the count of connected users by connection type
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.countConnections = function (requestObject) {
    var
      deferred = q.defer(),
      response = {
        total: 0,
        protocols: {}
      };

    kuzzle.pluginsManager.trigger('data:countConnections', requestObject);

    Object.keys(kuzzle.connections).forEach(function (protocol) {
      response.total += kuzzle.connections[protocol];
      response.protocols[protocol] = kuzzle.connections[protocol];
    });

    deferred.resolve(new ResponseObject(requestObject, response));

    return deferred.promise;
  };

};