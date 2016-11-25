var
  PartialError = require('kuzzle-common-objects').Errors.partialError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

module.exports = function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.import = function bulkImport (requestObject, userContext) {
    return engine.import(requestObject)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors on bulk', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return Promise.resolve({
          responseObject,
          userContext
        });
      });
  };

};
