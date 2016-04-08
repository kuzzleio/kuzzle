var
  q = require('q'),
  PartialError = require('../core/errors/partialError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function BulkController (kuzzle) {
  /**
   * Perform a bulk import
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:bulkImport', requestObject);
    
    return kuzzle.workerListener.add(requestObject)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors on bulk', stack);
          responseObject.status = responseObject.error.status;
        }

        return responseObject;
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

};