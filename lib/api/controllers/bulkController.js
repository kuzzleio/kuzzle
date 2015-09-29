var
  q = require('q');

module.exports = function BulkController (kuzzle) {

  /**
   * Do a bulk import
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.import = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:bulkImport', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

};