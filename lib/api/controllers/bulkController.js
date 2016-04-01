var
  ResponseObject = require('../core/models/responseObject');

module.exports = function BulkController (kuzzle) {

  /**
   * Do a bulk import
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.import = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:bulkImport', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => new ResponseObject(requestObject, response));
  };

};